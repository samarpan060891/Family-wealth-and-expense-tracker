// Upload / storage limits, kept in one place so the attachment, document and
// extract routes agree. Files are stored as base64 text in Postgres; base64
// inflates the original by ~1.37x, so these are lengths of the encoded string.

// Generous ceiling for stored files (~40MB original). Important family
// documents (scanned policies, deeds) can be large — we keep only a safety cap
// so a single upload can't exhaust memory / the database.
export const MAX_UPLOAD_BASE64 = 55_000_000; // ~40MB original file
export const MAX_UPLOAD_LABEL = "40MB";

// Claude's document/vision request cap is ~32MB. Text-based PDFs are read
// locally (any size) and only their text is sent, so this only limits the
// vision fallback for scanned/image documents.
export const MAX_VISION_BASE64 = 30_000_000; // ~22MB original file
