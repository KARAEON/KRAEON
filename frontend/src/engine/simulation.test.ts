import test from 'node:test';
import assert from 'node:assert/strict';
import {baseline,simulate,simulateMunicipality,municipalities,type Inputs} from './simulation';
import { assetTemplateById, calculateBenefitPerPeso, calculateDevelopmentDemand, calculateInterventionValuation, calculateRecoveredWaterTariffValue, defaultDevelopmentInputs, type BenefitPerPesoProject, type Development } from './developments';
test('planner intervention valuation matches GIS simple lifecycle calculations',()=>{
  const result=calculateInterventionValuation({capexPhp:100000,annualOpexPhp:1000,usefulLifeYears:10,waterGainM3PerDay:10,householdsBenefited:100});
  assert.equal(result.simpleLifecycleCostPhp,110000);
  assert.equal(result.lifetimeWaterM3,36500);
  assert.equal(result.simpleLifecycleCostPerM3Php,3.0137);
  assert.equal(result.capexPerHouseholdPhp,1000);
  assert.equal(result.economicLossAvoidedPhpYear,null);
  assert.equal(calculateInterventionValuation({capexPhp:100,annualOpexPhp:0,usefulLifeYears:15,waterGainM3PerDay:0,householdsBenefited:0}).simpleLifecycleCostPerM3Php,null);
});
test('planner benefit-per-peso uses GIS default weights and ranks the portfolio',()=>{
  const projects:BenefitPerPesoProject[]=[
    {id:'a',name:'A',capexPhp:100000,annualOpexPhp:1000,usefulLifeYears:10,waterGainM3PerDay:10,householdsBenefited:5,equityScore:50,economicBenefitScore:50,reliabilityScore:50},
    {id:'b',name:'B',capexPhp:100000,annualOpexPhp:1000,usefulLifeYears:10,waterGainM3PerDay:20,householdsBenefited:10,equityScore:50,economicBenefitScore:50,reliabilityScore:50},
  ];
  const result=calculateBenefitPerPeso(projects);
  assert.equal(result[0].id,'b');
  assert.equal(result[0].rank,1);
  assert.equal(result[0].publicBenefitScore,70);
  assert.equal(result[1].publicBenefitScore,50);
});
test('GIS rounding is applied to valuation before cost-efficiency ranking',()=>{
  const base={capexPhp:1,annualOpexPhp:0,usefulLifeYears:1,householdsBenefited:3,equityScore:50,economicBenefitScore:50,reliabilityScore:50};
  const ranking=calculateBenefitPerPeso([{...base,id:'a',name:'A',waterGainM3PerDay:1},{...base,id:'b',name:'B',waterGainM3PerDay:2}]);
  assert.equal(ranking[0].valuation.simpleLifecycleCostPerM3Php,.0014);
  assert.equal(ranking[0].valuation.capexPerHouseholdPhp,.33);
  assert.equal(ranking[1].valuation.simpleLifecycleCostPerM3Php,.0027);
  assert.equal(ranking[1].subscores.costEfficiency,51.85);
  assert.equal(ranking[1].publicBenefitScore,50.19);
});
test('GIS peso indicator values recovered water even when delivery is unchanged',()=>{
  const s=baseline();s.inputs.calbayog.allocationTargets=[1,0,0,0];
  const before=simulate(s,'calbayog').results[0];
  s.inputs.calbayog.nrw=10;
  const after=simulate(s,'calbayog').results[0];
  assert.equal(before.allocation,after.allocation);
  assert.equal(calculateRecoveredWaterTariffValue(before.nrwVolume,after.nrwVolume,32),109440);
  assert.equal(calculateRecoveredWaterTariffValue(1,2,32),0);
  assert.equal(calculateRecoveredWaterTariffValue(2,1,0),null);
  assert.equal(calculateInterventionValuation({capexPhp:1.005,annualOpexPhp:0,usefulLifeYears:1,waterGainM3PerDay:1,householdsBenefited:1}).simpleLifecycleCostPhp,1.01);
});
test('water supply matches GIS deductions when opening storage is zero',()=>{
  const m={...municipalities[1],opening:0};
  const p:Inputs={...baseline().inputs[m.id],sourceOutputs:[100],nrw:28,reserve:22,sectorDemand:[60,0,0,0],allocationTargets:[60,0,0,0]};
  const r=simulateMunicipality(m,p);
  assert.ok(Math.abs(r.nrwVolume-28)<1e-9);
  assert.equal(r.reserveVolume,22);
  assert.equal(r.allocable,50);
  assert.equal(r.shortage,10);
  assert.equal(r.gap,10);
  assert.equal(r.affected,750);
});
test('opening storage adds to GIS supply without a second NRW deduction',()=>{
  const s=baseline();const p=s.inputs.pinabacdao;
  p.sourceOutputs=[100];p.nrw=28;p.reserve=22;p.allocationTargets=[100,100,100,100];
  const r=simulate(s,'pinabacdao').results[0];
  assert.equal(r.allocable,58);
  assert.equal(r.allocation,58);
  assert.equal(r.ending,16);
  assert.equal(r.spill,6);
  p.nrw=100;
  const noSupply=simulate(s,'pinabacdao').results[0];
  assert.equal(noSupply.allocable,0);
  assert.ok(Number.isFinite(noSupply.ending));
});
import { migrateScenario, readSavedScenarios, persistSavedScenarios, scenarioStorageKey, scenarioBackupKey } from './scenarios';
test('baseline includes the configured protected reserve in closing storage',()=>{const r=simulate(baseline());assert.equal(r.supply,76);assert.equal(r.demand,85);assert.equal(r.results.length,3);assert.equal(r.gap,47);assert.ok(Math.abs(r.ending-17.22)<1e-8);});
test('drought, supplementary supply, and allocation obey daily physical mass balance',()=>{for(let drought=0;drought<=100;drought+=10)for(const allocation of [0,50,100]){const s=baseline();for(const p of Object.values(s.inputs)){p.drought=drought;p.allocation=allocation;p.protect=true;p.allocationShares=[55,20,15,10];}for(const r of simulate(s).results){assert.ok(r.ending>=0&&r.ending<=r.capacity);assert.ok(Math.abs(r.opening+r.supply-r.nrwVolume-r.allocation-r.ending-r.spill)<1e-8);r.coverage.forEach(c=>assert.ok(c>=0&&c<=1.000001));assert.ok(r.allocation<=r.demand+1e-8);}}});
test('zero source output draws closing storage down to the protected reserve',()=>{const s=baseline();s.inputs.pinabacdao.supply=0;const r=simulate(s,'pinabacdao').results[0];assert.equal(r.supply,0);assert.ok(Math.abs(r.ending-r.reserveVolume)<1e-8);assert.ok(Math.abs(Math.max(0,r.ending-r.reserveVolume))<1e-8);assert.ok(r.shortage>0);});
test('policies remain local and improve supply',()=>{const s=baseline();s.inputs.pinabacdao.drought=60;const before=simulate(s,'pinabacdao');s.inputs.pinabacdao.supplementary=true;const after=simulate(s,'pinabacdao');assert.equal(after.supply-before.supply,5);assert.ok(after.shortage<before.shortage);assert.equal(simulate(s,'catbalogan').supply,42);});
test('reducing NRW returns recovered water to allocable supply and sector deliveries',()=>{const s=baseline();const p=s.inputs.pinabacdao;p.drought=65;const baselineResult=simulate(s,'pinabacdao');p.nrw=10;const reducedNrwResult=simulate(s,'pinabacdao');assert.ok(reducedNrwResult.allocable>baselineResult.allocable);assert.ok(reducedNrwResult.allocation>=baselineResult.allocation);assert.ok(reducedNrwResult.shortage<=baselineResult.shortage);});
test('allocation channels redistribute unused water after a sector is fully met',()=>{const s=baseline();const p=s.inputs.pinabacdao;p.drought=100;p.sectorDemand[0]=1;p.allocationShares=[100,0,0,0];const r=simulate(s,'pinabacdao');assert.equal(r.allocations[0],1);assert.ok(Math.abs(r.allocation-r.allocable)<1e-8);assert.ok(Math.abs(r.allocations.slice(1).reduce((a,b)=>a+b,0)-(r.allocable-1))<1e-8);assert.equal(r.coverage[0],1);assert.ok(r.coverage[1]<1);});
test('inactive areas never enter totals even with injected inputs',()=>{const s=baseline();s.inputs.basey={...s.inputs.catbalogan,supply:999999};assert.equal(simulate(s).supply,76);assert.equal(simulate(s,'basey').results.length,0);assert.equal(municipalities.filter(m=>m.activeInSimulation).length,3);});
test('assistance cannot exceed households or budget',()=>{const s=baseline();s.inputs.pinabacdao.budget=100000000;const r=simulate(s,'pinabacdao');assert.equal(r.assisted,4500);assert.ok(r.spent<=100000000);assert.ok(r.burden>=0);});
test('placed establishments add profile demand to their municipality and sector, and pause cleanly',()=>{
  const scenario=baseline();
  const mall:Development={id:'mall-1',municipalityId:'pinabacdao',templateId:'mall',position:[2,2],inputs:defaultDevelopmentInputs(assetTemplateById.mall),active:true,status:'proposed'};
  scenario.developments=[mall];
  const before=simulate(baseline(),'pinabacdao');
  const after=simulate(scenario,'pinabacdao');
  const added=calculateDevelopmentDemand(mall);
  assert.ok(added>0);
  assert.ok(Math.abs(after.demand-before.demand-added)<1e-9);
  assert.ok(Math.abs(after.demands[2]-before.demands[2]-added)<1e-9);
  assert.equal(simulate(scenario,'catbalogan').demand,simulate(baseline(),'catbalogan').demand);
  assert.ok(after.ending<=before.ending);
  mall.active=false;
  assert.equal(simulate(scenario,'pinabacdao').demand,before.demand);
});
test('multiple developments combine and preserve physical mass balance',()=>{
  const scenario=baseline();
  scenario.inputs.calbayog.supply=0;
  scenario.developments=['subdivision','hospital','factory'].map((templateId,index)=>({id:`asset-${index}`,municipalityId:'calbayog',templateId,position:[index,2] as [number,number],inputs:defaultDevelopmentInputs(assetTemplateById[templateId]),active:true,status:'proposed' as const}));
  const result=simulate(scenario,'calbayog').results[0];
  const expected=scenario.developments.reduce((total,item)=>total+calculateDevelopmentDemand(item),0);
  assert.ok(Math.abs(result.developmentDemand-expected)<1e-9);
  assert.ok(result.shortage>0);
  assert.ok(Math.abs(result.opening+result.supply-result.nrwVolume-result.allocation-result.ending-result.spill)<1e-8);
  assert.equal(result.households,38000+Math.round(1200*.85));
});

test('volume requests use the shared pool in saved priority order',()=>{
  const s=baseline();
  const p=s.inputs.pinabacdao;
  p.supply=0;p.nrw=0;p.reserve=0;p.allocationTargets=[8,8,8,8];
  assert.deepEqual(simulate(s,'pinabacdao').allocations,[8,0,0,0]);
  s.priorityOrder=[2,1,0,3];
  const r=simulate(s,'pinabacdao');
  assert.deepEqual(r.allocations,[0,0,8,0]);
  assert.equal(r.allocation,r.allocable);
  assert.equal(r.excessAllocations[2],6);
  assert.equal(r.shortage,16);
  assert.equal(r.coverage[2],1);
});

test('essential-needs protection precedes scenario priority',()=>{
  const s=baseline();const p=s.inputs.pinabacdao;
  p.supply=0;p.nrw=0;p.reserve=0;p.protect=true;p.allocationTargets=[8,8,8,8];s.priorityOrder=[1,2,0,3];
  const r=simulate(s,'pinabacdao');
  assert.equal(r.allocations[3],1);
  assert.ok(Math.abs(r.allocations[0]-5.6)<1e-9);
  assert.ok(Math.abs(r.allocations[1]-1.4)<1e-9);
  assert.equal(r.allocations[2],0);
});

test('zero requests preserve water and invalid priority falls back to the default',()=>{
  const s=baseline();const p=s.inputs.pinabacdao;
  p.allocationTargets=[0,0,0,0];
  assert.equal(simulate(s,'pinabacdao').allocation,0);
  p.supply=0;p.nrw=0;p.reserve=0;p.allocationTargets=[8,8,8,8];
  s.priorityOrder=[0,0,0,0] as typeof s.priorityOrder;
  assert.deepEqual(simulate(s,'pinabacdao').allocations,[8,0,0,0]);
});

test('new allocation requests preserve physical water balance across scarcity and excess',()=>{
  for(const drought of [0,50,100])for(const nrw of [0,28,80])for(const requests of [[0,0,0,0],[100,100,100,100],[3,10,1,2]]){
    const s=baseline();const p=s.inputs.pinabacdao;
    p.drought=drought;p.nrw=nrw;p.allocationTargets=requests as typeof p.allocationTargets;
    const r=simulate(s,'pinabacdao').results[0];
    assert.ok(r.allocation<=r.allocable+1e-9);
    assert.ok(Math.abs(r.opening+r.supply-r.nrwVolume-r.allocation-r.ending-r.spill)<1e-9);
    assert.equal(r.shortage,r.unmetBySector.reduce((a,b)=>a+b,0));
    assert.ok(r.coverage.every(c=>c>=0&&c<=1));
  }
});

function infrastructure(templateId:string,id=templateId):Development {
  return {id,municipalityId:'pinabacdao',templateId,position:[0,0],inputs:defaultDevelopmentInputs(assetTemplateById[templateId]),active:true,status:'proposed'};
}

test('pipeline and watershed supply follow drought without adding sector demand',()=>{
  const s=baseline();s.inputs.pinabacdao.drought=50;
  const before=simulate(s,'pinabacdao');
  s.developments=[infrastructure('pipeline'),infrastructure('watershed')];
  const r=simulate(s,'pinabacdao');
  assert.equal(r.infrastructureSupplyMlDay,1.5);
  assert.equal(r.supply-before.supply,1.5);
  assert.equal(r.developmentDemand,0);
  assert.equal(r.existingDemand,before.existingDemand);
  assert.equal(simulate(s,'catbalogan').infrastructureSupplyMlDay,0);
});

test('pipeline repair reduces existing network losses without creating supply or a placeable asset',()=>{
  const s=baseline();const before=simulate(s,'pinabacdao');const repair=infrastructure('pipeline-repair');
  assert.equal(assetTemplateById['pipeline-repair'].placeable,false);
  s.developments=[repair];
  const r=simulate(s,'pinabacdao');
  assert.equal(r.results[0].nrw,.24);
  assert.equal(r.supply,before.supply);
  assert.equal(r.developmentDemand,0);
  assert.ok(r.allocable>before.allocable);
  repair.inputs.lossReduction=35;
  assert.equal(simulate(s,'pinabacdao').results[0].nrw,0);
  repair.active=false;
  assert.equal(simulate(s,'pinabacdao').allocable,before.allocable);
  s.developments=[];
  assert.equal(simulate(s,'pinabacdao').allocable,before.allocable);
});

test('legacy scenarios migrate demand and allocation while removing percentage fields',()=>{
  const legacy=baseline();const p=legacy.inputs.pinabacdao;
  p.demand=120;p.allocation=50;p.allocationShares=[55,20,15,10];
  delete (p as Partial<typeof p>).allocationTargets;
  const migrated=migrateScenario(legacy)!;
  assert.deepEqual(migrated.priorityOrder,[0,3,1,2]);
  assert.deepEqual(migrated.inputs.pinabacdao.sectorDemand,[8.4,9.6,2.4,1.2]);
  assert.deepEqual(migrated.inputs.pinabacdao.allocationTargets,[4.2,4.8,1.2,.6]);
  for(const key of ['demand','allocation','allocationShares'])assert.equal(key in migrated.inputs.pinabacdao,false);
});

test('migration bounds requests using active infrastructure and preserves new priority',()=>{
  const s=baseline();s.inputs.pinabacdao.supply=0;s.inputs.pinabacdao.allocationTargets=[40,0,0,0];
  s.priorityOrder=[3,2,1,0];s.developments=[infrastructure('pipeline')];s.developments[0].inputs.flow=40;
  const expected=simulate(s,'pinabacdao').allocable;
  const migrated=migrateScenario(s)!;
  assert.equal(migrated.inputs.pinabacdao.allocationTargets[0],Math.min(40,expected));
  assert.deepEqual(migrated.priorityOrder,[3,2,1,0]);
  assert.deepEqual(migrateScenario(migrated),migrated);
});

test('invalid saved entries do not discard valid scenarios or overwrite storage',()=>{
  const good=baseline('saved','Saved');
  const bad=structuredClone(good);bad.inputs.pinabacdao.sourceOutputs=[];
  const original=JSON.stringify([null,bad,good]);
  const storage={getItem:()=>original};
  assert.deepEqual(readSavedScenarios(storage).map(s=>s.id),['saved']);
  assert.deepEqual(readSavedScenarios({getItem:()=>'{invalid'}),[]);
});

test('saving backs up exact original JSON once before replacing saved scenarios',()=>{
  const original='[ {"id":"original"} ]';const items=new Map([[scenarioStorageKey,original]]);
  const storage={getItem:(key:string)=>items.get(key)??null,setItem:(key:string,value:string)=>{items.set(key,value);}};
  persistSavedScenarios([baseline('saved','Saved')],storage);
  assert.equal(items.get(scenarioBackupKey),original);
  persistSavedScenarios([baseline('saved-2','Saved 2')],storage);
  assert.equal(items.get(scenarioBackupKey),original);
  assert.equal(JSON.parse(items.get(scenarioStorageKey)!)[0].id,'saved-2');
});

test('backup storage failure leaves existing scenarios unchanged',()=>{
  const original=JSON.stringify([baseline('saved','Saved')]);const items=new Map([[scenarioStorageKey,original]]);
  const storage={getItem:(key:string)=>items.get(key)??null,setItem:(key:string,value:string)=>{if(key===scenarioBackupKey)throw new Error('Storage full');items.set(key,value);}};
  assert.throws(()=>persistSavedScenarios([baseline('new','New')],storage),/Storage full/);
  assert.equal(items.get(scenarioStorageKey),original);
});
