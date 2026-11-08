/**
 * Read-only structural export of a Miro board through the official Web SDK v2.
 *
 * It calls only `board.getInfo()` and `board.get()` (both `boards:read`) and
 * never an item method. The result keeps every SDK record verbatim and adds
 * IDs, geometry, relations, URLs, asset mapping, coverage and losses. Runs as a
 * plain script in the Miro app iframe (`window.MiroExport`) and under Node tests.
 */
(function (root) {
    'use strict';

    const FORMAT = 'miro-clone.structural-export';
    const FORMAT_VERSION = 1;
    const EXPORTER = { name: 'miro-clone/tools/miro-export', version: '1.1.0' };
    const REQUIRED_SCOPES = ['boards:read'];
    const CAPABILITIES_CHECKED_ON = '2026-11-08';

    const load = (file, name) => (typeof module === 'object' && module.exports ? require(file) : root[name]);
    const { CAPABILITIES, EXPLICIT_TYPES, OTHER_FORMATS, COORDINATE_CONVENTION } = load('./capabilities.js', 'MiroExportCapabilities');
    const { urlsOf } = load('./urls.js', 'MiroExportUrls');

    // Read explicitly: SDK objects may expose these through prototype getters.
    const KNOWN_FIELDS = ['id', 'type', 'x', 'y', 'width', 'height', 'rotation', 'origin', 'relativeTo',
        'parentId', 'groupId', 'childrenIds', 'itemsIds', 'connectorIds', 'tagIds', 'linkedTo', 'content',
        'title', 'description', 'url', 'previewUrl', 'alt', 'mode', 'shape', 'style', 'start', 'end',
        'captions', 'fields', 'status', 'showContent', 'color', 'createdAt', 'createdBy', 'modifiedAt', 'modifiedBy'];

    /** Copies data fields of an SDK object; functions are dropped, nothing is invoked. */
    function cloneRecord(item) {
        const data = Object.create(null);
        const keys = new Set([...KNOWN_FIELDS, ...Object.keys(Object(item))]);
        for (const key of keys) {
            const value = item[key];
            if (value !== undefined && typeof value !== 'function') data[key] = value;
        }
        return JSON.parse(JSON.stringify(data));
    }

    function geometryOf(raw) {
        if (typeof raw.x !== 'number' || typeof raw.y !== 'number') return null;
        const pick = key => (typeof raw[key] === 'number' ? raw[key] : null);
        return {
            x: raw.x, y: raw.y, width: pick('width'), height: pick('height'), rotation: pick('rotation'),
            origin: raw.origin ?? null, relativeTo: raw.relativeTo ?? null,
        };
    }

    function relationsOf(raw) {
        const list = value => (Array.isArray(value) ? value.slice() : []);
        return {
            parentId: raw.parentId ?? null,
            groupId: raw.groupId ?? null,
            childrenIds: list(raw.childrenIds),
            itemsIds: list(raw.itemsIds),
            tagIds: list(raw.tagIds),
            connectorStart: raw.start?.item ?? null,
            connectorEnd: raw.end?.item ?? null,
        };
    }

    function capabilityOf(type) {
        return typeof type === 'string' && Object.hasOwn(CAPABILITIES, type) ? CAPABILITIES[type] : null;
    }

    function loss(itemId, type, kind, detail) {
        return { itemId, type, kind, detail };
    }

    function typeLosses(record) {
        const { id, type, status } = record;
        if (status === 'unknown') return [loss(id, type, 'unknown-type', 'Type not recognized; raw record retained for later handling.')];
        if (status === 'opaque') return [loss(id, type, 'opaque-content', 'SDK exposes position only; content must come from another source or be recreated.')];
        if (type === 'image') return [loss(id, type, 'asset-not-retrieved', 'Image bytes are not in this export; asset entry maps the item to its URL and retrieval method.')];
        if (type === 'connector') return [loss(id, type, 'connector-route', 'Only endpoints, shape, captions and style as read; rendered route points are not exported.')];
        if (type === 'preview') return [loss(id, type, 'preview-metadata', 'Only the URL and geometry are exported; Miro-rendered title/thumbnail are not.')];
        return [];
    }

    /** A failed record keeps an exact (nonempty string) ID so children can still name their parent. */
    function failedRecord(item, index, reason) {
        let raw;
        try { raw = cloneRecord(item); } catch { raw = null; }
        const id = typeof raw?.id === 'string' && raw.id !== '' ? raw.id : null;
        return { id, sourceIndex: index, type: raw?.type ?? null, status: 'failed', reason, raw };
    }

    function buildRecord(item, index, seenIds) {
        if (item === null || typeof item !== 'object') return failedRecord(item, index, 'Record is not an object.');
        const raw = cloneRecord(item);
        if (typeof raw.id !== 'string' || raw.id === '') return failedRecord(item, index, 'ID is not a nonempty string; exact ID cannot be guaranteed.');
        if (typeof raw.type !== 'string' || raw.type === '') return failedRecord(item, index, `Record ${raw.id} has no type.`);
        if (seenIds.has(raw.id)) return failedRecord(item, index, `Duplicate ID ${raw.id}.`);
        seenIds.add(raw.id);
        return {
            id: raw.id, sourceIndex: index, type: raw.type,
            status: capabilityOf(raw.type)?.status ?? 'unknown',
            geometry: geometryOf(raw), relations: relationsOf(raw), urls: urlsOf(raw),
            assetIds: raw.type === 'image' ? [`miro-image-${raw.id}`] : [], raw,
        };
    }

    function assetFor(record) {
        return {
            assetId: record.assetIds[0], itemId: record.id, kind: 'image',
            url: record.raw.url ?? null, title: record.raw.title ?? null, alt: record.raw.alt ?? null,
            retrieval: 'Image.getFile("original") under boards:read', retrieved: false,
        };
    }

    function danglingLosses(records) {
        const ids = new Set(records.filter(record => record.id).map(record => record.id));
        const out = [];
        for (const record of records) {
            if (!record.relations) continue;
            const { parentId, groupId, childrenIds, itemsIds, tagIds, connectorStart, connectorEnd } = record.relations;
            const refs = [parentId, groupId, connectorStart, connectorEnd, ...childrenIds, ...itemsIds, ...tagIds];
            for (const ref of refs) if (ref !== null && !ids.has(ref)) out.push(loss(record.id, record.type, 'dangling-reference', `References ${ref}, which is not in the export.`));
        }
        return out;
    }

    function coverageOf(records) {
        const byStatus = { supported: 0, opaque: 0, unknown: 0, failed: 0 };
        const byType = Object.create(null);
        for (const type of EXPLICIT_TYPES) byType[type] = { count: 0, ...CAPABILITIES[type] };
        for (const record of records) {
            byStatus[record.status] += 1;
            const key = record.type ?? '(missing)';
            byType[key] ??= { count: 0, ...(capabilityOf(key) ?? { status: record.status, webSdk: 'unknown', rest: 'unknown', note: 'Not in the capability table.' }) };
            byType[key].count += 1;
        }
        return { total: records.length, byStatus, byType };
    }

    /** Builds the export package from data already read from the SDK. Pure. */
    function buildPackage(boardInfo, items, exportedAt) {
        if (!Array.isArray(items)) throw new TypeError('board.get() must return an array');
        const seenIds = new Set();
        const records = items.map((item, index) => buildRecord(item, index, seenIds));
        const losses = [loss(null, null, 'paint-order-unverified', 'Records keep board.get() order, which the SDK does not document as z-order.')];
        for (const record of records) {
            if (record.status === 'failed') losses.push(loss(record.id, record.type, 'failed-record', `Source index ${record.sourceIndex}: ${record.reason}`));
            else losses.push(...typeLosses(record));
        }
        losses.push(...danglingLosses(records));
        return {
            format: FORMAT, formatVersion: FORMAT_VERSION, exporter: EXPORTER, exportedAt,
            source: { api: 'miro-web-sdk-v2', scopes: REQUIRED_SCOPES, board: cloneRecord(boardInfo ?? {}) },
            coordinateConvention: COORDINATE_CONVENTION, records, losses, coverage: coverageOf(records),
            assets: records.filter(record => record.type === 'image' && record.status === 'supported').map(assetFor),
            context: { capabilitiesCheckedOn: CAPABILITIES_CHECKED_ON, capabilities: CAPABILITIES, otherFormats: OTHER_FORMATS },
        };
    }

    /** Reads the board with boards:read only and returns the export package. */
    async function exportBoard(board, now = () => new Date().toISOString()) {
        const boardInfo = await board.getInfo();
        return buildPackage(boardInfo, await board.get(), now());
    }

    function fileNameFor(exportPackage) {
        const boardId = String(exportPackage.source.board.id ?? 'board').replace(/[^\w-]+/g, '_');
        return `miro-export-${boardId}-${exportPackage.exportedAt.replace(/[:.]/g, '-')}.json`;
    }

    const api = { FORMAT, FORMAT_VERSION, REQUIRED_SCOPES, CAPABILITIES, OTHER_FORMATS, buildPackage, exportBoard, fileNameFor };
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.MiroExport = api;
})(typeof globalThis === 'object' ? globalThis : this);
