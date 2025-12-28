import React from 'react';
import { X, FileText } from 'lucide-react';

interface TermsOfServiceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
            <div className="bg-panel border border-outline rounded-2xl p-0 w-full max-w-3xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-outline flex justify-between items-center bg-panel-2 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <FileText size={24} className="text-accent" />
                        <div>
                            <h2 className="text-xl font-bold text-text">Terms of Service</h2>
                            <div className="text-sm text-muted">Last updated: December 28, 2024</div>
                        </div>
                    </div>
                    <button onClick={onClose}><X size={20} className="text-muted hover:text-text" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6 text-text">

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">1. Acceptance of Terms</h3>
                        <p className="text-muted leading-relaxed">
                            By accessing or using Flashcardsish ("the Service"), you agree to be bound by these Terms of Service
                            ("Terms"). If you do not agree to these Terms, please do not use the Service. We reserve the right
                            to modify these Terms at any time, and such modifications will be effective immediately upon posting.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">2. Description of Service</h3>
                        <p className="text-muted leading-relaxed">
                            Flashcardsish is a free, open-source flashcard application that allows users to create, organize,
                            and study flashcard sets. The Service may include optional cloud synchronization features when
                            users sign in with their Google account.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">3. User Accounts</h3>
                        <div className="space-y-3 text-muted leading-relaxed">
                            <p>
                                <strong className="text-text">3.1</strong> You may use Flashcardsish without creating an account.
                                However, to enable cloud synchronization, you must sign in using Google OAuth.
                            </p>
                            <p>
                                <strong className="text-text">3.2</strong> You are responsible for maintaining the confidentiality
                                of your account credentials and for all activities that occur under your account.
                            </p>
                            <p>
                                <strong className="text-text">3.3</strong> You agree to provide accurate and complete information
                                when creating an account and to update such information as necessary.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">4. User Content</h3>
                        <div className="space-y-3 text-muted leading-relaxed">
                            <p>
                                <strong className="text-text">4.1 Ownership:</strong> You retain all rights to the content you
                                create within Flashcardsish, including flashcard sets, terms, definitions, and any uploaded images.
                            </p>
                            <p>
                                <strong className="text-text">4.2 License:</strong> By using the Service, you grant us a limited
                                license to store and display your content solely for the purpose of providing the Service to you.
                            </p>
                            <p>
                                <strong className="text-text">4.3 Responsibility:</strong> You are solely responsible for the
                                content you create. You agree not to create content that:
                            </p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Infringes on any third party's intellectual property rights</li>
                                <li>Contains illegal, harmful, threatening, abusive, or defamatory material</li>
                                <li>Contains malicious code or attempts to exploit the Service</li>
                                <li>Violates any applicable laws or regulations</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">5. Acceptable Use</h3>
                        <p className="text-muted leading-relaxed mb-2">
                            You agree not to:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 text-muted">
                            <li>Use the Service for any unlawful purpose</li>
                            <li>Attempt to gain unauthorized access to any part of the Service</li>
                            <li>Interfere with or disrupt the Service or servers</li>
                            <li>Use automated systems to access the Service without permission</li>
                            <li>Impersonate any person or entity</li>
                            <li>Use the Service to distribute spam or malware</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">6. Intellectual Property</h3>
                        <div className="space-y-3 text-muted leading-relaxed">
                            <p>
                                <strong className="text-text">6.1 Our Content:</strong> The Service, including its original
                                content, features, and functionality (excluding user content), is owned by the developers of
                                Flashcardsish and is protected by copyright and other intellectual property laws.
                            </p>
                            <p>
                                <strong className="text-text">6.2 Open Source:</strong> Flashcardsish is open-source software.
                                The source code is available under the terms specified in our LICENSE file. This license governs
                                your use, modification, and distribution of the source code.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">7. Disclaimer of Warranties</h3>
                        <div className="p-4 bg-panel-2 rounded-xl border border-outline">
                            <p className="text-muted leading-relaxed">
                                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS
                                OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
                                PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
                                ERROR-FREE, SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">8. Limitation of Liability</h3>
                        <div className="p-4 bg-panel-2 rounded-xl border border-outline">
                            <p className="text-muted leading-relaxed">
                                TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL THE DEVELOPERS OF FLASHCARDSISH BE LIABLE
                                FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS,
                                DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM (A) YOUR ACCESS TO OR USE OF OR
                                INABILITY TO ACCESS OR USE THE SERVICE; (B) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICE;
                                (C) UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR CONTENT; OR (D) ANY DATA LOSS OR CORRUPTION.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">9. Indemnification</h3>
                        <p className="text-muted leading-relaxed">
                            You agree to indemnify, defend, and hold harmless the developers of Flashcardsish from and against
                            any claims, liabilities, damages, losses, and expenses, including reasonable attorney's fees, arising
                            out of or in any way connected with your access to or use of the Service, your violation of these Terms,
                            or your violation of any third-party rights.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">10. Termination</h3>
                        <div className="space-y-3 text-muted leading-relaxed">
                            <p>
                                <strong className="text-text">10.1</strong> We reserve the right to suspend or terminate your
                                access to the Service at any time, with or without cause, and with or without notice.
                            </p>
                            <p>
                                <strong className="text-text">10.2</strong> You may stop using the Service at any time. You may
                                delete your local data by clearing your browser storage, and you may request deletion of cloud
                                data by contacting us.
                            </p>
                            <p>
                                <strong className="text-text">10.3</strong> Upon termination, your right to use the Service will
                                immediately cease.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">11. Data Loss</h3>
                        <p className="text-muted leading-relaxed">
                            We are not responsible for any loss of data. While we strive to maintain reliable data storage,
                            you are encouraged to export or backup your flashcard sets periodically. The Service is provided
                            for educational purposes, and critical data should not be stored solely within the Service.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">12. Changes to Terms</h3>
                        <p className="text-muted leading-relaxed">
                            We reserve the right to modify these Terms at any time. We will indicate changes by updating the
                            "Last updated" date. Your continued use of the Service after any such changes constitutes your
                            acceptance of the new Terms.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">13. Governing Law</h3>
                        <p className="text-muted leading-relaxed">
                            These Terms shall be governed by and construed in accordance with applicable laws, without regard
                            to conflict of law principles.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">14. Severability</h3>
                        <p className="text-muted leading-relaxed">
                            If any provision of these Terms is found to be unenforceable or invalid, that provision will be
                            limited or eliminated to the minimum extent necessary so that the remaining Terms will remain in
                            full force and effect.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">15. Contact</h3>
                        <p className="text-muted leading-relaxed">
                            If you have any questions about these Terms, please open an issue on our GitHub repository or
                            reach out through the project's contact channels.
                        </p>
                    </section>

                </div>
            </div>
        </div>
    );
};
