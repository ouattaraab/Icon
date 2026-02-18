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
import RulesEdit from '../Pages/Rules/Edit';

beforeEach(() => resetPageProps());

const defaultProps = {
    rule: {
        id: 'r1abcdef-1234-5678-9abc-def012345678', name: 'Block credentials', description: 'Block credential sharing',
        category: 'block', target: 'prompt', condition_type: 'keyword',
        condition_value: { keywords: ['password', 'secret'], match_all: false },
        action_config: { message: 'Blocked by admin' },
        priority: 100, enabled: true, version: 3,
    },
};

describe('Rules/Edit', () => {
    it('renders page title containing "Modifier"', () => {
        renderPage(RulesEdit, defaultProps);

        const layout = screen.getByTestId('layout');
        expect(layout.getAttribute('data-title')).toContain('Modifier');
    });

    it('shows rule name "Block credentials" in input', () => {
        renderPage(RulesEdit, defaultProps);

        expect(screen.getByDisplayValue('Block credentials')).toBeInTheDocument();
    });

    it('shows version number "3"', () => {
        renderPage(RulesEdit, defaultProps);

        expect(screen.getByText(/Version : 3/)).toBeInTheDocument();
    });

    it('shows rule ID (truncated)', () => {
        renderPage(RulesEdit, defaultProps);

        expect(screen.getByText(/r1abcdef\.\.\./)).toBeInTheDocument();
    });

    it('renders "Enregistrer" submit button', () => {
        renderPage(RulesEdit, defaultProps);

        const button = screen.getByText('Enregistrer');
        expect(button).toBeInTheDocument();
        expect(button.tagName).toBe('BUTTON');
        expect(button).toHaveAttribute('type', 'submit');
    });

    it('renders "Supprimer" delete button', () => {
        renderPage(RulesEdit, defaultProps);

        const button = screen.getByText('Supprimer');
        expect(button).toBeInTheDocument();
        expect(button.tagName).toBe('BUTTON');
        expect(button).toHaveAttribute('type', 'button');
    });

    it('renders "Annuler" cancel button', () => {
        renderPage(RulesEdit, defaultProps);

        const button = screen.getByText('Annuler');
        expect(button).toBeInTheDocument();
        expect(button.tagName).toBe('BUTTON');
    });

    it('shows enabled status badge as "Active"', () => {
        renderPage(RulesEdit, defaultProps);

        expect(screen.getByText('Active')).toBeInTheDocument();
    });
});
