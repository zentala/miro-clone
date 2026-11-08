/**
 * Link extraction for exported records: exact URL fields plus links inside
 * HTML/plain text, with entities decoded and sentence punctuation trimmed.
 * Part of the read-only Miro exporter; loaded before export.js in the app page
 * (`window.MiroExportUrls`) and through require() under Node tests.
 */
(function (root) {
    'use strict';

    const URL_FIELDS = ['url', 'previewUrl', 'linkedTo'];
    const TEXT_FIELDS = ['content', 'title', 'description'];
    const HTTP_URL = /^https?:\/\//i;
    const HREF = /href\s*=\s*(["'])(.*?)\1/gi;
    const TAG = /<[^>]*>/g;
    const BARE_URL = /https?:\/\/[^\s"'<>]+/gi;
    const ENTITY = /&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi;
    const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
    const TRAILING = '.,;:!?"\'';
    const CLOSERS = { ')': '(', ']': '[', '}': '{' };

    /** Decodes HTML character references; unknown names stay as written. */
    function decodeEntities(text) {
        return text.replace(ENTITY, (whole, name) => {
            if (name[0] !== '#') return NAMED_ENTITIES[name.toLowerCase()] ?? whole;
            const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
            return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
        });
    }

    const count = (text, char) => text.split(char).length - 1;

    /** Drops sentence punctuation, quotes and unbalanced closing brackets after a bare URL. */
    function trimTrailing(url) {
        let end = url.length;
        const unbalanced = last => CLOSERS[last] && count(url.slice(0, end), last) > count(url.slice(0, end), CLOSERS[last]);
        while (end > 0 && (TRAILING.includes(url[end - 1]) || unbalanced(url[end - 1]))) end -= 1;
        return url.slice(0, end);
    }

    /** Link targets inside HTML/plain text: decoded hrefs plus trimmed bare URLs. */
    function textUrls(text) {
        const seen = new Set();
        for (const match of text.matchAll(HREF)) seen.add(decodeEntities(match[2]).trim());
        const visible = decodeEntities(text.replace(TAG, ' '));
        for (const match of visible.matchAll(BARE_URL)) seen.add(trimTrailing(match[0]));
        return [...seen].filter(url => HTTP_URL.test(url));
    }

    /** URLs from URL fields (exact) and links inside text/HTML fields. Raw records are not changed. */
    function urlsOf(raw) {
        const found = [];
        for (const field of URL_FIELDS) {
            if (typeof raw[field] === 'string' && HTTP_URL.test(raw[field])) found.push({ field, url: raw[field] });
        }
        for (const field of TEXT_FIELDS) {
            if (typeof raw[field] === 'string') for (const url of textUrls(raw[field])) found.push({ field, url });
        }
        return found;
    }

    const api = { urlsOf };
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.MiroExportUrls = api;
})(typeof globalThis === 'object' ? globalThis : this);
