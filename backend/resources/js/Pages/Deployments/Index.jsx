import { router } from '@inertiajs/react';
import { useState } from 'react';
import DashboardLayout from '../../Layouts/DashboardLayout';
import { useTheme } from '../../Contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';

const statusColors = {
    success: '#22c55e',
    failed: '#ef4444',
    pending: '#f59e0b',
    rolled_back: '#f97316',
};

const statusLabels = {
    success: 'Succes',
    failed: 'Echec',
    pending: 'En attente',
    rolled_back: 'Restaure',
};

const methodLabels = {
    auto_update: 'Mise a jour auto',
    manual: 'Manuel',
    gpo: 'GPO',
    mdm: 'MDM',
};

function formatDate(isoStr) {
    if (!isoStr) return null;
    try {
        return new Date(isoStr).toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch { return isoStr; }
}

export default function DeploymentsIndex({ deployments, filters = {}, versions = [] }) {
    const { theme: t } = useTheme();
    const isMobile = useIsMobile();

    const [localFilters, setLocalFilters] = useState({
        status: filters.status || '',
        version: filters.version || '',
        method: filters.method || '',
        date_from: filters.date_from || '',
        date_to: filters.date_to || '',
        search: filters.search || '',
    });

    const cardStyle = {
        background: t.surface, borderRadius: 12,
        border: `1px solid ${t.border}`, padding: isMobile ? '1rem' : '1.5rem',
    };

    const inputStyle = {
        background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8,
        padding: '0.45rem 0.75rem', color: t.text, fontSize: '0.8rem',
        outline: 'none', minWidth: 0,
    };

    const applyFilters = () => {
        const params = {};
        Object.entries(localFilters).forEach(([key, value]) => {
            if (value) params[key] = value;
        });
        router.get('/deployments', params, { preserveState: true });
    };

    const clearFilters = () => {
        setLocalFilters({ status: '', version: '', method: '', date_from: '', date_to: '', search: '' });
        router.get('/deployments', {}, { preserveState: true });
    };

    const hasActiveFilters = Object.values(localFilters).some(v => v !== '');

    // Stats summary
    const totalItems = deployments?.data?.length || 0;
    const successCount = deployments?.data?.filter(d => d.status === 'success').length || 0;
    const failedCount = deployments?.data?.filter(d => d.status === 'failed').length || 0;

    return (
        <DashboardLayout title="Deploiements">
            {/* Summary stats */}
            <div className="icon-stat-grid" style={{ marginBottom: '1.5rem' }}>
                <div style={{
                    background: t.surface, borderRadius: 12,
                    border: `1px solid ${t.border}`, padding: '1.25rem',
                }}>
                    <span style={{ color: t.textMuted, fontSize: '0.75rem', fontWeight: 500 }}>Total deploiements</span>
                    <p style={{ color: '#3b82f6', fontSize: '2rem', fontWeight: 700, margin: '0.3rem 0 0' }}>
                        {deployments?.total ?? 0}
                    </p>
                </div>
                <div style={{
                    background: t.surface, borderRadius: 12,
                    border: `1px solid ${t.border}`, padding: '1.25rem',
                }}>
                    <span style={{ color: t.textMuted, fontSize: '0.75rem', fontWeight: 500 }}>Reussis</span>
                    <p style={{ color: '#22c55e', fontSize: '2rem', fontWeight: 700, margin: '0.3rem 0 0' }}>
                        {successCount}
                    </p>
                </div>
                <div style={{
                    background: t.surface, borderRadius: 12,
                    border: `1px solid ${t.border}`, padding: '1.25rem',
                }}>
                    <span style={{ color: t.textMuted, fontSize: '0.75rem', fontWeight: 500 }}>Echoues</span>
                    <p style={{ color: '#ef4444', fontSize: '2rem', fontWeight: 700, margin: '0.3rem 0 0' }}>
                        {failedCount}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
                <div style={{
                    display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end',
                }}>
                    {/* Search */}
                    <div style={{ flex: isMobile ? '1 1 100%' : '1 1 200px' }}>
                        <label style={{ color: t.textFaint, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: '0.3rem' }}>
                            Rechercher
                        </label>
                        <input
                            type="text"
                            placeholder="Nom de machine..."
                            value={localFilters.search}
                            onChange={(e) => setLocalFilters({ ...localFilters, search: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                        />
                    </div>

                    {/* Status */}
                    <div>
                        <label style={{ color: t.textFaint, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: '0.3rem' }}>
                            Statut
                        </label>
                        <select
                            value={localFilters.status}
                            onChange={(e) => setLocalFilters({ ...localFilters, status: e.target.value })}
                            style={inputStyle}
                        >
                            <option value="">Tous</option>
                            <option value="success">Succes</option>
                            <option value="failed">Echec</option>
                            <option value="pending">En attente</option>
                            <option value="rolled_back">Restaure</option>
                        </select>
                    </div>

                    {/* Version */}
                    <div>
                        <label style={{ color: t.textFaint, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: '0.3rem' }}>
                            Version
                        </label>
                        <select
                            value={localFilters.version}
                            onChange={(e) => setLocalFilters({ ...localFilters, version: e.target.value })}
                            style={inputStyle}
                        >
                            <option value="">Toutes</option>
                            {versions.map((v) => (
                                <option key={v} value={v}>{v}</option>
                            ))}
                        </select>
                    </div>

                    {/* Method */}
                    <div>
                        <label style={{ color: t.textFaint, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: '0.3rem' }}>
                            Methode
                        </label>
                        <select
                            value={localFilters.method}
                            onChange={(e) => setLocalFilters({ ...localFilters, method: e.target.value })}
                            style={inputStyle}
                        >
                            <option value="">Toutes</option>
                            <option value="auto_update">Mise a jour auto</option>
                            <option value="manual">Manuel</option>
                            <option value="gpo">GPO</option>
                            <option value="mdm">MDM</option>
                        </select>
                    </div>

                    {/* Date from */}
                    <div>
                        <label style={{ color: t.textFaint, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: '0.3rem' }}>
                            Date debut
                        </label>
                        <input
                            type="date"
                            value={localFilters.date_from}
                            onChange={(e) => setLocalFilters({ ...localFilters, date_from: e.target.value })}
                            style={inputStyle}
                        />
                    </div>

                    {/* Date to */}
                    <div>
                        <label style={{ color: t.textFaint, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: '0.3rem' }}>
                            Date fin
                        </label>
                        <input
                            type="date"
                            value={localFilters.date_to}
                            onChange={(e) => setLocalFilters({ ...localFilters, date_to: e.target.value })}
                            style={inputStyle}
                        />
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-end' }}>
                        <button
                            onClick={applyFilters}
                            style={{
                                background: t.accent, color: '#fff', border: 'none', borderRadius: 8,
                                padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                            }}
                        >
                            Filtrer
                        </button>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                style={{
                                    background: t.border, color: t.textSecondary, border: 'none', borderRadius: 8,
                                    padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.8rem',
                                }}
                            >
                                Effacer
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div style={cardStyle}>
                {deployments?.data?.length > 0 ? (
                    <>
                        <div className="icon-table-wrap">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                                        {['Machine', 'Version', 'Ancienne version', 'Statut', 'Methode', 'Erreur', 'Date'].map((h) => (
                                            <th key={h} style={{
                                                padding: '0.6rem 0.75rem', textAlign: 'left',
                                                color: t.textMuted, fontSize: '0.7rem',
                                                textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600,
                                            }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {deployments.data.map((deployment) => (
                                        <tr key={deployment.id} style={{
                                            borderBottom: `1px solid ${t.bg}`,
                                            cursor: deployment.machine_id ? 'pointer' : 'default',
                                        }}
                                            onClick={() => deployment.machine_id && router.visit(`/machines/${deployment.machine_id}`)}
                                        >
                                            <td style={{ padding: '0.6rem 0.75rem' }}>
                                                <div>
                                                    <span style={{ color: t.textSecondary, fontSize: '0.85rem', fontWeight: 500 }}>
                                                        {deployment.hostname || '\u2014'}
                                                    </span>
                                                    {deployment.os && (
                                                        <span style={{
                                                            marginLeft: '0.4rem', padding: '0.1rem 0.35rem', borderRadius: 4,
                                                            fontSize: '0.6rem', fontWeight: 600, color: t.textFaint,
                                                            background: deployment.os === 'windows' ? '#0078d420' : '#33333320',
                                                        }}>
                                                            {deployment.os}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.6rem 0.75rem', color: t.text, fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 600 }}>
                                                {deployment.version}
                                            </td>
                                            <td style={{ padding: '0.6rem 0.75rem', color: t.textMuted, fontSize: '0.85rem', fontFamily: 'monospace' }}>
                                                {deployment.previous_version || '\u2014'}
                                            </td>
                                            <td style={{ padding: '0.6rem 0.75rem' }}>
                                                <span style={{
                                                    padding: '0.2rem 0.6rem', borderRadius: 20,
                                                    fontSize: '0.7rem', fontWeight: 600, color: '#fff',
                                                    background: statusColors[deployment.status] || '#94a3b8',
                                                }}>
                                                    {statusLabels[deployment.status] || deployment.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.6rem 0.75rem', color: t.textMuted, fontSize: '0.8rem' }}>
                                                {deployment.deployment_method
                                                    ? (methodLabels[deployment.deployment_method] || deployment.deployment_method)
                                                    : '\u2014'}
                                            </td>
                                            <td style={{ padding: '0.6rem 0.75rem', maxWidth: 200 }}>
                                                {deployment.error_message ? (
                                                    <span
                                                        title={deployment.error_message}
                                                        style={{
                                                            color: '#ef4444', fontSize: '0.75rem',
                                                            display: 'block', whiteSpace: 'nowrap',
                                                            overflow: 'hidden', textOverflow: 'ellipsis',
                                                        }}
                                                    >
                                                        {deployment.error_message}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: t.textFaint, fontSize: '0.8rem' }}>{'\u2014'}</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.6rem 0.75rem' }}>
                                                <span
                                                    title={formatDate(deployment.deployed_at)}
                                                    style={{ color: t.textFaint, fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                                                >
                                                    {deployment.deployed_at_human}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {deployments.last_page > 1 && (
                            <div style={{
                                display: 'flex', justifyContent: 'center', gap: '0.35rem',
                                marginTop: '1.25rem', flexWrap: 'wrap',
                            }}>
                                {deployments.links.map((link, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => link.url && router.visit(link.url)}
                                        disabled={!link.url}
                                        style={{
                                            background: link.active ? t.accent : t.bg,
                                            color: link.active ? '#fff' : link.url ? t.textSecondary : t.textSubtle,
                                            border: `1px solid ${link.active ? t.accent : t.border}`,
                                            borderRadius: 6,
                                            padding: '0.35rem 0.65rem',
                                            cursor: link.url ? 'pointer' : 'not-allowed',
                                            fontSize: '0.75rem',
                                            fontWeight: link.active ? 600 : 400,
                                            opacity: link.url ? 1 : 0.5,
                                        }}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                        <p style={{ color: t.textFaint, fontSize: '0.9rem', margin: 0 }}>
                            Aucun deploiement enregistre.
                        </p>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                style={{
                                    background: 'transparent', color: t.accent, border: 'none',
                                    cursor: 'pointer', fontSize: '0.85rem', marginTop: '0.75rem',
                                    fontWeight: 500,
                                }}
                            >
                                Effacer les filtres
                            </button>
                        )}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
