import React from 'react';
import { X, FileText } from 'lucide-react';

interface TermsOfServiceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onMouseDown={onClose}>
            <div className="bg-panel border border-outline rounded-2xl p-0 w-full max-w-3xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[85vh]" onMouseDown={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-outline flex justify-between items-center bg-panel-2 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <FileText size={24} className="text-accent" />
                        <div>
                            <h2 className="text-xl font-bold text-text">Terms of Service</h2>
                            <div className="text-sm text-muted">Last updated: February 9, 2026</div>
                        </div>
                    </div>
                    <button onClick={onClose}><X size={20} className="text-muted hover:text-text" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6 text-text/90">
                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">1. Acceptance of Terms</h3>
                        <p>By accessing or using Flashcardsish, you agree to be bound by these Terms of Service and the Privacy Policy. If you do not agree, do not use the Service.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">2. Description of the Service</h3>
                        <p>Flashcardsish is an experimental, open-source flashcard application provided as a personal hobby project. The Service may change, break, or be discontinued at any time.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">3. Eligibility</h3>
                        <ul className="list-disc pl-5 my-2 space-y-1">
                            <li>General use: 16 years or older</li>
                            <li>AI-related features: 18 years or older</li>
                        </ul>
                        <p>By using the Service, you confirm that you meet these requirements.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">4. Accounts & Access</h3>
                        <p>You may use the Service without signing in. Google authentication is optional and required only for synchronization or image hosting.</p>
                        <p className="mt-2">You are responsible for maintaining the security of your Google account.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">5. User Content</h3>
                        <p>You retain ownership of all content you create. By using the Service, you grant a limited, non-exclusive license to store and display your content solely to provide the Service to you.</p>
                        <p className="mt-2 text-sm font-bold">You agree not to create content that:</p>
                        <ul className="list-disc pl-5 my-2 space-y-1">
                            <li>Violates laws or regulations</li>
                            <li>Infringes intellectual property</li>
                            <li>Contains malicious code</li>
                            <li>Abuses or exploits the Service</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">6. Experimental Nature & Data Loss</h3>
                        <p>The Service is provided <strong>"AS IS"</strong> and <strong>"AS AVAILABLE."</strong></p>
                        <p className="mt-2 font-bold">Data loss may occur due to:</p>
                        <ul className="list-disc pl-5 my-2 space-y-1">
                            <li>Software bugs</li>
                            <li>Browser issues</li>
                            <li>Google Drive failures</li>
                            <li>API changes or revocations</li>
                            <li>Project discontinuation</li>
                        </ul>
                        <p className="mt-2">You are solely responsible for backing up your data using export tools.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">7. Third-Party Services</h3>
                        <p>Flashcardsish depends on third-party services, primarily Google. We are not responsible for:</p>
                        <ul className="list-disc pl-5 my-2 space-y-1">
                            <li>Third-party outages or failures</li>
                            <li>Data loss caused by third-party services</li>
                            <li>Changes to third-party terms or APIs</li>
                        </ul>
                        <p>If Google revokes or restricts API access, the Service may stop functioning immediately.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">8. Developer API & AI Features</h3>
                        <p>Optional features may allow you to use your own API keys. By using these features, you confirm that:</p>
                        <ul className="list-disc pl-5 my-2 space-y-1">
                            <li>You are 18 years or older</li>
                            <li>You are authorized to use the keys</li>
                            <li>You comply with third-party terms</li>
                            <li>You assume all responsibility for generated content</li>
                        </ul>
                        <p className="mt-2 italic">AI output may be inaccurate or inappropriate. You use it at your own risk.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">9. Acceptable Use</h3>
                        <p>You agree not to:</p>
                        <ul className="list-disc pl-5 my-2 space-y-1">
                            <li>Use the Service unlawfully</li>
                            <li>Attempt unauthorized access</li>
                            <li>Interfere with operation</li>
                            <li>Abuse or exploit the Service</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">10. Suspension & Termination</h3>
                        <p>Access may be suspended or terminated at any time, with or without notice, for any reason, including misuse or behavior deemed undesirable. You may stop using the Service at any time.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">11. Disclaimer of Warranties</h3>
                        <p>The Service is provided without warranties of any kind, express or implied, including fitness for a particular purpose or data reliability.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">12. Limitation of Liability</h3>
                        <p>To the maximum extent permitted by law, the developer shall not be liable for any indirect, incidental, consequential, or special damages, including data loss or service interruption.</p>
                        <p className="mt-2 font-bold underline">If liability is found to exist, it shall be limited to zero dollars ($0), as the Service is provided free of charge.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">13. No Class Actions</h3>
                        <p>Any disputes must be brought on an individual basis. You waive the right to participate in any class or representative action.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">14. Governing Law</h3>
                        <p>These Terms are governed by the laws of the State of New York, United States.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">15. Severability</h3>
                        <p>If any provision is found unenforceable, the remaining provisions remain in effect.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">16. Entire Agreement</h3>
                        <p>These Terms and the Privacy Policy constitute the entire agreement between you and the developer regarding the Service.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-text mb-2">17. Contact</h3>
                        <p>Questions may be sent to: <strong>owenw2023@gmail.com</strong></p>
                    </section>
                </div>
            </div>
        </div>
    );
};
