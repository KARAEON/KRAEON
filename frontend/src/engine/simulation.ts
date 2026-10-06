import { assetTemplateById, calculateDevelopmentDemand, type Development } from './developments';

export const sectorNames = ['Households', 'Agriculture + fisheries', 'Business + tourism', 'Critical services'] as const;
export const sectorColors = ['#249f9a', '#5e9a55', '#df9a35', '#6673d3'];
export type SectorValues = [number, number, number, number];
export type Municipality = { id: string; name: string; activeInSimulation: boolean; households: number; income: number; capacity: number; opening: number; provider: string; sources: {name: string; output: number; type: string}[]; demand: SectorValues };
export const municipalities: Municipality[] = [
  { id:'catbalogan', name:'Catbalogan City', activeInSimulation:true, households:24000, income:18000, capacity:40, opening:24, provider:'Catbalogan Water District', sources:[{name:'River intake',output:28,type:'Surface water'},{name:'Upland springs',output:14,type:'Spring network'}], demand:[24,9,8,5] },
  { id:'pinabacdao', name:'Pinabacdao', activeInSimulation:true, households:4500, income:12000, capacity:16, opening:8, provider:'Pinabacdao Local Water Supply', sources:[{name:'Local spring network',output:10,type:'Spring network'},{name:'Community deep wells',output:5,type:'Groundwater'}], demand:[7,8,2,1] },
  { id:'calbayog', name:'Calbayog', activeInSimulation:true, households:38000, income:16000, capacity:24, opening:12, provider:'Calbayog configurable utility', sources:[{name:'Municipal intake',output:19,type:'Surface water'}], demand:[10,7,2.5,1.5] },
  ...['Almagro','Basey','Calbiga','Daram','Gandara','Hinabangan','Jiabong','Marabut','Matuguinao','Motiong','Pagsanghan','Paranas','San Jorge','San Jose de Buan','San Sebastian','Santa Margarita','Santa Rita','Santo Niño','Tagapul-an','Talalora','Tarangnan','Villareal','Zumarraga'].map(name=>({id:name.toLowerCase().replaceAll(' ','-'),name,activeInSimulation:false,households:0,income:0,capacity:0,opening:0,provider:'Unconfigured',sources:[],demand:[0,0,0,0] as SectorValues}))
];
export type Inputs = { supply: number; drought: number; demand: number; allocation: number; nrw: number; reserve: number; supplementary: boolean; protect: boolean; price: number; income: number; budget: number; sourceOutputs: number[]; sectorDemand: SectorValues; allocationShares: SectorValues };
export type Scenario = { id: string; name: string; inputs: Record<string,Inputs>; developments?: Development[] };
export function baseline(id='baseline',name='Baseline'):Scenario { return {id,name,inputs:Object.fromEntries(municipalities.filter(m=>m.activeInSimulation).map(m=>[m.id,{supply:100,drought:0,demand:100,allocation:100,nrw:28,reserve:22,supplementary:false,protect:false,price:32,income:m.income,budget:0,sourceOutputs:m.sources.map(s=>s.output),sectorDemand:[...m.demand],allocationShares:[25,25,25,25]}])),developments:[]}; }
export const sum = (v:number[])=>v.reduce((a,b)=>a+b,0);
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function simulateMunicipality(m:Municipality,p:Inputs,developments:Development[] = []) {
  const sourceOutputs=p.sourceOutputs.map(v=>Math.max(0,v)*p.supply/100*(1-p.drought/100));
  const supply=sum(sourceOutputs)+(p.supplementary?5:0);
  const baseDemands=p.sectorDemand.map(v=>Math.max(0,v)*p.demand/100);
  const developmentDemands:SectorValues=[0,0,0,0];
  const activeDevelopments=developments.filter(item=>item.active && item.municipalityId===m.id && !!assetTemplateById[item.templateId]);
  activeDevelopments.forEach(item=>{developmentDemands[assetTemplateById[item.templateId].sector]+=calculateDevelopmentDemand(item);});
  const demands=baseDemands.map((value,index)=>value+developmentDemands[index]);
  const existingDemand=sum(baseDemands), developmentDemand=sum(developmentDemands);
  const addedHouseholds=activeDevelopments.filter(item=>item.templateId==='subdivision').reduce((total,item)=>{
    const units=Number.isFinite(item.inputs.units)?Math.max(0,item.inputs.units):0;
    const occupancy=Number.isFinite(item.inputs.occupancy)?clamp(item.inputs.occupancy,0,100):0;
    return total+units*occupancy/100;
  },0);
  const households=Math.round(m.households+addedHouseholds);
  const demand=sum(demands), target=demands.map(v=>v*p.allocation/100);
  const nrw=clamp(p.nrw,0,80)/100, reserve=clamp(p.reserve,0,90)/100;
  const reserveVolume=m.capacity*reserve;
  const grossAvailable=supply+m.opening;
  const allocable=Math.max(0,grossAvailable-reserveVolume)*(1-nrw);
  const allocations=[0,0,0,0];
  let remaining=Math.min(allocable,sum(target));
  if(p.protect) { for (const i of [3,0]) {const reserved=Math.min(remaining,target[i]*(i===0?.8:1)); allocations[i]=reserved;remaining-=reserved;} }
  // Allocation shares are direct distribution channels. Water that cannot be
  // used by a fully met channel is redistributed among channels with demand.
  let active=[0,1,2,3];
  while(remaining>1e-9&&active.length) {
    const channelTotal=sum(active.map(index=>p.allocationShares[index]));
    const needTotal=sum(active.map(index=>target[index]-allocations[index]));
    const distributed=active.map(index=>{
      const basis=channelTotal>1e-9?p.allocationShares[index]:target[index]-allocations[index];
      const total=channelTotal>1e-9?channelTotal:needTotal;
      return Math.min(target[index]-allocations[index],remaining*basis/total);
    });
    distributed.forEach((amount,index)=>allocations[active[index]]+=Math.max(0,amount));
    const used=sum(distributed);
    remaining-=used;
    const next=active.filter(index=>target[index]-allocations[index]>1e-9);
    if(next.length===active.length&&used<=1e-9) break;
    active=next;
  }
  const allocation=sum(allocations), physicalRemaining=grossAvailable-allocation/(1-nrw), ending=clamp(physicalRemaining,0,m.capacity), spill=Math.max(0,physicalRemaining-m.capacity), reserveShortfall=Math.max(0,reserveVolume-ending);
  const coverage=demands.map((v,i)=>v?allocations[i]/v:1);
  const affected=Math.round(households*(1-coverage[0]));
  const monthlyExpense=15*p.price, assisted=Math.min(households,Math.floor(p.budget/300));
  const spent=assisted*300, averageAssistance=spent/Math.max(1,households);
  return {id:m.id,name:m.name,supply,demand,existingDemand,developmentDemand,developmentDemands,developmentCount:activeDevelopments.length,allocation,allocable,ending,spill,capacity:m.capacity,opening:m.opening,nrw,reserve,reserveVolume,reserveShortfall,sourceOutputs,demands,allocations,coverage,shortage:Math.max(0,demand-allocation),gap:Math.max(0,demand-supply),households,affected,assisted,spent,unspent:p.budget-spent,monthlyExpense,burden:Math.max(0,monthlyExpense-averageAssistance)/p.income*100,livelihood:1-coverage[1]};
}
export function simulate(scenario:Scenario,scope='combined') {
  const results=municipalities.filter(m=>m.activeInSimulation && (scope==='combined'||m.id===scope)).map(m=>simulateMunicipality(m,scenario.inputs[m.id],scenario.developments?.filter(item=>item.municipalityId===m.id) || []));
  const total=(key:'supply'|'demand'|'existingDemand'|'developmentDemand'|'developmentCount'|'allocation'|'allocable'|'ending'|'capacity'|'opening'|'shortage'|'gap'|'households'|'affected'|'assisted'|'spent'|'unspent')=>sum(results.map(r=>r[key]));
  const demands=sectorNames.map((_,i)=>sum(results.map(r=>r.demands[i]))), allocations=sectorNames.map((_,i)=>sum(results.map(r=>r.allocations[i])));
  return {results,supply:total('supply'),demand:total('demand'),existingDemand:total('existingDemand'),developmentDemand:total('developmentDemand'),developmentCount:total('developmentCount'),allocation:total('allocation'),allocable:total('allocable'),ending:total('ending'),capacity:total('capacity'),opening:total('opening'),shortage:total('shortage'),gap:total('gap'),households:total('households'),affected:total('affected'),assisted:total('assisted'),spent:total('spent'),unspent:total('unspent'),demands,allocations,coverage:demands.map((d,i)=>d?allocations[i]/d:1),burden:sum(results.map(r=>r.burden*r.households))/Math.max(1,total('households'))};
}
export type Result=ReturnType<typeof simulate>;
