import { useForm } from '@inertiajs/react';
import DashboardLayout from '../../Layouts/DashboardLayout';

const inputStyle = {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '0.6rem 1rem',
    color: '#f8fafc',
    fontSize: '0.875rem',
    width: '100%',
};

const labelStyle = {
    color: '#94a3b8',
    fontSize: '0.8rem',
    fontWeight: 600,
    display: 'block',
    marginBottom: '0.4rem',
};

export default function RulesCreate() {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        description: '',
        category: 'alert',
        target: 'prompt',
        condition_type: 'keyword',
        condition_value: { keywords: [], match_all: false },
        action_config: { type: 'alert', severity: 'warning' },
        priority: 50,
        enabled: true,
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        post('/rules');
    };

    return (
        <DashboardLayout title="Nouvelle règle">
            <form onSubmit={handleSubmit} style={{ maxWidth: 700 }}>
                <div style={{
                    background: '#1e293b',
                    borderRadius: 12,
                    border: '1px solid #334155',
                    padding: '2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                }}>
                    {/* Name */}
                    <div>
                        <label style={labelStyle}>Nom de la règle</label>
                        <input
                            type="text"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder="Ex: Bloquer génération cahier des charges"
                            style={inputStyle}
                        />
                        {errors.name && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.name}</p>}
                    </div>

                    {/* Description */}
                    <div>
                        <label style={labelStyle}>Description</label>
                        <textarea
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            placeholder="Description optionnelle de la règle..."
                            rows={3}
                            style={{ ...inputStyle, resize: 'vertical' }}
                        />
                    </div>

                    {/* Category + Target row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={labelStyle}>Catégorie (action)</label>
                            <select value={data.category} onChange={(e) => setData('category', e.target.value)} style={inputStyle}>
                                <option value="block">Bloquer</option>
                                <option value="alert">Alerter</option>
                                <option value="log">Journaliser</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Cible</label>
                            <select value={data.target} onChange={(e) => setData('target', e.target.value)} style={inputStyle}>
                                <option value="prompt">Prompt (requête utilisateur)</option>
                                <option value="response">Réponse IA</option>
                                <option value="clipboard">Presse-papier</option>
                                <option value="domain">Domaine</option>
                            </select>
                        </div>
                    </div>

                    {/* Condition type */}
                    <div>
                        <label style={labelStyle}>Type de condition</label>
                        <select value={data.condition_type} onChange={(e) => setData('condition_type', e.target.value)} style={inputStyle}>
                            <option value="keyword">Mots-clés</option>
                            <option value="regex">Expression régulière</option>
                            <option value="domain_list">Liste de domaines</option>
                            <option value="content_length">Longueur du contenu</option>
                        </select>
                    </div>

                    {/* Condition value - keyword mode */}
                    {data.condition_type === 'keyword' && (
                        <div>
                            <label style={labelStyle}>Mots-clés (séparés par des virgules)</label>
                            <input
                                type="text"
                                placeholder="cahier des charges, code source, mot de passe"
                                onChange={(e) => setData('condition_value', {
                                    keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean),
                                    match_all: data.condition_value?.match_all || false,
                                })}
                                style={inputStyle}
                            />
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                <input
                                    type="checkbox"
                                    checked={data.condition_value?.match_all || false}
                                    onChange={(e) => setData('condition_value', {
                                        ...data.condition_value,
                                        match_all: e.target.checked,
                                    })}
                                />
                                Tous les mots-clés doivent être présents
                            </label>
                        </div>
                    )}

                    {/* Condition value - regex mode */}
                    {data.condition_type === 'regex' && (
                        <div>
                            <label style={labelStyle}>Expression régulière</label>
                            <input
                                type="text"
                                placeholder="Ex: \b(confidentiel|secret|mdp)\b"
                                onChange={(e) => setData('condition_value', {
                                    pattern: e.target.value,
                                    case_insensitive: true,
                                })}
                                style={{ ...inputStyle, fontFamily: 'monospace' }}
                            />
                        </div>
                    )}

                    {/* Priority */}
                    <div>
                        <label style={labelStyle}>Priorité (0-1000, plus élevé = évalué en premier)</label>
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
                            <label style={labelStyle}>Message d'avertissement affiché à l'utilisateur</label>
                            <textarea
                                value={data.action_config?.message || ''}
                                onChange={(e) => setData('action_config', {
                                    type: 'block',
                                    message: e.target.value,
                                })}
                                placeholder="Cette action n'est pas autorisée par la politique de sécurité GS2E."
                                rows={2}
                                style={{ ...inputStyle, resize: 'vertical' }}
                            />
                        </div>
                    )}

                    {/* Submit */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                            type="submit"
                            disabled={processing}
                            style={{
                                background: '#3b82f6', color: '#fff', border: 'none',
                                borderRadius: 8, padding: '0.7rem 2rem', cursor: 'pointer',
                                fontSize: '0.875rem', fontWeight: 600,
                                opacity: processing ? 0.5 : 1,
                            }}
                        >
                            {processing ? 'Création...' : 'Créer la règle'}
                        </button>
                    </div>
                </div>
            </form>
        </DashboardLayout>
    );
}
