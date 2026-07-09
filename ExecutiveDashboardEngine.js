/************************************************************
 * ExecutiveDashboardEngine.gs
 * Wave 1C.8 — Executive Dashboard Engine
 ************************************************************/

function foRunExecutiveDashboardEngine() {
  const module = 'ExecutiveDashboardEngine';

  try {
    foInfo_(module, 'Start', 'Executive Dashboard Engine started.');

    const dashboard = foDashboard_();

    const portfolioSummary = foReadMetricSheet_(
      dashboard,
      'Portfolio Engine Summary',
      'Metric',
      'Value'
    );

    const executiveReportSummary = foReadExecutiveReportSummary_(dashboard);
    const cioDecisions = foReadCioDecisionRows_(dashboard);
    const marketIntel = foReadMarketIntelligenceRows_(dashboard);

    const dashboardSheet = foEnsureSheet_(dashboard, 'Executive Dashboard', [
      'Metric',
      'Value',
      'Status',
      'Notes'
    ]);

    dashboardSheet.clear();

    const rows = foBuildExecutiveDashboardRows_(
      portfolioSummary,
      executiveReportSummary,
      cioDecisions,
      marketIntel
    );

    dashboardSheet.getRange(1, 1, rows.length, 4).setValues(rows);

    foFormatExecutiveDashboard_(dashboardSheet);

    foInfo_(module, 'Complete', 'Executive Dashboard refreshed.');

    return {
      status: 'SUCCESS',
      rowsWritten: rows.length
    };

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foReadMetricSheet_(spreadsheet, sheetName, metricHeader, valueHeader) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  const map = {};

  if (!sheet) return map;

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return map;

  const headers = values[0].map(String);
  const metricIndex = headers.indexOf(metricHeader);
  const valueIndex = headers.indexOf(valueHeader);

  if (metricIndex < 0 || valueIndex < 0) return map;

  for (let r = 1; r < values.length; r++) {
    const metric = String(values[r][metricIndex] || '').trim();
    if (!metric) continue;

    map[metric] = values[r][valueIndex];
  }

  return map;
}

function foReadExecutiveReportSummary_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Executive CIO Report');
  const summary = {};

  if (!sheet) return summary;

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return summary;

  const headers = values[0].map(String);

  const sectionIndex = headers.indexOf('Section');
  const metricIndex = headers.indexOf('Metric / Ticker');
  const valueIndex = headers.indexOf('Value / Action');
  const priorityIndex = headers.indexOf('Priority');
  const riskIndex = headers.indexOf('Risk');
  const notesIndex = headers.indexOf('Notes');

  for (let r = 1; r < values.length; r++) {
    const section = String(values[r][sectionIndex] || '');
    const metric = String(values[r][metricIndex] || '');

    if (section !== 'Executive Summary') continue;

    summary[metric] = {
      value: values[r][valueIndex],
      priority: priorityIndex >= 0 ? values[r][priorityIndex] : '',
      risk: riskIndex >= 0 ? values[r][riskIndex] : '',
      notes: notesIndex >= 0 ? values[r][notesIndex] : ''
    };
  }

  return summary;
}

function foReadCioDecisionRows_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('CIO Decisions');
  const rows = [];

  if (!sheet) return rows;

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return rows;

  const headers = values[0].map(String);

  for (let r = 1; r < values.length; r++) {
    const ticker = foGetVal_(values[r], headers, 'Ticker');
    if (!ticker) continue;

    rows.push({
      ticker: ticker,
      company: foGetVal_(values[r], headers, 'Company'),
      marketValue: foNum_(foGetVal_(values[r], headers, 'Market Value')),
      cioReadiness: foNum_(foGetVal_(values[r], headers, 'CIO Readiness')),
      cioAction: foGetVal_(values[r], headers, 'CIO Action'),
      priority: foGetVal_(values[r], headers, 'Priority'),
      riskRating: foGetVal_(values[r], headers, 'Risk Rating'),
      requiresReview: foGetVal_(values[r], headers, 'Requires Review')
    });
  }

  return rows;
}

function foReadMarketIntelligenceRows_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Market Intelligence');
  const rows = [];

  if (!sheet) return rows;

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return rows;

  const headers = values[0].map(String);

  for (let r = 1; r < values.length; r++) {
    const ticker = foGetVal_(values[r], headers, 'Ticker');
    if (!ticker) continue;

    rows.push({
      ticker: ticker,
      buyZoneConfidence: foNum_(foGetVal_(values[r], headers, 'Buy Zone Confidence')),
      convictionScore: foNum_(foGetVal_(values[r], headers, 'Conviction Score')),
      materialityScore: foNum_(foGetVal_(values[r], headers, 'Materiality Score')),
      recommendation: foGetVal_(values[r], headers, 'Recommendation'),
      riskRating: foGetVal_(values[r], headers, 'Risk Rating')
    });
  }

  return rows;
}

function foBuildExecutiveDashboardRows_(portfolioSummary, executiveReportSummary, cioDecisions, marketIntel) {
  const totalMarketValue = Number(portfolioSummary['Total Market Value'] || 0);
  const totalPositions = Number(portfolioSummary['Total Positions'] || cioDecisions.length || 0);

  const readinessMetric = executiveReportSummary['Overall CIO Readiness'] || {};
  const totalMarketValueMetric = executiveReportSummary['Total Market Value'] || {};
  const reviewMetric = executiveReportSummary['Actions Requiring Review'] || {};

  const avgReadiness =
    readinessMetric.value !== undefined && readinessMetric.value !== ''
      ? readinessMetric.value
      : foAverage_(cioDecisions.map(function(d) { return Number(d.cioReadiness || 0); }));

  const criticalActions = cioDecisions.filter(function(d) {
    return String(d.priority || '').toUpperCase() === 'CRITICAL';
  }).length;

  const highPriorityActions = cioDecisions.filter(function(d) {
    return String(d.priority || '').toUpperCase() === 'HIGH';
  }).length;

  const reviewCount = cioDecisions.filter(function(d) {
    return String(d.requiresReview || '').toUpperCase() === 'YES';
  }).length;

  const deployCapital = cioDecisions.filter(function(d) {
    return String(d.cioAction || '').toUpperCase().indexOf('DEPLOY') >= 0;
  });

  const buyAdd = cioDecisions.filter(function(d) {
    return String(d.cioAction || '').toUpperCase() === 'BUY / ADD';
  });

  const watchReview = cioDecisions.filter(function(d) {
    return String(d.cioAction || '').toUpperCase().indexOf('WATCH') >= 0;
  });

  const topOpportunity = foFindTopOpportunity_(cioDecisions);
  const largestPosition = foFindLargestPosition_(cioDecisions);
  const highestRisk = foFindHighestRisk_(cioDecisions);

  const rows = [];

  rows.push(['Metric', 'Value', 'Status', 'Notes']);
  rows.push(['Portfolio Health', 'Operational', '🟢', 'Dashboard generated by Executive Dashboard Engine.']);
  rows.push(['Platform Version', FO_CONFIG.PLATFORM_VERSION, '🟢', FO_CONFIG.BASELINE]);
  rows.push(['Last Refresh', new Date(), '🟢', 'Automated dashboard refresh timestamp.']);
  rows.push(['', '', '', '']);

  rows.push(['1. Executive Summary', '', '', '']);
  rows.push(['Total Portfolio Value', totalMarketValueMetric.value || totalMarketValue, '🟢', 'From Portfolio Engine / Executive Report.']);
  rows.push(['Total Positions', totalPositions, '🟢', 'Active holdings included in Portfolio Snapshot.']);
  rows.push(['Overall CIO Readiness', avgReadiness, foReadinessStatus_(avgReadiness), readinessMetric.notes || 'Average readiness across CIO decisions.']);
  rows.push(['Actions Requiring Review', reviewMetric.value || reviewCount, reviewCount > 0 ? '🟡' : '🟢', 'Items requiring manual CIO review.']);
  rows.push(['Critical Actions', criticalActions, criticalActions > 0 ? '🔴' : '🟢', 'Critical-priority CIO decisions.']);
  rows.push(['High Priority Actions', highPriorityActions, highPriorityActions > 0 ? '🟡' : '🟢', 'High-priority CIO actions.']);
  rows.push(['', '', '', '']);

  rows.push(['2. Capital Deployment', '', '', '']);
  rows.push(['Deploy Capital Count', deployCapital.length, deployCapital.length > 0 ? '🔴' : '🟢', foJoinTickers_(deployCapital)]);
  rows.push(['Buy / Add Count', buyAdd.length, buyAdd.length > 0 ? '🟡' : '🟢', foJoinTickers_(buyAdd)]);
  rows.push(['Watch / Review Count', watchReview.length, watchReview.length > 0 ? '🟡' : '🟢', foJoinTickers_(watchReview)]);
  rows.push(['Top Opportunity', topOpportunity.ticker || 'N/A', topOpportunity.status || '', topOpportunity.notes || '']);
  rows.push(['', '', '', '']);

  rows.push(['3. Risk Monitoring', '', '', '']);
  rows.push(['Largest Position', largestPosition.ticker || 'N/A', '', largestPosition.notes || '']);
  rows.push(['Highest Risk Holding', highestRisk.ticker || 'N/A', highestRisk.status || '', highestRisk.notes || '']);
  rows.push(['High Risk Holdings Count', foCountRisk_(cioDecisions, 'HIGH'), foCountRisk_(cioDecisions, 'HIGH') > 0 ? '🟡' : '🟢', 'Count of holdings rated High risk.']);
  rows.push(['', '', '', '']);

  rows.push(['4. Market Intelligence', '', '', '']);
  rows.push(['Average Buy Zone Confidence', foAverage_(marketIntel.map(function(x) { return Number(x.buyZoneConfidence || 0); })), '', 'Average across scored holdings.']);
  rows.push(['Average Conviction Score', foAverage_(marketIntel.map(function(x) { return Number(x.convictionScore || 0); })), '', 'Average across scored holdings.']);
  rows.push(['Average Materiality Score', foAverage_(marketIntel.map(function(x) { return Number(x.materialityScore || 0); })), '', 'Average across scored holdings.']);

  return rows;
}

function foAverage_(values) {
  const clean = values.filter(function(v) {
    return !isNaN(v) && Number(v) > 0;
  });

  if (clean.length === 0) return 0;

  return Math.round(clean.reduce(function(a, b) {
    return a + b;
  }, 0) / clean.length);
}

function foReadinessStatus_(readiness) {
  const score = Number(readiness || 0);

  if (score >= 85) return '🟢';
  if (score >= 70) return '🟡';
  return '🔴';
}

function foJoinTickers_(rows) {
  if (!rows || rows.length === 0) return 'None';

  return rows.map(function(r) {
    return r.ticker;
  }).join(', ');
}

function foFindTopOpportunity_(decisions) {
  if (!decisions || decisions.length === 0) {
    return { ticker: '', status: '', notes: '' };
  }

  const sorted = decisions.slice().sort(function(a, b) {
    return Number(b.cioReadiness || 0) - Number(a.cioReadiness || 0);
  });

  const top = sorted[0];

  return {
    ticker: top.ticker,
    status: String(top.priority || '').toUpperCase() === 'CRITICAL' ? '🔴' : '🟢',
    notes: 'Readiness: ' + top.cioReadiness + ' | Action: ' + top.cioAction
  };
}

function foFindLargestPosition_(decisions) {
  if (!decisions || decisions.length === 0) {
    return { ticker: '', notes: '' };
  }

  const sorted = decisions.slice().sort(function(a, b) {
    return Number(b.marketValue || 0) - Number(a.marketValue || 0);
  });

  const top = sorted[0];

  return {
    ticker: top.ticker,
    notes: 'Market Value: ' + top.marketValue
  };
}

function foFindHighestRisk_(decisions) {
  const highRisk = decisions.filter(function(d) {
    return String(d.riskRating || '').toUpperCase() === 'HIGH';
  });

  if (highRisk.length === 0) {
    return { ticker: 'None', status: '🟢', notes: 'No high-risk holdings detected.' };
  }

  const sorted = highRisk.slice().sort(function(a, b) {
    return Number(b.cioReadiness || 0) - Number(a.cioReadiness || 0);
  });

  return {
    ticker: sorted[0].ticker,
    status: '🟡',
    notes: 'High-risk holding with readiness ' + sorted[0].cioReadiness
  };
}

function foCountRisk_(decisions, riskLevel) {
  return decisions.filter(function(d) {
    return String(d.riskRating || '').toUpperCase() === String(riskLevel || '').toUpperCase();
  }).length;
}

function foFormatExecutiveDashboard_(sheet) {
  sheet.setFrozenRows(1);
  sheet.getRange('A1:D1').setFontWeight('bold');
  sheet.autoResizeColumns(1, 4);

  const values = sheet.getDataRange().getValues();

  for (let r = 1; r <= values.length; r++) {
    const label = String(values[r - 1][0] || '');

    if (label.indexOf('.') > 0 || label === 'Metric') {
      sheet.getRange(r, 1, 1, 4).setFontWeight('bold');
    }
  }
}

function foRunExecutiveDashboardSmokeTest() {
  const module = 'ExecutiveDashboardEngine';

  try {
    foInfo_(module, 'Start', 'Executive Dashboard smoke test started.');

    const result = foRunExecutiveDashboardEngine();

    foInfo_(module, 'Complete', 'Executive Dashboard smoke test completed.');

    return result;

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}