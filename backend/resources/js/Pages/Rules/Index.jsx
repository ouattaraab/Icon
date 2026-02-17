import { Link, router, usePage } from '@inertiajs/react';
import { useState, useRef, useCallback } from 'react';
import DashboardLayout from '../../Layouts/DashboardLayout';
import { useTheme } from '../../Contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';

const categoryColors = {
    block: { bg: '#7f1d1d', color: '#fca5a5' },
    alert: { bg: '#78350f', color: '#fcd34d' },
    log: { bg: '#1e3a5f', color: '#93c5fd' },
};

const btnStyle = {
    border: 'none', borderRadius: 8, padding: '0.6rem 1.2rem',
    cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
    textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
};

export default function RulesIndex({ rules }) {
    const { theme: t } = useTheme();
    const isMobile = useIsMobile();
    const { flash } = usePage().props;
    const fileInputRef = useRef(null);
    const [importing, setImporting] = useState(false);

    const handleExport = useCallback(() => {
        window.location.href = '/rules/export';
    }, []);

    const handleImportClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileSelected = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        router.post('/rules/import', { file }, {
            forceFormData: true,
            onFinish: () => {
                setImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
        });
    }, []);

    // Pagination
    const currentPage = rules?.current_page ?? 1;
    const lastPage = rules?.last_page ?? 1;

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
        router.get('/rules', { page }, { preserveState: true, replace: true });
    };

    return (
        <DashboardLayout title="Gestion des règles">
            {/* Flash messages */}
            {flash?.success && (
                <div style={{
                    background: 'rgba(34,197,94,0.1)', border: '1px solid #166534',
                    borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem',
                    color: '#86efac', fontSize: '0.85rem',
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

            {/* Action bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <p style={{ color: t.textMuted, fontSize: '0.875rem', margin: 0 }}>
                    {rules?.total ?? 0} règle(s) configurée(s)
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Export */}
                    <button
                        onClick={handleExport}
                        style={{ ...btnStyle, background: t.surface, color: t.textMuted, border: `1px solid ${t.border}` }}
                    >
                        Export JSON
                    </button>
                    {/* Import */}
                    <button
                        onClick={handleImportClick}
                        disabled={importing}
                        style={{ ...btnStyle, background: t.surface, color: t.textMuted, border: `1px solid ${t.border}`, opacity: importing ? 0.6 : 1 }}
                    >
                        {importing ? 'Import...' : 'Import JSON'}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        style={{ display: 'none' }}
                        onChange={handleFileSelected}
                    />
                    {/* Create */}
                    <Link
                        href="/rules/create"
                        style={{ ...btnStyle, background: t.accent, color: '#fff' }}
                    >
                        + Nouvelle règle
                    </Link>
                </div>
            </div>

            {/* Table */}
            <div className="icon-table-wrap" style={{
                background: t.surface,
                borderRadius: 12,
                border: `1px solid ${t.border}`,
                overflow: 'hidden',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                            {['Nom', 'Catégorie', ...(isMobile ? [] : ['Cible']), 'Type', ...(isMobile ? [] : ['Priorité']), 'Statut', 'Actions'].map((h) => (
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
                        {rules?.data?.length === 0 && (
                            <tr>
                                <td colSpan={isMobile ? 5 : 7} style={{ padding: '2rem', textAlign: 'center', color: t.textFaint }}>
                                    Aucune règle configurée. Créez-en une ou importez un fichier JSON.
                                </td>
                            </tr>
                        )}
                        {rules?.data?.map((rule) => {
                            const cat = categoryColors[rule.category] || categoryColors.log;
                            return (
                                <tr key={rule.id} style={{ borderBottom: `1px solid ${t.surface}` }}>
                                    <td style={{ padding: '0.75rem 1rem', color: t.text, fontSize: '0.875rem', fontWeight: 500 }}>
                                        {rule.name}
                                        {rule.description && (
                                            <p style={{ color: t.textFaint, fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
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
                                    {!isMobile && (
                                        <td style={{ padding: '0.75rem 1rem', color: t.textMuted, fontSize: '0.875rem' }}>
                                            {rule.target}
                                        </td>
                                    )}
                                    <td style={{ padding: '0.75rem 1rem', color: t.textMuted, fontSize: '0.875rem' }}>
                                        {rule.condition_type}
                                    </td>
                                    {!isMobile && (
                                        <td style={{ padding: '0.75rem 1rem', color: t.textMuted, fontSize: '0.875rem' }}>
                                            {rule.priority}
                                        </td>
                                    )}
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
                                                    color: t.accent, fontSize: '0.8rem',
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
                        Préc.
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
        </DashboardLayout>
    );
}
