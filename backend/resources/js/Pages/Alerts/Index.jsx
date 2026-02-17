import { router } from '@inertiajs/react';
import DashboardLayout from '../../Layouts/DashboardLayout';

const severityStyles = {
    critical: { bg: '#7f1d1d', color: '#fca5a5', label: 'Critique' },
    warning: { bg: '#78350f', color: '#fcd34d', label: 'Attention' },
};

const statusLabels = {
    open: 'Ouverte',
    acknowledged: 'Prise en charge',
    resolved: 'Résolue',
};

export default function AlertsIndex({ alerts, openCount, criticalCount, filters }) {
    return (
        <DashboardLayout title="Centre d'alertes">
            {/* Summary */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{
                    background: '#1e293b',
                    borderRadius: 8,
                    padding: '1rem 1.5rem',
                    border: '1px solid #334155',
                }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Alertes ouvertes</span>
                    <p style={{ color: '#f59e0b', fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0 0' }}>
                        {openCount}
                    </p>
                </div>
                <div style={{
                    background: '#1e293b',
                    borderRadius: 8,
                    padding: '1rem 1.5rem',
                    border: criticalCount > 0 ? '1px solid #ef4444' : '1px solid #334155',
                }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Critiques</span>
                    <p style={{ color: '#ef4444', fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0 0' }}>
                        {criticalCount}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                    defaultValue={filters?.status || ''}
                    onChange={(e) => router.get('/alerts', { ...filters, status: e.target.value }, { preserveState: true, replace: true })}
                    style={{
                        background: '#1e293b', border: '1px solid #334155',
                        borderRadius: 8, padding: '0.5rem 1rem', color: '#f8fafc', fontSize: '0.875rem',
                    }}
                >
                    <option value="">Tous les statuts</option>
                    <option value="open">Ouvertes</option>
                    <option value="acknowledged">Prises en charge</option>
                    <option value="resolved">Résolues</option>
                </select>
                <select
                    defaultValue={filters?.severity || ''}
                    onChange={(e) => router.get('/alerts', { ...filters, severity: e.target.value }, { preserveState: true, replace: true })}
                    style={{
                        background: '#1e293b', border: '1px solid #334155',
                        borderRadius: 8, padding: '0.5rem 1rem', color: '#f8fafc', fontSize: '0.875rem',
                    }}
                >
                    <option value="">Toutes les sévérités</option>
                    <option value="critical">Critique</option>
                    <option value="warning">Attention</option>
                </select>
                <a
                    href={`/alerts/export?${new URLSearchParams(
                        Object.entries(filters || {}).filter(([, v]) => v)
                    ).toString()}`}
                    style={{
                        marginLeft: 'auto',
                        background: '#065f46', color: '#6ee7b7', border: 'none',
                        borderRadius: 6, padding: '0.5rem 1rem', cursor: 'pointer',
                        fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
                    }}
                >
                    Exporter CSV
                </a>
            </div>

            {/* Alert list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {alerts?.data?.map((alert) => {
                    const sev = severityStyles[alert.severity] || severityStyles.warning;
                    return (
                        <div key={alert.id} onClick={() => router.visit(`/alerts/${alert.id}`)} style={{
                            background: '#1e293b',
                            borderRadius: 8,
                            padding: '1rem 1.25rem',
                            border: '1px solid #334155',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            cursor: 'pointer',
                            transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#475569'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#334155'}>
                            <span style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: 6,
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                background: sev.bg,
                                color: sev.color,
                                textTransform: 'uppercase',
                            }}>
                                {sev.label}
                            </span>
                            <div style={{ flex: 1 }}>
                                <p style={{ color: '#f8fafc', fontSize: '0.875rem', margin: 0, fontWeight: 500 }}>
                                    {alert.title}
                                </p>
                                <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
                                    {alert.machine?.hostname} — {alert.rule?.name || 'N/A'}
                                </p>
                            </div>
                            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                {statusLabels[alert.status]}
                            </span>
                            {alert.status === 'open' && (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.post(`/alerts/${alert.id}/acknowledge`);
                                        }}
                                        style={{
                                            background: '#3b82f6', color: '#fff', border: 'none',
                                            borderRadius: 6, padding: '0.4rem 0.8rem', cursor: 'pointer',
                                            fontSize: '0.75rem', fontWeight: 600,
                                        }}
                                    >
                                        Acquitter
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.post(`/alerts/${alert.id}/resolve`);
                                        }}
                                        style={{
                                            background: '#22c55e', color: '#fff', border: 'none',
                                            borderRadius: 6, padding: '0.4rem 0.8rem', cursor: 'pointer',
                                            fontSize: '0.75rem', fontWeight: 600,
                                        }}
                                    >
                                        Résoudre
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </DashboardLayout>
    );
}
