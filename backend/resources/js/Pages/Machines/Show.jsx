import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import DashboardLayout from '../../Layouts/DashboardLayout';

const statusColors = {
    online: '#22c55e',
    active: '#3b82f6',
    offline: '#ef4444',
    inactive: '#94a3b8',
};

const statusLabels = {
    online: 'En ligne',
    active: 'Actif',
    offline: 'Hors ligne',
    inactive: 'Inactif',
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

const alertStatusColors = {
    open: '#ef4444',
    acknowledged: '#f59e0b',
    resolved: '#22c55e',
};

const eventTypeColors = {
    prompt: '#3b82f6',
    response: '#8b5cf6',
    block: '#ef4444',
    clipboard: '#f59e0b',
    alert: '#ec4899',
};

const eventTypeLabels = {
    prompt: 'Prompts',
    response: 'Reponses',
    block: 'Blocages',
    clipboard: 'Presse-papier',
    alert: 'Alertes',
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

const cardStyle = {
    background: '#1e293b', borderRadius: 12,
    border: '1px solid #334155', padding: '1.5rem',
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

function formatShortDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function MachinesShow({ machine, stats, dailyActivity = [], eventTypes = {}, alerts = [], platformBreakdown = [], hourlyActivity = {}, pendingCommands = [] }) {
    const [activeTab, setActiveTab] = useState('events');
    const [confirmAction, setConfirmAction] = useState(null);
    const [editing, setEditing] = useState(false);
    const [editData, setEditData] = useState({
        department: machine.department || '',
        assigned_user: machine.assigned_user || '',
        notes: machine.notes || '',
    });
    const { auth, flash } = usePage().props;
    const canManage = auth?.is_manager ?? false;

    const handleSaveEdit = () => {
        router.put(`/machines/${machine.id}`, editData, {
            preserveScroll: true,
            onSuccess: () => setEditing(false),
        });
    };

    const handleCancelEdit = () => {
        setEditing(false);
        setEditData({
            department: machine.department || '',
            assigned_user: machine.assigned_user || '',
            notes: machine.notes || '',
        });
    };

    const machineStatus = machine.last_heartbeat &&
        new Date(machine.last_heartbeat) > new Date(Date.now() - 5 * 60 * 1000)
        ? 'online' : machine.status;

    const openAlerts = alerts.filter(a => a.status === 'open').length;

    // Daily activity chart max
    const maxDaily = Math.max(...dailyActivity.map(d => d.total), 1);

    // Event types total for percentages
    const eventTypesTotal = Object.values(eventTypes).reduce((s, v) => s + v, 0);

    // Hourly heatmap max
    const hourlyMax = Math.max(...Object.values(hourlyActivity), 1);

    return (
        <DashboardLayout title={machine.hostname}>
            {/* Confirmation modal */}
            {confirmAction && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                }} onClick={() => setConfirmAction(null)}>
                    <div
                        style={{
                            background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
                            padding: '2rem', maxWidth: 420, width: '100%',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ color: '#f8fafc', margin: '0 0 0.75rem', fontSize: '1.1rem' }}>
                            Confirmer l'action
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
                            {confirmAction.label} sur <strong style={{ color: '#e2e8f0' }}>{machine.hostname}</strong> ?
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setConfirmAction(null)}
                                style={{
                                    background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 8,
                                    padding: '0.6rem 1.25rem', cursor: 'pointer', fontSize: '0.85rem',
                                }}
                            >
                                Annuler
                            </button>
                            <button
                                onClick={() => {
                                    router.post(confirmAction.url);
                                    setConfirmAction(null);
                                }}
                                style={{
                                    background: confirmAction.type === 'toggle' && machine.status !== 'inactive' ? '#ef4444' : '#3b82f6',
                                    color: '#fff', border: 'none', borderRadius: 8,
                                    padding: '0.6rem 1.25rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                                }}
                            >
                                Confirmer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Flash message */}
            {flash?.success && (
                <div style={{
                    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                    borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem',
                    color: '#22c55e', fontSize: '0.85rem', fontWeight: 500,
                }}>
                    {flash.success}
                </div>
            )}

            {/* Pending commands banner */}
            {pendingCommands.length > 0 && (
                <div style={{
                    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}>
                    <span style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 }}>
                        {pendingCommands.length} commande{pendingCommands.length > 1 ? 's' : ''} en attente
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                        ({pendingCommands.map(c => c.type === 'force_sync_rules' ? 'sync' : c.type).join(', ')})
                    </span>
                </div>
            )}

            {/* Back button */}
            <button
                onClick={() => router.visit('/machines')}
                style={{
                    background: 'transparent', color: '#94a3b8', border: 'none',
                    cursor: 'pointer', fontSize: '0.875rem', marginBottom: '1rem', padding: 0,
                }}
            >
                &larr; Retour au parc machines
            </button>

            {/* Machine header */}
            <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: 36, height: 36, borderRadius: 8,
                                background: machine.os === 'windows' ? '#0078d4' : '#333',
                                color: '#fff', fontSize: '1rem', fontWeight: 700,
                            }}>
                                {machine.os === 'windows' ? 'W' : 'M'}
                            </span>
                            <div>
                                <h2 style={{ color: '#f8fafc', margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
                                    {machine.hostname}
                                </h2>
                                <p style={{ color: '#94a3b8', margin: '0.2rem 0 0', fontSize: '0.85rem' }}>
                                    {machine.os} {machine.os_version} — Agent v{machine.agent_version}
                                </p>
                            </div>
                        </div>
                        {/* Tags */}
                        {machine.tags?.length > 0 && (
                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.6rem', marginLeft: '3rem' }}>
                                {machine.tags.map((tag) => (
                                    <span
                                        key={tag.id}
                                        style={{
                                            padding: '0.15rem 0.5rem', borderRadius: 12,
                                            fontSize: '0.65rem', fontWeight: 600,
                                            color: '#fff',
                                            background: tag.color || '#475569',
                                        }}
                                    >
                                        {tag.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => router.visit(`/exchanges?machine_id=${machine.id}`)}
                            style={{
                                background: '#334155', color: '#e2e8f0', border: 'none',
                                borderRadius: 6, padding: '0.4rem 0.75rem',
                                cursor: 'pointer', fontSize: '0.8rem',
                            }}
                        >
                            Voir les echanges
                        </button>
                        {canManage && !editing && (
                            <button
                                onClick={() => setEditing(true)}
                                style={{
                                    background: '#334155', color: '#e2e8f0', border: 'none',
                                    borderRadius: 6, padding: '0.4rem 0.75rem',
                                    cursor: 'pointer', fontSize: '0.8rem',
                                }}
                            >
                                Modifier
                            </button>
                        )}
                        {canManage && (
                            <>
                                <button
                                    onClick={() => setConfirmAction({ type: 'sync', label: 'Forcer la synchronisation des règles', url: `/machines/${machine.id}/force-sync` })}
                                    style={{
                                        background: '#1e3a5f', color: '#60a5fa', border: '1px solid #2563eb40',
                                        borderRadius: 6, padding: '0.4rem 0.75rem',
                                        cursor: 'pointer', fontSize: '0.8rem',
                                    }}
                                >
                                    Sync regles
                                </button>
                                <button
                                    onClick={() => setConfirmAction({ type: 'restart', label: 'Redémarrer l\'agent', url: `/machines/${machine.id}/restart` })}
                                    style={{
                                        background: '#422006', color: '#fbbf24', border: '1px solid #f59e0b40',
                                        borderRadius: 6, padding: '0.4rem 0.75rem',
                                        cursor: 'pointer', fontSize: '0.8rem',
                                    }}
                                >
                                    Redemarrer
                                </button>
                                <button
                                    onClick={() => setConfirmAction({
                                        type: 'toggle',
                                        label: machine.status === 'inactive' ? 'Réactiver cette machine' : 'Désactiver cette machine',
                                        url: `/machines/${machine.id}/toggle-status`,
                                    })}
                                    style={{
                                        background: machine.status === 'inactive' ? '#14532d' : '#7f1d1d',
                                        color: machine.status === 'inactive' ? '#86efac' : '#fca5a5',
                                        border: `1px solid ${machine.status === 'inactive' ? '#22c55e40' : '#ef444440'}`,
                                        borderRadius: 6, padding: '0.4rem 0.75rem',
                                        cursor: 'pointer', fontSize: '0.8rem',
                                    }}
                                >
                                    {machine.status === 'inactive' ? 'Reactiver' : 'Desactiver'}
                                </button>
                            </>
                        )}
                        <span style={{
                            padding: '0.3rem 0.8rem', borderRadius: 20,
                            fontSize: '0.8rem', fontWeight: 600, color: '#fff',
                            background: statusColors[machineStatus] || '#94a3b8',
                        }}>
                            {statusLabels[machineStatus] || machineStatus}
                        </span>
                    </div>
                </div>

                {!editing ? (
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '1rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #334155',
                    }}>
                        <InfoItem label="Adresse IP" value={machine.ip_address || '\u2014'} mono />
                        <InfoItem label="Departement" value={machine.department || '\u2014'} />
                        <InfoItem label="Utilisateur assigne" value={machine.assigned_user || '\u2014'} />
                        <InfoItem label="Dernier contact" value={machine.last_heartbeat ? formatDate(machine.last_heartbeat) : '\u2014'} />
                        <InfoItem label="Enregistre le" value={machine.created_at ? formatDate(machine.created_at) : '\u2014'} />
                        <InfoItem label="ID machine" value={machine.id?.slice(0, 12) + '...'} mono />
                    </div>
                ) : (
                    <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '1rem', marginBottom: '1rem',
                        }}>
                            <EditField label="Departement" value={editData.department}
                                onChange={(v) => setEditData({ ...editData, department: v })} />
                            <EditField label="Utilisateur assigne" value={editData.assigned_user}
                                onChange={(v) => setEditData({ ...editData, assigned_user: v })} />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <span style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: '0.3rem' }}>
                                Notes
                            </span>
                            <textarea
                                value={editData.notes}
                                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                                placeholder="Notes internes sur cette machine..."
                                rows={3}
                                style={{
                                    background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
                                    padding: '0.6rem 1rem', color: '#f8fafc', fontSize: '0.875rem',
                                    width: '100%', fontFamily: 'inherit', resize: 'vertical',
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button onClick={handleCancelEdit} style={{
                                background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 8,
                                padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.85rem',
                            }}>
                                Annuler
                            </button>
                            <button onClick={handleSaveEdit} style={{
                                background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8,
                                padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                            }}>
                                Enregistrer
                            </button>
                        </div>
                    </div>
                )}

                {/* Notes display (when not editing) */}
                {!editing && machine.notes && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
                        <span style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                            Notes
                        </span>
                        <p style={{ color: '#94a3b8', margin: '0.3rem 0 0', fontSize: '0.85rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {machine.notes}
                        </p>
                    </div>
                )}
            </div>

            {/* Stats cards */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem', marginBottom: '1.5rem',
            }}>
                <StatCard label="Total evenements" value={stats.total_events} color="#3b82f6" />
                <StatCard label="Blocages" value={stats.blocked_events} color="#ef4444" />
                <StatCard label="Alertes ouvertes" value={stats.alerts_count} color="#f59e0b" />
                <StatCard label="Plateformes" value={stats.platforms_used?.length || 0} color="#8b5cf6" />
            </div>

            {/* Daily Activity + Event Types (side by side) */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Daily Activity Chart */}
                <div style={cardStyle}>
                    <h3 style={{ color: '#f8fafc', margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600 }}>
                        Activite (14 derniers jours)
                    </h3>
                    {dailyActivity.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
                            {dailyActivity.map((day) => {
                                const totalH = (day.total / maxDaily) * 100;
                                return (
                                    <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                        <div style={{ width: '100%', height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative' }}>
                                            <div style={{
                                                width: '100%', height: `${totalH}%`, minHeight: day.total > 0 ? 2 : 0,
                                                background: '#3b82f6', borderRadius: '3px 3px 0 0', position: 'relative',
                                            }}>
                                                {day.blocked > 0 && (
                                                    <div style={{
                                                        position: 'absolute', bottom: 0, left: 0, right: 0,
                                                        height: `${(day.blocked / day.total) * 100}%`,
                                                        background: '#ef4444', borderRadius: day.blocked === day.total ? '3px 3px 0 0' : 0,
                                                    }} />
                                                )}
                                            </div>
                                        </div>
                                        <span style={{ color: '#475569', fontSize: '0.55rem', whiteSpace: 'nowrap' }}>
                                            {formatShortDate(day.date)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>Aucune activite recente.</p>
                    )}
                    {dailyActivity.length > 0 && (
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: '#94a3b8' }}>
                                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#3b82f6' }} /> Normal
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: '#94a3b8' }}>
                                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444' }} /> Bloque
                            </span>
                        </div>
                    )}
                </div>

                {/* Event Type Distribution */}
                <div style={cardStyle}>
                    <h3 style={{ color: '#f8fafc', margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600 }}>
                        Types d'evenements
                    </h3>
                    {eventTypesTotal > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {Object.entries(eventTypes).map(([type, count]) => {
                                const pct = ((count / eventTypesTotal) * 100).toFixed(1);
                                return (
                                    <div key={type}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                            <span style={{ color: '#e2e8f0', fontSize: '0.8rem' }}>
                                                {eventTypeLabels[type] || type}
                                            </span>
                                            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                                {count} ({pct}%)
                                            </span>
                                        </div>
                                        <div style={{ height: 6, background: '#0f172a', borderRadius: 3 }}>
                                            <div style={{
                                                height: '100%', width: `${pct}%`, borderRadius: 3,
                                                background: eventTypeColors[type] || '#64748b',
                                            }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>Aucun evenement.</p>
                    )}
                </div>
            </div>

            {/* Platform Breakdown + Hourly Activity (side by side) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Platform breakdown */}
                <div style={cardStyle}>
                    <h3 style={{ color: '#f8fafc', margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600 }}>
                        Usage par plateforme
                    </h3>
                    {platformBreakdown.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {platformBreakdown.map((p) => {
                                const maxP = platformBreakdown[0]?.total || 1;
                                const pct = Math.max(2, Math.round((p.total / maxP) * 100));
                                const color = platformColors[p.platform] || '#64748b';
                                return (
                                    <div key={p.platform}
                                        onClick={() => router.visit(`/exchanges?machine_id=${machine.id}&platform=${p.platform}`)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                            <span style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 500, textTransform: 'capitalize' }}>
                                                {p.platform}
                                            </span>
                                            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                                                {p.total} evts{p.blocked > 0 ? ` (${p.blocked} bloq.)` : ''}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 2, height: 8 }}>
                                            <div style={{
                                                width: `${pct}%`, height: '100%', borderRadius: 4,
                                                background: color, transition: 'width 0.3s ease',
                                            }} />
                                            {p.blocked > 0 && (
                                                <div style={{
                                                    width: `${Math.max(2, Math.round((p.blocked / maxP) * 100))}%`,
                                                    height: '100%', borderRadius: 4, background: '#ef4444',
                                                }} />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>Aucune donnee de plateforme.</p>
                    )}
                </div>

                {/* Hourly activity heatmap */}
                <div style={cardStyle}>
                    <h3 style={{ color: '#f8fafc', margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600 }}>
                        Activite par heure (7j)
                    </h3>
                    {Object.keys(hourlyActivity).length > 0 ? (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3 }}>
                                {Array.from({ length: 24 }, (_, h) => {
                                    const count = hourlyActivity[h] || 0;
                                    const intensity = count > 0 ? Math.max(0.15, count / hourlyMax) : 0;
                                    return (
                                        <div key={h} title={`${h}h: ${count} evenements`} style={{
                                            aspectRatio: '1', borderRadius: 4,
                                            background: count > 0
                                                ? `rgba(59, 130, 246, ${intensity})`
                                                : '#0f172a',
                                            border: '1px solid #33415520',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <span style={{
                                                fontSize: '0.55rem',
                                                color: count > 0 ? '#e2e8f0' : '#475569',
                                                fontWeight: count > 0 ? 600 : 400,
                                            }}>
                                                {h}h
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                                <span style={{ color: '#475569', fontSize: '0.6rem' }}>Faible</span>
                                <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                    {[0.15, 0.3, 0.5, 0.7, 1].map((v, i) => (
                                        <div key={i} style={{
                                            width: 12, height: 12, borderRadius: 2,
                                            background: `rgba(59, 130, 246, ${v})`,
                                        }} />
                                    ))}
                                </div>
                                <span style={{ color: '#475569', fontSize: '0.6rem' }}>Forte</span>
                            </div>
                        </div>
                    ) : (
                        <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>Aucune donnee horaire.</p>
                    )}
                </div>
            </div>

            {/* Tabs: Events / Alerts */}
            <div style={{ display: 'flex', gap: 0 }}>
                <TabButton active={activeTab === 'events'} onClick={() => setActiveTab('events')}
                    label="Evenements" count={machine.events?.length} />
                <TabButton active={activeTab === 'alerts'} onClick={() => setActiveTab('alerts')}
                    label="Alertes" count={alerts.length} badge={openAlerts > 0 ? openAlerts : null} />
            </div>

            {/* Events tab */}
            {activeTab === 'events' && (
                <div style={{ ...cardStyle, borderTopLeftRadius: 0 }}>
                    {machine.events?.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #334155' }}>
                                        {['Type', 'Plateforme', 'Domaine', 'Severite', 'Date'].map((h) => (
                                            <th key={h} style={{
                                                padding: '0.6rem 0.75rem', textAlign: 'left',
                                                color: '#94a3b8', fontSize: '0.7rem',
                                                textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600,
                                            }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {machine.events.map((event) => (
                                        <tr key={event.id} style={{
                                            borderBottom: '1px solid #0f172a',
                                            cursor: event.elasticsearch_id ? 'pointer' : 'default',
                                        }}
                                            onClick={() => event.elasticsearch_id && router.visit(`/exchanges/${event.elasticsearch_id}`)}
                                        >
                                            <td style={{ padding: '0.6rem 0.75rem' }}>
                                                <span style={{
                                                    padding: '0.15rem 0.5rem', borderRadius: 4,
                                                    fontSize: '0.7rem', fontWeight: 600,
                                                    color: event.event_type === 'block' ? '#fca5a5' : '#e2e8f0',
                                                    background: eventTypeColors[event.event_type] ? `${eventTypeColors[event.event_type]}20` : '#334155',
                                                    border: `1px solid ${eventTypeColors[event.event_type] || '#475569'}40`,
                                                }}>
                                                    {eventTypeLabels[event.event_type] || event.event_type}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.6rem 0.75rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                                {event.platform || '\u2014'}
                                            </td>
                                            <td style={{ padding: '0.6rem 0.75rem', color: '#94a3b8', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                                {event.domain || '\u2014'}
                                            </td>
                                            <td style={{ padding: '0.6rem 0.75rem' }}>
                                                {event.severity && (
                                                    <span style={{
                                                        color: severityColors[event.severity] || '#94a3b8',
                                                        fontSize: '0.75rem', fontWeight: 600,
                                                    }}>
                                                        {event.severity}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.6rem 0.75rem', color: '#64748b', fontSize: '0.8rem' }}>
                                                {formatDate(event.occurred_at) || event.occurred_at}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>Aucun evenement enregistre.</p>
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
                                    background: '#0f172a', borderRadius: 8,
                                    border: `1px solid ${alert.status === 'open' && alert.severity === 'critical' ? '#7f1d1d' : '#334155'}`,
                                    padding: '1rem',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <span style={{
                                                padding: '0.15rem 0.4rem', borderRadius: 4,
                                                fontSize: '0.65rem', fontWeight: 700,
                                                background: alert.severity === 'critical' ? '#7f1d1d' : '#78350f',
                                                color: alert.severity === 'critical' ? '#fca5a5' : '#fcd34d',
                                            }}>
                                                {alert.severity}
                                            </span>
                                            <span style={{
                                                padding: '0.15rem 0.4rem', borderRadius: 4,
                                                fontSize: '0.65rem', fontWeight: 600,
                                                color: alertStatusColors[alert.status] || '#94a3b8',
                                                background: `${alertStatusColors[alert.status] || '#94a3b8'}15`,
                                            }}>
                                                {alertStatusLabels[alert.status] || alert.status}
                                            </span>
                                            {alert.rule_name && (
                                                <span style={{
                                                    padding: '0.15rem 0.4rem', borderRadius: 4,
                                                    fontSize: '0.65rem', fontWeight: 500,
                                                    color: '#fbbf24', background: '#422006',
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
                                            Acquittee {alert.acknowledged_at}
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
                borderRadius: '8px 8px 0 0',
                padding: '0.6rem 1.25rem',
                cursor: 'pointer', fontSize: '0.85rem',
                fontWeight: active ? 600 : 400,
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                position: 'relative', bottom: -1,
            }}
        >
            {label}
            {count != null && <span style={{ color: '#64748b', fontSize: '0.75rem' }}>({count})</span>}
            {badge != null && (
                <span style={{
                    background: '#ef4444', color: '#fff', borderRadius: 10,
                    padding: '0.1rem 0.4rem', fontSize: '0.65rem', fontWeight: 700,
                    minWidth: 18, textAlign: 'center',
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
                color: '#e2e8f0', margin: '0.2rem 0 0', fontSize: '0.875rem',
                fontFamily: mono ? 'monospace' : 'inherit',
            }}>
                {value}
            </p>
        </div>
    );
}

function EditField({ label, value, onChange }) {
    return (
        <div>
            <span style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: '0.3rem' }}>
                {label}
            </span>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
                    padding: '0.5rem 0.75rem', color: '#f8fafc', fontSize: '0.875rem',
                    width: '100%',
                }}
            />
        </div>
    );
}

function StatCard({ label, value, color }) {
    return (
        <div style={{
            background: '#1e293b', borderRadius: 12,
            border: '1px solid #334155', padding: '1.25rem',
        }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 500 }}>{label}</span>
            <p style={{ color, fontSize: '2rem', fontWeight: 700, margin: '0.3rem 0 0' }}>{value}</p>
        </div>
    );
}
