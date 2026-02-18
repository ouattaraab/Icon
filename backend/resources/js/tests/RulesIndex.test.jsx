import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage, resetPageProps } from './helpers';
import RulesIndex from '../Pages/Rules/Index';

beforeEach(() => resetPageProps());

const defaultProps = {
    rules: {
        data: [
            {
                id: 'r1', name: 'Block credentials', description: 'Block credential sharing',
                category: 'block', target: 'prompt', condition_type: 'keyword',
                priority: 100, enabled: true, version: 3,
            },
            {
                id: 'r2', name: 'Alert long prompts', description: 'Alert on long prompts',
                category: 'alert', target: 'prompt', condition_type: 'content_length',
                priority: 50, enabled: false, version: 1,
            },
        ],
        current_page: 1, last_page: 1, total: 2,
    },
};

describe('Rules/Index', () => {
    it('renders rule names', () => {
        renderPage(RulesIndex, defaultProps);

        expect(screen.getByText('Block credentials')).toBeInTheDocument();
        expect(screen.getByText('Alert long prompts')).toBeInTheDocument();
    });

    it('shows category labels (block, alert)', () => {
        renderPage(RulesIndex, defaultProps);

        expect(screen.getByText('block')).toBeInTheDocument();
        expect(screen.getByText('alert')).toBeInTheDocument();
    });

    it('shows enabled/disabled status (Actif, Inactif)', () => {
        renderPage(RulesIndex, defaultProps);

        expect(screen.getByText('Actif')).toBeInTheDocument();
        expect(screen.getByText('Inactif')).toBeInTheDocument();
    });

    it('renders priority values (100, 50)', () => {
        renderPage(RulesIndex, defaultProps);

        expect(screen.getByText('100')).toBeInTheDocument();
        expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('shows rule count "2 règle(s) configurée(s)"', () => {
        renderPage(RulesIndex, defaultProps);

        expect(screen.getByText(/2 règle\(s\) configurée\(s\)/)).toBeInTheDocument();
    });

    it('renders "Nouvelle règle" button as a link', () => {
        renderPage(RulesIndex, defaultProps);

        const link = screen.getByText(/Nouvelle règle/);
        expect(link).toBeInTheDocument();
        expect(link.closest('a')).toHaveAttribute('href', '/rules/create');
    });

    it('renders "Export JSON" button', () => {
        renderPage(RulesIndex, defaultProps);

        expect(screen.getByText('Export JSON')).toBeInTheDocument();
    });

    it('renders "Import JSON" button', () => {
        renderPage(RulesIndex, defaultProps);

        expect(screen.getByText('Import JSON')).toBeInTheDocument();
    });

    it('renders "Modifier" link for each rule', () => {
        renderPage(RulesIndex, defaultProps);

        const modifierLinks = screen.getAllByText('Modifier');
        expect(modifierLinks).toHaveLength(2);
        expect(modifierLinks[0].closest('a')).toHaveAttribute('href', '/rules/r1/edit');
        expect(modifierLinks[1].closest('a')).toHaveAttribute('href', '/rules/r2/edit');
    });

    it('shows page title "Gestion des règles"', () => {
        renderPage(RulesIndex, defaultProps);

        const layout = screen.getByTestId('layout');
        expect(layout).toHaveAttribute('data-title', 'Gestion des règles');
    });
});
