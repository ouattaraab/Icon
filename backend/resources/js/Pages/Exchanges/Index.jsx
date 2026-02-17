import { router } from '@inertiajs/react';
import { useState } from 'react';
import DashboardLayout from '../../Layouts/DashboardLayout';

const platformIcons = {
    chatgpt: '🤖',
    claude: '🧠',
    copilot: '✈️',
    gemini: '♊',
    mistral: '🌬️',
};

const severityLabels = {
    info: 'Info',
    warning: 'Warning',
    critical: 'Critical',
};

const severityColors = {
    critical: { bg: '#7f1d1d', color: '#fca5a5' },
    warning: { bg: '#78350f', color: '#fcd34d' },
    info: { bg: '#1e3a5f', color: '#93c5fd' },
};

const filterSelectStyle = {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '0.5rem 1rem',
    color: '#f8fafc',
    fontSize: '0.875rem',
};

const filterInputStyle = {
    ...filterSelectStyle,
    width: 'auto',
};

export default function ExchangesIndex({ exchanges = [], total = 0, page = 1, perPage = 20, totalPages = 1, filters = {}, machines = [] }) {
    const [searchValue, setSearchValue] = useState(filters?.q || '');

    const applyFilter = (newFilters) => {
        router.get('/exchanges', { ...filters, ...newFilters, page: 1 }, {
            preserveState: true,
            replace: true,
        });
    };

    const goToPage = (p) => {
        router.get('/exchanges', { ...filters, page: p }, {
            preserveState: true,
            replace: true,
        });
    };

    const clearFilters = () => {
        setSearchValue('');
        router.get('/exchanges', {}, { preserveState: true, replace: true });
    };

    const hasActiveFilters = filters?.q || filters?.platform || filters?.severity || filters?.machine_id || filters?.date_from || filters?.date_to;

    return (
        <DashboardLayout title="Historique des échanges">
            {/* Search bar */}
            <div style={{
                display: 'flex',
                gap: '0.75rem',
                marginBottom: '0.75rem',
                flexWrap: 'wrap',
                alignItems: 'center',
            }}>
                <div style={{ flex: 1, minWidth: 300, display: 'flex', gap: '0.5rem' }}>
                    <input
                        type="text"
                        placeholder="Rechercher dans les prompts et réponses..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                applyFilter({ q: searchValue });
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
                        }}
                    />
                    <button
                        onClick={() => applyFilter({ q: searchValue })}
                        style={{
                            background: '#3b82f6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '0.5rem 1rem',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Rechercher
                    </button>
                </div>
            </div>

            {/* Filters row */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1rem',
                flexWrap: 'wrap',
                alignItems: 'center',
            }}>
                <select
                    value={filters?.platform || ''}
                    onChange={(e) => applyFilter({ platform: e.target.value })}
                    style={filterSelectStyle}
                >
                    <option value="">Toutes les plateformes</option>
                    <option value="chatgpt">ChatGPT</option>
                    <option value="claude">Claude</option>
                    <option value="copilot">Copilot</option>
                    <option value="gemini">Gemini</option>
                    <option value="mistral">Mistral</option>
                </select>

                <select
                    value={filters?.severity || ''}
                    onChange={(e) => applyFilter({ severity: e.target.value })}
                    style={filterSelectStyle}
                >
                    <option value="">Toutes les sévérités</option>
                    <option value="critical">Critical</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                </select>

                <select
                    value={filters?.machine_id || ''}
                    onChange={(e) => applyFilter({ machine_id: e.target.value })}
                    style={filterSelectStyle}
                >
                    <option value="">Toutes les machines</option>
                    {machines.map((m) => (
                        <option key={m.id} value={m.id}>{m.hostname}</option>
                    ))}
                </select>

                <input
                    type="date"
                    value={filters?.date_from || ''}
                    onChange={(e) => applyFilter({ date_from: e.target.value })}
                    title="Date de début"
                    style={filterInputStyle}
                />
                <input
                    type="date"
                    value={filters?.date_to || ''}
                    onChange={(e) => applyFilter({ date_to: e.target.value })}
                    title="Date de fin"
                    style={filterInputStyle}
                />

                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        style={{
                            background: '#334155',
                            color: '#94a3b8',
                            border: 'none',
                            borderRadius: 8,
                            padding: '0.5rem 0.75rem',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                        }}
                    >
                        Effacer les filtres
                    </button>
                )}
            </div>

            {/* Results count */}
            <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '1rem' }}>
                {total} résultat{total !== 1 ? 's' : ''}
                {page > 1 ? ` — page ${page}/${totalPages}` : ''}
            </p>

            {/* Results */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {exchanges.length > 0 ? exchanges.map((exchange) => (
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
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#475569'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#334155'}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span>{platformIcons[exchange.platform] || '🔗'}</span>
                                <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                                    {exchange.platform || 'inconnu'}
                                </span>
                                {exchange.severity && (
                                    <span style={{
                                        padding: '0.15rem 0.4rem',
                                        borderRadius: 4,
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        background: (severityColors[exchange.severity] || severityColors.info).bg,
                                        color: (severityColors[exchange.severity] || severityColors.info).color,
                                    }}>
                                        {severityLabels[exchange.severity] || exchange.severity}
                                    </span>
                                )}
                                {exchange.machine_hostname && (
                                    <span style={{
                                        color: '#64748b',
                                        fontSize: '0.75rem',
                                        fontFamily: 'monospace',
                                    }}>
                                        {exchange.machine_hostname}
                                    </span>
                                )}
                            </div>
                            <span style={{ color: '#475569', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
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
                )) : (
                    <div style={{
                        background: '#1e293b',
                        borderRadius: 10,
                        padding: '3rem',
                        border: '1px solid #334155',
                        textAlign: 'center',
                    }}>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                            {hasActiveFilters ? 'Aucun résultat pour ces critères.' : 'Aucun échange enregistré.'}
                        </p>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginTop: '1.5rem',
                }}>
                    <button
                        disabled={page <= 1}
                        onClick={() => goToPage(page - 1)}
                        style={{
                            background: '#334155',
                            color: page <= 1 ? '#475569' : '#e2e8f0',
                            border: 'none',
                            borderRadius: 6,
                            padding: '0.4rem 0.75rem',
                            cursor: page <= 1 ? 'default' : 'pointer',
                            fontSize: '0.85rem',
                            opacity: page <= 1 ? 0.5 : 1,
                        }}
                    >
                        Précédent
                    </button>

                    {generatePageNumbers(page, totalPages).map((p, i) => (
                        p === '...' ? (
                            <span key={`dots-${i}`} style={{ color: '#64748b', fontSize: '0.85rem', padding: '0 0.25rem' }}>...</span>
                        ) : (
                            <button
                                key={p}
                                onClick={() => goToPage(p)}
                                style={{
                                    background: p === page ? '#3b82f6' : '#334155',
                                    color: p === page ? '#fff' : '#e2e8f0',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '0.4rem 0.65rem',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: p === page ? 600 : 400,
                                    minWidth: 32,
                                }}
                            >
                                {p}
                            </button>
                        )
                    ))}

                    <button
                        disabled={page >= totalPages}
                        onClick={() => goToPage(page + 1)}
                        style={{
                            background: '#334155',
                            color: page >= totalPages ? '#475569' : '#e2e8f0',
                            border: 'none',
                            borderRadius: 6,
                            padding: '0.4rem 0.75rem',
                            cursor: page >= totalPages ? 'default' : 'pointer',
                            fontSize: '0.85rem',
                            opacity: page >= totalPages ? 0.5 : 1,
                        }}
                    >
                        Suivant
                    </button>
                </div>
            )}
        </DashboardLayout>
    );
}

function generatePageNumbers(current, total) {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages = [];
    pages.push(1);

    if (current > 3) pages.push('...');

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i++) {
        pages.push(i);
    }

    if (current < total - 2) pages.push('...');

    pages.push(total);

    return pages;
}
