/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                bg: 'var(--bg)',
                panel: 'var(--panel)',
                'panel-2': 'var(--panel-2)',
                text: 'var(--text)',
                muted: 'var(--muted)',
                accent: 'var(--accent)',
                red: 'var(--red)',
                yellow: 'var(--yellow)',
                green: 'var(--green)',
                blue: 'var(--blue)',
                purple: 'var(--purple)',
                pill: '#1e1913',
                outline: 'var(--outline)',
            },
            fontFamily: {
                sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial'],
                mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
            },
            animation: {
                'glow-pulse': 'glowPulse 1s ease-out',
                'fall': 'fall 3s linear forwards',
            },
            keyframes: {
                glowPulse: {
                    '0%': { boxShadow: '0 0 0px var(--green)' },
                    '50%': { boxShadow: '0 0 25px 10px rgba(147,210,108,0.7)' },
                    '100%': { boxShadow: '0 0 0px var(--green)' },
                },
                fall: {
                    'to': { transform: 'translateY(100vh) rotate(720deg)', opacity: '0' }
                }
            }
        }
    },
    plugins: [],
}
