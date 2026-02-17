import { router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import DashboardLayout from '../../Layouts/DashboardLayout';

const platformColors = {
    chatgpt: '#10a37f',
    openai: '#10a37f',
    claude: '#d97706',
    anthropic: '#d97706',
    copilot: '#3b82f6',
    github: '#3b82f6',
    gemini: '#8b5cf6',
    google: '#8b5cf6',
    huggingface: '#fbbf24',
    perplexity: '#22d3ee',
    mistral: '#f97316',
};

function getPlatformColor(name) {
    const lower = (name || '').toLowerCase();
    for (const [key, color] of Object.entries(platformColors)) {
        if (lower.includes(key)) return color;
    }
    return '#64748b';
}

const inputStyle = {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 6,
    padding: '0.5rem 0.75rem',
    color: '#f8fafc',
    fontSize: '0.85rem',
    width: '100%',
};

export default function DomainsIndex({ domains }) {
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);

    return (
        <DashboardLayout title="Domaines surveillés">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                    {domains.length} domaine{domains.length !== 1 ? 's' : ''} configuré{domains.length !== 1 ? 's' : ''}
                </p>
                <button
                    onClick={() => { setShowForm(!showForm); setEditingId(null); }}
                    style={{
                        background: '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '0.5rem 1rem',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                    }}
                >
                    {showForm ? 'Annuler' : '+ Ajouter un domaine'}
                </button>
            </div>

            {/* Add form */}
            {showForm && !editingId && (
                <DomainForm
                    onCancel={() => setShowForm(false)}
                    onSuccess={() => setShowForm(false)}
                />
            )}

            {/* Domains table */}
            <div style={{
                background: '#1e293b',
                borderRadius: 12,
                border: '1px solid #334155',
                overflow: 'hidden',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #334155' }}>
                            {['Domaine', 'Plateforme', 'Statut', 'Ajouté le', 'Actions'].map((h) => (
                                <th key={h} style={{
                                    padding: '0.75rem',
                                    textAlign: 'left',
                                    color: '#94a3b8',
                                    fontSize: '0.7rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: 1,
                                    fontWeight: 600,
                                }}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {domains.length > 0 ? domains.map((domain) => (
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
                                            display: 'inline-block',
                                            padding: '0.15rem 0.5rem',
                                            borderRadius: 4,
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
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
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.35rem',
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: 12,
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                background: domain.is_blocked ? '#ef444420' : '#22c55e20',
                                                color: domain.is_blocked ? '#ef4444' : '#22c55e',
                                            }}
                                        >
                                            <span style={{
                                                width: 6,
                                                height: 6,
                                                borderRadius: '50%',
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
                                                    background: '#334155',
                                                    color: '#e2e8f0',
                                                    border: 'none',
                                                    borderRadius: 4,
                                                    padding: '0.25rem 0.5rem',
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer',
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
                                                    background: '#ef444420',
                                                    color: '#ef4444',
                                                    border: 'none',
                                                    borderRadius: 4,
                                                    padding: '0.25rem 0.5rem',
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer',
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
                                    Aucun domaine configuré. Ajoutez des domaines IA à surveiller.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div style={{
                marginTop: '1rem',
                padding: '1rem',
                background: '#1e293b',
                borderRadius: 8,
                border: '1px solid #334155',
            }}>
                <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: 0 }}>
                    <strong style={{ color: '#22c55e' }}>Surveillé</strong> : le trafic est intercepté et loggé.{' '}
                    <strong style={{ color: '#ef4444' }}>Bloqué</strong> : l'accès est totalement interdit par l'agent.
                </p>
            </div>
        </DashboardLayout>
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
            form.put(`/domains/${domain.id}`, {
                preserveScroll: true,
                onSuccess: () => onSuccess?.(),
            });
        } else {
            form.post('/domains', {
                preserveScroll: true,
                onSuccess: () => {
                    form.reset();
                    onSuccess?.();
                },
            });
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{
            background: '#0f172a',
            borderRadius: 8,
            border: '1px solid #334155',
            padding: '1rem',
            marginBottom: '1rem',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
        }}>
            <div style={{ flex: 2, minWidth: 200 }}>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                    Domaine
                </label>
                <input
                    type="text"
                    value={form.data.domain}
                    onChange={(e) => form.setData('domain', e.target.value)}
                    placeholder="api.openai.com"
                    style={inputStyle}
                />
                {form.errors.domain && (
                    <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>{form.errors.domain}</span>
                )}
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                    Plateforme
                </label>
                <input
                    type="text"
                    value={form.data.platform_name}
                    onChange={(e) => form.setData('platform_name', e.target.value)}
                    placeholder="ChatGPT"
                    style={inputStyle}
                />
                {form.errors.platform_name && (
                    <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>{form.errors.platform_name}</span>
                )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={form.data.is_blocked}
                        onChange={(e) => form.setData('is_blocked', e.target.checked)}
                    />
                    <span style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 500 }}>Bloquer</span>
                </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                    type="submit"
                    disabled={form.processing}
                    style={{
                        background: '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '0.5rem 1rem',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        opacity: form.processing ? 0.7 : 1,
                    }}
                >
                    {isEdit ? 'Enregistrer' : 'Ajouter'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    style={{
                        background: '#334155',
                        color: '#94a3b8',
                        border: 'none',
                        borderRadius: 6,
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                    }}
                >
                    Annuler
                </button>
            </div>
        </form>
    );
}
