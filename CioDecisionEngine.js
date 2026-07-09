/************************************************************
 * CioDecisionEngine.gs
 * Wave 1C.6 — CIO Decision Engine
 ************************************************************/

function foRunCioDecisionEngine() {
  const module = 'CioDecisionEngine';

  try {
    foInfo_(module, 'Start', 'CIO Decision Engine started.');

    const dashboard = foDashboard_();
    const source = dashboard.getSheetByName('Market Intelligence');

    if (!source) {
      throw new Error('Market Intelligence sheet not found. Run Market Intelligence first.');
    }

    const values = source.getDataRange().getValues();

    if (values.length < 2) {
      throw new Error('Market Intelligence has no records to evaluate.');
    }

    const headers = values[0].map(String);
    const rows = [];

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const ticker = foGetVal_(row, headers, 'Ticker');

      if (!ticker) continue;

      const record = {
        ticker: ticker,
        company: foGetVal_(row, headers, 'Company'),
        account: foGetVal_(row, headers, 'Account'),
        marketValue: foNum_(foGetVal_(row, headers, 'Market Value')),
        buyZoneConfidence: foNum_(foGetVal_(row, headers, 'Buy Zone Confidence')),
        convictionScore: foNum_(foGetVal_(row, headers, 'Conviction Score')),
        materialityScore: foNum_(foGetVal_(row, headers, 'Materiality Score')),
        riskRating: foGetVal_(row, headers, 'Risk Rating'),
        recommendation: foGetVal_(row, headers, 'Recommendation'),
        cioReadiness: foNum_(foGetVal_(row, headers, 'CIO Readiness'))
      };

      const decision = foEvaluateCioDecision_(record);

      rows.push([
        new Date(),
        record.ticker,
        record.company,
        record.account,
        record.marketValue,
        record.buyZoneConfidence,
        record.convictionScore,
        record.materialityScore,
        record.riskRating,
        record.recommendation,
        record.cioReadiness,
        decision.cioAction,
        decision.priority,
        decision.deploymentGuidance,
        decision.requiresReview,
        decision.reason,
        FO_CONFIG.PLATFORM_VERSION,
        FO_CONFIG.BASELINE
      ]);
    }

    const output = foEnsureSheet_(dashboard, 'CIO Decisions', [
      'Timestamp',
      'Ticker',
      'Company',
      'Account',
      'Market Value',
      'Buy Zone Confidence',
      'Conviction Score',
      'Materiality Score',
      'Risk Rating',
      'Market Recommendation',
      'CIO Readiness',
      'CIO Action',
      'Priority',
      'Deployment Guidance',
      'Requires Review',
      'Decision Rationale',
      'Platform Version',
      'Baseline'
    ]);

    if (output.getLastRow() > 1) {
      output.getRange(2, 1, output.getLastRow() - 1, 18).clearContent();
    }

    if (rows.length > 0) {
      output.getRange(2, 1, rows.length, 18).setValues(rows);
    }

    foInfo_(module, 'Complete', 'CIO decisions generated: ' + rows.length);

    return {
      status: 'SUCCESS',
      decisionsGenerated: rows.length
    };

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}

function foEvaluateCioDecision_(record) {
  const ticker = String(record.ticker || '').toUpperCase();
  const buyZone = Number(record.buyZoneConfidence || 0);
  const conviction = Number(record.convictionScore || 0);
  const materiality = Number(record.materialityScore || 0);
  const readiness = Number(record.cioReadiness || 0);
  const risk = String(record.riskRating || '').toUpperCase();
  const marketValue = Number(record.marketValue || 0);

  let action = 'NO ACTION';
  let priority = 'Low';
  let deployment = 'No deployment recommended.';
  let requiresReview = 'No';
  let reason = 'Default decision rule applied.';

  if (ticker === 'QNC' && readiness >= 90 && risk === 'HIGH') {
    action = 'DEPLOY CAPITAL WITH LIMITS';
    priority = 'Critical';
    deployment = 'Consider staged deployment only. Confirm concentration and liquidity limits first.';
    requiresReview = 'Yes';
    reason = 'QNC has very high readiness but high risk, requiring controlled deployment.';
  } else if (readiness >= 88 && risk === 'LOW') {
    action = 'BUY / ADD';
    priority = 'High';
    deployment = 'Eligible for capital deployment within portfolio allocation limits.';
    requiresReview = 'No';
    reason = 'High readiness and low risk support CIO buy action.';
  } else if (readiness >= 82 && risk === 'MEDIUM') {
    action = 'SATELLITE BUY';
    priority = 'High';
    deployment = 'Eligible only as satellite exposure. Keep allocation limited.';
    requiresReview = 'Yes';
    reason = 'Strong opportunity but medium risk requires allocation discipline.';
  } else if (readiness >= 80 && risk === 'HIGH') {
    action = 'WATCH / REVIEW';
    priority = 'Medium';
    deployment = 'Do not deploy automatically. Review position size and downside risk.';
    requiresReview = 'Yes';
    reason = 'High readiness offset by high risk.';
  } else if (readiness >= 70) {
    action = 'ACCUMULATE ON WEAKNESS';
    priority = 'Medium';
    deployment = 'Wait for pullback or stronger confirmation.';
    requiresReview = 'No';
    reason = 'Moderate readiness supports watchful accumulation.';
  } else if (readiness >= 60) {
    action = 'HOLD';
    priority = 'Low';
    deployment = 'Maintain current exposure. No additional capital.';
    requiresReview = 'No';
    reason = 'Readiness is not high enough for new capital.';
  }

  if (marketValue <= 0) {
    requiresReview = 'Yes';
    reason += ' Market value missing or zero.';
  }

  return {
    cioAction: action,
    priority: priority,
    deploymentGuidance: deployment,
    requiresReview: requiresReview,
    reason: reason
  };
}

function foRunCioDecisionEngineSmokeTest() {
  const module = 'CioDecisionEngine';

  try {
    foInfo_(module, 'Start', 'CIO Decision Engine smoke test started.');

    const result = foRunCioDecisionEngine();

    foInfo_(
      module,
      'Complete',
      'CIO Decision Engine smoke test completed. Decisions: ' + result.decisionsGenerated
    );

    return result;

  } catch (error) {
    foError_(module, 'Failure', error);
    throw error;
  }
}