/************************************************************
 * MarketIntelligenceEngine.gs
 * Wave 1C.5.1 — Market Intelligence Engine
 * Enhancement: Skip reference/watchlist rows without real holdings
 ************************************************************/

function foRunMarketIntelligence() {
  const module = 'MarketIntelligenceEngine';

  try {
    foInfo_(module, 'Start', 'Market intelligence run started.');

    const dashboard = foDashboard_();
    const snapshotSheet = dashboard.getSheetByName('Portfolio Snapshot');

    if (!snapshotSheet) {
      throw new Error('Portfolio Snapshot sheet not found. Run Portfolio Engine first.');
    }

    const values = snapshotSheet.getDataRange().getValues();

    if (values.length < 2) {
      throw new Error('Portfolio Snapshot has no holdings to analyze.');
    }

    const headers = values[0].map(String);
    const results = [];
    let skippedRows = 0;

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const ticker = foGetVal_(row, headers, 'Ticker');

      if (!ticker) continue;

      const holding = {
        ticker: ticker,
        company: foGetVal_(row, headers, 'Company'),
        account: foNormalizeAccountIdentity_(
          foGetVal_(row, headers, 'Account')
        ).name,
        assetClass: foGetVal_(row, headers, 'Asset Class'),
        sector: foGetVal_(row, headers, 'Sector'),
        theme: foGetVal_(row, headers, 'Theme'),
        quantity: foNum_(foGetVal_(row, headers, 'Quantity')),
        marketValue: foNum_(foGetVal_(row, headers, 'Market Value')),
        currentWeight: foNum_(foGetVal_(row, headers, 'Current Weight')),
        drift: foNum_(foGetVal_(row, headers, 'Drift'))
      };

      if (!foIsRealPortfolioHolding_(holding)) {
        skippedRows++;
        continue;
      }

      const intelligence = foAnalyzeHolding_(holding);

      results.push([
        new Date(),
        holding.ticker,
        holding.company,
        holding.account,
        holding.assetClass,
        holding.sector,
        holding.theme,
        holding.marketValue,
        intelligence.buyZoneConfidence,
        intelligence.convictionScore,
        intelligence.materialityScore,
        intelligence.riskRating,
        intelligence.recommendation,
        intelligence.cioReadiness,
        intelligence.comments,
        FO_CONFIG.PLATFORM_VERSION,
        FO_CONFIG.BASELINE
      ]);
    }

    const sheet = foEnsureSheet_(dashboard, 'Market Intelligence', [
      'Timestamp',
      'Ticker',
      'Company',
      'Account',
      'Asset Class',
      'Sector',
      'Theme',
      'Market Value',
      'Buy Zone Confidence',
      'Conviction Score',
      'Materiality Score',
      'Risk Rating',
      'Recommendation',
      'CIO Readiness',
      'Comments',
      'Platform Version',
      'Baseline'
    ]);

    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 17).clearContent();
    }

    if (results.length > 0) {
      sheet.getRange(2, 1, results.length, 17).setValues(results);
    }

    foInfo_(
      module,
      'Complete',
      'Market intelligence completed. Holdings analyzed: ' +
        results.length +
        ', skipped rows: ' +
        skippedRows
    );

    return {
      status: 'SUCCESS',
      holdingsAnalyzed: results.length,
      skippedRows: skippedRows
    };

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foIsRealPortfolioHolding_(holding) {
  const account = String(holding.account || '').trim().toUpperCase();
  const ticker = String(holding.ticker || '').trim().toUpperCase();
  const quantity = Number(holding.quantity || 0);
  const marketValue = Number(holding.marketValue || 0);

  if (!ticker) return false;

  const excludedAccounts = [
    '',
    'N/A',
    'NA',
    'PENDING',
    'WATCHLIST',
    'WATCH LIST',
    'REFERENCE',
    'LIBRARY',
    'TEMPLATE'
  ];

  if (excludedAccounts.indexOf(account) >= 0 && quantity <= 0 && marketValue <= 0) {
    return false;
  }

  if (quantity > 0) return true;
  if (marketValue > 0) return true;

  return false;
}

function foAnalyzeHolding_(holding) {
  const ticker = String(holding.ticker || '').toUpperCase();

  const buyZoneConfidence = foCalculateBuyZone_(ticker, holding);
  const convictionScore = foCalculateConviction_(ticker, holding);
  const materialityScore = foCalculateMateriality_(ticker, holding);
  const riskRating = foCalculateRiskRating_(ticker, holding);
  const recommendation = foGenerateRecommendation_(ticker, buyZoneConfidence, convictionScore, riskRating);
  const cioReadiness = foCalculateCioReadiness_(buyZoneConfidence, convictionScore, materialityScore, riskRating);
  const comments = foGenerateMarketIntelligenceComments_(ticker, recommendation, riskRating);

  return {
    buyZoneConfidence: buyZoneConfidence,
    convictionScore: convictionScore,
    materialityScore: materialityScore,
    riskRating: riskRating,
    recommendation: recommendation,
    cioReadiness: cioReadiness,
    comments: comments
  };
}

function foCalculateBuyZone_(ticker, holding) {
  const t = String(ticker || '').toUpperCase();

  if (['QQC', 'MU', 'AVGO', 'QCOM'].indexOf(t) >= 0) return 90;
  if (['TD', 'BNS'].indexOf(t) >= 0) return 82;
  if (t === 'QNC') return 98;
  if (t === 'QBTS') return 70;
  if (t === 'RGTI') return 88;
  if (t === 'ABX') return 60;
  if (t === 'ONE') return 55;

  return 50;
}

function foCalculateConviction_(ticker, holding) {
  const t = String(ticker || '').toUpperCase();

  if (['QQC', 'MU', 'AVGO', 'QCOM'].indexOf(t) >= 0) return 95;
  if (['TD', 'BNS'].indexOf(t) >= 0) return 80;
  if (t === 'QNC') return 98;
  if (t === 'QBTS') return 65;
  if (t === 'RGTI') return 90;
  if (t === 'ABX') return 55;
  if (t === 'ONE') return 50;

  return 50;
}

function foCalculateMateriality_(ticker, holding) {
  const t = String(ticker || '').toUpperCase();
  const marketValue = Number(holding.marketValue || 0);

  let base = 50;

  if (['QQC', 'QNC'].indexOf(t) >= 0) base = 95;
  if (['TD', 'BNS'].indexOf(t) >= 0) base = 75;
  if (['MU', 'AVGO', 'QCOM', 'RGTI'].indexOf(t) >= 0) base = 85;
  if (['QBTS', 'ABX', 'ONE'].indexOf(t) >= 0) base = 65;

  if (marketValue >= 30000) base += 5;
  if (marketValue >= 50000) base += 5;

  return Math.max(0, Math.min(100, base));
}

function foCalculateRiskRating_(ticker, holding) {
  const t = String(ticker || '').toUpperCase();

  if (['QNC', 'QBTS', 'RGTI', 'ONE'].indexOf(t) >= 0) return 'High';
  if (['MU', 'AVGO', 'QCOM'].indexOf(t) >= 0) return 'Medium';
  if (['QQC', 'TD', 'BNS', 'ABX'].indexOf(t) >= 0) return 'Low';

  return 'Unknown';
}

function foGenerateRecommendation_(ticker, buyZone, conviction, riskRating) {
  const t = String(ticker || '').toUpperCase();

  if (t === 'QNC' && buyZone >= 95 && conviction >= 95) return 'DEPLOY CAPITAL';
  if (buyZone >= 88 && conviction >= 88 && riskRating !== 'High') return 'BUY';
  if (buyZone >= 88 && conviction >= 88 && riskRating === 'High') return 'SATELLITE BUY';
  if (buyZone >= 80 && conviction >= 75) return 'ACCUMULATE';
  if (buyZone >= 65) return 'HOLD';

  return 'WATCH';
}

function foCalculateCioReadiness_(buyZone, conviction, materiality, riskRating) {
  let score = Math.round((buyZone * 0.35) + (conviction * 0.35) + (materiality * 0.30));

  if (riskRating === 'High') score -= 8;
  if (riskRating === 'Unknown') score -= 15;

  return Math.max(0, Math.min(100, score));
}

function foGenerateMarketIntelligenceComments_(ticker, recommendation, riskRating) {
  const t = String(ticker || '').toUpperCase();

  if (recommendation === 'DEPLOY CAPITAL') {
    return t + ' is flagged as high-materiality opportunity. Validate concentration risk before adding capital.';
  }

  if (recommendation === 'SATELLITE BUY') {
    return t + ' has strong scores but high risk. Treat as satellite allocation only.';
  }

  if (recommendation === 'BUY') {
    return t + ' meets institutional buy-score threshold under current rules.';
  }

  if (recommendation === 'ACCUMULATE') {
    return t + ' is suitable for gradual accumulation, subject to portfolio allocation limits.';
  }

  if (recommendation === 'HOLD') {
    return t + ' should remain under monitoring until stronger buy-zone confirmation.';
  }

  return t + ' requires further review before action.';
}

function foRunMarketIntelligenceSmokeTest() {
  const module = 'MarketIntelligenceEngine';

  try {
    foInfo_(module, 'Start', 'Market Intelligence smoke test started.');

    const result = foRunMarketIntelligence();

    foInfo_(
      module,
      'Complete',
      'Market Intelligence smoke test completed. Analyzed: ' +
        result.holdingsAnalyzed +
        ', skipped: ' +
        result.skippedRows
    );

    return result;

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}
