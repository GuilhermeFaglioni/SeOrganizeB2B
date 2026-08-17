# Google OAuth Production Runbook

This runbook is for `seorganize.faglionidev.com`. It contains configuration steps only; credentials must remain in the relevant secret manager or provider dashboard.

## Application Configuration

Set these values independently for development, staging and production:

- `APP_URL`: canonical server URL.
- `NEXT_PUBLIC_APP_URL`: canonical browser URL.
- `GOOGLE_CLIENT_ID`: the Calendar OAuth web client for the environment.
- `GOOGLE_CLIENT_SECRET`: the matching secret.
- `GOOGLE_TOKEN_ENCRYPTION_KEY`: base64-encoded 32-byte key.
- `NEXT_PUBLIC_SUPABASE_URL`: the environment Supabase project.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the environment Supabase public key.

Production must not set `ALLOW_LEGAL_PLACEHOLDERS=true`. Run `npm run security:check-legal-placeholders` before publishing.

## Redirect URIs

The direct Calendar OAuth client must allow exactly:

```text
https://seorganize.faglionidev.com/api/calendar/auth/callback
```

The Supabase Google provider must use the callback URL shown by the Supabase project, while Supabase's redirect allowlist must include:

```text
https://seorganize.faglionidev.com/auth/callback
```

Do not use preview or arbitrary request-host URLs in the production client.

## Google Cloud

1. Create or select the production Google Cloud project.
2. Enable Google Calendar API.
3. Configure the OAuth consent screen as External.
4. Set the official app name, logo, support email and developer contact.
5. Add the homepage, Privacy Policy and Terms URLs under the app domain.
6. Verify `seorganize.faglionidev.com` in Google Search Console with a project owner/editor account.
7. Add the top-level authorized domain to the OAuth branding configuration.
8. Configure the production Web application client with the exact Calendar redirect URI.
9. Declare only `openid`, `email` and the approved Calendar scope.
10. Keep development and staging clients in separate projects with explicit test users.
11. Verify and publish branding before submitting data access for sensitive scopes.

## Supabase

1. Configure the Google provider with the environment-specific Google client credentials.
2. Add the Supabase callback URL to the matching Google Web client.
3. Add the canonical `/auth/callback` URL to the Supabase redirect allowlist.
4. Confirm the provider project and Calendar project are intentionally related and documented.

## Release Order

1. Run `npm run security:check-legal-placeholders` without the placeholder override.
2. Apply Prisma migrations; legacy unscoped credentials are discarded and require reconnection.
3. Run `npm run security:encrypt-google-tokens` as a preflight for any remaining token records.
4. Deploy with the canonical URL and encryption key configured.
5. Validate login, Calendar consent, refresh, revocation and reconnect with a test account.
6. Publish branding and submit the verification request.

## Verification Evidence

Record a separate unlisted technical video. Show the user starting Calendar connection, the browser address bar with the OAuth client ID, the consent screen with app name/logo, the requested scope and the resulting Calendar read/create/update/delete/invitation behavior.

## Production Gate

The application is not ready for public Google verification while the legal pages have not been reviewed, the domain is unverified, the branding is unpublished, the token encryption key is absent or the legacy token migration has not completed.
