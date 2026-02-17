import React from 'react';
import { render } from '@testing-library/react';

export function setPageProps(props) {
    globalThis.__INERTIA_PAGE_PROPS__ = {
        auth: { user: { name: 'Admin', email: 'admin@gs2e.ci', role: 'admin' }, is_admin: true, is_manager: true },
        flash: {},
        unreadNotificationCount: 0,
        ...props,
    };
}

export function resetPageProps() {
    globalThis.__INERTIA_PAGE_PROPS__ = undefined;
}

export function renderPage(Component, props = {}) {
    return render(<Component {...props} />);
}
