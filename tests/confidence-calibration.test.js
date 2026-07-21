const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(
  'ConfidenceCalibrationService.js',
  'utf8'
);

const context = {
  console
};

vm.createContext(context);

vm.runInContext(
  `
  function foDecisionKey_(ticker, account) {
    return (
      String(ticker || '').trim().toUpperCase() +
      '|' +
      String(account || '').trim().toUpperCase()
    );
  }
  `,
  context
);

vm.runInContext(source, context);

describe('Confidence Calibration Service', () => {
  test('assigns confidence bands correctly', () => {
    expect(context.foConfidenceCalibrationBand_(95)).toBe('90-100');
    expect(context.foConfidenceCalibrationBand_(85)).toBe('80-89');
    expect(context.foConfidenceCalibrationBand_(75)).toBe('70-79');
    expect(context.foConfidenceCalibrationBand_(65)).toBe('60-69');
    expect(context.foConfidenceCalibrationBand_(45)).toBe('0-59');
  });

  test('recognizes a preserved positive recommendation', () => {
    const result =
      context.foConfidenceCalibrationProxyOutcome_(
        {
          confidence: 80,
          recommendation: 'BUY',
          action: 'BUY'
        },
        {
          confidence: 72,
          recommendation: 'BUY',
          action: 'BUY'
        }
      );

    expect(result).toBe(1);
  });

  test('recognizes a materially invalidated recommendation', () => {
    const result =
      context.foConfidenceCalibrationProxyOutcome_(
        {
          confidence: 80,
          recommendation: 'BUY',
          action: 'BUY'
        },
        {
          confidence: 50,
          recommendation: 'AVOID',
          action: 'AVOID'
        }
      );

    expect(result).toBe(0);
  });

  test('reports insufficient data without claiming a score', () => {
    const result =
      context.foAssessConfidenceCalibration_(
        {
          ticker: 'TEST',
          account: 'TFSA',
          confidence: 80
        },
        {
          byBand: {},
          byKeyAndBand: {}
        }
      );

    expect(result.status).toBe('INSUFFICIENT DATA');
    expect(result.score).toBe('');
    expect(result.sampleSize).toBe(0);
  });
});
