import { Link, router } from '@inertiajs/react';
import DashboardLayout from '../../Layouts/DashboardLayout';

const statusColors = {
    online: '#22c55e',
    active: '#3b82f6',
    offline: '#ef4444',
    inactive: '#94a3b8',
};

const osIcons = {
    windows: '🪟',
    macos: '🍎',
};

export default function MachinesIndex({ machines, filters }) {
    return (
        <DashboardLayout title="Parc machines">
            {/* Filters */}
            <div style={{
                display: 'flex',
                gap: '0.75rem',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
            }}>
                <input
                    type="text"
                    placeholder="Rechercher (hostname, utilisateur)..."
                    defaultValue={filters?.search || ''}
                    onChange={(e) => {
                        router.get('/machines', { ...filters, search: e.target.value }, {
                            preserveState: true,
                            replace: true,
                        });
                    }}
                    style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        padding: '0.5rem 1rem',
                        color: '#f8fafc',
                        fontSize: '0.875rem',
                        width: 300,
                    }}
                />
                <select
                    defaultValue={filters?.os || ''}
                    onChange={(e) => router.get('/machines', { ...filters, os: e.target.value }, { preserveState: true, replace: true })}
                    style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        padding: '0.5rem 1rem',
                        color: '#f8fafc',
                        fontSize: '0.875rem',
                    }}
                >
                    <option value="">Tous les OS</option>
                    <option value="windows">Windows</option>
                    <option value="macos">macOS</option>
                </select>
            </div>

            {/* Table */}
            <div style={{
                background: '#1e293b',
                borderRadius: 12,
                border: '1px solid #334155',
                overflow: 'hidden',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #334155' }}>
                            {['Hostname', 'OS', 'Agent', 'Statut', 'Dernier contact', 'Département', 'Utilisateur'].map((h) => (
                                <th key={h} style={{
                                    padding: '0.75rem 1rem',
                                    textAlign: 'left',
                                    color: '#94a3b8',
                                    fontSize: '0.75rem',
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
                        {machines?.data?.map((machine) => (
                            <tr
                                key={machine.id}
                                style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer' }}
                                onClick={() => router.visit(`/machines/${machine.id}`)}
                            >
                                <td style={{ padding: '0.75rem 1rem', color: '#f8fafc', fontSize: '0.875rem', fontWeight: 500 }}>
                                    {machine.hostname}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                    {osIcons[machine.os] || ''} {machine.os} {machine.os_version}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                    v{machine.agent_version}
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    <span style={{
                                        display: 'inline-block',
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: 20,
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        color: '#fff',
                                        background: statusColors[machine.status] || '#94a3b8',
                                    }}>
                                        {machine.status}
                                    </span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                    {machine.last_heartbeat || '—'}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                    {machine.department || '—'}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                    {machine.assigned_user || '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </DashboardLayout>
    );
}
