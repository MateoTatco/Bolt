import Container from '@/components/shared/Container'
import { APP_NAME } from '@/constants/app.constant'

const PrivacyPolicy = () => {
    return (
        <Container className="py-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
                <div className="prose prose-lg max-w-none dark:prose-invert">
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                        <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
                        <p className="mb-4">
                            Welcome to {APP_NAME}. We respect your privacy and are committed to protecting your personal information. 
                            This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use 
                            our application and services.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
                        <p className="mb-4">We collect information that you provide directly to us, including:</p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Personal identification information (name, email address, phone number)</li>
                            <li>Business information (company name, job details, project information)</li>
                            <li>Account credentials and authentication information</li>
                            <li>Communication data (messages, notes, updates)</li>
                            <li>Files and documents you upload to our system</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
                        <p className="mb-4">We use the information we collect to:</p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Provide, maintain, and improve our services</li>
                            <li>Process transactions and manage your account</li>
                            <li>Send you job assignments, notifications, and updates via SMS</li>
                            <li>Communicate with you about your account and our services</li>
                            <li>Detect, prevent, and address technical issues and security threats</li>
                            <li>Comply with legal obligations</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">4. SMS Communications</h2>
                        <p className="mb-4">
                            By providing your phone number, you consent to receive SMS messages from us, including:
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Job assignment notifications</li>
                            <li>Work schedule updates</li>
                            <li>Job-related communications</li>
                        </ul>
                        <p className="mb-4">
                            Message and data rates may apply. You can opt out at any time by replying STOP to any message 
                            or by contacting your supervisor to remove your phone number from your profile.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">5. Information Sharing and Disclosure</h2>
                        <p className="mb-4">
                            We do not sell, trade, or rent your personal information to third parties. We may share your 
                            information only in the following circumstances:
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>With your explicit consent</li>
                            <li>To comply with legal obligations or respond to lawful requests</li>
                            <li>To protect our rights, privacy, safety, or property</li>
                            <li>With service providers who assist us in operating our services (under strict confidentiality agreements)</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">6. Data Security</h2>
                        <p className="mb-4">
                            We implement appropriate technical and organizational security measures to protect your personal 
                            information against unauthorized access, alteration, disclosure, or destruction. However, no method 
                            of transmission over the Internet or electronic storage is 100% secure.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">7. Your Rights</h2>
                        <p className="mb-4">You have the right to:</p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Access and review your personal information</li>
                            <li>Request correction of inaccurate information</li>
                            <li>Request deletion of your personal information</li>
                            <li>Opt out of SMS communications at any time</li>
                            <li>Request a copy of your data</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">8. Data Retention</h2>
                        <p className="mb-4">
                            We retain your personal information for as long as necessary to provide our services and comply 
                            with legal obligations. When you request deletion, we will remove your information in accordance 
                            with applicable laws.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">9. Changes to This Privacy Policy</h2>
                        <p className="mb-4">
                            We may update this Privacy Policy from time to time. We will notify you of any changes by posting 
                            the new Privacy Policy on this page and updating the "Last Updated" date.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">10. Contact Us</h2>
                        <p className="mb-4">
                            If you have any questions about this Privacy Policy, please contact us through your account 
                            administrator or your supervisor.
                        </p>
                    </section>
                </div>
            </div>
        </Container>
    )
}

export default PrivacyPolicy

