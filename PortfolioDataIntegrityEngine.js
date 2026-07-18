/************************************************************
 * PortfolioDataIntegrityEngine.gs
 * Wave 2.2.2 — Portfolio Data Integrity Engine
 ************************************************************/

function foRunPortfolioDataIntegrity() {
  const module = 'PortfolioDataIntegrityEngine';

  try {
    foInfo_(module, 'Start', 'Portfolio data integrity check started.');

    const dashboard = foDashboard_();
    const portfolioSheet = dashboard.getSheetByName(FO_SHEETS.PORTFOLIO_MASTER);

    if (!portfolioSheet) {
      throw new Error('Portfolio Master sheet not found.');
    }

    const values = portfolioSheet.getDataRange().getValues();

    if (values.length < 2) {
      throw new Error('Portfolio Master has no data rows.');
    }

    const headers = values[0].map(String);
    const issues = [];
    const seen = {};

    for (let r = 1; r < values.length; r++) {
      const row = values[r];

      const ticker = String(foGetVal_(row, headers, 'Ticker') || '').trim().toUpperCase();
      const rawAccount = String(foGetVal_(row, headers, 'Account') || '').trim();
      const quantity = foIntegrityNumber_(foGetVal_(row, headers, 'Quantity'));
      const price = foIntegrityNumber_(foGetVal_(row, headers, 'Current Price'));
      const marketValue = foIntegrityNumber_(foGetVal_(row, headers, 'Market Value'));
      const costBasis = foIntegrityNumber_(foGetVal_(row, headers, 'Cost Basis'));
      const assetClass = String(foGetVal_(row, headers, 'Asset Class') || '').trim();
      const sector = String(foGetVal_(row, headers, 'Sector') || '').trim();

      if (!ticker) continue;

      if (foIsReferencePortfolioRow_(rawAccount, quantity, marketValue, price)) {
        continue;
      }

      const account = foNormalizeAccountIdentity_(rawAccount).name;

      const rowNumber = r + 1;
      const duplicateKey = ticker + '|' + account;

      if (seen[duplicateKey]) {
        foAddPortfolioIntegrityIssue_(issues, rowNumber, ticker, account, 'Duplicate Position', 'MEDIUM',
          'Same ticker/account combination appears more than once.',
          'Consolidate duplicate rows or confirm they represent separate lots.');
      } else {
        seen[duplicateKey] = true;
      }

      if (quantity <= 0) {
        foAddPortfolioIntegrityIssue_(issues, rowNumber, ticker, account, 'Missing or Invalid Quantity', 'HIGH',
          'Quantity is blank, zero, or not numeric.',
          'Enter the number of units/shares from the broker statement.');
      }

      if (price <= 0) {
        foAddPortfolioIntegrityIssue_(issues, rowNumber, ticker, account, 'Missing Current Price', 'MEDIUM',
          'Current Price is blank, zero, or unavailable.',
          'Run Market Data Refresh or verify ticker symbol in Market Symbol Registry.');
      }

      if (marketValue <= 0 && quantity > 0 && price > 0) {
        foAddPortfolioIntegrityIssue_(issues, rowNumber, ticker, account, 'Missing Market Value', 'MEDIUM',
          'Market Value is blank even though quantity and price are available.',
          'Run Portfolio Valuation Engine.');
      }

      if (costBasis <= 0) {
        foAddPortfolioIntegrityIssue_(issues, rowNumber, ticker, account, 'Missing Cost Basis', 'HIGH',
          'Cost Basis is missing or zero, which distorts gain/loss and performance.',
          'Populate cost basis from broker trade history or adjusted book value.');
      }

      if (!assetClass) {
        foAddPortfolioIntegrityIssue_(issues, rowNumber, ticker, account, 'Missing Asset Class', 'LOW',
          'Asset Class is blank.',
          'Enter Equity, ETF, Cash, Fixed Income, Alternative, Crypto, or Other.');
      }

      if (!sector) {
        foAddPortfolioIntegrityIssue_(issues, rowNumber, ticker, account, 'Missing Sector', 'LOW',
          'Sector is blank.',
          'Enter sector such as Technology, Financials, Materials, Healthcare, Energy, or Broad Market.');
      }

      if (marketValue > 0 && costBasis > 0) {
        const gainPct = (marketValue - costBasis) / costBasis;

        if (gainPct > 5) {
          foAddPortfolioIntegrityIssue_(issues, rowNumber, ticker, account, 'Extreme Gain %', 'MEDIUM',
            'Unrealized gain exceeds 500%, which may indicate incorrect cost basis.',
            'Verify cost basis and quantity.');
        }

        if (gainPct < -0.8) {
          foAddPortfolioIntegrityIssue_(issues, rowNumber, ticker, account, 'Extreme Loss %', 'MEDIUM',
            'Unrealized loss exceeds 80%, which may indicate incorrect cost basis or price.',
            'Verify cost basis, price, and ticker mapping.');
        }
      }
    }

    foWritePortfolioIntegrityReport_(dashboard, issues);

    foInfo_(module, 'Complete', 'Portfolio data integrity completed. Issues found: ' + issues.length);

    return {
      status: 'SUCCESS',
      issuesFound: issues.length
    };

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foAddPortfolioIntegrityIssue_(issues, rowNumber, ticker, account, issueType, severity, details, suggestedFix) {
  issues.push([
    new Date(),
    rowNumber,
    ticker,
    account,
    issueType,
    severity,
    details,
    suggestedFix,
    FO_CONFIG.PLATFORM_VERSION,
    FO_CONFIG.BASELINE
  ]);
}

function foWritePortfolioIntegrityReport_(dashboard, issues) {
  const sheet = foEnsureSheet_(dashboard, 'Portfolio Data Integrity', [
    'Timestamp',
    'Row',
    'Ticker',
    'Account',
    'Issue Type',
    'Severity',
    'Details',
    'Suggested Fix',
    'Platform Version',
    'Baseline'
  ]);

  sheet.clearContents();

  sheet.getRange(1, 1, 1, 10).setValues([[
    'Timestamp',
    'Row',
    'Ticker',
    'Account',
    'Issue Type',
    'Severity',
    'Details',
    'Suggested Fix',
    'Platform Version',
    'Baseline'
  ]]);

  if (issues.length > 0) {
    sheet.getRange(2, 1, issues.length, 10).setValues(issues);
  } else {
    sheet.getRange(2, 1, 1, 10).setValues([[
      new Date(),
      '',
      '',
      '',
      'No Issues Found',
      'INFO',
      'Portfolio Master passed integrity checks.',
      'No action required.',
      FO_CONFIG.PLATFORM_VERSION,
      FO_CONFIG.BASELINE
    ]]);
  }

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 10);
}

function foIntegrityNumber_(value) {
  if (value === null || value === undefined || value === '') return 0;

  const cleaned = String(value)
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .replace(/%/g, '')
    .trim();

  const n = Number(cleaned);

  return isNaN(n) ? 0 : n;
}

function foIsReferencePortfolioRow_(account, quantity, marketValue, price) {
  const normalizedAccount = String(account || '').trim().toUpperCase();

  const excludedAccounts = [
    'N/A',
    'NA',
    'PENDING',
    'REFERENCE',
    'LIBRARY',
    'WATCHLIST',
    'WATCH LIST',
    'TEMPLATE'
  ];

  if (excludedAccounts.indexOf(normalizedAccount) >= 0 && quantity <= 0 && marketValue <= 0 && price <= 0) {
    return true;
  }

  return false;
}

function foRunPortfolioDataIntegritySmokeTest() {
  const module = 'PortfolioDataIntegrityEngine';

  try {
    foInfo_(module, 'Start', 'Portfolio Data Integrity smoke test started.');

    const result = foRunPortfolioDataIntegrity();

    foInfo_(module, 'Complete', 'Portfolio Data Integrity smoke test completed.');

    return result;

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}
