import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import DashboardLayout from '../../Layouts/DashboardLayout';
import { useTheme } from '../../Contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';

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
    const { theme: t } = useTheme();
    const isMobile = useIsMobile();
    const [wsConnected, setWsConnected] = useState(false);

    // Real-time Echo/WebSocket listener for new alerts
    useEffect(() => {
        if (typeof window === 'undefined' || !window.Echo) return;

        const channel = window.Echo.channel('icon.dashboard');

        channel.subscribed(() => setWsConnected(true));

        channel.listen('.alert.created', () => {
            // Reload only the alerts-related props to refresh the list
            router.reload({ only: ['alerts', 'openCount', 'criticalCount'] });
        });

        channel.listen('.alert.status_changed', () => {
            router.reload({ only: ['alerts', 'openCount', 'criticalCount'] });
        });

        return () => {
            channel.stopListening('.alert.created');
            channel.stopListening('.alert.status_changed');
            setWsConnected(false);
        };
    }, []);

    return (
        <DashboardLayout title="Centre d'alertes">
            {/* WebSocket connection status */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem',
            }}>
                <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: wsConnected ? t.success : t.accent,
                    display: 'inline-block',
                    boxShadow: wsConnected ? `0 0 6px ${t.success}` : 'none',
                    animation: 'pulse 2s infinite',
                }} />
                <span style={{ color: t.textFaint, fontSize: '0.75rem' }}>
                    {wsConnected ? 'Temps réel actif' : 'Connexion en cours...'}
                </span>
            </div>

            {/* Summary */}
            <div className="icon-stat-grid" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{
                    background: t.surface,
                    borderRadius: 8,
                    padding: '1rem 1.5rem',
                    border: `1px solid ${t.border}`,
                }}>
                    <span style={{ color: t.textMuted, fontSize: '0.8rem' }}>Alertes ouvertes</span>
                    <p style={{ color: t.warning, fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0 0' }}>
                        {openCount}
                    </p>
                </div>
                <div style={{
                    background: t.surface,
                    borderRadius: 8,
                    padding: '1rem 1.5rem',
                    border: criticalCount > 0 ? `1px solid ${t.danger}` : `1px solid ${t.border}`,
                }}>
                    <span style={{ color: t.textMuted, fontSize: '0.8rem' }}>Critiques</span>
                    <p style={{ color: t.danger, fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0 0' }}>
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
                        background: t.surface, border: `1px solid ${t.border}`,
                        borderRadius: 8, padding: '0.5rem 1rem', color: t.text, fontSize: '0.875rem',
                        ...(isMobile ? { width: '100%' } : {}),
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
                        background: t.surface, border: `1px solid ${t.border}`,
                        borderRadius: 8, padding: '0.5rem 1rem', color: t.text, fontSize: '0.875rem',
                        ...(isMobile ? { width: '100%' } : {}),
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
                            background: t.surface,
                            borderRadius: 8,
                            padding: isMobile ? '0.75rem 1rem' : '1rem 1.25rem',
                            border: `1px solid ${t.border}`,
                            display: 'flex',
                            alignItems: isMobile ? 'flex-start' : 'center',
                            flexDirection: isMobile ? 'column' : 'row',
                            gap: isMobile ? '0.5rem' : '1rem',
                            cursor: 'pointer',
                            transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = t.textSubtle}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = t.border}>
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
                                <p style={{ color: t.text, fontSize: '0.875rem', margin: 0, fontWeight: 500 }}>
                                    {alert.title}
                                </p>
                                {!isMobile && (
                                    <p style={{ color: t.textFaint, fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
                                        {alert.machine?.hostname} — {alert.rule?.name || 'N/A'}
                                    </p>
                                )}
                            </div>
                            <span style={{ color: t.textFaint, fontSize: '0.75rem' }}>
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
                                            background: t.accent, color: '#fff', border: 'none',
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
                                            background: t.success, color: '#fff', border: 'none',
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
            {/* CSS animation for pulse */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
            `}</style>
        </DashboardLayout>
    );
}
