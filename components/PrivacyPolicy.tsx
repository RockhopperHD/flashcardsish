import React from 'react';
import { X, Shield } from 'lucide-react';

interface PrivacyPolicyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
            <div className="bg-panel border border-outline rounded-2xl p-0 w-full max-w-3xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-outline flex justify-between items-center bg-panel-2 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <Shield size={24} className="text-accent" />
                        <div>
                            <h2 className="text-xl font-bold text-text">Privacy Policy</h2>
                            <div className="text-sm text-muted">Last updated: December 28, 2025</div>
                        </div>
                    </div>
                    <button onClick={onClose}><X size={20} className="text-muted hover:text-text" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6 text-text">

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">1. Introduction</h3>
                        <p className="text-muted leading-relaxed">
                            Welcome to Flashcardsish! This Privacy Policy explains how the program Flashcardsish ("we") collects, uses, discloses, and safeguards
                            your information when you use this app. Please read this policy carefully. If you
                            do not agree with the terms of this privacy policy, please do not use the application, and please don't sign in.
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
                                    You don't have to sign in with Google for Flashcardsish to function. When you sign in using Google, we receive and store:
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
                                <h4 className="font-bold text-text mb-2">2.2 User-Generated Content</h4>
                                <p className="text-muted leading-relaxed">
                                    We store data you create within the application, including:
                                </p>
                                <ul className="list-disc pl-5 mt-2 space-y-1 text-muted">
                                    <li>Flashcard sets (terms, definitions, images)</li>
                                    <li>Folders and organizational data</li>
                                    <li>Study progress and mastery levels</li>
                                    <li>Application settings and preferences</li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-bold text-text mb-2">2.3 Local Storage</h4>
                                <p className="text-muted leading-relaxed">
                                    We use browser local storage and IndexedDB to store your data locally on your device
                                    for offline access and improved performance. This data remains on your device unless
                                    you are signed in, in which case it syncs with our cloud storage. In simple terms: if you don't sign in, we store your data on your device; otherwise, we use what we have stored.
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
                            <li>Authenticate your identity and manage your account (making sure only you can access your data if you keep your account safe and treat it as intended)</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">4. Third-Party Services</h3>
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-bold text-text mb-2">4.1 Supabase</h4>
                                <p className="text-muted leading-relaxed">
                                    We use Supabase for authentication and data storage. Supabase processes and stores your
                                    data on secure servers. You can review Supabase's privacy policy at{' '}
                                    <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                                        supabase.com/privacy
                                    </a>.
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
                        <h3 className="text-lg font-bold text-accent mb-3">11. Development Status and Data Deletion</h3>
                        <div className="p-4 bg-yellow/10 rounded-xl border border-yellow/30 mb-3">
                            <p className="text-muted leading-relaxed">
                                <strong className="text-yellow">⚠️ Important:</strong> Flashcardsish is an actively developed, personal project
                                with no uptime guarantees or service level agreements.
                            </p>
                        </div>
                        <div className="space-y-3 text-muted leading-relaxed">
                            <p>
                                Your data may be deleted under the following circumstances:
                            </p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Service shutdown or discontinuation</li>
                                <li>Database migrations, restructuring, or technical necessity</li>
                                <li>Hosting provider changes or limitations</li>
                                <li>Development-related database resets</li>
                                <li>Security incidents requiring data purge</li>
                                <li>Extended account inactivity (12+ months)</li>
                            </ul>
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
