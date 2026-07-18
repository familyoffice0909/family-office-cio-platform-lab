/**
 * Legacy source-sheet portfolio-state compatibility service.
 */

function foLoadPortfolioMaster_() {
  const dashboard = foDashboard_();
  const sheet = dashboard.getSheetByName(FO_SHEETS.PORTFOLIO_MASTER);
  const map = {};

  if (!sheet) return map;

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return map;

  const headers = values[0].map(function (header) {
    return String(header).trim();
  });

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const ticker = String(foGetVal_(row, headers, 'Ticker')).trim();

    if (!ticker) continue;

    map[ticker.toUpperCase()] = {
      company:
        foGetVal_(row, headers, 'Company / Fund') ||
        foGetVal_(row, headers, 'Company'),
      preferredVehicle: foGetVal_(row, headers, 'Preferred Vehicle'),
      marketAccessType: foGetVal_(row, headers, 'Market Access Type'),
      assetClass: foGetVal_(row, headers, 'Asset Class'),
      theme: foGetVal_(row, headers, 'Theme'),
      sector: foGetVal_(row, headers, 'Sector'),
      nativeCurrency: foGetVal_(row, headers, 'Native Currency'),
      targetWeight: foGetVal_(row, headers, 'Target Weight'),
      riskTier: foGetVal_(row, headers, 'Risk Tier'),
      dataQuality: foGetVal_(row, headers, 'Data Quality')
    };
  }

  return map;
}

function foBuildPortfolioStateSnapshot() {
  return foRebuildPortfolioStateFromSourceSheets();
}

function foRebuildPortfolioStateFromSourceSheets() {
  const module = 'LegacyPortfolioStateService';

  try {
    foInfo_(module, 'Start', 'Source-sheet Portfolio State rebuild started.');

    const dashboard = foDashboard_();
    const stateSheet = foEnsureSheet_(dashboard, 'Portfolio State', [
      'Timestamp', 'Account', 'Ticker', 'Name', 'Vehicle',
      'Market Access Type', 'Quantity', 'Native Currency', 'Native Price',
      'FX Rate', 'Market Value CAD', 'Cost Basis CAD',
      'Unrealized P&L CAD', 'Unrealized P&L %', 'Asset Class', 'Theme',
      'Sector', 'Target Weight', 'Current Weight', 'Drift', 'Status', 'Notes'
    ]);

    const masterMap = foLoadPortfolioMaster_();

    if (stateSheet.getLastRow() > 1) {
      stateSheet.getRange(2, 1, stateSheet.getLastRow() - 1, 22).clearContent();
    }

    const now = new Date();
    const rows = [];
    const sources = [
      { sheetName: 'TFSA Holdings', account: 'TFSA', status: 'Active' },
      { sheetName: 'LIRA Holdings', account: 'LIRA', status: 'Active' },
      { sheetName: 'Interactive Brokers', account: 'Interactive Brokers', status: 'Active' },
      { sheetName: 'Watchlists', account: 'Watchlist', status: 'Watchlist' }
    ];

    sources.forEach(function (source) {
      const sheet = dashboard.getSheetByName(source.sheetName);
      if (!sheet) return;

      const values = sheet.getDataRange().getValues();
      if (values.length < 2) return;

      const headers = values[0].map(function (header) {
        return String(header).trim();
      });

      for (let r = 1; r < values.length; r++) {
        const row = values[r];
        const ticker = String(foGetVal_(row, headers, 'Ticker')).trim();
        if (!ticker) continue;

        const master = masterMap[ticker.toUpperCase()] || {};
        const quantity =
          foNum_(foGetVal_(row, headers, 'Quantity')) ||
          foNum_(foGetVal_(row, headers, 'Shares'));
        const nativePrice =
          foNum_(foGetVal_(row, headers, 'Native Price')) ||
          foNum_(foGetVal_(row, headers, 'Current Price'));
        const fxRate =
          foNum_(foGetVal_(row, headers, 'FX Rate')) ||
          (master.nativeCurrency === 'USD' ? 1.36 : 1);
        const existingMarketValue =
          foNum_(foGetVal_(row, headers, 'Market Value CAD')) ||
          foNum_(foGetVal_(row, headers, 'Market Value'));
        const marketValueCAD =
          quantity !== '' && nativePrice !== ''
            ? Number(quantity) * Number(nativePrice) * Number(fxRate)
            : existingMarketValue;
        const costBasisCAD =
          foNum_(foGetVal_(row, headers, 'Cost Basis CAD')) ||
          foNum_(foGetVal_(row, headers, 'Book Value'));
        const unrealizedCAD =
          marketValueCAD !== '' && costBasisCAD !== ''
            ? Number(marketValueCAD) - Number(costBasisCAD)
            : '';
        const unrealizedPct =
          unrealizedCAD !== '' && Number(costBasisCAD) !== 0
            ? Number(unrealizedCAD) / Number(costBasisCAD)
            : '';
        const targetWeight =
          foNum_(foGetVal_(row, headers, 'Target Weight')) ||
          foNum_(master.targetWeight);

        rows.push([
          now,
          source.account,
          ticker,
          foGetVal_(row, headers, 'Name') ||
            foGetVal_(row, headers, 'Security') ||
            master.company || '',
          foGetVal_(row, headers, 'Vehicle') || master.preferredVehicle || '',
          foGetVal_(row, headers, 'Market Access Type') || master.marketAccessType || '',
          quantity,
          foGetVal_(row, headers, 'Native Currency') || master.nativeCurrency || 'CAD',
          nativePrice,
          fxRate,
          marketValueCAD,
          costBasisCAD,
          unrealizedCAD,
          unrealizedPct,
          foGetVal_(row, headers, 'Asset Class') || master.assetClass || '',
          foGetVal_(row, headers, 'Theme') || master.theme || '',
          foGetVal_(row, headers, 'Sector') || master.sector || '',
          targetWeight,
          '',
          '',
          source.status,
          master.dataQuality
            ? 'Master enriched from Portfolio Master | Data Quality: ' + master.dataQuality
            : 'Master enriched from Portfolio Master'
        ]);
      }
    });

    const aggregation = foAggregateHouseholdPortfolio(
      foCreateHouseholdPortfolioFromPositions(rows.map(function(row) {
        return {
          account: row[1],
          ticker: row[2],
          company: row[3],
          quantity: row[6],
          currency: row[7],
          marketValue: row[10],
          marketValueCurrency: 'CAD',
          costBasis: row[11],
          assetClass: row[14],
          sector: row[16],
          targetWeight: row[17]
        };
      }), 'CAD')
    );
    const totalMarketValue = aggregation.totalMarketValue;

    rows.forEach(function (row, index) {
      const targetWeight = row[17] === '' ? '' : Number(row[17]);
      const currentWeight =
        totalMarketValue > 0 ? aggregation.positions[index].weight : '';
      const drift =
        currentWeight !== '' && targetWeight !== ''
          ? currentWeight - targetWeight
          : '';

      row[18] = currentWeight;
      row[19] = drift;
    });

    if (rows.length > 0) {
      stateSheet.getRange(2, 1, rows.length, 22).setValues(rows);
    }

    foInfo_(
      module,
      'Complete',
      rows.length + ' rows loaded. Total market value CAD: ' + totalMarketValue
    );

    return {
      status: 'SUCCESS',
      rowsWritten: rows.length,
      totalMarketValueCAD: totalMarketValue
    };
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}
