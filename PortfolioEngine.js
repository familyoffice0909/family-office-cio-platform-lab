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
    const rawPositions = [];

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

      rawPositions.push({
        rowNumber: r + 1,
        ticker: ticker,
        canonicalSecurityId:
          foGetVal_(row, headers, 'Canonical Security ID') || '',
        securityId: foGetVal_(row, headers, 'Security ID') || '',
        isin: foGetVal_(row, headers, 'ISIN') || '',
        cusip: foGetVal_(row, headers, 'CUSIP') || '',
        sedol: foGetVal_(row, headers, 'SEDOL') || '',
        exchange:
          foGetVal_(row, headers, 'Exchange') ||
          foGetVal_(row, headers, 'Primary Exchange') ||
          '',
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
        currentPriceCurrency:
          foGetVal_(row, headers, 'Current Price Currency') ||
          foGetVal_(row, headers, 'Price Currency') ||
          FO_CONFIG.BASE_CURRENCY,
        marketValue: marketValue,
        valuationCurrency:
          foGetVal_(row, headers, 'Valuation Currency') ||
          foGetVal_(row, headers, 'Market Value Currency') ||
          FO_CONFIG.BASE_CURRENCY,
        costBasis: costBasis,
        targetWeight: targetWeight
      });
    }

    const householdPortfolio = foCreateHouseholdPortfolioFromPositions(
      rawPositions,
      FO_CONFIG.BASE_CURRENCY
    );
    const aggregation = foAggregateHouseholdPortfolio(householdPortfolio);
    const positions = aggregation.positions.map(function(position) {
      return Object.assign({}, position, {
        quantity: position.quantity === null ? '' : position.quantity,
        currentPrice: position.currentPrice === null ? '' : position.currentPrice,
        costBasis: position.costBasis === null ? '' : position.costBasis,
        targetWeight: position.targetWeight === null ? '' : position.targetWeight
      });
    });
    const totalMarketValue = aggregation.totalMarketValue;
    const intelligence = foBuildUnifiedPortfolioIntelligence(
      aggregation
    );
    const duplicateExposure = foAnalyzeDuplicateExposure(
      aggregation
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
        totalMarketValue > 0
          ? p.weight
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

    foWritePortfolioSummary_(dashboard, snapshotId, aggregation);

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

function foWritePortfolioSummary_(dashboard, snapshotId, aggregation) {
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

  const assetClassCount = aggregation.allocations.assetClass.filter(function(group) {
    return group.name !== FO_UNKNOWN_PORTFOLIO_DIMENSION;
  }).length;
  const sectorCount = aggregation.allocations.sector.filter(function(group) {
    return group.name !== FO_UNKNOWN_PORTFOLIO_DIMENSION;
  }).length;

  const rows = [
    [new Date(), snapshotId, 'Total Positions', aggregation.holdingCount, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), snapshotId, 'Total Market Value', aggregation.totalMarketValue, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), snapshotId, 'Accounts Count', aggregation.accountCount, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), snapshotId, 'Asset Classes Count', assetClassCount, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE],
    [new Date(), snapshotId, 'Sectors Count', sectorCount, FO_CONFIG.PLATFORM_VERSION, FO_CONFIG.BASELINE]
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
