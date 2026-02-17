import { Link, router, usePage } from '@inertiajs/react';
import { useState, useEffect, useCallback } from 'react';

const navigation = [
    { name: 'Tableau de bord', href: '/', icon: '\u{1f4ca}' },
    { name: 'Machines', href: '/machines', icon: '\u{1f4bb}' },
    { name: 'Alertes', href: '/alerts', icon: '\u{1f514}' },
    { name: 'Échanges', href: '/exchanges', icon: '\u{1f4ac}' },
    { name: 'Règles', href: '/rules', icon: '\u{2699}\u{fe0f}' },
    { name: 'Domaines', href: '/domains', icon: '\u{1f310}' },
    { name: 'Rapports', href: '/reports', icon: '\u{1f4c8}' },
    { name: 'Audit', href: '/audit', icon: '\u{1f4dc}' },
    { name: 'Utilisateurs', href: '/users', icon: '\u{1f465}', adminOnly: true },
    { name: 'Paramètres', href: '/settings', icon: '\u{2699}\u{fe0f}', adminOnly: true },
];

const severityColors = {
    critical: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
};

const roleLabels = { admin: 'Admin', manager: 'Manager', viewer: 'Lecteur' };
const roleColors = { admin: '#ef4444', manager: '#f59e0b', viewer: '#3b82f6' };

export default function DashboardLayout({ children, title }) {
    const { url, props } = usePage();
    const { auth } = props;
    const isAdmin = auth?.is_admin ?? false;
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);

    // Dismiss a notification
    const dismissNotification = useCallback((id) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    // Auto-dismiss after 15 seconds
    useEffect(() => {
        if (notifications.length === 0) return;

        const timer = setTimeout(() => {
            setNotifications((prev) => prev.slice(1));
        }, 15000);

        return () => clearTimeout(timer);
    }, [notifications]);

    // Listen for WebSocket events (Echo/Reverb)
    useEffect(() => {
        // If Laravel Echo is available, subscribe to dashboard channel
        if (typeof window !== 'undefined' && window.Echo) {
            const channel = window.Echo.channel('icon.dashboard');

            channel.listen('.alert.created', (data) => {
                setNotifications((prev) => [
                    ...prev,
                    {
                        id: Date.now(),
                        type: 'alert',
                        severity: data.severity,
                        title: data.title,
                        subtitle: data.machine || '',
                        time: new Date().toLocaleTimeString('fr-FR'),
                    },
                ].slice(-10)); // Keep last 10

                // Auto-refresh current page data
                router.reload({ only: ['alerts', 'stats', 'recentAlerts', 'criticalAlerts'] });
            });

            channel.listen('.events.ingested', (data) => {
                setNotifications((prev) => [
                    ...prev,
                    {
                        id: Date.now(),
                        type: 'events',
                        severity: data.alerts_created > 0 ? 'warning' : 'info',
                        title: `${data.count} evenement(s) de ${data.hostname}`,
                        subtitle: data.platform ? `Plateforme : ${data.platform}` : '',
                        time: new Date().toLocaleTimeString('fr-FR'),
                    },
                ].slice(-10));

                // Auto-refresh stats on current page
                router.reload({ only: ['stats', 'exchanges', 'events', 'machines', 'dailyEvents', 'total'] });
            });

            channel.listen('.machine.status_changed', (data) => {
                setNotifications((prev) => [
                    ...prev,
                    {
                        id: Date.now(),
                        type: 'machine',
                        severity: data.new_status === 'offline' ? 'warning' : 'info',
                        title: `${data.hostname} : ${data.new_status}`,
                        subtitle: `Ancien statut : ${data.previous_status}`,
                        time: new Date().toLocaleTimeString('fr-FR'),
                    },
                ].slice(-10));

                // Auto-refresh machines data
                router.reload({ only: ['machines', 'stats', 'machine'] });
            });

            channel.listen('.rule.changed', (data) => {
                setNotifications((prev) => [
                    ...prev,
                    {
                        id: Date.now(),
                        type: 'rule',
                        severity: 'info',
                        title: `Regle ${data.action} : ${data.rule?.name || ''}`,
                        subtitle: '',
                        time: new Date().toLocaleTimeString('fr-FR'),
                    },
                ].slice(-10));

                // Auto-refresh rules data
                router.reload({ only: ['rules'] });
            });

            return () => {
                channel.stopListening('.alert.created');
                channel.stopListening('.events.ingested');
                channel.stopListening('.machine.status_changed');
                channel.stopListening('.rule.changed');
            };
        }
    }, []);

    const unreadCount = notifications.length;

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a' }}>
            {/* Sidebar */}
            <aside style={{
                width: 260,
                background: '#1e293b',
                borderRight: '1px solid #334155',
                padding: '1.5rem 0',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
            }}>
                <div style={{
                    padding: '0 1.5rem 1.5rem',
                    borderBottom: '1px solid #334155',
                    marginBottom: '1rem',
                }}>
                    <h1 style={{
                        color: '#f8fafc',
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        margin: 0,
                    }}>
                        {'\u{1f6e1}\u{fe0f}'} Icon
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
                        Monitoring IA — GS2E
                    </p>
                </div>

                <nav style={{ flex: 1 }}>
                    {navigation.filter((item) => !item.adminOnly || isAdmin).map((item) => {
                        const isActive = url === item.href ||
                            (item.href !== '/' && url.startsWith(item.href));

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.75rem 1.5rem',
                                    color: isActive ? '#f8fafc' : '#94a3b8',
                                    textDecoration: 'none',
                                    fontSize: '0.875rem',
                                    fontWeight: isActive ? 600 : 400,
                                    background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                    borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <span>{item.icon}</span>
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User info + logout */}
                {auth?.user && (
                    <div style={{
                        padding: '1rem 1.5rem',
                        borderTop: '1px solid #334155',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 500 }}>
                                {auth.user.name}
                            </span>
                            <span style={{
                                padding: '0.1rem 0.4rem',
                                borderRadius: 4,
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                background: `${roleColors[auth.user.role] || '#64748b'}20`,
                                color: roleColors[auth.user.role] || '#64748b',
                            }}>
                                {roleLabels[auth.user.role] || auth.user.role}
                            </span>
                        </div>
                        <button
                            onClick={() => router.post('/logout')}
                            style={{
                                background: 'transparent',
                                border: '1px solid #334155',
                                borderRadius: 6,
                                padding: '0.35rem 0.75rem',
                                color: '#94a3b8',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                width: '100%',
                            }}
                        >
                            Se déconnecter
                        </button>
                    </div>
                )}
            </aside>

            {/* Main content */}
            <main style={{ flex: 1, padding: '2rem', overflow: 'auto', position: 'relative' }}>
                {/* Top bar with notification bell */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.5rem',
                }}>
                    {title ? (
                        <h2 style={{
                            color: '#f8fafc',
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            margin: 0,
                        }}>
                            {title}
                        </h2>
                    ) : <div />}

                    {/* Notification bell */}
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        style={{
                            background: 'transparent',
                            border: '1px solid #334155',
                            borderRadius: 8,
                            padding: '0.5rem 0.75rem',
                            cursor: 'pointer',
                            position: 'relative',
                            color: '#94a3b8',
                            fontSize: '1.1rem',
                        }}
                    >
                        {'\u{1f514}'}
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: -6,
                                right: -6,
                                background: '#ef4444',
                                color: '#fff',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                borderRadius: '50%',
                                width: 18,
                                height: 18,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                {unreadCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Notification dropdown */}
                {showNotifications && (
                    <div style={{
                        position: 'absolute',
                        top: 60,
                        right: 32,
                        width: 360,
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 12,
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                        zIndex: 100,
                        maxHeight: 400,
                        overflowY: 'auto',
                    }}>
                        <div style={{
                            padding: '0.75rem 1rem',
                            borderBottom: '1px solid #334155',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}>
                            <span style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 600 }}>
                                Notifications temps réel
                            </span>
                            {notifications.length > 0 && (
                                <button
                                    onClick={() => setNotifications([])}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#64748b',
                                        fontSize: '0.7rem',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Tout effacer
                                </button>
                            )}
                        </div>

                        {notifications.length === 0 ? (
                            <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                                <p style={{ color: '#64748b', fontSize: '0.8rem' }}>
                                    Aucune notification récente
                                </p>
                            </div>
                        ) : (
                            notifications.slice().reverse().map((notif) => (
                                <div
                                    key={notif.id}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        borderBottom: '1px solid #0f172a',
                                        display: 'flex',
                                        gap: '0.75rem',
                                        alignItems: 'flex-start',
                                    }}
                                >
                                    <div style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: severityColors[notif.severity] || '#64748b',
                                        marginTop: 5,
                                        flexShrink: 0,
                                    }} />
                                    <div style={{ flex: 1 }}>
                                        <p style={{ color: '#e2e8f0', fontSize: '0.8rem', margin: 0, fontWeight: 500 }}>
                                            {notif.title}
                                        </p>
                                        {notif.subtitle && (
                                            <p style={{ color: '#64748b', fontSize: '0.7rem', margin: '0.15rem 0 0' }}>
                                                {notif.subtitle}
                                            </p>
                                        )}
                                    </div>
                                    <span style={{ color: '#475569', fontSize: '0.65rem', flexShrink: 0 }}>
                                        {notif.time}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {children}
            </main>
        </div>
    );
}
