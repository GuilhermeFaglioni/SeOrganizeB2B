# Google OAuth Submission Checklist

Status: repository evidence prepared; external verification remains blocked until legal placeholders, domain ownership and Google Cloud branding are completed.

## Scope Justification

### `openid` and `email`

The app uses the verified Google identity to show which account is connected to the Calendar integration and to prevent an authorization response from being associated with the wrong account. These scopes do not grant Calendar content access.

### `https://www.googleapis.com/auth/calendar.events.owned`

The app reads events from the user's primary Calendar and lets the user create, update and delete those events from the scheduling experience. It also sends attendee invitations when the user explicitly adds participants. A read-only scope cannot support create, update or delete. The broader `calendar` scope is not required because the app does not share calendars, change calendar ACLs, create secondary calendars or manage calendars the user does not own.

This justification must be re-evaluated if the product expands beyond events on calendars owned by the user.

## Manual Test Matrix

| Scenario | Expected result | Evidence |
|---|---|---|
| User starts connection | Google consent screen opens from the Calendar page | Screenshot and video |
| User denies consent | No credential is persisted; user returns with a safe error | Test result |
| User approves consent | Connected account appears in the Calendar page | Screenshot and video |
| Calendar read | Events appear in the selected range | Screenshot and video |
| Event creation | Event is created in the owned primary Calendar | Screenshot and video |
| Attendee invitation | Google sends the requested invitation | Screenshot and video |
| Event update | Changed event is reflected in Google Calendar | Screenshot and video |
| Event deletion | Event is removed from Google Calendar | Screenshot and video |
| Access token refresh | Operation succeeds after access-token expiry | Test result |
| Google revocation | Product shows reconnect-required and does not reuse the token | Screenshot and test result |
| Product disconnect | Local credentials are removed and Google token revocation is attempted | Screenshot and logs without secrets |
| Cross-company access | A connection or attendee from another company is rejected | Automated test |

## Technical Video Script

Record a separate unlisted video in English. Keep the browser address bar visible during the consent flow and do not hide the OAuth client ID.

1. Open the production-domain Calendar page while authenticated as the test account.
2. Click Connect Google and show the redirect to Google's consent screen.
3. Show the app name and logo on the consent screen.
4. Show the requested Calendar scope and grant access.
5. Return to the product and show the connected Google account.
6. Navigate the Calendar range and show an event read from Google.
7. Create an event with an external attendee and show the invitation behavior.
8. Edit the event from the product and show the changed Calendar event.
9. Delete the event and show that it is removed from Calendar.
10. Return to the product and show the account/disconnect control.

Do not use real customer data, real secrets, real CPF/CNPJ values or real attendee information in the recording.

## Submission Gate

- [ ] `TODO_LEGAL_ENTITY_NAME` replaced.
- [ ] `TODO_COMPANY_DOCUMENT` replaced.
- [ ] `TODO_COMPANY_ADDRESS` replaced.
- [ ] `TODO_SUPPORT_EMAIL` replaced.
- [ ] `TODO_PRIVACY_EMAIL` replaced.
- [ ] `TODO_POLICY_EFFECTIVE_DATE` replaced.
- [ ] `TODO_RETENTION_POLICY` replaced.
- [ ] `TODO_TERMS_ACCEPTANCE_POLICY` replaced.
- [ ] Production `APP_URL` and `NEXT_PUBLIC_APP_URL` set to `https://seorganize.faglionidev.com`.
- [ ] `GOOGLE_TOKEN_ENCRYPTION_KEY` configured.
- [ ] Legacy Calendar tokens migrated before the new code is deployed.
- [ ] Search Console ownership verified.
- [ ] Google branding verified and published.
- [ ] Production redirect URIs match the canonical domain exactly.
- [ ] Production test matrix completed.
- [ ] Technical video uploaded as unlisted.
- [ ] Verification Center submission reviewed by the product/legal owner.
