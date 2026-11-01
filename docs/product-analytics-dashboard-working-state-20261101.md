# Product Analytics dashboard working state — 1 November 2026

This snapshot records the working Product Analytics dashboard state shown at:

- <https://fredrock007.github.io/quaptureiq-site/analytics-dashboard/>
- GitHub Pages source: `quaptureiq-site`, based on `main` at the snapshot commit.

## What was verified

The dashboard loaded its authenticated analytics report in the browser. The report `GET` and its CORS preflight `OPTIONS` both returned HTTP 200. The visible dashboard showed request, success, failure, duration, and active-session metrics.

## API CORS repair

The dashboard origin is `https://fredrock007.github.io`. The API is `https://quaptureiq-api.duckdns.org`.

The API CORS repair was built from `fix/analytics-report-runtime-cors-20261031` (source commit `84be485abd28f4a2b7762da917920f6bb9349b0e`) and deployed as the ARM64 `qapture-api` candidate. The API's CORS allow-origin response was verified for the dashboard origin. The unauthenticated report check correctly returned HTTP 401 while still including `Access-Control-Allow-Origin: https://fredrock007.github.io`; authenticated browser report and preflight requests returned HTTP 200. Only `qapture-api.service` was restarted during that deployment.

No analytics data, access tokens, or private API keys are stored in this note.
