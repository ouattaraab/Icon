import { useForm } from '@inertiajs/react';
import { useTheme } from '../../Contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';

export default function Login() {
    const { theme: t } = useTheme();
    const isMobile = useIsMobile();
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (e) => {
        e.preventDefault();
        post('/login');
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: t.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <div style={{
                background: t.surface,
                borderRadius: isMobile ? '0' : '12px',
                padding: isMobile ? '24px 16px' : '40px',
                width: '100%',
                maxWidth: isMobile ? '100%' : '400px',
                boxShadow: isMobile ? 'none' : '0 25px 50px rgba(0,0,0,0.5)',
            }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: t.text, margin: 0 }}>
                        Icon
                    </h1>
                    <p style={{ color: t.textMuted, marginTop: '8px', fontSize: '14px' }}>
                        Monitoring IA — GS2E
                    </p>
                </div>

                <form onSubmit={submit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', color: '#cbd5e1', fontSize: '14px', marginBottom: '6px' }}>
                            Email
                        </label>
                        <input
                            type="email"
                            value={data.email}
                            onChange={e => setData('email', e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                background: t.bg,
                                border: errors.email ? `1px solid ${t.danger}` : `1px solid ${t.border}`,
                                borderRadius: '8px',
                                color: t.text,
                                fontSize: '14px',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                            placeholder="admin@gs2e.ci"
                            autoFocus
                        />
                        {errors.email && (
                            <p style={{ color: t.danger, fontSize: '12px', marginTop: '4px' }}>{errors.email}</p>
                        )}
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', color: '#cbd5e1', fontSize: '14px', marginBottom: '6px' }}>
                            Mot de passe
                        </label>
                        <input
                            type="password"
                            value={data.password}
                            onChange={e => setData('password', e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                background: t.bg,
                                border: `1px solid ${t.border}`,
                                borderRadius: '8px',
                                color: t.text,
                                fontSize: '14px',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                            placeholder="••••••••"
                        />
                    </div>

                    <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            type="checkbox"
                            checked={data.remember}
                            onChange={e => setData('remember', e.target.checked)}
                            style={{ accentColor: t.accent }}
                        />
                        <label style={{ color: t.textMuted, fontSize: '13px' }}>Se souvenir de moi</label>
                    </div>

                    <button
                        type="submit"
                        disabled={processing}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: processing ? '#1e40af' : t.accent,
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: processing ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {processing ? 'Connexion...' : 'Se connecter'}
                    </button>
                </form>
            </div>
        </div>
    );
}
