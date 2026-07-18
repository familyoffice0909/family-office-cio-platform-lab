/**
 * Wave R1.3.1.1 — Registry Authority.
 *
 * Governs registry metadata without replacing registry-owned business data.
 */
const FO_REGISTRY_AUTHORITY_NAME = 'Registry Authority';

const FO_REGISTRY_REGISTRATION_STATUS = Object.freeze({
  REGISTERED: 'REGISTERED',
  SUSPENDED: 'SUSPENDED',
  RETIRED: 'RETIRED'
});

let FO_REGISTRY_AUTHORITY_RECORDS_ = null;

/** Register a registry with the platform authority. */
function foRegisterRegistry(metadata) {
  foBootstrapRegistryAuthority_();
  return foRegisterRegistry_(metadata);
}

/** Discover registered metadata, optionally filtered by name or metadata fields. */
function foDiscoverRegistries(criteria) {
  foBootstrapRegistryAuthority_();
  const query = typeof criteria === 'string'
    ? { registryName: criteria }
    : (criteria || {});
  const supportedFields = [
    'registryName',
    'owner',
    'version',
    'authority',
    'registrationStatus'
  ];

  return Object.freeze(FO_REGISTRY_AUTHORITY_RECORDS_
    .filter(function (record) {
      return supportedFields.every(function (field) {
        if (query[field] === undefined || query[field] === null) return true;
        return String(record[field]).toUpperCase() ===
          String(query[field]).trim().toUpperCase();
      });
    })
    .map(foRegistryMetadataView_));
}

/** Discover one registry by its governed name. */
function foDiscoverRegistry(registryName) {
  const matches = foDiscoverRegistries(String(registryName || '').trim());
  return matches.length ? matches[0] : null;
}

/** Validate the complete governed registry catalog. */
function foValidateRegistryAuthority() {
  foBootstrapRegistryAuthority_();
  return foValidateRegistryRegistrations_(FO_REGISTRY_AUTHORITY_RECORDS_);
}

/** Apps Script smoke test for the initial authority adoption. */
function foRunRegistryAuthoritySmokeTest() {
  const result = foValidateRegistryAuthority();
  if (result.status !== 'PASS' || result.registrationCount !== 3) {
    throw new Error(
      'Registry Authority smoke test failed: ' +
      result.errors.map(function (error) { return error.code; }).join(', ')
    );
  }
  return result;
}

function foBootstrapRegistryAuthority_() {
  if (FO_REGISTRY_AUTHORITY_RECORDS_ !== null) return;

  FO_REGISTRY_AUTHORITY_RECORDS_ = [];
  try {
    foRegisterRegistry_({
      registryName: 'FO_SHEETS',
      owner: 'Platform Configuration',
      version: '1.0.0',
      authority: FO_REGISTRY_AUTHORITY_NAME,
      validationFunction: foValidateFoSheetsRegistry_,
      registrationStatus: FO_REGISTRY_REGISTRATION_STATUS.REGISTERED,
      registry: FO_SHEETS
    });
    foRegisterRegistry_({
      registryName: 'FO_REQUIRED_DASHBOARD_SHEETS',
      owner: 'Platform Health',
      version: '1.0.0',
      authority: FO_REGISTRY_AUTHORITY_NAME,
      validationFunction: foValidateRequiredDashboardSheetsRegistry_,
      registrationStatus: FO_REGISTRY_REGISTRATION_STATUS.REGISTERED,
      registry: FO_REQUIRED_DASHBOARD_SHEETS
    });
    foRegisterRegistry_({
      registryName: 'Market Symbol Registry',
      owner: 'Market Data',
      version: '1.0.0',
      authority: FO_REGISTRY_AUTHORITY_NAME,
      validationFunction: foValidateMarketSymbolRegistry_,
      registrationStatus: FO_REGISTRY_REGISTRATION_STATUS.REGISTERED,
      registry: FO_MARKET_SYMBOLS
    });
  } catch (error) {
    FO_REGISTRY_AUTHORITY_RECORDS_ = null;
    throw error;
  }
}

function foRegisterRegistry_(metadata) {
  const record = foNormalizeRegistryMetadata_(metadata);
  const candidateRecords = FO_REGISTRY_AUTHORITY_RECORDS_.concat([record]);
  const validation = foValidateRegistryRegistrations_(candidateRecords);

  if (validation.status !== 'PASS') {
    throw new Error(
      'Registry Authority rejected registration: ' +
      validation.errors.map(function (error) {
        return error.code + ' (' + error.message + ')';
      }).join('; ')
    );
  }

  FO_REGISTRY_AUTHORITY_RECORDS_.push(Object.freeze(record));
  return foRegistryMetadataView_(record);
}

function foNormalizeRegistryMetadata_(metadata) {
  const source = metadata && typeof metadata === 'object' ? metadata : {};
  return {
    registryName: String(source.registryName || '').trim(),
    owner: String(source.owner || '').trim(),
    version: String(source.version || '').trim(),
    authority: String(source.authority || '').trim(),
    validationFunction: source.validationFunction,
    registrationStatus: String(source.registrationStatus || '').trim().toUpperCase(),
    registry: source.registry
  };
}

function foRegistryMetadataView_(record) {
  return Object.freeze({
    registryName: record.registryName,
    owner: record.owner,
    version: record.version,
    authority: record.authority,
    validationFunction: record.validationFunction,
    registrationStatus: record.registrationStatus
  });
}

function foValidateRegistryRegistrations_(registrations) {
  const records = Array.isArray(registrations) ? registrations : [];
  const errors = [];
  const seenNames = {};
  const seenOwners = {};
  const requiredMetadata = [
    'registryName',
    'owner',
    'version',
    'authority',
    'registrationStatus'
  ];
  const validStatuses = Object.keys(FO_REGISTRY_REGISTRATION_STATUS).map(
    function (key) { return FO_REGISTRY_REGISTRATION_STATUS[key]; }
  );

  records.forEach(function (record, index) {
    const source = record && typeof record === 'object' ? record : {};

    requiredMetadata.forEach(function (field) {
      if (!String(source[field] || '').trim()) {
        foAddRegistryValidationError_(
          errors,
          'MISSING_METADATA',
          index,
          'Required registry metadata is missing: ' + field + '.'
        );
      }
    });

    const registryName = String(source.registryName || '').trim();
    const nameKey = registryName.toUpperCase();
    if (nameKey) {
      if (seenNames[nameKey] !== undefined) {
        foAddRegistryValidationError_(
          errors,
          'DUPLICATE_REGISTRY_NAME',
          index,
          'Registry name duplicates registration ' + seenNames[nameKey] + ': ' +
            registryName + '.'
        );
      } else {
        seenNames[nameKey] = index;
      }
    }

    const owner = String(source.owner || '').trim();
    const ownerKey = owner.toUpperCase();
    if (ownerKey) {
      if (seenOwners[ownerKey] !== undefined) {
        foAddRegistryValidationError_(
          errors,
          'DUPLICATE_OWNERSHIP',
          index,
          'Registry owner duplicates registration ' + seenOwners[ownerKey] + ': ' +
            owner + '.'
        );
      } else {
        seenOwners[ownerKey] = index;
      }
    }

    if (typeof source.validationFunction !== 'function') {
      foAddRegistryValidationError_(
        errors,
        'MISSING_VALIDATION_FUNCTION',
        index,
        'Registry validationFunction must be callable.'
      );
    }

    const registrationStatus = String(source.registrationStatus || '')
      .trim()
      .toUpperCase();
    if (validStatuses.indexOf(registrationStatus) < 0) {
      foAddRegistryValidationError_(
        errors,
        'INVALID_REGISTRATION_STATUS',
        index,
        'Registration status is not governed: ' +
          (registrationStatus || '[missing]') + '.'
      );
    }

    if (typeof source.validationFunction === 'function') {
      try {
        const outcome = source.validationFunction(source.registry, source);
        const passed = outcome === true || (
          outcome &&
          typeof outcome === 'object' &&
          (outcome.status === 'PASS' || outcome.status === 'PASS WITH OBSERVATIONS')
        );
        if (!passed) {
          foAddRegistryValidationError_(
            errors,
            'REGISTRY_VALIDATION_FAILED',
            index,
            'Registry-owned validation did not pass.'
          );
        }
      } catch (error) {
        foAddRegistryValidationError_(
          errors,
          'REGISTRY_VALIDATION_FAILED',
          index,
          'Registry-owned validation threw: ' + error.message
        );
      }
    }
  });

  return Object.freeze({
    authority: FO_REGISTRY_AUTHORITY_NAME,
    status: errors.length ? 'FAIL' : 'PASS',
    registrationCount: records.length,
    validRegistrationCount: records.length - foInvalidRegistryCount_(errors),
    errorCount: errors.length,
    errors: Object.freeze(errors)
  });
}

function foAddRegistryValidationError_(errors, code, registrationIndex, message) {
  errors.push(Object.freeze({
    code: code,
    registrationIndex: registrationIndex,
    message: message
  }));
}

function foInvalidRegistryCount_(errors) {
  const invalid = {};
  errors.forEach(function (error) { invalid[error.registrationIndex] = true; });
  return Object.keys(invalid).length;
}

function foValidateFoSheetsRegistry_(registry) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return false;
  const keys = Object.keys(registry);
  const values = keys.map(function (key) { return String(registry[key] || '').trim(); });
  return keys.length > 0 &&
    values.every(function (value) { return Boolean(value); }) &&
    Object.keys(values.reduce(function (seen, value) {
      seen[value.toUpperCase()] = true;
      return seen;
    }, {})).length === values.length;
}

function foValidateRequiredDashboardSheetsRegistry_(registry) {
  if (!Array.isArray(registry) || !registry.length) return false;
  const governedSheets = Object.keys(FO_SHEETS).map(function (key) {
    return FO_SHEETS[key];
  });
  const seen = {};
  return registry.every(function (sheetName) {
    const normalized = String(sheetName || '').trim();
    if (!normalized || seen[normalized] || governedSheets.indexOf(normalized) < 0) {
      return false;
    }
    seen[normalized] = true;
    return true;
  });
}

function foValidateMarketSymbolRegistry_(registry) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return false;
  const tickers = Object.keys(registry);
  return tickers.length > 0 && tickers.every(function (ticker) {
    const entry = registry[ticker];
    return Boolean(
      String(ticker || '').trim() &&
      entry &&
      String(entry.providerSymbol || '').trim() &&
      String(entry.exchange || '').trim() &&
      String(entry.currency || '').trim() &&
      String(entry.status || '').trim()
    );
  });
}
