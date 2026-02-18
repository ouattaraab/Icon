import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage, resetPageProps } from './helpers';
import SearchIndex from '../Pages/Search/Index';

beforeEach(() => resetPageProps());

const defaultProps = {
    query: 'test-query',
    results: {
        machines: [
            { id: 'm1', hostname: 'PC-DSI-01', os: 'windows', status: 'active', assigned_user: 'Jean', department: 'DSI' },
        ],
        alerts: [
            { id: 'a1', title: 'Alert test', severity: 'critical', status: 'open', machine: 'PC-DSI-01', created_at: '2025-01-15' },
        ],
    },
};

describe('Search/Index', () => {
    it('renders "resultat(s) pour" with query text', () => {
        renderPage(SearchIndex, defaultProps);

        expect(screen.getByText(/resultats? pour/)).toBeInTheDocument();
        expect(screen.getByText('test-query')).toBeInTheDocument();
    });

    it('shows machine hostname "PC-DSI-01"', () => {
        renderPage(SearchIndex, defaultProps);

        expect(screen.getByText('PC-DSI-01')).toBeInTheDocument();
    });

    it('shows machine user "Jean"', () => {
        renderPage(SearchIndex, defaultProps);

        expect(screen.getByText(/Jean/)).toBeInTheDocument();
    });

    it('shows alert title "Alert test"', () => {
        renderPage(SearchIndex, defaultProps);

        expect(screen.getByText('Alert test')).toBeInTheDocument();
    });

    it('shows empty state message when no query', () => {
        renderPage(SearchIndex, { query: '', results: {} });

        expect(screen.getByText('Saisissez un terme dans la barre de recherche ci-dessus.')).toBeInTheDocument();
    });

    it('renders machines section header', () => {
        renderPage(SearchIndex, defaultProps);

        expect(screen.getByText('Machines (1)')).toBeInTheDocument();
    });

    it('renders alerts section header', () => {
        renderPage(SearchIndex, defaultProps);

        expect(screen.getByText('Alertes (1)')).toBeInTheDocument();
    });
});
