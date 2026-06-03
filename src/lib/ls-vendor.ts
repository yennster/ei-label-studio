/**
 * Single source of truth for the vendored Label Studio bundle.
 *
 * The bundle in /public/vendor/label-studio is large (~1.9 MB JS) and immutable,
 * so it's served with a 1-year `immutable` cache header (see next.config.ts).
 * The `?v=` token below is the cache-buster: it MUST be bumped whenever the
 * bundle files are re-vendored, otherwise browsers will keep serving the old
 * bytes for up to a year.
 */
export const LS_VENDOR_VERSION = "1.4.1";

export const LS_VENDOR_JS = `/vendor/label-studio/main.js?v=${LS_VENDOR_VERSION}`;
export const LS_VENDOR_CSS = `/vendor/label-studio/main.css?v=${LS_VENDOR_VERSION}`;
