import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage, resetPageProps, setPageProps } from './helpers';
import MachinesShow from '../Pages/Machines/Show';

beforeEach(() => resetPageProps());

const defaultProps = {
    machine: {
        id: 'abc-123-def-456',
        hostname: 'PC-DSI-01',
        os: 'windows',
        os_version: '11 Pro',
        agent_version: '0.2.0',
        status: 'active',
        ip_address: '192.168.1.50',
        department: 'DSI',
        assigned_user: 'Jean Dupont',
        last_heartbeat: new Date().toISOString(),
        created_at: '2026-01-15T10:00:00Z',
        events: [
            {
                id: 'e1', event_type: 'prompt', platform: 'chatgpt',
                domain: 'api.openai.com', severity: 'info',
                occurred_at: '2026-02-17T14:30:00Z',
            },
            {
                id: 'e2', event_type: 'block', platform: 'claude',
                domain: 'claude.ai', severity: 'warning',
                occurred_at: '2026-02-17T15:00:00Z',
            },
        ],
        tags: [
            { id: 't1', name: 'VIP', color: '#3b82f6' },
        ],
    },
    stats: {
        total_events: 150,
        blocked_events: 12,
        alerts_count: 3,
        platforms_used: ['chatgpt', 'claude'],
    },
    dailyActivity: [
        { date: '2026-02-10', total: 20, blocked: 2 },
        { date: '2026-02-11', total: 15, blocked: 0 },
    ],
    eventTypes: { prompt: 100, block: 12, response: 38 },
    alerts: [
        {
            id: 'a1', severity: 'critical', title: 'DLP Alert',
            description: 'Sensitive data detected', status: 'open',
            rule_name: 'Credential Detection', created_at: 'il y a 2h',
        },
    ],
    platformBreakdown: [
        { platform: 'chatgpt', total: 90, blocked: 5 },
        { platform: 'claude', total: 60, blocked: 7 },
    ],
    hourlyActivity: { 9: 25, 10: 40, 14: 35, 15: 20 },
    pendingCommands: [],
};

describe('Machines/Show', () => {
    it('renders machine hostname as title', () => {
        renderPage(MachinesShow, defaultProps);

        const layout = screen.getByTestId('layout');
        expect(layout.getAttribute('data-title')).toBe('PC-DSI-01');
    });

    it('renders OS info', () => {
        renderPage(MachinesShow, defaultProps);

        expect(screen.getByText(/windows 11 Pro/)).toBeInTheDocument();
    });

    it('renders stats cards', () => {
        renderPage(MachinesShow, defaultProps);

        expect(screen.getByText('150')).toBeInTheDocument();
    });

    it('renders machine info fields', () => {
        renderPage(MachinesShow, defaultProps);

        expect(screen.getByText('192.168.1.50')).toBeInTheDocument();
        expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    });

    it('renders event types distribution', () => {
        renderPage(MachinesShow, defaultProps);

        expect(screen.getByText(/Types d.evenements/)).toBeInTheDocument();
        expect(screen.getAllByText('Prompts').length).toBeGreaterThanOrEqual(1);
    });

    it('renders platform breakdown', () => {
        renderPage(MachinesShow, defaultProps);

        expect(screen.getByText('Usage par plateforme')).toBeInTheDocument();
    });

    it('renders events in table', () => {
        renderPage(MachinesShow, defaultProps);

        expect(screen.getByText('api.openai.com')).toBeInTheDocument();
        expect(screen.getByText('claude.ai')).toBeInTheDocument();
    });

    it('shows management buttons for managers', () => {
        renderPage(MachinesShow, defaultProps);

        expect(screen.getByText('Sync regles')).toBeInTheDocument();
        expect(screen.getByText('Redemarrer')).toBeInTheDocument();
    });

    it('hides management buttons for viewers', () => {
        setPageProps({ auth: { user: { role: 'viewer' }, is_admin: false, is_manager: false } });
        renderPage(MachinesShow, defaultProps);

        expect(screen.queryByText('Sync regles')).not.toBeInTheDocument();
        expect(screen.queryByText('Redemarrer')).not.toBeInTheDocument();
    });

    it('renders back button', () => {
        renderPage(MachinesShow, defaultProps);

        expect(screen.getByText(/Retour au parc machines/)).toBeInTheDocument();
    });

    it('renders daily activity chart', () => {
        renderPage(MachinesShow, defaultProps);

        expect(screen.getByText('Activite (14 derniers jours)')).toBeInTheDocument();
    });

    it('renders tab buttons', () => {
        renderPage(MachinesShow, defaultProps);

        expect(screen.getByRole('button', { name: /Evenements/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Alertes/ })).toBeInTheDocument();
    });

    it('renders machine tags', () => {
        renderPage(MachinesShow, defaultProps);

        expect(screen.getByText('VIP')).toBeInTheDocument();
    });

    it('renders hourly activity heatmap', () => {
        renderPage(MachinesShow, defaultProps);

        expect(screen.getByText('Activite par heure (7j)')).toBeInTheDocument();
    });

    it('shows pending commands banner', () => {
        renderPage(MachinesShow, {
            ...defaultProps,
            pendingCommands: [
                { type: 'force_sync_rules', issued_at: '2026-02-17T10:00:00Z' },
            ],
        });

        expect(screen.getByText(/1 commande en attente/)).toBeInTheDocument();
    });

    it('hides pending commands banner when empty', () => {
        renderPage(MachinesShow, defaultProps);

        expect(screen.queryByText(/commande en attente/)).not.toBeInTheDocument();
    });
});
