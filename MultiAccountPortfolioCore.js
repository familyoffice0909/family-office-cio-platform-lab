/**
 * Release 2.1.0 RC2 — Multi-Account Portfolio Intelligence Core.
 *
 * This module owns the in-memory portfolio domain, account registry, unified
 * aggregation, and descriptive concentration analysis. The Family Office
 * Portfolio Dashboard remains the authoritative operational holdings source.
 */

const FO_DEFAULT_ACCOUNT_ID = 'DEFAULT-ACCOUNT';
const FO_DEFAULT_ACCOUNT_NAME = 'Default Account';
const FO_UNKNOWN_PORTFOLIO_DIMENSION = 'Unknown';
const FO_HOUSEHOLD_AGGREGATION_CONTRACT = 'HOUSEHOLD_PORTFOLIO_AGGREGATION_V1';
const FO_MARKET_VALUE_CONTRACT = 'HOUSEHOLD_BASE_CURRENCY';

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

Holdings.prototype.getTotalMarketValue = function(baseCurrency) {
  const currency = foNormalizeCurrencyCode_(
    foPortfolioText_(baseCurrency, 'CAD'),
    'baseCurrency'
  );
  return foAggregateHouseholdPortfolio(new HouseholdPortfolio({
    baseCurrency: currency,
    accounts: [{
      accountId: FO_DEFAULT_ACCOUNT_ID,
      name: FO_DEFAULT_ACCOUNT_NAME,
      type: AccountType.DEFAULT,
      currency: currency,
      holdings: this
    }]
  })).totalMarketValue;
};

function InvestmentAccount(input) {
  if (!(this instanceof InvestmentAccount)) return new InvestmentAccount(input);

  const source = input && typeof input === 'object' ? input : {};
  const accountId = foNormalizeAccountId_(
    foRequiredPortfolioText_(source.accountId, 'accountId')
  );
  const name = foNormalizeAccountName_(
    foRequiredPortfolioText_(source.name, 'name')
  );
  const type = foNormalizeAccountType_(
    foRequiredPortfolioText_(source.type, 'type')
  );
  const currency = foNormalizeCurrencyCode_(
    foRequiredPortfolioText_(source.currency, 'currency'),
    'currency'
  );

  if (source.holdings === undefined || source.holdings === null) {
    throw new Error('Required portfolio field is missing: holdings.');
  }

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
  this.baseCurrency = foNormalizeCurrencyCode_(
    foPortfolioText_(source.baseCurrency, 'CAD'),
    'baseCurrency'
  );
  this.accounts = Object.freeze(accounts.map(function(account) {
    const normalized = account instanceof InvestmentAccount
      ? account
      : new InvestmentAccount(account);
    const key = normalized.accountId;

    if (seenAccountIds[key]) {
      throw new Error('Duplicate accountId: ' + normalized.accountId + '.');
    }
    seenAccountIds[key] = true;
    foValidateAccountMarketValueContract_(normalized, this.baseCurrency);
    return normalized;
  }, this));
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

  foValidateAccountMarketValueContract_(normalized, this._baseCurrency);
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
  foValidateAccountMarketValueContract_(updated, this._baseCurrency);
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

      const price = foNormalizePortfolioPriceCandidate_(candidate);
      const currentPrice = foRequiredPortfolioNumber_(
        price.value,
        'currentPrice for ' + holding.securityId
      );
      if (currentPrice < 0) {
        throw new Error('Market price cannot be negative for ' + holding.securityId + '.');
      }
      if (price.currency && price.currency !== this._baseCurrency) {
        throw new Error(
          'Market price currency must match household base currency ' +
          this._baseCurrency + ' for ' + holding.securityId + '.'
        );
      }

      return Object.assign({}, holding, {
        currentPrice: currentPrice,
        currentPriceCurrency: this._baseCurrency,
        marketValue: holding.quantity === null
          ? holding.marketValue
          : holding.quantity * currentPrice,
        marketValueCurrency: this._baseCurrency
      });
    }, this);

    return new InvestmentAccount({
      accountId: account.accountId,
      name: account.name,
      type: account.type,
      currency: account.currency,
      holdings: refreshedHoldings
    });
  }, this);

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
  const key = foNormalizeAccountId_(accountId);
  return this._accounts.findIndex(function(account) {
    return account.accountId === key;
  });
};

function foCreateAccountRegistry(input) {
  return new AccountRegistry(input);
}

function foMigrateLegacyPortfolio(input, baseCurrency) {
  if (input instanceof HouseholdPortfolio) return input;

  const currency = foNormalizeCurrencyCode_(foPortfolioText_(
    baseCurrency || (input && input.baseCurrency),
    'CAD'
  ), 'baseCurrency');

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

  const currency = foNormalizeCurrencyCode_(
    foPortfolioText_(baseCurrency, 'CAD'),
    'baseCurrency'
  );
  const grouped = {};
  const order = [];

  positions.forEach(function(position, positionIndex) {
    const source = position && typeof position === 'object' ? position : {};
    const identity = foNormalizeAccountIdentity_(source.account);
    const accountKey = identity.accountId;

    if (!grouped[accountKey]) {
      grouped[accountKey] = {
        accountId: identity.accountId,
        name: identity.name,
        type: identity.type,
        currency: currency,
        holdings: []
      };
      order.push(accountKey);
    }
    grouped[accountKey].holdings.push(Object.assign({}, source, {
      account: identity.name,
      accountId: identity.accountId,
      ingestionOrder: positionIndex,
      marketValueCurrency: source.marketValueCurrency ||
        (source.marketValue === undefined && source.marketValueCAD !== undefined
          ? 'CAD'
          : currency),
      currentPriceCurrency: source.currentPriceCurrency || source.priceCurrency || currency
    }));
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

function foAggregateHouseholdPortfolio(portfolio) {
  const household = foMigrateLegacyPortfolio(portfolio);
  const entries = foFlattenHouseholdHoldings_(household);
  const totalMarketValue = entries.reduce(function(total, entry) {
    return total + entry.holding.marketValue;
  }, 0);
  const totalCostBasis = entries.reduce(function(total, entry) {
    return total + (entry.holding.costBasis === null ? 0 : entry.holding.costBasis);
  }, 0);
  const allocations = Object.freeze({
    account: foBuildPortfolioAllocation_(entries, 'account', totalMarketValue),
    sector: foBuildPortfolioAllocation_(entries, 'sector', totalMarketValue),
    country: foBuildPortfolioAllocation_(entries, 'country', totalMarketValue),
    currency: foBuildPortfolioAllocation_(entries, 'currency', totalMarketValue),
    assetClass: foBuildPortfolioAllocation_(entries, 'assetClass', totalMarketValue)
  });
  const securityExposure = Object.freeze(
    foBuildSecurityExposure_(entries, totalMarketValue)
  );
  const positions = Object.freeze(
    foBuildAggregatedPortfolioPositions_(entries, totalMarketValue, household.baseCurrency)
  );
  const crossAccountDuplicates = Object.freeze(securityExposure.filter(function(exposure) {
    return exposure.accountCount > 1;
  }));
  const sameAccountDuplicates = Object.freeze(securityExposure.filter(function(exposure) {
    return exposure.sameAccountIds.length > 0;
  }));
  const allDuplicates = Object.freeze(securityExposure.filter(function(exposure) {
    return exposure.holdingCount > 1;
  }));
  const concentration = foBuildSecurityConcentration_(securityExposure, totalMarketValue);

  return Object.freeze({
    contract: FO_HOUSEHOLD_AGGREGATION_CONTRACT,
    marketValueContract: FO_MARKET_VALUE_CONTRACT,
    baseCurrency: household.baseCurrency,
    marketValueCurrency: household.baseCurrency,
    accountCount: household.accounts.length,
    holdingCount: entries.length,
    totalMarketValue: totalMarketValue,
    totalCostBasis: totalCostBasis,
    positions: positions,
    allocations: allocations,
    securityExposure: securityExposure,
    concentration: concentration,
    duplicates: Object.freeze({
      crossAccount: crossAccountDuplicates,
      sameAccount: sameAccountDuplicates,
      all: allDuplicates
    })
  });
}

function foBuildUnifiedPortfolioIntelligence(portfolioOrAggregation, options) {
  const aggregation = foResolveHouseholdAggregation_(portfolioOrAggregation);
  const config = options && typeof options === 'object' ? options : {};
  const largestHoldingLimit = config.largestHoldingLimit === undefined
    ? 10
    : foRequiredPortfolioNumber_(config.largestHoldingLimit, 'largestHoldingLimit');

  if (largestHoldingLimit < 0 || Math.floor(largestHoldingLimit) !== largestHoldingLimit) {
    throw new Error('largestHoldingLimit must be a non-negative integer.');
  }

  return Object.freeze({
    baseCurrency: aggregation.baseCurrency,
    accountCount: aggregation.accountCount,
    holdingCount: aggregation.holdingCount,
    totalMarketValue: aggregation.totalMarketValue,
    allocations: Object.freeze({
      sector: foProjectPortfolioAllocation_(aggregation.allocations.sector),
      country: foProjectPortfolioAllocation_(aggregation.allocations.country),
      currency: foProjectPortfolioAllocation_(aggregation.allocations.currency),
      assetClass: foProjectPortfolioAllocation_(aggregation.allocations.assetClass)
    }),
    largestHoldings: Object.freeze(
      aggregation.securityExposure.slice(0, largestHoldingLimit)
    )
  });
}

function foAnalyzeDuplicateExposure(portfolioOrAggregation) {
  const aggregation = foResolveHouseholdAggregation_(portfolioOrAggregation);

  return Object.freeze({
    duplicateHoldings: aggregation.duplicates.crossAccount,
    crossAccountDuplicates: aggregation.duplicates.crossAccount,
    sameAccountDuplicates: aggregation.duplicates.sameAccount,
    allDuplicates: aggregation.duplicates.all,
    sectorConcentration: foProjectPortfolioAllocation_(aggregation.allocations.sector),
    currencyConcentration: foProjectPortfolioAllocation_(aggregation.allocations.currency),
    securityConcentration: aggregation.securityExposure
  });
}

function foNormalizeHolding_(input, index) {
  const source = input && typeof input === 'object' ? input : {};
  const ticker = foPortfolioText_(source.ticker || source.symbol, '').toUpperCase();
  const securityIdentity = foResolveSecurityIdentity_(source, ticker);
  const securityId = securityIdentity.securityId;

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
  const costBasis = foOptionalPortfolioNumber_(source.costBasis, 'costBasis');

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
    securityIdSource: securityIdentity.source,
    securityIdentityKey: securityIdentity.key,
    ticker: ticker || securityId,
    name: foPortfolioText_(source.name || source.company, ''),
    quantity: quantity,
    currentPrice: currentPrice,
    currentPriceCurrency: foOptionalCurrencyCode_(
      source.currentPriceCurrency || source.priceCurrency,
      'currentPriceCurrency'
    ),
    marketValue: marketValue,
    marketValueCurrency: foOptionalCurrencyCode_(
      source.marketValueCurrency || source.valuationCurrency ||
        (source.marketValue === undefined && source.marketValueCAD !== undefined ? 'CAD' : ''),
      'marketValueCurrency'
    ),
    costBasis: costBasis,
    sector: foPortfolioText_(source.sector, FO_UNKNOWN_PORTFOLIO_DIMENSION),
    country: foPortfolioText_(source.country, FO_UNKNOWN_PORTFOLIO_DIMENSION),
    currency: foPortfolioText_(
      source.currency || source.nativeCurrency,
      FO_UNKNOWN_PORTFOLIO_DIMENSION
    ).toUpperCase(),
    assetClass: foPortfolioText_(source.assetClass, FO_UNKNOWN_PORTFOLIO_DIMENSION),
    theme: foPortfolioText_(source.theme, ''),
    targetWeight: foOptionalPortfolioNumber_(source.targetWeight, 'targetWeight'),
    rowNumber: source.rowNumber === undefined ? null : source.rowNumber,
    positionId: foPortfolioText_(source.positionId, ''),
    ingestionOrder: source.ingestionOrder === undefined
      ? null
      : foRequiredPortfolioNumber_(source.ingestionOrder, 'ingestionOrder')
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
    const name = field === 'account'
      ? entry.account.name
      : entry.holding[field] || FO_UNKNOWN_PORTFOLIO_DIMENSION;
    if (!groups[name]) {
      groups[name] = {
        name: name,
        marketValue: 0,
        costBasis: 0,
        holdingCount: 0,
        tickers: {}
      };
    }
    groups[name].marketValue += entry.holding.marketValue;
    groups[name].costBasis += entry.holding.costBasis === null
      ? 0
      : entry.holding.costBasis;
    groups[name].holdingCount++;
    groups[name].tickers[entry.holding.ticker] = true;
  });

  return Object.freeze(Object.keys(groups).map(function(name) {
    const group = groups[name];
    return Object.freeze({
      name: group.name,
      marketValue: group.marketValue,
      weight: totalMarketValue > 0 ? group.marketValue / totalMarketValue : 0,
      holdingCount: group.holdingCount,
      costBasis: group.costBasis,
      gainLoss: group.marketValue - group.costBasis,
      returnPct: group.costBasis > 0
        ? (group.marketValue - group.costBasis) / group.costBasis
        : 0,
      tickers: Object.freeze(Object.keys(group.tickers).sort())
    });
  }).sort(foSortPortfolioExposure_));
}

function foBuildSecurityExposure_(entries, totalMarketValue) {
  const securities = {};
  entries.forEach(function(entry) {
    const holding = entry.holding;
    const key = holding.securityIdentityKey;
    if (!securities[key]) {
      securities[key] = {
        securityId: holding.securityId,
        securityIdSource: holding.securityIdSource,
        ticker: holding.ticker,
        name: holding.name,
        marketValue: 0,
        costBasis: 0,
        holdingCount: 0,
        accounts: {},
        accountHoldingCounts: {}
      };
    }
    securities[key].marketValue += holding.marketValue;
    securities[key].costBasis += holding.costBasis === null ? 0 : holding.costBasis;
    securities[key].holdingCount++;
    securities[key].accounts[entry.account.accountId] = entry.account.name;
    securities[key].accountHoldingCounts[entry.account.accountId] =
      (securities[key].accountHoldingCounts[entry.account.accountId] || 0) + 1;
  });

  return Object.keys(securities).map(function(key) {
    const security = securities[key];
    const accountIds = Object.keys(security.accounts).sort();
    const sameAccountIds = accountIds.filter(function(accountId) {
      return security.accountHoldingCounts[accountId] > 1;
    });
    return Object.freeze({
      securityId: security.securityId,
      securityIdSource: security.securityIdSource,
      ticker: security.ticker,
      name: security.name,
      marketValue: security.marketValue,
      costBasis: security.costBasis,
      gainLoss: security.marketValue - security.costBasis,
      weight: totalMarketValue > 0 ? security.marketValue / totalMarketValue : 0,
      holdingCount: security.holdingCount,
      accountCount: accountIds.length,
      accountIds: Object.freeze(accountIds),
      sameAccountIds: Object.freeze(sameAccountIds),
      accountNames: Object.freeze(accountIds.map(function(accountId) {
        return security.accounts[accountId];
      }))
    });
  }).sort(foSortPortfolioExposure_);
}

function foBuildAggregatedPortfolioPositions_(entries, totalMarketValue, baseCurrency) {
  return entries.map(function(entry) {
    const holding = entry.holding;
    return Object.freeze({
      accountId: entry.account.accountId,
      accountName: entry.account.name,
      account: entry.account.name,
      accountType: entry.account.type,
      accountCurrency: entry.account.currency,
      securityId: holding.securityId,
      securityIdSource: holding.securityIdSource,
      ticker: holding.ticker,
      name: holding.name,
      company: holding.name,
      quantity: holding.quantity,
      currentPrice: holding.currentPrice,
      currentPriceCurrency: holding.currentPriceCurrency,
      marketValue: holding.marketValue,
      marketValueCurrency: baseCurrency,
      costBasis: holding.costBasis,
      weight: totalMarketValue > 0 ? holding.marketValue / totalMarketValue : 0,
      sector: holding.sector,
      country: holding.country,
      currency: holding.currency,
      assetClass: holding.assetClass,
      theme: holding.theme,
      targetWeight: holding.targetWeight,
      rowNumber: holding.rowNumber,
      positionId: holding.positionId,
      ingestionOrder: holding.ingestionOrder
    });
  }).sort(function(left, right) {
    if (left.ingestionOrder === null || right.ingestionOrder === null) return 0;
    return left.ingestionOrder - right.ingestionOrder;
  });
}

function foBuildSecurityConcentration_(securityExposure, totalMarketValue) {
  const top3 = securityExposure.slice(0, 3);
  const top5 = securityExposure.slice(0, 5);
  const top3Value = top3.reduce(function(total, exposure) {
    return total + exposure.marketValue;
  }, 0);
  const top5Value = top5.reduce(function(total, exposure) {
    return total + exposure.marketValue;
  }, 0);

  return Object.freeze({
    largestSecurity: securityExposure.length ? securityExposure[0] : null,
    top3: Object.freeze(top3),
    top5: Object.freeze(top5),
    top3MarketValue: top3Value,
    top5MarketValue: top5Value,
    top3Weight: totalMarketValue > 0 ? top3Value / totalMarketValue : 0,
    top5Weight: totalMarketValue > 0 ? top5Value / totalMarketValue : 0
  });
}

function foProjectPortfolioAllocation_(allocation) {
  return Object.freeze(allocation.map(function(group) {
    return Object.freeze({
      name: group.name,
      marketValue: group.marketValue,
      weight: group.weight,
      holdingCount: group.holdingCount
    });
  }));
}

function foResolveHouseholdAggregation_(portfolioOrAggregation) {
  if (
    portfolioOrAggregation &&
    portfolioOrAggregation.contract === FO_HOUSEHOLD_AGGREGATION_CONTRACT
  ) {
    return portfolioOrAggregation;
  }
  return foAggregateHouseholdPortfolio(portfolioOrAggregation);
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

function foNormalizeAccountIdentity_(value) {
  const rawName = foPortfolioText_(value, '');
  if (!rawName || rawName.toUpperCase() === 'UNKNOWN') {
    return Object.freeze({
      accountId: FO_DEFAULT_ACCOUNT_ID,
      name: FO_DEFAULT_ACCOUNT_NAME,
      type: AccountType.DEFAULT
    });
  }

  const name = foNormalizeAccountName_(rawName);
  const type = foInferAccountType_(name);
  return Object.freeze({
    accountId: type === AccountType.DEFAULT
      ? FO_DEFAULT_ACCOUNT_ID
      : foAccountIdFromName_(name),
    name: name,
    type: type
  });
}

function foNormalizeAccountName_(value) {
  const normalized = foRequiredPortfolioText_(value, 'account name')
    .replace(/\s+/g, ' ');
  const upper = normalized.toUpperCase();

  if (upper === FO_DEFAULT_ACCOUNT_NAME.toUpperCase() || upper === AccountType.DEFAULT) {
    return FO_DEFAULT_ACCOUNT_NAME;
  }
  if (
    Object.prototype.hasOwnProperty.call(AccountType, upper) &&
    AccountType[upper] !== AccountType.OTHER
  ) {
    return AccountType[upper];
  }
  return normalized;
}

function foNormalizeAccountId_(value) {
  const normalized = foRequiredPortfolioText_(value, 'accountId')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!normalized) {
    throw new Error('Required portfolio field is invalid: accountId.');
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

function foResolveSecurityIdentity_(source, ticker) {
  const candidates = [
    ['SECURITY_ID', source.canonicalSecurityId],
    ['SECURITY_ID', source.securityId],
    ['ISIN', source.isin],
    ['CUSIP', source.cusip],
    ['SEDOL', source.sedol],
    ['TICKER', ticker]
  ];

  for (let index = 0; index < candidates.length; index++) {
    const value = foPortfolioText_(candidates[index][1], '').toUpperCase();
    if (value) {
      return Object.freeze({
        securityId: value,
        source: candidates[index][0],
        key: candidates[index][0] === 'TICKER'
          ? 'TICKER:' + value
          : 'IDENTIFIER:' + value
      });
    }
  }

  return Object.freeze({ securityId: '', source: '', key: '' });
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

function foNormalizePortfolioPriceCandidate_(candidate) {
  if (candidate && typeof candidate === 'object') {
    const value = candidate.currentPrice === undefined
      ? candidate.price
      : candidate.currentPrice;
    return {
      value: value,
      currency: foOptionalCurrencyCode_(
        candidate.currency || candidate.currentPriceCurrency,
        'currentPriceCurrency'
      )
    };
  }
  return { value: candidate, currency: null };
}

function foValidateAccountMarketValueContract_(account, baseCurrency) {
  account.holdings.getAll().forEach(function(holding) {
    if (
      holding.marketValueCurrency &&
      holding.marketValueCurrency !== baseCurrency
    ) {
      throw new Error(
        'marketValue currency must match household base currency ' +
        baseCurrency + ' for ' + holding.securityId + '.'
      );
    }
    if (
      holding.currentPriceCurrency &&
      holding.currentPriceCurrency !== baseCurrency &&
      holding.quantity !== null &&
      holding.currentPrice !== null
    ) {
      throw new Error(
        'currentPrice currency must match household base currency ' +
        baseCurrency + ' when used for valuation of ' + holding.securityId + '.'
      );
    }
  });
}

function foNormalizeCurrencyCode_(value, field) {
  const normalized = foRequiredPortfolioText_(value, field).toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error('Portfolio currency must be a three-letter code: ' + field + '.');
  }
  return normalized;
}

function foOptionalCurrencyCode_(value, field) {
  const normalized = foPortfolioText_(value, '');
  return normalized ? foNormalizeCurrencyCode_(normalized, field) : null;
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
          currency: 'CAD',
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
          currency: 'CAD',
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
    const aggregation = foAggregateHouseholdPortfolio(portfolio);
    const intelligence = foBuildUnifiedPortfolioIntelligence(aggregation);
    const duplicateExposure = foAnalyzeDuplicateExposure(aggregation);

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
