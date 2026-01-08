import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { ProfileCard } from './ProfileCard';
import { X, LogIn, Cloud } from 'lucide-react';

import { CardSet } from '../types';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    lifetimeCorrect: number;
    onLogin: () => void;
    onLogout: () => void;
    librarySets: CardSet[];
    onOpenSettings: () => void;
}

export const UserModal: React.FC<UserModalProps> = ({
    isOpen,
    onClose,
    user,
    lifetimeCorrect,
    onLogin,
    onLogout,
    librarySets,
    onOpenSettings
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onMouseDown={onClose}>
            <div
                className="bg-panel border border-outline rounded-2xl shadow-2xl animate-in zoom-in-95 w-full max-w-4xl p-6 relative overflow-hidden flex flex-col"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="flex justify-end mb-4">
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

                        <div className="text-center text-xs text-muted">
                            You can manage your account data in <button onClick={onOpenSettings} className="underline hover:text-text font-bold">Global Settings</button>.
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Cloud size={40} className="text-accent" />
                        </div>
                        <h2 className="text-2xl font-bold text-text mb-2">Sync Your Progress</h2>
                        <p className="text-muted mb-8 max-w-[80%] mx-auto">
                            Sign in to save your stats, badges, and Sets to the cloud and access them from any device.
                        </p>

                        <button
                            onClick={onLogin}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-text text-bg rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg mb-4"
                        >
                            <LogIn size={18} /> Log in with Google
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
