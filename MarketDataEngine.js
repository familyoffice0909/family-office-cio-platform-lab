/************************************************************
 * MarketDataEngine.gs
 * Wave 2.1 — Live Market Data Integration
 * Uses Market Symbol Registry
 ************************************************************/

function foRunMarketDataRefresh() {
  const module = 'MarketDataEngine';

  try {
    foInfo_(module, 'Start', 'Market data refresh started.');

    const dashboard = foDashboard_();
    const portfolioSheet = dashboard.getSheetByName(FO_SHEETS.PORTFOLIO_MASTER);

    if (!portfolioSheet) {
      throw new Error('Portfolio Master sheet not found.');
    }

    const values = portfolioSheet.getDataRange().getValues();

    if (values.length < 2) {
      throw new Error('Portfolio Master has no rows.');
    }

    const headers = values[0].map(String);
    const tickers = foExtractRegisteredPortfolioTickers_(values, headers);

    const marketSheet = foEnsureSheet_(dashboard, 'Market Data Cache', [
      'Timestamp',
      'Ticker',
      'Provider Symbol',
      'Provider',
      'Last Price',
      'Currency',
      'Status',
      'Notes',
      'Platform Version',
      'Baseline'
    ]);

    marketSheet.clearContents();

    marketSheet.getRange(1, 1, 1, 10).setValues([[
      'Timestamp',
      'Ticker',
      'Provider Symbol',
      'Provider',
      'Last Price',
      'Currency',
      'Status',
      'Notes',
      'Platform Version',
      'Baseline'
    ]]);

    const rows = [];

    tickers.forEach(function(ticker) {
      const resolved = foResolveMarketSymbol_(ticker);

      rows.push([
        new Date(),
        resolved.ticker,
        resolved.providerSymbol,
        'GOOGLEFINANCE',
        '',
        resolved.currency,
        resolved.status === 'ACTIVE' ? 'PENDING' : resolved.status,
        resolved.notes,
        FO_CONFIG.PLATFORM_VERSION,
        FO_CONFIG.BASELINE
      ]);
    });

    if (rows.length > 0) {
      marketSheet.getRange(2, 1, rows.length, 10).setValues(rows);

      for (let i = 0; i < rows.length; i++) {
        const formulaRow = i + 2;
        const providerSymbol = rows[i][2];
        const status = rows[i][6];

        if (providerSymbol && status === 'PENDING') {
          marketSheet
            .getRange(formulaRow, 5)
            .setFormula('=IFERROR(GOOGLEFINANCE("' + providerSymbol + '","price"),"")');
        }
      }
    }

    SpreadsheetApp.flush();
    Utilities.sleep(3000);

    const priceMap = foReadMarketDataCache_(marketSheet);
    const updateResult = foApplyMarketDataToPortfolioMaster_(portfolioSheet, priceMap);

    foInfo_(
      module,
      'Complete',
      'Market data refresh completed. Prices updated: ' + updateResult.updatedPrices
    );

    return {
      status: 'SUCCESS',
      tickersProcessed: tickers.length,
      updatedPrices: updateResult.updatedPrices,
      missingPrices: updateResult.missingPrices
    };

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foExtractRegisteredPortfolioTickers_(values, headers) {
  const tickerIndex = headers.indexOf('Ticker');
  const quantityIndex = headers.indexOf('Quantity');
  const marketValueIndex = headers.indexOf('Market Value');
  const accountIndex = headers.indexOf('Account');

  if (tickerIndex < 0) {
    throw new Error('Ticker column not found in Portfolio Master.');
  }

  const seen = {};
  const tickers = [];

  for (let r = 1; r < values.length; r++) {
    const ticker = String(values[r][tickerIndex] || '').trim().toUpperCase();
    if (!ticker) continue;

    const account =
      accountIndex >= 0
        ? String(values[r][accountIndex] || '').trim().toUpperCase()
        : '';

    const quantity =
      quantityIndex >= 0
        ? Number(values[r][quantityIndex] || 0)
        : 0;

    const marketValue =
      marketValueIndex >= 0
        ? Number(values[r][marketValueIndex] || 0)
        : 0;

    if (foIsExcludedMarketDataRow_(account, ticker, quantity, marketValue)) {
      continue;
    }

    const resolved = foResolveMarketSymbol_(ticker);

    if (resolved.status !== 'ACTIVE') {
      continue;
    }

    if (!seen[ticker]) {
      seen[ticker] = true;
      tickers.push(ticker);
    }
  }

  return tickers;
}

function foIsExcludedMarketDataRow_(account, ticker, quantity, marketValue) {
  const excludedAccounts = [
    '',
    'N/A',
    'NA',
    'PENDING',
    'REFERENCE',
    'LIBRARY',
    'WATCHLIST',
    'WATCH LIST',
    'TEMPLATE'
  ];

  if (excludedAccounts.indexOf(account) >= 0 && quantity <= 0 && marketValue <= 0) {
    return true;
  }

  return false;
}

function foReadMarketDataCache_(marketSheet) {
  const values = marketSheet.getDataRange().getValues();
  const headers = values[0].map(String);

  const tickerIndex = headers.indexOf('Ticker');
  const priceIndex = headers.indexOf('Last Price');
  const statusIndex = headers.indexOf('Status');
  const notesIndex = headers.indexOf('Notes');

  const priceMap = {};

  for (let r = 1; r < values.length; r++) {
    const ticker = String(values[r][tickerIndex] || '').trim().toUpperCase();
    const price = Number(values[r][priceIndex] || 0);

    if (!ticker) continue;

    if (price > 0) {
      priceMap[ticker] = price;
      marketSheet.getRange(r + 1, statusIndex + 1).setValue('PRICE_FOUND');
      marketSheet.getRange(r + 1, notesIndex + 1).setValue('Price returned by GOOGLEFINANCE.');
    } else {
      marketSheet.getRange(r + 1, statusIndex + 1).setValue('NO_PRICE');
      marketSheet.getRange(r + 1, notesIndex + 1).setValue('No price returned. Symbol may not be supported.');
    }
  }

  return priceMap;
}

function foApplyMarketDataToPortfolioMaster_(portfolioSheet, priceMap) {
  const values = portfolioSheet.getDataRange().getValues();
  const headers = values[0].map(String);

  const tickerIndex = headers.indexOf('Ticker');
  const quantityIndex = headers.indexOf('Quantity');
  const priceIndex = headers.indexOf('Current Price');
  const marketValueIndex = headers.indexOf('Market Value');

  if (tickerIndex < 0 || priceIndex < 0) {
    throw new Error('Portfolio Master must contain Ticker and Current Price columns.');
  }

  let updatedPrices = 0;
  let missingPrices = 0;

  for (let r = 1; r < values.length; r++) {
    const ticker = String(values[r][tickerIndex] || '').trim().toUpperCase();
    if (!ticker) continue;

    const price = priceMap[ticker];

    if (price && price > 0) {
      portfolioSheet.getRange(r + 1, priceIndex + 1).setValue(price);
      updatedPrices++;

      if (quantityIndex >= 0 && marketValueIndex >= 0) {
        const quantity = Number(values[r][quantityIndex] || 0);
        if (quantity > 0) {
          portfolioSheet.getRange(r + 1, marketValueIndex + 1).setValue(quantity * price);
        }
      }
    } else {
      missingPrices++;
    }
  }

  return {
    updatedPrices: updatedPrices,
    missingPrices: missingPrices
  };
}

function foRunMarketDataSmokeTest() {
  const module = 'MarketDataEngine';

  try {
    foInfo_(module, 'Start', 'Market Data smoke test started.');

    foSeedMarketSymbolRegistry();

    const result = foRunMarketDataRefresh();

    foInfo_(module, 'Complete', 'Market Data smoke test completed.');

    return result;

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}