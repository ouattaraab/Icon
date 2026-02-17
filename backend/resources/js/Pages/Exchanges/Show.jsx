import { router } from '@inertiajs/react';
import DashboardLayout from '../../Layouts/DashboardLayout';
import { useTheme } from '../../Contexts/ThemeContext';

const severityColors = {
    critical: { bg: '#7f1d1d', color: '#fca5a5' },
    warning: { bg: '#78350f', color: '#fcd34d' },
    info: { bg: '#1e3a5f', color: '#93c5fd' },
};

const platformColors = {
    chatgpt: '#10a37f', openai: '#10a37f',
    claude: '#d97706', anthropic: '#d97706',
    copilot: '#3b82f6', github: '#3b82f6',
    gemini: '#8b5cf6', google: '#8b5cf6',
    huggingface: '#fbbf24', perplexity: '#22d3ee', mistral: '#f97316',
};

const eventTypeLabels = {
    prompt: 'Prompt', response: 'Reponse', block: 'Blocage', clipboard: 'Presse-papier', alert: 'Alerte',
};

const dlpCategoryLabels = {
    credentials: 'Identifiants / Secrets',
    financial: 'Donnees financieres',
    personal: 'Donnees personnelles',
    gs2e_internal: 'Donnees internes GS2E',
    generic: 'Pattern generique',
};

function getPlatformColor(name) {
    const lower = (name || '').toLowerCase();
    for (const [key, color] of Object.entries(platformColors)) {
        if (lower.includes(key)) return color;
    }
    return '#64748b';
}

function formatDate(isoStr) {
    if (!isoStr) return null;
    try {
        return new Date(isoStr).toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
    } catch { return isoStr; }
}

export default function ExchangesShow({ exchange, machine, event, matchedRuleNames = {} }) {
    const { theme: t } = useTheme();
    const sev = severityColors[exchange.severity] || severityColors.info;
    const dlpMatches = event?.metadata?.dlp_matches;
    const hasDlp = dlpMatches && Object.keys(dlpMatches).length > 0;

    const cardStyle = {
        background: t.surface, borderRadius: 12,
        border: `1px solid ${t.border}`, padding: '1.5rem', marginBottom: '1rem',
    };

    return (
        <DashboardLayout title="Detail de l'echange">
            {/* Back button */}
            <button
                onClick={() => router.visit('/exchanges')}
                style={{
                    background: 'transparent', color: t.textMuted, border: 'none',
                    cursor: 'pointer', fontSize: '0.875rem', marginBottom: '1rem', padding: 0,
                }}
            >
                &larr; Retour a l'historique
            </button>

            {/* Metadata header */}
            <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                            {exchange.platform && (
                                <span style={{
                                    padding: '0.25rem 0.6rem', borderRadius: 6,
                                    fontSize: '0.75rem', fontWeight: 600, color: '#fff',
                                    background: getPlatformColor(exchange.platform),
                                }}>
                                    {exchange.platform}
                                </span>
                            )}
                            {exchange.severity && (
                                <span style={{
                                    padding: '0.2rem 0.5rem', borderRadius: 4,
                                    fontSize: '0.7rem', fontWeight: 700,
                                    background: sev.bg, color: sev.color,
                                }}>
                                    {exchange.severity.toUpperCase()}
                                </span>
                            )}
                            <span style={{
                                padding: '0.2rem 0.5rem', borderRadius: 4,
                                fontSize: '0.7rem', fontWeight: 600,
                                color: t.textSecondary, background: t.border,
                            }}>
                                {eventTypeLabels[exchange.event_type] || exchange.event_type}
                            </span>
                            {hasDlp && (
                                <span style={{
                                    padding: '0.2rem 0.5rem', borderRadius: 4,
                                    fontSize: '0.65rem', fontWeight: 700,
                                    color: '#fbbf24', background: '#422006',
                                    border: '1px solid #854d0e',
                                }}>
                                    DLP
                                </span>
                            )}
                        </div>
                        <p style={{ color: t.textFaint, fontSize: '0.8rem', margin: 0, fontFamily: 'monospace' }}>
                            {exchange.domain}
                        </p>
                    </div>
                    <span style={{ color: t.textFaint, fontSize: '0.8rem' }}>
                        {formatDate(exchange.occurred_at) || exchange.occurred_at}
                    </span>
                </div>

                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${t.border}`,
                }}>
                    <MetaItem
                        label="Machine"
                        value={
                            machine ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{
                                        display: 'inline-block', width: 18, height: 18, borderRadius: 3,
                                        background: machine.os === 'windows' ? '#0078d4' : '#333',
                                        color: '#fff', textAlign: 'center', lineHeight: '18px',
                                        fontSize: '0.6rem', fontWeight: 700,
                                    }}>
                                        {machine.os === 'windows' ? 'W' : 'M'}
                                    </span>
                                    <span
                                        onClick={(e) => { e.stopPropagation(); router.visit(`/machines/${machine.id}`); }}
                                        style={{ color: t.accent, cursor: 'pointer' }}
                                    >
                                        {machine.hostname}
                                    </span>
                                </span>
                            ) : (exchange.machine_id?.slice(0, 12) + '...')
                        }
                    />
                    {machine?.assigned_user && <MetaItem label="Utilisateur" value={machine.assigned_user} />}
                    {machine?.department && <MetaItem label="Departement" value={machine.department} />}
                    {machine?.os && <MetaItem label="Systeme" value={`${machine.os} ${machine.os_version || ''}`} />}
                    <MetaItem label="Taille contenu" value={`${exchange.content_length || 0} car.`} />
                    {exchange.content_hash && <MetaItem label="Hash" value={exchange.content_hash.slice(0, 16) + '...'} mono />}
                    <MetaItem label="ID" value={exchange.id?.slice(0, 16) + '...'} mono />
                </div>

                {/* Matched rules */}
                {exchange.matched_rules?.length > 0 && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${t.border}` }}>
                        <span style={{ color: t.textFaint, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                            Regles declenchees
                        </span>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                            {exchange.matched_rules.map((ruleId, i) => (
                                <span key={i} style={{
                                    padding: '0.2rem 0.6rem', borderRadius: 4,
                                    fontSize: '0.7rem', fontWeight: 500,
                                    color: '#fbbf24', background: '#422006', border: '1px solid #854d0e',
                                }}>
                                    {matchedRuleNames[ruleId] || ruleId}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* DLP Analysis */}
            {hasDlp && (
                <div style={{ ...cardStyle, borderColor: '#854d0e' }}>
                    <h3 style={{ color: '#fbbf24', margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>!</span>
                        Analyse DLP — Donnees sensibles detectees
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {Object.entries(dlpMatches).map(([category, matches]) => (
                            <div key={category} style={{
                                background: t.bg, borderRadius: 8, padding: '1rem',
                                border: `1px solid ${t.border}`,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <span style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: category === 'credentials' || category === 'gs2e_internal' ? '#ef4444' : '#f59e0b',
                                    }} />
                                    <span style={{ color: t.textSecondary, fontSize: '0.85rem', fontWeight: 600 }}>
                                        {dlpCategoryLabels[category] || category}
                                    </span>
                                    <span style={{
                                        color: t.textFaint, fontSize: '0.7rem',
                                        background: t.surface, padding: '0.1rem 0.4rem', borderRadius: 4,
                                    }}>
                                        {Array.isArray(matches) ? matches.length : 1} detection(s)
                                    </span>
                                </div>
                                {Array.isArray(matches) ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        {matches.map((match, i) => (
                                            <code key={i} style={{
                                                color: '#fca5a5', fontSize: '0.75rem',
                                                fontFamily: 'monospace', padding: '0.2rem 0.5rem',
                                                background: t.surface, borderRadius: 4,
                                                display: 'inline-block',
                                            }}>
                                                {typeof match === 'object' ? JSON.stringify(match) : match}
                                            </code>
                                        ))}
                                    </div>
                                ) : (
                                    <code style={{
                                        color: '#fca5a5', fontSize: '0.75rem',
                                        fontFamily: 'monospace', padding: '0.2rem 0.5rem',
                                        background: t.surface, borderRadius: 4,
                                    }}>
                                        {typeof matches === 'object' ? JSON.stringify(matches) : matches}
                                    </code>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Prompt */}
            <div style={cardStyle}>
                <h3 style={{ color: t.text, margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>
                    Prompt (requete utilisateur)
                </h3>
                {exchange.prompt ? (
                    <pre style={{
                        background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8,
                        padding: '1rem', color: t.textSecondary, fontSize: '0.8rem', lineHeight: 1.6,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        maxHeight: 500, overflowY: 'auto', margin: 0,
                    }}
                        dangerouslySetInnerHTML={{
                            __html: exchange.highlights?.prompt?.[0] || escapeHtml(exchange.prompt),
                        }}
                    />
                ) : (
                    <p style={{ color: t.textFaint, fontSize: '0.8rem' }}>Aucun prompt capture.</p>
                )}
            </div>

            {/* Response */}
            <div style={cardStyle}>
                <h3 style={{ color: t.text, margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>
                    Reponse IA
                </h3>
                {exchange.response ? (
                    <pre style={{
                        background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8,
                        padding: '1rem', color: t.textSecondary, fontSize: '0.8rem', lineHeight: 1.6,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        maxHeight: 500, overflowY: 'auto', margin: 0,
                    }}
                        dangerouslySetInnerHTML={{
                            __html: exchange.highlights?.response?.[0] || escapeHtml(exchange.response),
                        }}
                    />
                ) : (
                    <p style={{ color: t.textFaint, fontSize: '0.8rem' }}>Aucune reponse capturee.</p>
                )}
            </div>

            {/* Event metadata (raw) */}
            {event?.metadata && Object.keys(event.metadata).length > 0 && !hasDlp && (
                <div style={cardStyle}>
                    <h3 style={{ color: t.text, margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>
                        Metadonnees
                    </h3>
                    <pre style={{
                        background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8,
                        padding: '1rem', color: t.textMuted, fontSize: '0.75rem', lineHeight: 1.5,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
                        maxHeight: 300, overflowY: 'auto',
                    }}>
                        {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                </div>
            )}
        </DashboardLayout>
    );
}

function MetaItem({ label, value, mono }) {
    const { theme: t } = useTheme();
    return (
        <div>
            <span style={{ color: t.textFaint, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                {label}
            </span>
            <div style={{
                color: t.textSecondary, margin: '0.2rem 0 0', fontSize: '0.8rem',
                fontFamily: mono ? 'monospace' : 'inherit',
            }}>
                {value}
            </div>
        </div>
    );
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
