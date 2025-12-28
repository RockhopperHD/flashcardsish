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
                            <div className="text-sm text-muted">Last updated: December 28, 2025</div>
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
                            Your continued use of the Service after any changes constitutes acceptance of the modified Terms.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">2. Description of Service</h3>
                        <p className="text-muted leading-relaxed">
                            Flashcardsish is a free, open-source flashcard application that allows users to create, organize,
                            and study flashcard sets. The Service may include optional cloud synchronization features when
                            users sign in with their Google account. Flashcardsish is a personal, hobby project developed and
                            maintained by a single individual.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">3. Service Availability and Discontinuation</h3>
                        <div className="p-4 bg-yellow/10 rounded-xl border border-yellow/30 mb-3">
                            <p className="text-muted leading-relaxed">
                                <strong className="text-yellow">⚠️ No Uptime Guarantee:</strong> The Service is provided on an "as available" basis.
                                We make no guarantees regarding uptime, availability, or service level agreements (SLA).
                                The Service may be modified, suspended, or permanently discontinued at any time, with or without notice.
                            </p>
                        </div>
                        <div className="space-y-3 text-muted leading-relaxed">
                            <p>
                                <strong className="text-text">3.1</strong> We reserve the right to modify, update, or remove features
                                of the Service at any time without prior notice.
                            </p>
                            <p>
                                <strong className="text-text">3.2</strong> We may temporarily or permanently suspend the Service for
                                maintenance, updates, security concerns, or any other reason at our sole discretion.
                            </p>
                            <p>
                                <strong className="text-text">3.3</strong> In the event of permanent discontinuation, we will make
                                reasonable efforts to provide advance notice when feasible, but this is not guaranteed.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">4. User Accounts</h3>
                        <div className="space-y-3 text-muted leading-relaxed">
                            <p>
                                <strong className="text-text">4.1</strong> You may use Flashcardsish without creating an account.
                                However, to enable cloud synchronization, you must sign in using Google OAuth.
                            </p>
                            <p>
                                <strong className="text-text">4.2</strong> You are responsible for maintaining the confidentiality
                                of your account credentials and for all activities that occur under your account.
                            </p>
                            <p>
                                <strong className="text-text">4.3</strong> You agree to provide accurate and complete information
                                when creating an account and to update such information as necessary.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">5. User Content</h3>
                        <div className="space-y-3 text-muted leading-relaxed">
                            <p>
                                <strong className="text-text">5.1 Ownership:</strong> You retain all rights to the content you
                                create within Flashcardsish, including flashcard sets, terms, definitions, and any uploaded images.
                            </p>
                            <p>
                                <strong className="text-text">5.2 License:</strong> By using the Service, you grant us a limited
                                license to store and display your content solely for the purpose of providing the Service to you.
                            </p>
                            <p>
                                <strong className="text-text">5.3 Responsibility:</strong> You are solely responsible for the
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
                        <h3 className="text-lg font-bold text-accent mb-3">6. Data Retention and Deletion</h3>
                        <div className="space-y-3 text-muted leading-relaxed">
                            <p>
                                <strong className="text-text">6.1</strong> We retain your data for as long as your account is active
                                and you continue to use the Service. You may delete your data at any time using the "Delete All My Data"
                                feature in Settings.
                            </p>
                            <p>
                                <strong className="text-text">6.2</strong> Your data may be deleted under the following circumstances:
                            </p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Service shutdown or discontinuation</li>
                                <li>Database migrations, restructuring, or technical necessity</li>
                                <li>Hosting provider changes or limitations</li>
                                <li>Development-related database resets during active development phases</li>
                                <li>Security incidents requiring data purge</li>
                                <li>Extended account inactivity (accounts inactive for 12+ months)</li>
                            </ul>
                            <p>
                                <strong className="text-text">6.3</strong> We will make reasonable efforts to notify users before
                                planned data deletion when feasible, but given the project's development nature, this cannot be guaranteed.
                            </p>
                            <p>
                                <strong className="text-text">6.4</strong> You are strongly encouraged to regularly export your data
                                using the "Export All My Data" feature or download .flashcards files as backups.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">7. Third-Party Services</h3>
                        <div className="space-y-3 text-muted leading-relaxed">
                            <p>
                                <strong className="text-text">7.1</strong> The Service relies on third-party services including
                                Google (for authentication) and Supabase (for data storage). These services operate under their
                                own terms of service and privacy policies.
                            </p>
                            <p>
                                <strong className="text-text">7.2</strong> We are not responsible for:
                            </p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Outages, downtime, or service interruptions of Google or Supabase</li>
                                <li>Data breaches or security incidents originating from third-party services</li>
                                <li>Changes to third-party terms, policies, or pricing that affect the Service</li>
                                <li>Data loss or corruption caused by third-party service failures</li>
                            </ul>
                            <p>
                                <strong className="text-text">7.3</strong> Your use of Google OAuth is subject to{' '}
                                <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                                    Google's Terms of Service
                                </a>. Your data stored via Supabase is subject to{' '}
                                <a href="https://supabase.com/terms" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                                    Supabase's Terms of Service
                                </a>.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">8. Acceptable Use</h3>
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
                        <h3 className="text-lg font-bold text-accent mb-3">9. Intellectual Property</h3>
                        <div className="space-y-3 text-muted leading-relaxed">
                            <p>
                                <strong className="text-text">9.1 Our Content:</strong> The Service, including its original
                                content, features, and functionality (excluding user content), is owned by the developers of
                                Flashcardsish and is protected by copyright and other intellectual property laws.
                            </p>
                            <p>
                                <strong className="text-text">9.2 Open Source:</strong> Flashcardsish is open-source software.
                                The source code is available under the terms specified in our LICENSE file. This license governs
                                your use, modification, and distribution of the source code.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">10. Disclaimer of Warranties</h3>
                        <div className="p-4 bg-panel-2 rounded-xl border border-outline">
                            <p className="text-muted leading-relaxed">
                                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS
                                OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
                                PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
                                ERROR-FREE, SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS. WE MAKE NO GUARANTEES REGARDING
                                DATA INTEGRITY, BACKUP, OR LONG-TERM STORAGE.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">11. Limitation of Liability</h3>
                        <div className="p-4 bg-panel-2 rounded-xl border border-outline">
                            <p className="text-muted leading-relaxed">
                                TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL THE DEVELOPERS OF FLASHCARDSISH BE LIABLE
                                FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS,
                                DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM (A) YOUR ACCESS TO OR USE OF OR
                                INABILITY TO ACCESS OR USE THE SERVICE; (B) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICE;
                                (C) UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR CONTENT; (D) ANY DATA LOSS OR CORRUPTION;
                                (E) SERVICE MODIFICATIONS, SUSPENSIONS, OR DISCONTINUATION; (F) THIRD-PARTY SERVICE FAILURES; OR
                                (G) ANY EVENTS BEYOND OUR REASONABLE CONTROL.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">12. Force Majeure and External Events</h3>
                        <p className="text-muted leading-relaxed">
                            We shall not be liable for any failure or delay in performing our obligations where such failure
                            or delay results from circumstances beyond our reasonable control, including but not limited to:
                            natural disasters, acts of government, internet or infrastructure failures, hosting provider issues,
                            third-party service outages, cyberattacks, power failures, or other force majeure events.
                            Feature changes, data migrations, downtime, or data loss caused by such external events or
                            infrastructure changes do not create liability.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">13. Indemnification</h3>
                        <p className="text-muted leading-relaxed">
                            You agree to indemnify, defend, and hold harmless the developers of Flashcardsish from and against
                            any claims, liabilities, damages, losses, and expenses, including reasonable attorney's fees, arising
                            out of or in any way connected with your access to or use of the Service, your violation of these Terms,
                            or your violation of any third-party rights.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">14. Children's Privacy</h3>
                        <div className="space-y-3 text-muted leading-relaxed">
                            <p>
                                <strong className="text-text">14.1</strong> The Service is not intended for children under 13 years
                                of age. We do not knowingly collect personal information from children under 13.
                            </p>
                            <p>
                                <strong className="text-text">14.2</strong> If we discover that we have inadvertently collected
                                personal information from a child under 13, we will promptly delete such information from our systems.
                            </p>
                            <p>
                                <strong className="text-text">14.3</strong> If you are a parent or guardian and believe your child
                                has provided personal information to us, please contact us at{' '}
                                <a href="mailto:owenw2023@gmail.com" className="text-accent hover:underline">owenw2023@gmail.com</a>{' '}
                                and we will take steps to delete the information.
                            </p>
                            <p>
                                <strong className="text-text">14.4</strong> We comply with applicable children's privacy laws,
                                including the Children's Online Privacy Protection Act (COPPA) where applicable.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">15. Termination</h3>
                        <div className="space-y-3 text-muted leading-relaxed">
                            <p>
                                <strong className="text-text">15.1</strong> We reserve the right to suspend or terminate your
                                access to the Service at any time, with or without cause, and with or without notice.
                            </p>
                            <p>
                                <strong className="text-text">15.2</strong> You may stop using the Service at any time. You may
                                delete your data using the "Delete All My Data" button in Settings, or by clearing your browser storage
                                for local data.
                            </p>
                            <p>
                                <strong className="text-text">15.3</strong> Upon termination, your right to use the Service will
                                immediately cease.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">16. Dispute Resolution</h3>
                        <div className="space-y-3 text-muted leading-relaxed">
                            <p>
                                <strong className="text-text">16.1 Informal Resolution:</strong> Before initiating any formal
                                dispute proceedings, you agree to first contact us at{' '}
                                <a href="mailto:owenw2023@gmail.com" className="text-accent hover:underline">owenw2023@gmail.com</a>{' '}
                                and attempt to resolve the dispute informally for at least 30 days.
                            </p>
                            <p>
                                <strong className="text-text">16.2</strong> Given the free, open-source nature of this Service,
                                both parties agree to make good-faith efforts to resolve disputes amicably without resorting to
                                formal legal proceedings.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">17. Governing Law and Venue</h3>
                        <div className="space-y-3 text-muted leading-relaxed">
                            <p>
                                <strong className="text-text">17.1</strong> These Terms shall be governed by and construed in
                                accordance with the laws of the State of New Jersey, United States, without regard to its
                                conflict of law provisions.
                            </p>
                            <p>
                                <strong className="text-text">17.2</strong> Any legal action or proceeding arising out of or
                                relating to these Terms shall be brought exclusively in the state or federal courts located
                                in New Jersey, and you consent to the personal jurisdiction of such courts.
                            </p>
                            <p>
                                <strong className="text-text">17.3</strong> Notwithstanding the above, we reserve the right to
                                seek injunctive or other equitable relief in any court of competent jurisdiction.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">18. Severability</h3>
                        <p className="text-muted leading-relaxed">
                            If any provision of these Terms is found to be unenforceable or invalid, that provision will be
                            limited or eliminated to the minimum extent necessary so that the remaining Terms will remain in
                            full force and effect.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">19. Entire Agreement</h3>
                        <p className="text-muted leading-relaxed">
                            These Terms, together with our Privacy Policy, constitute the entire agreement between you and
                            the developers of Flashcardsish regarding the Service and supersede any prior agreements or
                            understandings.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-accent mb-3">20. Contact</h3>
                        <p className="text-muted leading-relaxed">
                            If you have any questions about these Terms, please contact us at:
                        </p>
                        <p className="mt-2">
                            <a href="mailto:owenw2023@gmail.com" className="text-accent hover:underline font-bold">
                                owenw2023@gmail.com
                            </a>
                        </p>
                        <p className="text-muted leading-relaxed mt-2">
                            You may also open an issue on our GitHub repository for general inquiries.
                        </p>
                    </section>

                </div>
            </div>
        </div>
    );
};
