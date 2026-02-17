import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage, resetPageProps } from './helpers';
import AgentVersions from '../Pages/Settings/AgentVersions';

beforeEach(() => resetPageProps());

const defaultProps = {
    targetVersion: '1.3.0',
    updateUrl: 'https://updates.gs2e.ci/agent/latest',
    versionDistribution: [
        { version: '1.3.0', count: 45, is_current: true },
        { version: '1.2.1', count: 12, is_current: false },
        { version: '1.1.0', count: 3, is_current: false },
    ],
    totalMachines: 60,
    upToDate: 45,
    outdated: 15,
    outdatedMachines: [
        {
            id: 'm1',
            hostname: 'PC-COMPTA-01',
            os: 'windows',
            agent_version: '1.2.1',
            status: 'online',
            last_heartbeat: 'il y a 2 min',
            department: 'Comptabilité',
        },
        {
            id: 'm2',
            hostname: 'MAC-DSI-03',
            os: 'macos',
            agent_version: '1.1.0',
            status: 'offline',
            last_heartbeat: 'il y a 3 jours',
            department: 'DSI',
        },
    ],
};

describe('Settings/AgentVersions', () => {
    it('renders back link to settings', () => {
        renderPage(AgentVersions, defaultProps);

        expect(screen.getByText(/Retour aux paramètres/)).toBeInTheDocument();
    });

    it('renders summary stat cards', () => {
        renderPage(AgentVersions, defaultProps);

        expect(screen.getByText('60')).toBeInTheDocument();
        expect(screen.getByText('45')).toBeInTheDocument();
        expect(screen.getByText('15')).toBeInTheDocument();
        expect(screen.getByText('Total machines')).toBeInTheDocument();
    });

    it('renders target version', () => {
        renderPage(AgentVersions, defaultProps);

        expect(screen.getAllByText(/v1\.3\.0/).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Version cible')).toBeInTheDocument();
    });

    it('renders update URL when provided', () => {
        renderPage(AgentVersions, defaultProps);

        expect(screen.getByText('https://updates.gs2e.ci/agent/latest')).toBeInTheDocument();
    });

    it('hides update URL when empty', () => {
        renderPage(AgentVersions, { ...defaultProps, updateUrl: '' });

        expect(screen.queryByText('URL de mise à jour')).not.toBeInTheDocument();
    });

    it('renders version distribution bars', () => {
        renderPage(AgentVersions, defaultProps);

        expect(screen.getByText('Distribution des versions')).toBeInTheDocument();
        expect(screen.getByText(/v1\.2\.1/)).toBeInTheDocument();
        expect(screen.getByText(/v1\.1\.0/)).toBeInTheDocument();
    });

    it('shows "Cible" badge on current version', () => {
        renderPage(AgentVersions, defaultProps);

        expect(screen.getByText('Cible')).toBeInTheDocument();
    });

    it('shows empty message when no machines', () => {
        renderPage(AgentVersions, {
            ...defaultProps,
            versionDistribution: [],
        });

        expect(screen.getByText('Aucune machine enregistrée.')).toBeInTheDocument();
    });

    it('renders outdated machines table', () => {
        renderPage(AgentVersions, defaultProps);

        expect(screen.getByText('PC-COMPTA-01')).toBeInTheDocument();
        expect(screen.getByText('MAC-DSI-03')).toBeInTheDocument();
        expect(screen.getByText('Comptabilité')).toBeInTheDocument();
        expect(screen.getByText('DSI')).toBeInTheDocument();
    });

    it('renders OS labels correctly', () => {
        renderPage(AgentVersions, defaultProps);

        expect(screen.getByText('Windows')).toBeInTheDocument();
        expect(screen.getByText('macOS')).toBeInTheDocument();
    });

    it('renders machine status indicators', () => {
        renderPage(AgentVersions, defaultProps);

        expect(screen.getByText('En ligne')).toBeInTheDocument();
        expect(screen.getByText('Hors ligne')).toBeInTheDocument();
    });

    it('renders version badges for outdated machines', () => {
        renderPage(AgentVersions, defaultProps);

        expect(screen.getByText('1.2.1')).toBeInTheDocument();
        expect(screen.getByText('1.1.0')).toBeInTheDocument();
    });

    it('renders last heartbeat info', () => {
        renderPage(AgentVersions, defaultProps);

        expect(screen.getByText('il y a 2 min')).toBeInTheDocument();
        expect(screen.getByText('il y a 3 jours')).toBeInTheDocument();
    });
});
