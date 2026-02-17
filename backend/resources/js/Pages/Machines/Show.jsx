import { router } from '@inertiajs/react';
import { useState } from 'react';
import DashboardLayout from '../../Layouts/DashboardLayout';

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
    acknowledged: 'Acquittée',
    resolved: 'Résolue',
};

const alertStatusColors = {
    open: '#ef4444',
    acknowledged: '#f59e0b',
    resolved: '#22c55e',
};

const cardStyle = {
    background: '#1e293b',
    borderRadius: 12,
    border: '1px solid #334155',
    padding: '1.5rem',
};

export default function MachinesShow({ machine, stats, alerts = [] }) {
    const [activeTab, setActiveTab] = useState('events');

    const machineStatus = machine.last_heartbeat &&
        new Date(machine.last_heartbeat) > new Date(Date.now() - 5 * 60 * 1000)
        ? 'online' : machine.status;

    const openAlerts = alerts.filter(a => a.status === 'open').length;

    return (
        <DashboardLayout title={machine.hostname}>
            {/* Back button */}
            <button
                onClick={() => router.visit('/machines')}
                style={{
                    background: 'transparent', color: '#94a3b8', border: 'none',
                    cursor: 'pointer', fontSize: '0.875rem', marginBottom: '1rem',
                    padding: 0,
                }}
            >
                &larr; Retour au parc machines
            </button>

            {/* Machine header */}
            <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h2 style={{ color: '#f8fafc', margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
                            {machine.hostname}
                        </h2>
                        <p style={{ color: '#94a3b8', margin: '0.5rem 0 0', fontSize: '0.875rem' }}>
                            {machine.os} {machine.os_version} | Agent v{machine.agent_version}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                            onClick={() => router.visit(`/exchanges?machine_id=${machine.id}`)}
                            style={{
                                background: '#334155',
                                color: '#e2e8f0',
                                border: 'none',
                                borderRadius: 6,
                                padding: '0.4rem 0.75rem',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                            }}
                        >
                            Voir les échanges
                        </button>
                        <span style={{
                            padding: '0.3rem 0.8rem',
                            borderRadius: 20,
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#fff',
                            background: statusColors[machineStatus] || '#94a3b8',
                        }}>
                            {machineStatus}
                        </span>
                    </div>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginTop: '1.5rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid #334155',
                }}>
                    <InfoItem label="Adresse IP" value={machine.ip_address || '—'} />
                    <InfoItem label="Département" value={machine.department || '—'} />
                    <InfoItem label="Utilisateur assigné" value={machine.assigned_user || '—'} />
                    <InfoItem label="Dernier contact" value={machine.last_heartbeat || '—'} />
                    <InfoItem label="Enregistré le" value={machine.created_at?.slice(0, 10) || '—'} />
                    <InfoItem label="ID machine" value={machine.id?.slice(0, 12) + '...'} mono />
                </div>
            </div>

            {/* Stats cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem',
            }}>
                <StatCard label="Total événements" value={stats.total_events} color="#3b82f6" />
                <StatCard label="Blocages" value={stats.blocked_events} color="#ef4444" />
                <StatCard label="Alertes ouvertes" value={stats.alerts_count} color="#f59e0b" />
                <StatCard
                    label="Plateformes utilisées"
                    value={stats.platforms_used?.length || 0}
                    color="#8b5cf6"
                />
            </div>

            {/* Platforms used */}
            {stats.platforms_used?.length > 0 && (
                <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
                    <h3 style={{ color: '#f8fafc', margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>
                        Plateformes IA détectées
                    </h3>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {stats.platforms_used.map((platform) => (
                            <span key={platform} style={{
                                padding: '0.3rem 0.8rem',
                                borderRadius: 20,
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                color: '#e2e8f0',
                                background: '#334155',
                            }}>
                                {platform}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabs: Events / Alerts */}
            <div style={{ display: 'flex', gap: '0', marginBottom: '0' }}>
                <TabButton
                    active={activeTab === 'events'}
                    onClick={() => setActiveTab('events')}
                    label="Événements"
                    count={machine.events?.length}
                />
                <TabButton
                    active={activeTab === 'alerts'}
                    onClick={() => setActiveTab('alerts')}
                    label="Alertes"
                    count={alerts.length}
                    badge={openAlerts > 0 ? openAlerts : null}
                />
            </div>

            {/* Events tab */}
            {activeTab === 'events' && (
                <div style={{ ...cardStyle, borderTopLeftRadius: 0 }}>
                    {machine.events?.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #334155' }}>
                                        {['Type', 'Plateforme', 'Domaine', 'Sévérité', 'Date'].map((h) => (
                                            <th key={h} style={{
                                                padding: '0.6rem 0.75rem',
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
                                    {machine.events.map((event) => (
                                        <tr key={event.id} style={{ borderBottom: '1px solid #0f172a' }}>
                                            <td style={{ padding: '0.6rem 0.75rem' }}>
                                                <span style={{
                                                    padding: '0.15rem 0.5rem',
                                                    borderRadius: 4,
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    color: event.event_type === 'block' ? '#fca5a5' : '#e2e8f0',
                                                    background: event.event_type === 'block' ? '#7f1d1d' : '#334155',
                                                }}>
                                                    {event.event_type}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.6rem 0.75rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                                {event.platform || '—'}
                                            </td>
                                            <td style={{ padding: '0.6rem 0.75rem', color: '#94a3b8', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                                {event.domain || '—'}
                                            </td>
                                            <td style={{ padding: '0.6rem 0.75rem' }}>
                                                {event.severity && (
                                                    <span style={{
                                                        color: severityColors[event.severity] || '#94a3b8',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                    }}>
                                                        {event.severity}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.6rem 0.75rem', color: '#64748b', fontSize: '0.8rem' }}>
                                                {event.occurred_at}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>Aucun événement enregistré.</p>
                    )}
                </div>
            )}

            {/* Alerts tab */}
            {activeTab === 'alerts' && (
                <div style={{ ...cardStyle, borderTopLeftRadius: 0 }}>
                    {alerts.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {alerts.map((alert) => (
                                <div key={alert.id} style={{
                                    background: '#0f172a',
                                    borderRadius: 8,
                                    border: `1px solid ${alert.status === 'open' && alert.severity === 'critical' ? '#7f1d1d' : '#334155'}`,
                                    padding: '1rem',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <span style={{
                                                padding: '0.15rem 0.4rem',
                                                borderRadius: 4,
                                                fontSize: '0.65rem',
                                                fontWeight: 700,
                                                background: alert.severity === 'critical' ? '#7f1d1d' : '#78350f',
                                                color: alert.severity === 'critical' ? '#fca5a5' : '#fcd34d',
                                            }}>
                                                {alert.severity}
                                            </span>
                                            <span style={{
                                                padding: '0.15rem 0.4rem',
                                                borderRadius: 4,
                                                fontSize: '0.65rem',
                                                fontWeight: 600,
                                                color: alertStatusColors[alert.status] || '#94a3b8',
                                                background: `${alertStatusColors[alert.status] || '#94a3b8'}15`,
                                            }}>
                                                {alertStatusLabels[alert.status] || alert.status}
                                            </span>
                                            {alert.rule_name && (
                                                <span style={{
                                                    padding: '0.15rem 0.4rem',
                                                    borderRadius: 4,
                                                    fontSize: '0.65rem',
                                                    fontWeight: 500,
                                                    color: '#fbbf24',
                                                    background: '#422006',
                                                }}>
                                                    {alert.rule_name}
                                                </span>
                                            )}
                                        </div>
                                        <span style={{ color: '#64748b', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                            {alert.created_at}
                                        </span>
                                    </div>
                                    <p style={{ color: '#f8fafc', fontSize: '0.85rem', margin: '0 0 0.25rem', fontWeight: 500 }}>
                                        {alert.title}
                                    </p>
                                    {alert.description && (
                                        <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
                                            {alert.description.substring(0, 200)}
                                            {alert.description.length > 200 ? '...' : ''}
                                        </p>
                                    )}
                                    {alert.acknowledged_at && (
                                        <p style={{ color: '#64748b', fontSize: '0.7rem', margin: '0.5rem 0 0' }}>
                                            Acquittée {alert.acknowledged_at}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>Aucune alerte pour cette machine.</p>
                    )}
                </div>
            )}
        </DashboardLayout>
    );
}

function TabButton({ active, onClick, label, count, badge }) {
    return (
        <button
            onClick={onClick}
            style={{
                background: active ? '#1e293b' : 'transparent',
                color: active ? '#f8fafc' : '#94a3b8',
                border: active ? '1px solid #334155' : '1px solid transparent',
                borderBottom: active ? '1px solid #1e293b' : '1px solid #334155',
                borderRadius: active ? '8px 8px 0 0' : '8px 8px 0 0',
                padding: '0.6rem 1.25rem',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: active ? 600 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                position: 'relative',
                bottom: -1,
            }}
        >
            {label}
            {count != null && (
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>({count})</span>
            )}
            {badge != null && (
                <span style={{
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: 10,
                    padding: '0.1rem 0.4rem',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    minWidth: 18,
                    textAlign: 'center',
                }}>
                    {badge}
                </span>
            )}
        </button>
    );
}

function InfoItem({ label, value, mono }) {
    return (
        <div>
            <span style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                {label}
            </span>
            <p style={{
                color: '#e2e8f0',
                margin: '0.2rem 0 0',
                fontSize: '0.875rem',
                fontFamily: mono ? 'monospace' : 'inherit',
            }}>
                {value}
            </p>
        </div>
    );
}

function StatCard({ label, value, color }) {
    return (
        <div style={{
            background: '#1e293b',
            borderRadius: 12,
            border: '1px solid #334155',
            padding: '1.25rem',
        }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 500 }}>
                {label}
            </span>
            <p style={{ color, fontSize: '2rem', fontWeight: 700, margin: '0.3rem 0 0' }}>
                {value}
            </p>
        </div>
    );
}
