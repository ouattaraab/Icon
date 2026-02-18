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

import Login from '../Pages/Auth/Login';

beforeEach(() => resetPageProps());

describe('Auth/Login', () => {
    it('renders Icon title and "Monitoring IA — GS2E" subtitle', () => {
        renderPage(Login);

        expect(screen.getByText('Icon')).toBeInTheDocument();
        expect(screen.getByText('Monitoring IA — GS2E')).toBeInTheDocument();
    });

    it('renders email input with placeholder "admin@gs2e.ci"', () => {
        renderPage(Login);

        expect(screen.getByPlaceholderText('admin@gs2e.ci')).toBeInTheDocument();
    });

    it('renders password input with placeholder "••••••••"', () => {
        renderPage(Login);

        expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    });

    it('renders "Se souvenir de moi" checkbox', () => {
        renderPage(Login);

        expect(screen.getByText('Se souvenir de moi')).toBeInTheDocument();
    });

    it('renders "Se connecter" submit button', () => {
        renderPage(Login);

        expect(screen.getByText('Se connecter')).toBeInTheDocument();
    });

    it('renders Email and "Mot de passe" labels', () => {
        renderPage(Login);

        expect(screen.getByText('Email')).toBeInTheDocument();
        expect(screen.getByText('Mot de passe')).toBeInTheDocument();
    });
});
