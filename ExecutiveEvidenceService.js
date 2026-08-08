/**
 * R8.3 — Executive Evidence Service
 *
 * Normalizes governed executive evidence access.
 *
 * This service DOES NOT:
 * - calculate executive decisions,
 * - determine Weekly compatibility,
 * - evaluate Alert material change,
 * - calculate portfolio posture,
 * - determine capital deployment authorization.
 */

const FO_EXECUTIVE_EVIDENCE_SOURCES = Object.freeze({
  decisionState: Object.freeze({
    key: 'decisionState',
    sourceName: 'Executive Decision State A233',
    sheetName: FO_SHEETS.EXECUTIVE_DECISION_STATE_A233,
    authority: 'A233',
    runIdFields: Object.freeze(['Run ID']),
    timestampFields: Object.freeze(['Timestamp']),
    requiredness: 'REQUIRED'
  }),

  actionCards: Object.freeze({
    key: 'actionCards',
    sourceName: 'Report Action Cards A233',
    sheetName: FO_SHEETS.REPORT_ACTION_CARDS_A233,
    authority: 'A233',
    runIdFields: Object.freeze(['Run ID']),
    timestampFields: Object.freeze(['Timestamp']),
    requiredness: 'REQUIRED'
  }),

  conflicts: Object.freeze({
    key: 'conflicts',
    sourceName: 'Report Conflicts A233',
    sheetName: FO_SHEETS.REPORT_CONFLICTS_A233,
    authority: 'A233',
    runIdFields: Object.freeze(['Run ID']),
    timestampFields: Object.freeze(['Timestamp']),
    requiredness: 'CONTEXTUAL'
  }),

  dataReadiness: Object.freeze({
    key: 'dataReadiness',
    sourceName: 'Report Data Readiness A233',
    sheetName: FO_SHEETS.REPORT_DATA_READINESS_A233,
    authority: 'A233',
    runIdFields: Object.freeze(['Run ID']),
    timestampFields: Object.freeze(['Timestamp']),
    requiredness: 'REQUIRED'
  })
});

function foResolveExecutiveEvidenceSource_(definition, dashboard) {
  const diagnostics = [];

  if (!definition) {
    return {
      key: '',
      sourceName: '',
      sheetName: '',
      authority: '',
      requiredness: '',
      available: false,
      runId: '',
      timestamp: '',
      platformVersion: '',
      baseline: '',
      rows: [],
      rawMetadata: {},
      diagnostics: ['SOURCE_DEFINITION_UNAVAILABLE']
    };
  }

  dashboard = dashboard || foDashboard_();

  const sheet = dashboard &&
    typeof dashboard.getSheetByName === 'function'
      ? dashboard.getSheetByName(definition.sheetName)
      : null;

  if (!sheet) {
    diagnostics.push('SOURCE_UNAVAILABLE');

    return foExecutiveEvidenceEnvelope_(
      definition,
      false,
      '',
      '',
      '',
      '',
      [],
      {},
      diagnostics
    );
  }

  const rows = foSheetRows_(sheet);

  if (!rows.length) {
    diagnostics.push('NO_ROWS');

    return foExecutiveEvidenceEnvelope_(
      definition,
      false,
      '',
      '',
      '',
      '',
      [],
      {},
      diagnostics
    );
  }

  const runResolution = foResolveExecutiveEvidenceRun_(
    rows,
    definition.runIdFields || []
  );

  if (!runResolution.runId) {
    diagnostics.push('RUN_ID_UNAVAILABLE');

    return foExecutiveEvidenceEnvelope_(
      definition,
      false,
      '',
      '',
      '',
      '',
      [],
      {},
      diagnostics
    );
  }

  const currentRows = rows.filter(function(row) {
    return foExecutiveEvidenceText_(
      row[runResolution.field]
    ) === runResolution.runId;
  });

  const timestampResolution = foResolveExecutiveEvidenceMetadata_(
    currentRows,
    definition.timestampFields || []
  );

  if (!timestampResolution.value) {
    diagnostics.push('TIMESTAMP_UNAVAILABLE');
  }

  const platformResolution = foResolveExecutiveEvidenceMetadata_(
    currentRows,
    definition.platformVersionFields || []
  );

  const baselineResolution = foResolveExecutiveEvidenceMetadata_(
    currentRows,
    definition.baselineFields || []
  );

  return foExecutiveEvidenceEnvelope_(
    definition,
    true,
    runResolution.runId,
    timestampResolution.value,
    platformResolution.value,
    baselineResolution.value,
    currentRows,
    {
      runIdField: runResolution.field,
      timestampField: timestampResolution.field,
      platformVersionField: platformResolution.field,
      baselineField: baselineResolution.field
    },
    diagnostics
  );
}

function foResolveExecutiveEvidenceRun_(rows, runIdFields) {
  if (!rows || !rows.length || !runIdFields || !runIdFields.length) {
    return {
      field: '',
      runId: ''
    };
  }

  const finalRow = rows[rows.length - 1] || {};

  for (let i = 0; i < runIdFields.length; i++) {
    const field = runIdFields[i];
    const value = foExecutiveEvidenceText_(finalRow[field]);

    if (value) {
      return {
        field: field,
        runId: value
      };
    }
  }

  return {
    field: '',
    runId: ''
  };
}

function foResolveExecutiveEvidenceMetadata_(rows, fields) {
  if (!rows || !rows.length || !fields || !fields.length) {
    return {
      field: '',
      value: ''
    };
  }

  for (let f = 0; f < fields.length; f++) {
    const field = fields[f];

    for (let r = 0; r < rows.length; r++) {
      const value = foExecutiveEvidenceText_(rows[r][field]);

      if (value) {
        return {
          field: field,
          value: value
        };
      }
    }
  }

  return {
    field: '',
    value: ''
  };
}

function foExecutiveEvidenceEnvelope_(
  definition,
  available,
  runId,
  timestamp,
  platformVersion,
  baseline,
  rows,
  rawMetadata,
  diagnostics
) {
  return {
    key: definition.key || '',
    sourceName: definition.sourceName || '',
    sheetName: definition.sheetName || '',
    authority: definition.authority || '',
    requiredness: definition.requiredness || '',
    available: available === true,
    runId: runId || '',
    timestamp: timestamp || '',
    platformVersion: platformVersion || '',
    baseline: baseline || '',
    rows: rows || [],
    rawMetadata: rawMetadata || {},
    diagnostics: diagnostics || []
  };
}

function foExecutiveEvidenceText_(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function foGetExecutiveEvidenceSource_(key, dashboard) {
  const definition = FO_EXECUTIVE_EVIDENCE_SOURCES[key];

  return foResolveExecutiveEvidenceSource_(
    definition,
    dashboard
  );
}


function foGetExecutiveEvidenceSourceForRun_(key, runId, dashboard) {
  const definition = FO_EXECUTIVE_EVIDENCE_SOURCES[key];

  if (!definition) {
    return foResolveExecutiveEvidenceSource_(definition, dashboard);
  }

  const diagnostics = [];
  dashboard = dashboard || foDashboard_();

  const sheet = dashboard &&
    typeof dashboard.getSheetByName === 'function'
      ? dashboard.getSheetByName(definition.sheetName)
      : null;

  if (!sheet) {
    diagnostics.push('SOURCE_UNAVAILABLE');

    return foExecutiveEvidenceEnvelope_(
      definition,
      false,
      '',
      '',
      '',
      '',
      [],
      {},
      diagnostics
    );
  }

  const rows = foSheetRows_(sheet);

  if (!rows.length) {
    diagnostics.push('NO_ROWS');

    return foExecutiveEvidenceEnvelope_(
      definition,
      false,
      '',
      '',
      '',
      '',
      [],
      {},
      diagnostics
    );
  }

  const targetRunId = foExecutiveEvidenceText_(runId);

  if (!targetRunId) {
    diagnostics.push('RUN_ID_UNAVAILABLE');

    return foExecutiveEvidenceEnvelope_(
      definition,
      false,
      '',
      '',
      '',
      '',
      [],
      {},
      diagnostics
    );
  }

  const runFields = definition.runIdFields || [];
  let runField = '';

  for (let i = 0; i < runFields.length; i++) {
    const field = runFields[i];

    if (rows.some(function(row) {
      return foExecutiveEvidenceText_(row[field]) === targetRunId;
    })) {
      runField = field;
      break;
    }
  }

  if (!runField) {
    diagnostics.push('RUN_ID_UNAVAILABLE');

    return foExecutiveEvidenceEnvelope_(
      definition,
      false,
      targetRunId,
      '',
      '',
      '',
      [],
      {},
      diagnostics
    );
  }

  const currentRows = rows.filter(function(row) {
    return foExecutiveEvidenceText_(row[runField]) === targetRunId;
  });

  const timestampResolution = foResolveExecutiveEvidenceMetadata_(
    currentRows,
    definition.timestampFields || []
  );

  if (!timestampResolution.value) {
    diagnostics.push('TIMESTAMP_UNAVAILABLE');
  }

  const platformResolution = foResolveExecutiveEvidenceMetadata_(
    currentRows,
    definition.platformVersionFields || []
  );

  const baselineResolution = foResolveExecutiveEvidenceMetadata_(
    currentRows,
    definition.baselineFields || []
  );

  return foExecutiveEvidenceEnvelope_(
    definition,
    true,
    targetRunId,
    timestampResolution.value,
    platformResolution.value,
    baselineResolution.value,
    currentRows,
    {
      runIdField: runField,
      timestampField: timestampResolution.field,
      platformVersionField: platformResolution.field,
      baselineField: baselineResolution.field
    },
    diagnostics
  );
}

function foGetA233ExecutiveEvidence_(dashboard) {
  const decisionState = foGetExecutiveEvidenceSource_(
    'decisionState',
    dashboard
  );

  const decisionRunId = decisionState.runId;

  return {
    decisionState: decisionState,

    actionCards: foGetExecutiveEvidenceSourceForRun_(
      'actionCards',
      decisionRunId,
      dashboard
    ),

    conflicts: foGetExecutiveEvidenceSourceForRun_(
      'conflicts',
      decisionRunId,
      dashboard
    ),

    dataReadiness: foGetExecutiveEvidenceSourceForRun_(
      'dataReadiness',
      decisionRunId,
      dashboard
    )
  };
}
