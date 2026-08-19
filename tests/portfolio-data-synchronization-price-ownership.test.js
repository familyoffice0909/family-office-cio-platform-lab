const fs = require('fs');
const vm = require('vm');

const utilitiesSource = fs.readFileSync('Utilities.js', 'utf8');
const syncSource = fs.readFileSync(
  'PortfolioDataSynchronizationService.js',
  'utf8'
);

const context = {
  console
};

vm.createContext(context);

// Apps Script-only globals. Collaborators that these tests must never
// reach are stubbed to throw, so an accidental call fails loudly rather
// than passing silently.
vm.runInContext(
  `
  const FO_CONFIG = { PLATFORM_VERSION: 'test', BASELINE: 'test' };
  const FO_SHEETS = {};
  function foEnsureSheet_() {
    throw new Error('foEnsureSheet_ is not exercised by these tests.');
  }
  function foDashboard_() {
    throw new Error('foDashboard_ is not exercised by these tests.');
  }
  function foInfo_() {}
  function foError_() {}
  `,
  context
);

vm.runInContext(utilitiesSource, context);
vm.runInContext(syncSource, context);

// --- fixture helpers -------------------------------------------------

const MASTER_HEADERS = [
  'Ticker', 'Account', 'Quantity', 'Cost Basis',
  'Current Price', 'Market Value', 'Price Timestamp', 'Price Source',
  'Company', 'Sector', 'Market Value Basis'
];

const LIVE_PRICE = 21.20;          // what refresh last wrote
const STALE_SOURCE_PRICE = 22.45000075; // static IBKR snapshot
const STALE_SOURCE_MV = 1066.38;   // 47.5 x 22.45, also stale
const QUANTITY = 47.5;
const COST_BASIS = 1139.073304;

function sourceSheet(values) {
  return {
    getDataRange: function() {
      return { getValues: function() { return values; } };
    }
  };
}

function dashboardWith(values, sheetName) {
  return {
    getSheetByName: function(name) {
      if (name !== (sheetName || 'Interactive Brokers')) return null;
      return sourceSheet(values);
    }
  };
}

const SOURCE = {
  sheetName: 'Interactive Brokers',
  account: 'Interactive Brokers',
  required: false
};

// Existing Portfolio Master row as refresh left it: live price present,
// plus a decoy Market Value that must not be carried through.
function enrichmentWithLivePrice(extra) {
  const row = [
    'QBTS', 'Interactive Brokers', QUANTITY, COST_BASIS,
    LIVE_PRICE, 999999, 'TS_FROM_REFRESH', 'Interactive Brokers',
    'D-Wave', 'Technology', ''
  ];
  const merged = extra ? row.slice(0, extra.length) : row;
  return {
    byAccountTicker: { 'INTERACTIVE BROKERS|QBTS': (extra || row).slice() },
    byTicker: { QBTS: (extra || merged).slice() }
  };
}

const EMPTY_ENRICHMENT = { byAccountTicker: {}, byTicker: {} };

const SOURCE_HEADERS = [
  'Ticker', 'Quantity', 'Cost Basis', 'Current Price', 'Market Value',
  'Company', 'Sector'
];

const SOURCE_VALUES = [
  SOURCE_HEADERS,
  ['QBTS', QUANTITY, COST_BASIS, STALE_SOURCE_PRICE, STALE_SOURCE_MV,
    'D-Wave Quantum', 'Quantum Computing']
];

function readSource(values, enrichment) {
  return context.foReadPortfolioHoldingsSource_(
    dashboardWith(values || SOURCE_VALUES),
    SOURCE,
    MASTER_HEADERS,
    enrichment || enrichmentWithLivePrice()
  );
}

function firstRow(result) {
  const record = result.records[0];
  const row = record ? record.row : [];
  const get = function(header) {
    return row[MASTER_HEADERS.indexOf(header)];
  };
  return { record: record, row: row, get: get };
}

// --- tests -----------------------------------------------------------

describe('Portfolio data synchronization: price and valuation ownership', () => {
  describe('price ownership (f00188b)', () => {
    test('preserves the live Current Price from enrichment', () => {
      const out = firstRow(readSource());
      expect(out.get('Current Price')).toBe(LIVE_PRICE);
    });

    test('does NOT adopt the stale Current Price from the source tab', () => {
      const out = firstRow(readSource());
      expect(out.get('Current Price')).not.toBe(STALE_SOURCE_PRICE);
    });

    test('the stale source price is genuinely present in the fixture', () => {
      // Guards against the negative assertion above passing merely because
      // the source column is absent or empty.
      const priceIndex = SOURCE_HEADERS.indexOf('Current Price');
      expect(SOURCE_VALUES[1][priceIndex]).toBe(STALE_SOURCE_PRICE);
      expect(SOURCE_VALUES[1][priceIndex]).toBeGreaterThan(0);
    });

    test('a brand-new position (no enrichment) gets no price from source', () => {
      const out = firstRow(readSource(SOURCE_VALUES, EMPTY_ENRICHMENT));
      // Sync is not a price source: a new row starts blank until refresh.
      expect(out.get('Current Price')).toBe('');
    });
  });

  describe('market value recompute (303ae21)', () => {
    test('Market Value equals Quantity x the preserved live price', () => {
      const out = firstRow(readSource());
      expect(out.get('Market Value')).toBeCloseTo(QUANTITY * LIVE_PRICE, 6);
    });

    test('does NOT adopt the stale Market Value from the source tab', () => {
      const out = firstRow(readSource());
      expect(out.get('Market Value')).not.toBe(STALE_SOURCE_MV);
    });

    test('the stale source Market Value is genuinely present in the fixture', () => {
      const mvIndex = SOURCE_HEADERS.indexOf('Market Value');
      expect(SOURCE_VALUES[1][mvIndex]).toBe(STALE_SOURCE_MV);
      expect(SOURCE_VALUES[1][mvIndex]).toBeGreaterThan(0);
    });

    test('does NOT carry forward the enrichment decoy Market Value', () => {
      // The enrichment row carries 999999; a carry-forward result would
      // be indistinguishable from a correct one without this assertion.
      const out = firstRow(readSource());
      expect(out.get('Market Value')).not.toBe(999999);
    });

    test('Market Value is internally consistent with the emitted row', () => {
      const out = firstRow(readSource());
      const qty = out.get('Quantity');
      const price = out.get('Current Price');
      expect(out.get('Market Value')).toBeCloseTo(qty * price, 6);
    });

    test('a new position with no price yields no computed market value', () => {
      const out = firstRow(readSource(SOURCE_VALUES, EMPTY_ENRICHMENT));
      // quantity > 0 but price is blank, so the guard skips the write.
      expect(out.get('Current Price')).toBe('');
      expect(out.get('Market Value')).not.toBe(STALE_SOURCE_MV);
    });
  });

  describe('enrichment carry-forward and new positions', () => {
    test('quantity and cost basis always come from the source', () => {
      const out = firstRow(readSource());
      expect(out.get('Quantity')).toBe(QUANTITY);
      expect(out.get('Cost Basis')).toBe(COST_BASIS);
    });

    test('non-price fields are still alias-copied from the source', () => {
      // Proves only the price alias was removed, not the mechanism.
      const out = firstRow(readSource());
      expect(out.get('Company')).toBe('D-Wave Quantum');
      expect(out.get('Sector')).toBe('Quantum Computing');
    });

    test('a new position starts from source values, inheriting nothing', () => {
      const out = firstRow(readSource(SOURCE_VALUES, EMPTY_ENRICHMENT));
      expect(out.get('Ticker')).toBe('QBTS');
      expect(out.get('Quantity')).toBe(QUANTITY);
      expect(out.get('Current Price')).toBe('');
      expect(out.get('Price Timestamp')).not.toBe('TS_FROM_REFRESH');
    });

    test('enrichment falls back from account-scoped key to ticker-only key', () => {
      const tickerOnly = {
        byAccountTicker: {},
        byTicker: {
          QBTS: [
            'QBTS', 'Interactive Brokers', QUANTITY, COST_BASIS,
            LIVE_PRICE, 0, 'TS', 'IBKR', '', '', ''
          ]
        }
      };
      const out = firstRow(readSource(SOURCE_VALUES, tickerOnly));
      expect(out.get('Current Price')).toBe(LIVE_PRICE);
    });

    test('a position present only in enrichment is absent from the output', () => {
      // The loop iterates source rows only. Because the caller performs a
      // full replace of Portfolio Master, such a position is dropped
      // rather than carried forward. Pinning this so the behaviour is
      // explicit rather than assumed.
      const enrichment = {
        byAccountTicker: {
          'INTERACTIVE BROKERS|QBTS': [
            'QBTS', 'Interactive Brokers', QUANTITY, COST_BASIS,
            LIVE_PRICE, 0, '', '', '', '', ''
          ],
          'INTERACTIVE BROKERS|GHOST': [
            'GHOST', 'Interactive Brokers', 10, 100,
            5, 50, '', '', '', '', ''
          ]
        },
        byTicker: {}
      };
      const result = readSource(SOURCE_VALUES, enrichment);
      const tickers = result.records.map(function(r) { return r.ticker; });

      expect(tickers).toContain('QBTS');
      expect(tickers).not.toContain('GHOST');
      expect(result.records.length).toBe(1);
    });
  });

  describe('fail-closed behaviour on required columns', () => {
    test('a missing Ticker column throws', () => {
      const values = [
        ['Quantity', 'Cost Basis', 'Current Price'],
        [QUANTITY, COST_BASIS, STALE_SOURCE_PRICE]
      ];
      expect(function() {
        readSource(values);
      }).toThrow(/ticker, quantity and cost-basis columns/);
    });

    test('a missing Quantity column throws', () => {
      const values = [
        ['Ticker', 'Cost Basis', 'Current Price'],
        ['QBTS', COST_BASIS, STALE_SOURCE_PRICE]
      ];
      expect(function() {
        readSource(values);
      }).toThrow(/ticker, quantity and cost-basis columns/);
    });

    test('a missing Cost Basis column throws', () => {
      const values = [
        ['Ticker', 'Quantity', 'Current Price'],
        ['QBTS', QUANTITY, STALE_SOURCE_PRICE]
      ];
      expect(function() {
        readSource(values);
      }).toThrow(/ticker, quantity and cost-basis columns/);
    });

    test('accepted header aliases do not throw', () => {
      const values = [
        ['Symbol', 'Shares', 'Book Value', 'Current Price'],
        ['QBTS', QUANTITY, COST_BASIS, STALE_SOURCE_PRICE]
      ];
      expect(function() {
        readSource(values);
      }).not.toThrow();
    });

    test('a row with a blank ticker is skipped, not thrown', () => {
      // Row-level gaps are skipped; only missing COLUMNS fail closed.
      const values = [
        SOURCE_HEADERS,
        ['', QUANTITY, COST_BASIS, STALE_SOURCE_PRICE, STALE_SOURCE_MV, '', '']
      ];
      const result = readSource(values);
      expect(result.records.length).toBe(0);
    });

    test('a row with zero quantity is skipped, not thrown', () => {
      const values = [
        SOURCE_HEADERS,
        ['QBTS', 0, COST_BASIS, STALE_SOURCE_PRICE, STALE_SOURCE_MV, '', '']
      ];
      const result = readSource(values);
      expect(result.records.length).toBe(0);
    });

    test('a missing source sheet reports rather than throws', () => {
      const result = context.foReadPortfolioHoldingsSource_(
        { getSheetByName: function() { return null; } },
        SOURCE,
        MASTER_HEADERS,
        EMPTY_ENRICHMENT
      );
      expect(result.records.length).toBe(0);
      expect(result.summary.status).toBe('NOT FOUND');
    });

    test('a required missing source is flagged as such in the summary', () => {
      const result = context.foReadPortfolioHoldingsSource_(
        { getSheetByName: function() { return null; } },
        { sheetName: 'Interactive Brokers', account: 'Interactive Brokers', required: true },
        MASTER_HEADERS,
        EMPTY_ENRICHMENT
      );
      expect(result.summary.status).toBe('REQUIRED SOURCE NOT FOUND');
      expect(result.summary.required).toBe(true);
    });
  });

  describe('summary reporting', () => {
    test('reports read status and aggregate totals', () => {
      const result = readSource();
      expect(result.summary.status).toBe('READ');
      expect(result.summary.activeRows).toBe(1);
      expect(result.summary.quantity).toBe(QUANTITY);
      expect(result.summary.costBasis).toBeCloseTo(COST_BASIS, 6);
    });
  });
});
