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
import RulesCreate from '../Pages/Rules/Create';

beforeEach(() => resetPageProps());

describe('Rules/Create', () => {
    it('renders page title "Nouvelle règle"', () => {
        renderPage(RulesCreate);

        const layout = screen.getByTestId('layout');
        expect(layout).toHaveAttribute('data-title', 'Nouvelle règle');
    });

    it('renders "Nom de la règle" label with input', () => {
        renderPage(RulesCreate);

        expect(screen.getByText('Nom de la règle')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Bloquer génération cahier des charges/)).toBeInTheDocument();
    });

    it('renders category select with options (Bloquer, Alerter, Journaliser)', () => {
        renderPage(RulesCreate);

        expect(screen.getByText('Catégorie (action)')).toBeInTheDocument();
        expect(screen.getByText('Bloquer')).toBeInTheDocument();
        expect(screen.getByText('Alerter')).toBeInTheDocument();
        expect(screen.getByText('Journaliser')).toBeInTheDocument();
    });

    it('renders target select with options (Prompt, Réponse IA, Presse-papier, Domaine)', () => {
        renderPage(RulesCreate);

        expect(screen.getByText('Cible')).toBeInTheDocument();
        expect(screen.getByText('Prompt (requête utilisateur)')).toBeInTheDocument();
        expect(screen.getByText('Réponse IA')).toBeInTheDocument();
        expect(screen.getByText('Presse-papier')).toBeInTheDocument();
        expect(screen.getByText('Domaine')).toBeInTheDocument();
    });

    it('renders condition type select with all options', () => {
        renderPage(RulesCreate);

        expect(screen.getByText('Type de condition')).toBeInTheDocument();
        expect(screen.getByText('Mots-clés')).toBeInTheDocument();
        expect(screen.getByText('Expression régulière')).toBeInTheDocument();
        expect(screen.getByText('Liste de domaines')).toBeInTheDocument();
        expect(screen.getByText('Longueur du contenu')).toBeInTheDocument();
    });

    it('renders priority input', () => {
        renderPage(RulesCreate);

        expect(screen.getByText(/Priorité/)).toBeInTheDocument();
        const priorityInput = screen.getByDisplayValue('50');
        expect(priorityInput).toBeInTheDocument();
        expect(priorityInput).toHaveAttribute('type', 'number');
    });

    it('renders "Créer la règle" submit button', () => {
        renderPage(RulesCreate);

        const button = screen.getByText('Créer la règle');
        expect(button).toBeInTheDocument();
        expect(button.tagName).toBe('BUTTON');
        expect(button).toHaveAttribute('type', 'submit');
    });

    it('renders description textarea', () => {
        renderPage(RulesCreate);

        expect(screen.getByText('Description')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Description optionnelle/)).toBeInTheDocument();
    });
});
