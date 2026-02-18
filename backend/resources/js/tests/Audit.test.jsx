import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage, resetPageProps } from './helpers';
import AuditIndex from '../Pages/Audit/Index';

beforeEach(() => resetPageProps());

const defaultProps = {
    logs: {
        data: [
            {
                id: '1',
                user: { name: 'Admin', email: 'admin@gs2e.ci' },
                action: 'rule.created',
                target_type: 'Rule',
                target_id: 'abc12345-defg',
                details: { name: 'Test Rule' },
                ip_address: '192.168.1.1',
                created_at: '2025-01-15T10:30:00Z',
            },
            {
                id: '2',
                user: null,
                action: 'auth.login',
                target_type: null,
                target_id: null,
                details: null,
                ip_address: null,
                created_at: '2025-01-15T09:00:00Z',
            },
        ],
        current_page: 1,
        last_page: 1,
        total: 2,
    },
    actionTypes: ['rule.created', 'auth.login', 'alert.acknowledged'],
    users: [{ id: 'u1', name: 'Admin', email: 'admin@gs2e.ci' }],
    filters: {},
};

describe('Audit/Index', () => {
    it('renders audit log entries (user name "Admin")', () => {
        renderPage(AuditIndex, defaultProps);

        expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(1);
    });

    it('shows action labels ("Règle créée", "Connexion")', () => {
        renderPage(AuditIndex, defaultProps);

        expect(screen.getAllByText('Règle créée').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Connexion').length).toBeGreaterThanOrEqual(1);
    });

    it('shows "Système" for entries without a user', () => {
        renderPage(AuditIndex, defaultProps);

        expect(screen.getByText('Système')).toBeInTheDocument();
    });

    it('renders filter dropdowns ("Toutes les catégories", "Toutes les actions", "Tous les utilisateurs")', () => {
        renderPage(AuditIndex, defaultProps);

        expect(screen.getByText('Toutes les catégories')).toBeInTheDocument();
        expect(screen.getByText('Toutes les actions')).toBeInTheDocument();
        expect(screen.getByText('Tous les utilisateurs')).toBeInTheDocument();
    });

    it('shows total count "2 entrée(s)"', () => {
        renderPage(AuditIndex, defaultProps);

        expect(screen.getByText('2 entrée(s)')).toBeInTheDocument();
    });

    it('renders search input with placeholder', () => {
        renderPage(AuditIndex, defaultProps);

        expect(screen.getByPlaceholderText('Rechercher (cible, détails)...')).toBeInTheDocument();
    });

    it('renders "Rechercher" button', () => {
        renderPage(AuditIndex, defaultProps);

        expect(screen.getByText('Rechercher')).toBeInTheDocument();
    });

    it('shows page title "Journal d\'audit" via layout data-title', () => {
        renderPage(AuditIndex, defaultProps);

        const layout = screen.getByTestId('layout');
        expect(layout).toHaveAttribute('data-title', "Journal d'audit");
    });
});
