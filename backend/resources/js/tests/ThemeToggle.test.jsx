import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Direct test of ThemeContext (not using the global mock)
describe('ThemeContext', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('defaults to dark theme', async () => {
        // Unmock for this test file — we test the real implementation
        const { ThemeProvider, useTheme } = await vi.importActual('../Contexts/ThemeContext');
        const React = await import('react');

        function TestConsumer() {
            const { isDark, theme } = useTheme();
            return React.createElement('div', null,
                React.createElement('span', { 'data-testid': 'mode' }, isDark ? 'dark' : 'light'),
                React.createElement('span', { 'data-testid': 'bg' }, theme.bg),
            );
        }

        render(React.createElement(ThemeProvider, null, React.createElement(TestConsumer)));

        expect(screen.getByTestId('mode').textContent).toBe('dark');
        expect(screen.getByTestId('bg').textContent).toBe('#0f172a');
    });

    it('reads theme from localStorage', async () => {
        localStorage.setItem('icon-theme', 'light');

        const { ThemeProvider, useTheme } = await vi.importActual('../Contexts/ThemeContext');
        const React = await import('react');

        function TestConsumer() {
            const { isDark, theme } = useTheme();
            return React.createElement('div', null,
                React.createElement('span', { 'data-testid': 'mode' }, isDark ? 'dark' : 'light'),
                React.createElement('span', { 'data-testid': 'bg' }, theme.bg),
            );
        }

        render(React.createElement(ThemeProvider, null, React.createElement(TestConsumer)));

        expect(screen.getByTestId('mode').textContent).toBe('light');
        expect(screen.getByTestId('bg').textContent).toBe('#f1f5f9');
    });

    it('toggles theme and persists to localStorage', async () => {
        const { ThemeProvider, useTheme } = await vi.importActual('../Contexts/ThemeContext');
        const React = await import('react');

        function TestConsumer() {
            const { isDark, toggle } = useTheme();
            return React.createElement('div', null,
                React.createElement('span', { 'data-testid': 'mode' }, isDark ? 'dark' : 'light'),
                React.createElement('button', { 'data-testid': 'toggle', onClick: toggle }, 'Toggle'),
            );
        }

        render(React.createElement(ThemeProvider, null, React.createElement(TestConsumer)));

        expect(screen.getByTestId('mode').textContent).toBe('dark');

        fireEvent.click(screen.getByTestId('toggle'));

        expect(screen.getByTestId('mode').textContent).toBe('light');
        expect(localStorage.getItem('icon-theme')).toBe('light');

        fireEvent.click(screen.getByTestId('toggle'));

        expect(screen.getByTestId('mode').textContent).toBe('dark');
        expect(localStorage.getItem('icon-theme')).toBe('dark');
    });

    it('provides correct light theme colors', async () => {
        localStorage.setItem('icon-theme', 'light');

        const { ThemeProvider, useTheme } = await vi.importActual('../Contexts/ThemeContext');
        const React = await import('react');

        function TestConsumer() {
            const { theme } = useTheme();
            return React.createElement('div', null,
                React.createElement('span', { 'data-testid': 'surface' }, theme.surface),
                React.createElement('span', { 'data-testid': 'text' }, theme.text),
                React.createElement('span', { 'data-testid': 'border' }, theme.border),
            );
        }

        render(React.createElement(ThemeProvider, null, React.createElement(TestConsumer)));

        expect(screen.getByTestId('surface').textContent).toBe('#ffffff');
        expect(screen.getByTestId('text').textContent).toBe('#0f172a');
        expect(screen.getByTestId('border').textContent).toBe('#e2e8f0');
    });

    it('sets CSS variables on document root', async () => {
        const { ThemeProvider, useTheme } = await vi.importActual('../Contexts/ThemeContext');
        const React = await import('react');

        function TestConsumer() {
            const { theme } = useTheme();
            return React.createElement('span', null, theme.key);
        }

        render(React.createElement(ThemeProvider, null, React.createElement(TestConsumer)));

        const root = document.documentElement;
        expect(root.style.getPropertyValue('--icon-bg')).toBe('#0f172a');
        expect(root.style.getPropertyValue('--icon-surface')).toBe('#1e293b');
    });
});
