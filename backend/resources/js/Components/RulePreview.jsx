import { useState } from 'react';

const cardStyle = {
    background: '#0f172a',
    borderRadius: 10,
    border: '1px solid #334155',
    padding: '1.25rem',
};

const inputStyle = {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '0.6rem 1rem',
    color: '#f8fafc',
    fontSize: '0.875rem',
    width: '100%',
    fontFamily: 'inherit',
    resize: 'vertical',
};

/**
 * Client-side rule preview/tester.
 * Lets the admin type sample text and see if the rule matches.
 */
export default function RulePreview({ conditionType, conditionValue }) {
    const [testText, setTestText] = useState('');
    const [result, setResult] = useState(null);

    const runTest = () => {
        if (!testText.trim()) {
            setResult(null);
            return;
        }

        try {
            switch (conditionType) {
                case 'keyword':
                    setResult(testKeyword(testText, conditionValue));
                    break;
                case 'regex':
                    setResult(testRegex(testText, conditionValue));
                    break;
                case 'domain_list':
                    setResult(testDomainList(testText, conditionValue));
                    break;
                case 'content_length':
                    setResult(testContentLength(testText, conditionValue));
                    break;
                default:
                    setResult({ match: false, message: 'Type de condition non supporté pour la prévisualisation.' });
            }
        } catch (err) {
            setResult({ match: false, error: true, message: `Erreur : ${err.message}` });
        }
    };

    const hasCondition = () => {
        switch (conditionType) {
            case 'keyword':
                return (conditionValue?.keywords || []).length > 0;
            case 'regex':
                return !!(conditionValue?.pattern);
            case 'domain_list':
                return (conditionValue?.domains || []).length > 0;
            case 'content_length':
                return !!(conditionValue?.max_length || conditionValue?.max || conditionValue?.min_length || conditionValue?.min);
            default:
                return false;
        }
    };

    if (!hasCondition()) {
        return null;
    }

    return (
        <div style={cardStyle}>
            <h4 style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.75rem' }}>
                Tester la règle
            </h4>

            <textarea
                value={testText}
                onChange={(e) => {
                    setTestText(e.target.value);
                    setResult(null);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                        e.preventDefault();
                        runTest();
                    }
                }}
                placeholder={getPlaceholder(conditionType)}
                rows={3}
                style={inputStyle}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button
                    type="button"
                    onClick={runTest}
                    disabled={!testText.trim()}
                    style={{
                        background: '#475569',
                        color: '#f8fafc',
                        border: 'none',
                        borderRadius: 6,
                        padding: '0.5rem 1rem',
                        cursor: testText.trim() ? 'pointer' : 'default',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        opacity: testText.trim() ? 1 : 0.4,
                    }}
                >
                    Tester (Ctrl+Enter)
                </button>

                {conditionType === 'content_length' && testText && (
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                        {testText.length} caractères
                    </span>
                )}
            </div>

            {result && (
                <div style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    borderRadius: 8,
                    background: result.error
                        ? 'rgba(239,68,68,0.1)'
                        : result.match
                            ? 'rgba(239,68,68,0.1)'
                            : 'rgba(34,197,94,0.1)',
                    border: `1px solid ${result.error ? '#991b1b' : result.match ? '#991b1b' : '#166534'}`,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: result.details ? '0.5rem' : 0 }}>
                        <span style={{
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            color: result.error ? '#fca5a5' : result.match ? '#fca5a5' : '#86efac',
                        }}>
                            {result.error ? 'Erreur' : result.match ? 'MATCH' : 'Pas de match'}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                            {result.message}
                        </span>
                    </div>

                    {result.details && result.details.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {result.details.map((d, i) => (
                                <span key={i} style={{
                                    background: 'rgba(239,68,68,0.2)',
                                    color: '#fca5a5',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: 4,
                                    fontSize: '0.75rem',
                                    fontFamily: 'monospace',
                                }}>
                                    {d}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function getPlaceholder(conditionType) {
    switch (conditionType) {
        case 'keyword':
            return 'Saisissez un exemple de texte pour tester les mots-clés...';
        case 'regex':
            return 'Saisissez un exemple de texte pour tester le regex...';
        case 'domain_list':
            return 'Saisissez un ou plusieurs domaines pour tester...';
        case 'content_length':
            return 'Saisissez du texte pour vérifier la longueur...';
        default:
            return 'Saisissez un texte de test...';
    }
}

function testKeyword(text, conditionValue) {
    const keywords = conditionValue?.keywords || [];
    if (keywords.length === 0) {
        return { match: false, message: 'Aucun mot-clé configuré.' };
    }

    const lowerText = text.toLowerCase();
    const matched = keywords.filter((kw) => lowerText.includes(kw.toLowerCase()));
    const matchAll = conditionValue?.match_all || false;

    const isMatch = matchAll
        ? matched.length === keywords.length
        : matched.length > 0;

    const mode = matchAll ? 'TOUS requis' : 'AU MOINS UN';

    return {
        match: isMatch,
        message: `${matched.length}/${keywords.length} mot(s)-clé(s) trouvé(s) (${mode})`,
        details: matched,
    };
}

function testRegex(text, conditionValue) {
    const pattern = conditionValue?.pattern;
    if (!pattern) {
        return { match: false, message: 'Aucun pattern configuré.' };
    }

    const flags = conditionValue?.case_insensitive ? 'gi' : 'g';
    const regex = new RegExp(pattern, flags);
    const matches = [...text.matchAll(regex)];

    return {
        match: matches.length > 0,
        message: matches.length > 0
            ? `${matches.length} correspondance(s) trouvée(s)`
            : 'Aucune correspondance',
        details: matches.map((m) => m[0]).slice(0, 10),
    };
}

function testDomainList(text, conditionValue) {
    const domains = conditionValue?.domains || [];
    if (domains.length === 0) {
        return { match: false, message: 'Aucun domaine configuré.' };
    }

    const lowerText = text.toLowerCase();
    const matched = domains.filter((d) => lowerText.includes(d.toLowerCase()));

    return {
        match: matched.length > 0,
        message: matched.length > 0
            ? `${matched.length} domaine(s) détecté(s)`
            : 'Aucun domaine détecté',
        details: matched,
    };
}

function testContentLength(text, conditionValue) {
    const len = text.length;
    const max = conditionValue?.max_length || conditionValue?.max || null;
    const min = conditionValue?.min_length || conditionValue?.min || null;

    let isMatch = false;
    let message = `${len} caractères`;

    if (max !== null && len > max) {
        isMatch = true;
        message += ` (dépasse le max de ${max})`;
    } else if (min !== null && len < min) {
        isMatch = true;
        message += ` (en dessous du min de ${min})`;
    } else {
        if (max !== null) message += ` (max: ${max})`;
        if (min !== null) message += ` (min: ${min})`;
    }

    return {
        match: isMatch,
        message,
    };
}
