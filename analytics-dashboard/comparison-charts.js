/* Pure, privacy-filtered model helpers for the product comparison charts. */
(function attachComparisonCharts(root) {
  const labels = Object.freeze({
    free: 'Free', student: 'Student', professional: 'Professional',
    quapture_voice: 'Quapture Voice', sky: 'Skye',
    choose_photo: 'Choose from device', take_photo: 'Take a photo',
    scan_document: 'Scan document', q_lens_home: 'Q Lens from Home',
    dashboard_route: 'Dashboard route', email: 'Email', google: 'Google',
  });
  const colors = Object.freeze([
    '#48d9e8', '#55b8ff', '#b7a2ff', '#f3bf65', '#ff8eaa', '#81e0b1',
  ]);

  function buildLineChartModel(series, startValue, endValue, allowedChoices, minimum = 3) {
    const start = Date.parse(startValue || '');
    const end = Date.parse(endValue || '');
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start ||
        !series || typeof series !== 'object' || Array.isArray(series)) {
      return { start: null, end: null, series: [] };
    }
    const allowed = new Set(allowedChoices || []);
    const result = Object.entries(series)
      .filter(([choice, points]) => allowed.has(choice) && Array.isArray(points))
      .map(([choice, points]) => ({
        choice,
        label: labels[choice] || choice,
        color: colors[(allowedChoices || []).indexOf(choice) % colors.length],
        points: points.filter((point) => {
          const timestamp = Date.parse(point?.bucket_start || '');
          return Number.isFinite(timestamp) && timestamp + 6 * 60 * 60 * 1000 > start && timestamp < end &&
            Number.isInteger(point?.count) && point.count >= minimum;
        }).map((point) => ({
          timestamp: Date.parse(point.bucket_start),
          count: point.count,
        })).sort((a, b) => a.timestamp - b.timestamp),
      }))
      .filter((item) => item.points.length > 0);
    return { start, end, series: result };
  }

  root.QuaptureComparisonCharts = Object.freeze({ buildLineChartModel, labels });
})(typeof window === 'undefined' ? globalThis : window);
