import { useForm } from '@inertiajs/react';
import { useState } from 'react';

export default function TwoFactorChallenge({ user_id }) {
    const [useRecovery, setUseRecovery] = useState(false);
    const { data, setData, post, processing, errors } = useForm({
        code: '',
        user_id: user_id || '',
    });

    const submit = (e) => {
        e.preventDefault();
        post('/two-factor-challenge');
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <div style={{
                background: '#1e293b',
                borderRadius: 12,
                padding: 40,
                width: '100%',
                maxWidth: 400,
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <h1 style={{ fontSize: 28, fontWeight: 'bold', color: '#f8fafc', margin: 0 }}>
                        Icon
                    </h1>
                    <p style={{ color: '#94a3b8', marginTop: 8, fontSize: 14 }}>
                        Vérification à deux facteurs
                    </p>
                </div>

                <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
                    {useRecovery
                        ? 'Entrez un de vos codes de récupération.'
                        : 'Entrez le code à 6 chiffres de votre application d\'authentification.'
                    }
                </p>

                <form onSubmit={submit}>
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', color: '#cbd5e1', fontSize: 14, marginBottom: 6 }}>
                            {useRecovery ? 'Code de récupération' : 'Code TOTP'}
                        </label>
                        <input
                            type="text"
                            value={data.code}
                            onChange={(e) => setData('code', e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                background: '#0f172a',
                                border: errors.code ? '1px solid #ef4444' : '1px solid #334155',
                                borderRadius: 8,
                                color: '#f8fafc',
                                fontSize: useRecovery ? 14 : 24,
                                letterSpacing: useRecovery ? 'normal' : '0.3em',
                                textAlign: 'center',
                                outline: 'none',
                                boxSizing: 'border-box',
                                fontFamily: 'monospace',
                            }}
                            placeholder={useRecovery ? 'XXXX-XXXX' : '000000'}
                            maxLength={useRecovery ? 9 : 6}
                            autoFocus
                            autoComplete="one-time-code"
                        />
                        {errors.code && (
                            <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.code}</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={processing}
                        style={{
                            width: '100%',
                            padding: 12,
                            background: processing ? '#1e40af' : '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: 8,
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: processing ? 'not-allowed' : 'pointer',
                            marginBottom: 12,
                        }}
                    >
                        {processing ? 'Vérification...' : 'Vérifier'}
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setUseRecovery(!useRecovery);
                            setData('code', '');
                        }}
                        style={{
                            width: '100%',
                            padding: 10,
                            background: 'transparent',
                            color: '#64748b',
                            border: '1px solid #334155',
                            borderRadius: 8,
                            fontSize: 13,
                            cursor: 'pointer',
                        }}
                    >
                        {useRecovery ? 'Utiliser le code TOTP' : 'Utiliser un code de récupération'}
                    </button>
                </form>
            </div>
        </div>
    );
}
