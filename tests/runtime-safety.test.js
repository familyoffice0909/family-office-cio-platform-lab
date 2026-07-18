'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const DASHBOARD_ID = 'synthetic-dashboard-id-0001';
const LEDGER_ID = 'synthetic-ledger-id-000002';

function createSpreadsheet(id, environment, role, options = {}) {
  const bindings = {
    FO_RUNTIME_ENVIRONMENT: environment,
    FO_RUNTIME_WORKBOOK_ROLE: role
  };

  return {
    getId: jest.fn(() => id),
    getRangeByName: jest.fn((name) => {
      if (options.missingBindings) return null;
      return {
        getDisplayValue: jest.fn(() => bindings[name] || '')
      };
    })
  };
}

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
  const dashboard = options.dashboard || createSpreadsheet(
    DASHBOARD_ID,
    (options.dashboardBinding || {}).environment || values.FO_ENVIRONMENT,
    (options.dashboardBinding || {}).role || 'DASHBOARD',
    options.dashboardBinding
  );
  const ledger = options.ledger || createSpreadsheet(
    LEDGER_ID,
    (options.ledgerBinding || {}).environment || values.FO_ENVIRONMENT,
    (options.ledgerBinding || {}).role || 'LEDGER',
    options.ledgerBinding
  );
  const SpreadsheetApp = options.SpreadsheetApp || {
    openById: jest.fn((id) => (
      id === DASHBOARD_ID ? dashboard : ledger
    ))
  };
  const context = vm.createContext({
    PropertiesService: {
      getScriptProperties: jest.fn(() => scriptProperties)
    },
    LockService: {
      getScriptLock: jest.fn(() => lock)
    },
    SpreadsheetApp,
    console
  });

  vm.runInContext(read('RuntimeSafety.js'), context);
  vm.runInContext(read('SpreadsheetService.js'), context);
  vm.runInContext(read('RuntimeLockService.js'), context);

  return {
    context,
    dashboard,
    ledger,
    lock,
    scriptProperties,
    SpreadsheetApp
  };
}

describe('Wave R1.3.0.3 runtime authorization and binding', () => {
  test('accepts a complete LAB configuration', () => {
    const { context } = createRuntime();

    const configuration = context.foAssertRuntimeReadSafety_('Unit test');

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

    expect(() => context.foAssertRuntimeReadSafety_('Unit test'))
      .toThrow('Runtime safety blocked operation');
  });

  test('allows Production reads while separately blocking writes', () => {
    const disabled = createRuntime({
      properties: { FO_ENVIRONMENT: 'PRODUCTION' }
    });
    const enabled = createRuntime({
      properties: {
        FO_ENVIRONMENT: 'PRODUCTION',
        FO_PRODUCTION_WRITE_ENABLED: 'TRUE'
      }
    });

    expect(disabled.context.foGetRuntimeEnvironment_()).toBe('PRODUCTION');
    expect(disabled.context.foDashboardRead_()).toBe(disabled.dashboard);
    expect(() => disabled.context.foDashboard_())
      .toThrow('production writes are disabled');
    expect(disabled.SpreadsheetApp.openById).toHaveBeenCalledTimes(1);
    expect(() => disabled.context.foAssertRuntimeWriteSafety_('Write test'))
      .toThrow('production writes are disabled');
    expect(enabled.context.foAssertRuntimeWriteSafety_('Write test').environment)
      .toBe('PRODUCTION');
  });

  test('retains the legacy runtime assertion as a write assertion', () => {
    const { context } = createRuntime({
      properties: { FO_ENVIRONMENT: 'PRODUCTION' }
    });

    expect(() => context.foAssertRuntimeSafety_('Legacy write assertion'))
      .toThrow('production writes are disabled');
  });

  test('SpreadsheetService validates the opened workbook identity', () => {
    const SpreadsheetApp = {
      openById: jest.fn(() => createSpreadsheet(
        LEDGER_ID,
        'LAB',
        'LEDGER'
      ))
    };
    const { context } = createRuntime({ SpreadsheetApp });

    expect(() => context.foDashboard_())
      .toThrow('opened workbook does not match the configured dashboard target');
    expect(SpreadsheetApp.openById).toHaveBeenCalledWith(DASHBOARD_ID);
  });

  test.each([
    ['environment', { environment: 'PRODUCTION' },
      'workbook environment binding does not match LAB'],
    ['role', { role: 'LEDGER' },
      'workbook role binding does not match DASHBOARD'],
    ['named ranges', { missingBindings: true },
      'workbook runtime binding named ranges are missing']
  ])('fails closed for an invalid Dashboard %s binding', (
    _label,
    dashboardBinding,
    expectedError
  ) => {
    const { context } = createRuntime({ dashboardBinding });

    expect(() => context.foDashboard_()).toThrow(expectedError);
  });

  test('invalid configuration blocks access before SpreadsheetApp is called', () => {
    const SpreadsheetApp = { openById: jest.fn() };
    const { context } = createRuntime({
      properties: { FO_ENVIRONMENT: '' },
      SpreadsheetApp
    });

    expect(() => context.foDashboard_())
      .toThrow('Runtime safety blocked operation');
    expect(SpreadsheetApp.openById).not.toHaveBeenCalled();
  });
});

describe('Wave R1.3.0.3 runtime locking', () => {
  test('blocks protected helpers when no runtime lock is held', () => {
    const { context } = createRuntime();

    expect(() => context.foAssertRuntimeLockHeld_('Archive report'))
      .toThrow('Runtime safety blocked unlocked operation');
  });

  test('serializes an operation, verifies both bindings, and releases the lock', () => {
    const { context, lock, SpreadsheetApp } = createRuntime();
    const callback = jest.fn(() => 'complete');

    expect(context.foWithRuntimeLock_('Archive report', callback))
      .toBe('complete');
    expect(lock.tryLock).toHaveBeenCalledWith(5000);
    expect(SpreadsheetApp.openById).toHaveBeenCalledWith(DASHBOARD_ID);
    expect(SpreadsheetApp.openById).toHaveBeenCalledWith(LEDGER_ID);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(lock.releaseLock).toHaveBeenCalledTimes(1);
  });

  test('blocks the write before its callback when either workbook binding is invalid', () => {
    const { context, lock } = createRuntime({
      ledgerBinding: { environment: 'PRODUCTION' }
    });
    const callback = jest.fn();

    expect(() => context.foWithRuntimeLock_('Archive report', callback))
      .toThrow('workbook environment binding does not match LAB');
    expect(callback).not.toHaveBeenCalled();
    expect(lock.releaseLock).toHaveBeenCalledTimes(1);
  });

  test('fails closed when another execution holds the lock', () => {
    const lock = {
      tryLock: jest.fn(() => false),
      releaseLock: jest.fn()
    };
    const { context } = createRuntime({ lock });
    const callback = jest.fn();

    expect(() => context.foWithRuntimeLock_('Archive report', callback))
      .toThrow('Runtime safety blocked concurrent operation');
    expect(callback).not.toHaveBeenCalled();
    expect(lock.releaseLock).not.toHaveBeenCalled();
  });

  test('releases the lock when the protected operation throws', () => {
    const { context, lock } = createRuntime();

    expect(() => context.foWithRuntimeLock_('Archive report', () => {
      throw new Error('synthetic failure');
    })).toThrow('synthetic failure');
    expect(lock.releaseLock).toHaveBeenCalledTimes(1);
  });

  test('supports nested protected services without reacquiring the script lock', () => {
    const { context, lock } = createRuntime();

    const result = context.foWithRuntimeLock_(
      'Run Autonomous CIO Orchestrator',
      () => context.foWithRuntimeLock_('Archive report', () => 'complete')
    );

    expect(result).toBe('complete');
    expect(lock.tryLock).toHaveBeenCalledTimes(1);
    expect(lock.releaseLock).toHaveBeenCalledTimes(1);
  });

  test('blocks lock use outside the explicit protected-operation inventory', () => {
    const { context } = createRuntime();

    expect(() => context.foWithRuntimeLock_('Unregistered operation', () => {}))
      .toThrow('Runtime safety blocked unregistered protected operation');
  });
});

describe('Wave R1.3.0.3 authoritative protected surface', () => {
  test.each([
    [
      'Wave311CertificationEngine.js',
      'foRunProductionCertificationWave311',
      'foRunProductionCertificationWave311Protected_',
      'Run Production Certification Wave311',
      [{ orchestratorRunId: 'synthetic-run' }]
    ],
    [
      'ExecutiveReportingEngine.js',
      'foRunExecutiveReportEngine',
      'foRunExecutiveReportEngineProtected_',
      'Run Executive Report archive workflow',
      []
    ],
    [
      'WeeklyCioReportA240.js',
      'foRunWeeklyCioReportA240',
      'foRunWeeklyCioReportA240Protected_',
      'Run Weekly CIO Report A240 archive workflow',
      [{ refreshDecisionState: false }]
    ]
  ])('%s public entry executes through the runtime lock', (
    file,
    publicName,
    protectedName,
    operation,
    args
  ) => {
    const { context, lock } = createRuntime();
    vm.runInContext(read(file), context);
    context[protectedName] = jest.fn(() => 'protected result');

    expect(context[publicName](...args)).toBe('protected result');
    expect(context[protectedName]).toHaveBeenCalledTimes(1);
    expect(lock.tryLock).toHaveBeenCalledTimes(1);
    expect(read(file)).toContain(operation);
  });

  test.each([
    ['Wave311CertificationEngine.js',
      'foRunProductionCertificationWave311Protected_', [{}]],
    ['ExecutiveReportingEngine.js',
      'foRunExecutiveReportEngineProtected_', []],
    ['WeeklyCioReportA240.js',
      'foRunWeeklyCioReportA240Protected_', [{}]]
  ])('%s protected helper rejects a direct unlocked call', (
    file,
    protectedName,
    args
  ) => {
    const { context } = createRuntime();
    vm.runInContext(read(file), context);

    expect(() => context[protectedName](...args))
      .toThrow('Runtime safety blocked unlocked operation');
  });

  test('the protected-operation inventory names every current surface', () => {
    const source = read('RuntimeLockService.js');

    [
      'Run Autonomous CIO Orchestrator',
      'Run Production Certification',
      'Archive report',
      'Run Production Certification Wave311',
      'Run Executive Report archive workflow',
      'Run Weekly CIO Report A240 archive workflow'
    ].forEach((operation) => expect(source).toContain(operation));
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

    expect(directOpens).toEqual(['SpreadsheetService.js']);
    expect(read('SpreadsheetService.js')).not.toMatch(
      /SpreadsheetApp\s*\.\s*openByUrl\s*\(/
    );
  });

  test('root Production sources receive meaningful ESLint rules', () => {
    const configuration = JSON.parse(execFileSync(
      process.execPath,
      [
        path.join(root, 'node_modules/eslint/bin/eslint.js'),
        '--print-config',
        path.join(root, 'RuntimeSafety.js')
      ],
      { cwd: root, encoding: 'utf8' }
    ));

    expect(configuration.rules['no-undef'][0]).toBe(2);
    expect(configuration.rules['no-unused-vars'][0]).toBe(2);
    expect(configuration.rules['no-unreachable'][0]).toBe(2);
  });

  test('provides a read-only Apps Script runtime smoke entry point', () => {
    expect(read('SpreadsheetService.js'))
      .toContain('function foRunRuntimeSafetySmokeTest()');
  });
});
