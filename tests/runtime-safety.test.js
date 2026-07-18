'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const DASHBOARD_ID = 'synthetic-dashboard-id-0001';
const LEDGER_ID = 'synthetic-ledger-id-000002';

function createRuntime(options = {}) {
  const values = {
    FO_ENVIRONMENT: 'LAB',
    FO_DASHBOARD_SPREADSHEET_ID: DASHBOARD_ID,
    FO_LEDGER_SPREADSHEET_ID: LEDGER_ID,
    ...options.properties
  };
  const scriptProperties = {
    getProperty: jest.fn((key) => values[key] || null)
  };
  const lock = options.lock || {
    tryLock: jest.fn(() => true),
    releaseLock: jest.fn()
  };
  const context = vm.createContext({
    PropertiesService: {
      getScriptProperties: jest.fn(() => scriptProperties)
    },
    LockService: {
      getScriptLock: jest.fn(() => lock)
    },
    SpreadsheetApp: options.SpreadsheetApp,
    console
  });

  vm.runInContext(read('RuntimeSafety.js'), context);
  vm.runInContext(read('RuntimeLockService.js'), context);

  return { context, lock, scriptProperties };
}

describe('Wave R1.3.0.2 runtime guard', () => {
  test('accepts a complete LAB configuration', () => {
    const { context } = createRuntime();

    const configuration = context.foAssertRuntimeSafety_('Unit test');

    expect(configuration.environment).toBe('LAB');
    expect(configuration.dashboardSpreadsheetId).toBe(DASHBOARD_ID);
    expect(configuration.ledgerSpreadsheetId).toBe(LEDGER_ID);
  });

  test.each([
    ['missing environment', { FO_ENVIRONMENT: '' }],
    ['unknown environment', { FO_ENVIRONMENT: 'STAGING' }],
    ['missing dashboard', { FO_DASHBOARD_SPREADSHEET_ID: '' }],
    ['missing ledger', { FO_LEDGER_SPREADSHEET_ID: '' }],
    ['same workbook for both roles', {
      FO_DASHBOARD_SPREADSHEET_ID: DASHBOARD_ID,
      FO_LEDGER_SPREADSHEET_ID: DASHBOARD_ID
    }]
  ])('fails closed for %s', (_label, properties) => {
    const { context } = createRuntime({ properties });

    expect(() => context.foAssertRuntimeSafety_('Unit test'))
      .toThrow('Runtime safety blocked operation');
  });

  test('requires an explicit production write enable flag', () => {
    const disabled = createRuntime({
      properties: { FO_ENVIRONMENT: 'PRODUCTION' }
    });
    const enabled = createRuntime({
      properties: {
        FO_ENVIRONMENT: 'PRODUCTION',
        FO_PRODUCTION_WRITE_ENABLED: 'TRUE'
      }
    });

    expect(() => disabled.context.foAssertRuntimeSafety_('Production test'))
      .toThrow('production writes are disabled');
    expect(enabled.context.foAssertRuntimeSafety_('Production test').environment)
      .toBe('PRODUCTION');
  });

  test('SpreadsheetService validates the opened workbook identity', () => {
    const SpreadsheetApp = {
      openById: jest.fn(() => ({ getId: () => LEDGER_ID }))
    };
    const { context } = createRuntime({ SpreadsheetApp });
    vm.runInContext(read('SpreadsheetService.js'), context);

    expect(() => context.foDashboard_())
      .toThrow('opened workbook does not match the configured dashboard target');
    expect(SpreadsheetApp.openById).toHaveBeenCalledWith(DASHBOARD_ID);
  });

  test('invalid configuration blocks access before SpreadsheetApp is called', () => {
    const SpreadsheetApp = { openById: jest.fn() };
    const { context } = createRuntime({
      properties: { FO_ENVIRONMENT: '' },
      SpreadsheetApp
    });
    vm.runInContext(read('SpreadsheetService.js'), context);

    expect(() => context.foDashboard_())
      .toThrow('Runtime safety blocked operation');
    expect(SpreadsheetApp.openById).not.toHaveBeenCalled();
  });
});

describe('Wave R1.3.0.2 runtime locking', () => {
  test('blocks protected helpers when no runtime lock is held', () => {
    const { context } = createRuntime();

    expect(() => context.foAssertRuntimeLockHeld_('Direct helper test'))
      .toThrow('Runtime safety blocked unlocked operation');
  });

  test('serializes an operation and releases the lock', () => {
    const { context, lock } = createRuntime();
    const callback = jest.fn(() => 'complete');

    expect(context.foWithRuntimeLock_('Locked test', callback))
      .toBe('complete');
    expect(lock.tryLock).toHaveBeenCalledWith(5000);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(lock.releaseLock).toHaveBeenCalledTimes(1);
  });

  test('fails closed when another execution holds the lock', () => {
    const lock = {
      tryLock: jest.fn(() => false),
      releaseLock: jest.fn()
    };
    const { context } = createRuntime({ lock });
    const callback = jest.fn();

    expect(() => context.foWithRuntimeLock_('Contended test', callback))
      .toThrow('Runtime safety blocked concurrent operation');
    expect(callback).not.toHaveBeenCalled();
    expect(lock.releaseLock).not.toHaveBeenCalled();
  });

  test('releases the lock when the protected operation throws', () => {
    const { context, lock } = createRuntime();

    expect(() => context.foWithRuntimeLock_('Throwing test', () => {
      throw new Error('synthetic failure');
    })).toThrow('synthetic failure');
    expect(lock.releaseLock).toHaveBeenCalledTimes(1);
  });

  test('supports nested protected services without reacquiring the script lock', () => {
    const { context, lock } = createRuntime();

    const result = context.foWithRuntimeLock_('Outer test', () => (
      context.foWithRuntimeLock_('Inner test', () => 'nested complete')
    ));

    expect(result).toBe('nested complete');
    expect(lock.tryLock).toHaveBeenCalledTimes(1);
    expect(lock.releaseLock).toHaveBeenCalledTimes(1);
  });
});

describe('Wave R1.3.0.2 protected surface', () => {
  test.each([
    ['AutonomousCioOrchestrator.js', 'Run Autonomous CIO Orchestrator'],
    ['ProductionCertificationEngine.js', 'Run Production Certification'],
    ['ReportService.js', 'Archive report']
  ])('%s uses the runtime lock guard', (file, operation) => {
    const source = read(file);
    expect(source).toContain('foWithRuntimeLock_(');
    expect(source).toContain(operation);
  });

  test('Apps Script OAuth scopes are explicit', () => {
    const manifest = JSON.parse(read('appsscript.json'));

    expect(manifest.oauthScopes).toEqual(expect.arrayContaining([
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/script.container.ui',
      'https://www.googleapis.com/auth/script.scriptapp',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/userinfo.email'
    ]));
  });

  test('direct workbook opens are confined to SpreadsheetService', () => {
    const directOpenPattern = /SpreadsheetApp\s*\.\s*openBy(?:Id|Url)\s*\(/g;
    const sourceFiles = fs.readdirSync(root)
      .filter((file) => file.endsWith('.js'));
    const directOpens = sourceFiles.flatMap((file) => (
      (read(file).match(directOpenPattern) || []).map(() => file)
    ));

    expect(directOpens).toEqual([
      'SpreadsheetService.js',
      'SpreadsheetService.js'
    ]);
    expect(read('SpreadsheetService.js')).not.toMatch(
      /SpreadsheetApp\s*\.\s*openByUrl\s*\(/
    );
  });
});
