(function configureProductionAnalyticsApi() {
  if (window.location.origin !== 'https://fredrock007.github.io') return;

  const existing = window.QAPTURE_ANALYTICS_CONFIG;
  window.QAPTURE_ANALYTICS_CONFIG = Object.assign(
    {},
    existing && typeof existing === 'object' ? existing : {},
    { apiBaseUrl: 'https://quaptureiq-api.duckdns.org' },
  );
  window.QAPTURE_ANALYTICS_PRODUCTION_API_CONFIG_LOADED = true;
})();
