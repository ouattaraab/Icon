import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage, resetPageProps } from './helpers';
import AlertsIndex from '../Pages/Alerts/Index';

beforeEach(() => resetPageProps());

const defaultProps = {
    alerts: {
        data: [
            {
                id: '1',
                severity: 'critical',
                title: 'Credential leak detected',
                status: 'open',
                machine: { hostname: 'PC-DSI-01' },
                rule: { name: 'DLP Credentials' },
            },
            {
                id: '2',
                severity: 'warning',
                title: 'Unusual AI usage volume',
                status: 'acknowledged',
                machine: { hostname: 'PC-FIN-02' },
                rule: null,
            },
        ],
    },
    openCount: 7,
    criticalCount: 3,
    filters: {},
};

describe('Alerts/Index', () => {
    it('renders alert list', () => {
        renderPage(AlertsIndex, defaultProps);

        expect(screen.getByText('Credential leak detected')).toBeInTheDocument();
        expect(screen.getByText('Unusual AI usage volume')).toBeInTheDocument();
    });

    it('shows open and critical counts', () => {
        renderPage(AlertsIndex, defaultProps);

        expect(screen.getByText('7')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('shows machine hostname', () => {
        renderPage(AlertsIndex, defaultProps);

        expect(screen.getByText(/PC-DSI-01/)).toBeInTheDocument();
    });

    it('shows rule name', () => {
        renderPage(AlertsIndex, defaultProps);

        expect(screen.getByText(/DLP Credentials/)).toBeInTheDocument();
    });

    it('renders action buttons for open alerts', () => {
        renderPage(AlertsIndex, defaultProps);

        expect(screen.getByText('Acquitter')).toBeInTheDocument();
        expect(screen.getByText('Résoudre')).toBeInTheDocument();
    });

    it('hides action buttons for non-open alerts', () => {
        renderPage(AlertsIndex, {
            ...defaultProps,
            alerts: {
                data: [
                    {
                        id: '2',
                        severity: 'warning',
                        title: 'Resolved alert',
                        status: 'resolved',
                        machine: { hostname: 'PC-01' },
                        rule: null,
                    },
                ],
            },
        });

        expect(screen.queryByText('Acquitter')).not.toBeInTheDocument();
    });

    it('renders filter dropdowns', () => {
        renderPage(AlertsIndex, defaultProps);

        expect(screen.getByText('Tous les statuts')).toBeInTheDocument();
        expect(screen.getByText('Toutes les sévérités')).toBeInTheDocument();
    });

    it('renders CSV export link', () => {
        renderPage(AlertsIndex, defaultProps);

        expect(screen.getByText('Exporter CSV')).toBeInTheDocument();
    });

    it('export link includes filters', () => {
        renderPage(AlertsIndex, {
            ...defaultProps,
            filters: { status: 'open', severity: 'critical' },
        });

        const exportLink = screen.getByText('Exporter CSV');
        expect(exportLink.getAttribute('href')).toContain('status=open');
        expect(exportLink.getAttribute('href')).toContain('severity=critical');
    });

    it('shows severity labels', () => {
        renderPage(AlertsIndex, defaultProps);

        expect(screen.getAllByText('Critique').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Attention').length).toBeGreaterThanOrEqual(1);
    });

    it('shows status labels', () => {
        renderPage(AlertsIndex, defaultProps);

        expect(screen.getByText('Ouverte')).toBeInTheDocument();
        expect(screen.getByText('Prise en charge')).toBeInTheDocument();
    });
});
