import React from 'react';
import { X, Shield } from 'lucide-react';

interface PrivacyPolicyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onMouseDown={onClose}>
            <div className="bg-panel border border-outline rounded-2xl p-0 w-full max-w-3xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[85vh]" onMouseDown={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-outline flex justify-between items-center bg-panel-2 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <Shield size={24} className="text-accent" />
                        <div>
                            <h2 className="text-xl font-bold text-text">Privacy Policy</h2>
                            <div className="text-sm text-muted">Last updated: February 4, 2026</div>
                        </div>
                    </div>
                    <button onClick={onClose}><X size={20} className="text-muted hover:text-text" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6 text-text">
                    <div className="mb-6 p-4 bg-accent/10 border border-accent/20 rounded-xl">
                        <p className="text-accent font-medium text-sm">
                            CONSENT AND AGREEMENT: By accessing or using the Service, you signify your irrevocable acceptance of this Privacy Policy. You acknowledge that your data may be processed in accordance with this policy as well as our Terms of Service. If you do not agree to these terms, you must immediately cease all use of the Service.
                        </p>
                    </div>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">1. Introduction</h3>
                        <p className="text-muted leading-relaxed">
                            This Privacy Policy governs the collection, processing, and retention of data by Flashcardsish ("the Service").
                            Your interaction with the Service constitutes a binding agreement to the practices described herein.
                            If you do not consent to these data practices, you must decline the Google OAuth request and refrain
                            from using the Service.
                        </p>
                        <p className="text-muted leading-relaxed mt-3">
                            Flashcardsish is maintained and developed by one person (regardless, Flashcardsish as an entity is referred to as "we" in this page). This Privacy Policy applies to the app Flashcardsish hosted at{' '}
                            <a href="https://flashcardsish.owenwhelan.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                                flashcardsish.owenwhelan.com
                            </a>; Flashcardsish itself, however, is open source via GitHub and anyone can download and make a copy of it.
                        </p>
                        <p className="text-muted leading-relaxed mt-3">
                            This Privacy Policy is subject to change. We reserve the right to update this Privacy Policy at any time, and we will notify you of any changes by posting the new Privacy Policy on this page.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">2. Information We Collect</h3>
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-bold text-text mb-2">2.1 Information from Google OAuth</h4>
                                <p className="text-muted leading-relaxed">
                                    You don't have to sign in with Google for Flashcardsish to function, though signing in is required for features like image uploading. When you sign in using Google, we receive and store:
                                </p>
                                <ul className="list-disc pl-5 mt-2 space-y-1 text-muted">
                                    <li>Your email address</li>
                                    <li>Your name (as provided by Google/listed on your Google account)</li>
                                    <li>Your profile picture URL</li>
                                    <li>A unique user identifier</li>
                                </ul>
                                <p className="text-muted leading-relaxed mt-2">
                                    We use this information to authenticate you and manage your account. We do not use this information for any other purpose.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-bold text-text mb-2">2.2 User-Generated Content & Usage Stats</h4>
                                <p className="text-muted leading-relaxed">
                                    We store data you create and generate within the application, including:
                                </p>
                                <ul className="list-disc pl-5 mt-2 space-y-1 text-muted">
                                    <li>Flashcard sets (terms, definitions, images)</li>
                                    <li>Folders and organizational data</li>
                                    <li>Study progress, mastery levels, and lifetime correct answer counts</li>
                                    <li>Usage statistics (e.g., number of cards saved, sets created, study time)</li>
                                    <li>Application settings and preferences</li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-bold text-text mb-2">2.3 Local Storage</h4>
                                <p className="text-muted leading-relaxed">
                                    We use browser local storage and IndexedDB to store your data locally on your device
                                    for offline access and improved performance. This data remains on your device unless
                                    you are signed in, in which case it syncs with your Google Drive. In simple terms: if you don't sign in, we store your data on your device; otherwise, we use what we have stored online.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">3. How We Use Your Information</h3>
                        <p className="text-muted leading-relaxed mb-2">
                            We use the information we collect to:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 text-muted">
                            <li>Enable cloud synchronization of your flashcard data across devices (saving your sets online)</li>
                            <li>Host your uploaded images securely</li>
                            <li>Authenticate your identity and manage your account (making sure only you can access your data if you keep your account safe and treat it as intended)</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">4. Third-Party Services</h3>
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-bold text-text mb-2">4.1 Google Drive Storage</h4>
                                <p className="text-muted leading-relaxed">
                                    We currently utilize your personal Google Drive for data storage. Flashcardsish creates
                                    a scoped directory within your Drive to store flashcard resources.
                                    <strong className="text-text"> RESERVATION OF ARCHITECTURAL RIGHTS:</strong> We reserve the right
                                    to migrate user data to proprietary servers, centralized databases, or alternative
                                    cloud providers at any time to improve Service functionality. By using the Service,
                                    you consent to such future data migrations.
                                    Your data remains subject to Google's own{' '}
                                    <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                                        Privacy Policy
                                    </a> while residing on their infrastructure.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-bold text-text mb-2">4.2 Google OAuth</h4>
                                <p className="text-muted leading-relaxed">
                                    We use Google's OAuth service for authentication. Google's privacy policy applies to any
                                    data processed by Google during the authentication process. You can review it at{' '}
                                    <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                                        policies.google.com/privacy
                                    </a>.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">5. Data Security</h3>
                        <p className="text-muted leading-relaxed">
                            We implement appropriate technical and organizational security measures to protect your personal
                            information. However, no method of transmission over the Internet or electronic storage is 100%
                            secure. While we strive to protect your personal information, we cannot guarantee its absolute security.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">6. Data Retention</h3>
                        <p className="text-muted leading-relaxed">
                            We retain your personal information for as long as your account is active or as needed to provide
                            you services. You may delete your account and associated data at any time using the "Delete All My Data"
                            button in Settings (top right corner on the home screen).
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">7. Your Rights</h3>
                        <p className="text-muted leading-relaxed mb-2">
                            Depending on your location, you may have the following rights:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 text-muted">
                            <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
                            <li><strong>Rectification:</strong> Request correction of inaccurate personal data</li>
                            <li><strong>Deletion:</strong> Request deletion of your personal data</li>
                            <li><strong>Data Portability:</strong> Request your data in a machine-readable format</li>
                            <li><strong>Withdraw Consent:</strong> Withdraw consent where processing is based on consent</li>
                        </ul>
                        <p className="text-muted leading-relaxed mt-2">
                            To exercise these rights, go to Settings where you can:
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-1 text-muted">
                            <li><strong>Export your data:</strong> Use "Export All My Data" to download a JSON file containing all your flashcard sets, folders, and settings</li>
                            <li><strong>Delete your data:</strong> Use "Delete All My Data" to permanently remove all data from your device and our cloud servers</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">8. Children's Privacy</h3>
                        <div className="space-y-3 text-muted leading-relaxed">
                            <p>
                                <strong className="text-text">8.1</strong> Flashcardsish is not intended for children under 13 years
                                of age. We do not knowingly collect personal information from children under 13.
                            </p>
                            <p>
                                <strong className="text-text">8.2</strong> If we discover that we have inadvertently collected
                                personal information from a child under 13, we will promptly delete such information from our systems.
                            </p>
                            <p>
                                <strong className="text-text">8.3</strong> If you are a parent or guardian and believe your child
                                has provided personal information to us, please contact us at{' '}
                                <a href="mailto:owenw2023@gmail.com" className="text-accent hover:underline">owenw2023@gmail.com</a>{' '}
                                and we will take steps to delete the information.
                            </p>
                            <p>
                                <strong className="text-text">8.4</strong> We comply with applicable children's privacy laws,
                                including the Children's Online Privacy Protection Act (COPPA) where applicable.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">9. Open Source</h3>
                        <p className="text-muted leading-relaxed">
                            Flashcardsish is open-source software. You can review our source code to understand exactly how
                            we handle your data. The code is available on our public repository.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">10. Changes to This Policy</h3>
                        <p className="text-muted leading-relaxed">
                            We may update this Privacy Policy from time to time. We will notify you of any changes by updating
                            the "Last updated" date at the top of this policy. You are advised to review this Privacy Policy
                            periodically for any changes.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">11. Experimental Status and Liability</h3>
                        <div className="p-4 bg-yellow/10 rounded-xl border border-yellow/30 mb-3">
                            <p className="text-muted leading-relaxed">
                                <strong className="text-yellow">⚠️ NO WARRANTY OF CONTINUITY:</strong> Flashcardsish is an
                                experimental development project. We provide no guarantees regarding software stability,
                                data persistence, or uptime.
                            </p>
                        </div>
                        <div className="space-y-3 text-muted leading-relaxed">
                            <p>
                                Your data may be deleted under the following circumstances:
                            </p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Infrastructure migrations or technological obsolescence</li>
                                <li>Service suspension or decommissioning</li>
                                <li>Failure of upstream third-party dependencies</li>
                                <li>Security remediation or data integrity enforcement</li>
                                <li>As determined by our absolute discretion to ensure Service sustainability</li>
                            </ul>
                            <p>
                                <strong className="text-text">LIMITATION OF LIABILITY:</strong> Under no circumstances shall
                                Flashcardsish or its developers be liable for the loss of user-generated content, metadata,
                                or study statistics. Users are solely responsible for data redundancy via the "Export" feature.
                            </p>
                            <p>
                                We will make reasonable efforts to notify users before planned deletions when feasible,
                                but this cannot be guaranteed. <strong className="text-text">You are strongly encouraged to regularly
                                    export your data</strong> using the "Export All My Data" feature in Settings or download .flashcards files
                                from the List Builder screen.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">12. Contact Us</h3>
                        <p className="text-muted leading-relaxed">
                            If you have any questions about this Privacy Policy or our data practices, you can reach us at:
                        </p>
                        <p className="mt-2">
                            <a href="mailto:owenw2023@gmail.com" className="text-accent hover:underline font-bold">
                                owenw2023@gmail.com
                            </a>
                        </p>
                        <p className="text-muted leading-relaxed mt-2">
                            You can also open an issue on our GitHub repository.
                        </p>
                    </section>

                </div>
            </div>
        </div>
    );
};
