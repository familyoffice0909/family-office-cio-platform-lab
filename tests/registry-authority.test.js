'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function createRegistryAuthority() {
  const context = vm.createContext({
    Session: { getScriptTimeZone: () => 'America/Toronto' },
    console
  });
  vm.runInContext(read('Config.js'), context);
  vm.runInContext(read('MarketSymbolRegistry.js'), context);
  vm.runInContext(read('RegistryAuthority.js'), context);
  return context;
}

describe('Wave R1.3.1.1 Registry Authority adoption and discovery', () => {
  test('adopts only the three approved existing registries', () => {
    const context = createRegistryAuthority();
    const registrations = context.foDiscoverRegistries();

    expect(Array.from(registrations, (entry) => entry.registryName)).toEqual([
      'FO_SHEETS',
      'FO_REQUIRED_DASHBOARD_SHEETS',
      'Market Symbol Registry'
    ]);
    expect(registrations).toHaveLength(3);
    expect(registrations.every((entry) => (
      entry.authority === 'Registry Authority' &&
      entry.registrationStatus === 'REGISTERED' &&
      typeof entry.validationFunction === 'function'
    ))).toBe(true);
  });

  test('discovers by name and governed metadata fields', () => {
    const context = createRegistryAuthority();

    expect(context.foDiscoverRegistry('fo_sheets').owner)
      .toBe('Platform Configuration');
    expect(context.foDiscoverRegistries({ owner: 'market data' }))
      .toHaveLength(1);
    expect(context.foDiscoverRegistries({ registrationStatus: 'retired' }))
      .toHaveLength(0);
    expect(context.foDiscoverRegistry('unregistered')).toBeNull();
  });

  test('returns immutable metadata views without registry business data', () => {
    const context = createRegistryAuthority();
    const registration = context.foDiscoverRegistry('FO_SHEETS');

    expect(Object.isFrozen(registration)).toBe(true);
    expect(registration).not.toHaveProperty('registry');
    expect(registration).toEqual(expect.objectContaining({
      registryName: 'FO_SHEETS',
      owner: 'Platform Configuration',
      version: '1.0.0',
      authority: 'Registry Authority',
      registrationStatus: 'REGISTERED'
    }));
  });

  test('registers and discovers a valid runtime registration', () => {
    const context = createRegistryAuthority();
    const registration = context.foRegisterRegistry({
      registryName: 'Synthetic Test Registry',
      owner: 'Synthetic Test Owner',
      version: '1.0.0-test',
      authority: 'Registry Authority',
      validationFunction: () => true,
      registrationStatus: 'REGISTERED',
      registry: { synthetic: true }
    });

    expect(registration.registryName).toBe('Synthetic Test Registry');
    expect(context.foDiscoverRegistry('synthetic test registry').owner)
      .toBe('Synthetic Test Owner');
    expect(context.foDiscoverRegistries()).toHaveLength(4);
  });
});

describe('Wave R1.3.1.1 Registry Authority validation', () => {
  test('passes the complete initial authority catalog and smoke test', () => {
    const context = createRegistryAuthority();

    expect(context.foValidateRegistryAuthority()).toEqual(expect.objectContaining({
      status: 'PASS',
      registrationCount: 3,
      validRegistrationCount: 3,
      errorCount: 0
    }));
    expect(context.foRunRegistryAuthoritySmokeTest().status).toBe('PASS');
  });

  test('detects duplicate names and duplicate ownership case-insensitively', () => {
    const context = createRegistryAuthority();
    const validation = context.foValidateRegistryRegistrations_([
      {
        registryName: 'Registry A',
        owner: 'Owner A',
        version: '1.0.0',
        authority: 'Registry Authority',
        validationFunction: () => true,
        registrationStatus: 'REGISTERED',
        registry: {}
      },
      {
        registryName: 'registry a',
        owner: 'owner a',
        version: '1.0.0',
        authority: 'Registry Authority',
        validationFunction: () => true,
        registrationStatus: 'REGISTERED',
        registry: {}
      }
    ]);
    const codes = Array.from(validation.errors, (error) => error.code);

    expect(validation.status).toBe('FAIL');
    expect(codes).toEqual(expect.arrayContaining([
      'DUPLICATE_REGISTRY_NAME',
      'DUPLICATE_OWNERSHIP'
    ]));
  });

  test('detects missing metadata, missing validator, and invalid status', () => {
    const context = createRegistryAuthority();
    const validation = context.foValidateRegistryRegistrations_([{
      registryName: '',
      owner: '',
      version: '',
      authority: '',
      registrationStatus: ''
    }]);
    const codes = Array.from(validation.errors, (error) => error.code);

    expect(validation.status).toBe('FAIL');
    expect(codes).toEqual(expect.arrayContaining([
      'MISSING_METADATA',
      'MISSING_VALIDATION_FUNCTION',
      'INVALID_REGISTRATION_STATUS'
    ]));
  });

  test('detects a failed or throwing registry-owned validation function', () => {
    const context = createRegistryAuthority();
    const base = {
      version: '1.0.0',
      authority: 'Registry Authority',
      registrationStatus: 'REGISTERED',
      registry: {}
    };
    const validation = context.foValidateRegistryRegistrations_([
      {
        ...base,
        registryName: 'Failed Registry',
        owner: 'Failed Owner',
        validationFunction: () => false
      },
      {
        ...base,
        registryName: 'Throwing Registry',
        owner: 'Throwing Owner',
        validationFunction: () => { throw new Error('synthetic validation error'); }
      }
    ]);

    expect(Array.from(validation.errors, (error) => error.code))
      .toEqual(['REGISTRY_VALIDATION_FAILED', 'REGISTRY_VALIDATION_FAILED']);
    expect(validation.validRegistrationCount).toBe(0);
  });

  test('registration API fails closed for conflicting metadata', () => {
    const context = createRegistryAuthority();

    expect(() => context.foRegisterRegistry({
      registryName: 'FO_SHEETS',
      owner: 'Synthetic Owner',
      version: '1.0.0',
      authority: 'Registry Authority',
      validationFunction: () => true,
      registrationStatus: 'REGISTERED',
      registry: {}
    })).toThrow('DUPLICATE_REGISTRY_NAME');

    expect(context.foDiscoverRegistries()).toHaveLength(3);
  });
});
