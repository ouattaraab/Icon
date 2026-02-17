import { useForm, usePage, router } from '@inertiajs/react';
import { useState } from 'react';
import DashboardLayout from '../../Layouts/DashboardLayout';
import { useTheme } from '../../Contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';

const roleLabels = { admin: 'Administrateur', manager: 'Manager', viewer: 'Lecteur' };
const roleColors = { admin: '#ef4444', manager: '#f59e0b', viewer: '#3b82f6' };

export default function ProfileIndex({ user, sessions = [] }) {
    const { theme: t } = useTheme();
    const isMobile = useIsMobile();

    const { flash } = usePage().props;
    const [twoFactorSetup, setTwoFactorSetup] = useState(null);
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [twoFactorError, setTwoFactorError] = useState('');
    const [twoFactorLoading, setTwoFactorLoading] = useState(false);
    const [disablePassword, setDisablePassword] = useState('');
    const [showDisableForm, setShowDisableForm] = useState(false);
    const [revokeAllPassword, setRevokeAllPassword] = useState('');
    const [showRevokeAll, setShowRevokeAll] = useState(false);

    const profileForm = useForm({
        name: user.name,
        email: user.email,
    });

    const passwordForm = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const notifForm = useForm({
        notify_critical_alerts: user.notify_critical_alerts ?? false,
    });

    const cardStyle = {
        background: t.surface,
        borderRadius: 12,
        padding: isMobile ? '1rem' : '1.5rem',
        border: `1px solid ${t.border}`,
        marginBottom: '1.5rem',
    };

    const labelStyle = {
        color: t.textSecondary,
        fontSize: '0.85rem',
        fontWeight: 500,
        display: 'block',
        marginBottom: '0.35rem',
    };

    const inputStyle = {
        width: '100%',
        padding: '0.6rem 0.75rem',
        borderRadius: 8,
        border: `1px solid ${t.border}`,
        background: t.bg,
        color: t.text,
        fontSize: '0.85rem',
        outline: 'none',
        boxSizing: 'border-box',
    };

    const errorStyle = {
        color: t.danger,
        fontSize: '0.7rem',
        margin: '0.25rem 0 0',
    };

    const handleProfileSubmit = (e) => {
        e.preventDefault();
        profileForm.put('/profile');
    };

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        passwordForm.put('/profile/password', {
            onSuccess: () => passwordForm.reset(),
        });
    };

    const handleNotifSubmit = (e) => {
        e.preventDefault();
        notifForm.put('/profile/notifications');
    };

    return (
        <DashboardLayout title="Mon profil">
            {flash?.success && (
                <div style={{
                    background: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    borderRadius: 8,
                    padding: '0.75rem 1rem',
                    marginBottom: '1.5rem',
                    color: '#22c55e',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                }}>
                    {flash.success}
                </div>
            )}

            {/* Info + Role badge */}
            <div style={{ ...cardStyle, display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '1rem' }}>
                <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: roleColors[user.role] || t.textFaint,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '1.25rem', fontWeight: 700,
                }}>
                    {user.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                    <p style={{ color: t.text, fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                        {user.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <span style={{ color: t.textMuted, fontSize: '0.8rem' }}>{user.email}</span>
                        <span style={{
                            padding: '0.1rem 0.5rem', borderRadius: 4,
                            fontSize: '0.65rem', fontWeight: 700,
                            color: roleColors[user.role] || t.textMuted,
                            background: `${roleColors[user.role] || '#94a3b8'}20`,
                        }}>
                            {roleLabels[user.role] || user.role}
                        </span>
                    </div>
                </div>
            </div>

            {/* Profile form */}
            <form onSubmit={handleProfileSubmit} style={cardStyle}>
                <h3 style={{ color: t.text, fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1.25rem' }}>
                    Informations personnelles
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                        <label style={labelStyle}>Nom</label>
                        <input
                            type="text"
                            style={inputStyle}
                            value={profileForm.data.name}
                            onChange={(e) => profileForm.setData('name', e.target.value)}
                        />
                        {profileForm.errors.name && <p style={errorStyle}>{profileForm.errors.name}</p>}
                    </div>
                    <div>
                        <label style={labelStyle}>Email</label>
                        <input
                            type="email"
                            style={inputStyle}
                            value={profileForm.data.email}
                            onChange={(e) => profileForm.setData('email', e.target.value)}
                        />
                        {profileForm.errors.email && <p style={errorStyle}>{profileForm.errors.email}</p>}
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        type="submit"
                        disabled={profileForm.processing}
                        style={{
                            background: t.accent, color: '#fff', border: 'none', borderRadius: 8,
                            padding: '0.6rem 1.5rem', fontSize: '0.85rem', fontWeight: 600,
                            cursor: profileForm.processing ? 'not-allowed' : 'pointer',
                            opacity: profileForm.processing ? 0.7 : 1,
                        }}
                    >
                        Enregistrer
                    </button>
                </div>
            </form>

            {/* Password form */}
            <form onSubmit={handlePasswordSubmit} style={cardStyle}>
                <h3 style={{ color: t.text, fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1.25rem' }}>
                    Changer le mot de passe
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                        <label style={labelStyle}>Mot de passe actuel</label>
                        <input
                            type="password"
                            style={inputStyle}
                            value={passwordForm.data.current_password}
                            onChange={(e) => passwordForm.setData('current_password', e.target.value)}
                        />
                        {passwordForm.errors.current_password && <p style={errorStyle}>{passwordForm.errors.current_password}</p>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={labelStyle}>Nouveau mot de passe</label>
                            <input
                                type="password"
                                style={inputStyle}
                                value={passwordForm.data.password}
                                onChange={(e) => passwordForm.setData('password', e.target.value)}
                            />
                            {passwordForm.errors.password && <p style={errorStyle}>{passwordForm.errors.password}</p>}
                        </div>
                        <div>
                            <label style={labelStyle}>Confirmer le mot de passe</label>
                            <input
                                type="password"
                                style={inputStyle}
                                value={passwordForm.data.password_confirmation}
                                onChange={(e) => passwordForm.setData('password_confirmation', e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        type="submit"
                        disabled={passwordForm.processing}
                        style={{
                            background: t.border, color: t.textSecondary, border: 'none', borderRadius: 8,
                            padding: '0.6rem 1.5rem', fontSize: '0.85rem', fontWeight: 600,
                            cursor: passwordForm.processing ? 'not-allowed' : 'pointer',
                            opacity: passwordForm.processing ? 0.7 : 1,
                        }}
                    >
                        Modifier le mot de passe
                    </button>
                </div>
            </form>

            {/* Notification preferences */}
            <form onSubmit={handleNotifSubmit} style={cardStyle}>
                <h3 style={{ color: t.text, fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1.25rem' }}>
                    Notifications
                </h3>
                <div
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        cursor: 'pointer', marginBottom: '1.25rem',
                    }}
                    onClick={() => notifForm.setData('notify_critical_alerts', !notifForm.data.notify_critical_alerts)}
                >
                    <div style={{
                        width: 40, height: 22, borderRadius: 11,
                        background: notifForm.data.notify_critical_alerts ? t.accent : t.border,
                        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    }}>
                        <div style={{
                            width: 16, height: 16, borderRadius: '50%', background: t.text,
                            position: 'absolute', top: 3,
                            left: notifForm.data.notify_critical_alerts ? 21 : 3,
                            transition: 'left 0.2s',
                        }} />
                    </div>
                    <div>
                        <span style={{ color: t.textSecondary, fontSize: '0.85rem', fontWeight: 500 }}>
                            Alertes critiques par email
                        </span>
                        <p style={{ color: t.textFaint, fontSize: '0.7rem', margin: '0.2rem 0 0' }}>
                            Recevoir un email lorsqu'une alerte critique est cr\u00e9\u00e9e
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        type="submit"
                        disabled={notifForm.processing}
                        style={{
                            background: t.accent, color: '#fff', border: 'none', borderRadius: 8,
                            padding: '0.6rem 1.5rem', fontSize: '0.85rem', fontWeight: 600,
                            cursor: notifForm.processing ? 'not-allowed' : 'pointer',
                            opacity: notifForm.processing ? 0.7 : 1,
                        }}
                    >
                        Enregistrer les pr\u00e9f\u00e9rences
                    </button>
                </div>
            </form>

            {/* Two-Factor Authentication */}
            <div style={cardStyle}>
                <h3 style={{ color: t.text, fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
                    Authentification \u00e0 deux facteurs (2FA)
                </h3>
                <p style={{ color: t.textFaint, fontSize: '0.8rem', margin: '0 0 1.25rem' }}>
                    Ajoutez une couche de s\u00e9curit\u00e9 suppl\u00e9mentaire \u00e0 votre compte avec un code TOTP.
                </p>

                {user.two_factor_enabled ? (
                    // 2FA is enabled
                    <div>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem',
                            padding: '0.6rem 0.75rem', background: 'rgba(34,197,94,0.1)',
                            border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8,
                        }}>
                            <span style={{ color: '#22c55e', fontWeight: 600, fontSize: '0.85rem' }}>
                                2FA activ\u00e9
                            </span>
                        </div>

                        {!showDisableForm ? (
                            <button
                                onClick={() => setShowDisableForm(true)}
                                style={{
                                    background: t.border, color: t.textSecondary, border: 'none', borderRadius: 8,
                                    padding: '0.6rem 1.5rem', fontSize: '0.85rem', fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                D\u00e9sactiver le 2FA
                            </button>
                        ) : (
                            <div>
                                <p style={{ color: t.textMuted, fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                                    Confirmez votre mot de passe pour d\u00e9sactiver le 2FA :
                                </p>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                    <div>
                                        <input
                                            type="password"
                                            value={disablePassword}
                                            onChange={(e) => setDisablePassword(e.target.value)}
                                            placeholder="Mot de passe"
                                            style={{ ...inputStyle, width: isMobile ? '100%' : 250 }}
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            router.delete('/two-factor/disable', {
                                                data: { password: disablePassword },
                                                onSuccess: () => {
                                                    setShowDisableForm(false);
                                                    setDisablePassword('');
                                                },
                                            });
                                        }}
                                        style={{
                                            background: t.danger, color: '#fff', border: 'none', borderRadius: 8,
                                            padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Confirmer
                                    </button>
                                    <button
                                        onClick={() => { setShowDisableForm(false); setDisablePassword(''); }}
                                        style={{
                                            background: 'transparent', color: t.textMuted, border: `1px solid ${t.border}`,
                                            borderRadius: 8, padding: '0.6rem 1rem', fontSize: '0.85rem',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Annuler
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : twoFactorSetup ? (
                    // Setup in progress
                    <div>
                        <p style={{ color: t.textSecondary, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                            1. Scannez ce QR code avec votre application (Google Authenticator, Authy, etc.) :
                        </p>

                        <div style={{
                            background: '#fff', padding: 16, borderRadius: 8,
                            display: 'inline-block', marginBottom: '1rem',
                        }}>
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(twoFactorSetup.otpauth_url)}`}
                                alt="QR Code 2FA"
                                width={200}
                                height={200}
                            />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <p style={{ color: t.textMuted, fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                                Ou entrez cette cl\u00e9 manuellement :
                            </p>
                            <code style={{
                                background: t.bg, color: '#f59e0b', padding: '0.4rem 0.75rem',
                                borderRadius: 6, fontSize: '0.85rem', fontFamily: 'monospace',
                                letterSpacing: '0.15em', wordBreak: 'break-all',
                            }}>
                                {twoFactorSetup.secret}
                            </code>
                        </div>

                        <p style={{ color: t.textSecondary, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                            2. Entrez le code \u00e0 6 chiffres pour confirmer :
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap' }}>
                            <div>
                                <input
                                    type="text"
                                    value={twoFactorCode}
                                    onChange={(e) => {
                                        setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                                        setTwoFactorError('');
                                    }}
                                    placeholder="000000"
                                    maxLength={6}
                                    style={{
                                        ...inputStyle, width: 160, fontSize: '1.25rem',
                                        letterSpacing: '0.3em', textAlign: 'center', fontFamily: 'monospace',
                                    }}
                                />
                                {twoFactorError && <p style={errorStyle}>{twoFactorError}</p>}
                            </div>
                            <button
                                onClick={() => {
                                    if (twoFactorCode.length !== 6) return;
                                    setTwoFactorLoading(true);
                                    fetch('/two-factor/confirm', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Accept': 'application/json',
                                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
                                            'X-Requested-With': 'XMLHttpRequest',
                                        },
                                        body: JSON.stringify({ code: twoFactorCode }),
                                    })
                                        .then((r) => r.json())
                                        .then((data) => {
                                            setTwoFactorLoading(false);
                                            if (data.success) {
                                                router.reload();
                                            } else {
                                                setTwoFactorError(data.error || 'Code invalide.');
                                            }
                                        })
                                        .catch(() => {
                                            setTwoFactorLoading(false);
                                            setTwoFactorError('Erreur r\u00e9seau.');
                                        });
                                }}
                                disabled={twoFactorLoading || twoFactorCode.length !== 6}
                                style={{
                                    background: t.success, color: '#fff', border: 'none', borderRadius: 8,
                                    padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 600,
                                    cursor: twoFactorLoading ? 'not-allowed' : 'pointer',
                                    opacity: twoFactorLoading || twoFactorCode.length !== 6 ? 0.6 : 1,
                                }}
                            >
                                {twoFactorLoading ? 'V\u00e9rification...' : 'Confirmer'}
                            </button>
                        </div>

                        {/* Recovery codes */}
                        <div style={{
                            background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8,
                            padding: '1rem', marginBottom: '1rem',
                        }}>
                            <p style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                                Codes de r\u00e9cup\u00e9ration (\u00e0 conserver en lieu s\u00fbr) :
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.35rem' }}>
                                {twoFactorSetup.recovery_codes?.map((code, i) => (
                                    <code key={i} style={{
                                        color: t.textSecondary, fontSize: '0.8rem', fontFamily: 'monospace',
                                    }}>
                                        {code}
                                    </code>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => { setTwoFactorSetup(null); setTwoFactorCode(''); setTwoFactorError(''); }}
                            style={{
                                background: 'transparent', color: t.textMuted, border: `1px solid ${t.border}`,
                                borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.8rem', cursor: 'pointer',
                            }}
                        >
                            Annuler
                        </button>
                    </div>
                ) : (
                    // 2FA not enabled, show enable button
                    <button
                        onClick={() => {
                            setTwoFactorLoading(true);
                            fetch('/two-factor/enable', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Accept': 'application/json',
                                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
                                    'X-Requested-With': 'XMLHttpRequest',
                                },
                            })
                                .then((r) => r.json())
                                .then((data) => {
                                    setTwoFactorLoading(false);
                                    if (data.secret) {
                                        setTwoFactorSetup(data);
                                    }
                                })
                                .catch(() => setTwoFactorLoading(false));
                        }}
                        disabled={twoFactorLoading}
                        style={{
                            background: t.accent, color: '#fff', border: 'none', borderRadius: 8,
                            padding: '0.6rem 1.5rem', fontSize: '0.85rem', fontWeight: 600,
                            cursor: twoFactorLoading ? 'not-allowed' : 'pointer',
                            opacity: twoFactorLoading ? 0.7 : 1,
                        }}
                    >
                        {twoFactorLoading ? 'Chargement...' : 'Activer le 2FA'}
                    </button>
                )}
            </div>

            {/* Active sessions */}
            <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem', flexDirection: isMobile ? 'column' : 'row' }}>
                    <h3 style={{ color: t.text, fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                        Sessions actives
                    </h3>
                    {sessions.length > 1 && (
                        !showRevokeAll ? (
                            <button
                                onClick={() => setShowRevokeAll(true)}
                                style={{
                                    background: 'transparent', color: t.danger, border: '1px solid #7f1d1d',
                                    borderRadius: 6, padding: '0.35rem 0.75rem', fontSize: '0.75rem',
                                    fontWeight: 600, cursor: 'pointer',
                                }}
                            >
                                R\u00e9voquer toutes les autres
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <input
                                    type="password"
                                    value={revokeAllPassword}
                                    onChange={(e) => setRevokeAllPassword(e.target.value)}
                                    placeholder="Mot de passe"
                                    style={{ ...inputStyle, width: isMobile ? '100%' : 160, fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                                />
                                <button
                                    onClick={() => {
                                        router.delete('/profile/sessions', {
                                            data: { password: revokeAllPassword },
                                            onSuccess: () => { setShowRevokeAll(false); setRevokeAllPassword(''); },
                                        });
                                    }}
                                    style={{
                                        background: t.danger, color: '#fff', border: 'none',
                                        borderRadius: 6, padding: '0.35rem 0.75rem', fontSize: '0.75rem',
                                        fontWeight: 600, cursor: 'pointer',
                                    }}
                                >
                                    Confirmer
                                </button>
                                <button
                                    onClick={() => { setShowRevokeAll(false); setRevokeAllPassword(''); }}
                                    style={{
                                        background: 'transparent', color: t.textMuted, border: `1px solid ${t.border}`,
                                        borderRadius: 6, padding: '0.35rem 0.75rem', fontSize: '0.75rem',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Annuler
                                </button>
                            </div>
                        )
                    )}
                </div>

                {sessions.length === 0 ? (
                    <p style={{ color: t.textFaint, fontSize: '0.85rem' }}>
                        Aucune session active trouv\u00e9e.
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {sessions.map((session) => (
                            <div
                                key={session.id}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                    padding: '0.65rem 0.75rem', background: t.bg,
                                    borderRadius: 8,
                                    border: session.is_current ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent',
                                }}
                            >
                                <div style={{
                                    width: 32, height: 32, borderRadius: 6,
                                    background: session.is_current ? '#1e3a5f' : t.border,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.85rem', flexShrink: 0,
                                }}>
                                    {session.user_agent?.includes('Mobile') || session.user_agent?.includes('iOS') || session.user_agent?.includes('Android')
                                        ? '\u{1f4f1}' : '\u{1f4bb}'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <p style={{ color: t.textSecondary, fontSize: '0.85rem', fontWeight: 500, margin: 0 }}>
                                            {session.user_agent}
                                        </p>
                                        {session.is_current && (
                                            <span style={{
                                                padding: '0.1rem 0.4rem', borderRadius: 4,
                                                fontSize: '0.6rem', fontWeight: 700,
                                                background: 'rgba(59,130,246,0.2)', color: '#60a5fa',
                                            }}>
                                                Cette session
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ color: t.textFaint, fontSize: '0.7rem', margin: '0.15rem 0 0' }}>
                                        {session.ip_address || 'IP inconnue'} — {session.last_activity}
                                    </p>
                                </div>
                                {!session.is_current && (
                                    <button
                                        onClick={() => {
                                            if (confirm('R\u00e9voquer cette session ?')) {
                                                router.delete(`/profile/sessions/${session.id}`);
                                            }
                                        }}
                                        style={{
                                            background: 'transparent', color: t.danger, border: '1px solid #7f1d1d',
                                            borderRadius: 6, padding: '0.3rem 0.6rem', fontSize: '0.7rem',
                                            cursor: 'pointer', flexShrink: 0, fontWeight: 600,
                                        }}
                                    >
                                        R\u00e9voquer
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
