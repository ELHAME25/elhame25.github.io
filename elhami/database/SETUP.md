# Elhami cloud state — 2026-10-24

- Supabase project: cgtujmcchatniqamrqay (Elhami), organization ELHAME25, Free, eu-central-1.
- Applied migration: elhami_private_workspaces.
- Active tables: profiles + workspaces. Workspaces store one JSON document per account with sessions, summaries and references. The original relational schema.sql is a proposed future model and has NOT been applied.
- Row level security: own auth.uid only, anonymous access revoked. Tested cross-account reads, updates and inserts; anonymous reads blocked. Tests rolled back and left no accounts or records. Security advisors returned no lints.
- Cloud client uses only the publishable key. Authenticated content stays in memory and Supabase, not guest local storage; guest content is never auto-imported. Logout clears the in-memory account workspace. Optional photo stays browser-local.
- Saves are serialized; errors are shown, and closing with unsaved changes triggers a browser warning. Concurrent multi-device editing currently uses last successful save wins. No offline durability for signed-in content yet.
- Email OTP is intentionally gated with emailOtpReady=false until email delivery and templates are verified. No real email or OTP login has been tested.

## Remaining email setup

1. Auth email templates: both confirmation and magic link must include {{ .Token }}. Use an Arabic message with the code and no misleading default magic-link-only copy.
2. Verify email OTP length 6 (current client accepts 6 digits), expiration, site URL https://elhame25.github.io/elhami/.
3. Built-in mail is restricted to authorized team recipients with a small rate limit. Public signup needs a configured mail provider/verified sender. Do not claim public OTP works before this.
4. Once templates/delivery are configured, enable emailOtpReady and test actual signup, OTP verification, save, reload, logout and another account. No OpenAI, live audio transport or group invites have been activated.

Account workspace contents are accessible to service owner/admin. Do not promise zero operator access or end-to-end encryption.
