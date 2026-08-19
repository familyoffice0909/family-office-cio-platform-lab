const fs = require('fs');
const vm = require('vm');

const utilitiesSource = fs.readFileSync('Utilities.js', 'utf8');
const convictionSource = fs.readFileSync('ConvictionScoringEngine.js', 'utf8');
const buyZoneSource = fs.readFileSync('BuyZoneIntelligenceEngine.js', 'utf8');

const context = {
  console
};

vm.createContext(context);

// Apps Script-only globals and collaborators that these functions never
// reach. Any accidental call throws loudly rather than passing silently.
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
  function foWriteBuyZoneExecutiveDashboard_() {
    throw new Error('foWriteBuyZoneExecutiveDashboard_ is not exercised here.');
  }
  function foRunInvestmentDecisionSupportFromResults_() {
    throw new Error('foRunInvestmentDecisionSupportFromResults_ is not exercised here.');
  }
  `,
  context
);

vm.runInContext(utilitiesSource, context);
vm.runInContext(convictionSource, context);
vm.runInContext(buyZoneSource, context);

// Defaults as foDetermineDynamicRecommendation_ resolves them when the
// corresponding rule is absent.
const NO_RULES = {};
const FRESH = 'FRESH';

describe('Buy Zone recommendation ladder and weight computation', () => {
  describe('foDetermineDynamicRecommendation_ threshold ladder', () => {
    test('MISSING price freshness hard-gates to HOLD regardless of scores', () => {
      // Even a perfect score cannot escape the MISSING gate.
      expect(
        context.foDetermineDynamicRecommendation_(100, 0, 'MISSING', NO_RULES)
      ).toBe('HOLD');
    });

    test('STALE freshness does NOT hard-gate the ladder', () => {
      // Documents that the live path has no STALE branch - staleness acts
      // through the score inputs, not as a short-circuit here.
      expect(
        context.foDetermineDynamicRecommendation_(95, 20, 'STALE', NO_RULES)
      ).toBe('STRONG BUY');
    });

    describe('AVOID gate (conviction <= 30 AND risk >= 80)', () => {
      test('just inside both bounds returns AVOID', () => {
        expect(
          context.foDetermineDynamicRecommendation_(30, 80, FRESH, NO_RULES)
        ).toBe('AVOID');
      });

      test('conviction one point above the gate does not return AVOID', () => {
        expect(
          context.foDetermineDynamicRecommendation_(31, 80, FRESH, NO_RULES)
        ).not.toBe('AVOID');
      });

      test('risk one point below the gate does not return AVOID', () => {
        expect(
          context.foDetermineDynamicRecommendation_(30, 79, FRESH, NO_RULES)
        ).not.toBe('AVOID');
      });
    });

    describe('STRONG BUY gate (conviction >= 90 AND risk <= 25)', () => {
      test('just inside both bounds returns STRONG BUY', () => {
        expect(
          context.foDetermineDynamicRecommendation_(90, 25, FRESH, NO_RULES)
        ).toBe('STRONG BUY');
      });

      test('conviction one point below the gate falls through', () => {
        expect(
          context.foDetermineDynamicRecommendation_(89, 25, FRESH, NO_RULES)
        ).not.toBe('STRONG BUY');
      });

      test('risk one point above the gate falls through', () => {
        expect(
          context.foDetermineDynamicRecommendation_(90, 26, FRESH, NO_RULES)
        ).not.toBe('STRONG BUY');
      });
    });

    describe('BUY gate (conviction >= 80 AND risk <= 35)', () => {
      test('just inside both bounds returns BUY', () => {
        expect(
          context.foDetermineDynamicRecommendation_(80, 35, FRESH, NO_RULES)
        ).toBe('BUY');
      });

      test('conviction one point below the gate does not return BUY', () => {
        expect(
          context.foDetermineDynamicRecommendation_(79, 35, FRESH, NO_RULES)
        ).not.toBe('BUY');
      });

      test('risk one point above the gate does not return BUY', () => {
        expect(
          context.foDetermineDynamicRecommendation_(80, 36, FRESH, NO_RULES)
        ).not.toBe('BUY');
      });
    });

    describe('ACCUMULATE gate (conviction >= 65 AND risk <= 50)', () => {
      // The ABX case observed live: conviction 64 missed ACCUMULATE by
      // exactly one point. This pins that boundary permanently.
      test('conviction 64 does NOT return ACCUMULATE (live ABX case)', () => {
        expect(
          context.foDetermineDynamicRecommendation_(64, 33, FRESH, NO_RULES)
        ).not.toBe('ACCUMULATE');
      });

      test('conviction 65 at the same risk DOES return ACCUMULATE', () => {
        expect(
          context.foDetermineDynamicRecommendation_(65, 33, FRESH, NO_RULES)
        ).toBe('ACCUMULATE');
      });

      test('conviction 64 falls through to WATCH, not HOLD', () => {
        expect(
          context.foDetermineDynamicRecommendation_(64, 33, FRESH, NO_RULES)
        ).toBe('WATCH');
      });

      test('risk one point above the gate does not return ACCUMULATE', () => {
        expect(
          context.foDetermineDynamicRecommendation_(65, 51, FRESH, NO_RULES)
        ).not.toBe('ACCUMULATE');
      });

      test('risk exactly at the gate returns ACCUMULATE', () => {
        expect(
          context.foDetermineDynamicRecommendation_(65, 50, FRESH, NO_RULES)
        ).toBe('ACCUMULATE');
      });
    });

    describe('WATCH / HOLD floor (conviction >= 45)', () => {
      test('conviction exactly at the floor returns WATCH', () => {
        expect(
          context.foDetermineDynamicRecommendation_(45, 60, FRESH, NO_RULES)
        ).toBe('WATCH');
      });

      test('conviction one point below the floor returns HOLD', () => {
        expect(
          context.foDetermineDynamicRecommendation_(44, 60, FRESH, NO_RULES)
        ).toBe('HOLD');
      });
    });

    test('rules overrides are honoured over the defaults', () => {
      // Raising the ACCUMULATE bar to 70 must demote a 65 that would
      // otherwise qualify under the default.
      expect(
        context.foDetermineDynamicRecommendation_(
          65, 33, FRESH, { ACCUMULATE_MIN_CONVICTION: 70 }
        )
      ).toBe('WATCH');
    });

    test('the ladder is ordered - a score qualifying for several rungs takes the strongest', () => {
      // 95/20 satisfies STRONG BUY, BUY and ACCUMULATE simultaneously.
      expect(
        context.foDetermineDynamicRecommendation_(95, 20, FRESH, NO_RULES)
      ).toBe('STRONG BUY');
    });
  });

  describe('foBuildBuyZoneResults_ portfolio weight computation (dcd093e)', () => {
    const headers = [
      'Ticker', 'Account', 'Quantity', 'Current Price', 'Market Value',
      'Price Timestamp', 'Target Entry Price'
    ];

    // Market values chosen so the expected percentages are exact:
    // 5000 / 3000 / 2000 of a 10000 total => 50% / 30% / 20%.
    const values = [
      headers,
      ['AAA', 'TFSA', 100, 50, 5000, new Date(), 45],
      ['BBB', 'TFSA', 100, 30, 3000, new Date(), 27],
      ['CCC', 'LIRA', 100, 20, 2000, new Date(), 18]
    ];

    const rules = { STALE_PRICE_HOURS: 24, MAX_POSITION_WEIGHT: 0.15 };

    function build() {
      return context.foBuildBuyZoneResults_(values, headers, rules, {}, {});
    }

    test('returns one result per position', () => {
      expect(build().length).toBe(3);
    });

    test('weights match hand-computed percentages', () => {
      const results = build();
      const byTicker = {};
      results.forEach(function(r) { byTicker[r.ticker] = r; });

      expect(byTicker.AAA.portfolioWeight).toBeCloseTo(50, 6);
      expect(byTicker.BBB.portfolioWeight).toBeCloseTo(30, 6);
      expect(byTicker.CCC.portfolioWeight).toBeCloseTo(20, 6);
    });

    test('weights sum to 100%', () => {
      const total = build().reduce(function(sum, r) {
        return sum + r.portfolioWeight;
      }, 0);

      expect(total).toBeCloseTo(100, 6);
    });

    test('weights are percentages (0-100), not fractions (0-1)', () => {
      // The units contract the whole concentration chain depends on.
      const results = build();
      results.forEach(function(r) {
        expect(r.portfolioWeight).toBeGreaterThan(1);
      });
    });

    test('no weight is zero when market values are present', () => {
      // Regression for dcd093e: reading a nonexistent Portfolio Master
      // column returned '' and yielded 0 for every position.
      build().forEach(function(r) {
        expect(r.portfolioWeight).toBeGreaterThan(0);
      });
    });

    test('weight is derived from Market Value, not from a source column', () => {
      // A row whose Market Value doubles must take a larger share, even
      // though no 'Portfolio Weight' column exists in the input at all.
      expect(headers).not.toContain('Portfolio Weight');

      const doubled = [
        headers,
        ['AAA', 'TFSA', 100, 50, 8000, new Date(), 45],
        ['BBB', 'TFSA', 100, 30, 2000, new Date(), 27]
      ];
      const results = context.foBuildBuyZoneResults_(
        doubled, headers, rules, {}, {}
      );
      const byTicker = {};
      results.forEach(function(r) { byTicker[r.ticker] = r; });

      expect(byTicker.AAA.portfolioWeight).toBeCloseTo(80, 6);
      expect(byTicker.BBB.portfolioWeight).toBeCloseTo(20, 6);
    });

    test('a zero total market value yields zero weights without dividing by zero', () => {
      const zeroed = [
        headers,
        ['AAA', 'TFSA', 100, 50, 0, new Date(), 45]
      ];
      const results = context.foBuildBuyZoneResults_(
        zeroed, headers, rules, {}, {}
      );

      results.forEach(function(r) {
        expect(r.portfolioWeight).toBe(0);
        expect(Number.isNaN(r.portfolioWeight)).toBe(false);
      });
    });
  });

  describe('foDetermineBuyZoneRecommendation_ dead-code status', () => {
    const source = buyZoneSource;

    test('the function still exists', () => {
      // If this fails, the function was removed. That may be correct -
      // update this describe block deliberately rather than deleting it.
      expect(typeof context.foDetermineBuyZoneRecommendation_)
        .toBe('function');
    });

    test('it is defined exactly once and never called anywhere in this file', () => {
      const definitions =
        (source.match(/function foDetermineBuyZoneRecommendation_\s*\(/g) || []).length;
      const allOccurrences =
        (source.match(/foDetermineBuyZoneRecommendation_/g) || []).length;

      expect(definitions).toBe(1);
      // Definition is the only occurrence => zero call sites.
      expect(allOccurrences).toBe(1);
    });

    test('foBuildBuyZoneResults_ uses the dynamic ladder instead', () => {
      // Bound the slice at the next top-level function so it captures
      // foBuildBuyZoneResults_ only. foDetermineBuyZoneRecommendation_ is
      // defined later in the same file, so a looser boundary would
      // over-capture and make this assertion trivially false.
      const start = source.indexOf('function foBuildBuyZoneResults_');
      const next = source.indexOf('\nfunction ', start + 1);
      const body = source.slice(start, next);

      expect(body).toContain('foDetermineDynamicRecommendation_');
      expect(body).not.toContain('foDetermineBuyZoneRecommendation_');
    });

    test('its concentration guard is therefore unreachable in the live path', () => {
      // MAX_POSITION_WEIGHT appears in the dead function, but the live
      // concentration mechanism is in ConvictionScoringEngine.js. This
      // asserts the fact rather than leaving it implicit.
      const deadBody = source.slice(
        source.indexOf('function foDetermineBuyZoneRecommendation_')
      );

      expect(deadBody).toContain('MAX_POSITION_WEIGHT');
      expect(deadBody).toContain('DO NOT ADD');

      // And the live ladder cannot emit that verdict at all.
      const verdicts = ['AVOID', 'STRONG BUY', 'BUY', 'ACCUMULATE', 'WATCH', 'HOLD'];
      verdicts.forEach(function(v) {
        expect(
          context.foDetermineDynamicRecommendation_(50, 50, FRESH, NO_RULES)
        ).not.toBe('DO NOT ADD');
        expect(verdicts).toContain(v);
      });
    });
  });
});
