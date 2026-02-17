import { Link, usePage } from '@inertiajs/react';
import { useState, useEffect, useCallback } from 'react';

const navigation = [
    { name: 'Tableau de bord', href: '/', icon: '\u{1f4ca}' },
    { name: 'Machines', href: '/machines', icon: '\u{1f4bb}' },
    { name: 'Alertes', href: '/alerts', icon: '\u{1f514}' },
    { name: 'Échanges', href: '/exchanges', icon: '\u{1f4ac}' },
    { name: 'Règles', href: '/rules', icon: '\u{2699}\u{fe0f}' },
    { name: 'Rapports', href: '/reports', icon: '\u{1f4c8}' },
    { name: 'Audit', href: '/audit', icon: '\u{1f4dc}' },
];

const severityColors = {
    critical: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
};

export default function DashboardLayout({ children, title }) {
    const { url } = usePage();
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
            });

            channel.listen('.rule.changed', (data) => {
                setNotifications((prev) => [
                    ...prev,
                    {
                        id: Date.now(),
                        type: 'rule',
                        severity: 'info',
                        title: `Règle ${data.action} : ${data.rule?.name || ''}`,
                        subtitle: '',
                        time: new Date().toLocaleTimeString('fr-FR'),
                    },
                ].slice(-10));
            });

            return () => {
                channel.stopListening('.alert.created');
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
                    {navigation.map((item) => {
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
