import React, { useState } from 'react';
import { GoogleDriveUser } from '../src/googleDriveClient';
import { ProfileCard } from './ProfileCard';
import { SignInCard } from './SignInCard';
import { X } from 'lucide-react';

import { CardSet } from '../types';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: GoogleDriveUser | null;
    lifetimeCorrect: number;
    onLogin: (keepSignedIn: boolean) => void;
    onLogout: () => void;
    librarySets: CardSet[];
    onOpenSettings: () => void;
    onOpenPrivacy?: () => void;
}

export const UserModal: React.FC<UserModalProps> = ({
    isOpen,
    onClose,
    user,
    lifetimeCorrect,
    onLogin,
    onLogout,
    librarySets,
    onOpenSettings,
    onOpenPrivacy
}) => {
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
            <div
                className="bg-panel border border-outline rounded-2xl shadow-2xl animate-in zoom-in-95 w-full max-w-4xl p-6 relative overflow-hidden flex flex-col"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-outline">
                    <h2 className="text-2xl font-bold text-text">Account</h2>
                    <button
                        onClick={onClose}
                        className="text-muted hover:text-text p-2 rounded-lg hover:bg-panel-2 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {user ? (
                    <div className="space-y-6">
                        <ProfileCard
                            user={user}
                            lifetimeCorrect={lifetimeCorrect}
                            librarySets={librarySets}
                            className="shadow-sm"
                        />

                        {/* Logout Section */}
                        <div className="p-4 bg-panel-2 rounded-xl border border-outline/50">
                            <h3 className="text-sm font-bold text-muted uppercase tracking-widest mb-3">Account Actions</h3>
                            <button
                                onClick={onLogout}
                                className="w-full py-3 border-2 border-outline rounded-xl text-sm font-bold hover:bg-red/5 hover:text-red hover:border-red/30 transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                                Sign Out
                            </button>
                        </div>

                        <div className="text-center text-xs text-text">
                            You can manage your account data in <button onClick={onOpenSettings} className="underline hover:text-text font-bold">Global Settings</button>.
                        </div>
                    </div>
                ) : (
                    <SignInCard onLogin={onLogin} onOpenPrivacy={onOpenPrivacy} />
                )}
            </div>
        </div>
    );
};
