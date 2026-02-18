import { vi } from 'vitest';
vi.mock('@inertiajs/react', async () => {
    const React = require('react');
    return {
        Link: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children),
        router: { get: vi.fn(), post: vi.fn(), put: vi.fn(), visit: vi.fn(), delete: vi.fn(), reload: vi.fn() },
        usePage: () => ({
            props: globalThis.__INERTIA_PAGE_PROPS__ || {
                auth: { user: { name: 'Admin', email: 'admin@gs2e.ci', role: 'admin', id: 'u1' }, is_admin: true, is_manager: true },
                flash: {},
                unreadNotificationCount: 0,
            },
            url: '/',
        }),
        useForm: (initial) => ({
            data: { ...initial },
            setData: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            processing: false,
            errors: {},
            reset: vi.fn(),
        }),
    };
});

import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage, resetPageProps } from './helpers';
import ProfileIndex from '../Pages/Profile/Index';

beforeEach(() => resetPageProps());

const defaultProps = {
    user: {
        name: 'Jean Admin',
        email: 'jean@gs2e.ci',
        role: 'admin',
        two_factor_enabled: false,
        notify_critical_alerts: true,
    },
    sessions: [
        {
            id: 's1',
            user_agent: 'Chrome Desktop',
            ip_address: '192.168.1.10',
            last_activity: 'il y a 5 min',
            is_current: true,
        },
        {
            id: 's2',
            user_agent: 'Firefox Mobile',
            ip_address: '10.0.0.1',
            last_activity: 'il y a 1h',
            is_current: false,
        },
    ],
};

describe('Profile/Index', () => {
    it('renders page title "Mon profil"', () => {
        renderPage(ProfileIndex, defaultProps);

        const layout = screen.getByTestId('layout');
        expect(layout).toHaveAttribute('data-title', 'Mon profil');
    });

    it('renders user name "Jean Admin"', () => {
        renderPage(ProfileIndex, defaultProps);

        expect(screen.getByText('Jean Admin')).toBeInTheDocument();
    });

    it('renders user email "jean@gs2e.ci"', () => {
        renderPage(ProfileIndex, defaultProps);

        expect(screen.getByText('jean@gs2e.ci')).toBeInTheDocument();
    });

    it('renders role badge "Administrateur"', () => {
        renderPage(ProfileIndex, defaultProps);

        expect(screen.getByText('Administrateur')).toBeInTheDocument();
    });

    it('renders "Informations personnelles" section', () => {
        renderPage(ProfileIndex, defaultProps);

        expect(screen.getByText('Informations personnelles')).toBeInTheDocument();
    });

    it('renders "Changer le mot de passe" section', () => {
        renderPage(ProfileIndex, defaultProps);

        expect(screen.getByText('Changer le mot de passe')).toBeInTheDocument();
    });

    it('renders "Notifications" section', () => {
        renderPage(ProfileIndex, defaultProps);

        expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    it('renders "Authentification à deux facteurs (2FA)" section', () => {
        renderPage(ProfileIndex, defaultProps);

        expect(screen.getByText(/Authentification .+ deux facteurs \(2FA\)/)).toBeInTheDocument();
    });

    it('renders "Sessions actives" section', () => {
        renderPage(ProfileIndex, defaultProps);

        expect(screen.getByText('Sessions actives')).toBeInTheDocument();
    });

    it('shows "Activer le 2FA" button when 2FA not enabled', () => {
        renderPage(ProfileIndex, defaultProps);

        expect(screen.getByText('Activer le 2FA')).toBeInTheDocument();
    });

    it('shows current session badge "Cette session"', () => {
        renderPage(ProfileIndex, defaultProps);

        expect(screen.getByText('Cette session')).toBeInTheDocument();
    });

    it('renders "Révoquer" button for non-current session', () => {
        renderPage(ProfileIndex, defaultProps);

        const revokeButtons = screen.getAllByText(/voquer/);
        expect(revokeButtons.length).toBeGreaterThanOrEqual(1);
    });
});
