/**
 * Dashboard write helpers.
 */

function foAppendDashboardMetric(metric) {
  const module = 'DashboardService';

  try {
    const sheet = foEnsureSheet_(foDashboard_(), FO_SHEETS.EXECUTIVE_DASHBOARD, [
      'Timestamp', 'Metric', 'Value', 'Status', 'Notes'
    ]);

    sheet.appendRow([
      new Date(),
      metric.name || '',
      metric.value || '',
      metric.status || '',
      metric.notes || ''
    ]);

    foInfo_(module, 'Append Metric', metric.name || 'metric');

    return { status: 'SUCCESS', metric: metric.name || '' };
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}
