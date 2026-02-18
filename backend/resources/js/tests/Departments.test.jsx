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
    };
});

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderPage, resetPageProps } from './helpers';
import DepartmentsIndex from '../Pages/Departments/Index';

beforeEach(() => resetPageProps());

const defaultProps = {
    departments: {
        data: [
            {
                id: 'd1', name: 'DSI', description: 'Direction des systemes', manager_name: 'Jean Dupont',
                machine_count: 5,
            },
            {
                id: 'd2', name: 'RH', description: 'Ressources humaines', manager_name: 'Marie Kouame',
                machine_count: 0,
            },
        ],
        current_page: 1, last_page: 3, total: 12,
    },
    machines: [
        { id: 'm1', hostname: 'PC-DSI-01', department_id: 'd1' },
        { id: 'm2', hostname: 'PC-RH-01', department_id: null },
    ],
    filters: {},
};

describe('Departments/Index', () => {
    it('renders page title "Departements"', () => {
        renderPage(DepartmentsIndex, defaultProps);

        const layout = screen.getByTestId('layout');
        expect(layout.getAttribute('data-title')).toContain('partements');
    });

    it('displays departments in table', () => {
        renderPage(DepartmentsIndex, defaultProps);

        expect(screen.getByText('DSI')).toBeInTheDocument();
        expect(screen.getByText('RH')).toBeInTheDocument();
        expect(screen.getByText('Direction des systemes')).toBeInTheDocument();
        expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    });

    it('shows machine count per department', () => {
        renderPage(DepartmentsIndex, defaultProps);

        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('shows search input with placeholder and Rechercher button', () => {
        renderPage(DepartmentsIndex, defaultProps);

        expect(screen.getByPlaceholderText('Rechercher (nom, responsable)...')).toBeInTheDocument();
        expect(screen.getByText('Rechercher')).toBeInTheDocument();
    });

    it('shows "+ Ajouter" button for managers/admins', () => {
        renderPage(DepartmentsIndex, defaultProps);

        expect(screen.getByText('+ Ajouter')).toBeInTheDocument();
    });

    it('opens create modal when clicking "+ Ajouter"', () => {
        renderPage(DepartmentsIndex, defaultProps);

        fireEvent.click(screen.getByText('+ Ajouter'));

        expect(screen.getByText('Nouveau d\u00e9partement')).toBeInTheDocument();
        expect(screen.getByText('Nom *')).toBeInTheDocument();
        // "Description" appears both as table header and modal label
        expect(screen.getAllByText('Description').length).toBeGreaterThanOrEqual(2);
        // "Responsable" appears both as table header and modal label
        expect(screen.getAllByText('Responsable').length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText('Cr\u00e9er')).toBeInTheDocument();
    });

    it('opens edit modal when clicking "Modifier"', () => {
        renderPage(DepartmentsIndex, defaultProps);

        const modifierButtons = screen.getAllByText('Modifier');
        fireEvent.click(modifierButtons[0]);

        expect(screen.getByText('Modifier le d\u00e9partement')).toBeInTheDocument();
        expect(screen.getByText('Mettre \u00e0 jour')).toBeInTheDocument();
    });

    it('has delete button disabled when machines are assigned', () => {
        renderPage(DepartmentsIndex, defaultProps);

        const supprimerButtons = screen.getAllByText('Supprimer');
        // DSI has machine_count=5, so its Supprimer button should be disabled
        expect(supprimerButtons[0]).toBeDisabled();
        // RH has machine_count=0, so its Supprimer button should be enabled
        expect(supprimerButtons[1]).not.toBeDisabled();
    });

    it('shows "Assigner" button for each department', () => {
        renderPage(DepartmentsIndex, defaultProps);

        const assignerButtons = screen.getAllByText('Assigner');
        expect(assignerButtons.length).toBe(2);
    });

    it('renders pagination when multiple pages exist', () => {
        renderPage(DepartmentsIndex, defaultProps);

        // Pagination prev/next and page number buttons are rendered
        expect(screen.getByText('Suiv.')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThanOrEqual(5);
    });

    it('shows total department count', () => {
        renderPage(DepartmentsIndex, defaultProps);

        // The total count "12" and "département(s)" are rendered within the same span
        expect(screen.getByText(/12/)).toBeInTheDocument();
        expect(screen.getByText(/partement\(s\)/)).toBeInTheDocument();
    });
});
