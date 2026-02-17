import { useState, useMemo } from 'react';

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
 * Client-side rule preview/tester with real-time matching and highlighted text.
 */
export default function RulePreview({ conditionType, conditionValue }) {
    const [testText, setTestText] = useState('');

    // Compute result in real-time as user types
    const result = useMemo(() => {
        if (!testText.trim()) return null;

        try {
            switch (conditionType) {
                case 'keyword':
                    return testKeyword(testText, conditionValue);
                case 'regex':
                    return testRegex(testText, conditionValue);
                case 'domain_list':
                    return testDomainList(testText, conditionValue);
                case 'content_length':
                    return testContentLength(testText, conditionValue);
                default:
                    return { match: false, message: 'Type de condition non supporté pour la prévisualisation.' };
            }
        } catch (err) {
            return { match: false, error: true, message: `Erreur : ${err.message}` };
        }
    }, [testText, conditionType, conditionValue]);

    // Regex validity check (real-time)
    const regexError = useMemo(() => {
        if (conditionType !== 'regex' || !conditionValue?.pattern) return null;
        try {
            new RegExp(conditionValue.pattern, conditionValue.case_insensitive ? 'gi' : 'g');
            return null;
        } catch (err) {
            return err.message;
        }
    }, [conditionType, conditionValue]);

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                    Tester la règle
                </h4>
                {conditionType === 'regex' && (
                    <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.5rem',
                        borderRadius: 4,
                        background: regexError ? '#7f1d1d' : '#14532d',
                        color: regexError ? '#fca5a5' : '#86efac',
                    }}>
                        {regexError ? 'Regex invalide' : 'Regex valide'}
                    </span>
                )}
            </div>

            {/* Regex error detail */}
            {regexError && (
                <div style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: 6,
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid #991b1b',
                    marginBottom: '0.75rem',
                }}>
                    <p style={{ color: '#fca5a5', fontSize: '0.75rem', margin: 0, fontFamily: 'monospace' }}>
                        {regexError}
                    </p>
                </div>
            )}

            <textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder={getPlaceholder(conditionType)}
                rows={3}
                style={inputStyle}
            />

            {conditionType === 'content_length' && testText && (
                <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '0.5rem 0 0' }}>
                    {testText.length} caractères
                </p>
            )}

            {/* Result */}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: result.highlightedHtml || (result.details && result.details.length > 0) ? '0.5rem' : 0 }}>
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

                    {/* Matched items tags */}
                    {result.details && result.details.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: result.highlightedHtml ? '0.75rem' : 0 }}>
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

                    {/* Highlighted text preview */}
                    {result.highlightedHtml && (
                        <div style={{
                            background: '#1e293b',
                            borderRadius: 6,
                            padding: '0.75rem',
                            border: '1px solid #334155',
                            maxHeight: 150,
                            overflowY: 'auto',
                        }}>
                            <p style={{ color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 0.4rem', fontWeight: 600 }}>
                                Aperçu
                            </p>
                            <div
                                style={{
                                    color: '#e2e8f0',
                                    fontSize: '0.8rem',
                                    lineHeight: 1.6,
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                }}
                                dangerouslySetInnerHTML={{ __html: result.highlightedHtml }}
                            />
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
            return 'Saisissez un exemple de texte pour tester les mots-clés...\nEx: Voici le cahier des charges du projet confidentiel';
        case 'regex':
            return 'Saisissez un exemple de texte pour tester le regex...\nEx: Mon mot de passe est secret123';
        case 'domain_list':
            return 'Saisissez un ou plusieurs domaines pour tester...\nEx: api.openai.com';
        case 'content_length':
            return 'Saisissez du texte pour vérifier la longueur...';
        default:
            return 'Saisissez un texte de test...';
    }
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function highlightMatches(text, matches) {
    if (!matches || matches.length === 0) return escapeHtml(text);

    // Sort matches by position (first occurrence in text), longest first for ties
    const positions = [];
    for (const match of matches) {
        const lowerText = text.toLowerCase();
        const lowerMatch = match.toLowerCase();
        let idx = 0;
        while ((idx = lowerText.indexOf(lowerMatch, idx)) !== -1) {
            positions.push({ start: idx, end: idx + match.length });
            idx += match.length;
        }
    }

    if (positions.length === 0) return escapeHtml(text);

    // Sort and merge overlapping ranges
    positions.sort((a, b) => a.start - b.start || b.end - a.end);
    const merged = [positions[0]];
    for (let i = 1; i < positions.length; i++) {
        const last = merged[merged.length - 1];
        if (positions[i].start <= last.end) {
            last.end = Math.max(last.end, positions[i].end);
        } else {
            merged.push(positions[i]);
        }
    }

    let result = '';
    let cursor = 0;
    for (const { start, end } of merged) {
        result += escapeHtml(text.slice(cursor, start));
        result += `<mark style="background:#ef444440;color:#fca5a5;padding:0.1rem 0.15rem;border-radius:3px">${escapeHtml(text.slice(start, end))}</mark>`;
        cursor = end;
    }
    result += escapeHtml(text.slice(cursor));

    return result;
}

function highlightRegex(text, pattern, caseInsensitive) {
    try {
        const flags = caseInsensitive ? 'gi' : 'g';
        const regex = new RegExp(pattern, flags);
        const escaped = escapeHtml(text);

        // We need to work with the original text positions, then apply to escaped
        const matches = [...text.matchAll(regex)];
        if (matches.length === 0) return escapeHtml(text);

        const positions = matches.map(m => ({
            start: m.index,
            end: m.index + m[0].length,
        }));

        let result = '';
        let cursor = 0;
        for (const { start, end } of positions) {
            result += escapeHtml(text.slice(cursor, start));
            result += `<mark style="background:#ef444440;color:#fca5a5;padding:0.1rem 0.15rem;border-radius:3px">${escapeHtml(text.slice(start, end))}</mark>`;
            cursor = end;
        }
        result += escapeHtml(text.slice(cursor));

        return result;
    } catch {
        return escapeHtml(text);
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
        highlightedHtml: matched.length > 0 ? highlightMatches(text, matched) : null,
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
        highlightedHtml: matches.length > 0 ? highlightRegex(text, pattern, conditionValue?.case_insensitive) : null,
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
        highlightedHtml: matched.length > 0 ? highlightMatches(text, matched) : null,
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
