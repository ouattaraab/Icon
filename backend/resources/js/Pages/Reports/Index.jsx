import { router } from '@inertiajs/react';
import { useState, useMemo } from 'react';
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

const severityColors = {
    info: '#3b82f6',
    warning: '#f59e0b',
    critical: '#ef4444',
};

const eventTypeLabels = {
    prompt: 'Prompt',
    response: 'Réponse',
    block: 'Blocage',
    clipboard_block: 'Clipboard bloqué',
    clipboard_alert: 'Clipboard alerte',
    clipboard_log: 'Clipboard log',
    alert: 'Alerte',
};

const eventTypeColors = {
    prompt: '#3b82f6',
    response: '#8b5cf6',
    block: '#ef4444',
    clipboard_block: '#dc2626',
    clipboard_alert: '#f59e0b',
    clipboard_log: '#94a3b8',
    alert: '#f97316',
};

export default function ReportsIndex({ stats, platformUsage, alertsTrend, topMachines, eventTypes, dailyEvents, severityDistribution, filters }) {
    const [dateFrom, setDateFrom] = useState(filters?.date_from || '');
    const [dateTo, setDateTo] = useState(filters?.date_to || '');

    const applyDates = () => {
        router.get('/reports', { date_from: dateFrom, date_to: dateTo }, { preserveState: true, replace: true });
    };

    // Compute totals for percentage calculations
    const totalPlatformEvents = useMemo(() =>
        (platformUsage || []).reduce((sum, p) => sum + p.count, 0), [platformUsage]);

    const totalEventsByType = useMemo(() =>
        (eventTypes || []).reduce((sum, e) => sum + e.count, 0), [eventTypes]);

    // Max daily value for scaling the timeline chart
    const maxDaily = useMemo(() =>
        Math.max(1, ...(dailyEvents || []).map(d => d.total)), [dailyEvents]);

    return (
        <DashboardLayout title="Rapports & Statistiques">
            {/* Date filter + Export */}
            <div style={{
                display: 'flex', gap: '0.75rem', alignItems: 'center',
                marginBottom: '1.5rem', flexWrap: 'wrap',
            }}>
                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Période :</span>
                <input
                    type="date" value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    style={dateInputStyle}
                />
                <span style={{ color: '#64748b' }}>—</span>
                <input
                    type="date" value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    style={dateInputStyle}
                />
                <button onClick={applyDates} style={{
                    background: '#3b82f6', color: '#fff', border: 'none',
                    borderRadius: 6, padding: '0.4rem 0.75rem', cursor: 'pointer',
                    fontSize: '0.8rem', fontWeight: 600,
                }}>
                    Appliquer
                </button>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <ExportButton label="CSV événements" type="events" filters={filters} />
                    <ExportButton label="CSV alertes" type="alerts" filters={filters} />
                    <ExportButton label="CSV machines" type="machines" filters={filters} />
                    <PdfExportButton filters={filters} />
                </div>
            </div>

            {/* Summary stats */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '1rem', marginBottom: '1.5rem',
            }}>
                <StatCard label="Machines actives" value={stats.total_machines} color="#3b82f6" />
                <StatCard label="En ligne" value={stats.online_machines} color="#22c55e" />
                <StatCard label="Événements" value={stats.total_events} color="#8b5cf6" />
                <StatCard label="Blocages" value={stats.blocked_events} color="#ef4444" />
                <StatCard label="Alertes ouvertes" value={stats.open_alerts} color="#f59e0b" />
                <StatCard label="Alertes critiques" value={stats.critical_alerts} color="#dc2626" />
            </div>

            {/* Row 1: Daily timeline */}
            {dailyEvents?.length > 0 && (
                <div style={{ ...cardStyle, marginBottom: '1rem' }}>
                    <h3 style={{ color: '#f8fafc', margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>
                        Activité quotidienne
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
                        {dailyEvents.map((day) => {
                            const height = Math.max(4, (day.total / maxDaily) * 100);
                            const blockedPct = day.total > 0 ? (day.blocked / day.total) * 100 : 0;
                            return (
                                <div
                                    key={day.date}
                                    title={`${day.date}\n${day.total} événements\n${day.blocked} blocages\n${day.critical} critiques`}
                                    style={{
                                        flex: 1,
                                        minWidth: 4,
                                        maxWidth: 24,
                                        height: `${height}%`,
                                        borderRadius: '3px 3px 0 0',
                                        background: day.critical > 0
                                            ? `linear-gradient(to top, #ef4444 ${blockedPct}%, #3b82f6 ${blockedPct}%)`
                                            : day.blocked > 0
                                                ? `linear-gradient(to top, #f59e0b ${blockedPct}%, #3b82f6 ${blockedPct}%)`
                                                : '#3b82f6',
                                        cursor: 'default',
                                        transition: 'height 0.2s ease',
                                    }}
                                />
                            );
                        })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                        <span style={{ color: '#64748b', fontSize: '0.65rem' }}>
                            {dailyEvents[0]?.date?.slice(5)}
                        </span>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <Legend color="#3b82f6" label="Normal" />
                            <Legend color="#f59e0b" label="Blocage" />
                            <Legend color="#ef4444" label="Critique" />
                        </div>
                        <span style={{ color: '#64748b', fontSize: '0.65rem' }}>
                            {dailyEvents[dailyEvents.length - 1]?.date?.slice(5)}
                        </span>
                    </div>
                </div>
            )}

            {/* Row 2: Platform + Event types + Severity */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                {/* Platform usage (donut-like) */}
                <div style={cardStyle}>
                    <h3 style={{ color: '#f8fafc', margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>
                        Plateformes IA
                    </h3>
                    {platformUsage?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {platformUsage.map((item) => {
                                const pct = totalPlatformEvents > 0
                                    ? Math.round((item.count / totalPlatformEvents) * 100) : 0;
                                const color = platformColors[item.platform?.toLowerCase()] || '#64748b';
                                return (
                                    <div key={item.platform}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                                            <span style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 500 }}>
                                                {item.platform}
                                            </span>
                                            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                                                {item.count} ({pct}%)
                                            </span>
                                        </div>
                                        <div style={{ height: 6, borderRadius: 3, background: '#0f172a' }}>
                                            <div style={{
                                                height: '100%', width: `${pct}%`,
                                                borderRadius: 3, background: color,
                                                transition: 'width 0.3s',
                                            }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <EmptyState text="Aucune donnée" />
                    )}
                </div>

                {/* Event types breakdown */}
                <div style={cardStyle}>
                    <h3 style={{ color: '#f8fafc', margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>
                        Types d'événements
                    </h3>
                    {eventTypes?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {eventTypes.map((item) => {
                                const pct = totalEventsByType > 0
                                    ? Math.round((item.count / totalEventsByType) * 100) : 0;
                                const color = eventTypeColors[item.event_type] || '#64748b';
                                return (
                                    <div key={item.event_type}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                                            <span style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 500 }}>
                                                {eventTypeLabels[item.event_type] || item.event_type}
                                            </span>
                                            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                                                {item.count} ({pct}%)
                                            </span>
                                        </div>
                                        <div style={{ height: 6, borderRadius: 3, background: '#0f172a' }}>
                                            <div style={{
                                                height: '100%', width: `${pct}%`,
                                                borderRadius: 3, background: color,
                                                transition: 'width 0.3s',
                                            }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <EmptyState text="Aucune donnée" />
                    )}
                </div>

                {/* Severity distribution */}
                <div style={cardStyle}>
                    <h3 style={{ color: '#f8fafc', margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>
                        Sévérité
                    </h3>
                    {severityDistribution?.length > 0 ? (
                        <>
                            {/* Visual blocks */}
                            <div style={{ display: 'flex', gap: 3, height: 32, borderRadius: 6, overflow: 'hidden', marginBottom: '0.75rem' }}>
                                {severityDistribution.map((item) => {
                                    const total = severityDistribution.reduce((s, i) => s + i.count, 0);
                                    const pct = total > 0 ? (item.count / total) * 100 : 0;
                                    return (
                                        <div
                                            key={item.severity}
                                            title={`${item.severity}: ${item.count}`}
                                            style={{
                                                width: `${pct}%`,
                                                minWidth: pct > 0 ? 8 : 0,
                                                background: severityColors[item.severity] || '#64748b',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.65rem', color: '#fff', fontWeight: 700,
                                            }}
                                        >
                                            {pct >= 10 ? `${Math.round(pct)}%` : ''}
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                {severityDistribution.map((item) => (
                                    <div key={item.severity} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <div style={{
                                                width: 8, height: 8, borderRadius: 2,
                                                background: severityColors[item.severity] || '#64748b',
                                            }} />
                                            <span style={{ color: '#e2e8f0', fontSize: '0.8rem', textTransform: 'capitalize' }}>
                                                {item.severity}
                                            </span>
                                        </div>
                                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
                                            {item.count}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <EmptyState text="Aucune donnée" />
                    )}
                </div>
            </div>

            {/* Row 3: Alerts trend + Top machines */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Alerts trend */}
                <div style={cardStyle}>
                    <h3 style={{ color: '#f8fafc', margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>
                        Tendance des alertes
                    </h3>
                    {alertsTrend?.length > 0 ? (
                        <AlertsTrendChart alertsTrend={alertsTrend} />
                    ) : (
                        <EmptyState text="Aucune alerte pour cette période" />
                    )}
                </div>

                {/* Top machines */}
                <div style={cardStyle}>
                    <h3 style={{ color: '#f8fafc', margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>
                        Top 10 machines
                    </h3>
                    {topMachines?.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #334155' }}>
                                    {['#', 'Hostname', 'Utilisateur', 'Événements'].map((h) => (
                                        <th key={h} style={{
                                            padding: '0.5rem 0.5rem', textAlign: 'left',
                                            color: '#94a3b8', fontSize: '0.65rem',
                                            textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600,
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {topMachines.map((item, idx) => {
                                    const maxCount = topMachines[0]?.event_count || 1;
                                    const barPct = Math.round((item.event_count / maxCount) * 100);
                                    return (
                                        <tr
                                            key={item.machine_id}
                                            style={{ borderBottom: '1px solid #0f172a', cursor: 'pointer' }}
                                            onClick={() => router.visit(`/machines/${item.machine_id}`)}
                                        >
                                            <td style={{ padding: '0.45rem 0.5rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, width: 30 }}>
                                                {idx + 1}
                                            </td>
                                            <td style={{ padding: '0.45rem 0.5rem', color: '#f8fafc', fontSize: '0.8rem', fontWeight: 500 }}>
                                                {item.machine?.hostname || item.machine_id?.slice(0, 8)}
                                            </td>
                                            <td style={{ padding: '0.45rem 0.5rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                                                {item.machine?.assigned_user || '—'}
                                            </td>
                                            <td style={{ padding: '0.45rem 0.5rem', width: '35%' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#0f172a' }}>
                                                        <div style={{
                                                            height: '100%', width: `${barPct}%`,
                                                            borderRadius: 3, background: '#3b82f6',
                                                        }} />
                                                    </div>
                                                    <span style={{ color: '#f8fafc', fontSize: '0.75rem', fontWeight: 700, minWidth: 30, textAlign: 'right' }}>
                                                        {item.event_count}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <EmptyState text="Aucune activité" />
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}

function AlertsTrendChart({ alertsTrend }) {
    const grouped = useMemo(() => {
        const map = {};
        for (const item of alertsTrend) {
            if (!map[item.date]) map[item.date] = { critical: 0, warning: 0 };
            map[item.date][item.severity] = (map[item.date][item.severity] || 0) + item.count;
        }
        return Object.entries(map).slice(-21);
    }, [alertsTrend]);

    const maxVal = Math.max(1, ...grouped.map(([, c]) => c.critical + c.warning));

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100 }}>
                {grouped.map(([date, counts]) => {
                    const total = counts.critical + counts.warning;
                    const height = Math.max(4, (total / maxVal) * 100);
                    const critPct = total > 0 ? (counts.critical / total) * 100 : 0;
                    return (
                        <div
                            key={date}
                            title={`${date}\nCritique: ${counts.critical}\nWarning: ${counts.warning}`}
                            style={{
                                flex: 1, minWidth: 4, maxWidth: 20,
                                height: `${height}%`,
                                borderRadius: '3px 3px 0 0',
                                background: counts.critical > 0
                                    ? `linear-gradient(to top, #ef4444 ${critPct}%, #f59e0b ${critPct}%)`
                                    : '#f59e0b',
                                cursor: 'default',
                            }}
                        />
                    );
                })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.65rem' }}>
                    {grouped[0]?.[0]?.slice(5)}
                </span>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <Legend color="#ef4444" label="Critique" />
                    <Legend color="#f59e0b" label="Warning" />
                </div>
                <span style={{ color: '#64748b', fontSize: '0.65rem' }}>
                    {grouped[grouped.length - 1]?.[0]?.slice(5)}
                </span>
            </div>
        </>
    );
}

function StatCard({ label, value, color }) {
    return (
        <div style={{
            background: '#1e293b', borderRadius: 12,
            border: '1px solid #334155', padding: '1rem',
        }}>
            <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 500 }}>{label}</span>
            <p style={{ color, fontSize: '1.75rem', fontWeight: 700, margin: '0.2rem 0 0' }}>{value}</p>
        </div>
    );
}

function Legend({ color, label }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            <span style={{ color: '#94a3b8', fontSize: '0.65rem' }}>{label}</span>
        </div>
    );
}

function EmptyState({ text }) {
    return <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>{text}</p>;
}

const dateInputStyle = {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
    padding: '0.4rem 0.75rem', color: '#f8fafc', fontSize: '0.8rem',
};

function ExportButton({ label, type, filters }) {
    return (
        <button
            onClick={() => {
                const params = new URLSearchParams({
                    type, date_from: filters?.date_from || '', date_to: filters?.date_to || '',
                });
                window.location.href = `/reports/export?${params.toString()}`;
            }}
            style={{
                background: '#334155', color: '#e2e8f0', border: '1px solid #475569',
                borderRadius: 6, padding: '0.35rem 0.6rem', cursor: 'pointer',
                fontSize: '0.7rem', fontWeight: 500,
            }}
        >
            {label}
        </button>
    );
}

function PdfExportButton({ filters }) {
    return (
        <button
            onClick={() => {
                const params = new URLSearchParams({
                    date_from: filters?.date_from || '', date_to: filters?.date_to || '',
                });
                window.location.href = `/reports/export-pdf?${params.toString()}`;
            }}
            style={{
                background: '#7c3aed', color: '#fff', border: 'none',
                borderRadius: 6, padding: '0.35rem 0.6rem', cursor: 'pointer',
                fontSize: '0.7rem', fontWeight: 600,
            }}
        >
            PDF Rapport
        </button>
    );
}
