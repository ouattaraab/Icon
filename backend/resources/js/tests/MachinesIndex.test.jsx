import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage, resetPageProps } from './helpers';
import MachinesIndex from '../Pages/Machines/Index';

beforeEach(() => resetPageProps());

const defaultProps = {
    machines: {
        data: [
            {
                id: 'm1', hostname: 'PC-DSI-01', os: 'windows', os_version: '11',
                agent_version: '0.1.0', status: 'active', last_heartbeat: 'il y a 2 min',
                department: 'DSI', tags: [{ id: 't1', name: 'Pilote', color: '#3b82f6' }],
            },
            {
                id: 'm2', hostname: 'MAC-DIR-01', os: 'macos', os_version: '14.2',
                agent_version: '0.1.0', status: 'offline', last_heartbeat: 'il y a 3h',
                department: 'Direction', tags: [],
            },
        ],
        current_page: 1, last_page: 1, total: 2,
    },
    filters: {},
    tags: [{ id: 't1', name: 'Pilote' }],
};

describe('Machines/Index', () => {
    it('renders machine hostnames', () => {
        renderPage(MachinesIndex, defaultProps);

        expect(screen.getByText('PC-DSI-01')).toBeInTheDocument();
        expect(screen.getByText('MAC-DIR-01')).toBeInTheDocument();
    });

    it('shows status badges (active, offline)', () => {
        renderPage(MachinesIndex, defaultProps);

        expect(screen.getByText('active')).toBeInTheDocument();
        expect(screen.getByText('offline')).toBeInTheDocument();
    });

    it('shows OS indicators (W for windows, M for macos)', () => {
        renderPage(MachinesIndex, defaultProps);

        expect(screen.getByText('W')).toBeInTheDocument();
        expect(screen.getByText('M')).toBeInTheDocument();
    });

    it('renders filter dropdowns', () => {
        renderPage(MachinesIndex, defaultProps);

        expect(screen.getByText('Tous les OS')).toBeInTheDocument();
        expect(screen.getByText('Tous les statuts')).toBeInTheDocument();
    });

    it('shows search input with placeholder', () => {
        renderPage(MachinesIndex, defaultProps);

        expect(screen.getByPlaceholderText('Rechercher (hostname, utilisateur)...')).toBeInTheDocument();
    });

    it('renders "Rechercher" button', () => {
        renderPage(MachinesIndex, defaultProps);

        expect(screen.getByText('Rechercher')).toBeInTheDocument();
    });

    it('shows machine count "2 machine(s)"', () => {
        renderPage(MachinesIndex, defaultProps);

        expect(screen.getByText('2 machine(s)')).toBeInTheDocument();
    });

    it('shows page title "Parc machines"', () => {
        renderPage(MachinesIndex, defaultProps);

        const layout = screen.getByTestId('layout');
        expect(layout.getAttribute('data-title')).toBe('Parc machines');
    });

    it('renders tag names ("Pilote")', () => {
        renderPage(MachinesIndex, defaultProps);

        // "Pilote" appears in both the tag badge and the tag filter dropdown
        expect(screen.getAllByText('Pilote').length).toBeGreaterThanOrEqual(1);
    });

    it('shows checkbox column for managers (bulk actions)', () => {
        renderPage(MachinesIndex, defaultProps);

        const checkboxes = screen.getAllByRole('checkbox');
        // 1 header "select all" checkbox + 2 per-row checkboxes = 3
        expect(checkboxes.length).toBe(3);
    });
});
