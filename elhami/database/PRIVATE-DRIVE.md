# Personal encrypted content storage

Content saves use Google Drive appDataFolder with drive.appdata scope, through Google Identity Services token flow. Client ID is public; no client secret is used. Supabase remains the identity provider.

New content is never POSTed to Supabase workspaces. Account activation starts with an empty locked workspace; the user explicitly links Drive and opens it. The passphrase is at least 12 characters; PBKDF2-SHA256 (600000 iterations, random 16-byte salt) derives a nonextractable AES-256-GCM key. Every envelope has a random 12-byte IV and authenticated version context. Passphrase/key are memory-only. Loss cannot be repaired by the operator.

A pending envelope is stored encrypted on the user's device before upload; navigation warns while changes remain pending. Remote bytes are compared before update; If-Match uses the returned ETag when available. Conflicts stop writes and offer encrypted export before reopening the cloud copy. This is not a cross-device transactional database: a simultaneous initial create can produce duplicate files, which discovery refuses to overwrite.

Legacy workspaces are not fetched automatically. Explicit migration merges records by id, retaining current entries on duplicate ids, uploads and reads back the encrypted envelope, then offers a separately confirmed DELETE of the old active database row. Provider backups may remain; no blanket deletion guarantee is made. No old production data was deleted during this release.

## OAuth console
- Project Elhami; Drive API enabled by owner.
- Web client origin: https://elhame25.github.io
- Popup token flow; no redirect URI or client secret.
- While consent is in Testing, the owner must add permitted accounts under Audience / Test users.
- appDataFolder is hidden in the normal Drive UI; export is offered inside the app.

## Verification
node tests/private-drive.cjs covers actual WebCrypto roundtrip, wrong passwords, tampering, mocked Drive upload/readback, encrypted offline recovery, cross-device conflict, and absence of Supabase content writes.
node tests/auth-link.cjs covers verified session access and email links.
These checks do not verify the owner's Google consent/account configuration or real Drive upload. A real authorized user must complete the live popup and save/reload a record before end-to-end success is claimed.
