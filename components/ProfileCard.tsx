import React from 'react';
import { User } from '@supabase/supabase-js';
import { CardSet } from '../types';
import { Cloud, Calendar, TrendingUp, BookOpen, Star, Layers, CheckCircle, User as UserIcon } from 'lucide-react';
import clsx from 'clsx';

interface ProfileCardProps {
    user: User | null;
    lifetimeCorrect: number;
    librarySets: CardSet[];
    className?: string;
}

// Generate initials from user info
const getInitials = (user: User | null): string => {
    if (!user) return '?';
    const name = user.user_metadata?.full_name || user.email || '';
    const parts = name.split(/[@\s]+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (parts[0]?.[0] || '?').toUpperCase();
};

export const ProfileCard: React.FC<ProfileCardProps> = ({ user, lifetimeCorrect, librarySets, className }) => {
    // Dynamic Stats
    const totalCards = librarySets.reduce((acc, set) => acc + set.cards.length, 0);
    const totalStarred = librarySets.reduce((acc, set) => acc + set.cards.filter(c => c.star).length, 0);
    const totalSets = librarySets.length;
    const avgSetSize = totalSets > 0 ? Math.round(totalCards / totalSets) : 0;



    // Join Date
    const joinDate = user?.created_at ? new Date(user.created_at) : new Date();
    const formattedJoinDate = joinDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return (
        <div className={clsx("bg-panel border border-outline rounded-3xl p-8 md:p-10 relative overflow-hidden", className)}>

            <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-start md:items-center">
                {/* Avatar */}
                <div className="flex-shrink-0">
                    {user ? (
                        user.user_metadata?.avatar_url ? (
                            <img
                                src={user.user_metadata.avatar_url}
                                alt="Profile"
                                className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-text object-cover bg-panel shadow-sm"
                            />
                        ) : (
                            // Fallback: Show initials locally instead of calling external API
                            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-text bg-panel-2 flex items-center justify-center shadow-sm">
                                <span className="text-4xl md:text-5xl font-bold text-accent">
                                    {getInitials(user)}
                                </span>
                            </div>
                        )
                    ) : (
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-text bg-panel flex items-center justify-center shadow-sm">
                            <Cloud size={64} className="text-text" />
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-grow w-full">
                    <h2 className="text-3xl md:text-5xl font-bold text-text mb-2 tracking-tight">
                        Hello, {user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User'}
                    </h2>
                    <p className="text-base md:text-lg text-muted/80 font-medium mb-10 flex items-center gap-2">
                        <Calendar size={18} />
                        Member since {formattedJoinDate}
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-y-8 gap-x-4 lg:gap-x-12">
                        {/* Row 1 */}
                        <div className="space-y-1">
                            <div className="text-xs md:text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-2 flex-wrap mb-1">
                                <Layers size={14} className="shrink-0" /> Cards Saved
                            </div>
                            <div className="text-2xl md:text-3xl font-bold text-text">{totalCards}</div>
                        </div>

                        <div className="space-y-1">
                            <div className="text-xs md:text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-2 flex-wrap mb-1">
                                <Star size={14} className="shrink-0" /> Starred
                            </div>
                            <div className="text-2xl md:text-3xl font-bold text-text">{totalStarred}</div>
                        </div>

                        <div className="space-y-1">
                            <div className="text-xs md:text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-2 flex-wrap mb-1">
                                <BookOpen size={14} className="shrink-0" /> Sets
                            </div>
                            <div className="text-2xl md:text-3xl font-bold text-text">{totalSets}</div>
                        </div>

                        {/* Row 2 */}
                        <div className="space-y-1">
                            <div className="text-xs md:text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-2 whitespace-nowrap mb-1">
                                <CheckCircle size={14} className="shrink-0" /> Lifetime Correct
                            </div>
                            <div className="text-2xl md:text-3xl font-bold text-text">{lifetimeCorrect}</div>
                        </div>

                        {/* Spacer for Desktop Alignment */}
                        <div className="hidden md:block"></div>

                        <div className="space-y-1">
                            <div className="text-xs md:text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-2 whitespace-nowrap mb-1">
                                <TrendingUp size={14} className="shrink-0" /> Avg. Set Size
                            </div>
                            <div className="text-2xl md:text-3xl font-bold text-text">{avgSetSize}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
