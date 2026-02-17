import { Link, router } from '@inertiajs/react';
import DashboardLayout from '../../Layouts/DashboardLayout';

const categoryColors = {
    block: { bg: '#7f1d1d', color: '#fca5a5' },
    alert: { bg: '#78350f', color: '#fcd34d' },
    log: { bg: '#1e3a5f', color: '#93c5fd' },
};

export default function RulesIndex({ rules }) {
    return (
        <DashboardLayout title="Gestion des règles">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
                    {rules?.total ?? 0} règle(s) configurée(s)
                </p>
                <Link
                    href="/rules/create"
                    style={{
                        background: '#3b82f6', color: '#fff', border: 'none',
                        borderRadius: 8, padding: '0.6rem 1.2rem', cursor: 'pointer',
                        fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none',
                    }}
                >
                    + Nouvelle règle
                </Link>
            </div>

            <div style={{
                background: '#1e293b',
                borderRadius: 12,
                border: '1px solid #334155',
                overflow: 'hidden',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #334155' }}>
                            {['Nom', 'Catégorie', 'Cible', 'Type', 'Priorité', 'Statut', 'Actions'].map((h) => (
                                <th key={h} style={{
                                    padding: '0.75rem 1rem', textAlign: 'left',
                                    color: '#94a3b8', fontSize: '0.75rem',
                                    textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600,
                                }}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rules?.data?.map((rule) => {
                            const cat = categoryColors[rule.category] || categoryColors.log;
                            return (
                                <tr key={rule.id} style={{ borderBottom: '1px solid #1e293b' }}>
                                    <td style={{ padding: '0.75rem 1rem', color: '#f8fafc', fontSize: '0.875rem', fontWeight: 500 }}>
                                        {rule.name}
                                        {rule.description && (
                                            <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
                                                {rule.description}
                                            </p>
                                        )}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <span style={{
                                            padding: '0.2rem 0.5rem', borderRadius: 6,
                                            fontSize: '0.7rem', fontWeight: 700,
                                            background: cat.bg, color: cat.color,
                                            textTransform: 'uppercase',
                                        }}>
                                            {rule.category}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                        {rule.target}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                        {rule.condition_type}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                        {rule.priority}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <button
                                            onClick={() => router.post(`/rules/${rule.id}/toggle`)}
                                            style={{
                                                background: rule.enabled ? '#166534' : '#374151',
                                                color: rule.enabled ? '#86efac' : '#9ca3af',
                                                border: 'none', borderRadius: 20,
                                                padding: '0.3rem 0.8rem', cursor: 'pointer',
                                                fontSize: '0.75rem', fontWeight: 600,
                                            }}
                                        >
                                            {rule.enabled ? 'Actif' : 'Inactif'}
                                        </button>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <Link
                                                href={`/rules/${rule.id}/edit`}
                                                style={{
                                                    color: '#3b82f6', fontSize: '0.8rem',
                                                    textDecoration: 'none', fontWeight: 500,
                                                }}
                                            >
                                                Modifier
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </DashboardLayout>
    );
}
