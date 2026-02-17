import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage, resetPageProps } from './helpers';
import ExchangesShow from '../Pages/Exchanges/Show';

beforeEach(() => resetPageProps());

const defaultProps = {
    exchange: {
        id: 'es-abc-123',
        platform: 'chatgpt',
        domain: 'api.openai.com',
        event_type: 'prompt',
        severity: 'info',
        prompt: 'Explique-moi le fonctionnement de notre systeme interne.',
        response: 'Voici une explication detaillee du systeme...',
        content_hash: 'abcdef1234567890abcdef1234567890',
        content_length: 250,
        occurred_at: '2026-02-17T14:30:00Z',
        matched_rules: [],
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
    event: null,
    matchedRuleNames: {},
};

describe('Exchanges/Show', () => {
    it('renders back button', () => {
        renderPage(ExchangesShow, defaultProps);

        expect(screen.getByText(/Retour/)).toBeInTheDocument();
    });

    it('renders platform badge', () => {
        renderPage(ExchangesShow, defaultProps);

        expect(screen.getByText('chatgpt')).toBeInTheDocument();
    });

    it('renders domain', () => {
        renderPage(ExchangesShow, defaultProps);

        expect(screen.getByText('api.openai.com')).toBeInTheDocument();
    });

    it('renders prompt content', () => {
        renderPage(ExchangesShow, defaultProps);

        expect(screen.getByText(/Explique-moi le fonctionnement/)).toBeInTheDocument();
    });

    it('renders response content', () => {
        renderPage(ExchangesShow, defaultProps);

        expect(screen.getByText(/Voici une explication/)).toBeInTheDocument();
    });

    it('renders machine hostname with link', () => {
        renderPage(ExchangesShow, defaultProps);

        expect(screen.getByText('PC-DSI-01')).toBeInTheDocument();
    });

    it('renders matched rules when present', () => {
        renderPage(ExchangesShow, {
            ...defaultProps,
            exchange: {
                ...defaultProps.exchange,
                matched_rules: ['rule-1'],
            },
            matchedRuleNames: { 'rule-1': 'Blocage donnees sensibles' },
        });

        expect(screen.getByText('Blocage donnees sensibles')).toBeInTheDocument();
    });

    it('renders DLP analysis when metadata has dlp_matches', () => {
        renderPage(ExchangesShow, {
            ...defaultProps,
            event: {
                id: 'evt-1',
                severity: 'critical',
                metadata: {
                    dlp_matches: {
                        credentials: ['password123', 'api_key_xyz'],
                    },
                },
            },
        });

        expect(screen.getByText(/Analyse DLP/)).toBeInTheDocument();
        expect(screen.getByText('password123')).toBeInTheDocument();
    });

    it('shows event type badge', () => {
        renderPage(ExchangesShow, defaultProps);

        expect(screen.getByText('Prompt')).toBeInTheDocument();
    });

    it('shows no content message when prompt and response are empty', () => {
        renderPage(ExchangesShow, {
            ...defaultProps,
            exchange: {
                ...defaultProps.exchange,
                prompt: null,
                response: null,
            },
        });

        expect(screen.getByText(/Aucun prompt/)).toBeInTheDocument();
        expect(screen.getByText(/Aucune reponse/)).toBeInTheDocument();
    });
});
