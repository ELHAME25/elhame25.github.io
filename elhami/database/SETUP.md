# Elhami cloud state — 2026-10-24

- Supabase project: cgtujmcchatniqamrqay (Elhami), organization ELHAME25, Free, eu-central-1.
- Applied migration: elhami_private_workspaces.
- Active tables: profiles + workspaces. Workspaces store one JSON document per account with sessions, summaries and references. The original relational schema.sql is a proposed future model and has NOT been applied.
- Row level security: own auth.uid only, anonymous access revoked. Tested cross-account reads, updates and inserts; anonymous reads blocked. Tests rolled back and left no accounts or records. Security advisors returned no lints.
- Cloud client uses only the publishable key. Authenticated content stays in memory and Supabase, not guest local storage; guest content is never auto-imported. Logout clears the in-memory account workspace. Optional photo stays browser-local.
- Saves are serialized; errors are shown, and closing with unsaved changes triggers a browser warning. Concurrent multi-device editing currently uses last successful save wins. No offline durability for signed-in content yet.
- Email links are implemented and gated with emailLinkReady=false until Site URL, redirect allowlist and delivery are configured. No real email delivery or link login has been tested.

## Remaining email-link setup

1. Auth > URL Configuration: Site URL and allowed redirect URL must include https://elhame25.github.io/elhami/ (exact trailing slash).
2. Confirmation and Magic Link templates should use {{ .ConfirmationURL }}. The default templates already provide links; optional Arabic copy must preserve this placeholder.
3. Built-in mail is restricted to authorized team recipients with a small rate limit. Public signup needs a configured mail provider/verified sender. Do not claim public email delivery works before this.
4. Once redirects/templates are verified, enable emailLinkReady and perform a real signup with the account owner's authorized mailbox; test link opening, cloud save, reload and logout. No OpenAI, live audio transport or group invites have been activated.
5. tests/auth-link.cjs covers callback validation, expired link, token URL cleanup, redirects, signup/login distinction and honest send-error behavior. It mocks delivery and is not an end-to-end email test.

Account workspace contents are accessible to service owner/admin. Do not promise zero operator access or end-to-end encryption.
