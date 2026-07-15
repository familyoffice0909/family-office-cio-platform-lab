/**
 * Wave A2.2 — Position Risk Calculation Engine
 */
const FO_A22_RELEASE_TARGET = 'v1.1.0';

const FO_A22_POSITION_HEADERS = [
  'Run ID','Timestamp','Rank','Ticker','Account','Quantity','Current Price',
  'Market Value','Portfolio Weight %','Asset Class','Sector','Country','Currency',
  'Concentration Score','Data Quality Score','Risk Score','Risk Level',
  'Primary Risk Driver','Recommendation','Platform Version','Baseline'
];

const FO_A22_PORTFOLIO_HEADERS = [
  'Run ID','Timestamp','Portfolio Value','Risk Score','Diversification Score',
  'Largest Position %','Top 5 %','Sector Concentration %',
  'Currency Concentration %','Stress Test Score','Overall Risk',
  'Recommendation','Platform Version','Baseline'
];

const FO_A22_DASHBOARD_HEADERS = [
  'Section','Metric','Value','Status','Commentary','Timestamp','Run ID',
  'Platform Version','Baseline'
];

function foRunPositionRiskEngineA22() {
  const runId = foA22RunId_();
  const position = foCalculatePositionRiskA22(runId);
  const portfolio = foCalculatePortfolioRiskA22(runId, position.positions);
  const dashboard = foBuildRiskDashboardA22(runId, portfolio.portfolio, position.positions);
  const validation = foRunPositionRiskValidationA22(runId);
  return {
    status: validation.failedControls ? 'FAIL' : 'PASS',
    runId,
    positionsCalculated: position.positions.length,
    portfolioRisk: portfolio.portfolio,
    dashboardRows: dashboard.rowsWritten,
    validation,
    releaseTarget: FO_A22_RELEASE_TARGET
  };
}

function foCalculatePositionRiskA22(runId) {
  runId = runId || foA22RunId_();
  const ss = foDashboard_();
  const master = ss.getSheetByName('Portfolio Master');
  if (!master || master.getLastRow() < 2) throw new Error('Portfolio Master missing or empty.');

  const values = master.getDataRange().getDisplayValues();
  const h = foA22Map_(values[0]);
  const positions = values.slice(1).map(r => foA22ReadPosition_(r, h)).filter(Boolean);
  if (!positions.length) throw new Error('No operational positions found in Portfolio Master.');

  const total = positions.reduce((s,p)=>s+p.marketValue,0);
  if (!(total > 0)) throw new Error('Portfolio market value must be positive.');

  positions.forEach(p => {
    p.weight = foA22Round_(p.marketValue / total * 100, 4);
    p.dataQuality = foA22DataQuality_(p);
    p.concentration = foA22Concentration_(p.weight);
    const risk = foA22PositionScore_(p);
    p.riskScore = risk.score;
    p.riskLevel = risk.level;
    p.driver = risk.driver;
    p.recommendation = risk.recommendation;
  });

  positions.sort((a,b)=>b.riskScore-a.riskScore || b.marketValue-a.marketValue);
  const now = new Date();
  const rows = positions.map((p,i)=>[
    runId,now,i+1,p.ticker,p.account,p.quantity,p.currentPrice,p.marketValue,
    p.weight,p.assetClass,p.sector,p.country,p.currency,p.concentration,
    p.dataQuality,p.riskScore,p.riskLevel,p.driver,p.recommendation,
    FO_CONFIG.PLATFORM_VERSION,FO_CONFIG.BASELINE
  ]);

  foA22Replace_(foA22Ensure_(ss,'Position Risk',FO_A22_POSITION_HEADERS), rows);
  return {status:'SUCCESS', runId, positions, portfolioValue:total};
}

function foCalculatePortfolioRiskA22(runId, positions) {
  runId = runId || foA22NewRunId_();
  const dashboard = foDashboard_();
  if (!positions || !positions.length) positions = foA22ReadLatestPositionRisk_(dashboard);
  if (!positions || !positions.length) throw new Error('A2.2.1: no position-risk records.');
  const normalized=positions.map(function(p){ return {
    runId:foA22Text_(p.runId), ticker:foA22Text_(p.ticker)||'UNKNOWN', account:foA22Text_(p.account)||'Unknown',
    marketValue:foA22FiniteNumber_(p.marketValue,0,'marketValue '+p.ticker),
    portfolioWeightPct:foA22FiniteNumber_(p.portfolioWeightPct,0,'weight '+p.ticker),
    riskScore:foA22FiniteNumber_(p.riskScore,0,'riskScore '+p.ticker),
    dataQualityScore:foA22FiniteNumber_(p.dataQualityScore,0,'dataQuality '+p.ticker),
    sector:foA22Text_(p.sector)||'Unknown', currency:foA22Text_(p.currency)||'Unknown',
    riskRating:foA22Text_(p.riskRating), notes:foA22Text_(p.notes)
  };});
  const totalValue=normalized.reduce(function(s,p){return s+p.marketValue;},0);
  if (!Number.isFinite(totalValue)||totalValue<=0) throw new Error('A2.2.1 invalid portfolio value: '+totalValue);
  normalized.forEach(function(p){p.portfolioWeightPct=foA22Round_(p.marketValue/totalValue*100,4);});
  const sorted=normalized.slice().sort(function(a,b){return b.portfolioWeightPct-a.portfolioWeightPct;});
  const largest=foA22FiniteNumber_(sorted[0].portfolioWeightPct,0,'largest');
  const top5=sorted.slice(0,5).reduce(function(s,p){return s+p.portfolioWeightPct;},0);
  const sector=foA22SafeMaxGroupWeight_(normalized,'sector');
  const currency=foA22SafeMaxGroupWeight_(normalized,'currency');
  const weightedRisk=normalized.reduce(function(s,p){return s+p.riskScore*(p.portfolioWeightPct/100);},0);
  const avgDQ=normalized.reduce(function(s,p){return s+p.dataQualityScore*(p.portfolioWeightPct/100);},0);
  const diversification=foA22DiversificationScore_(normalized.length,largest,top5,sector,currency);
  const stress=foA22StressScore_(normalized,largest,sector);
  const inputs={totalValue:totalValue,largestPositionPct:largest,top5Pct:top5,sectorConcentrationPct:sector,currencyConcentrationPct:currency,weightedPositionRisk:weightedRisk,averageDataQuality:avgDQ,diversificationScore:diversification,stressTestScore:stress};
  Object.keys(inputs).forEach(function(k){if(!Number.isFinite(Number(inputs[k]))) throw new Error('A2.2.1 non-finite input '+k+'='+inputs[k]);});
  Logger.log('A2.2.1 portfolio inputs: '+JSON.stringify(inputs));
  const score=foA22Round_(foA22Clamp_(weightedRisk*0.50+foA22ScaleTo100_(largest,20)*0.18+foA22ScaleTo100_(top5,75)*0.10+foA22ScaleTo100_(sector,50)*0.10+foA22ScaleTo100_(currency,80)*0.05+(100-avgDQ)*0.07,0,100),1);
  const level=foA22RiskLevel_(score);
  if(level==='UNAVAILABLE') throw new Error('A2.2.1 unable to classify score.');
  const rec=foA22PortfolioRecommendation_({riskScore:score,diversificationScore:diversification,largestPositionPct:largest,top5Pct:top5,sectorConcentrationPct:sector,currencyConcentrationPct:currency,averageDataQuality:avgDQ});
  const portfolio={runId:runId,timestamp:new Date(),portfolioValue:foA22Round_(totalValue,2),riskScore:score,diversificationScore:foA22Round_(diversification,1),largestPositionPct:foA22Round_(largest,2),top5Pct:foA22Round_(top5,2),sectorConcentrationPct:foA22Round_(sector,2),currencyConcentrationPct:foA22Round_(currency,2),stressTestScore:foA22Round_(stress,1),overallRisk:level,recommendation:rec};
  const row=[[portfolio.runId,portfolio.timestamp,portfolio.portfolioValue,portfolio.riskScore,portfolio.diversificationScore,portfolio.largestPositionPct,portfolio.top5Pct,portfolio.sectorConcentrationPct,portfolio.currencyConcentrationPct,portfolio.stressTestScore,portfolio.overallRisk,portfolio.recommendation,FO_CONFIG.PLATFORM_VERSION,FO_CONFIG.BASELINE]];
  foA22ReplaceData_(foA22EnsureSheet_(dashboard,'Portfolio Risk',FO_A22_PORTFOLIO_RISK_HEADERS),row);
  foA22AppendRows_(foA22EnsureSheet_(dashboard,'Risk History',FO_A22_RISK_HISTORY_HEADERS),row);
  return {status:'SUCCESS',runId:runId,portfolio:portfolio};
}

function foBuildRiskDashboardA22(runId, portfolio, positions) {
  const ss = foDashboard_();
  if (!portfolio) portfolio = foA22ReadPortfolioRisk_(ss);
  if (!positions || !positions.length) positions = foA22ReadPositionRisk_(ss);
  if (!portfolio || !positions.length) throw new Error('Risk outputs unavailable.');

  const now = new Date();
  const riskiest = positions.slice().sort((a,b)=>b.riskScore-a.riskScore)[0];
  const largest = positions.slice().sort((a,b)=>b.weight-a.weight)[0];
  const rows = [
    ['EXECUTIVE','Overall Risk Score',portfolio.riskScore,foA22Status_('risk',portfolio.riskScore),portfolio.recommendation,now,runId,FO_CONFIG.PLATFORM_VERSION,FO_CONFIG.BASELINE],
    ['EXECUTIVE','Overall Risk Level',portfolio.overallRisk,portfolio.overallRisk,'Portfolio-level risk classification.',now,runId,FO_CONFIG.PLATFORM_VERSION,FO_CONFIG.BASELINE],
    ['DIVERSIFICATION','Diversification Score',portfolio.diversificationScore,foA22Status_('diversification',portfolio.diversificationScore),'Higher values indicate broader diversification.',now,runId,FO_CONFIG.PLATFORM_VERSION,FO_CONFIG.BASELINE],
    ['CONCENTRATION','Largest Position %',portfolio.largestPositionPct,foA22Status_('largest',portfolio.largestPositionPct),largest.ticker+' is the largest position.',now,runId,FO_CONFIG.PLATFORM_VERSION,FO_CONFIG.BASELINE],
    ['CONCENTRATION','Top 5 %',portfolio.top5Pct,foA22Status_('top5',portfolio.top5Pct),'Aggregate exposure to the five largest positions.',now,runId,FO_CONFIG.PLATFORM_VERSION,FO_CONFIG.BASELINE],
    ['CONCENTRATION','Sector Concentration %',portfolio.sectorConcentrationPct,foA22Status_('sector',portfolio.sectorConcentrationPct),'Largest sector exposure.',now,runId,FO_CONFIG.PLATFORM_VERSION,FO_CONFIG.BASELINE],
    ['CONCENTRATION','Currency Concentration %',portfolio.currencyConcentrationPct,foA22Status_('currency',portfolio.currencyConcentrationPct),'Largest currency exposure.',now,runId,FO_CONFIG.PLATFORM_VERSION,FO_CONFIG.BASELINE],
    ['STRESS','Stress Test Score',portfolio.stressTestScore,foA22Status_('risk',portfolio.stressTestScore),'Composite vulnerability score.',now,runId,FO_CONFIG.PLATFORM_VERSION,FO_CONFIG.BASELINE],
    ['POSITION','Highest-Risk Position',riskiest.ticker,riskiest.riskLevel,riskiest.driver+' | Score '+riskiest.riskScore,now,runId,FO_CONFIG.PLATFORM_VERSION,FO_CONFIG.BASELINE],
    ['PORTFOLIO','Portfolio Value',portfolio.portfolioValue,'INFORMATIONAL','Current valued portfolio.',now,runId,FO_CONFIG.PLATFORM_VERSION,FO_CONFIG.BASELINE]
  ];

  foA22Replace_(foA22Ensure_(ss,'Risk Dashboard',FO_A22_DASHBOARD_HEADERS), rows);
  return {status:'SUCCESS',rowsWritten:rows.length};
}

function foRunPositionRiskValidationA22(runId) {
  const ss = foDashboard_();
  const checks = [];
  const pos = ss.getSheetByName('Position Risk');
  const port = ss.getSheetByName('Portfolio Risk');
  const dash = ss.getSheetByName('Risk Dashboard');
  const hist = ss.getSheetByName('Risk History');

  checks.push(foA22Check_('SCHEMA','Position Risk',foA22Schema_(pos,FO_A22_POSITION_HEADERS),'CRITICAL'));
  checks.push(foA22Check_('SCHEMA','Portfolio Risk',foA22Schema_(port,FO_A22_PORTFOLIO_HEADERS),'CRITICAL'));
  checks.push(foA22Check_('SCHEMA','Risk Dashboard',foA22Schema_(dash,FO_A22_DASHBOARD_HEADERS),'HIGH'));
  checks.push(foA22Check_('SCHEMA','Risk History',foA22Schema_(hist,FO_A22_PORTFOLIO_HEADERS),'HIGH'));
  checks.push(foA22Check_('OUTPUT','Position Risk populated',!!pos&&pos.getLastRow()>1,'CRITICAL'));
  checks.push(foA22Check_('OUTPUT','Portfolio Risk populated',!!port&&port.getLastRow()===2,'CRITICAL'));

  let invalidScores=0, invalidWeights=0;
  if (pos && pos.getLastRow()>1) {
    const v=pos.getDataRange().getDisplayValues(), h=foA22Map_(v[0]);
    v.slice(1).forEach(r=>{
      const s=foA22Num_(r[h['Risk Score']]), w=foA22Num_(r[h['Portfolio Weight %']]);
      if(s<0||s>100)invalidScores++;
      if(w<0||w>100)invalidWeights++;
    });
  }
  checks.push(foA22Check_('CALCULATION','Risk scores in range',invalidScores===0,'CRITICAL'));
  checks.push(foA22Check_('CALCULATION','Weights in range',invalidWeights===0,'CRITICAL'));

  const latest = foA22ReadPortfolioRisk_(ss);
  checks.push(foA22Check_('LINEAGE','Run lineage',!runId||!latest||latest.runId===runId,'HIGH'));

  const validationId='RISK-CALC-VAL-'+Utilities.formatDate(new Date(),FO_CONFIG.TIMEZONE||Session.getScriptTimeZone(),'yyyyMMdd-HHmmss');
  const out=foA22Ensure_(ss,'Position Risk Validation',['Validation Run ID','Timestamp','Category','Control','Status','Severity','Details','Platform Version','Baseline']);
  foA22Append_(out,checks.map(c=>[validationId,new Date(),c.category,c.control,c.status,c.severity,c.details,FO_CONFIG.PLATFORM_VERSION,FO_CONFIG.BASELINE]));
  const failed=checks.filter(c=>c.status==='FAIL').length;
  return {status:failed?'FAIL':'PASS',validationRunId:validationId,failedControls:failed,passedControls:checks.length-failed,totalControls:checks.length,blocking:failed>0};
}

function foRunPositionRiskSmokeTestA22() {
  const result=foRunPositionRiskEngineA22();
  if(result.validation.failedControls)throw new Error('A2.2 blocking failure: '+JSON.stringify(result));
  return {status:'PASS',runId:result.runId,positionsCalculated:result.positionsCalculated,portfolioRiskScore:result.portfolioRisk.riskScore,overallRisk:result.portfolioRisk.overallRisk,releaseTarget:FO_A22_RELEASE_TARGET,nextStep:'Integrate A2.2 into CIO orchestrator'};
}

function foA22ReadPosition_(r,h){
  const id=foA22Text_(foA22Cell_(r,h,'Position ID'));
  const ticker=foA22Text_(foA22Cell_(r,h,'Ticker'));
  const account=foA22Text_(foA22Cell_(r,h,'Account'));
  const mv=foA22Num_(foA22Cell_(r,h,'Market Value'));
  if(!ticker||mv<=0||!(id.indexOf('POS-')===0||(account&&mv>0)))return null;
  return {positionId:id,ticker,account:account||'Unknown',quantity:foA22Num_(foA22Cell_(r,h,'Quantity')),currentPrice:foA22Num_(foA22Cell_(r,h,'Current Price')),marketValue:mv,assetClass:foA22Text_(foA22Cell_(r,h,'Asset Class'))||'Unknown',sector:foA22Text_(foA22Cell_(r,h,'Sector'))||'Unknown',country:foA22Text_(foA22Cell_(r,h,'Country'))||'Unknown',currency:foA22Text_(foA22Cell_(r,h,'Currency'))||'Unknown',riskRating:foA22Text_(foA22Cell_(r,h,'Risk Rating')),notes:foA22Text_(foA22Cell_(r,h,'Notes')),company:foA22Text_(foA22Cell_(r,h,'Company'))};
}
function foA22DataQuality_(p){return [[p.ticker,15],[p.account!=='Unknown',15],[p.quantity>0,10],[p.currentPrice>0,15],[p.marketValue>0,20],[p.assetClass!=='Unknown',10],[p.sector!=='Unknown',5],[p.currency!=='Unknown',5],[p.country!=='Unknown',5]].reduce((s,x)=>s+(x[0]?x[1]:0),0);}
function foA22Concentration_(w){if(w<=5)return foA22Round_(w*2,1);if(w<=10)return foA22Round_(10+(w-5)*4,1);if(w<=15)return foA22Round_(30+(w-10)*6,1);if(w<=20)return foA22Round_(60+(w-15)*6,1);return foA22Clamp_(90+(w-20),0,100);}
function foA22PositionScore_(p){let s=15+p.concentration*.45+(100-p.dataQuality)*.30;const d=[];const sec=p.sector.toUpperCase(),t=p.ticker.toUpperCase(),txt=(p.riskRating+' '+p.notes+' '+p.company).toUpperCase();if(p.assetClass.toUpperCase().includes('ETF'))s-=8;if(sec.includes('TECH')||sec.includes('SEMICONDUCTOR'))s+=8;if(sec==='UNKNOWN'){s+=10;d.push('Unknown sector');}if(p.currency==='Unknown'){s+=6;d.push('Unknown currency');}if(txt.includes('SPECULATIVE')||['QNC','ONE','QBTS','RGTI'].includes(t)){s+=15;d.push('Speculative security');}if(p.weight>=15)d.unshift('Position concentration');if(p.dataQuality<80)d.push('Data quality');if(p.currentPrice<=0){s+=12;d.push('Missing current price');}s=foA22Round_(foA22Clamp_(s,0,100),1);const l=foA22Level_(s);return {score:s,level:l,driver:d[0]||'Balanced risk profile',recommendation:l==='CRITICAL'?'REDUCE / REVIEW IMMEDIATELY':l==='HIGH'?'REVIEW CONCENTRATION':l==='LOW'?'MAINTAIN':'HOLD / MONITOR'};}
function foA22Diversification_(n,l,t,s,c){let x=100-Math.max(0,l-10)*1.8-Math.max(0,t-55)*.8-Math.max(0,s-35)*.8-Math.max(0,c-70)*.4;if(n<5)x-=20;else if(n<8)x-=10;else if(n>=12)x+=5;return foA22Round_(foA22Clamp_(x,0,100),1);}
function foA22Stress_(p,l,s){const spec=p.filter(x=>['QNC','ONE','QBTS','RGTI'].includes(x.ticker.toUpperCase())||(x.riskRating+' '+x.notes).toUpperCase().includes('SPECULATIVE')).reduce((a,x)=>a+x.weight,0);return foA22Round_(foA22Clamp_(20+foA22Scale_(l,20)*.3+foA22Scale_(s,50)*.25+foA22Scale_(spec,25)*.45,0,100),1);}
function foA22PortfolioRecommendation_(r,d,l,t,s,c,q){const a=[];if(l>=20)a.push('Reduce largest-position concentration');else if(l>=15)a.push('Review largest position');if(t>=75)a.push('Broaden holdings beyond top five');if(s>=50)a.push('Reduce sector concentration');if(c>=80)a.push('Review currency concentration');if(d<50)a.push('Improve diversification');if(q<80)a.push('Improve portfolio data quality');return a.length?a.join(' | '):(r<=35?'Maintain current risk posture':'Monitor portfolio risk and rebalance selectively');}
function foA22ReadPositionRisk_(ss){const sh=ss.getSheetByName('Position Risk');if(!sh||sh.getLastRow()<2)return[];const v=sh.getDataRange().getDisplayValues(),h=foA22Map_(v[0]);return v.slice(1).filter(r=>r[h['Ticker']]).map(r=>({runId:r[h['Run ID']],ticker:r[h['Ticker']],account:r[h['Account']],quantity:foA22Num_(r[h['Quantity']]),currentPrice:foA22Num_(r[h['Current Price']]),marketValue:foA22Num_(r[h['Market Value']]),weight:foA22Num_(r[h['Portfolio Weight %']]),assetClass:r[h['Asset Class']],sector:r[h['Sector']],country:r[h['Country']],currency:r[h['Currency']],concentration:foA22Num_(r[h['Concentration Score']]),dataQuality:foA22Num_(r[h['Data Quality Score']]),riskScore:foA22Num_(r[h['Risk Score']]),riskLevel:r[h['Risk Level']],driver:r[h['Primary Risk Driver']],recommendation:r[h['Recommendation']],riskRating:'',notes:''}));}
function foA22ReadPortfolioRisk_(ss){const sh=ss.getSheetByName('Portfolio Risk');if(!sh||sh.getLastRow()<2)return null;const v=sh.getDataRange().getDisplayValues(),h=foA22Map_(v[0]),r=v[v.length-1];return {runId:r[h['Run ID']],portfolioValue:foA22Num_(r[h['Portfolio Value']]),riskScore:foA22Num_(r[h['Risk Score']]),diversificationScore:foA22Num_(r[h['Diversification Score']]),largestPositionPct:foA22Num_(r[h['Largest Position %']]),top5Pct:foA22Num_(r[h['Top 5 %']]),sectorConcentrationPct:foA22Num_(r[h['Sector Concentration %']]),currencyConcentrationPct:foA22Num_(r[h['Currency Concentration %']]),stressTestScore:foA22Num_(r[h['Stress Test Score']]),overallRisk:r[h['Overall Risk']],recommendation:r[h['Recommendation']]};}
function foA22MaxGroup_(p,f){const m={};p.forEach(x=>m[x[f]||'Unknown']=(m[x[f]||'Unknown'])+x.weight);return Math.max.apply(null,Object.keys(m).map(k=>m[k]));}
function foA22Level_(s){return s>=75?'CRITICAL':s>=55?'HIGH':s>=35?'MODERATE':'LOW';}
function foA22Status_(m,v){if(m==='diversification')return v>=75?'GOOD':v>=55?'REVIEW':'WEAK';const t={risk:[35,55,75],largest:[10,15,20],top5:[55,65,75],sector:[35,40,50],currency:[60,70,80]}[m]||[35,55,75];return v>=t[2]?'CRITICAL':v>=t[1]?'HIGH':v>=t[0]?'REVIEW':'PASS';}
function foA22RunId_(){return 'RISK-RUN-'+Utilities.formatDate(new Date(),FO_CONFIG.TIMEZONE||Session.getScriptTimeZone(),'yyyyMMdd-HHmmss');}
function foA22Ensure_(ss,n,h){let s=ss.getSheetByName(n);if(!s)s=ss.insertSheet(n);const c=s.getLastColumn()?s.getRange(1,1,1,Math.max(s.getLastColumn(),h.length)).getDisplayValues()[0].slice(0,h.length):[];if(!s.getLastRow()||c.join('|')!==h.join('|')){s.clear();s.getRange(1,1,1,h.length).setValues([h]);}s.setFrozenRows(1);s.getRange(1,1,1,h.length).setFontWeight('bold');return s;}
function foA22Replace_(s,r){const h=s.getRange(1,1,1,s.getLastColumn()).getValues();s.clearContents();s.getRange(1,1,1,h[0].length).setValues(h);if(r.length)s.getRange(2,1,r.length,r[0].length).setValues(r);s.setFrozenRows(1);s.autoResizeColumns(1,s.getLastColumn());}
function foA22Append_(s,r){if(r.length)s.getRange(s.getLastRow()+1,1,r.length,r[0].length).setValues(r);}
function foA22Schema_(s,h){if(!s||s.getLastColumn()<h.length)return false;return s.getRange(1,1,1,h.length).getDisplayValues()[0].join('|')===h.join('|');}
function foA22Check_(cat,ctl,pass,sev){return {category:cat,control:ctl,status:pass?'PASS':'FAIL',severity:pass?'NONE':sev,details:pass?'Control valid.':'Control failed.'};}
function foA22Map_(h){return h.reduce((m,x,i)=>(m[String(x).trim()]=i,m),{});}
function foA22Cell_(r,h,k){return h[k]===undefined?'':r[h[k]];}
function foA22Text_(v){return String(v===null||v===undefined?'':v).trim();}
function foA22Num_(v){if(typeof v==='number')return isFinite(v)?v:0;const n=Number(String(v||'').replace(/[$,%\s]/g,'').replace(/,/g,''));return isFinite(n)?n:0;}
function foA22Round_(value, decimals) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  const places = Number.isFinite(Number(decimals)) ? Number(decimals) : 0;
  const factor = Math.pow(10, places);
  return Math.round(numericValue * factor) / factor;
}
function foA22Clamp_(value, minValue, maxValue) {
  const n=Number(value), min=Number(minValue), max=Number(maxValue);
  if (![n,min,max].every(Number.isFinite)) throw new Error('A2.2.1 clamp received non-finite input.');
  return Math.min(max, Math.max(min, n));
}
function foA22Scale_(v,b){return foA22Clamp_(v/b*100,0,100);}


function foA22FiniteNumber_(value, fallback, fieldName) {
  const fb=Number.isFinite(Number(fallback))?Number(fallback):0;
  let n;
  if (typeof value === 'number') n=value; else {
    const cleaned=String(value===null||value===undefined?'':value).replace(/[$,%\s]/g,'').replace(/,/g,'');
    n=cleaned===''?fb:Number(cleaned);
  }
  if (!Number.isFinite(n)) { Logger.log('A2.2.1 substituted non-finite value for '+(fieldName||'field')+': '+value); return fb; }
  return n;
}

function foA22SafeMaxGroupWeight_(positions, fieldName) {
  const groups={};
  positions.forEach(function(p){ const k=foA22Text_(p[fieldName])||'Unknown'; groups[k]=(groups[k]||0)+foA22FiniteNumber_(p.portfolioWeightPct,0,fieldName+' '+p.ticker); });
  return foA22Round_(Object.keys(groups).reduce(function(m,k){ return Math.max(m,foA22FiniteNumber_(groups[k],0,k)); },0),4);
}


function foA22Number_(value) {
  return foA22FiniteNumber_(value, 0);
}


function foA22ScaleTo100_(value, breachValue) {
  const n=Number(value), b=Number(breachValue);
  if (!Number.isFinite(n)||!Number.isFinite(b)||b<=0) throw new Error('A2.2.1 scale received invalid input.');
  return foA22Clamp_(n / b * 100, 0, 100);
}


function foA22RiskLevel_(score) {
  const n=Number(score);
  if (!Number.isFinite(n)) return 'UNAVAILABLE';
  if (n>=75) return 'CRITICAL';
  if (n>=55) return 'HIGH';
  if (n>=35) return 'MODERATE';
  return 'LOW';
}


function foA22MetricStatus_(metric, value) {
  const n=Number(value);
  if (!Number.isFinite(n)) return 'UNAVAILABLE';
  if (metric === 'diversification') { if (n>=75) return 'GOOD'; if (n>=55) return 'REVIEW'; return 'WEAK'; }
  const t={risk:[35,55,75],largest:[10,15,20],top5:[55,65,75],sector:[35,40,50],currency:[60,70,80]}[metric] || [35,55,75];
  if (n>=t[2]) return 'CRITICAL';
  if (n>=t[1]) return 'HIGH';
  if (n>=t[0]) return 'REVIEW';
  return 'PASS';
}


function foA22DiversificationScore_(positionCount, largestPositionPct, top5Pct, sectorConcentrationPct, currencyConcentrationPct) {
  const count = foA22FiniteNumber_(positionCount, 0, 'positionCount');
  const largest = foA22FiniteNumber_(largestPositionPct, 0, 'largestPositionPct');
  const top5 = foA22FiniteNumber_(top5Pct, 0, 'top5Pct');
  const sector = foA22FiniteNumber_(sectorConcentrationPct, 0, 'sectorConcentrationPct');
  const currency = foA22FiniteNumber_(currencyConcentrationPct, 0, 'currencyConcentrationPct');

  let score = 100;
  score -= Math.max(0, largest - 10) * 1.8;
  score -= Math.max(0, top5 - 55) * 0.8;
  score -= Math.max(0, sector - 35) * 0.8;
  score -= Math.max(0, currency - 70) * 0.4;

  if (count < 5) score -= 20;
  else if (count < 8) score -= 10;
  else if (count >= 12) score += 5;

  return foA22Round_(foA22Clamp_(score, 0, 100), 1);
}


function foA22StressScore_(positions, largestPositionPct, sectorConcentrationPct) {
  if (!positions || !positions.length) return 0;

  const largest = foA22FiniteNumber_(largestPositionPct, 0, 'stress largest');
  const sector = foA22FiniteNumber_(sectorConcentrationPct, 0, 'stress sector');

  const speculativeWeight = positions.filter(function(position) {
    const ticker = foA22Text_(position.ticker).toUpperCase();
    const text = (foA22Text_(position.riskRating) + ' ' + foA22Text_(position.notes)).toUpperCase();
    return ['QNC','ONE','QBTS','RGTI'].indexOf(ticker) >= 0 || text.indexOf('SPECULATIVE') >= 0;
  }).reduce(function(sum, position) {
    return sum + foA22FiniteNumber_(position.portfolioWeightPct, 0, 'speculative weight');
  }, 0);

  const score = 20
    + foA22ScaleTo100_(largest, 20) * 0.30
    + foA22ScaleTo100_(sector, 50) * 0.25
    + foA22ScaleTo100_(speculativeWeight, 25) * 0.45;

  return foA22Round_(foA22Clamp_(score, 0, 100), 1);
}


function foRunPositionRiskHelperDiagnosticA222() {
  const tests = {
    diversification: typeof foA22DiversificationScore_ === 'function',
    stress: typeof foA22StressScore_ === 'function',
    recommendation: typeof foA22PortfolioRecommendation_ === 'function',
    finiteNumber: typeof foA22FiniteNumber_ === 'function',
    safeGroupWeight: typeof foA22SafeMaxGroupWeight_ === 'function'
  };

  const missing = Object.keys(tests).filter(function(key) { return !tests[key]; });
  const result = {status: missing.length ? 'FAIL' : 'PASS', missingFunctions: missing};
  Logger.log(JSON.stringify(result));
  return result;
}
