# Dashboard start date

## Pending launch-time configuration

Fred will use the exact phrase **“Dashboard start date”** to resume this task after the QuaptureIQ launch time is known.

When Fred provides the launch date and time (Cape Town time, SAST / UTC+2), configure the dashboard’s default reporting start boundary to that timestamp. Keep all pre-launch analytics records stored; exclude them from the dashboard’s live figures through the report time filter. Do not delete, reset, or rewrite historical analytics.

Apply the boundary consistently to all relevant dashboard summaries, activity, comparisons, trends, and charts. Preserve the existing filters and allow the dashboard to refresh normally. Confirm the API already honors the requested time window; do not change backend behavior unless a specific incompatibility is demonstrated and separately authorized.

Before making the change, inspect the current dashboard implementation and tests. Make the smallest scoped change, add or update focused tests for the launch-time boundary and timezone handling, run the relevant dashboard tests, and review the exact diff. Do not guess the launch time or use the date this note was written as a substitute.
