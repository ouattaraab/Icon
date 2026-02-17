import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage, resetPageProps, setPageProps } from './helpers';
import AlertsShow from '../Pages/Alerts/Show';

beforeEach(() => resetPageProps());

const defaultProps = {
    alert: {
        id: 'alert-1',
        severity: 'critical',
        title: 'Donnees sensibles detectees',
        description: 'Un mot de passe a ete envoye dans un prompt ChatGPT.',
        status: 'open',
        created_at: '2026-02-17T14:30:00Z',
        created_at_human: 'il y a 2h',
        acknowledged_at: null,
        acknowledged_at_human: null,
        acknowledged_by_name: null,
        event_id: 'evt-1',
        event: {
            id: 'evt-1',
            event_type: 'block',
            platform: 'chatgpt',
            domain: 'api.openai.com',
            severity: 'critical',
            elasticsearch_id: 'es-123',
            occurred_at: '2026-02-17T14:30:00Z',
        },
        machine: {
            id: 'm1',
            hostname: 'PC-DSI-01',
            os: 'windows',
            os_version: '11 Pro',
            department: 'DSI',
            assigned_user: 'Jean Dupont',
            status: 'active',
        },
        rule: {
            id: 'r1',
            name: 'Detection mots de passe',
            category: 'block',
            target: 'prompt',
            condition_type: 'regex',
        },
    },
    relatedAlerts: [
        {
            id: 'alert-2', severity: 'warning', title: 'Contenu long detecte',
            status: 'resolved', rule_name: 'Limite longueur', created_at: 'il y a 1j',
        },
    ],
};

describe('Alerts/Show', () => {
    it('renders back button', () => {
        renderPage(AlertsShow, defaultProps);

        expect(screen.getByText(/Retour aux alertes/)).toBeInTheDocument();
    });

    it('renders alert title', () => {
        renderPage(AlertsShow, defaultProps);

        expect(screen.getByText('Donnees sensibles detectees')).toBeInTheDocument();
    });

    it('renders alert description', () => {
        renderPage(AlertsShow, defaultProps);

        expect(screen.getByText(/mot de passe a ete envoye/)).toBeInTheDocument();
    });

    it('renders severity badge', () => {
        renderPage(AlertsShow, defaultProps);

        expect(screen.getAllByText('Critique').length).toBeGreaterThanOrEqual(1);
    });

    it('renders status badge', () => {
        renderPage(AlertsShow, defaultProps);

        expect(screen.getByText('Ouverte')).toBeInTheDocument();
    });

    it('renders machine info', () => {
        renderPage(AlertsShow, defaultProps);

        expect(screen.getByText('PC-DSI-01')).toBeInTheDocument();
        expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    });

    it('renders rule info', () => {
        renderPage(AlertsShow, defaultProps);

        expect(screen.getByText('Detection mots de passe')).toBeInTheDocument();
        expect(screen.getByText('Blocage')).toBeInTheDocument();
    });

    it('renders event info', () => {
        renderPage(AlertsShow, defaultProps);

        expect(screen.getByText('api.openai.com')).toBeInTheDocument();
        expect(screen.getByText('chatgpt')).toBeInTheDocument();
    });

    it('shows action buttons for managers on open alerts', () => {
        renderPage(AlertsShow, defaultProps);

        expect(screen.getByText('Acquitter')).toBeInTheDocument();
        expect(screen.getAllByText('Resoudre').length).toBeGreaterThanOrEqual(1);
    });

    it('hides action buttons for viewers', () => {
        setPageProps({ auth: { user: { role: 'viewer' }, is_admin: false, is_manager: false } });
        renderPage(AlertsShow, defaultProps);

        expect(screen.queryByText('Acquitter')).not.toBeInTheDocument();
    });

    it('renders related alerts', () => {
        renderPage(AlertsShow, defaultProps);

        expect(screen.getByText('Contenu long detecte')).toBeInTheDocument();
    });

    it('renders timeline with creation date', () => {
        renderPage(AlertsShow, defaultProps);

        expect(screen.getByText('Creee')).toBeInTheDocument();
        expect(screen.getByText('il y a 2h')).toBeInTheDocument();
    });

    it('shows exchange link when event has elasticsearch_id', () => {
        renderPage(AlertsShow, defaultProps);

        expect(screen.getByText("Voir l'echange")).toBeInTheDocument();
    });
});
