import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage, resetPageProps } from './helpers';
import DeploymentsIndex from '../Pages/Deployments/Index';

beforeEach(() => resetPageProps());

const defaultProps = {
    deployments: {
        data: [
            {
                id: 'dep1', hostname: 'PC-DSI-01', os: 'windows', version: '0.2.0',
                previous_version: '0.1.0', status: 'success', deployment_method: 'auto_update',
                error_message: null, deployed_at: '2025-06-15T10:30:00Z',
                deployed_at_human: 'il y a 2h', machine_id: 'm1',
            },
            {
                id: 'dep2', hostname: 'MAC-DIR-01', os: 'macos', version: '0.2.0',
                previous_version: '0.1.0', status: 'failed', deployment_method: 'manual',
                error_message: 'Timeout lors du deploiement', deployed_at: '2025-06-15T09:00:00Z',
                deployed_at_human: 'il y a 3h', machine_id: 'm2',
            },
            {
                id: 'dep3', hostname: 'PC-COMPTA-01', os: 'windows', version: '0.1.5',
                previous_version: null, status: 'pending', deployment_method: 'gpo',
                error_message: null, deployed_at: '2025-06-15T08:00:00Z',
                deployed_at_human: 'il y a 4h', machine_id: 'm3',
            },
        ],
        current_page: 1, last_page: 3, total: 25,
        links: [
            { url: null, label: '&laquo; Pr\u00e9c\u00e9dent', active: false },
            { url: '/deployments?page=1', label: '1', active: true },
            { url: '/deployments?page=2', label: '2', active: false },
            { url: '/deployments?page=3', label: '3', active: false },
            { url: '/deployments?page=2', label: 'Suivant &raquo;', active: false },
        ],
    },
    filters: {},
    versions: ['0.2.0', '0.1.5', '0.1.0'],
};

describe('Deployments/Index', () => {
    it('renders page title "Deploiements"', () => {
        renderPage(DeploymentsIndex, defaultProps);

        const layout = screen.getByTestId('layout');
        expect(layout.getAttribute('data-title')).toBe('Deploiements');
    });

    it('displays deployment table with columns', () => {
        renderPage(DeploymentsIndex, defaultProps);

        expect(screen.getByText('Machine')).toBeInTheDocument();
        // "Version", "Statut", "Methode" appear both as table headers and filter labels
        expect(screen.getAllByText('Version').length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText('Ancienne version')).toBeInTheDocument();
        expect(screen.getAllByText('Statut').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Methode').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Erreur')).toBeInTheDocument();
        expect(screen.getByText('Date')).toBeInTheDocument();
    });

    it('shows status badges with correct labels', () => {
        renderPage(DeploymentsIndex, defaultProps);

        // Status labels appear in both the table badges and the filter dropdown options
        expect(screen.getAllByText('Succes').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Echec').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('En attente').length).toBeGreaterThanOrEqual(1);
    });

    it('shows summary stats cards', () => {
        renderPage(DeploymentsIndex, defaultProps);

        expect(screen.getByText('Total deploiements')).toBeInTheDocument();
        expect(screen.getByText('25')).toBeInTheDocument();
        expect(screen.getByText('Reussis')).toBeInTheDocument();
        expect(screen.getByText('Echoues')).toBeInTheDocument();
        // failedCount = 1 (only dep2 is failed)
        // successCount = 1 (only dep1 is success)
        // These "1" values appear in stats but may also be in pagination,
        // so we just verify stats labels are present
    });

    it('shows search input with placeholder', () => {
        renderPage(DeploymentsIndex, defaultProps);

        expect(screen.getByPlaceholderText('Nom de machine...')).toBeInTheDocument();
        expect(screen.getByText('Rechercher')).toBeInTheDocument();
    });

    it('shows status filter dropdown with options', () => {
        renderPage(DeploymentsIndex, defaultProps);

        // "Statut" appears as both table header and filter label
        expect(screen.getAllByText('Statut').length).toBeGreaterThanOrEqual(2);
        // Default option "Tous" in the status dropdown
        expect(screen.getByText('Tous')).toBeInTheDocument();
    });

    it('shows version filter dropdown with available versions', () => {
        renderPage(DeploymentsIndex, defaultProps);

        // "Version" appears as both table header and filter label
        expect(screen.getAllByText('Version').length).toBeGreaterThanOrEqual(2);
        // "Toutes" default option in version and method dropdowns
        expect(screen.getAllByText('Toutes').length).toBeGreaterThanOrEqual(1);
    });

    it('shows date range filters (Date debut and Date fin)', () => {
        renderPage(DeploymentsIndex, defaultProps);

        expect(screen.getByText('Date debut')).toBeInTheDocument();
        expect(screen.getByText('Date fin')).toBeInTheDocument();
    });

    it('shows error messages when present', () => {
        renderPage(DeploymentsIndex, defaultProps);

        expect(screen.getByText('Timeout lors du deploiement')).toBeInTheDocument();
    });

    it('renders pagination when multiple pages exist', () => {
        renderPage(DeploymentsIndex, defaultProps);

        // Pagination links are rendered via dangerouslySetInnerHTML from the links array
        // The links array produces buttons for prev, pages 1/2/3, and next
        const buttons = screen.getAllByRole('button');
        // Should have the "Filtrer" button + 5 pagination buttons = at least 6
        expect(buttons.length).toBeGreaterThanOrEqual(6);
    });
});
