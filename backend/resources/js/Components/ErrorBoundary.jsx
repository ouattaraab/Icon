import { Component } from 'react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary] Erreur capturée :', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={styles.container}>
                    <div style={styles.card}>
                        <div style={styles.iconWrapper}>
                            <svg
                                style={styles.icon}
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                                />
                            </svg>
                        </div>
                        <h1 style={styles.title}>Une erreur est survenue</h1>
                        <p style={styles.message}>
                            L'application a rencontré un problème inattendu.
                            Veuillez recharger la page pour continuer.
                        </p>
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <pre style={styles.errorDetail}>
                                {this.state.error.toString()}
                            </pre>
                        )}
                        <button
                            onClick={this.handleReload}
                            style={styles.button}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#4338ca';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#4f46e5';
                            }}
                        >
                            Recharger la page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    },
    card: {
        maxWidth: '28rem',
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: '0.75rem',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        padding: '2.5rem 2rem',
        textAlign: 'center',
    },
    iconWrapper: {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '1.5rem',
    },
    icon: {
        width: '3.5rem',
        height: '3.5rem',
        color: '#ef4444',
    },
    title: {
        fontSize: '1.5rem',
        fontWeight: '700',
        color: '#1e293b',
        margin: '0 0 0.75rem 0',
    },
    message: {
        fontSize: '0.95rem',
        lineHeight: '1.6',
        color: '#64748b',
        margin: '0 0 1.5rem 0',
    },
    errorDetail: {
        fontSize: '0.75rem',
        lineHeight: '1.5',
        color: '#dc2626',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '0.5rem',
        padding: '0.75rem',
        marginBottom: '1.5rem',
        textAlign: 'left',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: '10rem',
        overflow: 'auto',
    },
    button: {
        display: 'inline-block',
        backgroundColor: '#4f46e5',
        color: '#ffffff',
        fontWeight: '600',
        fontSize: '0.95rem',
        padding: '0.625rem 1.75rem',
        borderRadius: '0.5rem',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
    },
};

export default ErrorBoundary;
