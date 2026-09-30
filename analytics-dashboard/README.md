# QuaptureIQ analytics dashboard

Publish this directory as the GitHub Pages path:

`https://fredrock007.github.io/quaptureiq-site/analytics-dashboard/`

The page contains no metrics, owner JWT, or secret key. Fred supplies the
Supabase project URL and public publishable key, signs in with the existing
QuaptureIQ Google OAuth flow, and, after the first setup in that browser, can continue with one Google
sign-in. The QuaptureIQ API base URL is configured automatically. The page
uses Supabase browser session persistence and token refresh, calls the
owner-protected `GET /analytics/report` endpoint with the current Supabase
session access token, and renders only aggregates. Metrics load on session
restore and refresh every 60 seconds while the page is visible. Sign-out uses
the local Supabase session scope and clears the dashboard.

The dashboard displays an approximate active app-session count from temporary,
anonymous foreground markers held in API memory. A signed-in app sends a marker
while it is open in the foreground and renews it periodically; markers expire
after two minutes. The count is not a count of unique users or devices, and it
does not record Home as a usage mode. If the app is on Home but the count stays
at zero, its marker or heartbeat may not be reaching the API. Product events
such as selected modes appear separately after the related action occurs.

The dashboard refreshes aggregate metrics automatically every 60 seconds while
visible. Manual refresh, sign-in, sign-out, and errors show on-screen feedback.
The temporary session count remains ephemeral and is not linked to an account
or stable device identifier.

The live dashboard is served from the GitHub Pages URL above. The API must be
configured with the owner allowlist and analytics collection must be enabled
for approved testing. Add this exact URL to the Supabase Auth redirect allowlist
for Google sign-in:

`https://fredrock007.github.io/quaptureiq-site/analytics-dashboard/`

Do not place the owner subject, owner JWT, service-role key, or analytics data
in this directory.
