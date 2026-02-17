import { Link } from '@inertiajs/react';
import DashboardLayout from '../../Layouts/DashboardLayout';
import { useTheme } from '../../Contexts/ThemeContext';

const statBox = (color) => ({
    background: `${color}15`,
    border: `1px solid ${color}40`,
    borderRadius: 10,
    padding: '1.25rem',
    textAlign: 'center',
    flex: 1,
});

const statusDot = (color) => ({
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: color,
    marginRight: 6,
});

function StatCard({ label, value, color }) {
    const { theme: t } = useTheme();
    return (
        <div style={statBox(color)}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color }}>{value}</div>
            <div style={{ color: t.textMuted, fontSize: '0.8rem', marginTop: 4 }}>{label}</div>
        </div>
    );
}

function VersionBar({ version, count, total, isCurrent }) {
    const { theme: t } = useTheme();
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: t.textSecondary, fontSize: '0.85rem', fontWeight: 500 }}>
                    v{version}
                    {isCurrent && (
                        <span style={{
                            background: 'rgba(34,197,94,0.15)',
                            color: t.success,
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 6,
                            marginLeft: 8,
                        }}>
                            Cible
                        </span>
                    )}
                </span>
                <span style={{ color: t.textMuted, fontSize: '0.8rem' }}>
                    {count} machine{count > 1 ? 's' : ''} ({pct}%)
                </span>
            </div>
            <div style={{ background: t.bg, borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{
                    width: `${pct}%`,
                    height: '100%',
                    borderRadius: 4,
                    background: isCurrent ? t.success : t.warning,
                    transition: 'width 0.3s',
                }} />
            </div>
        </div>
    );
}

const osLabels = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };
const statusColors = { online: '#22c55e', active: '#3b82f6', inactive: '#64748b', offline: '#ef4444' };
const statusLabels = { online: 'En ligne', active: 'Actif', inactive: 'Inactif', offline: 'Hors ligne' };

export default function AgentVersions({
    targetVersion,
    updateUrl,
    versionDistribution,
    totalMachines,
    upToDate,
    outdated,
    outdatedMachines,
}) {
    const { theme: t } = useTheme();

    const cardStyle = {
        background: t.surface,
        borderRadius: 12,
        padding: '1.5rem',
        border: `1px solid ${t.border}`,
        marginBottom: '1.5rem',
    };

    return (
        <DashboardLayout title="Versions des agents">
            {/* Back link */}
            <Link
                href="/settings"
                style={{
                    color: t.textMuted,
                    textDecoration: 'none',
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: '1.25rem',
                }}
            >
                ← Retour aux paramètres
            </Link>

            {/* Summary stats */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <StatCard label="Total machines" value={totalMachines} color={t.accent} />
                <StatCard label="À jour" value={upToDate} color={t.success} />
                <StatCard label="Obsolètes" value={outdated} color={t.warning} />
            </div>

            {/* Target version info */}
            <div style={cardStyle}>
                <h3 style={{ color: t.text, fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1rem' }}>
                    Version cible
                </h3>
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ color: t.textMuted, fontSize: '0.75rem', marginBottom: 4 }}>Version</div>
                        <div style={{ color: t.success, fontSize: '1.25rem', fontWeight: 700 }}>v{targetVersion}</div>
                    </div>
                    {updateUrl && (
                        <div>
                            <div style={{ color: t.textMuted, fontSize: '0.75rem', marginBottom: 4 }}>URL de mise à jour</div>
                            <div style={{ color: t.textSecondary, fontSize: '0.85rem', wordBreak: 'break-all' }}>{updateUrl}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Version distribution */}
            <div style={cardStyle}>
                <h3 style={{ color: t.text, fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1.25rem' }}>
                    Distribution des versions
                </h3>
                {versionDistribution.length === 0 ? (
                    <p style={{ color: t.textFaint, fontSize: '0.85rem' }}>Aucune machine enregistrée.</p>
                ) : (
                    versionDistribution.map((v) => (
                        <VersionBar
                            key={v.version}
                            version={v.version}
                            count={v.count}
                            total={totalMachines}
                            isCurrent={v.is_current}
                        />
                    ))
                )}
            </div>

            {/* Outdated machines table */}
            {outdatedMachines.length > 0 && (
                <div style={cardStyle}>
                    <h3 style={{ color: t.text, fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1.25rem' }}>
                        Machines obsolètes ({outdated})
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                                    {['Machine', 'OS', 'Version agent', 'Département', 'Statut', 'Dernier heartbeat'].map((h) => (
                                        <th key={h} style={{
                                            padding: '0.6rem 0.75rem',
                                            textAlign: 'left',
                                            color: t.textMuted,
                                            fontWeight: 500,
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {outdatedMachines.map((m) => (
                                    <tr
                                        key={m.id}
                                        style={{ borderBottom: `1px solid ${t.surface}`, cursor: 'pointer' }}
                                        onClick={() => window.location.href = `/machines/${m.id}`}
                                    >
                                        <td style={{ padding: '0.6rem 0.75rem', color: t.textSecondary, fontWeight: 500 }}>
                                            {m.hostname}
                                        </td>
                                        <td style={{ padding: '0.6rem 0.75rem', color: t.textMuted }}>
                                            {osLabels[m.os] || m.os}
                                        </td>
                                        <td style={{ padding: '0.6rem 0.75rem' }}>
                                            <span style={{
                                                background: 'rgba(245,158,11,0.15)',
                                                color: '#f59e0b',
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                padding: '2px 8px',
                                                borderRadius: 6,
                                            }}>
                                                {m.agent_version || 'Inconnue'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.6rem 0.75rem', color: t.textMuted }}>
                                            {m.department || '—'}
                                        </td>
                                        <td style={{ padding: '0.6rem 0.75rem' }}>
                                            <span style={statusDot(statusColors[m.status] || t.textFaint)} />
                                            <span style={{ color: t.textSecondary, fontSize: '0.8rem' }}>
                                                {statusLabels[m.status] || m.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.6rem 0.75rem', color: t.textMuted }}>
                                            {m.last_heartbeat || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
