/************************************************************
 * MarketDataEngine.gs
 * Wave 2.0 — Live Market Data Integration
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
    const tickers = foExtractPortfolioTickers_(values, headers);

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
      const symbol = foMapGoogleFinanceSymbol_(ticker);
      const currency = foInferMarketCurrency_(ticker);

      rows.push([
        new Date(),
        ticker,
        symbol,
        'GOOGLEFINANCE',
        '',
        currency,
        'PENDING',
        'Formula-based quote provider.',
        FO_CONFIG.PLATFORM_VERSION,
        FO_CONFIG.BASELINE
      ]);
    });

    if (rows.length > 0) {
      marketSheet.getRange(2, 1, rows.length, 10).setValues(rows);

      for (let i = 0; i < rows.length; i++) {
        const formulaRow = i + 2;
        const symbol = rows[i][2];

        marketSheet
          .getRange(formulaRow, 5)
          .setFormula('=IFERROR(GOOGLEFINANCE("' + symbol + '","price"),"")');
      }
    }

    SpreadsheetApp.flush();
    Utilities.sleep(2500);

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

function foExtractPortfolioTickers_(values, headers) {
  const tickerIndex = headers.indexOf('Ticker');
  const quantityIndex = headers.indexOf('Quantity');
  const accountIndex = headers.indexOf('Account');

  if (tickerIndex < 0) {
    throw new Error('Ticker column not found in Portfolio Master.');
  }

  const seen = {};
  const tickers = [];

  for (let r = 1; r < values.length; r++) {
    const ticker = String(values[r][tickerIndex] || '').trim().toUpperCase();
    if (!ticker) continue;

    const quantity =
      quantityIndex >= 0
        ? Number(values[r][quantityIndex] || 0)
        : 0;

    const account =
      accountIndex >= 0
        ? String(values[r][accountIndex] || '').trim().toUpperCase()
        : '';

    if (
      account === 'REFERENCE' ||
      account === 'LIBRARY' ||
      account === 'WATCHLIST' ||
      account === 'WATCH LIST' ||
      account === 'TEMPLATE'
    ) {
      continue;
    }

    if (!seen[ticker]) {
      seen[ticker] = true;
      tickers.push(ticker);
    }
  }

  return tickers;
}

function foMapGoogleFinanceSymbol_(ticker) {
  const t = String(ticker || '').trim().toUpperCase();

  const map = {
    QQC: 'TSE:QQC',
    QNC: 'TSE:QNC',
    BNS: 'TSE:BNS',
    TD: 'TSE:TD',
    ABX: 'TSE:ABX',
    ONE: 'TSE:ONE',
    QBTS: 'NYSE:QBTS',
    RGTI: 'NASDAQ:RGTI',
    MU: 'NASDAQ:MU',
    AVGO: 'NASDAQ:AVGO',
    QCOM: 'NASDAQ:QCOM',
    NVDA: 'NASDAQ:NVDA',
    META: 'NASDAQ:META',
    PLTR: 'NASDAQ:PLTR'
  };

  return map[t] || t;
}

function foInferMarketCurrency_(ticker) {
  const t = String(ticker || '').trim().toUpperCase();

  if (['QBTS', 'RGTI', 'MU', 'AVGO', 'QCOM', 'NVDA', 'META', 'PLTR'].indexOf(t) >= 0) {
    return 'USD';
  }

  return 'CAD';
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

    const result = foRunMarketDataRefresh();

    foInfo_(module, 'Complete', 'Market Data smoke test completed.');

    return result;

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}