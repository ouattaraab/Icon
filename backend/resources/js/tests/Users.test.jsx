import { vi } from 'vitest';
vi.mock('@inertiajs/react', async () => {
    const React = require('react');
    return {
        Link: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children),
        router: { get: vi.fn(), post: vi.fn(), put: vi.fn(), visit: vi.fn(), delete: vi.fn() },
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
import UsersIndex from '../Pages/Users/Index';

beforeEach(() => resetPageProps());

const defaultProps = {
    users: [
        {
            id: 'u1', name: 'Admin User', email: 'admin@gs2e.ci',
            role: 'admin', notify_critical_alerts: true,
            created_at: '2025-01-01T00:00:00Z',
        },
        {
            id: 'u2', name: 'Manager User', email: 'manager@gs2e.ci',
            role: 'manager', notify_critical_alerts: false,
            created_at: '2025-01-05T00:00:00Z',
        },
        {
            id: 'u3', name: 'Viewer User', email: 'viewer@gs2e.ci',
            role: 'viewer', notify_critical_alerts: false,
            created_at: '2025-01-10T00:00:00Z',
        },
    ],
};

describe('Users/Index', () => {
    it('renders page title "Gestion des utilisateurs"', () => {
        renderPage(UsersIndex, defaultProps);

        const layout = screen.getByTestId('layout');
        expect(layout).toHaveAttribute('data-title', 'Gestion des utilisateurs');
    });

    it('renders user names', () => {
        renderPage(UsersIndex, defaultProps);

        expect(screen.getByText('Admin User')).toBeInTheDocument();
        expect(screen.getByText('Manager User')).toBeInTheDocument();
        expect(screen.getByText('Viewer User')).toBeInTheDocument();
    });

    it('shows role badges (Administrateur, Manager, Lecteur)', () => {
        renderPage(UsersIndex, defaultProps);

        expect(screen.getAllByText('Administrateur').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Manager').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Lecteur').length).toBeGreaterThanOrEqual(1);
    });

    it('shows notification status for users', () => {
        renderPage(UsersIndex, defaultProps);

        expect(screen.getByText('Oui')).toBeInTheDocument();
        expect(screen.getAllByText('Non').length).toBe(2);
    });

    it('renders "Ajouter un utilisateur" button', () => {
        renderPage(UsersIndex, defaultProps);

        expect(screen.getByText('+ Ajouter un utilisateur')).toBeInTheDocument();
    });

    it('shows user count "3 utilisateurs"', () => {
        renderPage(UsersIndex, defaultProps);

        expect(screen.getByText('3 utilisateurs')).toBeInTheDocument();
    });

    it('renders "Modifier" buttons for each user', () => {
        renderPage(UsersIndex, defaultProps);

        expect(screen.getAllByText('Modifier').length).toBe(3);
    });

    it('renders role legend text at bottom', () => {
        renderPage(UsersIndex, defaultProps);

        expect(screen.getByText(/accès total/)).toBeInTheDocument();
        expect(screen.getByText(/gestion règles/)).toBeInTheDocument();
        expect(screen.getByText(/consultation uniquement/)).toBeInTheDocument();
    });

    it('does not show "Supprimer" for current user (id matches auth.user.id)', () => {
        renderPage(UsersIndex, defaultProps);

        // u1 is the current auth user, so only u2 and u3 should have Supprimer
        expect(screen.getAllByText('Supprimer').length).toBe(2);
    });

    it('shows "Supprimer" for other users', () => {
        renderPage(UsersIndex, defaultProps);

        const deleteButtons = screen.getAllByText('Supprimer');
        expect(deleteButtons.length).toBe(2);
    });
});
