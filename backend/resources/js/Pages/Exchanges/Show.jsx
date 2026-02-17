import { router } from '@inertiajs/react';
import DashboardLayout from '../../Layouts/DashboardLayout';

const severityColors = {
    critical: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
};

const platformColors = {
    chatgpt: '#10a37f',
    openai: '#10a37f',
    claude: '#d97706',
    anthropic: '#d97706',
    copilot: '#3b82f6',
    gemini: '#8b5cf6',
    huggingface: '#fbbf24',
};

const cardStyle = {
    background: '#1e293b',
    borderRadius: 12,
    border: '1px solid #334155',
    padding: '1.5rem',
    marginBottom: '1rem',
};

export default function ExchangesShow({ exchange }) {
    return (
        <DashboardLayout title="Détail de l'échange">
            {/* Back button */}
            <button
                onClick={() => router.visit('/exchanges')}
                style={{
                    background: 'transparent', color: '#94a3b8', border: 'none',
                    cursor: 'pointer', fontSize: '0.875rem', marginBottom: '1rem',
                    padding: 0,
                }}
            >
                &larr; Retour à l'historique
            </button>

            {/* Metadata header */}
            <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            {exchange.platform && (
                                <span style={{
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: 6,
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: '#fff',
                                    background: platformColors[exchange.platform] || '#64748b',
                                }}>
                                    {exchange.platform}
                                </span>
                            )}
                            {exchange.severity && (
                                <span style={{
                                    color: severityColors[exchange.severity] || '#94a3b8',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                }}>
                                    {exchange.severity}
                                </span>
                            )}
                            <span style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: 4,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: '#e2e8f0',
                                background: '#334155',
                            }}>
                                {exchange.event_type}
                            </span>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0, fontFamily: 'monospace' }}>
                            {exchange.domain}
                        </p>
                    </div>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                        {exchange.occurred_at}
                    </span>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '1rem',
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid #334155',
                }}>
                    <MetaItem label="Machine" value={exchange.machine_id?.slice(0, 12) + '...'} />
                    <MetaItem label="Taille contenu" value={`${exchange.content_length || 0} car.`} />
                    <MetaItem label="Hash" value={exchange.content_hash?.slice(0, 16) + '...'} mono />
                    <MetaItem label="ID Elasticsearch" value={exchange.id?.slice(0, 16) + '...'} mono />
                </div>

                {/* Matched rules */}
                {exchange.matched_rules?.length > 0 && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
                        <span style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                            Règles déclenchées
                        </span>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                            {exchange.matched_rules.map((rule, i) => (
                                <span key={i} style={{
                                    padding: '0.2rem 0.6rem',
                                    borderRadius: 4,
                                    fontSize: '0.7rem',
                                    fontWeight: 500,
                                    color: '#fbbf24',
                                    background: '#422006',
                                    border: '1px solid #854d0e',
                                }}>
                                    {rule}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Prompt */}
            <div style={cardStyle}>
                <h3 style={{ color: '#f8fafc', margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>
                    Prompt (requête utilisateur)
                </h3>
                {exchange.prompt ? (
                    <pre style={{
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        padding: '1rem',
                        color: '#e2e8f0',
                        fontSize: '0.8rem',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: 400,
                        overflowY: 'auto',
                        margin: 0,
                    }}
                        dangerouslySetInnerHTML={{
                            __html: exchange.highlight?.prompt
                                ? exchange.highlight.prompt.join('...\n...')
                                : escapeHtml(exchange.prompt),
                        }}
                    />
                ) : (
                    <p style={{ color: '#64748b', fontSize: '0.8rem' }}>Aucun prompt capturé.</p>
                )}
            </div>

            {/* Response */}
            <div style={cardStyle}>
                <h3 style={{ color: '#f8fafc', margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>
                    Réponse IA
                </h3>
                {exchange.response ? (
                    <pre style={{
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        padding: '1rem',
                        color: '#e2e8f0',
                        fontSize: '0.8rem',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: 400,
                        overflowY: 'auto',
                        margin: 0,
                    }}
                        dangerouslySetInnerHTML={{
                            __html: exchange.highlight?.response
                                ? exchange.highlight.response.join('...\n...')
                                : escapeHtml(exchange.response),
                        }}
                    />
                ) : (
                    <p style={{ color: '#64748b', fontSize: '0.8rem' }}>Aucune réponse capturée.</p>
                )}
            </div>
        </DashboardLayout>
    );
}

function MetaItem({ label, value, mono }) {
    return (
        <div>
            <span style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                {label}
            </span>
            <p style={{
                color: '#e2e8f0',
                margin: '0.2rem 0 0',
                fontSize: '0.8rem',
                fontFamily: mono ? 'monospace' : 'inherit',
            }}>
                {value}
            </p>
        </div>
    );
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
