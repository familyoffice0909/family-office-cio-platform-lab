'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
  console.error(`ERROR: ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.warn(`WARNING: ${message}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function jsFiles() {
  return fs.readdirSync(ROOT)
    .filter((name) => name.endsWith('.js'))
    .sort();
}

const requiredFiles = [
  'package.json',
  'package-lock.json',
  'eslint.config.js',
  'appsscript.json',
  'Config.js',
  'Bootstrap.js',
  'HealthCheck.js',
  'RuntimeSafety.js',
  'RuntimeLockService.js',
  'SpreadsheetService.js',
  'docs/operations/RUNTIME-CONFIGURATION-AND-MIGRATION.md',
  'docs/validation/R1.3.0.3-LAB-VALIDATION-TEMPLATE.md',
  'docs/validation/R1.3.0.3-RUNTIME-SAFETY-AUDIT-EVIDENCE.md',
  'ValidationService.js',
  'ModuleRegistry.js',
  'AutonomousCioOrchestrator.js',
  'Menu.js',
  'SmokeTest.js',
  'PhaseBService.js',
  'DashboardService.js',
  'LegacyPortfolioStateService.js',
  'AutomationService.js',
  'BuyZoneIntelligenceEngine.js'
];

for (const file of requiredFiles) {
  if (!exists(file)) fail(`Required platform file is missing: ${file}`);
}

if (exists('appsscript.json')) {
  try {
    const manifest = JSON.parse(read('appsscript.json'));
    if (manifest.runtimeVersion !== 'V8') fail('appsscript.json must use runtimeVersion V8');
    if (!manifest.timeZone) fail('appsscript.json must define timeZone');
  } catch (error) {
    fail(`Invalid appsscript.json: ${error.message}`);
  }
}

const sources = jsFiles().map((file) => ({ file, text: read(file) }));
const combined = sources.map((item) => item.text).join('\n');

const directWorkbookOpenRegex = /SpreadsheetApp\s*\.\s*openBy(?:Id|Url)\s*\(/g;
let directWorkbookOpenCount = 0;

for (const source of sources) {
  const directWorkbookOpens = source.text.match(directWorkbookOpenRegex) || [];
  directWorkbookOpenCount += directWorkbookOpens.length;

  if (source.file !== 'SpreadsheetService.js' && directWorkbookOpens.length > 0) {
    fail(
      'Direct workbook access must flow through SpreadsheetService.js: ' +
      source.file
    );
  }
}

const functionLocations = new Map();
const functionRegex = /^\s*function\s+([A-Za-z_$][\w$]*)\s*\(/gm;

for (const source of sources) {
  let match;
  while ((match = functionRegex.exec(source.text)) !== null) {
    const name = match[1];
    const previous = functionLocations.get(name) || [];
    previous.push(source.file);
    functionLocations.set(name, previous);
  }
}

for (const [name, locations] of functionLocations.entries()) {
  if (locations.length > 1) {
    fail(`Duplicate global function "${name}" found in: ${locations.join(', ')}`);
  }
}

const runtimeProtectedSurfaces = [
  {
    file: 'AutonomousCioOrchestrator.js',
    publicFunction: 'foRunAutonomousCioOrchestrator',
    protectedFunction: 'foRunAutonomousCioOrchestratorProtected_',
    operation: 'Run Autonomous CIO Orchestrator'
  },
  {
    file: 'ProductionCertificationEngine.js',
    publicFunction: 'foRunProductionCertification',
    protectedFunction: 'foRunProductionCertificationProtected_',
    operation: 'Run Production Certification'
  },
  {
    file: 'ReportService.js',
    publicFunction: 'foArchiveReport',
    protectedFunction: 'foArchiveReportProtected_',
    operation: 'Archive report'
  },
  {
    file: 'Wave311CertificationEngine.js',
    publicFunction: 'foRunProductionCertificationWave311',
    protectedFunction: 'foRunProductionCertificationWave311Protected_',
    operation: 'Run Production Certification Wave311'
  },
  {
    file: 'ExecutiveReportingEngine.js',
    publicFunction: 'foRunExecutiveReportEngine',
    protectedFunction: 'foRunExecutiveReportEngineProtected_',
    operation: 'Run Executive Report archive workflow'
  },
  {
    file: 'WeeklyCioReportA240.js',
    publicFunction: 'foRunWeeklyCioReportA240',
    protectedFunction: 'foRunWeeklyCioReportA240Protected_',
    operation: 'Run Weekly CIO Report A240 archive workflow'
  }
];

if (exists('RuntimeLockService.js')) {
  const runtimeLockService = read('RuntimeLockService.js');

  for (const surface of runtimeProtectedSurfaces) {
    const source = exists(surface.file) ? read(surface.file) : '';
    if (!functionLocations.has(surface.publicFunction)) {
      fail(`Runtime-protected public function is missing: ${surface.publicFunction}`);
    }
    if (!functionLocations.has(surface.protectedFunction)) {
      fail(`Runtime-protected helper is missing: ${surface.protectedFunction}`);
    }
    if (!source.includes('foWithRuntimeLock_(')) {
      fail(`Runtime lock wrapper is missing from ${surface.file}`);
    }
    if (!runtimeLockService.includes(`'${surface.operation}'`)) {
      fail(`Runtime protected-operation inventory is missing: ${surface.operation}`);
    }
  }
}

if (exists('RuntimeSafety.js')) {
  const runtimeSafety = read('RuntimeSafety.js');
  for (const rangeName of [
    'FO_RUNTIME_ENVIRONMENT',
    'FO_RUNTIME_WORKBOOK_ROLE'
  ]) {
    if (!runtimeSafety.includes(`'${rangeName}'`)) {
      fail(`Runtime workbook binding is missing named range: ${rangeName}`);
    }
  }
}

if (exists('eslint.config.js')) {
  const eslintConfig = read('eslint.config.js');
  if (!/files\s*:\s*\[\s*['"]\*\.js['"]/.test(eslintConfig)) {
    fail('ESLint must cover root Production JavaScript files');
  }
  for (const rule of ['no-undef', 'no-unused-vars', 'no-unreachable']) {
    if (!eslintConfig.includes(`'${rule}'`)) {
      fail(`Production ESLint rule is missing: ${rule}`);
    }
  }
}

if (exists('Menu.js')) {
  const menu = read('Menu.js');
  const menuReferenceRegex = /\.addItem\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  while ((match = menuReferenceRegex.exec(menu)) !== null) {
    const referencedFunction = match[1];
    if (!functionLocations.has(referencedFunction)) {
      fail(`Menu references undefined function: ${referencedFunction}`);
    }
  }
}

if (exists('ModuleRegistry.js')) {
  const registry = read('ModuleRegistry.js');
  const registryReferenceRegex = /^\s*[A-Z0-9_]+\s*:\s*([A-Za-z_$][\w$]*)\s*,?\s*$/gm;
  let match;
  while ((match = registryReferenceRegex.exec(registry)) !== null) {
    const referencedFunction = match[1];
    if (!functionLocations.has(referencedFunction)) {
      fail(`Module Registry references undefined function: ${referencedFunction}`);
    }
  }
}

if (exists('AutonomousCioOrchestrator.js')) {
  const orchestrator = read('AutonomousCioOrchestrator.js');
  const requiredOrder = [
    'HEALTH',
    'INTEGRITY',
    'VALIDATION',
    'MARKET_DATA',
    'VALUATION',
    'PORTFOLIO_DATA_INTEGRITY',
    'PERFORMANCE',
    'EXPOSURE',
    'IBKR_RECONCILIATION',
    'BUY_ZONE',
    'PORTFOLIO',
    'MARKET',
    'CIO',
    'REPORT',
    'DASHBOARD'
  ];

  let cursor = -1;
  for (const moduleName of requiredOrder) {
    const index = orchestrator.indexOf(`foGetModule('${moduleName}')`);
    if (index < 0) {
      fail(`Orchestrator is missing module step: ${moduleName}`);
    } else if (index < cursor) {
      fail(`Orchestrator module is out of order: ${moduleName}`);
    }
    cursor = Math.max(cursor, index);
  }
}

if (
  exists('package.json') &&
  exists('package-lock.json') &&
  exists('Config.js')
) {
  try {
    const packageVersion = JSON.parse(read('package.json')).version;
    const packageLock = JSON.parse(read('package-lock.json'));
    const lockVersion = packageLock.version;
    const lockRootVersion = packageLock.packages &&
      packageLock.packages[''] &&
      packageLock.packages[''].version;
    const config = read('Config.js');
    const versionMatch = config.match(/PLATFORM_VERSION\s*:\s*['"]v?(\d+\.\d+\.\d+)['"]/);
    if (!versionMatch) {
      fail('Could not find PLATFORM_VERSION in Config.js');
    }

    const versions = [
      ['package-lock.json top-level version', lockVersion],
      ['package-lock.json root-package version', lockRootVersion],
      ['Config.js PLATFORM_VERSION', versionMatch && versionMatch[1]]
    ];

    for (const [source, version] of versions) {
      if (!version) {
        fail(`Version is missing: ${source}`);
      } else if (version !== packageVersion) {
        fail(
          `Version mismatch: package.json=${packageVersion}, ` +
          `${source}=${version}`
        );
      }
    }
  } catch (error) {
    fail(`Version validation failed: ${error.message}`);
  }
}

const prohibitedExactFiles = [
  '.clasprc.json',
  '.env',
  'credentials.json',
  'service-account.json'
];

for (const file of prohibitedExactFiles) {
  if (exists(file)) fail(`Prohibited credential file is committed: ${file}`);
}

const secretPatterns = [
  { name: 'Google OAuth refresh token', regex: /"refresh_token"\s*:\s*"[^"]+"/i },
  { name: 'Google private key', regex: /-----BEGIN PRIVATE KEY-----/ },
  { name: 'Generic API key assignment', regex: /\b(?:api[_-]?key|client[_-]?secret)\b\s*[:=]\s*['"][^'"]{16,}['"]/i }
];

for (const source of sources) {
  for (const pattern of secretPatterns) {
    if (pattern.regex.test(source.text)) {
      fail(`${pattern.name} pattern detected in ${source.file}`);
    }
  }
}

const smokeTests = [...functionLocations.keys()]
  .filter((name) => /SmokeTest/i.test(name))
  .sort();

if (smokeTests.length === 0) {
  fail('No smoke-test functions were found');
}
if (!functionLocations.has('foRunRuntimeSafetySmokeTest')) {
  fail('Runtime Safety smoke-test function is missing');
}

console.log(`Validated ${sources.length} JavaScript files.`);
console.log(`Discovered ${functionLocations.size} global functions.`);
console.log(`Discovered ${smokeTests.length} smoke-test functions.`);
console.log(
  `Validated ${directWorkbookOpenCount} direct workbook open(s), ` +
  'confined to SpreadsheetService.js.'
);
console.log(`Warnings: ${warnings.length}`);
console.log(`Errors: ${errors.length}`);

if (errors.length > 0) process.exit(1);
