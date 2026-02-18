import { router, usePage } from '@inertiajs/react';
import { useState, useCallback } from 'react';
import DashboardLayout from '../../Layouts/DashboardLayout';
import { useTheme } from '../../Contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';

const btnStyle = {
    border: 'none', borderRadius: 8, padding: '0.6rem 1.2rem',
    cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
};

const inputStyle = (t) => ({
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    padding: '0.5rem 1rem',
    color: t.text,
    fontSize: '0.875rem',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
});

const labelStyle = (t) => ({
    color: t.textSecondary,
    fontSize: '0.8rem',
    fontWeight: 600,
    marginBottom: '0.35rem',
    display: 'block',
});

export default function DepartmentsIndex({ departments, machines = [], filters }) {
    const { theme: t } = useTheme();
    const isMobile = useIsMobile();
    const { auth, flash } = usePage().props;
    const isManager = auth?.user?.role === 'admin' || auth?.user?.role === 'manager';

    const [search, setSearch] = useState(filters?.search || '');

    // Create/Edit modal
    const [showModal, setShowModal] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState(null);
    const [form, setForm] = useState({ name: '', description: '', manager_name: '' });
    const [formErrors, setFormErrors] = useState({});
    const [processing, setProcessing] = useState(false);

    // Assign machines modal
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignDepartment, setAssignDepartment] = useState(null);
    const [selectedMachines, setSelectedMachines] = useState([]);
    const [machineSearch, setMachineSearch] = useState('');

    // Delete confirm
    const [deletingId, setDeletingId] = useState(null);

    const openCreateModal = () => {
        setEditingDepartment(null);
        setForm({ name: '', description: '', manager_name: '' });
        setFormErrors({});
        setShowModal(true);
    };

    const openEditModal = (dept) => {
        setEditingDepartment(dept);
        setForm({
            name: dept.name || '',
            description: dept.description || '',
            manager_name: dept.manager_name || '',
        });
        setFormErrors({});
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingDepartment(null);
        setFormErrors({});
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setProcessing(true);
        setFormErrors({});

        if (editingDepartment) {
            router.put(`/departments/${editingDepartment.id}`, form, {
                onSuccess: () => { closeModal(); setProcessing(false); },
                onError: (errors) => { setFormErrors(errors); setProcessing(false); },
            });
        } else {
            router.post('/departments', form, {
                onSuccess: () => { closeModal(); setProcessing(false); },
                onError: (errors) => { setFormErrors(errors); setProcessing(false); },
            });
        }
    };

    const handleDelete = (dept) => {
        if (dept.machine_count > 0) return;
        setDeletingId(dept.id);
    };

    const confirmDelete = () => {
        if (!deletingId) return;
        router.delete(`/departments/${deletingId}`, {
            onSuccess: () => setDeletingId(null),
            onError: () => setDeletingId(null),
        });
    };

    const openAssignModal = (dept) => {
        setAssignDepartment(dept);
        setSelectedMachines([]);
        setMachineSearch('');
        setShowAssignModal(true);
    };

    const closeAssignModal = () => {
        setShowAssignModal(false);
        setAssignDepartment(null);
        setSelectedMachines([]);
    };

    const toggleMachineSelection = (id) => {
        setSelectedMachines((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const handleAssign = () => {
        if (!assignDepartment || selectedMachines.length === 0) return;
        setProcessing(true);
        router.post(`/departments/${assignDepartment.id}/assign-machines`, {
            machine_ids: selectedMachines,
        }, {
            onSuccess: () => { closeAssignModal(); setProcessing(false); },
            onError: () => setProcessing(false),
        });
    };

    const applyFilters = useCallback((overrides = {}) => {
        const params = { ...filters, search, ...overrides };
        Object.keys(params).forEach((k) => {
            if (!params[k]) delete params[k];
        });
        delete params.page;
        router.get('/departments', params, { preserveState: true, replace: true });
    }, [filters, search]);

    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter') applyFilters();
    };

    // Pagination
    const currentPage = departments?.current_page ?? 1;
    const lastPage = departments?.last_page ?? 1;
    const total = departments?.total ?? 0;

    const generatePageNumbers = () => {
        const pages = [];
        if (lastPage <= 7) {
            for (let i = 1; i <= lastPage; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('...');
            for (let i = Math.max(2, currentPage - 1); i <= Math.min(lastPage - 1, currentPage + 1); i++) {
                pages.push(i);
            }
            if (currentPage < lastPage - 2) pages.push('...');
            pages.push(lastPage);
        }
        return pages;
    };

    const goToPage = (page) => {
        if (page < 1 || page > lastPage || page === currentPage) return;
        router.get('/departments', { ...filters, page }, { preserveState: true, replace: true });
    };

    const filteredMachines = machines.filter((m) =>
        !machineSearch || m.hostname.toLowerCase().includes(machineSearch.toLowerCase())
    );

    // Modal backdrop style
    const backdropStyle = {
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
    };

    const modalStyle = {
        background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`,
        padding: '1.5rem', width: '100%', maxWidth: 500,
        boxShadow: `0 20px 40px ${t.shadow}`, maxHeight: '90vh', overflowY: 'auto',
    };

    return (
        <DashboardLayout title="D\u00e9partements">
            {/* Flash messages */}
            {flash?.success && (
                <div style={{
                    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                    borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem',
                    color: t.success || '#86efac', fontSize: '0.85rem', fontWeight: 500,
                }}>
                    {flash.success}
                </div>
            )}
            {flash?.error && (
                <div style={{
                    background: 'rgba(239,68,68,0.1)', border: '1px solid #991b1b',
                    borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem',
                    color: '#fca5a5', fontSize: '0.85rem',
                }}>
                    {flash.error}
                </div>
            )}

            {/* Filters & Actions */}
            <div style={{
                display: 'flex', gap: isMobile ? '0.5rem' : '0.75rem', marginBottom: '1.5rem',
                flexWrap: 'wrap', alignItems: 'center',
            }}>
                <input
                    type="text"
                    placeholder="Rechercher (nom, responsable)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    style={{
                        background: t.surface, border: `1px solid ${t.border}`,
                        borderRadius: 8, padding: '0.5rem 1rem', color: t.text,
                        fontSize: '0.875rem', width: isMobile ? '100%' : 300, outline: 'none',
                    }}
                />
                <button
                    onClick={() => applyFilters()}
                    style={{
                        background: t.accent, color: '#fff', border: 'none',
                        borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer',
                        fontSize: '0.875rem', fontWeight: 600,
                    }}
                >
                    Rechercher
                </button>
                {filters?.search && (
                    <button
                        onClick={() => {
                            setSearch('');
                            router.get('/departments', {}, { preserveState: true, replace: true });
                        }}
                        style={{
                            background: 'transparent', color: t.textMuted, border: `1px solid ${t.border}`,
                            borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.8rem',
                        }}
                    >
                        Effacer
                    </button>
                )}
                <span style={{ color: t.textFaint, fontSize: '0.8rem', marginLeft: 'auto' }}>
                    {total} d\u00e9partement(s)
                </span>
                {isManager && (
                    <button
                        onClick={openCreateModal}
                        style={{ ...btnStyle, background: t.accent, color: '#fff' }}
                    >
                        + Ajouter
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="icon-table-wrap" style={{
                background: t.surface, borderRadius: 12,
                border: `1px solid ${t.border}`, overflow: 'hidden',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                            {(isMobile
                                ? ['Nom', 'Machines', 'Actions']
                                : ['Nom', 'Description', 'Responsable', 'Machines', 'Actions']
                            ).map((h) => (
                                <th key={h} style={{
                                    padding: '0.75rem 1rem', textAlign: 'left',
                                    color: t.textMuted, fontSize: '0.75rem',
                                    textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600,
                                }}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {departments?.data?.length === 0 && (
                            <tr>
                                <td colSpan={isMobile ? 3 : 5} style={{
                                    padding: '2rem', textAlign: 'center', color: t.textFaint,
                                }}>
                                    Aucun d\u00e9partement configur\u00e9. Cr\u00e9ez-en un avec le bouton "Ajouter".
                                </td>
                            </tr>
                        )}
                        {departments?.data?.map((dept) => (
                            <tr key={dept.id} style={{ borderBottom: `1px solid ${t.surface}` }}>
                                <td style={{
                                    padding: '0.75rem 1rem', color: t.text,
                                    fontSize: '0.875rem', fontWeight: 500,
                                }}>
                                    {dept.name}
                                </td>
                                {!isMobile && (
                                    <td style={{
                                        padding: '0.75rem 1rem', color: t.textMuted,
                                        fontSize: '0.85rem', maxWidth: 300,
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {dept.description || '\u2014'}
                                    </td>
                                )}
                                {!isMobile && (
                                    <td style={{
                                        padding: '0.75rem 1rem', color: t.textMuted, fontSize: '0.875rem',
                                    }}>
                                        {dept.manager_name || '\u2014'}
                                    </td>
                                )}
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    <span style={{
                                        display: 'inline-block', padding: '0.2rem 0.6rem',
                                        borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                                        background: dept.machine_count > 0 ? '#166534' : '#374151',
                                        color: dept.machine_count > 0 ? '#86efac' : '#9ca3af',
                                    }}>
                                        {dept.machine_count}
                                    </span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    {isManager && (
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <button
                                                onClick={() => openEditModal(dept)}
                                                style={{
                                                    color: t.accent, fontSize: '0.8rem', background: 'transparent',
                                                    border: 'none', cursor: 'pointer', fontWeight: 500, padding: 0,
                                                }}
                                            >
                                                Modifier
                                            </button>
                                            <button
                                                onClick={() => openAssignModal(dept)}
                                                style={{
                                                    color: t.textSecondary, fontSize: '0.8rem', background: 'transparent',
                                                    border: 'none', cursor: 'pointer', fontWeight: 500, padding: 0,
                                                }}
                                            >
                                                Assigner
                                            </button>
                                            <button
                                                onClick={() => handleDelete(dept)}
                                                disabled={dept.machine_count > 0}
                                                style={{
                                                    color: dept.machine_count > 0 ? t.textSubtle : '#ef4444',
                                                    fontSize: '0.8rem', background: 'transparent',
                                                    border: 'none',
                                                    cursor: dept.machine_count > 0 ? 'not-allowed' : 'pointer',
                                                    fontWeight: 500, padding: 0,
                                                    opacity: dept.machine_count > 0 ? 0.5 : 1,
                                                }}
                                                title={dept.machine_count > 0 ? 'Impossible de supprimer : des machines sont assign\u00e9es' : 'Supprimer'}
                                            >
                                                Supprimer
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {lastPage > 1 && (
                <div style={{
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    gap: '0.35rem', marginTop: '1.5rem',
                }}>
                    <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        style={{
                            background: t.surface, border: `1px solid ${t.border}`, borderRadius: 6,
                            padding: '0.4rem 0.75rem', color: currentPage === 1 ? t.textSubtle : t.textSecondary,
                            cursor: currentPage === 1 ? 'default' : 'pointer', fontSize: '0.8rem',
                        }}
                    >
                        Pr\u00e9c.
                    </button>
                    {generatePageNumbers().map((p, i) =>
                        p === '...' ? (
                            <span key={`e${i}`} style={{ color: t.textFaint, padding: '0 0.25rem' }}>...</span>
                        ) : (
                            <button
                                key={p}
                                onClick={() => goToPage(p)}
                                style={{
                                    background: p === currentPage ? t.accent : t.surface,
                                    border: `1px solid ${p === currentPage ? t.accent : t.border}`,
                                    borderRadius: 6, padding: '0.4rem 0.7rem',
                                    color: p === currentPage ? '#fff' : t.textSecondary,
                                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: p === currentPage ? 700 : 400,
                                }}
                            >
                                {p}
                            </button>
                        )
                    )}
                    <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === lastPage}
                        style={{
                            background: t.surface, border: `1px solid ${t.border}`, borderRadius: 6,
                            padding: '0.4rem 0.75rem', color: currentPage === lastPage ? t.textSubtle : t.textSecondary,
                            cursor: currentPage === lastPage ? 'default' : 'pointer', fontSize: '0.8rem',
                        }}
                    >
                        Suiv.
                    </button>
                </div>
            )}

            {/* Create / Edit Modal */}
            {showModal && (
                <div style={backdropStyle} onClick={closeModal}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ color: t.text, fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1.25rem' }}>
                            {editingDepartment ? 'Modifier le d\u00e9partement' : 'Nouveau d\u00e9partement'}
                        </h3>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={labelStyle(t)}>Nom *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    style={inputStyle(t)}
                                    required
                                    autoFocus
                                />
                                {formErrors.name && (
                                    <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
                                        {formErrors.name}
                                    </p>
                                )}
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={labelStyle(t)}>Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    style={{ ...inputStyle(t), minHeight: 80, resize: 'vertical' }}
                                    rows={3}
                                />
                                {formErrors.description && (
                                    <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
                                        {formErrors.description}
                                    </p>
                                )}
                            </div>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={labelStyle(t)}>Responsable</label>
                                <input
                                    type="text"
                                    value={form.manager_name}
                                    onChange={(e) => setForm({ ...form, manager_name: e.target.value })}
                                    style={inputStyle(t)}
                                />
                                {formErrors.manager_name && (
                                    <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
                                        {formErrors.manager_name}
                                    </p>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    style={{
                                        ...btnStyle, background: 'transparent',
                                        color: t.textMuted, border: `1px solid ${t.border}`,
                                    }}
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    style={{
                                        ...btnStyle, background: t.accent, color: '#fff',
                                        opacity: processing ? 0.6 : 1,
                                    }}
                                >
                                    {processing ? 'Enregistrement...' : (editingDepartment ? 'Mettre \u00e0 jour' : 'Cr\u00e9er')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Machines Modal */}
            {showAssignModal && assignDepartment && (
                <div style={backdropStyle} onClick={closeAssignModal}>
                    <div style={{ ...modalStyle, maxWidth: 550 }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ color: t.text, fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
                            Assigner des machines
                        </h3>
                        <p style={{ color: t.textMuted, fontSize: '0.85rem', margin: '0 0 1rem' }}>
                            D\u00e9partement : <strong style={{ color: t.text }}>{assignDepartment.name}</strong>
                        </p>
                        <input
                            type="text"
                            placeholder="Filtrer par hostname..."
                            value={machineSearch}
                            onChange={(e) => setMachineSearch(e.target.value)}
                            style={{ ...inputStyle(t), marginBottom: '0.75rem' }}
                        />
                        <div style={{
                            maxHeight: 300, overflowY: 'auto',
                            border: `1px solid ${t.border}`, borderRadius: 8,
                            marginBottom: '1rem',
                        }}>
                            {filteredMachines.length === 0 ? (
                                <p style={{
                                    padding: '1rem', textAlign: 'center',
                                    color: t.textFaint, fontSize: '0.85rem',
                                }}>
                                    Aucune machine trouv\u00e9e.
                                </p>
                            ) : (
                                filteredMachines.map((m) => {
                                    const isAssigned = m.department_id === assignDepartment.id;
                                    const isSelected = selectedMachines.includes(m.id);
                                    return (
                                        <div
                                            key={m.id}
                                            onClick={() => toggleMachineSelection(m.id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                padding: '0.55rem 0.75rem', cursor: 'pointer',
                                                borderBottom: `1px solid ${t.bg}`,
                                                background: isSelected ? `${t.accent}15` : 'transparent',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleMachineSelection(m.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                style={{ accentColor: t.accent, cursor: 'pointer' }}
                                            />
                                            <span style={{ color: t.text, fontSize: '0.85rem', flex: 1 }}>
                                                {m.hostname}
                                            </span>
                                            {isAssigned && (
                                                <span style={{
                                                    fontSize: '0.65rem', color: t.accent,
                                                    fontWeight: 600, flexShrink: 0,
                                                }}>
                                                    D\u00e9j\u00e0 assign\u00e9
                                                </span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: t.textFaint, fontSize: '0.8rem' }}>
                                {selectedMachines.length} machine(s) s\u00e9lectionn\u00e9e(s)
                            </span>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button
                                    type="button"
                                    onClick={closeAssignModal}
                                    style={{
                                        ...btnStyle, background: 'transparent',
                                        color: t.textMuted, border: `1px solid ${t.border}`,
                                    }}
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleAssign}
                                    disabled={processing || selectedMachines.length === 0}
                                    style={{
                                        ...btnStyle, background: t.accent, color: '#fff',
                                        opacity: (processing || selectedMachines.length === 0) ? 0.6 : 1,
                                    }}
                                >
                                    {processing ? 'Assignation...' : 'Assigner'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {deletingId && (
                <div style={backdropStyle} onClick={() => setDeletingId(null)}>
                    <div style={{ ...modalStyle, maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ color: t.text, fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.75rem' }}>
                            Confirmer la suppression
                        </h3>
                        <p style={{ color: t.textMuted, fontSize: '0.875rem', margin: '0 0 1.25rem' }}>
                            \u00cates-vous s\u00fbr de vouloir supprimer ce d\u00e9partement ? Cette action est irr\u00e9versible.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setDeletingId(null)}
                                style={{
                                    ...btnStyle, background: 'transparent',
                                    color: t.textMuted, border: `1px solid ${t.border}`,
                                }}
                            >
                                Annuler
                            </button>
                            <button
                                onClick={confirmDelete}
                                style={{ ...btnStyle, background: '#ef4444', color: '#fff' }}
                            >
                                Supprimer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
