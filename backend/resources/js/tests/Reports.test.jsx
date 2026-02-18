import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage, resetPageProps } from './helpers';
import ReportsIndex from '../Pages/Reports/Index';

beforeEach(() => resetPageProps());

const defaultProps = {
    stats: {
        total_machines: 42, online_machines: 35,
        total_events: 1250, blocked_events: 89,
        open_alerts: 12, critical_alerts: 3,
    },
    platformUsage: [
        { platform: 'ChatGPT', count: 500 },
        { platform: 'Claude', count: 300 },
    ],
    alertsTrend: [],
    topMachines: [
        { machine_id: 'm1', machine: { hostname: 'PC-DSI-01', assigned_user: null }, event_count: 150 },
    ],
    eventTypes: [
        { event_type: 'prompt', count: 800 },
        { event_type: 'block', count: 89 },
    ],
    dailyEvents: [],
    severityDistribution: [
        { severity: 'info', count: 900 },
        { severity: 'warning', count: 250 },
        { severity: 'critical', count: 100 },
    ],
    departmentStats: [
        { department: 'DSI', machine_count: 10, event_count: 500, blocked_count: 5, alert_count: 5 },
    ],
    filters: {},
};

describe('Reports/Index', () => {
    it('renders page title "Rapports & Statistiques"', () => {
        renderPage(ReportsIndex, defaultProps);

        const layout = screen.getByTestId('layout');
        expect(layout).toHaveAttribute('data-title', 'Rapports & Statistiques');
    });

    it('shows stat cards with values', () => {
        renderPage(ReportsIndex, defaultProps);

        expect(screen.getByText('42')).toBeInTheDocument();
        expect(screen.getByText('35')).toBeInTheDocument();
        expect(screen.getByText('1250')).toBeInTheDocument();
        expect(screen.getByText('89')).toBeInTheDocument();
        expect(screen.getByText('12')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('shows stat labels', () => {
        renderPage(ReportsIndex, defaultProps);

        expect(screen.getByText('Machines actives')).toBeInTheDocument();
        expect(screen.getByText('En ligne')).toBeInTheDocument();
        expect(screen.getAllByText(/v\u00e9nements/).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Blocages').length).toBeGreaterThanOrEqual(1);
    });

    it('shows platform usage (ChatGPT, Claude)', () => {
        renderPage(ReportsIndex, defaultProps);

        expect(screen.getByText('ChatGPT')).toBeInTheDocument();
        expect(screen.getByText('Claude')).toBeInTheDocument();
    });

    it('shows top machine hostname (PC-DSI-01)', () => {
        renderPage(ReportsIndex, defaultProps);

        expect(screen.getByText('PC-DSI-01')).toBeInTheDocument();
    });

    it('shows department name (DSI)', () => {
        renderPage(ReportsIndex, defaultProps);

        expect(screen.getByText('DSI')).toBeInTheDocument();
    });

    it('renders date filter inputs', () => {
        renderPage(ReportsIndex, defaultProps);

        const dateInputs = screen.getAllByDisplayValue('');
        const dateTypeInputs = dateInputs.filter((el) => el.getAttribute('type') === 'date');
        expect(dateTypeInputs.length).toBeGreaterThanOrEqual(2);
    });

    it('renders "Appliquer" button', () => {
        renderPage(ReportsIndex, defaultProps);

        expect(screen.getByText('Appliquer')).toBeInTheDocument();
    });

    it('renders export buttons', () => {
        renderPage(ReportsIndex, defaultProps);

        expect(screen.getByText(/CSV.*nements/)).toBeInTheDocument();
        expect(screen.getByText(/CSV alertes/)).toBeInTheDocument();
        expect(screen.getByText(/CSV machines/)).toBeInTheDocument();
        expect(screen.getByText('PDF Rapport')).toBeInTheDocument();
    });

    it('shows severity distribution labels', () => {
        renderPage(ReportsIndex, defaultProps);

        expect(screen.getByText('info')).toBeInTheDocument();
        expect(screen.getAllByText('warning').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('critical').length).toBeGreaterThanOrEqual(1);
    });
});
