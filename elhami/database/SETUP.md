# Elhami cloud state — 2026-10-24

- Supabase project: cgtujmcchatniqamrqay (Elhami), organization ELHAME25, Free, eu-central-1.
- Applied migration: elhami_private_workspaces.
- Active tables: profiles + workspaces. Workspaces store one JSON document per account with sessions, summaries and references. The original relational schema.sql is a proposed future model and has NOT been applied.
- Row level security: own auth.uid only, anonymous access revoked. Tested cross-account reads, updates and inserts; anonymous reads blocked. Tests rolled back and left no accounts or records. Security advisors returned no lints.
- Cloud client uses only the publishable key. Authenticated content stays in memory and Supabase, not guest local storage; guest content is never auto-imported. Logout clears the in-memory account workspace. Optional photo stays browser-local.
- Saves are serialized; errors are shown, and closing with unsaved changes triggers a browser warning. Concurrent multi-device editing currently uses last successful save wins. No offline durability for signed-in content yet.
- Email links are enabled. Site URL and exact redirect URL were configured in the Supabase dashboard on 2026-10-24. Built-in email delivery is active; custom SMTP is not configured. Delivery is restricted to authorized organization member addresses; public signup is not ready. No real inbox receipt or link login has been verified.

## Email-link setup and remaining verification

1. DONE: Site URL and allowed redirect URL set to https://elhame25.github.io/elhami/ (exact trailing slash), saved and visibly verified.
2. Default Confirmation and Magic Link templates remain enabled. The current dashboard requires custom SMTP before editing subjects/body.
3. Built-in mail is restricted to authorized team recipients with a small rate limit. Public signup needs a configured mail provider/verified sender. Do not claim public email delivery works before this.
4. emailLinkReady is enabled for a real owner test. Perform signup with an authorized organization mailbox; verify inbox receipt, link opening, cloud save, reload and logout. No OpenAI, live audio transport or group invites have been activated.
5. tests/auth-link.cjs covers callback validation, expired link, token URL cleanup, redirects, signup/login distinction and honest send-error behavior. It mocks delivery and is not an end-to-end email test.

Account workspace contents are accessible to service owner/admin. Do not promise zero operator access or end-to-end encryption.
