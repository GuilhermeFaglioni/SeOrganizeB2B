# Google OAuth Verification Contract

Status: implementation contract for issue #131. Controlled placeholders are allowed in development and staging only; production and Google submission remain blocked until they are replaced.

## Canonical Environment

| Item | Production decision |
|---|---|
| Canonical domain | `https://seorganize.faglionidev.com` |
| User type | External |
| Calendar scope candidate | `https://www.googleapis.com/auth/calendar.events.owned` |
| Authentication flow | Supabase Google login |
| Calendar authorization flow | Direct Google OAuth web-server flow |
| Production status | Published only after staging validation and branding approval |

The Supabase login and direct Calendar authorization are separate flows. Signing in with Google does not grant Calendar access.

## Scope Matrix

| Product operation | Google API operation | Data used | Scope candidate | Evidence required |
|---|---|---|---|---|
| Show events in the calendar view | `GET /calendars/primary/events` | Event title, description, times, all-day state, timezone, attendees and Google event ID | `calendar.events.owned` | Show the connected calendar and the resulting events in the product |
| Create an event | `POST /calendars/primary/events?sendUpdates=all` | Event fields and attendee email addresses | `calendar.events.owned` | Create an event and show the attendee invitation behavior |
| Edit an event | `PUT /calendars/primary/events/{eventId}?sendUpdates=all` | Updated event fields and attendee email addresses | `calendar.events.owned` | Change an event in the product and show the Calendar result |
| Delete an event | `DELETE /calendars/primary/events/{eventId}?sendUpdates=all` | Google event ID | `calendar.events.owned` | Delete an event from the product and show the Calendar result |
| Identify the authorized account | OpenID token claims | Google subject, verified email and token metadata | `openid email` | Show the account connected to the product without exposing tokens |

The scope candidate must be tested with a dedicated Google account before it is declared in Google Cloud. If the product must manage calendars or events that the user can access but does not own, the scope decision must be revisited before implementation is submitted.

## Google Data Inventory

### Data received from Google

- Stable Google subject identifier.
- Verified Google email used to identify the connected account in the UI.
- Access token and refresh token required for the authorized Calendar session.
- Calendar event identifiers and etags.
- Event titles, descriptions, start and end times, all-day state and timezone.
- Attendee email addresses, display names, response status and organizer state.

### User-facing purposes

- Display the user's primary Calendar events alongside local work.
- Create events from the scheduling experience.
- Update and delete events created or managed through the integration.
- Send Calendar invitations to event attendees when the user requests it.
- Detect scheduling conflicts before the user confirms an event.

Data from Google must not be used for advertising, profiling, unrelated analytics, resale or any purpose absent from the published Privacy Policy.

## Proposed Retention Contract

These rules are implementation defaults and require confirmation by the legal/product owner before public submission:

- OAuth credentials are retained only while the Calendar connection is active.
- Disconnecting or revoking access deletes the encrypted access and refresh tokens immediately.
- A revoked or invalid authorization is marked reconnectable and cannot be used for new Google requests.
- Google-derived event and attendee mirrors are deleted when the Calendar connection is disconnected; explicitly local events remain local.
- Local events created without Google remain local after a Calendar disconnect.
- Attendee records are retained only while their associated local event is retained.
- Account deletion removes credentials, Google-derived mirrors and associated attendee data according to the final deletion policy.

## Official Legal Configuration

The public legal pages identify `55.823.385 GUILHERME COSTA BARBOSA FAGLIONI`, CNPJ `55.823.385/0001-89`, at Rua José Gerardo Bessa, Silveira, Belo Horizonte, Minas Gerais, Brazil, ZIP `31140-390`. Support and privacy requests use `guilhermefaglioni.contato@gmail.com`. The policy version is `17/08/2026`.

The configured disconnect behavior deletes Google credentials and Google-derived event and attendee mirrors while preserving explicitly local events. Personal data is retained only while needed to provide the service or comply with legal obligations, and is deleted or anonymized when those needs end. Fiscal, financial and audit records follow the applicable legal retention periods.

By creating or using access, users agree to the Terms version published on the page. Material changes are communicated through available product channels before taking effect.

## External Configuration Checklist

- [ ] Verify `seorganize.faglionidev.com` in Google Search Console with an owner/editor account associated with the Cloud project.
- [ ] Enable the Google Calendar API in the production project.
- [ ] Configure the production OAuth consent screen as External.
- [ ] Add the canonical homepage, Privacy Policy, Terms of Service and support contact.
- [ ] Add the canonical top-level authorized domain.
- [ ] Configure the Supabase Google provider and its callback separately from the Calendar callback.
- [ ] Configure the Calendar callback as `https://seorganize.faglionidev.com/api/calendar/auth/callback`.
- [ ] Declare exactly the scopes implemented by the application.
- [ ] Keep development and staging clients in non-production projects with explicit test users.
- [ ] Publish branding before requesting data-access verification.

## Submission Evidence

The technical demonstration must show, without hiding the consent flow:

1. The user starts the Calendar connection from the product.
2. The browser address bar includes the OAuth client ID.
3. Google displays the approved app name and logo.
4. The user grants the declared scopes.
5. The product reads Calendar events.
6. The product creates an event and sends an invitation.
7. The product edits an event.
8. The product deletes an event.
9. The product shows the connected account and disconnect behavior.

The video must be separate from the product marketing video and hosted as an unlisted YouTube video for the verification request.
