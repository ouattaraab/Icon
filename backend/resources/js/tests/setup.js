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
