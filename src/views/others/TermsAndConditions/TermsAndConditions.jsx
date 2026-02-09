import Container from '@/components/shared/Container'
import { APP_NAME } from '@/constants/app.constant'

const TermsAndConditions = () => {
    return (
        <Container className="py-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">Terms and Conditions</h1>
                <div className="prose prose-lg max-w-none dark:prose-invert">
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                        <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
                        <p className="mb-4">
                            By accessing and using {APP_NAME}, you accept and agree to be bound by the terms and provision 
                            of this agreement. If you do not agree to abide by the above, please do not use this service.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">2. Use License</h2>
                        <p className="mb-4">
                            Permission is granted to temporarily use {APP_NAME} for business purposes. This is the grant 
                            of a license, not a transfer of title, and under this license you may not:
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Modify or copy the materials</li>
                            <li>Use the materials for any commercial purpose or for any public display</li>
                            <li>Attempt to reverse engineer any software contained in the application</li>
                            <li>Remove any copyright or other proprietary notations from the materials</li>
                            <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">3. User Account</h2>
                        <p className="mb-4">
                            You are responsible for maintaining the confidentiality of your account credentials and for all 
                            activities that occur under your account. You agree to:
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Provide accurate, current, and complete information when creating an account</li>
                            <li>Maintain and promptly update your account information</li>
                            <li>Maintain the security of your password and identification</li>
                            <li>Notify us immediately of any unauthorized use of your account</li>
                            <li>Accept responsibility for all activities that occur under your account</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">4. SMS Communications</h2>
                        <p className="mb-4">
                            By providing your phone number, you consent to receive SMS messages from {APP_NAME} regarding:
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Job assignments and work schedules</li>
                            <li>Job-related notifications and updates</li>
                            <li>Important communications from your employer</li>
                        </ul>
                        <p className="mb-4">
                            <strong>Message and data rates may apply.</strong> You can opt out at any time by replying STOP 
                            to any message or by contacting your supervisor to remove your phone number from your profile. 
                            After opting out, you may not receive important job-related communications.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">5. User Content</h2>
                        <p className="mb-4">
                            You retain ownership of any content you submit, post, or display on or through {APP_NAME}. 
                            By submitting content, you grant us a worldwide, non-exclusive, royalty-free license to use, 
                            reproduce, modify, and distribute such content solely for the purpose of providing and improving 
                            our services.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">6. Prohibited Uses</h2>
                        <p className="mb-4">You may not use {APP_NAME} to:</p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Violate any applicable laws or regulations</li>
                            <li>Infringe upon the rights of others</li>
                            <li>Transmit any harmful, offensive, or inappropriate content</li>
                            <li>Interfere with or disrupt the service or servers</li>
                            <li>Attempt to gain unauthorized access to any portion of the service</li>
                            <li>Use automated systems to access the service without permission</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">7. Intellectual Property</h2>
                        <p className="mb-4">
                            The service and its original content, features, and functionality are owned by {APP_NAME} and 
                            are protected by international copyright, trademark, patent, trade secret, and other intellectual 
                            property laws.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">8. Disclaimer</h2>
                        <p className="mb-4">
                            The information on {APP_NAME} is provided on an "as is" basis. To the fullest extent permitted by 
                            law, we exclude all representations, warranties, and conditions relating to our service and the 
                            use of this service.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">9. Limitation of Liability</h2>
                        <p className="mb-4">
                            In no event shall {APP_NAME}, nor its directors, employees, or agents, be liable for any indirect, 
                            incidental, special, consequential, or punitive damages, including without limitation, loss of profits, 
                            data, use, goodwill, or other intangible losses, resulting from your use of the service.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">10. Termination</h2>
                        <p className="mb-4">
                            We may terminate or suspend your account and access to the service immediately, without prior notice 
                            or liability, for any reason, including if you breach the Terms. Upon termination, your right to use 
                            the service will cease immediately.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">11. Changes to Terms</h2>
                        <p className="mb-4">
                            We reserve the right to modify or replace these Terms at any time. If a revision is material, we will 
                            provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change 
                            will be determined at our sole discretion.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">12. Contact Information</h2>
                        <p className="mb-4">
                            If you have any questions about these Terms and Conditions, please contact us through your account 
                            administrator or your supervisor.
                        </p>
                    </section>
                </div>
            </div>
        </Container>
    )
}

export default TermsAndConditions

