# QuaptureIQ analytics dashboard

Publish this directory as the GitHub Pages path:

`https://fredrock007.github.io/quaptureiq-site/analytics-dashboard/`

The page contains no metrics, owner JWT, or secret key. Fred supplies the
Supabase project URL and public publishable key, signs in with the existing
QuaptureIQ Google OAuth flow, and enters the HTTPS Oracle API base URL. The
page uses Supabase browser session persistence and token refresh, calls the
owner-protected `GET /analytics/report` endpoint with the current Supabase
session access token, and renders only aggregates. Sign-out uses the local
Supabase session scope and clears the dashboard.

Before publication, configure the Pages source to the repository branch/path
that serves this directory. Before use, separately deploy the API route,
durable telemetry mount, owner-sub allowlist, and privacy-approved analytics
feature flag. Add this exact URL to the Supabase Auth redirect allowlist before
using Google sign-in:

`https://fredrock007.github.io/quaptureiq-site/analytics-dashboard/`

Do not place the owner subject, owner JWT, service-role key, or analytics data
in this directory.
