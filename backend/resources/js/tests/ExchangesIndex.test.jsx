import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage, resetPageProps } from './helpers';
import ExchangesIndex from '../Pages/Exchanges/Index';

beforeEach(() => resetPageProps());

const defaultProps = {
    exchanges: [
        {
            id: 'e1', platform: 'chatgpt', severity: 'warning',
            prompt: 'Quel est le mot de passe admin?',
            response: 'Je ne peux pas vous donner un mot de passe.',
            machine_hostname: 'PC-DSI-01',
            occurred_at: '15/01/2025 10:30',
        },
        {
            id: 'e2', platform: 'claude', severity: 'info',
            prompt: 'Explique-moi React.',
            response: null,
            machine_hostname: 'MAC-DIR-01',
            occurred_at: '15/01/2025 09:00',
        },
    ],
    total: 2,
    page: 1,
    perPage: 20,
    totalPages: 1,
    filters: {},
    machines: [{ id: 'm1', hostname: 'PC-DSI-01' }, { id: 'm2', hostname: 'MAC-DIR-01' }],
};

describe('Exchanges/Index', () => {
    it('renders exchange cards with platform names', () => {
        renderPage(ExchangesIndex, defaultProps);

        expect(screen.getByText('chatgpt')).toBeInTheDocument();
        expect(screen.getByText('claude')).toBeInTheDocument();
    });

    it('shows prompt text', () => {
        renderPage(ExchangesIndex, defaultProps);

        expect(screen.getByText('Quel est le mot de passe admin?')).toBeInTheDocument();
    });

    it('shows machine hostname', () => {
        renderPage(ExchangesIndex, defaultProps);

        // "PC-DSI-01" appears in both the exchange card and the machine filter dropdown
        expect(screen.getAllByText('PC-DSI-01').length).toBeGreaterThanOrEqual(1);
    });

    it('renders search input with placeholder about prompts', () => {
        renderPage(ExchangesIndex, defaultProps);

        expect(screen.getByPlaceholderText('Rechercher dans les prompts et réponses...')).toBeInTheDocument();
    });

    it('shows total "2 résultats"', () => {
        renderPage(ExchangesIndex, defaultProps);

        expect(screen.getByText('2 résultats')).toBeInTheDocument();
    });

    it('renders filter dropdowns', () => {
        renderPage(ExchangesIndex, defaultProps);

        expect(screen.getByText('Toutes les plateformes')).toBeInTheDocument();
        expect(screen.getByText('Toutes les sévérités')).toBeInTheDocument();
        expect(screen.getByText('Toutes les machines')).toBeInTheDocument();
    });

    it('renders "Exporter CSV" link', () => {
        renderPage(ExchangesIndex, defaultProps);

        expect(screen.getByText('Exporter CSV')).toBeInTheDocument();
    });

    it('renders "Rechercher" button', () => {
        renderPage(ExchangesIndex, defaultProps);

        expect(screen.getByText('Rechercher')).toBeInTheDocument();
    });

    it('shows page title "Historique des échanges"', () => {
        renderPage(ExchangesIndex, defaultProps);

        const layout = screen.getByTestId('layout');
        expect(layout.getAttribute('data-title')).toBe('Historique des échanges');
    });

    it('shows empty state when no exchanges', () => {
        renderPage(ExchangesIndex, {
            ...defaultProps,
            exchanges: [],
            total: 0,
        });

        expect(screen.getByText('Aucun échange enregistré.')).toBeInTheDocument();
    });
});
