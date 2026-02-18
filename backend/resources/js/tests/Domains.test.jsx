import { vi } from 'vitest';
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

import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage, resetPageProps } from './helpers';
import DomainsIndex from '../Pages/Domains/Index';

beforeEach(() => resetPageProps());

const defaultProps = {
    domains: {
        data: [
            {
                id: 'd1', domain: 'api.openai.com', platform_name: 'ChatGPT',
                is_blocked: false, created_at: '2025-01-01T00:00:00Z',
            },
            {
                id: 'd2', domain: 'claude.ai', platform_name: 'Claude',
                is_blocked: true, created_at: '2025-01-05T00:00:00Z',
            },
        ],
        current_page: 1, last_page: 1, total: 2,
    },
    platforms: ['ChatGPT', 'Claude', 'Copilot'],
    filters: {},
};

describe('Domains/Index', () => {
    it('renders domain names', () => {
        renderPage(DomainsIndex, defaultProps);

        expect(screen.getByText('api.openai.com')).toBeInTheDocument();
        expect(screen.getByText('claude.ai')).toBeInTheDocument();
    });

    it('shows platform names', () => {
        renderPage(DomainsIndex, defaultProps);

        // Platform names appear in both the table and the filter dropdown
        expect(screen.getAllByText('ChatGPT').length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText('Claude').length).toBeGreaterThanOrEqual(2);
    });

    it('shows status badges (Surveillé, Bloqué)', () => {
        renderPage(DomainsIndex, defaultProps);

        // "Surveillé" and "Bloqué" appear in status badges and in the legend
        expect(screen.getAllByText('Surveillé').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Bloqué').length).toBeGreaterThanOrEqual(1);
    });

    it('renders "+ Ajouter" button', () => {
        renderPage(DomainsIndex, defaultProps);

        expect(screen.getByText('+ Ajouter')).toBeInTheDocument();
    });

    it('shows total "2 domaine(s)"', () => {
        renderPage(DomainsIndex, defaultProps);

        expect(screen.getByText('2 domaine(s)')).toBeInTheDocument();
    });

    it('renders filter dropdowns', () => {
        renderPage(DomainsIndex, defaultProps);

        expect(screen.getByText('Tous les statuts')).toBeInTheDocument();
        expect(screen.getByText('Toutes les plateformes')).toBeInTheDocument();
    });

    it('renders "Rechercher" button', () => {
        renderPage(DomainsIndex, defaultProps);

        expect(screen.getByText('Rechercher')).toBeInTheDocument();
    });

    it('renders legend text about Surveillé and Bloqué', () => {
        renderPage(DomainsIndex, defaultProps);

        expect(screen.getByText(/le trafic est intercepté et loggé/)).toBeInTheDocument();
        expect(screen.getByText(/l'accès est totalement interdit par l'agent/)).toBeInTheDocument();
    });

    it('shows page title "Domaines surveillés"', () => {
        renderPage(DomainsIndex, defaultProps);

        const layout = screen.getByTestId('layout');
        expect(layout.getAttribute('data-title')).toBe('Domaines surveillés');
    });

    it('renders "Modifier" and "Supprimer" action buttons', () => {
        renderPage(DomainsIndex, defaultProps);

        expect(screen.getAllByText('Modifier').length).toBe(2);
        expect(screen.getAllByText('Supprimer').length).toBe(2);
    });
});
