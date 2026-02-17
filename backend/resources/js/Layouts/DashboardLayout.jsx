import { Link, router, usePage } from '@inertiajs/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../Contexts/ThemeContext';

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

const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
    );

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isMobile;
}

function ThemeToggle({ isDark, onToggle, t }) {
    return (
        <button
            onClick={onToggle}
            title={isDark ? 'Passer au thème clair' : 'Passer au thème sombre'}
            aria-label={isDark ? 'Thème clair' : 'Thème sombre'}
            style={{
                background: 'transparent',
                border: `1px solid ${t.border}`,
                borderRadius: 8,
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                color: t.textMuted,
                fontSize: '1.1rem',
                flexShrink: 0,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {isDark ? '\u2600\ufe0f' : '\u{1f319}'}
        </button>
    );
}

export default function DashboardLayout({ children, title }) {
    const { url, props } = usePage();
    const { auth, unreadNotificationCount } = props;
    const isAdmin = auth?.is_admin ?? false;
    const isMobile = useIsMobile();
    const { theme: t, toggle: toggleTheme, isDark } = useTheme();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifTab, setNotifTab] = useState('live');
    const [dbNotifications, setDbNotifications] = useState([]);
    const [dbLoading, setDbLoading] = useState(false);
    const [dbLoaded, setDbLoaded] = useState(false);

    // Close sidebar on navigation (mobile)
    useEffect(() => {
        if (isMobile) setSidebarOpen(false);
    }, [url, isMobile]);

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
                ].slice(-10));
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

    // Fetch persisted notifications when inbox tab is opened
    const fetchDbNotifications = useCallback(() => {
        setDbLoading(true);
        fetch('/notifications', {
            headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        })
            .then((r) => r.json())
            .then((data) => {
                setDbNotifications(data);
                setDbLoaded(true);
            })
            .catch(() => {})
            .finally(() => setDbLoading(false));
    }, []);

    const markAsRead = useCallback((id) => {
        fetch(`/notifications/${id}/read`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
            },
        }).then(() => {
            setDbNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
            router.reload({ only: ['unreadNotificationCount'] });
        });
    }, []);

    const markAllRead = useCallback(() => {
        fetch('/notifications/read-all', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
            },
        }).then(() => {
            setDbNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            router.reload({ only: ['unreadNotificationCount'] });
        });
    }, []);

    // Load notifications when dropdown opens on inbox tab
    useEffect(() => {
        if (showNotifications && notifTab === 'inbox' && !dbLoaded) {
            fetchDbNotifications();
        }
    }, [showNotifications, notifTab, dbLoaded, fetchDbNotifications]);

    // Refresh DB notifications when a new alert arrives via WebSocket
    useEffect(() => {
        if (dbLoaded && notifications.length > 0) {
            fetchDbNotifications();
        }
    }, [notifications.length]); // eslint-disable-line react-hooks/exhaustive-deps

    const unreadCount = notifications.length + (unreadNotificationCount || 0);
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeSuggestion, setActiveSuggestion] = useState(-1);
    const searchRef = useRef(null);
    const debounceRef = useRef(null);

    const fetchSuggestions = useCallback((q) => {
        if (q.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetch(`/search/suggestions?q=${encodeURIComponent(q)}`, {
                headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            })
                .then((r) => r.json())
                .then((data) => {
                    setSuggestions(data);
                    setShowSuggestions(data.length > 0);
                    setActiveSuggestion(-1);
                })
                .catch(() => {});
        }, 250);
    }, []);

    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearchQuery(val);
        fetchSuggestions(val);
    };

    const handleSearch = (e) => {
        if (e.key === 'Enter') {
            if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
                router.visit(suggestions[activeSuggestion].href);
                setShowSuggestions(false);
                setSearchQuery('');
            } else if (searchQuery.trim().length >= 2) {
                router.get('/search', { q: searchQuery.trim() });
                setShowSuggestions(false);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveSuggestion((prev) => Math.min(prev + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveSuggestion((prev) => Math.max(prev - 1, -1));
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    // Close suggestions on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const typeIcons = { machine: '\u{1f4bb}', alert: '\u{1f514}', rule: '\u{2699}\u{fe0f}' };
    const typeLabels = { machine: 'Machine', alert: 'Alerte', rule: 'Règle' };

    // ── Sidebar content (shared between desktop and mobile) ──
    const sidebarContent = (
        <>
            <div style={{
                padding: '0 1.5rem 1.5rem',
                borderBottom: `1px solid ${t.border}`,
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <div>
                    <h1 style={{ color: t.text, fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                        {'\u{1f6e1}\u{fe0f}'} Icon
                    </h1>
                    <p style={{ color: t.textMuted, fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
                        Monitoring IA — GS2E
                    </p>
                </div>
                {isMobile && (
                    <button
                        onClick={() => setSidebarOpen(false)}
                        style={{
                            background: 'transparent', border: 'none', color: t.textMuted,
                            fontSize: '1.5rem', cursor: 'pointer', padding: '0.25rem',
                        }}
                    >
                        {'\u2715'}
                    </button>
                )}
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
                                color: isActive ? t.text : t.textMuted,
                                textDecoration: 'none',
                                fontSize: '0.875rem',
                                fontWeight: isActive ? 600 : 400,
                                background: isActive ? `${t.accent}15` : 'transparent',
                                borderLeft: isActive ? `3px solid ${t.accent}` : '3px solid transparent',
                                transition: 'all 0.15s',
                            }}
                        >
                            <span>{item.icon}</span>
                            <span>{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            {auth?.user && (
                <div style={{ padding: '1rem 1.5rem', borderTop: `1px solid ${t.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ color: t.textSecondary, fontSize: '0.8rem', fontWeight: 500 }}>
                            {auth.user.name}
                        </span>
                        <span style={{
                            padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.65rem', fontWeight: 600,
                            background: `${roleColors[auth.user.role] || '#64748b'}20`,
                            color: roleColors[auth.user.role] || '#64748b',
                        }}>
                            {roleLabels[auth.user.role] || auth.user.role}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link
                            href="/profile"
                            style={{
                                flex: 1, background: 'transparent', border: `1px solid ${t.border}`,
                                borderRadius: 6, padding: '0.35rem 0.75rem', color: t.textMuted,
                                fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'none', textAlign: 'center',
                            }}
                        >
                            Mon profil
                        </Link>
                        <button
                            onClick={() => router.post('/logout')}
                            style={{
                                flex: 1, background: 'transparent', border: `1px solid ${t.border}`,
                                borderRadius: 6, padding: '0.35rem 0.75rem', color: t.textMuted,
                                fontSize: '0.75rem', cursor: 'pointer',
                            }}
                        >
                            Déconnecter
                        </button>
                    </div>
                </div>
            )}
        </>
    );

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: t.bg }}>
            {/* Mobile backdrop */}
            {isMobile && sidebarOpen && (
                <div
                    onClick={() => setSidebarOpen(false)}
                    style={{
                        position: 'fixed', inset: 0, background: t.backdropBg,
                        zIndex: 998, transition: 'opacity 0.2s',
                    }}
                />
            )}

            {/* Sidebar */}
            <aside style={{
                width: 260,
                background: t.sidebarBg,
                borderRight: `1px solid ${t.border}`,
                padding: '1.5rem 0',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                ...(isMobile ? {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    zIndex: 999,
                    transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
                    transition: 'transform 0.25s ease',
                    boxShadow: sidebarOpen ? `4px 0 24px ${t.shadow}` : 'none',
                } : {}),
            }}>
                {sidebarContent}
            </aside>

            {/* Main content */}
            <main style={{
                flex: 1,
                padding: isMobile ? '1rem' : '2rem',
                overflow: 'auto',
                position: 'relative',
                minWidth: 0,
            }}>
                {/* Top bar */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.5rem',
                    gap: '0.75rem',
                    flexWrap: isMobile ? 'wrap' : 'nowrap',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                        {/* Hamburger (mobile) */}
                        {isMobile && (
                            <button
                                onClick={() => setSidebarOpen(true)}
                                style={{
                                    background: 'transparent', border: `1px solid ${t.border}`,
                                    borderRadius: 8, padding: '0.4rem 0.6rem', cursor: 'pointer',
                                    color: t.textSecondary, fontSize: '1.2rem', flexShrink: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                                aria-label="Ouvrir le menu"
                            >
                                {'\u2630'}
                            </button>
                        )}
                        {title ? (
                            <h2 style={{
                                color: t.text,
                                fontSize: isMobile ? '1.15rem' : '1.5rem',
                                fontWeight: 700,
                                margin: 0,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}>
                                {title}
                            </h2>
                        ) : <div />}
                    </div>

                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        ...(isMobile ? { width: '100%', order: 3 } : {}),
                    }}>
                        {/* Search bar with autocomplete */}
                        <div ref={searchRef} style={{ position: 'relative', flex: isMobile ? 1 : 'none' }}>
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                value={searchQuery}
                                onChange={handleSearchChange}
                                onKeyDown={handleSearch}
                                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                                style={{
                                    background: t.surface,
                                    border: `1px solid ${t.border}`,
                                    borderRadius: 8,
                                    padding: '0.5rem 0.75rem',
                                    color: t.text,
                                    fontSize: '0.85rem',
                                    width: isMobile ? '100%' : 260,
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                            />
                            {showSuggestions && suggestions.length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    marginTop: 4,
                                    background: t.surface,
                                    border: `1px solid ${t.border}`,
                                    borderRadius: 10,
                                    boxShadow: `0 12px 30px ${t.shadow}`,
                                    zIndex: 200,
                                    overflow: 'hidden',
                                }}>
                                    {suggestions.map((s, idx) => (
                                        <div
                                            key={`${s.type}-${s.label}-${idx}`}
                                            onClick={() => {
                                                router.visit(s.href);
                                                setShowSuggestions(false);
                                                setSearchQuery('');
                                            }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.6rem',
                                                padding: '0.55rem 0.75rem', cursor: 'pointer',
                                                background: idx === activeSuggestion ? `${t.accent}15` : 'transparent',
                                                borderBottom: idx < suggestions.length - 1 ? `1px solid ${t.bg}` : 'none',
                                            }}
                                        >
                                            <span style={{ fontSize: '0.8rem', flexShrink: 0 }}>{typeIcons[s.type] || ''}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{
                                                    color: t.textSecondary, fontSize: '0.8rem', fontWeight: 500,
                                                    margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                }}>
                                                    {s.label}
                                                </p>
                                                {s.sub && (
                                                    <p style={{ color: t.textFaint, fontSize: '0.65rem', margin: '0.1rem 0 0' }}>
                                                        {s.sub}
                                                    </p>
                                                )}
                                            </div>
                                            <span style={{
                                                fontSize: '0.6rem', color: t.textSubtle, fontWeight: 600,
                                                textTransform: 'uppercase', flexShrink: 0,
                                            }}>
                                                {typeLabels[s.type] || ''}
                                            </span>
                                        </div>
                                    ))}
                                    <div
                                        onClick={() => {
                                            if (searchQuery.trim().length >= 2) {
                                                router.get('/search', { q: searchQuery.trim() });
                                                setShowSuggestions(false);
                                            }
                                        }}
                                        style={{
                                            padding: '0.5rem 0.75rem', borderTop: `1px solid ${t.border}`,
                                            textAlign: 'center', cursor: 'pointer',
                                            color: t.accent, fontSize: '0.75rem', fontWeight: 600,
                                        }}
                                    >
                                        Voir tous les résultats
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Theme toggle */}
                        <ThemeToggle isDark={isDark} onToggle={toggleTheme} t={t} />

                        {/* Notification bell */}
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            style={{
                                background: 'transparent', border: `1px solid ${t.border}`,
                                borderRadius: 8, padding: '0.5rem 0.75rem', cursor: 'pointer',
                                position: 'relative', color: t.textMuted, fontSize: '1.1rem', flexShrink: 0,
                            }}
                        >
                            {'\u{1f514}'}
                            {unreadCount > 0 && (
                                <span style={{
                                    position: 'absolute', top: -6, right: -6,
                                    background: '#ef4444', color: '#fff',
                                    fontSize: '0.65rem', fontWeight: 700, borderRadius: '50%',
                                    width: 18, height: 18, display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Notification dropdown */}
                {showNotifications && (
                    <div style={{
                        position: 'absolute',
                        top: isMobile ? 110 : 60,
                        right: isMobile ? 16 : 32,
                        width: isMobile ? 'calc(100% - 32px)' : 380,
                        background: t.surface,
                        border: `1px solid ${t.border}`,
                        borderRadius: 12,
                        boxShadow: `0 20px 40px ${t.shadow}`,
                        zIndex: 100,
                        maxHeight: 450,
                        display: 'flex',
                        flexDirection: 'column',
                    }}>
                        {/* Tabs */}
                        <div style={{
                            display: 'flex', borderBottom: `1px solid ${t.border}`,
                        }}>
                            {[
                                { key: 'live', label: 'En direct', count: notifications.length },
                                { key: 'inbox', label: 'Notifications', count: unreadNotificationCount || 0 },
                            ].map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setNotifTab(tab.key)}
                                    style={{
                                        flex: 1, padding: '0.65rem 0.75rem',
                                        background: 'transparent', border: 'none',
                                        borderBottom: notifTab === tab.key ? `2px solid ${t.accent}` : '2px solid transparent',
                                        color: notifTab === tab.key ? t.text : t.textFaint,
                                        fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                                    }}
                                >
                                    {tab.label}
                                    {tab.count > 0 && (
                                        <span style={{
                                            background: tab.key === 'inbox' ? t.accent : t.textFaint,
                                            color: '#fff', fontSize: '0.6rem', fontWeight: 700,
                                            borderRadius: 8, padding: '0.1rem 0.4rem', minWidth: 16, textAlign: 'center',
                                        }}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Tab content */}
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {notifTab === 'live' ? (
                                <>
                                    {notifications.length > 0 && (
                                        <div style={{
                                            padding: '0.4rem 1rem', display: 'flex', justifyContent: 'flex-end',
                                        }}>
                                            <button
                                                onClick={() => setNotifications([])}
                                                style={{
                                                    background: 'transparent', border: 'none',
                                                    color: t.textFaint, fontSize: '0.7rem', cursor: 'pointer',
                                                }}
                                            >
                                                Tout effacer
                                            </button>
                                        </div>
                                    )}
                                    {notifications.length === 0 ? (
                                        <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                                            <p style={{ color: t.textFaint, fontSize: '0.8rem' }}>
                                                Aucune notification en direct
                                            </p>
                                        </div>
                                    ) : (
                                        notifications.slice().reverse().map((notif) => (
                                            <div
                                                key={notif.id}
                                                style={{
                                                    padding: '0.65rem 1rem', borderBottom: `1px solid ${t.bg}`,
                                                    display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                                                }}
                                            >
                                                <div style={{
                                                    width: 8, height: 8, borderRadius: '50%',
                                                    background: severityColors[notif.severity] || t.textFaint,
                                                    marginTop: 5, flexShrink: 0,
                                                }} />
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ color: t.textSecondary, fontSize: '0.8rem', margin: 0, fontWeight: 500 }}>
                                                        {notif.title}
                                                    </p>
                                                    {notif.subtitle && (
                                                        <p style={{ color: t.textFaint, fontSize: '0.7rem', margin: '0.15rem 0 0' }}>
                                                            {notif.subtitle}
                                                        </p>
                                                    )}
                                                </div>
                                                <span style={{ color: t.textSubtle, fontSize: '0.65rem', flexShrink: 0 }}>
                                                    {notif.time}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </>
                            ) : (
                                <>
                                    {dbNotifications.some((n) => !n.read) && (
                                        <div style={{
                                            padding: '0.4rem 1rem', display: 'flex', justifyContent: 'flex-end',
                                        }}>
                                            <button
                                                onClick={markAllRead}
                                                style={{
                                                    background: 'transparent', border: 'none',
                                                    color: t.accent, fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600,
                                                }}
                                            >
                                                Tout marquer comme lu
                                            </button>
                                        </div>
                                    )}
                                    {dbLoading && !dbLoaded ? (
                                        <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                                            <p style={{ color: t.textFaint, fontSize: '0.8rem' }}>Chargement...</p>
                                        </div>
                                    ) : dbNotifications.length === 0 ? (
                                        <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                                            <p style={{ color: t.textFaint, fontSize: '0.8rem' }}>
                                                Aucune notification
                                            </p>
                                        </div>
                                    ) : (
                                        dbNotifications.map((notif) => (
                                            <div
                                                key={notif.id}
                                                onClick={() => !notif.read && markAsRead(notif.id)}
                                                style={{
                                                    padding: '0.65rem 1rem', borderBottom: `1px solid ${t.bg}`,
                                                    display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                                                    cursor: notif.read ? 'default' : 'pointer',
                                                    background: notif.read ? 'transparent' : `${t.accent}08`,
                                                }}
                                            >
                                                <div style={{
                                                    width: 8, height: 8, borderRadius: '50%',
                                                    background: notif.read
                                                        ? t.border
                                                        : severityColors[notif.data?.severity] || t.accent,
                                                    marginTop: 5, flexShrink: 0,
                                                }} />
                                                <div style={{ flex: 1 }}>
                                                    <p style={{
                                                        color: notif.read ? t.textMuted : t.textSecondary,
                                                        fontSize: '0.8rem', margin: 0,
                                                        fontWeight: notif.read ? 400 : 500,
                                                    }}>
                                                        {notif.data?.title || 'Notification'}
                                                    </p>
                                                    {notif.data?.machine && (
                                                        <p style={{ color: t.textFaint, fontSize: '0.7rem', margin: '0.15rem 0 0' }}>
                                                            Machine : {notif.data.machine}
                                                        </p>
                                                    )}
                                                </div>
                                                <span style={{ color: t.textSubtle, fontSize: '0.65rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                                    {notif.time_ago}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {children}
            </main>
        </div>
    );
}
