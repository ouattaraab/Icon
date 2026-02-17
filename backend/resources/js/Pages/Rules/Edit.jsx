import { useForm, router } from '@inertiajs/react';
import DashboardLayout from '../../Layouts/DashboardLayout';
import RulePreview from '../../Components/RulePreview';
import { useTheme } from '../../Contexts/ThemeContext';

export default function RulesEdit({ rule }) {
    const { theme: t } = useTheme();

    const { data, setData, put, processing, errors } = useForm({
        name: rule.name || '',
        description: rule.description || '',
        category: rule.category || 'alert',
        target: rule.target || 'prompt',
        condition_type: rule.condition_type || 'keyword',
        condition_value: rule.condition_value || {},
        action_config: rule.action_config || { type: 'alert', severity: 'warning' },
        priority: rule.priority ?? 50,
        enabled: rule.enabled ?? true,
    });

    const inputStyle = {
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        padding: '0.6rem 1rem',
        color: t.text,
        fontSize: '0.875rem',
        width: '100%',
    };

    const labelStyle = {
        color: t.textMuted,
        fontSize: '0.8rem',
        fontWeight: 600,
        display: 'block',
        marginBottom: '0.4rem',
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        put(`/rules/${rule.id}`);
    };

    const handleDelete = () => {
        if (confirm('Supprimer cette r\u00e8gle ? Cette action est irr\u00e9versible.')) {
            router.delete(`/rules/${rule.id}`);
        }
    };

    return (
        <DashboardLayout title={`Modifier : ${rule.name}`}>
            <form onSubmit={handleSubmit} style={{ maxWidth: 700 }}>
                <div style={{
                    background: t.surface,
                    borderRadius: 12,
                    border: `1px solid ${t.border}`,
                    padding: '2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                }}>
                    {/* Header with version info */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: t.textMuted, fontSize: '0.75rem' }}>
                            Version : {rule.version} | ID : {rule.id?.slice(0, 8)}...
                        </span>
                        <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: 20,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: '#fff',
                            background: data.enabled ? t.success : t.danger,
                        }}>
                            {data.enabled ? 'Active' : 'Inactive'}
                        </span>
                    </div>

                    {/* Name */}
                    <div>
                        <label style={labelStyle}>Nom de la r\u00e8gle</label>
                        <input
                            type="text"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            style={inputStyle}
                        />
                        {errors.name && <p style={{ color: t.danger, fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.name}</p>}
                    </div>

                    {/* Description */}
                    <div>
                        <label style={labelStyle}>Description</label>
                        <textarea
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            rows={3}
                            style={{ ...inputStyle, resize: 'vertical' }}
                        />
                    </div>

                    {/* Category + Target row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={labelStyle}>Cat\u00e9gorie (action)</label>
                            <select value={data.category} onChange={(e) => {
                                setData('category', e.target.value);
                                if (e.target.value === 'block') {
                                    setData('action_config', { type: 'block', message: data.action_config?.message || '' });
                                } else {
                                    setData('action_config', { type: e.target.value, severity: data.action_config?.severity || 'warning' });
                                }
                            }} style={inputStyle}>
                                <option value="block">Bloquer</option>
                                <option value="alert">Alerter</option>
                                <option value="log">Journaliser</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Cible</label>
                            <select value={data.target} onChange={(e) => setData('target', e.target.value)} style={inputStyle}>
                                <option value="prompt">Prompt (requ\u00eate utilisateur)</option>
                                <option value="response">R\u00e9ponse IA</option>
                                <option value="clipboard">Presse-papier</option>
                                <option value="domain">Domaine</option>
                            </select>
                        </div>
                    </div>

                    {/* Condition type */}
                    <div>
                        <label style={labelStyle}>Type de condition</label>
                        <select value={data.condition_type} onChange={(e) => setData('condition_type', e.target.value)} style={inputStyle}>
                            <option value="keyword">Mots-cl\u00e9s</option>
                            <option value="regex">Expression r\u00e9guli\u00e8re</option>
                            <option value="domain_list">Liste de domaines</option>
                            <option value="content_length">Longueur du contenu</option>
                        </select>
                    </div>

                    {/* Condition value - keyword mode */}
                    {data.condition_type === 'keyword' && (
                        <div>
                            <label style={labelStyle}>Mots-cl\u00e9s (s\u00e9par\u00e9s par des virgules)</label>
                            <input
                                type="text"
                                value={(data.condition_value?.keywords || []).join(', ')}
                                onChange={(e) => setData('condition_value', {
                                    keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean),
                                    match_all: data.condition_value?.match_all || false,
                                })}
                                style={inputStyle}
                            />
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', color: t.textMuted, fontSize: '0.8rem' }}>
                                <input
                                    type="checkbox"
                                    checked={data.condition_value?.match_all || false}
                                    onChange={(e) => setData('condition_value', {
                                        ...data.condition_value,
                                        match_all: e.target.checked,
                                    })}
                                />
                                Tous les mots-cl\u00e9s doivent \u00eatre pr\u00e9sents
                            </label>
                        </div>
                    )}

                    {/* Condition value - regex mode */}
                    {data.condition_type === 'regex' && (
                        <div>
                            <label style={labelStyle}>Expression r\u00e9guli\u00e8re</label>
                            <input
                                type="text"
                                value={data.condition_value?.pattern || ''}
                                onChange={(e) => setData('condition_value', {
                                    pattern: e.target.value,
                                    case_insensitive: data.condition_value?.case_insensitive ?? true,
                                })}
                                style={{ ...inputStyle, fontFamily: 'monospace' }}
                            />
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', color: t.textMuted, fontSize: '0.8rem' }}>
                                <input
                                    type="checkbox"
                                    checked={data.condition_value?.case_insensitive ?? true}
                                    onChange={(e) => setData('condition_value', {
                                        ...data.condition_value,
                                        case_insensitive: e.target.checked,
                                    })}
                                />
                                Insensible \u00e0 la casse
                            </label>
                        </div>
                    )}

                    {/* Condition value - domain_list mode */}
                    {data.condition_type === 'domain_list' && (
                        <div>
                            <label style={labelStyle}>Domaines (un par ligne)</label>
                            <textarea
                                value={(data.condition_value?.domains || []).join('\n')}
                                onChange={(e) => setData('condition_value', {
                                    domains: e.target.value.split('\n').map(d => d.trim()).filter(Boolean),
                                })}
                                rows={4}
                                placeholder={"api.openai.com\nclaude.ai"}
                                style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }}
                            />
                        </div>
                    )}

                    {/* Condition value - content_length mode */}
                    {data.condition_type === 'content_length' && (
                        <div>
                            <label style={labelStyle}>Longueur maximale (caract\u00e8res)</label>
                            <input
                                type="number"
                                value={data.condition_value?.max_length || 10000}
                                onChange={(e) => setData('condition_value', {
                                    max_length: parseInt(e.target.value),
                                })}
                                min={100}
                                style={{ ...inputStyle, width: 200 }}
                            />
                        </div>
                    )}

                    {/* Priority */}
                    <div>
                        <label style={labelStyle}>Priorit\u00e9 (0-1000, plus \u00e9lev\u00e9 = \u00e9valu\u00e9 en premier)</label>
                        <input
                            type="number"
                            value={data.priority}
                            onChange={(e) => setData('priority', parseInt(e.target.value))}
                            min={0}
                            max={1000}
                            style={{ ...inputStyle, width: 150 }}
                        />
                    </div>

                    {/* Block message */}
                    {data.category === 'block' && (
                        <div>
                            <label style={labelStyle}>Message d'avertissement affich\u00e9 \u00e0 l'utilisateur</label>
                            <textarea
                                value={data.action_config?.message || ''}
                                onChange={(e) => setData('action_config', {
                                    type: 'block',
                                    message: e.target.value,
                                })}
                                rows={2}
                                style={{ ...inputStyle, resize: 'vertical' }}
                            />
                        </div>
                    )}

                    {/* Rule Preview / Tester */}
                    <RulePreview conditionType={data.condition_type} conditionValue={data.condition_value} />

                    {/* Enabled toggle */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: t.text, fontSize: '0.875rem' }}>
                        <input
                            type="checkbox"
                            checked={data.enabled}
                            onChange={(e) => setData('enabled', e.target.checked)}
                        />
                        R\u00e8gle active
                    </label>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                type="submit"
                                disabled={processing}
                                style={{
                                    background: t.accent, color: '#fff', border: 'none',
                                    borderRadius: 8, padding: '0.7rem 2rem', cursor: 'pointer',
                                    fontSize: '0.875rem', fontWeight: 600,
                                    opacity: processing ? 0.5 : 1,
                                }}
                            >
                                {processing ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                            <button
                                type="button"
                                onClick={() => router.visit('/rules')}
                                style={{
                                    background: 'transparent', color: t.textMuted,
                                    border: `1px solid ${t.border}`, borderRadius: 8,
                                    padding: '0.7rem 1.5rem', cursor: 'pointer',
                                    fontSize: '0.875rem',
                                }}
                            >
                                Annuler
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={handleDelete}
                            style={{
                                background: '#7f1d1d', color: '#fca5a5',
                                border: '1px solid #991b1b', borderRadius: 8,
                                padding: '0.7rem 1.5rem', cursor: 'pointer',
                                fontSize: '0.875rem',
                            }}
                        >
                            Supprimer
                        </button>
                    </div>
                </div>
            </form>
        </DashboardLayout>
    );
}
