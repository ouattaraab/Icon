import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const dark = {
    key: 'dark',
    bg: '#0f172a',
    surface: '#1e293b',
    surfaceHover: '#253349',
    border: '#334155',
    text: '#f8fafc',
    textSecondary: '#e2e8f0',
    textMuted: '#94a3b8',
    textFaint: '#64748b',
    textSubtle: '#475569',
    inputBg: '#0f172a',
    accent: '#3b82f6',
    accentHover: '#2563eb',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    cardBg: '#1e293b',
    sidebarBg: '#1e293b',
    backdropBg: 'rgba(0,0,0,0.6)',
    shadow: 'rgba(0,0,0,0.4)',
    badgeBg: (color) => `${color}15`,
    badgeBorder: (color) => `${color}40`,
};

const light = {
    key: 'light',
    bg: '#f1f5f9',
    surface: '#ffffff',
    surfaceHover: '#f8fafc',
    border: '#e2e8f0',
    text: '#0f172a',
    textSecondary: '#1e293b',
    textMuted: '#475569',
    textFaint: '#94a3b8',
    textSubtle: '#cbd5e1',
    inputBg: '#ffffff',
    accent: '#3b82f6',
    accentHover: '#2563eb',
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',
    cardBg: '#ffffff',
    sidebarBg: '#ffffff',
    backdropBg: 'rgba(0,0,0,0.3)',
    shadow: 'rgba(0,0,0,0.1)',
    badgeBg: (color) => `${color}12`,
    badgeBorder: (color) => `${color}30`,
};

const themes = { dark, light };

const ThemeContext = createContext({ theme: dark, toggle: () => {}, isDark: true });

export function ThemeProvider({ children }) {
    const [mode, setMode] = useState(() => {
        if (typeof window === 'undefined') return 'dark';
        return localStorage.getItem('icon-theme') || 'dark';
    });

    const theme = themes[mode] || dark;
    const isDark = mode === 'dark';

    const toggle = useCallback(() => {
        setMode((prev) => {
            const next = prev === 'dark' ? 'light' : 'dark';
            localStorage.setItem('icon-theme', next);
            return next;
        });
    }, []);

    // Apply CSS variables on <html> for any components that need them
    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--icon-bg', theme.bg);
        root.style.setProperty('--icon-surface', theme.surface);
        root.style.setProperty('--icon-border', theme.border);
        root.style.setProperty('--icon-text', theme.text);
        root.style.setProperty('--icon-text-secondary', theme.textSecondary);
        root.style.setProperty('--icon-text-muted', theme.textMuted);
        root.style.setProperty('--icon-input-bg', theme.inputBg);
        root.style.setProperty('--icon-card-bg', theme.cardBg);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, toggle, isDark }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}

export { dark as darkTheme, light as lightTheme };
