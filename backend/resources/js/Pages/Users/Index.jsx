import { router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import DashboardLayout from '../../Layouts/DashboardLayout';

const roleLabels = {
    admin: 'Administrateur',
    manager: 'Manager',
    viewer: 'Lecteur',
};

const roleColors = {
    admin: '#ef4444',
    manager: '#f59e0b',
    viewer: '#3b82f6',
};

const inputStyle = {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 6,
    padding: '0.5rem 0.75rem',
    color: '#f8fafc',
    fontSize: '0.85rem',
    width: '100%',
};

const selectStyle = {
    ...inputStyle,
    appearance: 'none',
    cursor: 'pointer',
};

export default function UsersIndex({ users }) {
    const { auth } = usePage().props;
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);

    return (
        <DashboardLayout title="Gestion des utilisateurs">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                    {users.length} utilisateur{users.length !== 1 ? 's' : ''}
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
                    {showForm ? 'Annuler' : '+ Ajouter un utilisateur'}
                </button>
            </div>

            {/* Add form */}
            {showForm && !editingId && (
                <UserForm
                    onCancel={() => setShowForm(false)}
                    onSuccess={() => setShowForm(false)}
                />
            )}

            {/* Users table */}
            <div style={{
                background: '#1e293b',
                borderRadius: 12,
                border: '1px solid #334155',
                overflow: 'hidden',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #334155' }}>
                            {['Nom', 'Email', 'Rôle', 'Créé le', 'Actions'].map((h) => (
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
                        {users.length > 0 ? users.map((user) => (
                            editingId === user.id ? (
                                <tr key={user.id}>
                                    <td colSpan={5} style={{ padding: '0.75rem' }}>
                                        <UserForm
                                            user={user}
                                            onCancel={() => setEditingId(null)}
                                            onSuccess={() => setEditingId(null)}
                                        />
                                    </td>
                                </tr>
                            ) : (
                                <tr key={user.id} style={{ borderBottom: '1px solid #0f172a' }}>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <span style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 500 }}>
                                            {user.name}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                                            {user.email}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '0.15rem 0.5rem',
                                            borderRadius: 4,
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            background: `${roleColors[user.role] || '#64748b'}20`,
                                            color: roleColors[user.role] || '#64748b',
                                        }}>
                                            {roleLabels[user.role] || user.role}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', color: '#64748b', fontSize: '0.8rem' }}>
                                        {new Date(user.created_at).toLocaleDateString('fr-FR')}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => { setEditingId(user.id); setShowForm(false); }}
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
                                            {user.id !== auth.user.id && (
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Supprimer l'utilisateur « ${user.name} » ?`)) {
                                                            router.delete(`/users/${user.id}`, { preserveScroll: true });
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
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        )) : (
                            <tr>
                                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                                    Aucun utilisateur.
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
                    <strong style={{ color: roleColors.admin }}>Administrateur</strong> : accès total (utilisateurs, règles, domaines).{' '}
                    <strong style={{ color: roleColors.manager }}>Manager</strong> : gestion règles, domaines, alertes.{' '}
                    <strong style={{ color: roleColors.viewer }}>Lecteur</strong> : consultation uniquement.
                </p>
            </div>
        </DashboardLayout>
    );
}

function UserForm({ user, onCancel, onSuccess }) {
    const isEdit = !!user;

    const form = useForm({
        name: user?.name || '',
        email: user?.email || '',
        password: '',
        role: user?.role || 'viewer',
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isEdit) {
            form.put(`/users/${user.id}`, {
                preserveScroll: true,
                onSuccess: () => onSuccess?.(),
            });
        } else {
            form.post('/users', {
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
            <div style={{ flex: 1, minWidth: 150 }}>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                    Nom
                </label>
                <input
                    type="text"
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                    placeholder="Jean Dupont"
                    style={inputStyle}
                />
                {form.errors.name && (
                    <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>{form.errors.name}</span>
                )}
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                    Email
                </label>
                <input
                    type="email"
                    value={form.data.email}
                    onChange={(e) => form.setData('email', e.target.value)}
                    placeholder="jean@gs2e.ci"
                    style={inputStyle}
                />
                {form.errors.email && (
                    <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>{form.errors.email}</span>
                )}
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                    Mot de passe {isEdit && <span style={{ color: '#64748b' }}>(laisser vide pour ne pas changer)</span>}
                </label>
                <input
                    type="password"
                    value={form.data.password}
                    onChange={(e) => form.setData('password', e.target.value)}
                    placeholder={isEdit ? '••••••••' : 'Min. 8 caractères'}
                    style={inputStyle}
                />
                {form.errors.password && (
                    <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>{form.errors.password}</span>
                )}
            </div>
            <div style={{ minWidth: 130 }}>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                    Rôle
                </label>
                <select
                    value={form.data.role}
                    onChange={(e) => form.setData('role', e.target.value)}
                    style={selectStyle}
                >
                    <option value="viewer">Lecteur</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Administrateur</option>
                </select>
                {form.errors.role && (
                    <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>{form.errors.role}</span>
                )}
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
