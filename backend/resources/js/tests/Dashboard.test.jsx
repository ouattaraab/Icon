import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage, resetPageProps } from './helpers';
import DashboardIndex from '../Pages/Dashboard/Index';

beforeEach(() => resetPageProps());

const defaultProps = {
    stats: {
        total_machines: 42,
        online_machines: 38,
        total_events: 1500,
        blocked_events: 120,
        open_alerts: 5,
        critical_alerts: 2,
        events_today: 80,
        blocked_today: 3,
        agent_version: '0.2.0',
    },
    activity24h: [],
    platformUsage: [
        { platform: 'chatgpt', count: 500 },
        { platform: 'claude', count: 300 },
    ],
    recentAlerts: [],
    topMachines: [],
    dailyEvents: [],
    departmentStats: [],
    dashboardConfig: null,
};

describe('Dashboard/Index', () => {
    it('renders stats cards', () => {
        renderPage(DashboardIndex, defaultProps);

        expect(screen.getByText('38')).toBeInTheDocument();
        expect(screen.getByText('1500')).toBeInTheDocument();
        expect(screen.getByText('120')).toBeInTheDocument();
    });

    it('renders platform usage bars', () => {
        renderPage(DashboardIndex, defaultProps);

        expect(screen.getByText('chatgpt')).toBeInTheDocument();
        expect(screen.getByText('claude')).toBeInTheDocument();
    });

    it('shows customize button', () => {
        renderPage(DashboardIndex, defaultProps);

        expect(screen.getByText('Personnaliser')).toBeInTheDocument();
    });

    it('renders department stats when present', () => {
        renderPage(DashboardIndex, {
            ...defaultProps,
            departmentStats: [
                { department: 'Marketing', machine_count: 10, event_count: 500, blocked_count: 20, alert_count: 3 },
                { department: 'Comptabilite', machine_count: 5, event_count: 200, blocked_count: 5, alert_count: 0 },
            ],
        });

        expect(screen.getByText('Activité par département (30j)')).toBeInTheDocument();
        expect(screen.getAllByText('Marketing').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Comptabilite').length).toBeGreaterThanOrEqual(1);
    });

    it('hides department stats when empty', () => {
        renderPage(DashboardIndex, defaultProps);

        expect(screen.queryByText('Activité par département (30j)')).not.toBeInTheDocument();
    });

    it('renders recent alerts when present', () => {
        renderPage(DashboardIndex, {
            ...defaultProps,
            recentAlerts: [
                { id: '1', severity: 'critical', title: 'Data leak', machine: 'PC-01', created_at: 'il y a 5 min' },
            ],
        });

        expect(screen.getByText('Data leak')).toBeInTheDocument();
    });

    it('shows daily events trend', () => {
        renderPage(DashboardIndex, {
            ...defaultProps,
            dailyEvents: [
                { date: '2026-02-10', total: 100, blocked: 5 },
                { date: '2026-02-11', total: 80, blocked: 10 },
            ],
        });

        expect(screen.getByText('Tendance sur 7 jours')).toBeInTheDocument();
    });

    it('renders top machines when present', () => {
        renderPage(DashboardIndex, {
            ...defaultProps,
            topMachines: [
                { machine_id: 'id1', hostname: 'SERVER-ALPHA', event_count: 250 },
            ],
        });

        expect(screen.getByText('SERVER-ALPHA')).toBeInTheDocument();
        expect(screen.getByText('250')).toBeInTheDocument();
    });

    it('shows agent version', () => {
        renderPage(DashboardIndex, defaultProps);

        expect(screen.getByText('0.2.0')).toBeInTheDocument();
    });

    it('respects dashboard config hiding widgets', () => {
        renderPage(DashboardIndex, {
            ...defaultProps,
            dashboardConfig: {
                widgets: [
                    { id: 'stats', visible: false, order: 0 },
                    { id: 'activity24h', visible: true, order: 1 },
                    { id: 'platformUsage', visible: true, order: 2 },
                    { id: 'dailyEvents', visible: true, order: 3 },
                    { id: 'departmentStats', visible: true, order: 4 },
                    { id: 'recentAlerts', visible: true, order: 5 },
                    { id: 'topMachines', visible: true, order: 6 },
                ],
            },
        });

        expect(screen.queryByText('Machines en ligne')).not.toBeInTheDocument();
    });
});
