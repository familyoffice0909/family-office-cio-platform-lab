/************************************************************
 * PortfolioEngine.gs
 * Wave 1C.4 — Portfolio Engine
 * Release 2.1.0 — Multi-account portfolio intelligence integration
 ************************************************************/

function foBuildPortfolioSnapshot() {
  const module = 'PortfolioEngine';

  try {
    foInfo_(module, 'Start', 'Building portfolio snapshot.');

    const dashboard = foDashboard_();
    const master = dashboard.getSheetByName(FO_SHEETS.PORTFOLIO_MASTER);

    if (!master) {
      throw new Error('Portfolio Master sheet not found.');
    }

    const values = master.getDataRange().getValues();

    if (values.length < 2) {
      foWarn_(module, 'No Data', 'Portfolio Master has no data rows.');
      return {
        status: 'NO_DATA',
        positions: 0,
        marketValue: 0
      };
    }

    const headers = values[0].map(String);
    const positions = [];

    for (let r = 1; r < values.length; r++) {
      const row = values[r];

      const ticker = foGetVal_(row, headers, 'Ticker');
      if (!ticker) continue;

      const quantity = foNum_(foGetVal_(row, headers, 'Quantity'));
      const currentPrice = foNum_(foGetVal_(row, headers, 'Current Price'));
      const marketValueRaw = foNum_(foGetVal_(row, headers, 'Market Value'));
      const costBasis = foNum_(foGetVal_(row, headers, 'Cost Basis'));
      const targetWeight = foNum_(foGetVal_(row, headers, 'Target Weight'));

      const marketValue =
        marketValueRaw !== ''
          ? marketValueRaw
          : quantity !== '' && currentPrice !== ''
            ? quantity * currentPrice
            : '';

      positions.push({
        rowNumber: r + 1,
        ticker: ticker,
        company:
          foGetVal_(row, headers, 'Company') ||
          foGetVal_(row, headers, 'Company / Fund') ||
          '',
        account:
          foGetVal_(row, headers, 'Account') || FO_DEFAULT_ACCOUNT_NAME,
        assetClass: foGetVal_(row, headers, 'Asset Class') || '',
        sector: foGetVal_(row, headers, 'Sector') || '',
        country: foGetVal_(row, headers, 'Country') || '',
        currency:
          foGetVal_(row, headers, 'Currency') ||
          foGetVal_(row, headers, 'Native Currency') ||
          FO_CONFIG.BASE_CURRENCY,
        theme: foGetVal_(row, headers, 'Theme') || '',
        quantity: quantity,
        currentPrice: currentPrice,
        marketValue: marketValue,
        costBasis: costBasis,
        targetWeight: targetWeight
      });
    }

    const totalMarketValue = positions.reduce(function(sum, p) {
      return sum + (Number(p.marketValue) || 0);
    }, 0);
    const householdPortfolio = foCreateHouseholdPortfolioFromPositions(
      positions,
      FO_CONFIG.BASE_CURRENCY
    );
    const intelligence = foBuildUnifiedPortfolioIntelligence(
      householdPortfolio
    );
    const duplicateExposure = foAnalyzeDuplicateExposure(
      householdPortfolio
    );

    const snapshotSheet = foEnsureSheet_(dashboard, 'Portfolio Snapshot', [
      'Timestamp',
      'Snapshot ID',
      'Ticker',
      'Company',
      'Account',
      'Asset Class',
      'Sector',
      'Theme',
      'Quantity',
      'Current Price',
      'Market Value',
      'Cost Basis',
      'Unrealized P&L',
      'Unrealized P&L %',
      'Current Weight',
      'Target Weight',
      'Drift',
      'Status',
      'Platform Version',
      'Baseline'
    ]);

    if (snapshotSheet.getLastRow() > 1) {
      snapshotSheet
        .getRange(2, 1, snapshotSheet.getLastRow() - 1, 20)
        .clearContent();
    }

    const snapshotId = foNowId_('SNAP');

    const rows = positions.map(function(p) {
      const unrealized =
        p.marketValue !== '' && p.costBasis !== ''
          ? Number(p.marketValue) - Number(p.costBasis)
          : '';

      const unrealizedPct =
        unrealized !== '' && Number(p.costBasis) !== 0
          ? unrealized / Number(p.costBasis)
          : '';

      const currentWeight =
        totalMarketValue > 0 && p.marketValue !== ''
          ? Number(p.marketValue) / totalMarketValue
          : '';

      const drift =
        currentWeight !== '' && p.targetWeight !== ''
          ? currentWeight - Number(p.targetWeight)
          : '';

      return [
        new Date(),
        snapshotId,
        p.ticker,
        p.company,
        p.account,
        p.assetClass,
        p.sector,
        p.theme,
        p.quantity,
        p.currentPrice,
        p.marketValue,
        p.costBasis,
        unrealized,
        unrealizedPct,
        currentWeight,
        p.targetWeight,
        drift,
        'Active',
        FO_CONFIG.PLATFORM_VERSION,
        FO_CONFIG.BASELINE
      ];
    });

    if (rows.length > 0) {
      snapshotSheet.getRange(2, 1, rows.length, 20).setValues(rows);
    }

    foWritePortfolioSummary_(dashboard, snapshotId, positions, totalMarketValue);

    foInfo_(
      module,
      'Complete',
      'Portfolio snapshot built. Positions: ' +
        positions.length +
        ', Market Value: ' +
        totalMarketValue
    );

    return {
      status: 'SUCCESS',
      snapshotId: snapshotId,
      positions: positions.length,
      marketValue: totalMarketValue,
      accountCount: intelligence.accountCount,
      intelligence: intelligence,
      duplicateExposure: duplicateExposure
    };

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foWritePortfolioSummary_(dashboard, snapshotId, positions, totalMarketValue) {
  const summarySheet = foEnsureSheet_(dashboard, 'Portfolio Engine Summary', [
    'Timestamp',
    'Snapshot ID',
    'Metric',
    'Value',
    'Platform Version',
    'Baseline'
  ]);

  if (summarySheet.getLastRow() > 1) {
    summarySheet
      .getRange(2, 1, summarySheet.getLastRow() - 1, 6)
      .clearContent();
  }

  const uniqueAccounts = {};
  const uniqueAssetClasses = {};
  const uniqueSectors = {};

  positions.forEach(function(p) {
    if (p.account) uniqueAccounts[p.account] = true;
    if (p.assetClass) uniqueAssetClasses[p.assetClass] = true;
    if (p.sector) uniqueSectors[p.sector] = true;
  });

  const rows = [
    [new Date(), snapshotId, 'Total Positions', positions.length, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), snapshotId, 'Total Market Value', totalMarketValue, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), snapshotId, 'Accounts Count', Object.keys(uniqueAccounts).length, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), snapshotId, 'Asset Classes Count', Object.keys(uniqueAssetClasses).length, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), snapshotId, 'Sectors Count', Object.keys(uniqueSectors).length, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE]
  ];

  summarySheet.getRange(2, 1, rows.length, 6).setValues(rows);
}

function foRunPortfolioEngineSmokeTest() {
  const module = 'PortfolioEngine';

  try {
    foInfo_(module, 'Start', 'Portfolio Engine smoke test started.');

    const result = foBuildPortfolioSnapshot();

    foInfo_(
      module,
      'Complete',
      'Portfolio Engine smoke test completed. Snapshot: ' + result.snapshotId
    );

    return result;

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}
