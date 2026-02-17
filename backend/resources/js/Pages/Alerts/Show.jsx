import { router, usePage } from '@inertiajs/react';
import DashboardLayout from '../../Layouts/DashboardLayout';
import { useTheme } from '../../Contexts/ThemeContext';

const severityStyles = {
    critical: { bg: '#7f1d1d', color: '#fca5a5', label: 'Critique', border: '#ef4444' },
    warning: { bg: '#78350f', color: '#fcd34d', label: 'Attention', border: '#f59e0b' },
    info: { bg: '#1e3a5f', color: '#93c5fd', label: 'Info', border: '#3b82f6' },
};

const statusConfig = {
    open: { label: 'Ouverte', color: '#ef4444', bg: '#7f1d1d' },
    acknowledged: { label: 'Prise en charge', color: '#f59e0b', bg: '#78350f' },
    resolved: { label: 'Resolue', color: '#22c55e', bg: '#14532d' },
};

const categoryLabels = {
    block: 'Blocage',
    alert: 'Alerte',
    log: 'Journalisation',
};

const targetLabels = {
    prompt: 'Prompt',
    response: 'Reponse',
    clipboard: 'Presse-papier',
    domain: 'Domaine',
};

const conditionLabels = {
    regex: 'Expression reguliere',
    keyword: 'Mots-cles',
    domain_list: 'Liste de domaines',
    content_length: 'Longueur du contenu',
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

export default function AlertsShow({ alert, relatedAlerts = [] }) {
    const { theme: t } = useTheme();
    const { auth } = usePage().props;
    const canManage = auth?.is_manager ?? false;

    const sev = severityStyles[alert.severity] || severityStyles.warning;
    const status = statusConfig[alert.status] || statusConfig.open;

    const cardStyle = {
        background: t.surface, borderRadius: 12,
        border: `1px solid ${t.border}`, padding: '1.5rem',
    };

    return (
        <DashboardLayout title="Detail de l'alerte">
            {/* Back button */}
            <button
                onClick={() => router.visit('/alerts')}
                style={{
                    background: 'transparent', color: t.textMuted, border: 'none',
                    cursor: 'pointer', fontSize: '0.875rem', marginBottom: '1rem', padding: 0,
                }}
            >
                &larr; Retour aux alertes
            </button>

            {/* Alert header */}
            <div style={{
                ...cardStyle, marginBottom: '1.5rem',
                borderColor: alert.status === 'open' ? sev.border + '60' : t.border,
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                            <span style={{
                                padding: '0.25rem 0.65rem', borderRadius: 6,
                                fontSize: '0.75rem', fontWeight: 700,
                                background: sev.bg, color: sev.color,
                                textTransform: 'uppercase',
                            }}>
                                {sev.label}
                            </span>
                            <span style={{
                                padding: '0.25rem 0.65rem', borderRadius: 6,
                                fontSize: '0.75rem', fontWeight: 600,
                                background: status.bg, color: status.color,
                            }}>
                                {status.label}
                            </span>
                        </div>
                        <h2 style={{ color: t.text, margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 700 }}>
                            {alert.title}
                        </h2>
                        {alert.description && (
                            <p style={{ color: t.textMuted, margin: 0, fontSize: '0.9rem', lineHeight: 1.6 }}>
                                {alert.description}
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    {canManage && alert.status === 'open' && (
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                            <button
                                onClick={() => router.post(`/alerts/${alert.id}/acknowledge`, {}, { preserveScroll: true })}
                                style={{
                                    background: '#1e3a5f', color: '#60a5fa', border: '1px solid #2563eb40',
                                    borderRadius: 8, padding: '0.5rem 1rem',
                                    cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                                }}
                            >
                                Acquitter
                            </button>
                            <button
                                onClick={() => router.post(`/alerts/${alert.id}/resolve`, {}, { preserveScroll: true })}
                                style={{
                                    background: '#14532d', color: '#86efac', border: '1px solid #22c55e40',
                                    borderRadius: 8, padding: '0.5rem 1rem',
                                    cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                                }}
                            >
                                Resoudre
                            </button>
                        </div>
                    )}
                    {canManage && alert.status === 'acknowledged' && (
                        <button
                            onClick={() => router.post(`/alerts/${alert.id}/resolve`, {}, { preserveScroll: true })}
                            style={{
                                background: '#14532d', color: '#86efac', border: '1px solid #22c55e40',
                                borderRadius: 8, padding: '0.5rem 1rem',
                                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                            }}
                        >
                            Resoudre
                        </button>
                    )}
                </div>

                {/* Timeline */}
                <div style={{
                    display: 'flex', gap: '2rem', marginTop: '1.5rem', paddingTop: '1rem',
                    borderTop: `1px solid ${t.border}`, flexWrap: 'wrap',
                }}>
                    <TimelineItem
                        label="Creee"
                        date={formatDate(alert.created_at)}
                        relative={alert.created_at_human}
                        active
                    />
                    {alert.acknowledged_at && (
                        <TimelineItem
                            label="Acquittee"
                            date={formatDate(alert.acknowledged_at)}
                            relative={alert.acknowledged_at_human}
                            by={alert.acknowledged_by_name}
                            active
                        />
                    )}
                    {alert.status === 'resolved' && (
                        <TimelineItem
                            label="Resolue"
                            date=""
                            active
                        />
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                {/* Machine info */}
                {alert.machine && (
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ color: t.text, margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
                                Machine
                            </h3>
                            <button
                                onClick={() => router.visit(`/machines/${alert.machine.id}`)}
                                style={{
                                    background: t.border, color: t.textSecondary, border: 'none',
                                    borderRadius: 6, padding: '0.35rem 0.75rem',
                                    cursor: 'pointer', fontSize: '0.8rem',
                                }}
                            >
                                Voir
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            <MetaItem label="Hostname" value={alert.machine.hostname} />
                            <MetaItem label="OS" value={`${alert.machine.os} ${alert.machine.os_version || ''}`} />
                            <MetaItem label="Departement" value={alert.machine.department} />
                            <MetaItem label="Utilisateur" value={alert.machine.assigned_user} />
                        </div>
                    </div>
                )}

                {/* Rule info */}
                {alert.rule && (
                    <div style={cardStyle}>
                        <h3 style={{ color: t.text, margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600 }}>
                            Regle declenchee
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            <MetaItem label="Nom" value={alert.rule.name} />
                            <MetaItem label="Categorie" value={categoryLabels[alert.rule.category] || alert.rule.category} />
                            <MetaItem label="Cible" value={targetLabels[alert.rule.target] || alert.rule.target} />
                            <MetaItem label="Condition" value={conditionLabels[alert.rule.condition_type] || alert.rule.condition_type} />
                        </div>
                    </div>
                )}
            </div>

            {/* Related event */}
            {alert.event && (
                <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ color: t.text, margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
                            Evenement associe
                        </h3>
                        {alert.event.elasticsearch_id && (
                            <button
                                onClick={() => router.visit(`/exchanges/${alert.event.elasticsearch_id}`)}
                                style={{
                                    background: t.border, color: t.textSecondary, border: 'none',
                                    borderRadius: 6, padding: '0.35rem 0.75rem',
                                    cursor: 'pointer', fontSize: '0.8rem',
                                }}
                            >
                                Voir l'echange
                            </button>
                        )}
                    </div>
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '0.75rem',
                    }}>
                        <MetaItem label="Type" value={alert.event.event_type} />
                        <MetaItem label="Plateforme" value={alert.event.platform} />
                        <MetaItem label="Domaine" value={alert.event.domain} mono />
                        <MetaItem label="Date" value={formatDate(alert.event.occurred_at)} />
                    </div>
                </div>
            )}

            {/* Related alerts on same machine */}
            {relatedAlerts.length > 0 && (
                <div style={cardStyle}>
                    <h3 style={{ color: t.text, margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600 }}>
                        Autres alertes sur cette machine
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {relatedAlerts.map((ra) => {
                            const raSev = severityStyles[ra.severity] || severityStyles.warning;
                            const raSt = statusConfig[ra.status] || statusConfig.open;
                            return (
                                <div
                                    key={ra.id}
                                    onClick={() => router.visit(`/alerts/${ra.id}`)}
                                    style={{
                                        background: t.bg, borderRadius: 8,
                                        padding: '0.75rem 1rem', border: `1px solid ${t.border}`,
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem',
                                        transition: 'border-color 0.15s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.borderColor = t.textSubtle}
                                    onMouseLeave={(e) => e.currentTarget.style.borderColor = t.border}
                                >
                                    <span style={{
                                        padding: '0.15rem 0.4rem', borderRadius: 4,
                                        fontSize: '0.65rem', fontWeight: 700,
                                        background: raSev.bg, color: raSev.color,
                                    }}>
                                        {raSev.label}
                                    </span>
                                    <span style={{ color: t.textSecondary, fontSize: '0.85rem', flex: 1 }}>
                                        {ra.title}
                                    </span>
                                    <span style={{ color: raSt.color, fontSize: '0.7rem', fontWeight: 500 }}>
                                        {raSt.label}
                                    </span>
                                    <span style={{ color: t.textFaint, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                        {ra.created_at}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}

function TimelineItem({ label, date, relative, by, active }) {
    const { theme: t } = useTheme();

    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div style={{
                width: 10, height: 10, borderRadius: '50%', marginTop: 4,
                background: active ? t.accent : t.border,
                border: '2px solid ' + (active ? '#60a5fa' : t.textSubtle),
                flexShrink: 0,
            }} />
            <div>
                <span style={{ color: t.textMuted, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
                    {label}
                </span>
                {date && (
                    <p style={{ color: t.textSecondary, fontSize: '0.8rem', margin: '0.15rem 0 0' }}>
                        {date}
                    </p>
                )}
                {relative && (
                    <p style={{ color: t.textFaint, fontSize: '0.7rem', margin: '0.1rem 0 0' }}>
                        {relative}
                    </p>
                )}
                {by && (
                    <p style={{ color: t.textFaint, fontSize: '0.7rem', margin: '0.1rem 0 0' }}>
                        par {by}
                    </p>
                )}
            </div>
        </div>
    );
}

function MetaItem({ label, value, mono }) {
    const { theme: t } = useTheme();

    return (
        <div>
            <span style={{ color: t.textFaint, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                {label}
            </span>
            <p style={{
                color: t.textSecondary, margin: '0.15rem 0 0', fontSize: '0.85rem',
                fontFamily: mono ? 'monospace' : 'inherit',
            }}>
                {value || '\u2014'}
            </p>
        </div>
    );
}
