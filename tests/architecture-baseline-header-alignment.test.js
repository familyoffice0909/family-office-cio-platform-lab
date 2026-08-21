const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('ArchitectureFreeze.js', 'utf8');

const context = { console };
vm.createContext(context);

// A build identifier that could never plausibly be a hardcoded literal in
// the engine. Every assertion about the Git Commit column keys off this,
// so a value baked in at commit time cannot satisfy them.
const SENTINEL_BUILD = 'SENTINEL-BUILD-DO-NOT-HARDCODE-0001';

// Apps Script-only globals. Collaborators these tests must not reach are
// stubbed to throw, so an accidental call fails loudly rather than
// passing silently.
vm.runInContext(
  `
  const FO_CONFIG = {
    PLATFORM_VERSION: 'v-test-platform',
    BASELINE: 'CB-test',
    BUILD: '${SENTINEL_BUILD}',
    TIMEZONE: 'America/Toronto'
  };
  const FO_SHEETS = {};
  const SpreadsheetApp = {};
  const Session = {
    getScriptTimeZone: function() { return 'America/Toronto'; }
  };
  const Utilities = {
    formatDate: function() { return '20260821-000000'; }
  };
  function foDashboard_() { return __TEST_SS__; }
  function foInfo_() {}
  function foError_() {}
  `,
  context
);

vm.runInContext(source, context);

// Constants in the engine are declared with const, so they live in the
// context's lexical scope rather than on the context object. Read them by
// evaluating the identifier rather than transcribing them into the test -
// a copied array would drift from the engine and defeat the whole point.
const BASELINE_HEADERS = vm.runInContext('FO_A216_BASELINE_HEADERS', context);
const REGISTRY_HEADERS = vm.runInContext('FO_A216_REGISTRY_HEADERS', context);

function registryFixture() {
  function row(component, status, critical) {
    const r = REGISTRY_HEADERS.map(function() { return ''; });
    r[REGISTRY_HEADERS.indexOf('Component')] = component;
    r[REGISTRY_HEADERS.indexOf('Status')] = status;
    r[REGISTRY_HEADERS.indexOf('Production Critical')] = critical;
    return r;
  }
  return [
    REGISTRY_HEADERS.slice(),
    row('Portfolio Master', 'PRODUCTION', 'YES'),
    row('Market Data Cache', 'SUPPORTING', 'NO')
  ];
}

function fakeSpreadsheet() {
  const registry = registryFixture();
  return {
    getName: function() { return 'Test Workbook'; },
    getId: function() { return 'test-spreadsheet-id'; },
    getSpreadsheetTimeZone: function() { return 'America/Toronto'; },
    getSheets: function() { return [{}, {}, {}]; },
    getSheetByName: function(name) {
      if (name === 'Architecture Registry') {
        return {
          getLastRow: function() { return registry.length; },
          getDataRange: function() {
            return { getValues: function() { return registry; } };
          }
        };
      }
      // No certification sheet: foA216LatestCertificationStatus_ returns
      // 'NOT AVAILABLE', which is irrelevant to column alignment.
      return null;
    }
  };
}

// Capture the row the engine actually emits. Nothing here hand-builds a
// row: the assertions below are about what foGenerateProductionBaseline()
// really writes, not about a transcription of it.
let captured = null;
context.foA216EnsureSheet_ = function(ss, name, headers) {
  return { __name: name, __headers: headers };
};
context.foA216AppendRows_ = function(sheet, rows) {
  captured = { sheet: sheet, rows: rows };
};

function generate(buildValue) {
  captured = null;
  if (buildValue !== undefined) {
    context.__TEST_BUILD__ = buildValue;
    vm.runInContext('FO_CONFIG.BUILD = __TEST_BUILD__;', context);
  }
  context.__TEST_SS__ = fakeSpreadsheet();
  const result = context.foGenerateProductionBaseline();
  return { result: result, row: captured.rows[0], sheet: captured.sheet };
}

function resetBuild() {
  context.__TEST_BUILD__ = SENTINEL_BUILD;
  vm.runInContext('FO_CONFIG.BUILD = __TEST_BUILD__;', context);
}

// header name -> emitted value, zipped positionally.
function zip(row) {
  return BASELINE_HEADERS.reduce(function(map, header, i) {
    map[header] = row[i];
    return map;
  }, {});
}

beforeEach(resetBuild);

describe('Production Baseline header/value alignment', () => {
  describe('the two arrays line up', () => {
    test('the emitted row has exactly one value per header', () => {
      // The defect this suite exists for was a positional transposition.
      // A length mismatch is the coarsest form of the same bug class.
      const row = generate().row;
      expect(BASELINE_HEADERS.length).toBe(19);
      expect(row.length).toBe(BASELINE_HEADERS.length);
    });

    test('the sheet is created with the same header array the row is zipped against', () => {
      const sheet = generate().sheet;
      expect(sheet.__name).toBe('Production Baseline');
      expect(sheet.__headers).toEqual(BASELINE_HEADERS);
    });

    test('no emitted cell is undefined', () => {
      const row = generate().row;
      row.forEach(function(value, i) {
        expect(value).toBeDefined();
      });
    });
  });

  describe('position 17 - Git Commit', () => {
    test('header position 17 is Git Commit', () => {
      // Pins the index the remaining assertions depend on, so a header
      // reordering cannot silently change what they are testing.
      expect(BASELINE_HEADERS[16]).toBe('Git Commit');
    });

    test('resolves to the live FO_CONFIG.BUILD value', () => {
      const row = generate().row;
      expect(zip(row)['Git Commit']).toBe(SENTINEL_BUILD);
      expect(row[16]).toBe(SENTINEL_BUILD);
    });

    test('tracks FO_CONFIG.BUILD at execution time rather than being fixed', () => {
      // The governance property: the baseline records whichever build the
      // running Apps Script project actually carries. A hardcoded literal
      // - even one that happens to match today - fails here.
      const first = generate('BUILD-VALUE-ALPHA').row;
      const second = generate('BUILD-VALUE-BETA').row;

      expect(zip(first)['Git Commit']).toBe('BUILD-VALUE-ALPHA');
      expect(zip(second)['Git Commit']).toBe('BUILD-VALUE-BETA');
      expect(zip(first)['Git Commit']).not.toBe(zip(second)['Git Commit']);
    });

    test('is not any of the placeholders that previously occupied the row', () => {
      const gitCommit = zip(generate().row)['Git Commit'];
      expect(gitCommit).not.toBe('PENDING RELEASE');
      expect(gitCommit).not.toBe('v1.0.1-production-certified');
    });
  });

  describe('position 18 - Release Target', () => {
    test('header position 18 is Release Target', () => {
      expect(BASELINE_HEADERS[17]).toBe('Release Target');
    });

    test("is 'PENDING RELEASE'", () => {
      const row = generate().row;
      expect(zip(row)['Release Target']).toBe('PENDING RELEASE');
      expect(row[17]).toBe('PENDING RELEASE');
    });

    test('does not carry the build identifier', () => {
      // Catches a pure transposition of the fixed pair.
      expect(zip(generate().row)['Release Target']).not.toBe(SENTINEL_BUILD);
    });
  });

  describe('the retired v1.0.1 placeholder', () => {
    test('appears in no cell of the emitted row', () => {
      const row = generate().row;
      row.forEach(function(value) {
        expect(String(value)).not.toContain('v1.0.1-production-certified');
      });
    });

    test('appears nowhere in the engine source', () => {
      expect(source).not.toContain('v1.0.1-production-certified');
    });
  });

  describe('INVARIANTS - deliberately unchanged columns', () => {
    test('the neighbouring literal columns are untouched', () => {
      // These bracket the swapped pair. If a future edit shifts the row
      // by one in either direction, these fail alongside the two above,
      // which distinguishes a shift from a targeted change.
      const cells = zip(generate().row);
      expect(cells['Architecture Status'])
        .toBe('FROZEN WITH GOVERNED ADDITIVE CHANGE');
      expect(cells.Notes)
        .toBe('A2.1.6 architecture baseline generated from live workbook.');
    });

    test('the config-sourced columns still read from config', () => {
      const cells = zip(generate().row);
      expect(cells['Platform Version']).toBe('v-test-platform');
      expect(cells.Baseline).toBe('CB-test');
      expect(cells['Architecture Version']).toBe('ARCH-v1.0');
    });

    test('the workbook-sourced columns still read from the spreadsheet', () => {
      const cells = zip(generate().row);
      expect(cells.Workbook).toBe('Test Workbook');
      expect(cells['Spreadsheet ID']).toBe('test-spreadsheet-id');
      expect(cells.Timezone).toBe('America/Toronto');
      expect(cells['Total Worksheets']).toBe(3);
    });

    test('the registry-derived counts still compute', () => {
      const cells = zip(generate().row);
      expect(cells['Production Worksheets']).toBe(1);
      expect(cells['Supporting Worksheets']).toBe(1);
      expect(cells['Legacy Worksheets']).toBe(0);
      expect(cells['Production Critical Worksheets']).toBe(1);
    });

    test('the run identity columns are still populated', () => {
      const generated = generate();
      const cells = zip(generated.row);
      expect(cells['Baseline Run ID']).toBe('ARCH-BASE-20260821-000000');
      // The engine constructs this inside the vm realm, so instanceof
      // against the test realm's Date does not hold. Check the brand.
      expect(Object.prototype.toString.call(cells.Timestamp))
        .toBe('[object Date]');
      expect(generated.result.status).toBe('SUCCESS');
      expect(generated.result.worksheet).toBe('Production Baseline');
    });
  });
});
