const fs = require('fs');
const path = require('path');
const globals = require('globals');

const productionFiles = fs.readdirSync(__dirname)
  .filter((file) => file.endsWith('.js') && file !== 'eslint.config.js');

const platformGlobals = productionFiles.reduce((result, file) => {
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const declarationPattern = /^(?:function\s+([A-Za-z_$][\w$]*)\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*))/gm;
  let match;

  while ((match = declarationPattern.exec(source)) !== null) {
    result[match[1] || match[2]] = 'readonly';
  }

  return result;
}, {});

module.exports = [
  {
    ignores: ['artifacts/**', 'coverage/**', 'node_modules/**']
  },
  {
    files: ['*.js'],
    ignores: ['eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.es2021,
        ...platformGlobals,
        console: 'readonly',
        DriveApp: 'readonly',
        LockService: 'readonly',
        Logger: 'readonly',
        PropertiesService: 'readonly',
        ScriptApp: 'readonly',
        Session: 'readonly',
        SpreadsheetApp: 'readonly',
        Utilities: 'readonly'
      }
    },
    rules: {
      'no-dupe-keys': 'error',
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrors: 'none',
        vars: 'local'
      }],
      'valid-typeof': 'error'
    }
  },
  {
    files: [
      'CioDecisionEngine.js',
      'InvestmentDecisionSupportEngine.js',
      'MarketIntelligenceEngine.js'
    ],
    rules: {
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        caughtErrors: 'none',
        vars: 'local'
      }]
    }
  },
  {
    files: ['PositionRiskEngineA22.js'],
    rules: {
      'no-undef': 'warn'
    }
  },
  {
    files: ['scripts/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: globals.node
    }
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest
      }
    }
  }
];
