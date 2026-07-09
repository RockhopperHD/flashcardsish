import React from 'react';
import { X } from 'lucide-react';

interface PrivacyPolicyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
    React.useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onMouseDown={onClose}>
            <div className="bg-panel border border-outline rounded-2xl p-0 w-full max-w-3xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[85vh]" onMouseDown={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-outline bg-panel-2 rounded-t-2xl">
                    <div className="flex items-center justify-between gap-4">
                        <h2
                            className="text-3xl text-text"
                            style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
                        >
                            Privacy Policy
                        </h2>
                        <button onClick={onClose} className="text-muted hover:text-text p-2 rounded-lg hover:bg-panel-2 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6 text-text">
                    <p className="text-sm text-muted">Last updated: March 15, 2026</p>
                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">1. Overview</h3>
                        <p>Flashcardsish ("the Service") is an experimental, open-source flashcard application created and maintained by an individual developer as a personal project. This Privacy Policy explains how data is handled when you use the Service.</p>
                        <p className="mt-2">By using the Service, you acknowledge and agree to the data practices described in this Privacy Policy. If you do not agree, do not use the Service or authenticate with Google.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">2. Who We Are</h3>
                        <p>Flashcardsish is developed and operated by an individual, not a company or legal entity. References to "we," "us," or "our" in this document refer solely to the individual developer.</p>
                        <p className="mt-2">The Service is hosted at: <strong>flashcardsish.owenwhelan.com</strong></p>
                        <p>The source code is publicly available and open source.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">3. Data We Collect</h3>

                        <div className="mb-4">
                            <h4 className="font-bold mb-1">3.1 Google Authentication Data</h4>
                            <p>If you choose to sign in with Google, Google provides the following information to the Service:</p>
                            <ul className="list-disc pl-5 my-2 space-y-1">
                                <li>Email address</li>
                                <li>Display name</li>
                                <li>Profile image URL</li>
                                <li>A unique Google account identifier ("sub")</li>
                            </ul>
                            <p>This information is used only to authenticate you and associate your local or Google Drive data with your session. <strong>We do not store this information on our own servers.</strong> Session-related data may be stored temporarily in your browser's memory or local storage while you are signed in, and remembered Google sessions may expire after 30 days of inactivity.</p>
                        </div>

                        <div className="mb-4">
                            <h4 className="font-bold mb-1">3.2 User-Generated Content</h4>
                            <p>The Service stores content you create, including:</p>
                            <ul className="list-disc pl-5 my-2 space-y-1">
                                <li>Flashcard sets, terms, definitions, and images</li>
                                <li>Folder and organizational data</li>
                                <li>Study progress and statistics</li>
                                <li>Application settings and preferences</li>
                            </ul>
                            <p className="mt-2"><strong>Important:</strong> This data is stored either:</p>
                            <ul className="list-decimal pl-5 my-1 space-y-1">
                                <li>Locally in your browser (localStorage / IndexedDB), or</li>
                                <li>In your personal Google Drive, inside a Flashcardsish-specific folder</li>
                            </ul>
                            <p className="mt-2">Flashcardsish does not operate its own backend database and does not store your flashcard content on developer-owned servers.</p>
                        </div>

                        <div className="mb-4">
                            <h4 className="font-bold mb-1">3.3 Shared Set Snapshots</h4>
                            <p>When you choose to share a card set using the share feature, a snapshot of that set is uploaded to Google Firebase Firestore, a third-party cloud database operated by Google. This snapshot includes:</p>
                            <ul className="list-disc pl-5 my-2 space-y-1">
                                <li>The set name</li>
                                <li>Card terms, definitions, and custom fields</li>
                                <li>Card images (excluding base64 data URIs, which are stripped)</li>
                            </ul>
                            <p className="mt-2">Shared snapshots do <strong>not</strong> include study progress, mastery data, stars, tags, or your identity. Sharing is entirely optional and always initiated by you.</p>
                            <p className="mt-2">Shared snapshots are accessible to anyone with the link and are <strong>automatically deleted after 7 days.</strong> You cannot delete a shared snapshot early. Do not share sets containing sensitive information.</p>
                        </div>

                        <div className="mb-4">
                            <h4 className="font-bold mb-1">3.4 Google Drive Access</h4>
                            <p>When enabled, the Service accesses Google Drive using the specific scope: <strong>drive.file</strong>.</p>
                            <p>This means the Service can <strong>only</strong> access files that it has created itself. It cannot see, read, or modify any other files in your Google Drive (such as your personal photos, documents, or files created by other apps).</p>
                        </div>

                        <div className="mb-4">
                            <h4 className="font-bold mb-1">3.5 Public Browser Configuration</h4>
                            <p>Flashcardsish uses Google and Firebase browser configuration for sign-in, Drive sync, image access, and shared-set snapshots. Browser client IDs and browser API keys are public identifiers, not secret server credentials.</p>
                            <ul className="list-disc pl-5 my-2 space-y-1">
                                <li>Google OAuth access still requires user consent</li>
                                <li>Google Drive access uses the limited drive.file scope</li>
                                <li>Firebase shared snapshots are temporary and link-accessible</li>
                                <li>Self-hosted copies should restrict browser API keys by origin and API</li>
                            </ul>
                            <p>Project security depends on Google Cloud restrictions and Firebase security rules, not on hiding browser configuration values.</p>
                        </div>

                        <div>
                            <h4 className="font-bold mb-1">3.6 Local Storage</h4>
                            <p>The Service uses browser local storage and IndexedDB to support offline access and performance. This data remains on your device unless you enable Google Drive synchronization.</p>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">4. How We Use Data</h3>
                        <p>Data is used only to:</p>
                        <ul className="list-disc pl-5 my-2 space-y-1">
                            <li>Provide flashcard functionality</li>
                            <li>Synchronize your data across devices</li>
                            <li>Display your content within the app</li>
                            <li>Authenticate your session</li>
                        </ul>
                        <p>We do not sell data, run ads, or perform analytics tracking.</p>
                        <p className="mt-2">We do not track users across third-party websites and therefore do not respond to Do Not Track (DNT) signals.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">5. Legal Basis for Processing (EEA / UK Users)</h3>
                        <p>For users in the EU or UK, data processing is based on:</p>
                        <ul className="list-disc pl-5 my-2 space-y-1">
                            <li><strong>Consent</strong>, when you choose to sign in with Google or enable synchronization</li>
                            <li><strong>Legitimate interest</strong>, to operate a personal educational tool you voluntarily use</li>
                        </ul>
                        <p>You may withdraw consent at any time by stopping use of the Service and deleting your data.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">6. Data Deletion</h3>
                        <p>You may delete your data at any time using the "Delete All My Data" option in Settings. This action:</p>
                        <ul className="list-disc pl-5 my-2 space-y-1">
                            <li>Deletes Flashcardsish files stored in your Google Drive folder</li>
                            <li>Deletes local browser data related to the Service</li>
                            <li>Removes the Flashcardsish folder if it becomes empty</li>
                        </ul>
                        <p>You may also manually delete the Flashcardsish folder from Google Drive at any time.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">7. Data Retention</h3>
                        <p>We retain no copies of your content outside your device or your Google Drive, except for shared set snapshots (see §3.3), which are stored on Google Firebase and automatically deleted after 7 days. If you stop using the Service, your data remains wherever you stored it until you delete it.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">8. Security</h3>
                        <p>Reasonable technical measures are used to reduce risk, but no software system is completely secure. You acknowledge that you use the Service at your own risk.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">9. Third-Party Services</h3>
                        <p>The Service relies on the following third-party services:</p>
                        <ul className="list-disc pl-5 my-2 space-y-1">
                            <li><strong>Google OAuth & Google Drive</strong> — for authentication and optional cloud sync</li>
                            <li><strong>Google Firebase Firestore</strong> — for temporary storage of shared set snapshots</li>
                        </ul>
                        <p>Your use of these services is governed by Google's own policies. Flashcardsish is not responsible for outages, data breaches, account issues, or changes to Google or Firebase APIs or terms.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">10. Children's Privacy</h3>
                        <p>The Service is intended for users 16 years and older.</p>
                        <p className="mt-2">We do not knowingly collect personal information from children under 16. If such data is discovered, it will be deleted.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">11. Experimental & Open-Source Notice</h3>
                        <p>Flashcardsish is an experimental, open-source project provided for personal and educational use. Features may change or stop working at any time. <strong>You are strongly encouraged to export your data regularly.</strong></p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">12. Changes to This Policy</h3>
                        <p>This Privacy Policy may be updated from time to time. Updates will be posted on this page with a revised "Last updated" date.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">13. Contact</h3>
                        <p>Questions or requests may be sent to: <strong>owenw2023@gmail.com</strong></p>
                    </section>
                </div>
            </div>
        </div>
    );
};
