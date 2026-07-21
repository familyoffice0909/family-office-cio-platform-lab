/**
 * Decision History Retention Service
 * Wave 2.4.4 — Meaningful History and Retention Controls
 */

function foLoadDecisionHistoryPolicy_(dashboard) {
  const headers = ['Rule', 'Value', 'Description', 'Active'];
  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.DECISION_HISTORY_POLICY,
    headers
  );

  const defaults = [
    [
      'HISTORY_MODE',
      'MEANINGFUL_OR_DAILY',
      'MEANINGFUL_ONLY, DAILY, or MEANINGFUL_OR_DAILY',
      true
    ],
    [
      'MIN_MATERIALITY_SCORE',
      20,
      'Minimum materiality required for a meaningful-change snapshot',
      true
    ],
    [
      'RETENTION_DAYS',
      365,
      'Delete decision-history records older than this many days',
      true
    ],
    [
      'MAX_HISTORY_ROWS',
      5000,
      'Maximum retained data rows excluding the header',
      true
    ],
    [
      'RUN_MAINTENANCE_AFTER_APPEND',
      1,
      'Set to 1 to deduplicate and prune after each append',
      true
    ]
  ];

  foEnsureDecisionHistoryPolicyDefaults_(sheet, defaults);

  const values = sheet.getDataRange().getValues();
  const policy = {};

  for (let row = 1; row < values.length; row++) {
    const name = String(values[row][0] || '').trim();
    const active = values[row][3];

    if (!name || active === false) continue;
    policy[name] = values[row][1];
  }

  return {
    mode: String(
      policy.HISTORY_MODE || 'MEANINGFUL_OR_DAILY'
    ).trim().toUpperCase(),
    minMateriality: foDecisionNumber_(
      policy.MIN_MATERIALITY_SCORE || 20
    ),
    retentionDays: Math.max(
      1,
      foDecisionNumber_(policy.RETENTION_DAYS || 365)
    ),
    maxRows: Math.max(
      100,
      foDecisionNumber_(policy.MAX_HISTORY_ROWS || 5000)
    ),
    maintainAfterAppend:
      foDecisionNumber_(policy.RUN_MAINTENANCE_AFTER_APPEND) !== 0
  };
}

function foEnsureDecisionHistoryPolicyDefaults_(sheet, defaults) {
  const values = sheet.getDataRange().getValues();
  const existing = {};

  for (let row = 1; row < values.length; row++) {
    const name = String(values[row][0] || '').trim();
    if (name) existing[name] = true;
  }

  const missing = defaults.filter(function(rule) {
    return !existing[rule[0]];
  });

  if (missing.length) {
    sheet.getRange(
      sheet.getLastRow() + 1,
      1,
      missing.length,
      missing[0].length
    ).setValues(missing);
  }
}

function foSelectDecisionHistoryEvents_(
  decisions,
  latestHistory,
  todayHistory,
  policy
) {
  return decisions.map(function(item) {
    const key = foDecisionKey_(item.ticker, item.account);
    const previous = latestHistory[key] || null;
    const today = todayHistory[key] || null;
    const signature = foDecisionStateSignature_(item);
    const changed = !previous ||
      previous.stateSignature !== signature;
    const meaningful = changed &&
      (
        item.materialityScore >= policy.minMateriality ||
        !previous ||
        previous.recommendation !== item.recommendation ||
        previous.zonePosition !== item.zonePosition ||
        previous.action !== item.action ||
        previous.allocationBand !== item.allocationBand
      );
    const dailyNeeded = !today;

    let include = false;
    let eventType = '';

    if (policy.mode === 'MEANINGFUL_ONLY') {
      include = meaningful;
    } else if (policy.mode === 'DAILY') {
      include = dailyNeeded;
    } else {
      include = meaningful || dailyNeeded;
    }

    if (!include) return null;

    if (!previous) {
      eventType = 'INITIAL';
    } else if (meaningful) {
      eventType = 'MATERIAL CHANGE';
    } else {
      eventType = 'DAILY SNAPSHOT';
    }

    return {
      item: item,
      eventType: eventType,
      signature: signature
    };
  }).filter(function(event) {
    return event !== null;
  });
}

function foDecisionStateSignature_(item) {
  return [
    item.recommendation,
    item.zonePosition,
    item.action,
    item.allocationBand,
    item.convictionScore,
    item.riskScore,
    item.confidence,
    item.distancePct === null
      ? ''
      : Math.round(item.distancePct * 10000) / 10000,
    item.priceFreshness,
    item.recommendationQualityGrade || '',
    item.contradictionStatus || ''
  ].join('|');
}

function foLoadDecisionHistoryIndex_(sheet) {
  const result = {
    latest: {},
    today: {}
  };

  if (!sheet || sheet.getLastRow() < 2) return result;

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const signatureIndex = headers.indexOf('State Signature');
  const eventIndex = headers.indexOf('Event Type');
  const todayKey = foDecisionDateKey_(new Date());

  for (let row = values.length - 1; row >= 1; row--) {
    const timestamp = values[row][0];
    const ticker = String(values[row][1] || '').trim().toUpperCase();
    const account = String(values[row][2] || '').trim();
    const key = foDecisionKey_(ticker, account);

    if (!ticker) continue;

    const record = {
      timestamp: timestamp,
      recommendation: values[row][3],
      zonePosition: values[row][4],
      convictionScore: foDecisionNumber_(values[row][5]),
      riskScore: foDecisionNumber_(values[row][6]),
      confidence: foDecisionNumber_(values[row][7]),
      distancePct: foDecisionNullableNumber_(values[row][8]),
      materialityScore: foDecisionNumber_(values[row][9]),
      priorityScore: foDecisionNumber_(values[row][10]),
      action: values[row][11],
      allocationBand: values[row][12],
      eventType: eventIndex >= 0 ? values[row][eventIndex] : '',
      stateSignature: signatureIndex >= 0
        ? String(values[row][signatureIndex] || '')
        : [
            values[row][3],
            values[row][4],
            values[row][11],
            values[row][12],
            values[row][5],
            values[row][6],
            values[row][7],
            values[row][8]
          ].join('|')
    };

    if (!result.latest[key]) result.latest[key] = record;

    if (
      !result.today[key] &&
      foDecisionDateKey_(timestamp) === todayKey
    ) {
      result.today[key] = record;
    }
  }

  return result;
}

function foPrepareDecisionHistorySheet_(dashboard) {
  const headers = foDecisionHistoryHeaders_();
  const sheet = foEnsureSheet_(
    dashboard,
    FO_SHEETS.INVESTMENT_DECISION_HISTORY,
    headers
  );

  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      headers.length - sheet.getMaxColumns()
    );
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  return sheet;
}

function foRunDecisionHistoryMaintenance() {
  const module = 'DecisionHistoryRetentionService';

  try {
    const dashboard = foDashboard_();
    const policy = foLoadDecisionHistoryPolicy_(dashboard);
    const sheet = foPrepareDecisionHistorySheet_(dashboard);
    const result = foMaintainDecisionHistory_(sheet, policy);

    foInfo_(
      module,
      'Complete',
      'Decision history maintenance completed. Removed: ' +
        result.removedRows
    );

    return result;
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foMaintainDecisionHistory_(sheet, policy) {
  if (sheet.getLastRow() < 2) {
    return {
      status: 'SUCCESS',
      retainedRows: 0,
      removedRows: 0,
      duplicateRowsRemoved: 0,
      expiredRowsRemoved: 0,
      overflowRowsRemoved: 0
    };
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - policy.retentionDays);

  const retained = [];
  const seenDailySignatures = {};
  let duplicateRowsRemoved = 0;
  let expiredRowsRemoved = 0;

  for (let row = values.length - 1; row >= 1; row--) {
    const record = values[row];
    const timestamp = record[0] instanceof Date
      ? record[0]
      : new Date(record[0]);

    if (!timestamp || isNaN(timestamp.getTime()) || timestamp < cutoff) {
      expiredRowsRemoved += 1;
      continue;
    }

    const ticker = String(record[1] || '').trim().toUpperCase();
    const account = String(record[2] || '').trim();
    const signature = String(
      record[16] ||
      [
        record[3],
        record[4],
        record[11],
        record[12],
        record[5],
        record[6],
        record[7],
        record[8]
      ].join('|')
    );
    const dedupeKey = [
      foDecisionDateKey_(timestamp),
      foDecisionKey_(ticker, account),
      signature
    ].join('|');

    if (seenDailySignatures[dedupeKey]) {
      duplicateRowsRemoved += 1;
      continue;
    }

    seenDailySignatures[dedupeKey] = true;
    retained.push(record);
  }

  retained.reverse();

  let overflowRowsRemoved = 0;
  if (retained.length > policy.maxRows) {
    overflowRowsRemoved = retained.length - policy.maxRows;
    retained.splice(0, overflowRowsRemoved);
  }

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (retained.length) {
    sheet.getRange(
      2,
      1,
      retained.length,
      headers.length
    ).setValues(retained);
  }

  return {
    status: 'SUCCESS',
    retainedRows: retained.length,
    removedRows:
      duplicateRowsRemoved +
      expiredRowsRemoved +
      overflowRowsRemoved,
    duplicateRowsRemoved: duplicateRowsRemoved,
    expiredRowsRemoved: expiredRowsRemoved,
    overflowRowsRemoved: overflowRowsRemoved
  };
}

function foDecisionDateKey_(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (!date || isNaN(date.getTime())) return '';

  return Utilities.formatDate(
    date,
    FO_CONFIG.TIMEZONE,
    'yyyy-MM-dd'
  );
}

function foRunDecisionHistoryRetentionSmokeTest() {
  const dashboard = foDashboard_();
  const policy = foLoadDecisionHistoryPolicy_(dashboard);
  const sheet = foPrepareDecisionHistorySheet_(dashboard);
  const headers = sheet.getRange(
    1,
    1,
    1,
    sheet.getLastColumn()
  ).getValues()[0];

  [
    'Event Type',
    'State Signature'
  ].forEach(function(name) {
    if (headers.indexOf(name) === -1) {
      throw new Error('Missing decision-history column: ' + name);
    }
  });

  if (policy.retentionDays < 1 || policy.maxRows < 100) {
    throw new Error('Invalid decision-history retention policy.');
  }

  return {
    status: 'PASS',
    mode: policy.mode,
    retentionDays: policy.retentionDays,
    maxRows: policy.maxRows
  };
}
