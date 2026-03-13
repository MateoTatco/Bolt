import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

// Ensure Firebase Admin is initialized in this module (some tools load it directly)
try {
    if (!admin.apps.length) {
        admin.initializeApp();
    }
} catch (error) {
    // Admin might already be initialized; log and continue
    console.log('Firebase Admin initialization in crewTracker:', error);
}

// Local Firestore handle for crew-related utilities
const db = admin.firestore();

/**
 * Nightly backup of crew schedule documents into a Firestore backup collection.
 *
 * This does NOT replace full database exports to Cloud Storage, but it gives a
 * rolling history of crewSchedules documents so that accidental overwrites
 * (for example, an empty schedule save) can be recovered by an admin.
 *
 * How it works:
 * - Runs once per night in us-central1.
 * - Reads all documents from the "crewSchedules" collection.
 * - Writes each document's data into
 *   "crewSchedules_backups/{dateKey}/snapshots/{ISO_TIMESTAMP}_{docId}".
 *
 * To restore a specific schedule document, copy one of the backups from
 * "crewSchedules_backups/{dateKey}/snapshots/{backupId}" back into
 * "crewSchedules/{dateKey}" via the Firebase console.
 */
export const backupCrewSchedulesNightly = functions
    .region('us-central1')
    .pubsub.schedule('0 3 * * *') // Every day at 03:00 UTC
    .timeZone('UTC')
    .onRun(async () => {
        const now = new Date();
        const iso = now.toISOString();

        console.log(`[backupCrewSchedulesNightly] Starting backup at ${iso}`);

        try {
            const schedulesSnap = await db.collection('crewSchedules').get();
            console.log(
                `[backupCrewSchedulesNightly] Found ${schedulesSnap.size} crewSchedules docs to back up.`
            );

            if (schedulesSnap.empty) {
                console.log(
                    '[backupCrewSchedulesNightly] No crewSchedules documents found, nothing to back up.'
                );
                return null;
            }

            const batch = db.batch();

            schedulesSnap.forEach((doc) => {
                const data = doc.data() || {};
                const dateKey = doc.id; // crewSchedules is typically keyed by date

                const backupCollection = db
                    .collection('crewSchedules_backups')
                    .doc(dateKey)
                    .collection('snapshots');

                const backupId = `${iso}_${doc.id}`;
                const backupRef = backupCollection.doc(backupId);

                batch.set(backupRef, {
                    originalDocPath: doc.ref.path,
                    dateKey,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    backupTakenAtIso: iso,
                    data,
                });
            });

            await batch.commit();

            console.log('[backupCrewSchedulesNightly] Backup completed successfully.');
            return null;
        } catch (error) {
            console.error('[backupCrewSchedulesNightly] Backup failed:', error);
            throw error;
        }
    });

// Crew Tracker SMS Functions

// Helper: normalize phone numbers to E.164 (assume US if missing country code)
const normalizeCrewPhoneNumber = (phone: string | undefined): string | undefined => {
    if (!phone) return phone;

    const trimmed = phone.trim();
    if (trimmed.startsWith('+')) {
        return trimmed;
    }

    const digitsOnly = trimmed.replace(/\D/g, '');

    if (digitsOnly.length === 10) {
        return `+1${digitsOnly}`;
    }

    return trimmed;
};

// Sends SMS messages to crew members with job assignment information
// Uses Twilio Messaging Service + status callback into crewMessageStatusCallback
export const sendCrewMessage = functions.runWith({
    secrets: ['TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_MESSAGING_SERVICE_SID'],
}).https.onCall(async (data, context) => {
    // Verify the caller is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send crew messages');
    }

    const {
        employeeIds,
        jobName,
        jobAddress,
        tasks,
        date,
        notes,
        language,
    } = data;

    // Validate required fields
    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Employee IDs array is required');
    }
    if (!jobName) {
        throw new functions.https.HttpsError('invalid-argument', 'Job name is required');
    }
    if (!jobAddress) {
        throw new functions.https.HttpsError('invalid-argument', 'Job address is required');
    }
    if (!date) {
        throw new functions.https.HttpsError('invalid-argument', 'Date is required');
    }

    try {
        // Get SMS provider credentials
        const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioApiKeySid = process.env.TWILIO_API_KEY_SID;
        const twilioApiKeySecret = process.env.TWILIO_API_KEY_SECRET;
        const twilioMessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

        // Check if SMS provider is configured
        if (!twilioAccountSid || !twilioApiKeySid || !twilioApiKeySecret || !twilioMessagingServiceSid) {
            console.error(
                'SMS provider not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, and TWILIO_MESSAGING_SERVICE_SID secrets.',
            );
            throw new functions.https.HttpsError(
                'failed-precondition',
                'SMS service not configured. Please configure Twilio credentials.',
            );
        }

        // Initialize Twilio client with API Key (more secure than Auth Token)
        const twilio = require('twilio')(twilioApiKeySid, twilioApiKeySecret, {
            accountSid: twilioAccountSid,
        });

        // Get employee data from Firestore
        console.log(`[SMS] Fetching employees: ${employeeIds.join(', ')}`);
        const employeesRef = admin.firestore().collection('crewEmployees');
        const employeesSnapshot = await Promise.all(employeeIds.map((id: string) => employeesRef.doc(id).get()));

        interface Employee {
            id: string;
            name?: string;
            phone?: string;
            language?: string;
            active?: boolean;
        }

        const employees: Employee[] = employeesSnapshot
            .map((doc: FirebaseFirestore.DocumentSnapshot) => ({ id: doc.id, ...(doc.data() as any) } as Employee))
            .filter((emp) => emp.phone); // Only employees with phone numbers

        console.log(
            `[SMS] Found ${employees.length} employees with phone numbers out of ${employeeIds.length} requested`,
        );

        if (employees.length === 0) {
            console.error('[SMS] No employees found with valid phone numbers');
            throw new functions.https.HttpsError('not-found', 'No employees found with valid phone numbers');
        }

        // Generate Google Maps link for address
        const mapsLink = `https://maps.google.com/?q=${encodeURIComponent(jobAddress)}`;

        // Format message based on language
        const formatMessage = (lang: string) => {
            const isSpanish = lang === 'es' || lang === 'spanish';

            if (isSpanish) {
                return (
                    `📋 Asignación de Trabajo\n\n` +
                    `📅 Fecha: ${date}\n` +
                    `🏗️ Trabajo: ${jobName}\n` +
                    `📍 Ubicación: ${jobAddress}\n` +
                    `${mapsLink}\n` +
                    `📝 Tareas: ${tasks || 'Ver detalles en el sitio'}\n` +
                    (notes ? `\n📌 Notas: ${notes}` : '')
                );
            } else {
                return (
                    `📋 Job Assignment\n\n` +
                    `📅 Date: ${date}\n` +
                    `🏗️ Job: ${jobName}\n` +
                    `📍 Location: ${jobAddress}\n` +
                    `${mapsLink}\n` +
                    `📝 Tasks: ${tasks || 'See details on site'}\n` +
                    (notes ? `\n📌 Notes: ${notes}` : '')
                );
            }
        };

        // Send messages to each employee
        const messageResults: any[] = [];
        const messageId = admin.firestore().collection('crewMessages').doc().id;

        for (const employee of employees) {
            try {
                const employeeLanguage = employee.language || language || 'en';
                const messageText = formatMessage(employeeLanguage);

                const normalizedPhone = normalizeCrewPhoneNumber(employee.phone);
                if (!normalizedPhone) {
                    throw new Error('Missing or invalid phone number');
                }

                console.log(
                    `[SMS] Attempting to send to ${normalizedPhone} (${employee.name || employee.id}), language: ${employeeLanguage}`,
                );

                // Get the status callback URL for delivery tracking
                const statusCallbackUrl =
                    'https://us-central1-tatco-crm.cloudfunctions.net/crewMessageStatusCallback';

                // Send SMS via Twilio using Messaging Service
                const message = await twilio.messages.create({
                    body: messageText,
                    messagingServiceSid: twilioMessagingServiceSid,
                    to: normalizedPhone,
                    statusCallback: statusCallbackUrl, // Track delivery status
                });

                console.log(`[SMS] ✅ Message accepted by Twilio:`, {
                    messageSid: message.sid,
                    to: normalizedPhone,
                    employeeName: employee.name,
                    status: message.status,
                    dateCreated: message.dateCreated,
                    dateSent: message.dateSent,
                    errorCode: message.errorCode,
                    errorMessage: message.errorMessage,
                });

                // Save individual message to Firestore for tracking
                const individualMessageData = {
                    messageSid: message.sid,
                    employeeId: employee.id,
                    employeeName: employee.name,
                    phone: normalizedPhone,
                    jobName,
                    jobAddress,
                    date,
                    sentAt: admin.firestore.FieldValue.serverTimestamp(),
                    status: message.status, // Initial status (usually 'queued' or 'accepted')
                    direction: 'outbound',
                };

                // Save to Firestore (will be updated by status callback)
                await admin
                    .firestore()
                    .collection('crewMessages')
                    .doc(message.sid)
                    .set(individualMessageData, { merge: true });

                messageResults.push({
                    employeeId: employee.id,
                    employeeName: employee.name,
                    phone: normalizedPhone,
                    success: true,
                    messageSid: message.sid,
                    status: message.status,
                });
            } catch (error: any) {
                const normalizedPhone = normalizeCrewPhoneNumber(employee.phone);
                console.error(
                    `[SMS] ❌ Failed to send SMS to ${normalizedPhone || employee.phone} (${
                        employee.name || employee.id
                    }):`,
                    {
                        error: error.message,
                        code: error.code,
                        status: error.status,
                        moreInfo: error.moreInfo,
                        stack: error.stack,
                    },
                );
                messageResults.push({
                    employeeId: employee.id,
                    employeeName: employee.name,
                    phone: normalizedPhone || employee.phone,
                    success: false,
                    error: error.message || 'Unknown error',
                    errorCode: error.code,
                });
            }
        }

        // Parse date string (MM/DD/YYYY format)
        let parsedDate: Date;
        try {
            // Handle MM/DD/YYYY format
            if (typeof date === 'string' && date.includes('/')) {
                const [month, day, year] = date.split('/').map(Number);
                parsedDate = new Date(year, month - 1, day);
            } else {
                parsedDate = new Date(date);
            }
            if (isNaN(parsedDate.getTime())) {
                throw new Error('Invalid date format');
            }
        } catch (dateError) {
            console.error('Failed to parse date:', date, dateError);
            parsedDate = new Date(); // Fallback to current date
        }

        // Save batch message record to Firestore (summary of all messages sent)
        const messageData = {
            date: admin.firestore.Timestamp.fromDate(parsedDate),
            jobName,
            jobAddress,
            tasks: tasks || '',
            notes: notes || '',
            recipients: employeeIds,
            sentBy: context.auth.uid,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            status: messageResults.every((r) => r.success) ? 'sent' : 'partial',
            results: messageResults,
            batchId: messageId, // Identifier for this batch
            type: 'batch', // Distinguish from individual messages
        };

        await admin
            .firestore()
            .collection('crewMessages')
            .doc(messageId)
            .set(messageData);

        const successCount = messageResults.filter((r) => r.success).length;
        const failureCount = messageResults.filter((r) => !r.success).length;

        return {
            success: failureCount === 0,
            messageId,
            sent: successCount,
            failed: failureCount,
            results: messageResults,
            message:
                failureCount === 0
                    ? `All ${successCount} message(s) sent successfully`
                    : `${successCount} message(s) sent, ${failureCount} failed`,
        };
    } catch (error: any) {
        console.error('Error sending crew messages:', error);
        throw new functions.https.HttpsError('internal', 'Failed to send crew messages', error.message);
    }
});

// Receive incoming SMS messages from Twilio
export const receiveCrewMessage = functions
    .runWith({
        secrets: ['TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET'],
    })
    .https.onRequest(async (req, res) => {
        // Twilio requires a response within 10 seconds
        res.set('Content-Type', 'text/xml');

        // Only accept POST requests
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }

        try {
            const { MessageSid, From, To, Body, AccountSid, NumMedia } = req.body;

            // Verify the request is from Twilio (optional but recommended)
            const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
            if (AccountSid !== twilioAccountSid) {
                console.warn('Received SMS from unknown Twilio account:', AccountSid);
                // Still process it, but log the warning
            }

            console.log(`[SMS Received] From: ${From}, To: ${To}, MessageSid: ${MessageSid}`);

            // Find employee by phone number
            const employeesRef = admin.firestore().collection('crewEmployees');
            const employeesSnapshot = await employeesRef.where('phone', '==', From).limit(1).get();

            let employeeId: string | null = null;
            let employeeName = 'Unknown';

            if (!employeesSnapshot.empty) {
                const employeeDoc = employeesSnapshot.docs[0];
                employeeId = employeeDoc.id;
                const employeeData = employeeDoc.data() as any;
                employeeName = employeeData.name || 'Unknown';
            }

            // Save incoming message to Firestore
            const incomingMessageData = {
                messageSid: MessageSid,
                from: From,
                to: To,
                body: Body,
                employeeId: employeeId,
                employeeName: employeeName,
                receivedAt: admin.firestore.FieldValue.serverTimestamp(),
                processed: false, // Can be used to track if message was processed/responded to
                numMedia: NumMedia || '0',
                direction: 'inbound',
            };

            await admin
                .firestore()
                .collection('crewMessages')
                .doc(MessageSid)
                .set(incomingMessageData, { merge: true });

            // Also save to a subcollection for easier querying by employee
            if (employeeId) {
                await admin
                    .firestore()
                    .collection('crewEmployees')
                    .doc(employeeId)
                    .collection('messages')
                    .doc(MessageSid)
                    .set(
                        {
                            ...incomingMessageData,
                            direction: 'inbound',
                        },
                        { merge: true },
                    );
            }

            // Respond to Twilio with TwiML (optional - can send auto-reply)
            // For now, just acknowledge receipt
            const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <!-- Message received and saved -->
</Response>`;

            res.status(200).send(twiml);
        } catch (error: any) {
            console.error('Error processing incoming SMS:', error);

            // Still respond to Twilio to avoid retries
            const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <!-- Error processing message -->
</Response>`;

            res.status(200).send(twiml);
        }
    });

// Handle delivery status callbacks from Twilio
export const crewMessageStatusCallback = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;

        console.log(`[SMS Status] MessageSid: ${MessageSid}, Status: ${MessageStatus}`, {
            errorCode: ErrorCode,
            errorMessage: ErrorMessage,
        });

        // Update individual message status in Firestore
        // Use set with merge to handle both individual messages and batch records
        // This will create the document if it doesn't exist, or update it if it does
        try {
            await admin
                .firestore()
                .collection('crewMessages')
                .doc(MessageSid)
                .set(
                    {
                        status: MessageStatus,
                        errorCode: ErrorCode || null,
                        errorMessage: ErrorMessage || null,
                        statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    },
                    { merge: true },
                );
        } catch (firestoreError: any) {
            // Log error but don't fail the callback (Twilio expects 200 OK)
            console.error(`[SMS Status] Error updating Firestore for ${MessageSid}:`, firestoreError);
        }

        res.status(200).send('OK');
    } catch (error: any) {
        console.error('Error processing status callback:', error);
        res.status(200).send('OK'); // Always respond OK to Twilio
    }
});

// Send a direct SMS reply to a single crew member from the chat UI
export const sendCrewDirectMessage = functions
    .runWith({
        secrets: ['TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_MESSAGING_SERVICE_SID'],
    })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send crew messages');
        }

        const { employeeId, body } = data as { employeeId?: string; body?: string };

        if (!employeeId) {
            throw new functions.https.HttpsError('invalid-argument', 'employeeId is required');
        }
        if (!body || typeof body !== 'string' || !body.trim()) {
            throw new functions.https.HttpsError('invalid-argument', 'Message body is required');
        }

        try {
            const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
            const twilioApiKeySid = process.env.TWILIO_API_KEY_SID;
            const twilioApiKeySecret = process.env.TWILIO_API_KEY_SECRET;
            const twilioMessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

            if (!twilioAccountSid || !twilioApiKeySid || !twilioApiKeySecret || !twilioMessagingServiceSid) {
                console.error('SMS provider not configured for sendCrewDirectMessage.');
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'SMS service not configured. Please configure Twilio credentials.',
                );
            }

            // Initialize Twilio client
            const twilio = require('twilio')(twilioApiKeySid, twilioApiKeySecret, {
                accountSid: twilioAccountSid,
            });

            // Load employee
            const employeeRef = admin.firestore().collection('crewEmployees').doc(employeeId);
            const employeeSnap = await employeeRef.get();
            if (!employeeSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Employee not found');
            }
            const employeeData = (employeeSnap.data() || {}) as any;
            const normalizedPhone = normalizeCrewPhoneNumber(employeeData.phone);
            if (!normalizedPhone) {
                throw new functions.https.HttpsError('failed-precondition', 'Employee has no valid phone number');
            }

            console.log(`[SMS Direct] Sending to ${normalizedPhone} (${employeeData.name || employeeId})`);

            const statusCallbackUrl =
                'https://us-central1-tatco-crm.cloudfunctions.net/crewMessageStatusCallback';

            const message = await twilio.messages.create({
                body: body.trim(),
                messagingServiceSid: twilioMessagingServiceSid,
                to: normalizedPhone,
                statusCallback: statusCallbackUrl,
            });

            const now = admin.firestore.FieldValue.serverTimestamp();

            const directMessageData = {
                messageSid: message.sid,
                employeeId,
                employeeName: employeeData.name || 'Unknown',
                phone: normalizedPhone,
                body: body.trim(),
                direction: 'outbound',
                sentAt: now,
                status: message.status,
                type: 'direct',
                sentBy: context.auth.uid,
            };

            await admin
                .firestore()
                .collection('crewMessages')
                .doc(message.sid)
                .set(directMessageData, { merge: true });

            console.log('[SMS Direct] Message accepted by Twilio:', {
                messageSid: message.sid,
                to: normalizedPhone,
                status: message.status,
            });

            return {
                success: true,
                messageSid: message.sid,
                status: message.status,
            };
        } catch (error: any) {
            console.error('Error sending direct crew message:', error);
            throw new functions.https.HttpsError(
                'internal',
                'Failed to send direct crew message',
                error?.message || String(error),
            );
        }
    });

