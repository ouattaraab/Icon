import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock @inertiajs/react globally
vi.mock('@inertiajs/react', () => {
    const React = require('react');
    return {
        Link: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children),
        router: {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            visit: vi.fn(),
        },
        usePage: () => ({
            props: globalThis.__INERTIA_PAGE_PROPS__ || {
                auth: { user: { name: 'Admin', email: 'admin@gs2e.ci', role: 'admin' }, is_admin: true, is_manager: true },
                flash: {},
                unreadNotificationCount: 0,
            },
            url: '/',
        }),
    };
});

// Mock DashboardLayout globally
vi.mock('../Layouts/DashboardLayout', () => {
    const React = require('react');
    return {
        default: ({ children, title }) => React.createElement('div', { 'data-testid': 'layout', 'data-title': title }, children),
    };
});

// Mock ThemeContext globally
vi.mock('../Contexts/ThemeContext', () => {
    const React = require('react');
    const darkTheme = {
        key: 'dark', bg: '#0f172a', surface: '#1e293b', surfaceHover: '#253349',
        border: '#334155', text: '#f8fafc', textSecondary: '#e2e8f0', textMuted: '#94a3b8',
        textFaint: '#64748b', textSubtle: '#475569', inputBg: '#0f172a', accent: '#3b82f6',
        accentHover: '#2563eb', success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
        cardBg: '#1e293b', sidebarBg: '#1e293b', backdropBg: 'rgba(0,0,0,0.6)',
        shadow: 'rgba(0,0,0,0.4)', badgeBg: (c) => `${c}15`, badgeBorder: (c) => `${c}40`,
    };
    return {
        ThemeProvider: ({ children }) => React.createElement(React.Fragment, null, children),
        useTheme: () => ({ theme: darkTheme, toggle: () => {}, isDark: true }),
        darkTheme,
        lightTheme: darkTheme,
    };
});
