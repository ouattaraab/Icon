import './bootstrap';
import '../css/app.css';

import { createRoot } from 'react-dom/client';
import { createInertiaApp } from '@inertiajs/react';
import { ThemeProvider } from './Contexts/ThemeContext';
import ErrorBoundary from './Components/ErrorBoundary';

createInertiaApp({
    title: (title) => title ? `${title} — Icon` : 'Icon',
    resolve: (name) => {
        const pages = import.meta.glob('./Pages/**/*.jsx', { eager: true });
        return pages[`./Pages/${name}.jsx`];
    },
    setup({ el, App, props }) {
        createRoot(el).render(
            <ErrorBoundary>
                <ThemeProvider>
                    <App {...props} />
                </ThemeProvider>
            </ErrorBoundary>
        );
    },
});
