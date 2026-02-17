import { router } from '@inertiajs/react';
import DashboardLayout from '../../Layouts/DashboardLayout';

const cardStyle = {
    background: '#1e293b',
    borderRadius: 12,
    border: '1px solid #334155',
    padding: '1.5rem',
};

const platformColors = {
    chatgpt: '#10a37f',
    openai: '#10a37f',
    claude: '#d97706',
    anthropic: '#d97706',
    copilot: '#3b82f6',
    gemini: '#8b5cf6',
    huggingface: '#fbbf24',
    perplexity: '#22d3ee',
    mistral: '#f97316',
};

export default function ReportsIndex({ stats, platformUsage, alertsTrend, topMachines, filters }) {
    return (
        <DashboardLayout title="Rapports & Statistiques">
            {/* Date filter + Export */}
            <div style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'center',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
            }}>
                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Période :</span>
                <input
                    type="date"
                    defaultValue={filters?.date_from}
                    onChange={(e) => router.get('/reports', { ...filters, date_from: e.target.value }, { preserveState: true, replace: true })}
                    style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        padding: '0.4rem 0.75rem',
                        color: '#f8fafc',
                        fontSize: '0.8rem',
                    }}
                />
                <span style={{ color: '#64748b' }}>—</span>
                <input
                    type="date"
                    defaultValue={filters?.date_to}
                    onChange={(e) => router.get('/reports', { ...filters, date_to: e.target.value }, { preserveState: true, replace: true })}
                    style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        padding: '0.4rem 0.75rem',
                        color: '#f8fafc',
                        fontSize: '0.8rem',
                    }}
                />

                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <ExportButton label="Export événements" type="events" filters={filters} />
                    <ExportButton label="Export alertes" type="alerts" filters={filters} />
                    <ExportButton label="Export machines" type="machines" filters={filters} />
                </div>
            </div>

            {/* Summary stats */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem',
            }}>
                <StatCard label="Machines actives" value={stats.total_machines} color="#3b82f6" />
                <StatCard label="En ligne" value={stats.online_machines} color="#22c55e" />
                <StatCard label="Événements" value={stats.total_events} color="#8b5cf6" />
                <StatCard label="Blocages" value={stats.blocked_events} color="#ef4444" />
                <StatCard label="Alertes ouvertes" value={stats.open_alerts} color="#f59e0b" />
                <StatCard label="Alertes critiques" value={stats.critical_alerts} color="#dc2626" />
            </div>

            {/* Charts row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Platform usage */}
                <div style={cardStyle}>
                    <h3 style={{ color: '#f8fafc', margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: 600 }}>
                        Usage par plateforme IA
                    </h3>
                    {platformUsage?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {platformUsage.map((item) => {
                                const maxCount = platformUsage[0]?.count || 1;
                                const pct = Math.round((item.count / maxCount) * 100);
                                return (
                                    <div key={item.platform}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                            <span style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 500 }}>
                                                {item.platform}
                                            </span>
                                            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                                                {item.count}
                                            </span>
                                        </div>
                                        <div style={{
                                            height: 8,
                                            borderRadius: 4,
                                            background: '#0f172a',
                                            overflow: 'hidden',
                                        }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${pct}%`,
                                                borderRadius: 4,
                                                background: platformColors[item.platform] || '#64748b',
                                                transition: 'width 0.3s ease',
                                            }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p style={{ color: '#64748b', fontSize: '0.8rem' }}>Aucune donnée pour cette période.</p>
                    )}
                </div>

                {/* Alerts trend */}
                <div style={cardStyle}>
                    <h3 style={{ color: '#f8fafc', margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: 600 }}>
                        Tendance des alertes
                    </h3>
                    {alertsTrend?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {/* Group by date */}
                            {Object.entries(
                                alertsTrend.reduce((acc, item) => {
                                    if (!acc[item.date]) acc[item.date] = { critical: 0, warning: 0 };
                                    acc[item.date][item.severity] = item.count;
                                    return acc;
                                }, {})
                            ).slice(-14).map(([date, counts]) => (
                                <div key={date} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ color: '#64748b', fontSize: '0.7rem', width: 70, flexShrink: 0 }}>
                                        {date.slice(5)}
                                    </span>
                                    <div style={{ flex: 1, display: 'flex', gap: '0.25rem', height: 16 }}>
                                        {counts.critical > 0 && (
                                            <div style={{
                                                width: counts.critical * 8,
                                                maxWidth: '60%',
                                                background: '#ef4444',
                                                borderRadius: 3,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.6rem',
                                                color: '#fff',
                                                fontWeight: 600,
                                            }}>
                                                {counts.critical}
                                            </div>
                                        )}
                                        {counts.warning > 0 && (
                                            <div style={{
                                                width: counts.warning * 8,
                                                maxWidth: '60%',
                                                background: '#f59e0b',
                                                borderRadius: 3,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.6rem',
                                                color: '#fff',
                                                fontWeight: 600,
                                            }}>
                                                {counts.warning}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                <Legend color="#ef4444" label="Critique" />
                                <Legend color="#f59e0b" label="Warning" />
                            </div>
                        </div>
                    ) : (
                        <p style={{ color: '#64748b', fontSize: '0.8rem' }}>Aucune alerte pour cette période.</p>
                    )}
                </div>
            </div>

            {/* Top machines */}
            <div style={cardStyle}>
                <h3 style={{ color: '#f8fafc', margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>
                    Top 10 machines par activité IA
                </h3>
                {topMachines?.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #334155' }}>
                                {['#', 'Hostname', 'Utilisateur', 'Département', 'Événements'].map((h) => (
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
                            {topMachines.map((item, idx) => (
                                <tr
                                    key={item.machine_id}
                                    style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer' }}
                                    onClick={() => router.visit(`/machines/${item.machine_id}`)}
                                >
                                    <td style={{ padding: '0.6rem 0.75rem', color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>
                                        {idx + 1}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', color: '#f8fafc', fontSize: '0.8rem', fontWeight: 500 }}>
                                        {item.machine?.hostname || item.machine_id?.slice(0, 12)}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                        {item.machine?.assigned_user || '—'}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                        {item.machine?.department || '—'}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <span style={{
                                            color: '#f8fafc',
                                            fontSize: '0.85rem',
                                            fontWeight: 700,
                                        }}>
                                            {item.event_count}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p style={{ color: '#64748b', fontSize: '0.8rem' }}>Aucune activité pour cette période.</p>
                )}
            </div>
        </DashboardLayout>
    );
}

function StatCard({ label, value, color }) {
    return (
        <div style={{
            background: '#1e293b',
            borderRadius: 12,
            border: '1px solid #334155',
            padding: '1rem',
        }}>
            <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 500 }}>
                {label}
            </span>
            <p style={{ color, fontSize: '1.75rem', fontWeight: 700, margin: '0.2rem 0 0' }}>
                {value}
            </p>
        </div>
    );
}

function Legend({ color, label }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{label}</span>
        </div>
    );
}

function ExportButton({ label, type, filters }) {
    const handleExport = () => {
        const params = new URLSearchParams({
            type,
            date_from: filters?.date_from || '',
            date_to: filters?.date_to || '',
        });
        window.location.href = `/reports/export?${params.toString()}`;
    };

    return (
        <button
            onClick={handleExport}
            style={{
                background: '#334155',
                color: '#e2e8f0',
                border: '1px solid #475569',
                borderRadius: 6,
                padding: '0.4rem 0.75rem',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
            }}
        >
            {'\u{2b07}\u{fe0f}'} {label}
        </button>
    );
}
