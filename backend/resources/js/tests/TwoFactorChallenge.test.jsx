import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage, resetPageProps } from './helpers';

// Add useForm mock for components that use forms
vi.mock('@inertiajs/react', async () => {
    const React = require('react');
    return {
        Link: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children),
        router: { get: vi.fn(), post: vi.fn(), put: vi.fn(), visit: vi.fn(), delete: vi.fn() },
        usePage: () => ({
            props: globalThis.__INERTIA_PAGE_PROPS__ || {
                auth: { user: { name: 'Admin', email: 'admin@gs2e.ci', role: 'admin' }, is_admin: true, is_manager: true },
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

import TwoFactorChallenge from '../Pages/Auth/TwoFactorChallenge';

beforeEach(() => resetPageProps());

const defaultProps = {
    user_id: 'abc-123',
};

describe('Auth/TwoFactorChallenge', () => {
    it('renders title "Icon" and subtitle "Vérification à deux facteurs"', () => {
        renderPage(TwoFactorChallenge, defaultProps);

        expect(screen.getByText('Icon')).toBeInTheDocument();
        expect(screen.getByText('Vérification à deux facteurs')).toBeInTheDocument();
    });

    it('renders TOTP code input with placeholder "000000"', () => {
        renderPage(TwoFactorChallenge, defaultProps);

        expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
    });

    it('renders "Vérifier" submit button', () => {
        renderPage(TwoFactorChallenge, defaultProps);

        expect(screen.getByText('Vérifier')).toBeInTheDocument();
    });

    it('renders toggle button "Utiliser un code de récupération"', () => {
        renderPage(TwoFactorChallenge, defaultProps);

        expect(screen.getByText('Utiliser un code de récupération')).toBeInTheDocument();
    });

    it('shows "Code TOTP" label by default', () => {
        renderPage(TwoFactorChallenge, defaultProps);

        expect(screen.getByText('Code TOTP')).toBeInTheDocument();
    });

    it('renders correct instruction text about 6-digit code', () => {
        renderPage(TwoFactorChallenge, defaultProps);

        expect(
            screen.getByText("Entrez le code à 6 chiffres de votre application d'authentification.")
        ).toBeInTheDocument();
    });
});
