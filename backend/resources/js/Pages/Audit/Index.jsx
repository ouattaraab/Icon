import { router } from '@inertiajs/react';
import DashboardLayout from '../../Layouts/DashboardLayout';

const actionLabels = {
    'auth.login': 'Connexion',
    'auth.logout': 'Déconnexion',
    'rule.created': 'Règle créée',
    'rule.updated': 'Règle modifiée',
    'rule.deleted': 'Règle supprimée',
    'rule.enabled': 'Règle activée',
    'rule.disabled': 'Règle désactivée',
    'alert.acknowledged': 'Alerte acquittée',
    'alert.resolved': 'Alerte résolue',
    'machine.registered': 'Machine enregistrée',
    'report.export_csv': 'Export CSV',
    'report.export_pdf': 'Export PDF',
};

const actionColors = {
    'auth': '#3b82f6',
    'rule': '#8b5cf6',
    'alert': '#f59e0b',
    'machine': '#22c55e',
    'report': '#06b6d4',
};

function getActionColor(action) {
    const prefix = action?.split('.')[0];
    return actionColors[prefix] || '#64748b';
}

export default function AuditIndex({ logs, actionTypes, filters }) {
    const handleFilter = (key, value) => {
        router.get('/audit', { ...filters, [key]: value }, { preserveState: true, replace: true });
    };

    return (
        <DashboardLayout title="Journal d'audit">
            {/* Filters */}
            <div style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'center',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
            }}>
                <select
                    value={filters?.action || ''}
                    onChange={(e) => handleFilter('action', e.target.value)}
                    style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        padding: '0.4rem 0.75rem',
                        color: '#f8fafc',
                        fontSize: '0.8rem',
                    }}
                >
                    <option value="">Toutes les actions</option>
                    {actionTypes?.map((action) => (
                        <option key={action} value={action}>
                            {actionLabels[action] || action}
                        </option>
                    ))}
                </select>

                <input
                    type="date"
                    defaultValue={filters?.date_from}
                    onChange={(e) => handleFilter('date_from', e.target.value)}
                    style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        padding: '0.4rem 0.75rem',
                        color: '#f8fafc',
                        fontSize: '0.8rem',
                    }}
                />
                <span style={{ color: '#64748b' }}>&mdash;</span>
                <input
                    type="date"
                    defaultValue={filters?.date_to}
                    onChange={(e) => handleFilter('date_to', e.target.value)}
                    style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        padding: '0.4rem 0.75rem',
                        color: '#f8fafc',
                        fontSize: '0.8rem',
                    }}
                />

                {(filters?.action || filters?.date_from || filters?.date_to) && (
                    <button
                        onClick={() => router.get('/audit')}
                        style={{
                            background: 'transparent',
                            border: '1px solid #475569',
                            borderRadius: 6,
                            padding: '0.4rem 0.75rem',
                            color: '#94a3b8',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                        }}
                    >
                        Effacer filtres
                    </button>
                )}
            </div>

            {/* Audit log table */}
            <div style={{
                background: '#1e293b',
                borderRadius: 12,
                border: '1px solid #334155',
                overflow: 'hidden',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #334155' }}>
                            {['Date', 'Utilisateur', 'Action', 'Cible', 'Détails', 'IP'].map((h) => (
                                <th key={h} style={{
                                    padding: '0.75rem',
                                    textAlign: 'left',
                                    color: '#94a3b8',
                                    fontSize: '0.7rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: 1,
                                    fontWeight: 600,
                                }}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {logs?.data?.length > 0 ? (
                            logs.data.map((log) => (
                                <tr key={log.id} style={{ borderBottom: '1px solid #0f172a' }}>
                                    <td style={{ padding: '0.6rem 0.75rem', color: '#94a3b8', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                        {new Date(log.created_at).toLocaleString('fr-FR', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', color: '#e2e8f0', fontSize: '0.8rem' }}>
                                        {log.user?.name || log.user?.email || 'Système'}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: 4,
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            background: `${getActionColor(log.action)}20`,
                                            color: getActionColor(log.action),
                                        }}>
                                            {actionLabels[log.action] || log.action}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                        {log.target_type ? `${log.target_type}` : '\u2014'}
                                        {log.target_id ? ` #${log.target_id.slice(0, 8)}` : ''}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', color: '#64748b', fontSize: '0.75rem', maxWidth: 300 }}>
                                        {log.details ? (
                                            <span style={{
                                                display: 'block',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                maxWidth: 300,
                                            }}>
                                                {formatDetails(log.details)}
                                            </span>
                                        ) : '\u2014'}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', color: '#475569', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                        {log.ip_address || '\u2014'}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                                    Aucune entrée dans le journal d'audit.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {logs?.last_page > 1 && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    marginTop: '1.5rem',
                }}>
                    {logs.links?.map((link, idx) => (
                        <button
                            key={idx}
                            disabled={!link.url}
                            onClick={() => link.url && router.get(link.url, {}, { preserveState: true })}
                            style={{
                                padding: '0.4rem 0.75rem',
                                borderRadius: 6,
                                border: '1px solid #334155',
                                background: link.active ? '#3b82f6' : '#1e293b',
                                color: link.active ? '#fff' : link.url ? '#e2e8f0' : '#475569',
                                fontSize: '0.8rem',
                                cursor: link.url ? 'pointer' : 'default',
                            }}
                            dangerouslySetInnerHTML={{ __html: link.label }}
                        />
                    ))}
                </div>
            )}
        </DashboardLayout>
    );
}

function formatDetails(details) {
    if (!details || typeof details !== 'object') return String(details);
    return Object.entries(details)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
}
