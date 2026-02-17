import { router } from '@inertiajs/react';
import { useState, useCallback } from 'react';
import DashboardLayout from '../../Layouts/DashboardLayout';
import { useTheme } from '../../Contexts/ThemeContext';

const actionLabels = {
    'auth.login': 'Connexion',
    'auth.logout': 'Déconnexion',
    'rule.created': 'Règle créée',
    'rule.updated': 'Règle modifiée',
    'rule.deleted': 'Règle supprimée',
    'rule.enabled': 'Règle activée',
    'rule.disabled': 'Règle désactivée',
    'rules.exported': 'Export règles',
    'rules.imported': 'Import règles',
    'alert.acknowledged': 'Alerte acquittée',
    'alert.resolved': 'Alerte résolue',
    'machine.registered': 'Machine enregistrée',
    'domain.created': 'Domaine ajouté',
    'domain.updated': 'Domaine modifié',
    'domain.deleted': 'Domaine supprimé',
    'domain.blocked': 'Domaine bloqué',
    'domain.unblocked': 'Domaine débloqué',
    'report.export_csv': 'Export CSV',
    'report.export_pdf': 'Export PDF',
    'user.created': 'Utilisateur créé',
    'user.updated': 'Utilisateur modifié',
    'user.deleted': 'Utilisateur supprimé',
};

const categoryLabels = {
    auth: 'Authentification',
    rule: 'Règles',
    rules: 'Règles (bulk)',
    alert: 'Alertes',
    machine: 'Machines',
    domain: 'Domaines',
    report: 'Rapports',
    user: 'Utilisateurs',
};

const actionColors = {
    auth: '#3b82f6',
    rule: '#8b5cf6',
    rules: '#8b5cf6',
    alert: '#f59e0b',
    machine: '#22c55e',
    domain: '#06b6d4',
    report: '#f97316',
    user: '#ec4899',
};

function getActionColor(action) {
    const prefix = action?.split('.')[0];
    return actionColors[prefix] || '#64748b';
}

export default function AuditIndex({ logs, actionTypes, users, filters }) {
    const { theme: t } = useTheme();
    const [search, setSearch] = useState(filters?.search || '');

    const filterInputStyle = {
        background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8,
        padding: '0.4rem 0.75rem', color: t.text, fontSize: '0.8rem',
    };

    const applyFilter = useCallback((key, value) => {
        const params = { ...filters, [key]: value };
        Object.keys(params).forEach((k) => { if (!params[k]) delete params[k]; });
        delete params.page;
        router.get('/audit', params, { preserveState: true, replace: true });
    }, [filters]);

    const applySearch = useCallback(() => {
        applyFilter('search', search);
    }, [search, applyFilter]);

    const hasFilters = filters?.action || filters?.category || filters?.user_id || filters?.search || filters?.date_from || filters?.date_to;

    // Build category list from action types
    const categories = [...new Set((actionTypes || []).map((a) => a.split('.')[0]))].sort();

    // Pagination
    const currentPage = logs?.current_page ?? 1;
    const lastPage = logs?.last_page ?? 1;
    const total = logs?.total ?? 0;

    const goToPage = (page) => {
        if (page < 1 || page > lastPage || page === currentPage) return;
        router.get('/audit', { ...filters, page }, { preserveState: true, replace: true });
    };

    const generatePageNumbers = () => {
        const pages = [];
        if (lastPage <= 7) {
            for (let i = 1; i <= lastPage; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('...');
            for (let i = Math.max(2, currentPage - 1); i <= Math.min(lastPage - 1, currentPage + 1); i++) pages.push(i);
            if (currentPage < lastPage - 2) pages.push('...');
            pages.push(lastPage);
        }
        return pages;
    };

    return (
        <DashboardLayout title="Journal d'audit">
            {/* Filters row 1 */}
            <div style={{
                display: 'flex', gap: '0.5rem', alignItems: 'center',
                marginBottom: '0.75rem', flexWrap: 'wrap',
            }}>
                <input
                    type="text"
                    placeholder="Rechercher (cible, détails)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                    style={{ ...filterInputStyle, width: 220 }}
                />
                <select
                    value={filters?.category || ''}
                    onChange={(e) => applyFilter('category', e.target.value)}
                    style={filterInputStyle}
                >
                    <option value="">Toutes les catégories</option>
                    {categories.map((cat) => (
                        <option key={cat} value={cat}>
                            {categoryLabels[cat] || cat}
                        </option>
                    ))}
                </select>
                <select
                    value={filters?.action || ''}
                    onChange={(e) => applyFilter('action', e.target.value)}
                    style={filterInputStyle}
                >
                    <option value="">Toutes les actions</option>
                    {actionTypes?.map((action) => (
                        <option key={action} value={action}>
                            {actionLabels[action] || action}
                        </option>
                    ))}
                </select>
                <select
                    value={filters?.user_id || ''}
                    onChange={(e) => applyFilter('user_id', e.target.value)}
                    style={filterInputStyle}
                >
                    <option value="">Tous les utilisateurs</option>
                    {users?.map((user) => (
                        <option key={user.id} value={user.id}>
                            {user.name} ({user.email})
                        </option>
                    ))}
                </select>
            </div>

            {/* Filters row 2: dates + actions */}
            <div style={{
                display: 'flex', gap: '0.5rem', alignItems: 'center',
                marginBottom: '1.5rem', flexWrap: 'wrap',
            }}>
                <span style={{ color: t.textFaint, fontSize: '0.75rem' }}>Période :</span>
                <input
                    type="date"
                    value={filters?.date_from || ''}
                    onChange={(e) => applyFilter('date_from', e.target.value)}
                    style={filterInputStyle}
                />
                <span style={{ color: t.textFaint }}>&mdash;</span>
                <input
                    type="date"
                    value={filters?.date_to || ''}
                    onChange={(e) => applyFilter('date_to', e.target.value)}
                    style={filterInputStyle}
                />
                <button onClick={applySearch} style={{
                    background: t.accent, color: '#fff', border: 'none', borderRadius: 6,
                    padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                }}>
                    Rechercher
                </button>
                {hasFilters && (
                    <button
                        onClick={() => { setSearch(''); router.get('/audit', {}, { preserveState: true, replace: true }); }}
                        style={{
                            background: 'transparent', color: t.textMuted, border: `1px solid ${t.textSubtle}`,
                            borderRadius: 6, padding: '0.4rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer',
                        }}
                    >
                        Effacer filtres
                    </button>
                )}
                <span style={{ color: t.textFaint, fontSize: '0.8rem', marginLeft: 'auto' }}>
                    {total} entrée(s)
                </span>
            </div>

            {/* Audit log table */}
            <div style={{
                background: t.surface, borderRadius: 12,
                border: `1px solid ${t.border}`, overflow: 'hidden',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                            {['Date', 'Utilisateur', 'Action', 'Cible', 'Détails', 'IP'].map((h) => (
                                <th key={h} style={{
                                    padding: '0.75rem', textAlign: 'left', color: t.textMuted,
                                    fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600,
                                }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {logs?.data?.length > 0 ? (
                            logs.data.map((log) => (
                                <tr key={log.id} style={{ borderBottom: `1px solid ${t.bg}` }}>
                                    <td style={{ padding: '0.6rem 0.75rem', color: t.textMuted, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                        {new Date(log.created_at).toLocaleString('fr-FR', {
                                            day: '2-digit', month: '2-digit', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit',
                                        })}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        {log.user ? (
                                            <div>
                                                <span style={{ color: t.textSecondary, fontSize: '0.8rem', fontWeight: 500 }}>
                                                    {log.user.name}
                                                </span>
                                                <span style={{ color: t.textFaint, fontSize: '0.7rem', display: 'block' }}>
                                                    {log.user.email}
                                                </span>
                                            </div>
                                        ) : (
                                            <span style={{ color: t.textFaint, fontSize: '0.8rem' }}>Système</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <span style={{
                                            display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: 4,
                                            fontSize: '0.7rem', fontWeight: 600,
                                            background: `${getActionColor(log.action)}20`,
                                            color: getActionColor(log.action),
                                        }}>
                                            {actionLabels[log.action] || log.action}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', color: t.textMuted, fontSize: '0.8rem' }}>
                                        {log.target_type || '\u2014'}
                                        {log.target_id ? (
                                            <span style={{ color: t.textSubtle, fontSize: '0.7rem', fontFamily: 'monospace' }}>
                                                {' #'}{log.target_id.slice(0, 8)}
                                            </span>
                                        ) : ''}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', color: t.textFaint, fontSize: '0.75rem', maxWidth: 300 }}>
                                        {log.details ? (
                                            <span style={{
                                                display: 'block', overflow: 'hidden',
                                                textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300,
                                            }}>
                                                {formatDetails(log.details)}
                                            </span>
                                        ) : '\u2014'}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', color: t.textSubtle, fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                        {log.ip_address || '\u2014'}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: t.textFaint, fontSize: '0.85rem' }}>
                                    {hasFilters ? 'Aucun résultat pour ces filtres.' : "Aucune entrée dans le journal d'audit."}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {lastPage > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.35rem', marginTop: '1.5rem' }}>
                    <PagBtn label="Préc." onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} />
                    {generatePageNumbers().map((p, i) =>
                        p === '...' ? (
                            <span key={`e${i}`} style={{ color: t.textFaint, padding: '0 0.25rem' }}>...</span>
                        ) : (
                            <PagBtn key={p} label={p} onClick={() => goToPage(p)} active={p === currentPage} />
                        )
                    )}
                    <PagBtn label="Suiv." onClick={() => goToPage(currentPage + 1)} disabled={currentPage === lastPage} />
                </div>
            )}
        </DashboardLayout>
    );
}

function PagBtn({ label, onClick, disabled, active }) {
    const { theme: t } = useTheme();
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                background: active ? t.accent : t.surface,
                border: `1px solid ${active ? t.accent : t.border}`,
                borderRadius: 6, padding: '0.4rem 0.7rem',
                color: active ? '#fff' : disabled ? t.textSubtle : t.textSecondary,
                cursor: disabled ? 'default' : 'pointer',
                fontSize: '0.8rem', fontWeight: active ? 700 : 400,
            }}
        >
            {label}
        </button>
    );
}

function formatDetails(details) {
    if (!details || typeof details !== 'object') return String(details);
    return Object.entries(details)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(', ');
}
