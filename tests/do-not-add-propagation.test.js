const fs = require('fs');
const vm = require('vm');

const idsSource = fs.readFileSync(
  'InvestmentDecisionSupportEngine.js',
  'utf8'
);
const a233Source = fs.readFileSync(
  'ExecutiveDecisionIntegrationA233.js',
  'utf8'
);

const context = {
  console
};

vm.createContext(context);

// Apps Script-only globals. Collaborators these tests must not reach are
// stubbed to throw, so an accidental call fails loudly.
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

vm.runInContext(idsSource, context);
vm.runInContext(a233Source, context);

// The live scores carried by QNC/LIRA and QQC/TFSA on production
// 2026-08-19, both blocked by the concentration override. These are the
// exact values that make the allocation-band omission dangerous.
const BLOCKED_POSITION = {
  convictionScore: 61,
  riskScore: 41,
  confidence: 68,
  priceFreshness: 'FRESH',
  recommendation: 'DO NOT ADD'
};

describe('DO NOT ADD propagation into decision support', () => {
  describe('foDecisionAction_ recommendation mapping', () => {
    test("maps a 'DO NOT ADD' recommendation to a 'DO NOT ADD' action", () => {
      expect(context.foDecisionAction_(BLOCKED_POSITION)).toBe('DO NOT ADD');
    });

    test('does NOT fall through to the WATCH default', () => {
      // Before this fix the whitelist had no DO NOT ADD branch, so the
      // verdict silently became WATCH - not a decision, an omission.
      expect(context.foDecisionAction_(BLOCKED_POSITION)).not.toBe('WATCH');
    });

    test('stale prices still take precedence over the recommendation', () => {
      const stale = Object.assign({}, BLOCKED_POSITION, {
        priceFreshness: 'STALE'
      });
      expect(context.foDecisionAction_(stale)).toBe('REFRESH DATA');
    });

    test('every other recommendation still maps as before', () => {
      const fresh = function(rec) {
        return Object.assign({}, BLOCKED_POSITION, { recommendation: rec });
      };
      expect(context.foDecisionAction_(fresh('STRONG BUY'))).toBe('DEPLOY NOW');
      expect(context.foDecisionAction_(fresh('BUY'))).toBe('BUY');
      expect(context.foDecisionAction_(fresh('ACCUMULATE'))).toBe('ACCUMULATE');
      expect(context.foDecisionAction_(fresh('AVOID'))).toBe('AVOID');
      expect(context.foDecisionAction_(fresh('HOLD'))).toBe('HOLD');
    });

    test('an unrecognised recommendation still defaults to WATCH', () => {
      const unknown = Object.assign({}, BLOCKED_POSITION, {
        recommendation: 'SOMETHING NEW'
      });
      expect(context.foDecisionAction_(unknown)).toBe('WATCH');
    });
  });

  describe('foDecisionAllocationBand_ zero-allocation group', () => {
    test('a DO NOT ADD action allocates 0%', () => {
      expect(
        context.foDecisionAllocationBand_(BLOCKED_POSITION, 'DO NOT ADD')
      ).toBe('0%');
    });

    test('a DO NOT ADD action NEVER allocates 1-2%', () => {
      // THE load-bearing assertion. With the action fix but without the
      // allocation fix, these exact scores fall through every guard -
      // risk 41 is not > 50, confidence 68 is not < 60, and both the
      // 3-5% and 2-4% gates fail - landing on the terminal '1-2%'. That
      // would actively allocate capital to a position the platform just
      // blocked for concentration: strictly worse than the original bug.
      expect(
        context.foDecisionAllocationBand_(BLOCKED_POSITION, 'DO NOT ADD')
      ).not.toBe('1-2%');
    });

    test('the danger is real: these scores DO reach 1-2% under a deployment action', () => {
      // Confirms the previous assertion is not vacuous - the same scores
      // genuinely produce 1-2% when the action is not in the zero group.
      expect(
        context.foDecisionAllocationBand_(BLOCKED_POSITION, 'ACCUMULATE')
      ).toBe('1-2%');
    });

    test('the whole zero-allocation group still returns 0%', () => {
      ['REFRESH DATA', 'WATCH', 'HOLD', 'AVOID', 'DO NOT ADD'].forEach(
        function(action) {
          expect(
            context.foDecisionAllocationBand_(BLOCKED_POSITION, action)
          ).toBe('0%');
        }
      );
    });

    test('score-based bands are unchanged for deployment actions', () => {
      const strong = { convictionScore: 95, riskScore: 20, confidence: 80 };
      const good = { convictionScore: 85, riskScore: 30, confidence: 80 };
      const weak = { convictionScore: 61, riskScore: 60, confidence: 80 };

      expect(context.foDecisionAllocationBand_(strong, 'BUY')).toBe('3-5%');
      expect(context.foDecisionAllocationBand_(good, 'BUY')).toBe('2-4%');
      expect(context.foDecisionAllocationBand_(weak, 'BUY')).toBe('0-1%');
    });

    test('end to end: a blocked position derives 0% from its recommendation alone', () => {
      const action = context.foDecisionAction_(BLOCKED_POSITION);
      expect(action).toBe('DO NOT ADD');
      expect(
        context.foDecisionAllocationBand_(BLOCKED_POSITION, action)
      ).toBe('0%');
    });
  });

  describe('deployment filters exclude DO NOT ADD - intentional, not an oversight', () => {
    // These assertions pin the CURRENT, CORRECT exclusion. A blocked
    // position must never be counted as a deployment card, so a future
    // "symmetry fix" adding DO NOT ADD to either list should fail here
    // and be reconsidered deliberately rather than slipping through.

    test('foDecisionIsDeployableAction_ excludes DO NOT ADD', () => {
      expect(context.foDecisionIsDeployableAction_('DO NOT ADD')).toBe(false);
    });

    test('foDecisionIsDeployableAction_ includes only DEPLOY NOW, BUY, ACCUMULATE', () => {
      expect(context.foDecisionIsDeployableAction_('DEPLOY NOW')).toBe(true);
      expect(context.foDecisionIsDeployableAction_('BUY')).toBe(true);
      expect(context.foDecisionIsDeployableAction_('ACCUMULATE')).toBe(true);

      ['WATCH', 'HOLD', 'AVOID', 'REFRESH DATA', 'DO NOT ADD'].forEach(
        function(action) {
          expect(context.foDecisionIsDeployableAction_(action)).toBe(false);
        }
      );
    });

    test('foA233IsDeploymentAction_ excludes DO NOT ADD', () => {
      expect(context.foA233IsDeploymentAction_('DO NOT ADD')).toBe(false);
    });

    test('foA233IsDeploymentAction_ still recognises its deployment vocabulary', () => {
      [
        'BUY', 'BUY / ADD', 'ACCUMULATE', 'ACCUMULATE ON WEAKNESS',
        'DEPLOY', 'DEPLOY CAPITAL', 'DEPLOY CAPITAL WITH LIMITS',
        'SELECTIVE ACCUMULATION'
      ].forEach(function(action) {
        expect(context.foA233IsDeploymentAction_(action)).toBe(true);
      });
    });

    test('foA233IsDeploymentAction_ excludes every non-deployment verdict', () => {
      ['WATCH', 'HOLD', 'AVOID', 'REFRESH DATA', 'DO NOT ADD'].forEach(
        function(action) {
          expect(context.foA233IsDeploymentAction_(action)).toBe(false);
        }
      );
    });

    test('a blocked position cannot become a deployment card', () => {
      const action = context.foDecisionAction_(BLOCKED_POSITION);
      expect(context.foDecisionIsDeployableAction_(action)).toBe(false);
      expect(context.foA233IsDeploymentAction_(action)).toBe(false);
    });
  });
});
