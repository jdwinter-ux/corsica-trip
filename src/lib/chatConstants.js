// Shared chat constants used by BOTH the client (ChatTab) and the server
// (api/chat.js). Keeping this single source prevents the photo-only placeholder
// from drifting between the two, which would break realtime de-dup.
// Pure module — no imports — so it's safe to import server-side too.

// Message body shown (and stored) when a photo is sent with no caption.
export const PHOTO_ONLY_PLACEHOLDER = '📷 Shared a photo';
