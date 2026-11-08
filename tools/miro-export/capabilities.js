/**
 * What the Miro Web SDK and REST API can read per item type, plus the
 * coordinate convention and the non-structural export formats.
 * Part of the read-only Miro exporter; loaded before export.js in the app page
 * (`window.MiroExportCapabilities`) and through require() under Node tests.
 */
(function (root) {
    'use strict';

    // What an export can read per SDK type. rest: 'none' means no REST read route.
    const CAPABILITIES = {
        sticky_note: { status: 'supported', webSdk: 'read', rest: 'read', note: 'HTML content and style kept raw.' },
        text: { status: 'supported', webSdk: 'read', rest: 'read', note: 'HTML content kept raw.' },
        shape: { status: 'supported', webSdk: 'read', rest: 'read', note: 'Shape kind, content and style kept raw.' },
        card: { status: 'supported', webSdk: 'read', rest: 'read', note: 'Title, description, fields kept raw.' },
        app_card: { status: 'supported', webSdk: 'read', rest: 'read', note: 'Owned by another app; fields kept raw.' },
        image: { status: 'supported', webSdk: 'read', rest: 'read', note: 'URL and title mapped as an asset; bytes not included.' },
        embed: { status: 'supported', webSdk: 'read', rest: 'read', note: 'Embedded URL and preview URL kept.' },
        preview: { status: 'supported', webSdk: 'read', rest: 'none', note: 'Link preview: Web SDK only; REST has no preview read.' },
        frame: { status: 'supported', webSdk: 'read', rest: 'read', note: 'Children linked by parentId/childrenIds, not nested.' },
        connector: { status: 'supported', webSdk: 'read', rest: 'read', note: 'Endpoints by item reference; no x/y; route points not exported.' },
        group: { status: 'supported', webSdk: 'read', rest: 'read', note: 'Membership via itemsIds and item groupId.' },
        tag: { status: 'supported', webSdk: 'read', rest: 'read', note: 'Board tag; items reference it via tagIds.' },
        mindmap_node: { status: 'supported', webSdk: 'experimental', rest: 'none', note: 'Experimental SDK support only.' },
        unsupported: { status: 'opaque', webSdk: 'position only', rest: 'none', note: 'Tables, code blocks, documents, kanban etc.: content not readable.' },
    };
    // Always listed in coverage, even at zero, so their handling is explicit.
    const EXPLICIT_TYPES = ['image', 'preview', 'connector', 'frame', 'unsupported'];

    const OTHER_FORMATS = [
        { format: 'PDF/SVG export', structural: false, detail: 'Appearance only; no editable items, IDs or relations.' },
        { format: 'CSV export', structural: false, detail: 'Text cells only; geometry, frames, connectors and images lost.' },
        { format: 'Board backup (.rtb)', structural: false, detail: 'Opaque Miro restore format; not portable editable JSON.' },
    ];

    const COORDINATE_CONVENTION = {
        unit: 'dp (board units as reported by the SDK)',
        origin: 'x/y are the item center (origin "center"); rotation pivots on the center',
        canvas_center: 'x/y measured from the board center point (0, 0)',
        parent_top_left: 'x/y measured from the parent frame top-left corner',
        parent_center: 'x/y measured from the parent center (experimental in the SDK)',
        conversion: 'none: values are exported as read; normalization converts them to world coordinates',
    };

    const api = { CAPABILITIES, EXPLICIT_TYPES, OTHER_FORMATS, COORDINATE_CONVENTION };
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.MiroExportCapabilities = api;
})(typeof globalThis === 'object' ? globalThis : this);
