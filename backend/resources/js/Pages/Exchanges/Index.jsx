import { router } from '@inertiajs/react';
import DashboardLayout from '../../Layouts/DashboardLayout';

const platformIcons = {
    chatgpt: '🤖',
    claude: '🧠',
    copilot: '✈️',
    gemini: '♊',
    mistral: '🌬️',
};

export default function ExchangesIndex({ exchanges = [], total = 0, page, perPage, filters }) {
    return (
        <DashboardLayout title="Historique des échanges">
            {/* Search bar */}
            <div style={{
                display: 'flex',
                gap: '0.75rem',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
            }}>
                <input
                    type="text"
                    placeholder="Rechercher dans les prompts et réponses..."
                    defaultValue={filters?.q || ''}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            router.get('/exchanges', { ...filters, q: e.target.value }, {
                                preserveState: true,
                                replace: true,
                            });
                        }
                    }}
                    style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        padding: '0.6rem 1rem',
                        color: '#f8fafc',
                        fontSize: '0.875rem',
                        flex: 1,
                        minWidth: 300,
                    }}
                />
                <select
                    defaultValue={filters?.platform || ''}
                    onChange={(e) => router.get('/exchanges', { ...filters, platform: e.target.value }, { preserveState: true, replace: true })}
                    style={{
                        background: '#1e293b', border: '1px solid #334155',
                        borderRadius: 8, padding: '0.5rem 1rem', color: '#f8fafc', fontSize: '0.875rem',
                    }}
                >
                    <option value="">Toutes les plateformes</option>
                    <option value="chatgpt">ChatGPT</option>
                    <option value="claude">Claude</option>
                    <option value="copilot">Copilot</option>
                    <option value="gemini">Gemini</option>
                    <option value="mistral">Mistral</option>
                </select>
            </div>

            <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '1rem' }}>
                {total} résultat(s)
            </p>

            {/* Results */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {exchanges.map((exchange) => (
                    <div
                        key={exchange.id}
                        onClick={() => router.visit(`/exchanges/${exchange.id}`)}
                        style={{
                            background: '#1e293b',
                            borderRadius: 10,
                            padding: '1.25rem',
                            border: '1px solid #334155',
                            cursor: 'pointer',
                            transition: 'border-color 0.15s',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>{platformIcons[exchange.platform] || '🔗'}</span>
                                <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                                    {exchange.platform || 'inconnu'}
                                </span>
                                {exchange.severity && exchange.severity !== 'info' && (
                                    <span style={{
                                        padding: '0.15rem 0.4rem',
                                        borderRadius: 4,
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        background: exchange.severity === 'critical' ? '#7f1d1d' : '#78350f',
                                        color: exchange.severity === 'critical' ? '#fca5a5' : '#fcd34d',
                                    }}>
                                        {exchange.severity}
                                    </span>
                                )}
                            </div>
                            <span style={{ color: '#475569', fontSize: '0.75rem' }}>
                                {exchange.occurred_at}
                            </span>
                        </div>

                        {/* Prompt excerpt */}
                        {exchange.prompt && (
                            <div style={{ marginBottom: '0.5rem' }}>
                                <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600 }}>PROMPT</span>
                                <p
                                    style={{ color: '#e2e8f0', fontSize: '0.85rem', margin: '0.2rem 0 0', lineHeight: 1.5 }}
                                    dangerouslySetInnerHTML={{
                                        __html: exchange.highlights?.prompt?.[0] ||
                                            (exchange.prompt?.substring(0, 300) + (exchange.prompt?.length > 300 ? '...' : ''))
                                    }}
                                />
                            </div>
                        )}

                        {/* Response excerpt */}
                        {exchange.response && (
                            <div>
                                <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600 }}>RÉPONSE</span>
                                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0.2rem 0 0', lineHeight: 1.5 }}>
                                    {exchange.response?.substring(0, 200)}{exchange.response?.length > 200 ? '...' : ''}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </DashboardLayout>
    );
}
