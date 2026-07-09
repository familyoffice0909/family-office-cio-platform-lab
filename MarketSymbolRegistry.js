/************************************************************
 * MarketSymbolRegistry.gs
 * Wave 2.1 — Market Symbol Registry
 ************************************************************/

const FO_MARKET_SYMBOLS = {
  QQC:  { providerSymbol: 'TSE:QQC', exchange: 'TSX', currency: 'CAD', status: 'ACTIVE' },
  QNC:  { providerSymbol: 'TSE:QNC', exchange: 'TSX', currency: 'CAD', status: 'ACTIVE' },
  BNS:  { providerSymbol: 'TSE:BNS', exchange: 'TSX', currency: 'CAD', status: 'ACTIVE' },
  TD:   { providerSymbol: 'TSE:TD',  exchange: 'TSX', currency: 'CAD', status: 'ACTIVE' },
  ABX:  { providerSymbol: 'TSE:ABX', exchange: 'TSX', currency: 'CAD', status: 'ACTIVE' },
  ONE:  { providerSymbol: 'TSE:ONE', exchange: 'TSX', currency: 'CAD', status: 'ACTIVE' },

  QBTS: { providerSymbol: 'NYSE:QBTS', currency: 'USD', exchange: 'NYSE', status: 'ACTIVE' },
  RGTI: { providerSymbol: 'NASDAQ:RGTI', currency: 'USD', exchange: 'NASDAQ', status: 'ACTIVE' },
  MU:   { providerSymbol: 'NASDAQ:MU', currency: 'USD', exchange: 'NASDAQ', status: 'ACTIVE' },
  AVGO: { providerSymbol: 'NASDAQ:AVGO', currency: 'USD', exchange: 'NASDAQ', status: 'ACTIVE' },
  QCOM: { providerSymbol: 'NASDAQ:QCOM', currency: 'USD', exchange: 'NASDAQ', status: 'ACTIVE' },
  NVDA: { providerSymbol: 'NASDAQ:NVDA', currency: 'USD', exchange: 'NASDAQ', status: 'ACTIVE' },
  META: { providerSymbol: 'NASDAQ:META', currency: 'USD', exchange: 'NASDAQ', status: 'ACTIVE' },
  PLTR: { providerSymbol: 'NASDAQ:PLTR', currency: 'USD', exchange: 'NASDAQ', status: 'ACTIVE' }
};

function foResolveMarketSymbol_(ticker) {
  const cleanTicker = String(ticker || '').trim().toUpperCase();

  if (!cleanTicker) {
    return {
      ticker: '',
      providerSymbol: '',
      currency: '',
      exchange: '',
      status: 'INVALID',
      notes: 'Ticker is blank.'
    };
  }

  if (FO_MARKET_SYMBOLS[cleanTicker]) {
    return {
      ticker: cleanTicker,
      providerSymbol: FO_MARKET_SYMBOLS[cleanTicker].providerSymbol,
      currency: FO_MARKET_SYMBOLS[cleanTicker].currency,
      exchange: FO_MARKET_SYMBOLS[cleanTicker].exchange,
      status: FO_MARKET_SYMBOLS[cleanTicker].status,
      notes: 'Resolved from Market Symbol Registry.'
    };
  }

  return {
    ticker: cleanTicker,
    providerSymbol: '',
    currency: '',
    exchange: '',
    status: 'UNREGISTERED',
    notes: 'Ticker not registered. Skipped by market data engine.'
  };
}

function foSeedMarketSymbolRegistry() {
  const module = 'MarketSymbolRegistry';

  try {
    foInfo_(module, 'Start', 'Seeding Market Symbol Registry.');

    const dashboard = foDashboard_();

    const sheet = foEnsureSheet_(dashboard, 'Market Symbol Registry', [
      'Ticker',
      'Provider Symbol',
      'Exchange',
      'Currency',
      'Status',
      'Notes',
      'Platform Version',
      'Baseline'
    ]);

    sheet.clearContents();

    sheet.getRange(1, 1, 1, 8).setValues([[
      'Ticker',
      'Provider Symbol',
      'Exchange',
      'Currency',
      'Status',
      'Notes',
      'Platform Version',
      'Baseline'
    ]]);

    const rows = Object.keys(FO_MARKET_SYMBOLS).sort().map(function(ticker) {
      const item = FO_MARKET_SYMBOLS[ticker];

      return [
        ticker,
        item.providerSymbol,
        item.exchange,
        item.currency,
        item.status,
        'Seeded from code registry.',
        FO_CONFIG.PLATFORM_VERSION,
        FO_CONFIG.BASELINE
      ];
    });

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 8).setValues(rows);
    }

    foInfo_(module, 'Complete', 'Market Symbol Registry seeded. Symbols: ' + rows.length);

    return {
      status: 'SUCCESS',
      symbolsSeeded: rows.length
    };

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}