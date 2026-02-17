import { Link, router, usePage } from '@inertiajs/react';
import { useState, useCallback } from 'react';
import DashboardLayout from '../../Layouts/DashboardLayout';
import { useTheme } from '../../Contexts/ThemeContext';

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

export default function MachinesIndex({ machines, filters, tags = [] }) {
    const { theme: t } = useTheme();
    const { auth, flash } = usePage().props;
    const isManager = auth?.user?.role === 'admin' || auth?.user?.role === 'manager';
    const [search, setSearch] = useState(filters?.search || '');
    const [selected, setSelected] = useState([]);
    const [bulkProcessing, setBulkProcessing] = useState(false);

    const inputStyle = {
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        padding: '0.5rem 1rem',
        color: t.text,
        fontSize: '0.875rem',
    };

    const allIds = machines?.data?.map((m) => m.id) || [];
    const allSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));

    const toggleSelect = (id) => {
        setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    };

    const toggleAll = () => {
        if (allSelected) {
            setSelected((prev) => prev.filter((id) => !allIds.includes(id)));
        } else {
            setSelected((prev) => [...new Set([...prev, ...allIds])]);
        }
    };

    const handleBulkAction = (action) => {
        if (selected.length === 0) return;
        const labels = {
            force_sync: 'synchroniser les règles',
            restart: 'redémarrer l\'agent',
            disable: 'désactiver',
        };
        if (!confirm(`Voulez-vous ${labels[action]} pour ${selected.length} machine(s) ?`)) return;

        setBulkProcessing(true);
        router.post('/machines/bulk-action', {
            machine_ids: selected,
            action,
        }, {
            preserveState: true,
            onSuccess: () => {
                setSelected([]);
                setBulkProcessing(false);
            },
            onError: () => setBulkProcessing(false),
        });
    };

    const applyFilters = useCallback((overrides = {}) => {
        const params = { ...filters, search, ...overrides };
        Object.keys(params).forEach((k) => {
            if (!params[k]) delete params[k];
        });
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

    const hasFilters = filters?.search || filters?.os || filters?.status || filters?.tag;

    return (
        <DashboardLayout title="Parc machines">
            {flash?.success && (
                <div style={{
                    background: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    borderRadius: 8,
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    color: t.success,
                    fontSize: '0.85rem',
                    fontWeight: 500,
                }}>
                    {flash.success}
                </div>
            )}

            {/* Bulk action bar */}
            {isManager && selected.length > 0 && (
                <div style={{
                    background: '#1e3a5f',
                    border: `1px solid ${t.accent}`,
                    borderRadius: 10,
                    padding: '0.65rem 1rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                }}>
                    <span style={{ color: '#93c5fd', fontSize: '0.85rem', fontWeight: 600 }}>
                        {selected.length} machine(s) sélectionnée(s)
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                        <button
                            onClick={() => handleBulkAction('force_sync')}
                            disabled={bulkProcessing}
                            style={{
                                background: t.accent, color: '#fff', border: 'none',
                                borderRadius: 6, padding: '0.4rem 0.85rem', fontSize: '0.8rem',
                                fontWeight: 600, cursor: bulkProcessing ? 'not-allowed' : 'pointer',
                                opacity: bulkProcessing ? 0.6 : 1,
                            }}
                        >
                            Sync règles
                        </button>
                        <button
                            onClick={() => handleBulkAction('restart')}
                            disabled={bulkProcessing}
                            style={{
                                background: t.warning, color: '#fff', border: 'none',
                                borderRadius: 6, padding: '0.4rem 0.85rem', fontSize: '0.8rem',
                                fontWeight: 600, cursor: bulkProcessing ? 'not-allowed' : 'pointer',
                                opacity: bulkProcessing ? 0.6 : 1,
                            }}
                        >
                            Redémarrer
                        </button>
                        <button
                            onClick={() => handleBulkAction('disable')}
                            disabled={bulkProcessing}
                            style={{
                                background: t.danger, color: '#fff', border: 'none',
                                borderRadius: 6, padding: '0.4rem 0.85rem', fontSize: '0.8rem',
                                fontWeight: 600, cursor: bulkProcessing ? 'not-allowed' : 'pointer',
                                opacity: bulkProcessing ? 0.6 : 1,
                            }}
                        >
                            Désactiver
                        </button>
                        <button
                            onClick={() => setSelected([])}
                            style={{
                                background: 'transparent', color: t.textMuted, border: `1px solid ${t.textSubtle}`,
                                borderRadius: 6, padding: '0.4rem 0.85rem', fontSize: '0.8rem',
                                cursor: 'pointer',
                            }}
                        >
                            Annuler
                        </button>
                    </div>
                </div>
            )}

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
                {tags.length > 0 && (
                    <select
                        value={filters?.tag || ''}
                        onChange={(e) => applyFilters({ tag: e.target.value })}
                        style={inputStyle}
                    >
                        <option value="">Tous les tags</option>
                        {tags.map((tg) => (
                            <option key={tg.id} value={tg.id}>{tg.name}</option>
                        ))}
                    </select>
                )}
                <button
                    onClick={() => applyFilters()}
                    style={{
                        background: t.accent, color: '#fff', border: 'none',
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
                            background: 'transparent', color: t.textMuted, border: `1px solid ${t.border}`,
                            borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer',
                            fontSize: '0.8rem',
                        }}
                    >
                        Effacer les filtres
                    </button>
                )}
                <span style={{ color: t.textFaint, fontSize: '0.8rem', marginLeft: 'auto' }}>
                    {total} machine(s)
                </span>
            </div>

            {/* Table */}
            <div style={{
                background: t.surface,
                borderRadius: 12,
                border: `1px solid ${t.border}`,
                overflowX: 'auto',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                            {isManager && (
                                <th style={{ padding: '0.75rem 0.5rem 0.75rem 1rem', width: 36 }}>
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={toggleAll}
                                        style={{ accentColor: t.accent, cursor: 'pointer' }}
                                    />
                                </th>
                            )}
                            {['Hostname', 'OS', 'Agent', 'Statut', 'Tags', 'Dernier contact', 'Département'].map((h) => (
                                <th key={h} style={{
                                    padding: '0.75rem 1rem', textAlign: 'left',
                                    color: t.textMuted, fontSize: '0.75rem',
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
                                <td colSpan={isManager ? 9 : 8} style={{ padding: '2rem', textAlign: 'center', color: t.textFaint }}>
                                    {hasFilters ? 'Aucune machine ne correspond aux filtres.' : 'Aucune machine enregistrée.'}
                                </td>
                            </tr>
                        )}
                        {machines?.data?.map((machine) => (
                            <tr
                                key={machine.id}
                                style={{
                                    borderBottom: `1px solid ${t.surface}`,
                                    cursor: 'pointer',
                                    background: selected.includes(machine.id) ? 'rgba(59,130,246,0.08)' : 'transparent',
                                }}
                            >
                                {isManager && (
                                    <td style={{ padding: '0.75rem 0.5rem 0.75rem 1rem', width: 36 }}>
                                        <input
                                            type="checkbox"
                                            checked={selected.includes(machine.id)}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                toggleSelect(machine.id);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{ accentColor: t.accent, cursor: 'pointer' }}
                                        />
                                    </td>
                                )}
                                <td
                                    style={{ padding: '0.75rem 1rem', color: t.text, fontSize: '0.875rem', fontWeight: 500 }}
                                    onClick={() => router.visit(`/machines/${machine.id}`)}
                                >
                                    {machine.hostname}
                                </td>
                                <td
                                    style={{ padding: '0.75rem 1rem', color: t.textMuted, fontSize: '0.875rem' }}
                                    onClick={() => router.visit(`/machines/${machine.id}`)}
                                >
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
                                <td
                                    style={{ padding: '0.75rem 1rem', color: t.textMuted, fontSize: '0.875rem' }}
                                    onClick={() => router.visit(`/machines/${machine.id}`)}
                                >
                                    v{machine.agent_version}
                                </td>
                                <td
                                    style={{ padding: '0.75rem 1rem' }}
                                    onClick={() => router.visit(`/machines/${machine.id}`)}
                                >
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
                                <td
                                    style={{ padding: '0.75rem 1rem' }}
                                    onClick={() => router.visit(`/machines/${machine.id}`)}
                                >
                                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                        {(machine.tags || []).map((tag) => (
                                            <span key={tag.id} style={{
                                                display: 'inline-block',
                                                padding: '0.1rem 0.45rem',
                                                borderRadius: 4,
                                                fontSize: '0.65rem',
                                                fontWeight: 600,
                                                background: `${tag.color}20`,
                                                color: tag.color,
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {tag.name}
                                            </span>
                                        ))}
                                        {(!machine.tags || machine.tags.length === 0) && (
                                            <span style={{ color: t.textSubtle, fontSize: '0.75rem' }}>{'\u2014'}</span>
                                        )}
                                    </div>
                                </td>
                                <td
                                    style={{ padding: '0.75rem 1rem', color: t.textMuted, fontSize: '0.875rem' }}
                                    onClick={() => router.visit(`/machines/${machine.id}`)}
                                >
                                    {machine.last_heartbeat || '\u2014'}
                                </td>
                                <td
                                    style={{ padding: '0.75rem 1rem', color: t.textMuted, fontSize: '0.875rem' }}
                                    onClick={() => router.visit(`/machines/${machine.id}`)}
                                >
                                    {machine.department || '\u2014'}
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
                            background: t.surface, border: `1px solid ${t.border}`, borderRadius: 6,
                            padding: '0.4rem 0.75rem', color: currentPage === 1 ? t.textSubtle : t.textSecondary,
                            cursor: currentPage === 1 ? 'default' : 'pointer', fontSize: '0.8rem',
                        }}
                    >
                        Préc.
                    </button>
                    {generatePageNumbers().map((p, i) =>
                        p === '...' ? (
                            <span key={`e${i}`} style={{ color: t.textFaint, padding: '0 0.25rem' }}>...</span>
                        ) : (
                            <button
                                key={p}
                                onClick={() => goToPage(p)}
                                style={{
                                    background: p === currentPage ? t.accent : t.surface,
                                    border: `1px solid ${p === currentPage ? t.accent : t.border}`,
                                    borderRadius: 6, padding: '0.4rem 0.7rem',
                                    color: p === currentPage ? '#fff' : t.textSecondary,
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
                            background: t.surface, border: `1px solid ${t.border}`, borderRadius: 6,
                            padding: '0.4rem 0.75rem', color: currentPage === lastPage ? t.textSubtle : t.textSecondary,
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
