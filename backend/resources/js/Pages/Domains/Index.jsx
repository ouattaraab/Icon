import { router, useForm, usePage } from '@inertiajs/react';
import { useState, useCallback } from 'react';
import DashboardLayout from '../../Layouts/DashboardLayout';

const platformColors = {
    chatgpt: '#10a37f', openai: '#10a37f',
    claude: '#d97706', anthropic: '#d97706',
    copilot: '#3b82f6', github: '#3b82f6',
    gemini: '#8b5cf6', google: '#8b5cf6',
    huggingface: '#fbbf24', perplexity: '#22d3ee', mistral: '#f97316',
};

function getPlatformColor(name) {
    const lower = (name || '').toLowerCase();
    for (const [key, color] of Object.entries(platformColors)) {
        if (lower.includes(key)) return color;
    }
    return '#64748b';
}

const inputStyle = {
    background: '#0f172a', border: '1px solid #334155', borderRadius: 6,
    padding: '0.5rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem', width: '100%',
};

const filterInputStyle = {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
    padding: '0.5rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem',
};

export default function DomainsIndex({ domains, platforms, filters }) {
    const { flash } = usePage().props;
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [search, setSearch] = useState(filters?.search || '');

    const applyFilters = useCallback((overrides = {}) => {
        const params = { ...filters, search, ...overrides };
        Object.keys(params).forEach((k) => { if (!params[k]) delete params[k]; });
        delete params.page;
        router.get('/domains', params, { preserveState: true, replace: true });
    }, [filters, search]);

    const currentPage = domains?.current_page ?? 1;
    const lastPage = domains?.last_page ?? 1;
    const total = domains?.total ?? 0;

    const hasFilters = filters?.search || filters?.status || filters?.platform;

    const goToPage = (page) => {
        if (page < 1 || page > lastPage || page === currentPage) return;
        router.get('/domains', { ...filters, page }, { preserveState: true, replace: true });
    };

    const generatePageNumbers = () => {
        const pages = [];
        if (lastPage <= 7) {
            for (let i = 1; i <= lastPage; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('...');
            for (let i = Math.max(2, currentPage - 1); i <= Math.min(lastPage - 1, currentPage + 1); i++) pages.push(i);
            if (currentPage < lastPage - 2) pages.push('...');
            pages.push(lastPage);
        }
        return pages;
    };

    return (
        <DashboardLayout title="Domaines surveillés">
            {/* Flash messages */}
            {flash?.success && (
                <div style={{
                    background: 'rgba(34,197,94,0.1)', border: '1px solid #166534',
                    borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem',
                    color: '#86efac', fontSize: '0.85rem',
                }}>{flash.success}</div>
            )}

            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <input
                    type="text"
                    placeholder="Rechercher un domaine..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                    style={{ ...filterInputStyle, width: 250 }}
                />
                <select
                    value={filters?.status || ''}
                    onChange={(e) => applyFilters({ status: e.target.value })}
                    style={filterInputStyle}
                >
                    <option value="">Tous les statuts</option>
                    <option value="monitored">Surveillé</option>
                    <option value="blocked">Bloqué</option>
                </select>
                <select
                    value={filters?.platform || ''}
                    onChange={(e) => applyFilters({ platform: e.target.value })}
                    style={filterInputStyle}
                >
                    <option value="">Toutes les plateformes</option>
                    {platforms?.map((p) => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
                <button onClick={() => applyFilters()} style={{
                    background: '#3b82f6', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer',
                    fontSize: '0.85rem', fontWeight: 600,
                }}>
                    Rechercher
                </button>
                {hasFilters && (
                    <button
                        onClick={() => { setSearch(''); router.get('/domains', {}, { preserveState: true, replace: true }); }}
                        style={{
                            background: 'transparent', color: '#94a3b8', border: '1px solid #334155',
                            borderRadius: 8, padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem',
                        }}
                    >
                        Effacer les filtres
                    </button>
                )}
                <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: 'auto' }}>
                    {total} domaine(s)
                </span>
                <button
                    onClick={() => { setShowForm(!showForm); setEditingId(null); }}
                    style={{
                        background: '#3b82f6', color: '#fff', border: 'none',
                        borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer',
                        fontSize: '0.85rem', fontWeight: 600,
                    }}
                >
                    {showForm ? 'Annuler' : '+ Ajouter'}
                </button>
            </div>

            {/* Add form */}
            {showForm && !editingId && (
                <DomainForm onCancel={() => setShowForm(false)} onSuccess={() => setShowForm(false)} />
            )}

            {/* Domains table */}
            <div style={{
                background: '#1e293b', borderRadius: 12,
                border: '1px solid #334155', overflow: 'hidden',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #334155' }}>
                            {['Domaine', 'Plateforme', 'Statut', 'Ajouté le', 'Actions'].map((h) => (
                                <th key={h} style={{
                                    padding: '0.75rem', textAlign: 'left', color: '#94a3b8',
                                    fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600,
                                }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {domains?.data?.length > 0 ? domains.data.map((domain) => (
                            editingId === domain.id ? (
                                <tr key={domain.id}>
                                    <td colSpan={5} style={{ padding: '0.75rem' }}>
                                        <DomainForm
                                            domain={domain}
                                            onCancel={() => setEditingId(null)}
                                            onSuccess={() => setEditingId(null)}
                                        />
                                    </td>
                                </tr>
                            ) : (
                                <tr key={domain.id} style={{ borderBottom: '1px solid #0f172a' }}>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <span style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 500, fontFamily: 'monospace' }}>
                                            {domain.domain}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <span style={{
                                            display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: 4,
                                            fontSize: '0.75rem', fontWeight: 600,
                                            background: `${getPlatformColor(domain.platform_name)}20`,
                                            color: getPlatformColor(domain.platform_name),
                                        }}>
                                            {domain.platform_name}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <button
                                            onClick={() => router.post(`/domains/${domain.id}/toggle`, {}, { preserveScroll: true })}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                                                padding: '0.2rem 0.6rem', borderRadius: 12,
                                                border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                                                background: domain.is_blocked ? '#ef444420' : '#22c55e20',
                                                color: domain.is_blocked ? '#ef4444' : '#22c55e',
                                            }}
                                        >
                                            <span style={{
                                                width: 6, height: 6, borderRadius: '50%',
                                                background: domain.is_blocked ? '#ef4444' : '#22c55e',
                                            }} />
                                            {domain.is_blocked ? 'Bloqué' : 'Surveillé'}
                                        </button>
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', color: '#64748b', fontSize: '0.8rem' }}>
                                        {new Date(domain.created_at).toLocaleDateString('fr-FR')}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => { setEditingId(domain.id); setShowForm(false); }}
                                                style={{
                                                    background: '#334155', color: '#e2e8f0', border: 'none',
                                                    borderRadius: 4, padding: '0.25rem 0.5rem',
                                                    fontSize: '0.75rem', cursor: 'pointer',
                                                }}
                                            >
                                                Modifier
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Supprimer le domaine « ${domain.domain} » ?`)) {
                                                        router.delete(`/domains/${domain.id}`, { preserveScroll: true });
                                                    }
                                                }}
                                                style={{
                                                    background: '#ef444420', color: '#ef4444', border: 'none',
                                                    borderRadius: 4, padding: '0.25rem 0.5rem',
                                                    fontSize: '0.75rem', cursor: 'pointer',
                                                }}
                                            >
                                                Supprimer
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        )) : (
                            <tr>
                                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                                    {hasFilters ? 'Aucun domaine ne correspond aux filtres.' : 'Aucun domaine configuré. Ajoutez des domaines IA à surveiller.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {lastPage > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.35rem', marginTop: '1.5rem' }}>
                    <PagBtn label="Préc." onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} />
                    {generatePageNumbers().map((p, i) =>
                        p === '...' ? (
                            <span key={`e${i}`} style={{ color: '#64748b', padding: '0 0.25rem' }}>...</span>
                        ) : (
                            <PagBtn key={p} label={p} onClick={() => goToPage(p)} active={p === currentPage} />
                        )
                    )}
                    <PagBtn label="Suiv." onClick={() => goToPage(currentPage + 1)} disabled={currentPage === lastPage} />
                </div>
            )}

            {/* Legend */}
            <div style={{
                marginTop: '1rem', padding: '1rem', background: '#1e293b',
                borderRadius: 8, border: '1px solid #334155',
            }}>
                <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: 0 }}>
                    <strong style={{ color: '#22c55e' }}>Surveillé</strong> : le trafic est intercepté et loggé.{' '}
                    <strong style={{ color: '#ef4444' }}>Bloqué</strong> : l'accès est totalement interdit par l'agent.
                </p>
            </div>
        </DashboardLayout>
    );
}

function PagBtn({ label, onClick, disabled, active }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                background: active ? '#3b82f6' : '#1e293b',
                border: '1px solid ' + (active ? '#3b82f6' : '#334155'),
                borderRadius: 6, padding: '0.4rem 0.7rem',
                color: active ? '#fff' : disabled ? '#475569' : '#e2e8f0',
                cursor: disabled ? 'default' : 'pointer',
                fontSize: '0.8rem', fontWeight: active ? 700 : 400,
            }}
        >
            {label}
        </button>
    );
}

function DomainForm({ domain, onCancel, onSuccess }) {
    const isEdit = !!domain;
    const form = useForm({
        domain: domain?.domain || '',
        platform_name: domain?.platform_name || '',
        is_blocked: domain?.is_blocked || false,
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isEdit) {
            form.put(`/domains/${domain.id}`, { preserveScroll: true, onSuccess: () => onSuccess?.() });
        } else {
            form.post('/domains', { preserveScroll: true, onSuccess: () => { form.reset(); onSuccess?.(); } });
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{
            background: '#0f172a', borderRadius: 8, border: '1px solid #334155',
            padding: '1rem', marginBottom: '1rem',
            display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap',
        }}>
            <div style={{ flex: 2, minWidth: 200 }}>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Domaine</label>
                <input
                    type="text" value={form.data.domain}
                    onChange={(e) => form.setData('domain', e.target.value)}
                    placeholder="api.openai.com" style={inputStyle}
                />
                {form.errors.domain && <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>{form.errors.domain}</span>}
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Plateforme</label>
                <input
                    type="text" value={form.data.platform_name}
                    onChange={(e) => form.setData('platform_name', e.target.value)}
                    placeholder="ChatGPT" style={inputStyle}
                />
                {form.errors.platform_name && <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>{form.errors.platform_name}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.data.is_blocked} onChange={(e) => form.setData('is_blocked', e.target.checked)} />
                    <span style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 500 }}>Bloquer</span>
                </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" disabled={form.processing} style={{
                    background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6,
                    padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                    opacity: form.processing ? 0.7 : 1,
                }}>
                    {isEdit ? 'Enregistrer' : 'Ajouter'}
                </button>
                <button type="button" onClick={onCancel} style={{
                    background: '#334155', color: '#94a3b8', border: 'none', borderRadius: 6,
                    padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem',
                }}>
                    Annuler
                </button>
            </div>
        </form>
    );
}
