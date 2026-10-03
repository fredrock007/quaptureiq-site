# QuaptureIQ analytics dashboard

Publish this directory as the GitHub Pages path:

`https://fredrock007.github.io/quaptureiq-site/analytics-dashboard/`

The page contains no metrics, owner JWT, or secret key. The production API
base is configured by `config.production.js` for the exact GitHub Pages origin
and is validated as `https://quaptureiq-api.duckdns.org`; if that configuration
is missing or invalid, report requests fail closed. This production setting is
separate from any local QA preview configuration. The dashboard preserves its
existing Supabase project URL and public publishable-key setup and Google OAuth
flow. It uses Supabase browser session persistence and token refresh, calls
the owner-protected `GET /analytics/report` endpoint with the current Supabase
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
