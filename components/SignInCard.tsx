import React from 'react';


interface SignInCardProps {
    onLogin: (keepSignedIn: boolean) => void;
    onOpenPrivacy?: () => void;
}

export const SignInCard: React.FC<SignInCardProps> = ({ onLogin, onOpenPrivacy }) => {
    const [keepSignedIn, setKeepSignedIn] = React.useState(true);

    return (
        <div className="flex flex-col items-center text-left w-full">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6 w-full">
                <div className="w-16 h-16 rounded-full bg-panel-2 border border-outline flex items-center justify-center shrink-0 shadow-sm relative overflow-hidden group">
                    {/* Fallback to Cloud if we want, but User asked for G logo. 
                        We'll make a styled G. */}
                    <svg viewBox="0 0 48 48" className="w-8 h-8 group-hover:scale-110 transition-transform text-text fill-current">
                        <path d="M23.4 46.9c-12.5 0-23-10.2-23-22.7s10.5-22.7 23-22.7c6.9 0 11.9 2.7 15.6 6.3l-4.4 4.4c-2.7-2.5-6.3-4.4-11.2-4.4C14.2 7.7 7.1 15 7.1 24.2c0 9.1 7.1 16.5 16.3 16.5 5.9 0 9.3-2.4 11.5-4.5 1.8-1.8 2.9-4.3 3.4-7.8H23.5v-6.2h20.7c.2 1.1.3 2.4.3 3.9 0 4.7-1.3 10.4-5.4 14.5-3.9 4.1-9 6.3-15.7 6.3z" />
                    </svg>
                </div>
                <h2
                    className="text-3xl text-text"
                    style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
                >
                    Cloud Sync
                </h2>
            </div>

            {/* Content Body */}
            <div className="w-full space-y-6">
                <div>
                    <h3 className="text-xl font-bold text-text mb-3">How does it work?</h3>
                    <ol className="list-decimal list-inside space-y-2 text-muted font-medium ml-1">
                        <li>Sign in with your Google account</li>
                        <li>We'll make a Google Drive folder for you</li>
                        <li>Your data for Flashcardsish is stored there</li>
                    </ol>
                </div>

                <div className="text-sm text-muted leading-relaxed border-t border-outline/50 pt-4">
                    <p className="mb-2">
                        Flashcardsish files are optimized to be small, often a couple KB for most regular-sized sets.
                        Flashcardsish ONLY uses Google Drive to store and read/write to this one file (<button onClick={(e) => { e.preventDefault(); onOpenPrivacy?.(); }} className="underline hover:text-text cursor-pointer pb-0.5">learn more</button>).
                    </p>
                    <p>
                        You'll still be able to download and share individual sets as well as use Flashcardsish without an account.
                        Signing in also enables image uploads!
                    </p>
                </div>

                {/* Privacy Policy Link - Absolute or inline? Image showed an arrow pointing to "learn more" as privacy policy link potentially? 
                   The arrow in the image points to "(learn more)" and says "privacy policy link".
                */}
            </div>

            {/* Action Button */}
            <div className="w-full mt-8 space-y-4">
                <label className="flex items-center gap-3 text-sm text-muted font-medium cursor-pointer select-none group">
                    <input
                        type="checkbox"
                        checked={keepSignedIn}
                        onChange={(e) => setKeepSignedIn(e.target.checked)}
                        className="hidden"
                    />
                    <div
                        className={keepSignedIn
                            ? "w-5 h-5 rounded border-2 flex items-center justify-center transition-all bg-accent border-accent"
                            : "w-5 h-5 rounded border-2 flex items-center justify-center transition-all border-outline group-hover:border-accent"
                        }
                    >
                        {keepSignedIn && (
                            <div className="w-2.5 h-1.5 border-b-2 border-l-2 border-bg -rotate-45 -mt-0.5" />
                        )}
                    </div>
                    Keep me signed in
                </label>
                <button
                    onClick={() => onLogin(keepSignedIn)}
                    className="w-full py-5 bg-text text-bg rounded-xl font-bold text-xl hover:opacity-90 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                    Sign in
                </button>
                <div className="text-center mt-3">
                    {/* If the user wants a privacy policy link at the bottom, or if "learn more" was it. 
                        The annotation pointing to "learn more" says "privacy policy link". 
                        I will assume the (learn more) IS the privacy policy link.
                     */}
                </div>
            </div>
        </div>
    );
};
