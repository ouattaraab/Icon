import DashboardLayout from '../../Layouts/DashboardLayout';

const StatCard = ({ label, value, color = '#3b82f6', subtitle }) => (
    <div style={{
        background: '#1e293b',
        borderRadius: 12,
        padding: '1.5rem',
        border: '1px solid #334155',
    }}>
        <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
            {label}
        </p>
        <p style={{ color, fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0 0' }}>
            {value}
        </p>
        {subtitle && (
            <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
                {subtitle}
            </p>
        )}
    </div>
);

export default function DashboardIndex({ stats = {} }) {
    return (
        <DashboardLayout title="Tableau de bord">
            {/* Stats grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '2rem',
            }}>
                <StatCard
                    label="Machines actives"
                    value={stats.online_machines ?? 0}
                    color="#22c55e"
                    subtitle={`${stats.total_machines ?? 0} enregistrées`}
                />
                <StatCard
                    label="Événements (30j)"
                    value={stats.total_events ?? 0}
                    color="#3b82f6"
                />
                <StatCard
                    label="Requêtes bloquées"
                    value={stats.blocked_events ?? 0}
                    color="#f59e0b"
                />
                <StatCard
                    label="Alertes ouvertes"
                    value={stats.open_alerts ?? 0}
                    color={stats.critical_alerts > 0 ? '#ef4444' : '#94a3b8'}
                    subtitle={stats.critical_alerts > 0 ? `${stats.critical_alerts} critiques` : null}
                />
            </div>

            {/* Placeholder for charts */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr',
                gap: '1rem',
            }}>
                <div style={{
                    background: '#1e293b',
                    borderRadius: 12,
                    padding: '1.5rem',
                    border: '1px solid #334155',
                    minHeight: 300,
                }}>
                    <h3 style={{ color: '#f8fafc', fontSize: '1rem', margin: '0 0 1rem' }}>
                        Activité des dernières 24h
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                        Graphique d'activité (à implémenter avec Chart.js ou Recharts)
                    </p>
                </div>
                <div style={{
                    background: '#1e293b',
                    borderRadius: 12,
                    padding: '1.5rem',
                    border: '1px solid #334155',
                    minHeight: 300,
                }}>
                    <h3 style={{ color: '#f8fafc', fontSize: '1rem', margin: '0 0 1rem' }}>
                        Usage par plateforme
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                        Répartition (à implémenter avec Chart.js ou Recharts)
                    </p>
                </div>
            </div>
        </DashboardLayout>
    );
}
