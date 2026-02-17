import { Link } from '@inertiajs/react';
import DashboardLayout from '../../Layouts/DashboardLayout';

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
    critical: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
};

const cardStyle = {
    background: '#1e293b',
    borderRadius: 12,
    padding: '1.5rem',
    border: '1px solid #334155',
};

function StatCard({ label, value, color = '#3b82f6', subtitle, href }) {
    const content = (
        <div style={cardStyle}>
            <p style={{
                color: '#94a3b8',
                fontSize: '0.75rem',
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: 1,
                fontWeight: 600,
            }}>
                {label}
            </p>
            <p style={{
                color,
                fontSize: '2rem',
                fontWeight: 700,
                margin: '0.5rem 0 0',
            }}>
                {value}
            </p>
            {subtitle && (
                <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
                    {subtitle}
                </p>
            )}
        </div>
    );

    if (href) {
        return (
            <Link href={href} style={{ textDecoration: 'none' }}>
                {content}
            </Link>
        );
    }
    return content;
}

export default function DashboardIndex({
    stats = {},
    activity24h = [],
    platformUsage = [],
    recentAlerts = [],
    topMachines = [],
}) {
    const maxActivity = Math.max(1, ...activity24h.map((h) => h.count));

    return (
        <DashboardLayout title="Tableau de bord">
            {/* Stats grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '2rem',
            }}>
                <StatCard
                    label="Machines en ligne"
                    value={stats.online_machines ?? 0}
                    color="#22c55e"
                    subtitle={`${stats.total_machines ?? 0} enregistrées`}
                    href="/machines"
                />
                <StatCard
                    label="Événements (30j)"
                    value={stats.total_events ?? 0}
                    color="#3b82f6"
                    href="/exchanges"
                />
                <StatCard
                    label="Requêtes bloquées"
                    value={stats.blocked_events ?? 0}
                    color="#f59e0b"
                />
                <StatCard
                    label="Alertes ouvertes"
                    value={stats.open_alerts ?? 0}
                    color={(stats.critical_alerts ?? 0) > 0 ? '#ef4444' : '#94a3b8'}
                    subtitle={(stats.critical_alerts ?? 0) > 0 ? `${stats.critical_alerts} critiques` : null}
                    href="/alerts"
                />
            </div>

            {/* Charts row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr',
                gap: '1rem',
                marginBottom: '1.5rem',
            }}>
                {/* Activity last 24h */}
                <div style={{ ...cardStyle, minHeight: 280 }}>
                    <h3 style={{ color: '#f8fafc', fontSize: '1rem', margin: '0 0 1.25rem', fontWeight: 600 }}>
                        Activité des dernières 24h
                    </h3>
                    {activity24h.length > 0 ? (
                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: 2,
                            height: 180,
                            paddingTop: 8,
                        }}>
                            {activity24h.map((item, idx) => {
                                const pct = Math.max(2, (item.count / maxActivity) * 100);
                                return (
                                    <div
                                        key={idx}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            height: '100%',
                                            justifyContent: 'flex-end',
                                        }}
                                    >
                                        <span style={{
                                            color: '#94a3b8',
                                            fontSize: '0.55rem',
                                            marginBottom: 4,
                                        }}>
                                            {item.count > 0 ? item.count : ''}
                                        </span>
                                        <div
                                            style={{
                                                width: '100%',
                                                maxWidth: 24,
                                                height: `${pct}%`,
                                                background: 'linear-gradient(to top, #3b82f6, #60a5fa)',
                                                borderRadius: '4px 4px 0 0',
                                                minHeight: 2,
                                                transition: 'height 0.3s ease',
                                            }}
                                            title={`${item.hour}: ${item.count} événements`}
                                        />
                                        <span style={{
                                            color: '#64748b',
                                            fontSize: '0.55rem',
                                            marginTop: 4,
                                            transform: 'rotate(-45deg)',
                                            transformOrigin: 'center',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {item.hour}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{
                            height: 180,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <p style={{ color: '#475569', fontSize: '0.85rem' }}>
                                Aucune activité dans les dernières 24h
                            </p>
                        </div>
                    )}
                </div>

                {/* Platform usage */}
                <div style={{ ...cardStyle, minHeight: 280 }}>
                    <h3 style={{ color: '#f8fafc', fontSize: '1rem', margin: '0 0 1.25rem', fontWeight: 600 }}>
                        Usage par plateforme
                    </h3>
                    {platformUsage.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                            {platformUsage.map((item) => {
                                const maxCount = platformUsage[0]?.count || 1;
                                const pct = Math.round((item.count / maxCount) * 100);
                                const color = platformColors[item.platform] || '#64748b';
                                return (
                                    <div key={item.platform}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginBottom: '0.2rem',
                                        }}>
                                            <span style={{
                                                color: '#e2e8f0',
                                                fontSize: '0.8rem',
                                                fontWeight: 500,
                                                textTransform: 'capitalize',
                                            }}>
                                                {item.platform}
                                            </span>
                                            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
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
                                                background: color,
                                                transition: 'width 0.3s ease',
                                            }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{
                            height: 160,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <p style={{ color: '#475569', fontSize: '0.85rem' }}>
                                Aucune donnée de plateforme
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom row: Recent alerts + Top machines */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
            }}>
                {/* Recent open alerts */}
                <div style={cardStyle}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1rem',
                    }}>
                        <h3 style={{ color: '#f8fafc', fontSize: '1rem', margin: 0, fontWeight: 600 }}>
                            Alertes récentes
                        </h3>
                        <Link
                            href="/alerts"
                            style={{
                                color: '#3b82f6',
                                fontSize: '0.75rem',
                                textDecoration: 'none',
                                fontWeight: 500,
                            }}
                        >
                            Voir tout
                        </Link>
                    </div>
                    {recentAlerts.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {recentAlerts.map((alert) => (
                                <Link
                                    key={alert.id}
                                    href="/alerts"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.6rem 0.75rem',
                                        background: '#0f172a',
                                        borderRadius: 8,
                                        textDecoration: 'none',
                                        border: '1px solid transparent',
                                        transition: 'border-color 0.15s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#334155'}
                                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                                >
                                    <div style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: severityColors[alert.severity] || '#64748b',
                                        flexShrink: 0,
                                    }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{
                                            color: '#e2e8f0',
                                            fontSize: '0.8rem',
                                            margin: 0,
                                            fontWeight: 500,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}>
                                            {alert.title}
                                        </p>
                                        <p style={{
                                            color: '#64748b',
                                            fontSize: '0.7rem',
                                            margin: '0.15rem 0 0',
                                        }}>
                                            {alert.machine} &middot; {alert.created_at}
                                        </p>
                                    </div>
                                    <span style={{
                                        fontSize: '0.6rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: 0.5,
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: 4,
                                        background: alert.severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                                        color: severityColors[alert.severity] || '#64748b',
                                        flexShrink: 0,
                                    }}>
                                        {alert.severity}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div style={{
                            padding: '2rem 0',
                            textAlign: 'center',
                        }}>
                            <p style={{ color: '#475569', fontSize: '0.85rem', margin: 0 }}>
                                Aucune alerte ouverte
                            </p>
                        </div>
                    )}
                </div>

                {/* Top machines */}
                <div style={cardStyle}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1rem',
                    }}>
                        <h3 style={{ color: '#f8fafc', fontSize: '1rem', margin: 0, fontWeight: 600 }}>
                            Top machines (7j)
                        </h3>
                        <Link
                            href="/machines"
                            style={{
                                color: '#3b82f6',
                                fontSize: '0.75rem',
                                textDecoration: 'none',
                                fontWeight: 500,
                            }}
                        >
                            Voir tout
                        </Link>
                    </div>
                    {topMachines.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {topMachines.map((item, idx) => {
                                const maxCount = topMachines[0]?.event_count || 1;
                                const pct = Math.round((item.event_count / maxCount) * 100);
                                return (
                                    <Link
                                        key={item.machine_id}
                                        href={`/machines/${item.machine_id}`}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.6rem 0.75rem',
                                            background: '#0f172a',
                                            borderRadius: 8,
                                            textDecoration: 'none',
                                            border: '1px solid transparent',
                                            transition: 'border-color 0.15s',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#334155'}
                                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                                    >
                                        <span style={{
                                            color: '#475569',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            width: 20,
                                            textAlign: 'center',
                                            flexShrink: 0,
                                        }}>
                                            {idx + 1}
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{
                                                color: '#e2e8f0',
                                                fontSize: '0.8rem',
                                                margin: 0,
                                                fontWeight: 500,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                            }}>
                                                {item.hostname}
                                            </p>
                                            <div style={{
                                                height: 4,
                                                borderRadius: 2,
                                                background: '#1e293b',
                                                marginTop: 4,
                                                overflow: 'hidden',
                                            }}>
                                                <div style={{
                                                    height: '100%',
                                                    width: `${pct}%`,
                                                    borderRadius: 2,
                                                    background: '#3b82f6',
                                                    transition: 'width 0.3s ease',
                                                }} />
                                            </div>
                                        </div>
                                        <span style={{
                                            color: '#94a3b8',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            flexShrink: 0,
                                        }}>
                                            {item.event_count}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{
                            padding: '2rem 0',
                            textAlign: 'center',
                        }}>
                            <p style={{ color: '#475569', fontSize: '0.85rem', margin: 0 }}>
                                Aucune activité cette semaine
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
