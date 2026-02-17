import { Link, router } from '@inertiajs/react';
import { useState, useCallback } from 'react';
import DashboardLayout from '../../Layouts/DashboardLayout';

const statusColors = {
    online: '#22c55e',
    active: '#3b82f6',
    offline: '#ef4444',
    inactive: '#94a3b8',
};

const osIcons = {
    windows: 'W',
    macos: 'M',
};

const inputStyle = {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '0.5rem 1rem',
    color: '#f8fafc',
    fontSize: '0.875rem',
};

export default function MachinesIndex({ machines, filters }) {
    const [search, setSearch] = useState(filters?.search || '');

    const applyFilters = useCallback((overrides = {}) => {
        const params = { ...filters, search, ...overrides };
        // Remove empty values
        Object.keys(params).forEach((k) => {
            if (!params[k]) delete params[k];
        });
        // Reset to page 1 when filtering
        delete params.page;
        router.get('/machines', params, { preserveState: true, replace: true });
    }, [filters, search]);

    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter') applyFilters();
    };

    // Pagination
    const currentPage = machines?.current_page ?? 1;
    const lastPage = machines?.last_page ?? 1;
    const total = machines?.total ?? 0;

    const generatePageNumbers = () => {
        const pages = [];
        if (lastPage <= 7) {
            for (let i = 1; i <= lastPage; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('...');
            for (let i = Math.max(2, currentPage - 1); i <= Math.min(lastPage - 1, currentPage + 1); i++) {
                pages.push(i);
            }
            if (currentPage < lastPage - 2) pages.push('...');
            pages.push(lastPage);
        }
        return pages;
    };

    const goToPage = (page) => {
        if (page < 1 || page > lastPage || page === currentPage) return;
        router.get('/machines', { ...filters, page }, { preserveState: true, replace: true });
    };

    const hasFilters = filters?.search || filters?.os || filters?.status;

    return (
        <DashboardLayout title="Parc machines">
            {/* Filters */}
            <div style={{
                display: 'flex', gap: '0.75rem', marginBottom: '1.5rem',
                flexWrap: 'wrap', alignItems: 'center',
            }}>
                <input
                    type="text"
                    placeholder="Rechercher (hostname, utilisateur)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    style={{ ...inputStyle, width: 300 }}
                />
                <select
                    value={filters?.os || ''}
                    onChange={(e) => applyFilters({ os: e.target.value })}
                    style={inputStyle}
                >
                    <option value="">Tous les OS</option>
                    <option value="windows">Windows</option>
                    <option value="macos">macOS</option>
                </select>
                <select
                    value={filters?.status || ''}
                    onChange={(e) => applyFilters({ status: e.target.value })}
                    style={inputStyle}
                >
                    <option value="">Tous les statuts</option>
                    <option value="active">Actif</option>
                    <option value="offline">Hors ligne</option>
                    <option value="inactive">Inactif</option>
                </select>
                <button
                    onClick={() => applyFilters()}
                    style={{
                        background: '#3b82f6', color: '#fff', border: 'none',
                        borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer',
                        fontSize: '0.875rem', fontWeight: 600,
                    }}
                >
                    Rechercher
                </button>
                {hasFilters && (
                    <button
                        onClick={() => {
                            setSearch('');
                            router.get('/machines', {}, { preserveState: true, replace: true });
                        }}
                        style={{
                            background: 'transparent', color: '#94a3b8', border: '1px solid #334155',
                            borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer',
                            fontSize: '0.8rem',
                        }}
                    >
                        Effacer les filtres
                    </button>
                )}
                <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: 'auto' }}>
                    {total} machine(s)
                </span>
            </div>

            {/* Table */}
            <div style={{
                background: '#1e293b',
                borderRadius: 12,
                border: '1px solid #334155',
                overflow: 'hidden',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #334155' }}>
                            {['Hostname', 'OS', 'Agent', 'Statut', 'Dernier contact', 'Département', 'Utilisateur'].map((h) => (
                                <th key={h} style={{
                                    padding: '0.75rem 1rem', textAlign: 'left',
                                    color: '#94a3b8', fontSize: '0.75rem',
                                    textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600,
                                }}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {machines?.data?.length === 0 && (
                            <tr>
                                <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                                    {hasFilters ? 'Aucune machine ne correspond aux filtres.' : 'Aucune machine enregistrée.'}
                                </td>
                            </tr>
                        )}
                        {machines?.data?.map((machine) => (
                            <tr
                                key={machine.id}
                                style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer' }}
                                onClick={() => router.visit(`/machines/${machine.id}`)}
                            >
                                <td style={{ padding: '0.75rem 1rem', color: '#f8fafc', fontSize: '0.875rem', fontWeight: 500 }}>
                                    {machine.hostname}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                    <span style={{
                                        display: 'inline-block', width: 20, height: 20, borderRadius: 4,
                                        background: machine.os === 'windows' ? '#0078d4' : '#333',
                                        color: '#fff', textAlign: 'center', lineHeight: '20px',
                                        fontSize: '0.7rem', fontWeight: 700, marginRight: '0.4rem',
                                    }}>
                                        {osIcons[machine.os] || '?'}
                                    </span>
                                    {machine.os} {machine.os_version}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                    v{machine.agent_version}
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    <span style={{
                                        display: 'inline-block',
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: 20,
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        color: '#fff',
                                        background: statusColors[machine.status] || '#94a3b8',
                                    }}>
                                        {machine.status}
                                    </span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                    {machine.last_heartbeat || '—'}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                    {machine.department || '—'}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                    {machine.assigned_user || '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {lastPage > 1 && (
                <div style={{
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    gap: '0.35rem', marginTop: '1.5rem',
                }}>
                    <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        style={{
                            background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
                            padding: '0.4rem 0.75rem', color: currentPage === 1 ? '#475569' : '#e2e8f0',
                            cursor: currentPage === 1 ? 'default' : 'pointer', fontSize: '0.8rem',
                        }}
                    >
                        Préc.
                    </button>
                    {generatePageNumbers().map((p, i) =>
                        p === '...' ? (
                            <span key={`e${i}`} style={{ color: '#64748b', padding: '0 0.25rem' }}>...</span>
                        ) : (
                            <button
                                key={p}
                                onClick={() => goToPage(p)}
                                style={{
                                    background: p === currentPage ? '#3b82f6' : '#1e293b',
                                    border: '1px solid ' + (p === currentPage ? '#3b82f6' : '#334155'),
                                    borderRadius: 6, padding: '0.4rem 0.7rem',
                                    color: p === currentPage ? '#fff' : '#e2e8f0',
                                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: p === currentPage ? 700 : 400,
                                }}
                            >
                                {p}
                            </button>
                        )
                    )}
                    <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === lastPage}
                        style={{
                            background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
                            padding: '0.4rem 0.75rem', color: currentPage === lastPage ? '#475569' : '#e2e8f0',
                            cursor: currentPage === lastPage ? 'default' : 'pointer', fontSize: '0.8rem',
                        }}
                    >
                        Suiv.
                    </button>
                </div>
            )}
        </DashboardLayout>
    );
}
