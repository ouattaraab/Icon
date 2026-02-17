import { Link } from '@inertiajs/react';
import DashboardLayout from '../../Layouts/DashboardLayout';

const cardStyle = {
    background: '#1e293b',
    borderRadius: 12,
    border: '1px solid #334155',
    padding: '1.5rem',
    marginBottom: '1.5rem',
};

const statusColors = {
    online: '#22c55e',
    active: '#3b82f6',
    offline: '#ef4444',
    inactive: '#94a3b8',
};

const severityColors = {
    critical: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
};

const alertStatusLabels = {
    open: 'Ouverte',
    acknowledged: 'Acquittee',
    resolved: 'Resolue',
};

export default function SearchIndex({ query, results }) {
    const totalResults = (results.machines?.length || 0) + (results.alerts?.length || 0);

    return (
        <DashboardLayout title="Recherche">
            {query ? (
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                    {totalResults} resultat{totalResults !== 1 ? 's' : ''} pour «&nbsp;
                    <strong style={{ color: '#e2e8f0' }}>{query}</strong>&nbsp;»
                </p>
            ) : (
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                    Saisissez un terme dans la barre de recherche ci-dessus.
                </p>
            )}

            {/* Machines */}
            {results.machines?.length > 0 && (
                <div style={cardStyle}>
                    <h3 style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem' }}>
                        Machines ({results.machines.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {results.machines.map((m) => (
                            <Link
                                key={m.id}
                                href={`/machines/${m.id}`}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                    padding: '0.65rem 0.75rem', background: '#0f172a',
                                    borderRadius: 8, textDecoration: 'none',
                                    border: '1px solid transparent', transition: 'border-color 0.15s',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#334155'}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                            >
                                <span style={{
                                    width: 32, height: 32, borderRadius: 6,
                                    background: m.os === 'windows' ? '#0078d4' : '#333',
                                    color: '#fff', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700,
                                    flexShrink: 0,
                                }}>
                                    {m.os === 'windows' ? 'W' : 'M'}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                                        {m.hostname}
                                    </p>
                                    <p style={{ color: '#64748b', fontSize: '0.7rem', margin: '0.1rem 0 0' }}>
                                        {[m.assigned_user, m.department].filter(Boolean).join(' — ') || m.os}
                                        {m.last_heartbeat ? ` — ${m.last_heartbeat}` : ''}
                                    </p>
                                </div>
                                <span style={{
                                    padding: '0.2rem 0.6rem', borderRadius: 12,
                                    fontSize: '0.7rem', fontWeight: 600,
                                    color: '#fff',
                                    background: statusColors[m.status] || '#64748b',
                                }}>
                                    {m.status}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Alerts */}
            {results.alerts?.length > 0 && (
                <div style={cardStyle}>
                    <h3 style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem' }}>
                        Alertes ({results.alerts.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {results.alerts.map((a) => (
                            <Link
                                key={a.id}
                                href="/alerts"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                    padding: '0.65rem 0.75rem', background: '#0f172a',
                                    borderRadius: 8, textDecoration: 'none',
                                    border: '1px solid transparent', transition: 'border-color 0.15s',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#334155'}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                            >
                                <div style={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: severityColors[a.severity] || '#64748b',
                                    flexShrink: 0,
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{
                                        color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 500,
                                        margin: 0, whiteSpace: 'nowrap', overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}>
                                        {a.title}
                                    </p>
                                    <p style={{ color: '#64748b', fontSize: '0.7rem', margin: '0.1rem 0 0' }}>
                                        {a.machine || 'Machine inconnue'} — {a.created_at}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                                    <span style={{
                                        padding: '0.15rem 0.4rem', borderRadius: 4,
                                        fontSize: '0.6rem', fontWeight: 700,
                                        background: a.severity === 'critical' ? '#7f1d1d' : '#78350f',
                                        color: a.severity === 'critical' ? '#fca5a5' : '#fcd34d',
                                    }}>
                                        {a.severity}
                                    </span>
                                    <span style={{
                                        padding: '0.15rem 0.4rem', borderRadius: 4,
                                        fontSize: '0.6rem', fontWeight: 600,
                                        color: '#94a3b8', background: '#334155',
                                    }}>
                                        {alertStatusLabels[a.status] || a.status}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* No results */}
            {query && totalResults === 0 && (
                <div style={{
                    ...cardStyle, textAlign: 'center', padding: '3rem 1.5rem',
                }}>
                    <p style={{ color: '#64748b', fontSize: '1rem', margin: '0 0 0.5rem' }}>
                        Aucun resultat
                    </p>
                    <p style={{ color: '#475569', fontSize: '0.8rem', margin: 0 }}>
                        Essayez un autre terme de recherche.
                    </p>
                </div>
            )}
        </DashboardLayout>
    );
}
