/**
 * PortfolioDataSynchronizationService.js
 * Sprint v3.0.2 — Portfolio Data Synchronization & Valuation Integrity
 *
 * Rebuilds Portfolio Master from governed operational holdings sources.
 * This preserves ADR-001: the Portfolio Dashboard owns current operational
 * portfolio state; the Investment Ledger remains the learning/event archive.
 */

function foRunPortfolioDataSynchronization() {
  const module = 'PortfolioDataSynchronizationService';

  try {
    foInfo_(module, 'Start', 'Portfolio data synchronization started.');

    const dashboard = foDashboard_();
    const master = dashboard.getSheetByName(FO_SHEETS.PORTFOLIO_MASTER);

    if (!master) {
      throw new Error('Portfolio Master worksheet not found.');
    }

    const masterValues = master.getDataRange().getValues();
    if (!masterValues.length) {
      throw new Error('Portfolio Master does not contain a header row.');
    }

    let masterHeaders = masterValues[0].map(function(header) {
      return String(header || '').trim();
    });

    masterHeaders = foEnsurePortfolioValuationEvidenceHeaders_(master, masterHeaders);
    foRequirePortfolioMasterHeaders_(masterHeaders);

    const enrichment = foBuildPortfolioMasterEnrichmentIndex_(
      masterValues,
      masterHeaders
    );

    const sources = [
      { sheetName: 'TFSA Holdings', account: 'TFSA', required: true },
      { sheetName: 'LIRA Holdings', account: 'LIRA', required: true },
      { sheetName: 'Interactive Brokers', account: 'Interactive Brokers', required: false }
    ];

    const records = [];
    const sourceSummaries = [];

    sources.forEach(function(source) {
      const result = foReadPortfolioHoldingsSource_(
        dashboard,
        source,
        masterHeaders,
        enrichment
      );
      Array.prototype.push.apply(records, result.records);
      sourceSummaries.push(result.summary);
    });

    foAssertRequiredPortfolioSources_(sourceSummaries);

    const deduplicated = foConsolidatePortfolioRecords_(records, masterHeaders);
    if (deduplicated.rows.length === 0) {
      throw new Error('No active holdings were resolved; Portfolio Master was not modified.');
    }
    foReplacePortfolioMasterRows_(master, masterHeaders, deduplicated.rows);

    const reconciliation = foWritePortfolioSynchronizationReport_(
      dashboard,
      sourceSummaries,
      deduplicated,
      masterHeaders
    );

    if (reconciliation.failures > 0) {
      throw new Error(
        'Portfolio synchronization completed with ' +
          reconciliation.failures +
          ' reconciliation failure(s). Review Portfolio Synchronization.'
      );
    }

    foInfo_(
      module,
      'Complete',
      deduplicated.rows.length + ' active Portfolio Master rows rebuilt.'
    );

    return {
      status: 'SUCCESS',
      rowsWritten: deduplicated.rows.length,
      duplicateGroupsConsolidated: deduplicated.duplicateGroups,
      sourceSummaries: sourceSummaries,
      reconciliationFailures: reconciliation.failures
    };
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}




const FO_PORTFOLIO_VALUATION_EVIDENCE_HEADERS_ = [
  'Price Timestamp',
  'Price Source',
  'Price Status',
  'Price Basis',
  'Valuation Status',
  'Market Value Basis'
];

function foEnsurePortfolioValuationEvidenceHeaders_(sheet, headers) {
  const result = headers.slice();
  FO_PORTFOLIO_VALUATION_EVIDENCE_HEADERS_.forEach(function(header) {
    if (result.indexOf(header) < 0) result.push(header);
  });
  if (result.length !== headers.length) {
    sheet.getRange(1, 1, 1, result.length).setValues([result]);
  }
  return result;
}

function foAssertRequiredPortfolioSources_(summaries) {
  const failures = summaries.filter(function(summary) {
    return summary.required && (summary.status !== 'READ' || summary.activeRows <= 0);
  });
  if (failures.length > 0) {
    throw new Error(
      'Required operational holdings source(s) are unavailable or empty: ' +
      failures.map(function(item) {
        return item.source + ' [' + item.status + ']';
      }).join(', ') +
      '. Portfolio Master was not modified.'
    );
  }
}

function foRequirePortfolioMasterHeaders_(headers) {
  ['Ticker', 'Account', 'Quantity', 'Cost Basis'].forEach(function(required) {
    if (headers.indexOf(required) < 0) {
      throw new Error('Portfolio Master required column not found: ' + required);
    }
  });
}

function foBuildPortfolioMasterEnrichmentIndex_(values, headers) {
  const byAccountTicker = {};
  const byTicker = {};

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const ticker = String(foGetVal_(row, headers, 'Ticker') || '')
      .trim()
      .toUpperCase();
    const account = String(foGetVal_(row, headers, 'Account') || '')
      .trim()
      .toUpperCase();

    if (!ticker) continue;

    const copy = row.slice();
    byTicker[ticker] = copy;
    if (account) byAccountTicker[account + '|' + ticker] = copy;
  }

  return {
    byAccountTicker: byAccountTicker,
    byTicker: byTicker
  };
}

function foReadPortfolioHoldingsSource_(dashboard, source, masterHeaders, enrichment) {
  const sheet = dashboard.getSheetByName(source.sheetName);

  if (!sheet) {
    return {
      records: [],
      summary: {
        source: source.sheetName,
        account: source.account,
        status: source.required ? 'REQUIRED SOURCE NOT FOUND' : 'NOT FOUND',
        required: Boolean(source.required),
        rowsRead: 0,
        activeRows: 0,
        quantity: 0,
        costBasis: 0
      }
    };
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return {
      records: [],
      summary: {
        source: source.sheetName,
        account: source.account,
        status: source.required ? 'REQUIRED SOURCE EMPTY' : 'EMPTY',
        required: Boolean(source.required),
        rowsRead: 0,
        activeRows: 0,
        quantity: 0,
        costBasis: 0
      }
    };
  }

  const headers = values[0].map(function(header) {
    return String(header || '').trim();
  });

  const tickerHeader = foFindHeaderAlias_(headers, ['Ticker', 'Symbol']);
  const quantityHeader = foFindHeaderAlias_(headers, [
    'Quantity',
    'Shares',
    'Units'
  ]);
  const costBasisHeader = foFindHeaderAlias_(headers, [
    'Cost Basis',
    'Cost Basis CAD',
    'Book Value',
    'Book Value CAD',
    'Adjusted Cost Base',
    'Adjusted Cost Base CAD'
  ]);

  if (!tickerHeader || !quantityHeader || !costBasisHeader) {
    throw new Error(
      source.sheetName +
        ' must contain ticker, quantity and cost-basis columns. Resolved: ' +
        JSON.stringify({
          ticker: tickerHeader,
          quantity: quantityHeader,
          costBasis: costBasisHeader
        })
    );
  }

  const records = [];
  let totalQuantity = 0;
  let totalCostBasis = 0;

  for (let r = 1; r < values.length; r++) {
    const sourceRow = values[r];
    const ticker = String(foGetVal_(sourceRow, headers, tickerHeader) || '')
      .trim()
      .toUpperCase();
    const quantity = foSynchronizationNumber_(
      foGetVal_(sourceRow, headers, quantityHeader)
    );
    const costBasis = foSynchronizationNumber_(
      foGetVal_(sourceRow, headers, costBasisHeader)
    );

    if (!ticker || quantity <= 0) continue;

    const key = source.account.toUpperCase() + '|' + ticker;
    const existing =
      enrichment.byAccountTicker[key] || enrichment.byTicker[ticker] || [];
    const output = masterHeaders.map(function(header, index) {
      return index < existing.length ? existing[index] : '';
    });

    foSetHeaderValue_(output, masterHeaders, 'Ticker', ticker);
    foSetHeaderValue_(output, masterHeaders, 'Account', source.account);
    foSetHeaderValue_(output, masterHeaders, 'Quantity', quantity);
    foSetHeaderValue_(output, masterHeaders, 'Cost Basis', costBasis);

    foCopySourceAlias_(output, masterHeaders, sourceRow, headers, 'Company', [
      'Company',
      'Company / Fund',
      'Name',
      'Security'
    ]);
    foCopySourceAlias_(output, masterHeaders, sourceRow, headers, 'Market Value', [
      'Market Value',
      'Market Value CAD'
    ]);
    foCopySourceAlias_(output, masterHeaders, sourceRow, headers, 'Asset Class', [
      'Asset Class'
    ]);
    foCopySourceAlias_(output, masterHeaders, sourceRow, headers, 'Sector', [
      'Sector'
    ]);
    foCopySourceAlias_(output, masterHeaders, sourceRow, headers, 'Native Currency', [
      'Native Currency',
      'Currency'
    ]);
    foCopySourceAlias_(output, masterHeaders, sourceRow, headers, 'Target Weight', [
      'Target Weight'
    ]);
    foCopySourceAlias_(output, masterHeaders, sourceRow, headers, 'Price Timestamp', [
      'Price Timestamp', 'Market Price Timestamp', 'Timestamp'
    ]);
    foCopySourceAlias_(output, masterHeaders, sourceRow, headers, 'Price Source', [
      'Price Source', 'Provider', 'Market Data Provider'
    ]);
    foCopySourceAlias_(output, masterHeaders, sourceRow, headers, 'Price Status', [
      'Price Status', 'Freshness', 'Market Data Status'
    ]);
    foCopySourceAlias_(output, masterHeaders, sourceRow, headers, 'Price Basis', [
      'Price Basis', 'Valuation Basis'
    ]);
    foCopySourceAlias_(output, masterHeaders, sourceRow, headers, 'Valuation Status', [
      'Valuation Status', 'Certification Status'
    ]);
    foCopySourceAlias_(output, masterHeaders, sourceRow, headers, 'Market Value Basis', [
      'Market Value Basis'
    ]);

    foApplySynchronizedValuationEvidence_(output, masterHeaders, source.sheetName);

    const statusIndex = masterHeaders.indexOf('Status');
    if (statusIndex >= 0) output[statusIndex] = 'Active';

    const notesIndex = masterHeaders.indexOf('Notes');
    if (notesIndex >= 0) {
      output[notesIndex] =
        'Synchronized from ' + source.sheetName + ' on ' + new Date();
    }

    records.push({
      account: source.account,
      ticker: ticker,
      quantity: quantity,
      costBasis: costBasis,
      row: output
    });
    totalQuantity += quantity;
    totalCostBasis += costBasis;
  }

  return {
    records: records,
    summary: {
      source: source.sheetName,
      account: source.account,
      status: records.length > 0 ? 'READ' : (source.required ? 'REQUIRED SOURCE HAS NO ACTIVE ROWS' : 'READ'),
      required: Boolean(source.required),
      rowsRead: values.length - 1,
      activeRows: records.length,
      quantity: totalQuantity,
      costBasis: totalCostBasis
    }
  };
}



function foApplySynchronizedValuationEvidence_(row, headers, sourceName) {
  const price = foSynchronizationNumber_(row[headers.indexOf('Current Price')]);
  const marketValue = foSynchronizationNumber_(row[headers.indexOf('Market Value')]);
  const timestampIndex = headers.indexOf('Price Timestamp');
  const sourceIndex = headers.indexOf('Price Source');
  const statusIndex = headers.indexOf('Price Status');
  const basisIndex = headers.indexOf('Price Basis');
  const valuationIndex = headers.indexOf('Valuation Status');
  const marketBasisIndex = headers.indexOf('Market Value Basis');

  if (price > 0) {
    if (timestampIndex >= 0) row[timestampIndex] = new Date();
    if (sourceIndex >= 0 && !row[sourceIndex]) row[sourceIndex] = sourceName;
    if (statusIndex >= 0) row[statusIndex] = 'SOURCE_REPORTED';
    if (basisIndex >= 0) row[basisIndex] = 'SOURCE_REPORTED';
    if (valuationIndex >= 0) row[valuationIndex] = 'PARTIALLY_CERTIFIED';
    if (marketBasisIndex >= 0) row[marketBasisIndex] = 'DERIVED_FROM_PRICE';
  } else if (marketValue > 0) {
    if (sourceIndex >= 0 && !row[sourceIndex]) row[sourceIndex] = 'PORTFOLIO_MASTER';
    if (statusIndex >= 0) row[statusIndex] = 'UNKNOWN';
    if (basisIndex >= 0) row[basisIndex] = 'PERSISTED_FALLBACK';
    if (valuationIndex >= 0) row[valuationIndex] = 'PARTIALLY_CERTIFIED';
    if (marketBasisIndex >= 0) row[marketBasisIndex] = 'PERSISTED_FALLBACK';
  } else {
    if (statusIndex >= 0) row[statusIndex] = 'MISSING';
    if (basisIndex >= 0) row[basisIndex] = 'UNAVAILABLE';
    if (valuationIndex >= 0) row[valuationIndex] = 'EXCLUDED';
    if (marketBasisIndex >= 0) row[marketBasisIndex] = 'UNAVAILABLE';
  }
}

function foFindHeaderAlias_(headers, aliases) {
  const normalized = {};
  headers.forEach(function(header) {
    normalized[String(header).trim().toUpperCase()] = header;
  });

  for (let i = 0; i < aliases.length; i++) {
    const found = normalized[String(aliases[i]).trim().toUpperCase()];
    if (found) return found;
  }
  return '';
}

function foCopySourceAlias_(output, outputHeaders, sourceRow, sourceHeaders, target, aliases) {
  const targetIndex = outputHeaders.indexOf(target);
  if (targetIndex < 0) return;

  const sourceHeader = foFindHeaderAlias_(sourceHeaders, aliases);
  if (!sourceHeader) return;

  const value = foGetVal_(sourceRow, sourceHeaders, sourceHeader);
  if (value !== '' && value !== null && value !== undefined) {
    output[targetIndex] = value;
  }
}

function foSetHeaderValue_(row, headers, header, value) {
  const index = headers.indexOf(header);
  if (index >= 0) row[index] = value;
}

function foConsolidatePortfolioRecords_(records, headers) {
  const grouped = {};

  records.forEach(function(record) {
    const key = record.account.toUpperCase() + '|' + record.ticker;
    if (!grouped[key]) {
      grouped[key] = {
        account: record.account,
        ticker: record.ticker,
        quantity: 0,
        costBasis: 0,
        row: record.row.slice(),
        count: 0
      };
    }

    grouped[key].quantity += record.quantity;
    grouped[key].costBasis += record.costBasis;
    grouped[key].count++;
  });

  let duplicateGroups = 0;
  const rows = Object.keys(grouped)
    .sort()
    .map(function(key) {
      const item = grouped[key];
      if (item.count > 1) duplicateGroups++;
      foSetHeaderValue_(item.row, headers, 'Quantity', item.quantity);
      foSetHeaderValue_(item.row, headers, 'Cost Basis', item.costBasis);
      return item.row;
    });

  return {
    rows: rows,
    duplicateGroups: duplicateGroups,
    grouped: grouped
  };
}

function foReplacePortfolioMasterRows_(sheet, headers, rows) {
  const existingDataRows = Math.max(0, sheet.getLastRow() - 1);
  if (existingDataRows > 0) {
    sheet.getRange(2, 1, existingDataRows, headers.length).clearContent();
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  sheet.setFrozenRows(1);
}

function foWritePortfolioSynchronizationReport_(dashboard, sourceSummaries, consolidated, headers) {
  const sheet = foEnsureSheet_(dashboard, 'Portfolio Synchronization', [
    'Timestamp',
    'Layer',
    'Account',
    'Ticker',
    'Metric',
    'Expected',
    'Actual',
    'Difference',
    'Status',
    'Details',
    'Platform Version',
    'Baseline'
  ]);

  sheet.clearContents();
  sheet.getRange(1, 1, 1, 12).setValues([[
    'Timestamp', 'Layer', 'Account', 'Ticker', 'Metric', 'Expected',
    'Actual', 'Difference', 'Status', 'Details', 'Platform Version', 'Baseline'
  ]]);

  const now = new Date();
  const rows = [];
  let failures = 0;

  sourceSummaries.forEach(function(summary) {
    const status = summary.status === 'READ' && (!summary.required || summary.activeRows > 0) ? 'PASS' : 'FAIL';
    if (status === 'FAIL') failures++;
    rows.push([
      now,
      summary.source + ' → Portfolio Master',
      summary.account,
      '',
      'Source availability',
      'READ',
      summary.status,
      '',
      status,
      summary.activeRows + ' active rows; cost basis ' + summary.costBasis,
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ]);
  });

  Object.keys(consolidated.grouped).sort().forEach(function(key) {
    const item = consolidated.grouped[key];
    const quantity = foSynchronizationNumber_(
      item.row[headers.indexOf('Quantity')]
    );
    const costBasis = foSynchronizationNumber_(
      item.row[headers.indexOf('Cost Basis')]
    );

    const quantityPass = Math.abs(quantity - item.quantity) < 0.000001;
    const costBasisPass = Math.abs(costBasis - item.costBasis) < 0.01;
    if (!quantityPass) failures++;
    if (!costBasisPass) failures++;

    rows.push([
      now,
      'Holdings → Portfolio Master',
      item.account,
      item.ticker,
      'Quantity',
      item.quantity,
      quantity,
      quantity - item.quantity,
      quantityPass ? 'PASS' : 'FAIL',
      item.count > 1 ? 'Consolidated ' + item.count + ' source rows.' : 'Single source row.',
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ]);
    rows.push([
      now,
      'Holdings → Portfolio Master',
      item.account,
      item.ticker,
      'Cost Basis',
      item.costBasis,
      costBasis,
      costBasis - item.costBasis,
      costBasisPass ? 'PASS' : 'FAIL',
      'Tolerance: C$0.01',
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ]);
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 12).setValues(rows);
  }
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 12);

  return { failures: failures, checks: rows.length };
}

function foSynchronizationNumber_(value) {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = String(value)
    .replace(/C\$/gi, '')
    .replace(/US\$/gi, '')
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .replace(/%/g, '')
    .trim();
  const number = Number(normalized);
  return isNaN(number) ? 0 : number;
}

function foRunPortfolioDataSynchronizationSmokeTest() {
  const synchronization = foRunPortfolioDataSynchronization();
  const valuation = foRunPortfolioValuation();
  const state = foRebuildPortfolioState();
  const integrity = foRunPortfolioDataIntegrity();

  return {
    status: 'SUCCESS',
    synchronization: synchronization,
    valuation: valuation,
    state: state,
    integrity: integrity
  };
}
