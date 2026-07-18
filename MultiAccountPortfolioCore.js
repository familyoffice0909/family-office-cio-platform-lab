/**
 * Release 2.1.0 — Multi-Account Portfolio Intelligence Core.
 *
 * This module owns the in-memory portfolio domain, account registry, unified
 * aggregation, and descriptive concentration analysis. The Family Office
 * Portfolio Dashboard remains the authoritative operational holdings source.
 */

const FO_DEFAULT_ACCOUNT_ID = 'DEFAULT-ACCOUNT';
const FO_DEFAULT_ACCOUNT_NAME = 'Default Account';
const FO_UNKNOWN_PORTFOLIO_DIMENSION = 'Unknown';

const AccountType = Object.freeze({
  DEFAULT: 'DEFAULT',
  TFSA: 'TFSA',
  RRSP: 'RRSP',
  LIRA: 'LIRA',
  RESP: 'RESP',
  FHSA: 'FHSA',
  TAXABLE: 'TAXABLE',
  CORPORATE: 'CORPORATE',
  TRUST: 'TRUST',
  CASH: 'CASH',
  OTHER: 'OTHER'
});

function Holdings(items) {
  if (!(this instanceof Holdings)) return new Holdings(items);

  const source = items === undefined || items === null ? [] : items;
  if (!Array.isArray(source)) {
    throw new Error('Holdings must be provided as an array.');
  }

  this._items = Object.freeze(source.map(function(item, index) {
    return foNormalizeHolding_(item, index);
  }));
  Object.freeze(this);
}

Holdings.prototype.getAll = function() {
  return this._items.slice();
};

Holdings.prototype.getTotalMarketValue = function() {
  return this._items.reduce(function(total, holding) {
    return total + holding.marketValue;
  }, 0);
};

function InvestmentAccount(input) {
  if (!(this instanceof InvestmentAccount)) return new InvestmentAccount(input);

  const source = input && typeof input === 'object' ? input : {};
  const accountId = foRequiredPortfolioText_(source.accountId, 'accountId');
  const name = foRequiredPortfolioText_(source.name, 'name');
  const type = foNormalizeAccountType_(source.type);
  const currency = foPortfolioText_(source.currency, 'CAD').toUpperCase();

  this.accountId = accountId;
  this.name = name;
  this.type = type;
  this.currency = currency;
  this.holdings = source.holdings instanceof Holdings
    ? source.holdings
    : new Holdings(source.holdings);
  Object.freeze(this);
}

function HouseholdPortfolio(input) {
  if (!(this instanceof HouseholdPortfolio)) return new HouseholdPortfolio(input);

  const source = input && typeof input === 'object' ? input : {};
  const accounts = source.accounts === undefined || source.accounts === null
    ? []
    : source.accounts;

  if (!Array.isArray(accounts)) {
    throw new Error('HouseholdPortfolio accounts must be provided as an array.');
  }

  const seenAccountIds = {};
  this.baseCurrency = foPortfolioText_(source.baseCurrency, 'CAD').toUpperCase();
  this.accounts = Object.freeze(accounts.map(function(account) {
    const normalized = account instanceof InvestmentAccount
      ? account
      : new InvestmentAccount(account);
    const key = normalized.accountId.toUpperCase();

    if (seenAccountIds[key]) {
      throw new Error('Duplicate accountId: ' + normalized.accountId + '.');
    }
    seenAccountIds[key] = true;
    return normalized;
  }));
  Object.freeze(this);
}

function AccountRegistry(input) {
  if (!(this instanceof AccountRegistry)) return new AccountRegistry(input);

  const portfolio = foMigrateLegacyPortfolio(input);
  this._baseCurrency = portfolio.baseCurrency;
  this._accounts = portfolio.accounts.slice();
}

AccountRegistry.prototype.addAccount = function(account) {
  const normalized = account instanceof InvestmentAccount
    ? account
    : new InvestmentAccount(account);

  if (this._findAccountIndex_(normalized.accountId) >= 0) {
    throw new Error('Account already exists: ' + normalized.accountId + '.');
  }

  this._accounts.push(normalized);
  return normalized;
};

AccountRegistry.prototype.removeAccount = function(accountId) {
  const index = this._findAccountIndex_(accountId);
  if (index < 0) {
    throw new Error('Account not found: ' + accountId + '.');
  }

  return this._accounts.splice(index, 1)[0];
};

AccountRegistry.prototype.updateHoldings = function(accountId, holdings) {
  const index = this._findAccountIndex_(accountId);
  if (index < 0) {
    throw new Error('Account not found: ' + accountId + '.');
  }

  const current = this._accounts[index];
  const updated = new InvestmentAccount({
    accountId: current.accountId,
    name: current.name,
    type: current.type,
    currency: current.currency,
    holdings: holdings
  });
  this._accounts[index] = updated;
  return updated;
};

AccountRegistry.prototype.refreshMarketValues = function(priceSource) {
  if (typeof priceSource !== 'function' && (
    !priceSource || typeof priceSource !== 'object'
  )) {
    throw new Error('refreshMarketValues requires a price function or price map.');
  }

  const refreshedAccounts = this._accounts.map(function(account) {
    const refreshedHoldings = account.holdings.getAll().map(function(holding) {
      const candidate = typeof priceSource === 'function'
        ? priceSource(holding.securityId, holding, account)
        : foReadPortfolioPrice_(priceSource, holding);

      if (candidate === undefined || candidate === null || candidate === '') {
        return holding;
      }

      const currentPrice = foRequiredPortfolioNumber_(
        candidate,
        'currentPrice for ' + holding.securityId
      );
      if (currentPrice < 0) {
        throw new Error('Market price cannot be negative for ' + holding.securityId + '.');
      }

      return Object.assign({}, holding, {
        currentPrice: currentPrice,
        marketValue: holding.quantity === null
          ? holding.marketValue
          : holding.quantity * currentPrice
      });
    });

    return new InvestmentAccount({
      accountId: account.accountId,
      name: account.name,
      type: account.type,
      currency: account.currency,
      holdings: refreshedHoldings
    });
  });

  this._accounts = refreshedAccounts;
  return this.getAccounts();
};

AccountRegistry.prototype.getAccounts = function() {
  return this._accounts.slice();
};

AccountRegistry.prototype.getHouseholdPortfolio = function() {
  return new HouseholdPortfolio({
    baseCurrency: this._baseCurrency,
    accounts: this._accounts
  });
};

AccountRegistry.prototype._findAccountIndex_ = function(accountId) {
  const key = foRequiredPortfolioText_(accountId, 'accountId').toUpperCase();
  return this._accounts.findIndex(function(account) {
    return account.accountId.toUpperCase() === key;
  });
};

function foCreateAccountRegistry(input) {
  return new AccountRegistry(input);
}

function foMigrateLegacyPortfolio(input, baseCurrency) {
  if (input instanceof HouseholdPortfolio) return input;

  const currency = foPortfolioText_(
    baseCurrency || (input && input.baseCurrency),
    'CAD'
  ).toUpperCase();

  if (input && Array.isArray(input.accounts)) {
    return new HouseholdPortfolio({
      baseCurrency: currency,
      accounts: input.accounts
    });
  }

  const legacyHoldings = Array.isArray(input)
    ? input
    : input && Array.isArray(input.holdings)
      ? input.holdings
      : input && Array.isArray(input.positions)
        ? input.positions
        : [];

  return new HouseholdPortfolio({
    baseCurrency: currency,
    accounts: [{
      accountId: FO_DEFAULT_ACCOUNT_ID,
      name: FO_DEFAULT_ACCOUNT_NAME,
      type: AccountType.DEFAULT,
      currency: currency,
      holdings: legacyHoldings
    }]
  });
}

function foCreateHouseholdPortfolioFromPositions(positions, baseCurrency) {
  if (!Array.isArray(positions)) {
    throw new Error('Portfolio positions must be provided as an array.');
  }

  const currency = foPortfolioText_(baseCurrency, 'CAD').toUpperCase();
  const grouped = {};
  const order = [];
  const usedAccountIds = {};

  positions.forEach(function(position) {
    const source = position && typeof position === 'object' ? position : {};
    const accountName = foPortfolioText_(source.account, FO_DEFAULT_ACCOUNT_NAME);
    const accountKey = accountName.toUpperCase();
    let accountId = accountName === FO_DEFAULT_ACCOUNT_NAME
      ? FO_DEFAULT_ACCOUNT_ID
      : foAccountIdFromName_(accountName);

    if (!grouped[accountKey]) {
      if (usedAccountIds[accountId]) {
        accountId += '-' + (order.length + 1);
      }
      usedAccountIds[accountId] = true;
      grouped[accountKey] = {
        accountId: accountId,
        name: accountName,
        type: foInferAccountType_(accountName),
        currency: currency,
        holdings: []
      };
      order.push(accountKey);
    }
    grouped[accountKey].holdings.push(source);
  });

  if (!order.length) {
    return foMigrateLegacyPortfolio([], currency);
  }

  return new HouseholdPortfolio({
    baseCurrency: currency,
    accounts: order.map(function(accountKey) {
      return grouped[accountKey];
    })
  });
}

function foBuildUnifiedPortfolioIntelligence(portfolio, options) {
  const household = foMigrateLegacyPortfolio(portfolio);
  const config = options && typeof options === 'object' ? options : {};
  const largestHoldingLimit = config.largestHoldingLimit === undefined
    ? 10
    : foRequiredPortfolioNumber_(config.largestHoldingLimit, 'largestHoldingLimit');

  if (largestHoldingLimit < 0 || Math.floor(largestHoldingLimit) !== largestHoldingLimit) {
    throw new Error('largestHoldingLimit must be a non-negative integer.');
  }

  const entries = foFlattenHouseholdHoldings_(household);
  const totalMarketValue = entries.reduce(function(total, entry) {
    return total + entry.holding.marketValue;
  }, 0);
  const allocations = {
    sector: foBuildPortfolioAllocation_(entries, 'sector', totalMarketValue),
    country: foBuildPortfolioAllocation_(entries, 'country', totalMarketValue),
    currency: foBuildPortfolioAllocation_(entries, 'currency', totalMarketValue),
    assetClass: foBuildPortfolioAllocation_(entries, 'assetClass', totalMarketValue)
  };
  const securityExposure = foBuildSecurityExposure_(entries, totalMarketValue);

  return Object.freeze({
    baseCurrency: household.baseCurrency,
    accountCount: household.accounts.length,
    holdingCount: entries.length,
    totalMarketValue: totalMarketValue,
    allocations: Object.freeze(allocations),
    largestHoldings: Object.freeze(securityExposure.slice(0, largestHoldingLimit))
  });
}

function foAnalyzeDuplicateExposure(portfolio) {
  const household = foMigrateLegacyPortfolio(portfolio);
  const intelligence = foBuildUnifiedPortfolioIntelligence(household, {
    largestHoldingLimit: Number.MAX_SAFE_INTEGER
  });
  const entries = foFlattenHouseholdHoldings_(household);
  const securityExposure = foBuildSecurityExposure_(
    entries,
    intelligence.totalMarketValue
  );

  return Object.freeze({
    duplicateHoldings: Object.freeze(securityExposure.filter(function(exposure) {
      return exposure.accountCount > 1;
    })),
    sectorConcentration: intelligence.allocations.sector,
    currencyConcentration: intelligence.allocations.currency,
    securityConcentration: Object.freeze(securityExposure)
  });
}

function foNormalizeHolding_(input, index) {
  const source = input && typeof input === 'object' ? input : {};
  const ticker = foPortfolioText_(source.ticker || source.symbol, '').toUpperCase();
  const securityId = foPortfolioText_(source.securityId || ticker, '').toUpperCase();

  if (!securityId) {
    throw new Error('Holding at index ' + index + ' requires securityId or ticker.');
  }

  const quantity = foOptionalPortfolioNumber_(source.quantity, 'quantity');
  const currentPrice = foOptionalPortfolioNumber_(
    source.currentPrice === undefined ? source.price : source.currentPrice,
    'currentPrice'
  );
  const explicitMarketValue = source.marketValue === undefined
    ? source.marketValueCAD
    : source.marketValue;
  let marketValue = foOptionalPortfolioNumber_(explicitMarketValue, 'marketValue');

  if (quantity !== null && quantity < 0) {
    throw new Error('Holding quantity cannot be negative for ' + securityId + '.');
  }
  if (currentPrice !== null && currentPrice < 0) {
    throw new Error('Current price cannot be negative for ' + securityId + '.');
  }
  if (marketValue !== null && marketValue < 0) {
    throw new Error('Market value cannot be negative for ' + securityId + '.');
  }
  if (marketValue === null) {
    marketValue = quantity !== null && currentPrice !== null
      ? quantity * currentPrice
      : 0;
  }

  return Object.freeze({
    securityId: securityId,
    ticker: ticker || securityId,
    name: foPortfolioText_(source.name || source.company, ''),
    quantity: quantity,
    currentPrice: currentPrice,
    marketValue: marketValue,
    sector: foPortfolioText_(source.sector, FO_UNKNOWN_PORTFOLIO_DIMENSION),
    country: foPortfolioText_(source.country, FO_UNKNOWN_PORTFOLIO_DIMENSION),
    currency: foPortfolioText_(
      source.currency || source.nativeCurrency,
      FO_UNKNOWN_PORTFOLIO_DIMENSION
    ).toUpperCase(),
    assetClass: foPortfolioText_(source.assetClass, FO_UNKNOWN_PORTFOLIO_DIMENSION)
  });
}

function foFlattenHouseholdHoldings_(household) {
  const entries = [];
  household.accounts.forEach(function(account) {
    account.holdings.getAll().forEach(function(holding) {
      entries.push({ account: account, holding: holding });
    });
  });
  return entries;
}

function foBuildPortfolioAllocation_(entries, field, totalMarketValue) {
  const groups = {};
  entries.forEach(function(entry) {
    const name = entry.holding[field] || FO_UNKNOWN_PORTFOLIO_DIMENSION;
    if (!groups[name]) {
      groups[name] = { name: name, marketValue: 0, holdingCount: 0 };
    }
    groups[name].marketValue += entry.holding.marketValue;
    groups[name].holdingCount++;
  });

  return Object.freeze(Object.keys(groups).map(function(name) {
    const group = groups[name];
    return Object.freeze({
      name: group.name,
      marketValue: group.marketValue,
      weight: totalMarketValue > 0 ? group.marketValue / totalMarketValue : 0,
      holdingCount: group.holdingCount
    });
  }).sort(foSortPortfolioExposure_));
}

function foBuildSecurityExposure_(entries, totalMarketValue) {
  const securities = {};
  entries.forEach(function(entry) {
    const holding = entry.holding;
    const key = holding.securityId;
    if (!securities[key]) {
      securities[key] = {
        securityId: key,
        ticker: holding.ticker,
        name: holding.name,
        marketValue: 0,
        holdingCount: 0,
        accounts: {}
      };
    }
    securities[key].marketValue += holding.marketValue;
    securities[key].holdingCount++;
    securities[key].accounts[entry.account.accountId] = entry.account.name;
  });

  return Object.keys(securities).map(function(key) {
    const security = securities[key];
    const accountIds = Object.keys(security.accounts).sort();
    return Object.freeze({
      securityId: security.securityId,
      ticker: security.ticker,
      name: security.name,
      marketValue: security.marketValue,
      weight: totalMarketValue > 0 ? security.marketValue / totalMarketValue : 0,
      holdingCount: security.holdingCount,
      accountCount: accountIds.length,
      accountIds: Object.freeze(accountIds),
      accountNames: Object.freeze(accountIds.map(function(accountId) {
        return security.accounts[accountId];
      }))
    });
  }).sort(foSortPortfolioExposure_);
}

function foSortPortfolioExposure_(left, right) {
  if (right.marketValue !== left.marketValue) {
    return right.marketValue - left.marketValue;
  }
  const leftName = left.name || left.securityId || '';
  const rightName = right.name || right.securityId || '';
  return String(leftName).localeCompare(String(rightName));
}

function foNormalizeAccountType_(value) {
  const normalized = foPortfolioText_(value, AccountType.OTHER).toUpperCase();
  const validTypes = Object.keys(AccountType).map(function(key) {
    return AccountType[key];
  });
  if (validTypes.indexOf(normalized) < 0) {
    throw new Error('Unsupported AccountType: ' + normalized + '.');
  }
  return normalized;
}

function foInferAccountType_(accountName) {
  const normalized = foPortfolioText_(accountName, '').toUpperCase();
  if (normalized === FO_DEFAULT_ACCOUNT_NAME.toUpperCase()) {
    return AccountType.DEFAULT;
  }
  return Object.prototype.hasOwnProperty.call(AccountType, normalized)
    ? AccountType[normalized]
    : AccountType.OTHER;
}

function foAccountIdFromName_(accountName) {
  const slug = foRequiredPortfolioText_(accountName, 'account name')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return 'ACCOUNT-' + slug;
}

function foReadPortfolioPrice_(priceMap, holding) {
  if (Object.prototype.hasOwnProperty.call(priceMap, holding.securityId)) {
    return priceMap[holding.securityId];
  }
  if (Object.prototype.hasOwnProperty.call(priceMap, holding.ticker)) {
    return priceMap[holding.ticker];
  }
  return undefined;
}

function foPortfolioText_(value, fallback) {
  const normalized = value === undefined || value === null
    ? ''
    : String(value).trim();
  return normalized || fallback;
}

function foRequiredPortfolioText_(value, field) {
  const normalized = foPortfolioText_(value, '');
  if (!normalized) {
    throw new Error('Required portfolio field is missing: ' + field + '.');
  }
  return normalized;
}

function foOptionalPortfolioNumber_(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return foRequiredPortfolioNumber_(value, field);
}

function foRequiredPortfolioNumber_(value, field) {
  const normalized = typeof value === 'string'
    ? value.replace(/[$,%]/g, '').trim()
    : value;
  const number = Number(normalized);
  if (!Number.isFinite(number)) {
    throw new Error('Portfolio field must be a finite number: ' + field + '.');
  }
  return number;
}

function foRunMultiAccountPortfolioCoreSmokeTest() {
  const module = 'MultiAccountPortfolioCore';

  try {
    foInfo_(module, 'Start', 'Multi-account portfolio core smoke test started.');

    const portfolio = new HouseholdPortfolio({
      accounts: [
        {
          accountId: 'SMOKE-ACCOUNT-1',
          name: 'Synthetic Account 1',
          type: AccountType.OTHER,
          holdings: [{
            ticker: 'SYNTHETIC-A',
            marketValue: 100,
            sector: 'Synthetic Sector',
            country: 'Synthetic Country',
            currency: 'CAD',
            assetClass: 'Synthetic Asset'
          }]
        },
        {
          accountId: 'SMOKE-ACCOUNT-2',
          name: 'Synthetic Account 2',
          type: AccountType.OTHER,
          holdings: [{
            ticker: 'SYNTHETIC-A',
            marketValue: 150,
            sector: 'Synthetic Sector',
            country: 'Synthetic Country',
            currency: 'CAD',
            assetClass: 'Synthetic Asset'
          }]
        }
      ]
    });
    const intelligence = foBuildUnifiedPortfolioIntelligence(portfolio);
    const duplicateExposure = foAnalyzeDuplicateExposure(portfolio);

    if (
      intelligence.accountCount !== 2 ||
      intelligence.totalMarketValue !== 250 ||
      duplicateExposure.duplicateHoldings.length !== 1
    ) {
      throw new Error('Synthetic multi-account intelligence result was invalid.');
    }

    const result = {
      status: 'PASS',
      accounts: intelligence.accountCount,
      holdings: intelligence.holdingCount,
      totalMarketValue: intelligence.totalMarketValue,
      duplicateHoldings: duplicateExposure.duplicateHoldings.length
    };

    foInfo_(module, 'Complete', 'Multi-account portfolio core smoke test passed.');
    return result;
  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}
