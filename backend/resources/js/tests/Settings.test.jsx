import { vi } from 'vitest';
vi.mock('@inertiajs/react', async () => {
    const React = require('react');
    return {
        Link: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children),
        router: { get: vi.fn(), post: vi.fn(), put: vi.fn(), visit: vi.fn(), delete: vi.fn() },
        usePage: () => ({
            props: globalThis.__INERTIA_PAGE_PROPS__ || {
                auth: { user: { name: 'Admin', email: 'admin@gs2e.ci', role: 'admin', id: 'u1' }, is_admin: true, is_manager: true },
                flash: {},
                unreadNotificationCount: 0,
            },
            url: '/',
        }),
        useForm: (initial) => ({
            data: { ...initial },
            setData: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            processing: false,
            errors: {},
            reset: vi.fn(),
            recentlySuccessful: false,
        }),
    };
});

import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage, resetPageProps } from './helpers';
import SettingsIndex from '../Pages/Settings/Index';

beforeEach(() => resetPageProps());

const defaultProps = {
    settings: {
        event_retention_days: 90,
        alert_retention_days: 365,
        offline_threshold_seconds: 180,
        max_batch_size: 100,
        agent_registration_key: 'icon-reg-key-2025',
        current_agent_version: '0.1.0',
        agent_download_url: 'https://icon.gs2e.ci/downloads/agent',
        verify_signatures: true,
        dlp_enabled: true,
        dlp_auto_alert: false,
        dlp_max_scan_length: 50000,
    },
};

describe('Settings/Index', () => {
    it('renders page title "Paramètres"', () => {
        renderPage(SettingsIndex, defaultProps);

        const layout = screen.getByTestId('layout');
        expect(layout).toHaveAttribute('data-title', 'Paramètres');
    });

    it('renders "Rétention des données" section', () => {
        renderPage(SettingsIndex, defaultProps);

        expect(screen.getByText('Rétention des données')).toBeInTheDocument();
    });

    it('renders "Configuration des agents" section', () => {
        renderPage(SettingsIndex, defaultProps);

        expect(screen.getByText('Configuration des agents')).toBeInTheDocument();
    });

    it('renders "Mise à jour des agents" section', () => {
        renderPage(SettingsIndex, defaultProps);

        expect(screen.getByText('Mise à jour des agents')).toBeInTheDocument();
    });

    it('renders "DLP (Prévention de fuite de données)" section', () => {
        renderPage(SettingsIndex, defaultProps);

        expect(screen.getByText('DLP (Prévention de fuite de données)')).toBeInTheDocument();
    });

    it('shows retention days values', () => {
        renderPage(SettingsIndex, defaultProps);

        const retentionEventInput = screen.getByDisplayValue('90');
        expect(retentionEventInput).toBeInTheDocument();

        const retentionAlertInput = screen.getByDisplayValue('365');
        expect(retentionAlertInput).toBeInTheDocument();
    });

    it('shows agent version "0.1.0"', () => {
        renderPage(SettingsIndex, defaultProps);

        expect(screen.getByDisplayValue('0.1.0')).toBeInTheDocument();
    });

    it('renders "Enregistrer les paramètres" submit button', () => {
        renderPage(SettingsIndex, defaultProps);

        expect(screen.getByText('Enregistrer les paramètres')).toBeInTheDocument();
    });

    it('shows registration key value', () => {
        renderPage(SettingsIndex, defaultProps);

        expect(screen.getByDisplayValue('icon-reg-key-2025')).toBeInTheDocument();
    });

    it('renders "Voir les versions" link to agent versions page', () => {
        renderPage(SettingsIndex, defaultProps);

        const link = screen.getByText(/Voir les versions/);
        expect(link).toBeInTheDocument();
        expect(link.getAttribute('href')).toBe('/settings/agent-versions');
    });
});
