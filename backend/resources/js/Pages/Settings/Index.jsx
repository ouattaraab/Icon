import { useForm, Link } from '@inertiajs/react';
import DashboardLayout from '../../Layouts/DashboardLayout';
import { useTheme } from '../../Contexts/ThemeContext';

function Field({ label, help, error, children }) {
    const { theme: t } = useTheme();

    const labelStyle = {
        color: t.textSecondary,
        fontSize: '0.85rem',
        fontWeight: 500,
        display: 'block',
        marginBottom: '0.35rem',
    };

    const helpStyle = {
        color: t.textFaint,
        fontSize: '0.7rem',
        margin: '0.25rem 0 0',
    };

    const errorStyle = {
        color: t.danger,
        fontSize: '0.7rem',
        margin: '0.25rem 0 0',
    };

    return (
        <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>{label}</label>
            {children}
            {help && <p style={helpStyle}>{help}</p>}
            {error && <p style={errorStyle}>{error}</p>}
        </div>
    );
}

function Toggle({ label, help, checked, onChange, error }) {
    const { theme: t } = useTheme();

    const labelStyle = {
        color: t.textSecondary,
        fontSize: '0.85rem',
        fontWeight: 500,
        display: 'block',
        marginBottom: '0.35rem',
    };

    const helpStyle = {
        color: t.textFaint,
        fontSize: '0.7rem',
        margin: '0.25rem 0 0',
    };

    const errorStyle = {
        color: t.danger,
        fontSize: '0.7rem',
        margin: '0.25rem 0 0',
    };

    return (
        <div style={{ marginBottom: '1.25rem' }}>
            <div
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
                onClick={() => onChange(!checked)}
            >
                <div style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    background: checked ? t.accent : t.border,
                    position: 'relative',
                    transition: 'background 0.2s',
                    flexShrink: 0,
                }}>
                    <div style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: t.text,
                        position: 'absolute',
                        top: 3,
                        left: checked ? 21 : 3,
                        transition: 'left 0.2s',
                    }} />
                </div>
                <span style={labelStyle}>{label}</span>
            </div>
            {help && <p style={{ ...helpStyle, marginLeft: 52 }}>{help}</p>}
            {error && <p style={{ ...errorStyle, marginLeft: 52 }}>{error}</p>}
        </div>
    );
}

export default function SettingsIndex({ settings }) {
    const { theme: t } = useTheme();

    const cardStyle = {
        background: t.surface,
        borderRadius: 12,
        padding: '1.5rem',
        border: `1px solid ${t.border}`,
        marginBottom: '1.5rem',
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

    const { data, setData, put, processing, errors, recentlySuccessful } = useForm({
        event_retention_days: settings.event_retention_days || '90',
        alert_retention_days: settings.alert_retention_days || '180',
        offline_threshold_seconds: settings.offline_threshold_seconds || '300',
        max_batch_size: settings.max_batch_size || '100',
        dlp_enabled: settings.dlp_enabled === '1',
        dlp_auto_alert: settings.dlp_auto_alert === '1',
        dlp_max_scan_length: settings.dlp_max_scan_length || '50000',
        agent_registration_key: settings.agent_registration_key || '',
        agent_current_version: settings.agent_current_version || '0.1.0',
        agent_update_url: settings.agent_update_url || '',
        verify_signatures: settings.verify_signatures === '1',
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        put('/settings');
    };

    return (
        <DashboardLayout title="Paramètres">
            <form onSubmit={handleSubmit}>
                {recentlySuccessful && (
                    <div style={{
                        background: 'rgba(34,197,94,0.1)',
                        border: '1px solid rgba(34,197,94,0.3)',
                        borderRadius: 8,
                        padding: '0.75rem 1rem',
                        marginBottom: '1.5rem',
                        color: t.success,
                        fontSize: '0.85rem',
                        fontWeight: 500,
                    }}>
                        Paramètres enregistrés avec succès.
                    </div>
                )}

                {/* Rétention des données */}
                <div style={cardStyle}>
                    <h3 style={{ color: t.text, fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1.25rem' }}>
                        Rétention des données
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <Field
                            label="Rétention des événements (jours)"
                            help="Durée de conservation des événements dans la base (7 - 3650)"
                            error={errors.event_retention_days}
                        >
                            <input
                                type="number"
                                style={inputStyle}
                                value={data.event_retention_days}
                                onChange={(e) => setData('event_retention_days', e.target.value)}
                                min={7}
                                max={3650}
                            />
                        </Field>
                        <Field
                            label="Rétention des alertes (jours)"
                            help="Durée de conservation des alertes résolues (7 - 3650)"
                            error={errors.alert_retention_days}
                        >
                            <input
                                type="number"
                                style={inputStyle}
                                value={data.alert_retention_days}
                                onChange={(e) => setData('alert_retention_days', e.target.value)}
                                min={7}
                                max={3650}
                            />
                        </Field>
                    </div>
                </div>

                {/* Agent */}
                <div style={cardStyle}>
                    <h3 style={{ color: t.text, fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1.25rem' }}>
                        Configuration des agents
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <Field
                            label="Seuil hors-ligne (secondes)"
                            help="Délai sans heartbeat avant de marquer un agent comme hors-ligne (60 - 3600)"
                            error={errors.offline_threshold_seconds}
                        >
                            <input
                                type="number"
                                style={inputStyle}
                                value={data.offline_threshold_seconds}
                                onChange={(e) => setData('offline_threshold_seconds', e.target.value)}
                                min={60}
                                max={3600}
                            />
                        </Field>
                        <Field
                            label="Taille max. batch"
                            help="Nombre maximum d'événements par requête d'ingestion (10 - 1000)"
                            error={errors.max_batch_size}
                        >
                            <input
                                type="number"
                                style={inputStyle}
                                value={data.max_batch_size}
                                onChange={(e) => setData('max_batch_size', e.target.value)}
                                min={10}
                                max={1000}
                            />
                        </Field>
                    </div>
                    <Field
                        label="Clé d'enregistrement des agents"
                        help="Clé pré-partagée requise pour l'enregistrement initial des agents"
                        error={errors.agent_registration_key}
                    >
                        <input
                            type="text"
                            style={inputStyle}
                            value={data.agent_registration_key}
                            onChange={(e) => setData('agent_registration_key', e.target.value)}
                            placeholder="Laisser vide pour désactiver la vérification"
                        />
                    </Field>
                </div>

                {/* Mise à jour agent */}
                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ color: t.text, fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                            Mise à jour des agents
                        </h3>
                        <Link
                            href="/settings/agent-versions"
                            style={{
                                color: t.accent,
                                textDecoration: 'none',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                            }}
                        >
                            Voir les versions →
                        </Link>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <Field
                            label="Version courante de l'agent"
                            help="Version attendue sur les postes (ex: 1.2.0)"
                            error={errors.agent_current_version}
                        >
                            <input
                                type="text"
                                style={inputStyle}
                                value={data.agent_current_version}
                                onChange={(e) => setData('agent_current_version', e.target.value)}
                            />
                        </Field>
                        <Field
                            label="URL de téléchargement"
                            help="URL vers le binaire agent pour la mise à jour automatique"
                            error={errors.agent_update_url}
                        >
                            <input
                                type="text"
                                style={inputStyle}
                                value={data.agent_update_url}
                                onChange={(e) => setData('agent_update_url', e.target.value)}
                                placeholder="https://..."
                            />
                        </Field>
                    </div>
                    <Toggle
                        label="Vérifier les signatures des binaires"
                        help="Exige une signature valide avant d'appliquer une mise à jour"
                        checked={data.verify_signatures}
                        onChange={(val) => setData('verify_signatures', val)}
                        error={errors.verify_signatures}
                    />
                </div>

                {/* DLP */}
                <div style={cardStyle}>
                    <h3 style={{ color: t.text, fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1.25rem' }}>
                        DLP (Prévention de fuite de données)
                    </h3>
                    <Toggle
                        label="Activer le scan DLP"
                        help="Analyser automatiquement le contenu des échanges interceptés"
                        checked={data.dlp_enabled}
                        onChange={(val) => setData('dlp_enabled', val)}
                        error={errors.dlp_enabled}
                    />
                    <Toggle
                        label="Alertes DLP automatiques"
                        help="Créer automatiquement une alerte lorsque du contenu sensible est détecté"
                        checked={data.dlp_auto_alert}
                        onChange={(val) => setData('dlp_auto_alert', val)}
                        error={errors.dlp_auto_alert}
                    />
                    <Field
                        label="Longueur max. de scan (caractères)"
                        help="Nombre maximum de caractères analysés par échange (1 000 - 500 000)"
                        error={errors.dlp_max_scan_length}
                    >
                        <input
                            type="number"
                            style={inputStyle}
                            value={data.dlp_max_scan_length}
                            onChange={(e) => setData('dlp_max_scan_length', e.target.value)}
                            min={1000}
                            max={500000}
                        />
                    </Field>
                </div>

                {/* Submit */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        type="submit"
                        disabled={processing}
                        style={{
                            background: processing ? '#1e40af' : t.accent,
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '0.7rem 2rem',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            cursor: processing ? 'not-allowed' : 'pointer',
                            opacity: processing ? 0.7 : 1,
                            transition: 'all 0.15s',
                        }}
                    >
                        {processing ? 'Enregistrement...' : 'Enregistrer les paramètres'}
                    </button>
                </div>
            </form>
        </DashboardLayout>
    );
}
