/**
 * A2.1.6.1 — Architecture Freeze Remediation & Cross-Workbook Closure
 */
const FO_A2161_VERSION = 'ARCH-v1.0.1';
const FO_A2161_TIMEZONE = 'America/Toronto';

/**
 * A2.1.6.1 Bug Fix — Timezone Alias Normalization
 */
const FO_A2161_OPERATING_TIMEZONE = 'America/Toronto';
const FO_A2161_ACCEPTED_TIMEZONE_ALIASES = Object.freeze([
  'America/Toronto',
  'America/Nassau',
  'America/New_York',
  'America/Detroit',
  'America/Iqaluit',
  'America/Nipigon',
  'America/Thunder_Bay'
]);

function foA2161IsOperatingTimezone_(timezoneId) {
  return FO_A2161_ACCEPTED_TIMEZONE_ALIASES.indexOf(
    String(timezoneId || '').trim()
  ) >= 0;
}

function foA2161EvaluateTimezone_(timezoneId) {
  const actual = String(timezoneId || '').trim();
  const accepted = foA2161IsOperatingTimezone_(actual);
  return {
    expectedOperatingTimezone: FO_A2161_OPERATING_TIMEZONE,
    actualTimezone: actual,
    accepted: accepted,
    normalizedOperatingTimezone: accepted
      ? FO_A2161_OPERATING_TIMEZONE
      : actual
  };
}

function foCheckOperatingTimezonesA2161() {
  const dashboard = foDashboard_();
  const ledger = foLedger_();

  const result = {
    dashboard: foA2161EvaluateTimezone_(
      dashboard.getSpreadsheetTimeZone()
    ),
    ledger: foA2161EvaluateTimezone_(
      ledger.getSpreadsheetTimeZone()
    ),
    appsScript: foA2161EvaluateTimezone_(
      Session.getScriptTimeZone()
    )
  };

  result.status =
    result.dashboard.accepted &&
    result.ledger.accepted &&
    result.appsScript.accepted
      ? 'PASS'
      : 'FAIL';

  Logger.log(JSON.stringify(result));
  return result;
}

const FO_A2161_ARCHITECTURE_SHEETS = [
  'Architecture Registry','Architecture Dependencies','Architecture Ownership',
  'Production Baseline','Architecture Freeze Validation'
];
const FO_A2161_LEDGER_SHEETS = [
  'Recommendations','Orchestration Log','Report Archive','Data Integrity',
  'Canadian Market Access Library','Assumptions','Outcomes','Decision Impact',
  'Confidence Calibration','Lessons Learned','Investment Playbooks','Version History'
];
const FO_A2161_CANONICAL_DEPENDENCIES = [
  ['TFSA Holdings','Portfolio Master','DATA FLOW','HIGH'],
  ['LIRA Holdings','Portfolio Master','DATA FLOW','HIGH'],
  ['Interactive Brokers','Portfolio Master','DATA FLOW','HIGH'],
  ['Market Symbol Registry','Market Data Cache','REFERENCE','HIGH'],
  ['Market Data Cache','Portfolio Master','DATA ENRICHMENT','HIGH'],
  ['Portfolio Master','Portfolio State','DATA FLOW','CRITICAL'],
  ['Portfolio State','Portfolio Valuation Summary','CALCULATION','CRITICAL'],
  ['Portfolio State','Portfolio Performance Summary','CALCULATION','HIGH'],
  ['Portfolio State','Portfolio Attribution','CALCULATION','HIGH'],
  ['Portfolio Attribution','Sector Exposure','CALCULATION','HIGH'],
  ['Portfolio Attribution','Country Exposure','CALCULATION','HIGH'],
  ['Portfolio Attribution','Currency Exposure','CALCULATION','HIGH'],
  ['Portfolio Master','Portfolio Snapshot','SNAPSHOT','HIGH'],
  ['Portfolio Snapshot','Market Intelligence','ANALYTICS','HIGH'],
  ['Market Intelligence','Buy Zone Intelligence','ANALYTICS','HIGH'],
  ['Buy Zone Rules','Buy Zone Intelligence','POLICY','HIGH'],
  ['Buy Zone Targets','Buy Zone Intelligence','POLICY','HIGH'],
  ['Conviction Rules','Buy Zone Intelligence','POLICY','HIGH'],
  ['Buy Zone Intelligence','Investment Decision Support','DECISION INPUT','CRITICAL'],
  ['Investment Trends','Investment Decision Support','DECISION INPUT','HIGH'],
  ['Portfolio Materiality','Investment Decision Support','DECISION INPUT','HIGH'],
  ['Investment Decision Support','Capital Deployment Priorities','DECISION FLOW','CRITICAL'],
  ['Capital Deployment Policy','Capital Deployment Priorities','POLICY','CRITICAL'],
  ['Capital Deployment Priorities','Capital Deployment History','AUDIT','HIGH'],
  ['Capital Deployment Priorities','Executive CIO Report','REPORTING','HIGH'],
  ['Portfolio Snapshot','Executive CIO Report','REPORTING','HIGH'],
  ['Executive CIO Report','Executive Dashboard','REPORTING','CRITICAL'],
  ['Position Risk','Portfolio Risk','RISK AGGREGATION','CRITICAL'],
  ['Sector Exposure','Portfolio Risk','RISK INPUT','HIGH'],
  ['Country Exposure','Portfolio Risk','RISK INPUT','HIGH'],
  ['Currency Exposure','Portfolio Risk','RISK INPUT','HIGH'],
  ['Risk Limits','Portfolio Risk','POLICY','CRITICAL'],
  ['Stress Scenarios','Portfolio Risk','POLICY','HIGH'],
  ['Portfolio Risk','Risk Dashboard','REPORTING','HIGH'],
  ['Portfolio Risk','Risk History','AUDIT','HIGH'],
  ['Portfolio Risk Validation','Production Certification','CONTROL','HIGH'],
  ['Platform Health','Production Certification','CONTROL','CRITICAL'],
  ['Data Validation Results','Production Certification','CONTROL','CRITICAL'],
  ['Autonomous CIO Run Log','Production Certification','ORCHESTRATION','CRITICAL'],
  ['Autonomous CIO Step Log','Production Certification','ORCHESTRATION','CRITICAL'],
  ['Production Certification','Executive Dashboard','CONTROL STATUS','HIGH'],
  ['Recommendation Ledger','Investment Ledger::Recommendations','PUBLISH IMMUTABLE EVENT','CRITICAL'],
  ['Investment Decision History','Investment Ledger::Outcomes','OUTCOME FEED','HIGH'],
  ['Recommendation Performance','Investment Ledger::Decision Impact','PERFORMANCE FEED','HIGH'],
  ['Investment Ledger::Decision Impact','Investment Ledger::Confidence Calibration','LEARNING FLOW','HIGH'],
  ['Investment Ledger::Confidence Calibration','Investment Ledger::Lessons Learned','LEARNING FLOW','HIGH'],
  ['Investment Ledger::Lessons Learned','Investment Ledger::Investment Playbooks','KNOWLEDGE FLOW','HIGH']
];

function foRunArchitectureRemediationA2161(){
  const result={
    registry:foGenerateArchitectureRegistryA2161(),
    dependencies:foGenerateDependencyInventoryA2161(),
    ownership:foGenerateOwnershipMatrixA2161(),
    ledger:foValidateInvestmentLedgerA2161()
  };
  result.validation=foRunArchitectureRemediationValidationA2161();
  result.status=result.validation.failedControls?'FAIL':(result.validation.observationControls?'PASS WITH OBSERVATIONS':'PASS');
  result.nextStep=result.validation.failedControls?'REMEDIATE BLOCKERS':'FINALIZE RELEASE EVIDENCE, THEN BEGIN A2.2';
  return result;
}

function foGenerateArchitectureRegistryA2161(){
  const d=foDashboard_(), l=foLedger_();
  const headers=['Component ID','Workbook','Workbook ID','Component','Component Type','Domain','Layer','Owner','Source of Truth','Upstream Dependencies','Downstream Consumers','Editable','Production Critical','Status','Architecture Version','Platform Version','Baseline','Last Reviewed','Notes'];
  const s=foA2161Ensure_(d,'Architecture Registry',headers), now=new Date(), rows=[];
  d.getSheets().forEach((sh,i)=>{const p=foA2161ClassifyDashboard_(sh.getName()); rows.push(['ARCH-DASH-'+Utilities.formatString('%03d',i+1),d.getName(),d.getId(),sh.getName(),p.type,p.domain,p.layer,p.owner,p.sor?'YES':'NO',foA2161Up_(sh.getName()).join(' | '),foA2161Down_(sh.getName()).join(' | '),p.edit?'YES':'NO',p.critical?'YES':'NO',p.status,FO_A2161_VERSION,FO_CONFIG.PLATFORM_VERSION,FO_CONFIG.BASELINE,now,p.notes]);});
  l.getSheets().forEach((sh,i)=>{const p=foA2161ClassifyLedger_(sh.getName()), q='Investment Ledger::'+sh.getName(); rows.push(['ARCH-LEDGER-'+Utilities.formatString('%03d',i+1),l.getName(),l.getId(),sh.getName(),'WORKSHEET',p.domain,p.layer,p.owner,p.sor?'YES':'NO',foA2161Up_(q).join(' | '),foA2161Down_(q).join(' | '),p.edit?'YES':'NO',p.critical?'YES':'NO',p.status,FO_A2161_VERSION,FO_CONFIG.PLATFORM_VERSION,FO_CONFIG.BASELINE,now,p.notes]);});
  foA2161Replace_(s,rows); return {status:'SUCCESS',dashboardComponents:d.getSheets().length,ledgerComponents:l.getSheets().length,totalComponents:rows.length};
}

function foGenerateDependencyInventoryA2161(){
  const d=foDashboard_(), l=foLedger_();
  const s=foA2161Ensure_(d,'Architecture Dependencies',['Dependency ID','Upstream Workbook','Upstream Component','Downstream Workbook','Downstream Component','Dependency Type','Criticality','Status','Architecture Version','Platform Version','Baseline','Last Reviewed','Notes']);
  const dn=new Set(d.getSheets().map(x=>x.getName())), ln=new Set(l.getSheets().map(x=>x.getName())), now=new Date();
  const rows=FO_A2161_CANONICAL_DEPENDENCIES.map((x,i)=>{const u=foA2161Resolve_(x[0]), v=foA2161Resolve_(x[1]); const ue=u.w==='Dashboard'?dn.has(u.c):ln.has(u.c), ve=v.w==='Dashboard'?dn.has(v.c):ln.has(v.c); return ['ARCH-DEP-'+Utilities.formatString('%03d',i+1),u.w==='Dashboard'?d.getName():l.getName(),u.c,v.w==='Dashboard'?d.getName():l.getName(),v.c,x[2],x[3],ue&&ve?'ACTIVE':'BROKEN',FO_A2161_VERSION,FO_CONFIG.PLATFORM_VERSION,FO_CONFIG.BASELINE,now,(!ue?'Missing upstream. ':'')+(!ve?'Missing downstream.':'')];});
  foA2161Replace_(s,rows); return {status:rows.some(r=>r[7]==='BROKEN')?'PASS WITH OBSERVATIONS':'SUCCESS',dependencies:rows.length,brokenDependencies:rows.filter(r=>r[7]==='BROKEN').length};
}

function foGenerateOwnershipMatrixA2161(){
  const d=foDashboard_(); if(!d.getSheetByName('Architecture Registry')||d.getSheetByName('Architecture Registry').getLastRow()<2)foGenerateArchitectureRegistryA2161();
  const v=d.getSheetByName('Architecture Registry').getDataRange().getValues(), h=foA2161Map_(v[0]);
  const rows=v.slice(1).filter(r=>r[h['Component']]).map(r=>[r[h['Component ID']],r[h['Workbook']],r[h['Workbook ID']],r[h['Component']],r[h['Domain']],r[h['Owner']],r[h['Source of Truth']],r[h['Editable']]==='YES'?'CONTROLLED MANUAL EDIT':'ENGINE-OWNED / READ ONLY',r[h['Production Critical']],r[h['Status']],r[h['Architecture Version']],r[h['Platform Version']],r[h['Baseline']],r[h['Last Reviewed']]]);
  const s=foA2161Ensure_(d,'Architecture Ownership',['Component ID','Workbook','Workbook ID','Component','Domain','Owner','System of Record','Edit Policy','Production Critical','Status','Architecture Version','Platform Version','Baseline','Last Reviewed']); foA2161Replace_(s,rows); return {status:'SUCCESS',ownershipRecords:rows.length};
}

function foValidateInvestmentLedgerA2161(){
  const l=foLedger_(), r=l.getSheetByName('Recommendations'), controls=[];
  if(!r){controls.push({control:'Recommendations worksheet',status:'FAIL',severity:'CRITICAL',details:'Missing.'});}
  else{const headers=r.getRange(1,1,1,r.getLastColumn()).getDisplayValues()[0], i=headers.indexOf('Event ID'); controls.push({control:'Immutable Event ID schema',status:i>=0?'PASS':'FAIL',severity:i>=0?'NONE':'CRITICAL',details:i>=0?'Event ID present.':'Event ID missing.'}); if(i>=0&&r.getLastRow()>1){const vals=r.getRange(2,i+1,r.getLastRow()-1,1).getDisplayValues().flat().filter(Boolean), u=new Set(vals); controls.push({control:'Immutable Event ID uniqueness',status:vals.length===u.size?'PASS':'FAIL',severity:vals.length===u.size?'NONE':'CRITICAL',details:vals.length+' populated Event ID(s).'});}}
  controls.push({control:'Ledger timezone',status:foA2161IsOperatingTimezone_(l.getSpreadsheetTimeZone())?'PASS':'FAIL',severity:foA2161IsOperatingTimezone_(l.getSpreadsheetTimeZone())?'NONE':'HIGH',details:'Ledger timezone: '+l.getSpreadsheetTimeZone()});
  const missing=FO_A2161_LEDGER_SHEETS.filter(n=>!l.getSheetByName(n)); controls.push({control:'Ledger worksheet inventory',status:missing.length?'FAIL':'PASS',severity:missing.length?'HIGH':'NONE',details:missing.length?'Missing: '+missing.join(', '):'All expected sheets found.'});
  return {status:controls.some(c=>c.status==='FAIL')?'FAIL':'PASS',workbook:l.getName(),controls};
}

function foFinalizeProductionBaselineA2161(gitCommit,releaseTag){
  if(!gitCommit||gitCommit==='PENDING RELEASE')throw new Error('Provide actual merged commit SHA.'); if(!releaseTag)throw new Error('Provide published release tag.');
  const d=foDashboard_(), s=d.getSheetByName('Production Baseline'); if(!s||s.getLastRow()<2)throw new Error('Production Baseline missing or empty.');
  const h=foA2161Map_(s.getRange(1,1,1,s.getLastColumn()).getDisplayValues()[0]), row=s.getLastRow(); foA2161Set_(s,row,h,'Git Commit',gitCommit); foA2161Set_(s,row,h,'Release Target',releaseTag); foA2161Set_(s,row,h,'Architecture Version',FO_A2161_VERSION); if(h['Release Status']!==undefined)foA2161Set_(s,row,h,'Release Status','RELEASED'); return {status:'SUCCESS',gitCommit,releaseTag,row};
}

function foRunArchitectureRemediationValidationA2161(){
  const d=foDashboard_(), l=foLedger_(), now=new Date(), id='ARCH-REM-VAL-'+Utilities.formatDate(now,FO_CONFIG.TIMEZONE||Session.getScriptTimeZone(),'yyyyMMdd-HHmmss');
  const reg=d.getSheetByName('Architecture Registry'), dep=d.getSheetByName('Architecture Dependencies'), own=d.getSheetByName('Architecture Ownership'), base=d.getSheetByName('Production Baseline'), c=[];
  c.push(foA2161Ctl_('REGISTRY','Investment Ledger registered',reg&&foA2161Count_(reg,'Workbook',l.getName())===l.getSheets().length,'CRITICAL',reg?foA2161Count_(reg,'Workbook',l.getName())+' of '+l.getSheets().length:'Registry missing.'));
  c.push(foA2161Ctl_('REGISTRY','Architecture controls self-registered',reg&&FO_A2161_ARCHITECTURE_SHEETS.every(n=>foA2161Contains_(reg,d.getName(),n)),'HIGH','All architecture controls must be registered.'));
  const broken=dep?foA2161Count_(dep,'Status','BROKEN'):-1; c.push(foA2161Ctl_('LINEAGE','Broken dependencies',broken===0,'CRITICAL',broken<0?'Dependencies missing.':broken+' broken dependency record(s).'));
  c.push(foA2161Ctl_('OWNERSHIP','Ownership coverage',own&&(own.getLastRow()-1)===(d.getSheets().length+l.getSheets().length),'HIGH',own?(own.getLastRow()-1)+' ownership records.':'Ownership missing.'));
  c.push(foA2161Ctl_('CONFIGURATION','Dashboard timezone',foA2161IsOperatingTimezone_(d.getSpreadsheetTimeZone()),'HIGH','Dashboard timezone: '+d.getSpreadsheetTimeZone()));
  c.push(foA2161Ctl_('CONFIGURATION','Ledger timezone',foA2161IsOperatingTimezone_(l.getSpreadsheetTimeZone()),'HIGH','Ledger timezone: '+l.getSpreadsheetTimeZone()));
  c.push(foA2161Ctl_('CONFIGURATION','Apps Script timezone',foA2161IsOperatingTimezone_(Session.getScriptTimeZone()),'HIGH','Apps Script timezone: '+Session.getScriptTimeZone()));
  foValidateInvestmentLedgerA2161().controls.forEach(x=>c.push({category:'INVESTMENT LEDGER',control:x.control,status:x.status,severity:x.severity,details:x.details}));
  c.push(foA2161Ctl_('BASELINE','Release evidence finalized',base&&foA2161Released_(base),'CRITICAL',base?'Latest baseline evaluated.':'Baseline missing.'));
  const s=foA2161Ensure_(d,'Architecture Remediation Validation',['Validation Run ID','Timestamp','Category','Control','Status','Severity','Details','Architecture Version','Platform Version','Baseline']); foA2161Append_(s,c.map(x=>[id,now,x.category,x.control,x.status,x.severity,x.details,FO_A2161_VERSION,FO_CONFIG.PLATFORM_VERSION,FO_CONFIG.BASELINE]));
  const f=c.filter(x=>x.status==='FAIL').length,o=c.filter(x=>x.status==='PASS WITH OBSERVATIONS').length; return {status:f?'FAIL':(o?'PASS WITH OBSERVATIONS':'PASS'),validationRunId:id,failedControls:f,observationControls:o,passedControls:c.length-f-o,totalControls:c.length,blocking:f>0};
}

function foRunArchitectureRemediationSmokeTestA2161(){const r=foRunArchitectureRemediationA2161(); if(r.validation.failedControls)throw new Error('A2.1.6.1 blocking failure: '+JSON.stringify(r)); return {status:'PASS',architectureVersion:FO_A2161_VERSION,brokenDependencies:r.dependencies.brokenDependencies,nextWave:'A2.2 — Position Risk Calculation Engine',result:r};}

function foA2161ClassifyDashboard_(name){
  if(FO_A2161_ARCHITECTURE_SHEETS.indexOf(name)>=0||name==='Architecture Remediation Validation')return {type:'GOVERNANCE CONTROL',domain:'ARCHITECTURE GOVERNANCE',layer:'CONTROL',owner:'PLATFORM GOVERNANCE',sor:true,edit:false,critical:true,status:'PRODUCTION',notes:'Architecture governance component.'};
  const legacy=['Portfolio Dashboard','Capital Allocation Engine','CIO Priority Queue 3.3A','Daily CIO Report','Weekly Executive Report','Decision Support Engine'].indexOf(name)>=0;
  const future=['Portfolio Performance Positions','Net Worth','Performance','Recommendation Performance & CIO Scorecard'].indexOf(name)>=0;
  const supporting=['Data Dictionary','Knowledge Base','Market Symbol Registry','Buy Zone Rules','Buy Zone Targets','Conviction Rules','Materiality Policy','Capital Deployment Policy','Decision History Policy','Risk Limits','Stress Scenarios'].indexOf(name)>=0;
  const calc=['Portfolio Risk','Position Risk','Portfolio State','Portfolio Valuation Summary','Portfolio Attribution','Portfolio Analytics','CIO Recommendation Engine','Executive CIO Report','Executive Dashboard','Risk Dashboard','Risk History'];
  let domain='PLATFORM OPERATIONS',owner='PLATFORM',layer='OPERATIONAL',n=name.toUpperCase();
  if(n.includes('RISK')||n.includes('STRESS')||n.includes('EXPOSURE')){domain='RISK MANAGEMENT';owner='RISK';layer='ANALYTICS';}
  else if(n.includes('CERTIFICATION')||n.includes('VALIDATION')||n.includes('HEALTH')||n.includes('LOG')){domain='GOVERNANCE & OPERATIONS';owner='PLATFORM GOVERNANCE';layer='CONTROL';}
  else if(n.includes('REPORT')||n.includes('DASHBOARD')){domain='EXECUTIVE REPORTING';owner='CIO REPORTING';layer='PRESENTATION';}
  else if(n.includes('CAPITAL')||n.includes('ALLOCATION')){domain='CAPITAL ALLOCATION & EXECUTION';owner='CIO';layer='DECISION';}
  else if(n.includes('BUY ZONE')||n.includes('MARKET')||n.includes('IBKR')){domain='MARKET INTELLIGENCE';owner='MARKET DATA';layer='ANALYTICS';}
  else if(n.includes('DECISION')||n.includes('MATERIALITY')||n.includes('CONVICTION')||n.includes('TREND')||n.includes('RECOMMENDATION')||n.includes('CIO')){domain='CIO DECISION INTELLIGENCE';owner='CIO';layer='DECISION';}
  else if(n.includes('PORTFOLIO')||n.includes('HOLDINGS')||n==='LEDGER'){domain='PORTFOLIO DATA & ANALYTICS';owner='PORTFOLIO';layer='DATA';}
  const sor=['Portfolio Master','Market Data Cache','Market Symbol Registry','Buy Zone Rules','Buy Zone Targets','Conviction Rules','Capital Deployment Policy','Risk Limits','Stress Scenarios','Production Certification','Investment Decision Support','Capital Deployment Priorities','Recommendation Ledger'].indexOf(name)>=0;
  const engine=calc.indexOf(name)>=0||['Dashboard','Report','History','Log','Validation','Snapshot','Performance','Exposure','Intelligence','Priorities','Certification'].some(t=>name.includes(t));
  return {type:'WORKSHEET',domain,layer,owner,sor,edit:supporting||(!engine&&!sor),critical:sor||calc.indexOf(name)>=0||['Autonomous CIO Run Log','Autonomous CIO Step Log'].indexOf(name)>=0,status:legacy?'LEGACY':future?'FUTURE / PROTOTYPE':supporting?'SUPPORTING':'PRODUCTION',notes:legacy?'Superseded; no new dependencies.':future?'Not in current production baseline.':supporting?'Governed policy/reference component.':'Production component.'};
}

function foA2161ClassifyLedger_(name){
  const prod={Recommendations:['RECOMMENDATION EVENT ARCHIVE','IMMUTABLE AUDIT','INVESTMENT GOVERNANCE',true,false,true,'PRODUCTION','Immutable recommendation events.'], 'Data Integrity':['INVESTMENT GOVERNANCE CONTROLS','CONTROL','INVESTMENT GOVERNANCE',true,false,true,'PRODUCTION','Ledger integrity controls.']};
  if(prod[name]){const x=prod[name];return {domain:x[0],layer:x[1],owner:x[2],sor:x[3],edit:x[4],critical:x[5],status:x[6],notes:x[7]};}
  const future=['Assumptions','Outcomes','Decision Impact','Confidence Calibration','Lessons Learned','Investment Playbooks'].includes(name);
  return {domain:future?'INVESTMENT LEARNING':'INVESTMENT GOVERNANCE',layer:future?'LEARNING':'SUPPORTING',owner:'INVESTMENT GOVERNANCE',sor:future||name==='Canadian Market Access Library',edit:['Canadian Market Access Library','Lessons Learned','Investment Playbooks'].includes(name),critical:false,status:future?'FUTURE / PROTOTYPE':'SUPPORTING',notes:future?'Future learning capability.':'Supporting governance component.'};
}
function foA2161Resolve_(v){const p='Investment Ledger::'; return v.indexOf(p)===0?{w:'Ledger',c:v.substring(p.length)}:{w:'Dashboard',c:v};}
function foA2161Up_(c){return FO_A2161_CANONICAL_DEPENDENCIES.filter(x=>x[1]===c).map(x=>x[0]);}
function foA2161Down_(c){return FO_A2161_CANONICAL_DEPENDENCIES.filter(x=>x[0]===c).map(x=>x[1]);}
function foA2161Ensure_(ss,n,h){let s=ss.getSheetByName(n); if(!s)s=ss.insertSheet(n); const c=s.getLastColumn()?s.getRange(1,1,1,Math.max(s.getLastColumn(),h.length)).getDisplayValues()[0].slice(0,h.length):[]; if(!s.getLastRow()||c.join('|')!==h.join('|')){s.clear();s.getRange(1,1,1,h.length).setValues([h]);} s.setFrozenRows(1);s.getRange(1,1,1,h.length).setFontWeight('bold');return s;}
function foA2161Replace_(s,r){const h=s.getRange(1,1,1,s.getLastColumn()).getValues();s.clearContents();s.getRange(1,1,1,h[0].length).setValues(h);if(r.length)s.getRange(2,1,r.length,r[0].length).setValues(r);s.setFrozenRows(1);s.autoResizeColumns(1,s.getLastColumn());}
function foA2161Append_(s,r){if(r.length)s.getRange(s.getLastRow()+1,1,r.length,r[0].length).setValues(r);}
function foA2161Map_(h){return h.reduce((m,x,i)=>(m[String(x).trim()]=i,m),{});}
function foA2161Count_(s,h,v){const x=s.getDataRange().getDisplayValues(),i=x[0].indexOf(h);return i<0?0:x.slice(1).filter(r=>r[i]===v).length;}
function foA2161Contains_(s,w,c){const x=s.getDataRange().getDisplayValues(),h=x[0],wi=h.indexOf('Workbook'),ci=h.indexOf('Component');return x.slice(1).some(r=>r[wi]===w&&r[ci]===c);}
function foA2161Ctl_(cat,ctl,pass,sev,det){return {category:cat,control:ctl,status:pass?'PASS':'FAIL',severity:pass?'NONE':sev,details:det};}
function foA2161Set_(s,row,h,k,v){if(h[k]!==undefined)s.getRange(row,h[k]+1).setValue(v);}
function foA2161Released_(s){const x=s.getDataRange().getDisplayValues(),h=x[0],g=h.indexOf('Git Commit'),r=h.indexOf('Release Target');if(x.length<2||g<0||r<0)return false;const z=x[x.length-1];return !!z[g]&&z[g]!=='PENDING RELEASE'&&!!z[r];}
