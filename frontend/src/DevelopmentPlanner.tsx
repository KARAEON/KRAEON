import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Droplets, Grip, Plus, Save, Search, Trash2, X } from "lucide-react";
import CityMaquette from "./CityMaquette";
import { assetTemplateById, assetTemplates, calculateBenefitPerPeso, calculateDevelopmentDemand, calculateInfrastructureImpact, calculateInterventionValuation, defaultDevelopmentInputs, developmentCostFields, developmentFinancials, type BenefitPerPesoProject, type Development, type DevelopmentStatus } from "./engine/developments";
import { sectorNames, simulate, type Municipality, type Result, type Scenario } from "./engine/simulation";

const format = (value:number,digits=2)=>value.toLocaleString("en-US",{maximumFractionDigits:digits});
const statusLabels:Record<DevelopmentStatus,string>={proposed:"Proposed",approved:"Approved",existing:"Existing"};

export default function DevelopmentPlanner({ municipality, scenario, result, developments, initialDevelopmentId, onChange, onClose, onSaveScenario }: {
  municipality:Municipality;
  scenario:Scenario;
  result:Result;
  developments:Development[];
  initialDevelopmentId?:string | null;
  onChange:(next:Development[])=>void;
  onClose:()=>void;
  onSaveScenario:()=>void;
}) {
  const [query,setQuery]=useState("");
  const [templateId,setTemplateId]=useState(()=>developments.find(item=>item.id===initialDevelopmentId)?.templateId || "mall");
  const [draftInputs,setDraftInputs]=useState<Record<string,number>>(()=>defaultDevelopmentInputs(assetTemplateById.mall));
  const [selectedId,setSelectedId]=useState<string | null>(initialDevelopmentId || null);
  const [placing,setPlacing]=useState(false);
  const closeRef=useRef<HTMLButtonElement>(null);
  const template=assetTemplateById[templateId];
  const selected=developments.find(item=>item.id===selectedId);
  const inputs=selected?.inputs || draftInputs;
  const filtered=assetTemplates.filter(item=>`${item.name} ${item.category}`.toLowerCase().includes(query.trim().toLowerCase()));
  const byCategory=filtered.reduce<Record<string,typeof assetTemplates>>((groups,item)=>{
    (groups[item.category] ||= []).push(item);
    return groups;
  },{});
  const withoutDevelopments=useMemo(()=>simulate({...scenario,developments:(scenario.developments || []).filter(item=>item.municipalityId!==municipality.id)},municipality.id),[scenario,municipality.id]);
  const activeDevelopments=developments.filter(item=>item.active);
  const placedCount=developments.filter(item=>assetTemplateById[item.templateId].placeable!==false).length;
  const addedDemand=activeDevelopments.reduce((total,item)=>total+calculateDevelopmentDemand(item),0);
  const projectCosts=activeDevelopments.map(developmentFinancials);
  const totalCapexMillion=projectCosts.reduce((total,item)=>total+item.capexMillion,0);
  const annualOpexMillion=projectCosts.reduce((total,item)=>total+item.annualOpexMillion,0);
  const infrastructureSupplyAdded=Math.max(0,result.infrastructureSupplyMlDay-withoutDevelopments.infrastructureSupplyMlDay);
  const baseEffectiveNrw=withoutDevelopments.results[0]?.nrw??0;
  const scenarioEffectiveNrw=result.results[0]?.nrw??0;
  const nrwRecoveredPoints=Math.max(0,(baseEffectiveNrw-scenarioEffectiveNrw)*100);
  const selectedInfrastructureImpact=calculateInfrastructureImpact({templateId,inputs},scenario.inputs[municipality.id].drought);
  const selectedInfrastructureIsSupply=Boolean(template.addedSupplyMlDay);
  const candidate:Development=selected
    ? {...selected,inputs:{...inputs},active:true}
    : {id:"asset-impact-preview",municipalityId:municipality.id,templateId,position:[0,0],inputs:{...inputs},status:"proposed",active:true};
  const assetImpactPreview=useMemo(()=>{
    const otherMunicipalities=(scenario.developments || []).filter(item=>item.municipalityId!==municipality.id);
    const planWithoutAsset=[...otherMunicipalities,...developments.filter(item=>item.id!==selected?.id)];
    const baseline=simulate({...scenario,developments:planWithoutAsset},municipality.id);
    const withAsset=simulate({...scenario,developments:[...planWithoutAsset,candidate]},municipality.id);
    return {
      baseline,
      withAsset,
      demandDelta:withAsset.demand-baseline.demand,
      allocableDelta:withAsset.allocable-baseline.allocable,
      shortageDelta:withAsset.shortage-baseline.shortage,
      endingDelta:withAsset.ending-baseline.ending,
    };
  },[scenario,municipality.id,developments,selected,inputs,templateId,candidate]);
  const benefitPreview=useMemo(()=>{
    if(template.sector!==null)return null;
    const portfolio:Development[]=[
      ...developments.filter(item=>item.active&&item.id!==selected?.id&&assetTemplateById[item.templateId].sector===null),
      candidate,
    ];
    const projects:BenefitPerPesoProject[]=portfolio.map(asset=>{
      const otherMunicipalities=(scenario.developments || []).filter(item=>item.municipalityId!==municipality.id);
      const without=[...otherMunicipalities,...developments.filter(item=>item.id!==asset.id)];
      const before=simulate({...scenario,developments:without},municipality.id);
      const after=simulate({...scenario,developments:[...without,asset]},municipality.id);
      const financials=developmentFinancials(asset);
      return {
        id:asset.id,
        name:assetTemplateById[asset.templateId].name,
        capexPhp:financials.capexMillion*1_000_000,
        annualOpexPhp:financials.annualOpexMillion*1_000_000,
        usefulLifeYears:financials.usefulLifeYears,
        waterGainM3PerDay:Math.max(0,after.allocable-before.allocable)*1000,
        householdsBenefited:Math.max(0,before.affected-after.affected),
        equityScore:financials.equityScore,
        economicBenefitScore:financials.economicBenefitScore,
        reliabilityScore:financials.reliabilityScore,
      };
    });
    return calculateBenefitPerPeso(projects).find(item=>item.id===candidate.id) || null;
  },[scenario,municipality.id,developments,selected,candidate,template.sector]);
  const candidateFinancials=developmentFinancials(candidate);
  const candidateHouseholdBenefit=Math.max(0,assetImpactPreview.baseline.affected-assetImpactPreview.withAsset.affected);
  const candidateValuation=calculateInterventionValuation({
    capexPhp:candidateFinancials.capexMillion*1_000_000,
    annualOpexPhp:candidateFinancials.annualOpexMillion*1_000_000,
    usefulLifeYears:candidateFinancials.usefulLifeYears,
    waterGainM3PerDay:Math.max(0,assetImpactPreview.allocableDelta)*1000,
    householdsBenefited:candidateHouseholdBenefit,
  });
  const sectorData=sectorNames.map((name,index)=>({name,value:result.demands[index],allocation:result.allocations[index],coverage:result.coverage[index],excess:result.excessAllocations[index],unmet:result.unmetBySector[index],color:["#249f9a","#5e9a55","#df9a35","#6673d3"][index]}));

  useEffect(()=>{
    closeRef.current?.focus();
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose();};
    window.addEventListener("keydown",onKey);
    return ()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",onKey);};
  },[onClose]);

  const chooseTemplate=(id:string,arm=false)=>{
    setTemplateId(id);
    setDraftInputs(defaultDevelopmentInputs(assetTemplateById[id]));
    setSelectedId(null);
    setPlacing(arm && assetTemplateById[id].placeable!==false);
  };
  const chooseDevelopment=(item:Development)=>{
    setTemplateId(item.templateId);
    setSelectedId(item.id);
    setPlacing(false);
  };
  const updateDevelopment=(id:string,patch:Partial<Development>)=>onChange(developments.map(item=>item.id===id?{...item,...patch}:item));
  const changeField=(key:string,value:number)=>{
    const field=[...template.fields,...developmentCostFields(template)].find(item=>item.key===key);
    if(!field) return;
    const next={...inputs,[key]:Math.max(field.min,Math.min(field.max,Number.isFinite(value)?value:field.min))};
    if(selected)updateDevelopment(selected.id,{inputs:next});else setDraftInputs(next);
  };
  const signedChange=(value:number)=>`${value>0.005?"+":""}${format(value)} ML/day`;
  const place=(position:[number,number])=>{
    if(!placing || template.placeable===false)return;
    const item:Development={id:crypto.randomUUID(),municipalityId:municipality.id,templateId,position,inputs:{...draftInputs},status:"proposed",active:true};
    onChange([...developments,item]);
    setSelectedId(item.id);
    setPlacing(false);
  };
  const addConfiguredAsset=()=>{
    if(template.placeable!==false){setPlacing(true);return;}
    const item:Development={id:crypto.randomUUID(),municipalityId:municipality.id,templateId,position:[0,0],inputs:{...draftInputs},status:"proposed",active:true};
    onChange([...developments,item]);
    setSelectedId(item.id);
    setPlacing(false);
  };
  return <div className="development-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="development-planner" role="dialog" aria-modal="true" aria-labelledby="development-title" onKeyDown={event=>{
      if(event.key!=="Tab")return;
      const focusable=Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]),select:not([disabled])")).filter(node=>node.getClientRects().length>0);
      if(!focusable.length)return;
      if(event.shiftKey && document.activeElement===focusable[0]){event.preventDefault();focusable[focusable.length-1].focus();}
      else if(!event.shiftKey && document.activeElement===focusable[focusable.length-1]){event.preventDefault();focusable[0].focus();}
    }}>
      <header className="development-planner-head">
        <div><h2 id="development-title">Development planner</h2><p>{municipality.name} · Add developments or water infrastructure and see the one-day balance change.</p></div>
        <div className="development-head-actions"><button type="button" className="development-save" onClick={onSaveScenario}><Save size={16}/> Save as scenario</button><button ref={closeRef} type="button" className="development-close" aria-label="Close development planner" onClick={onClose}><X size={19}/></button></div>
      </header>
      <div className="development-planner-body">
        <aside className="development-library" aria-label="Development asset library">
          <div className="development-pane-head"><h3>Asset library</h3><span>{assetTemplates.length} types</span></div>
          <label className="development-search"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find an asset" aria-label="Find an asset"/></label>
          <p className="development-library-hint">Configure an asset, then place it on the terrain. Network repairs are added to the plan without placing a structure.</p>
          <div className="development-library-list">{filtered.length===0?<p className="development-empty">No assets match that search.</p>:Object.entries(byCategory).map(([category,items])=><div key={category}><h4>{category}</h4>{items?.map(item=><button key={item.id} type="button" draggable={item.placeable!==false} className={`development-asset${templateId===item.id && !selected?" selected":""}`} onClick={()=>chooseTemplate(item.id)} onDragStart={event=>{event.dataTransfer.setData("text/plain",item.id);event.dataTransfer.effectAllowed="copy";chooseTemplate(item.id,true);}}><span>{item.name}</span>{item.placeable!==false && <Grip size={15} aria-hidden="true"/>}</button>)}</div>)}</div>
        </aside>
        <div className="development-workspace">
          <div className="development-map-head"><div><h3>{template.placeable===false?"Plan a network repair":"Place on the planning terrain"}</h3><p>{placing?`Move over the terrain and click to place ${template.name.toLowerCase()}. Red means the spot is unavailable.`:template.placeable===false?"This project improves the municipality’s existing modeled pipeline network; it adds no new structure.":"Drag to rotate · Scroll to zoom · Select a placed model or current-plan item to edit it."}</p></div><span className="development-plan-count">{placedCount} placed · {developments.length-placedCount} network actions</span></div>
          <div className="development-scene"><CityMaquette municipality={municipality.name} drought={scenario.inputs[municipality.id].drought} nrw={scenario.inputs[municipality.id].nrw} sectors={sectorData} focusedSector={null} onSectorHover={()=>{}} onSelectSector={()=>{}} developments={developments} placingTemplateId={placing?templateId:null} onPlace={place} selectedDevelopmentId={selectedId} onSelectDevelopment={id=>{const item=developments.find(value=>value.id===id);if(item)chooseDevelopment(item);}}/>{placing && <div className="development-placement-note">Place {template.name} on the terrain <button type="button" onClick={()=>setPlacing(false)}>Cancel</button></div>}</div>
          <div className="development-placed-head"><h3>Current plan</h3><span>{format(addedDemand)} ML/day demand added</span></div>
          <div className="development-placed-list">{developments.length===0?<p className="development-empty">No assets placed yet. Add a development or infrastructure project to see its effect.</p>:developments.map(item=>{
            const asset=assetTemplateById[item.templateId];
            return <div key={item.id} className={`development-placed${selectedId===item.id?" selected":""}`}>
              <button type="button" className="development-placed-select" onClick={()=>chooseDevelopment(item)}><i className={`status-${item.status}`}/><span><strong>{asset.name}</strong><small>{statusLabels[item.status]} · {asset.sector===null?"Water infrastructure":sectorNames[asset.sector]}</small></span><b>{item.active?(asset.sector!==null?`${format(calculateDevelopmentDemand(item))} ML/day`:asset.addedSupplyMlDay?`+${format(calculateInfrastructureImpact(item,scenario.inputs[municipality.id].drought).addedSupplyMlDay,2)} ML/day supply`:`−${format(calculateInfrastructureImpact(item,scenario.inputs[municipality.id].drought).nrwReductionPoints,1)} NRW pts`):"Paused"}</b></button>
              <label className="development-active"><input type="checkbox" checked={item.active} onChange={event=>updateDevelopment(item.id,{active:event.target.checked})}/><span className="sr-only">Include {asset.name} in simulation</span></label>
            </div>;
          })}</div>
        </div>
        <aside className="development-inspector" aria-label="Development assumptions and impact">
          <section className="development-config"><div className="development-pane-head"><h3>{selected?(template.sector===null?"Edit asset":"Edit establishment"):"Configure asset"}</h3><span>{selected?statusLabels[selected.status]:"New"}</span></div><h4>{template.name}</h4><p>{template.description}</p>
            {selected && <label className="development-status-field">Planning status<select value={selected.status} onChange={event=>updateDevelopment(selected.id,{status:event.target.value as DevelopmentStatus})}><option value="proposed">Proposed</option><option value="approved">Approved</option><option value="existing">Existing</option></select></label>}
            <div className="development-fields">{template.fields.map(field=><label key={field.key}><span className="development-field-label"><span>{field.label}</span><small>{field.unit}</small></span><input type="number" min={field.min} max={field.max} step={field.step||1} value={inputs[field.key]??field.initial} onChange={event=>changeField(field.key,Number(event.target.value))}/></label>)}</div>
            <section className="development-finance" aria-label="Editable project cost assumptions"><div className="development-finance-head"><h5>Project cost assumptions</h5><span>Illustrative · editable</span></div><div className="development-fields">{developmentCostFields(template).map(field=><label key={field.key}><span className="development-field-label"><span>{field.label}</span><small>{field.unit}</small></span><input type="number" min={field.min} max={field.max} step={field.step||1} value={inputs[field.key]??field.initial} onChange={event=>changeField(field.key,Number(event.target.value))}/></label>)}</div></section>
            <div className="development-estimate"><span>{template.sector===null?"Illustrative infrastructure effect":"Estimated demand"}</span>{template.sector===null?<><strong>{selectedInfrastructureIsSupply?`+${format(selectedInfrastructureImpact.addedSupplyMlDay,2)}`:`−${format(selectedInfrastructureImpact.nrwReductionPoints,1)}`} <small>{selectedInfrastructureIsSupply?"ML/day supply":"NRW points"}</small></strong><p>{selectedInfrastructureIsSupply?"Added supply is reduced under the selected drought assumption.":"Lowers modeled NRW across existing municipal pipelines and pipeline supply in the plan; capped at current NRW."}</p></>:<><strong>{format(calculateDevelopmentDemand({templateId,inputs}),3)} <small>ML/day</small></strong><p>{`Added to ${sectorNames[template.sector]}. Illustrative factors, editable above.`}</p></>}{template.id==="factory" && <p>Industry is grouped with this channel in the current four-sector model.</p>}</div>
            <section className="development-asset-preview" aria-label="Selected asset impact preview">
              <div className="development-asset-preview-head"><h5>Asset impact preview</h5><span>One-day change vs. plan</span></div>
              <div className="development-asset-preview-grid">
                <div><span>Estimated demand</span><strong>{format(assetImpactPreview.withAsset.demand)} <small>ML/day</small></strong><em>{signedChange(assetImpactPreview.demandDelta)}</em></div>
                <div><span>Allocable water</span><strong>{format(assetImpactPreview.withAsset.allocable)} <small>ML/day</small></strong><em className={assetImpactPreview.allocableDelta>0.005?"positive":assetImpactPreview.allocableDelta<-.005?"negative":""}>{signedChange(assetImpactPreview.allocableDelta)}</em></div>
                <div><span>Unmet demand</span><strong>{format(assetImpactPreview.withAsset.shortage)} <small>ML/day</small></strong><em className={assetImpactPreview.shortageDelta<-.005?"positive":assetImpactPreview.shortageDelta>0.005?"negative":""}>{signedChange(assetImpactPreview.shortageDelta)}</em></div>
                <div><span>Closing storage</span><strong>{format(assetImpactPreview.withAsset.ending)} <small>ML</small></strong><em className={assetImpactPreview.endingDelta>0.005?"positive":assetImpactPreview.endingDelta<-.005?"negative":""}>{`${assetImpactPreview.endingDelta>0.005?"+":""}${format(assetImpactPreview.endingDelta)} ML`}</em></div>
              </div>
              <dl className="development-asset-financials">
                <div><dt>Asset CAPEX</dt><dd>₱{format(candidateFinancials.capexMillion,1)}M</dd></div>
                <div><dt>Annual OPEX</dt><dd>₱{format(candidateFinancials.annualOpexMillion,1)}M/year</dd></div>
                <div><dt>Simple lifecycle cost</dt><dd>₱{format(candidateValuation.simpleLifecycleCostPhp/1_000_000,1)}M · {candidateFinancials.usefulLifeYears} years</dd></div>
                {candidateValuation.capexPerHouseholdPhp!==null&&<div><dt>CAPEX per household benefited</dt><dd>₱{format(candidateValuation.capexPerHouseholdPhp,0)}</dd></div>}
                {template.sector===null&&<>
                  <div><dt>Lifecycle cost per m³</dt><dd>{candidateValuation.simpleLifecycleCostPerM3Php===null?"N/A":`₱${format(candidateValuation.simpleLifecycleCostPerM3Php,2)}`}</dd></div>
                  <div><dt>GIS benefit-per-peso score</dt><dd>{benefitPreview?`${format(benefitPreview.publicBenefitScore,1)}/100 · rank ${benefitPreview.rank}`:"N/A"}</dd></div>
                </>}
              </dl>
              <p>Uses GIS’s simple lifecycle formula (CAPEX + annual OPEX × useful life). Infrastructure scores use GIS’s default 30/25/20/15/10 weights and compare infrastructure in this municipality’s current plan. A score is a comparison aid, not a project appraisal.</p>
              <p>Shows the illustrative balance with this asset included, compared with {selected?"the plan without this asset":"the current plan"}. It does not include a forecast.</p>
            </section>
            {selected?<div className="development-config-actions"><button type="button" onClick={()=>chooseTemplate(selected.templateId)}><Plus size={15}/> Add another</button><button type="button" className="remove" onClick={()=>{onChange(developments.filter(item=>item.id!==selected.id));setSelectedId(null);}}><Trash2 size={15}/> Remove</button></div>:<button type="button" className={`development-place-button${placing?" active":""}`} onClick={()=>template.placeable===false?addConfiguredAsset():setPlacing(value=>!value)}>{placing?<><Check size={16}/> Ready to place</>:<><Plus size={16}/> {template.placeable===false?"Add to plan":`Place ${template.name}`}</>}</button>}
          </section>
          <section className="development-impact"><div className="development-pane-head"><h3>Live water impact</h3><Droplets size={16}/></div><dl><div><dt>Estimated baseline demand</dt><dd>{format(withoutDevelopments.demand)} ML/day</dd></div><div className="added"><dt>Development demand</dt><dd>+{format(addedDemand)} ML/day</dd></div><div className="total"><dt>New estimated demand</dt><dd>{format(result.demand)} ML/day</dd></div><div><dt>Allocable water</dt><dd>{format(result.allocable)} ML/day</dd></div>{infrastructureSupplyAdded>.005&&<div><dt>Added infrastructure supply</dt><dd>+{format(infrastructureSupplyAdded)} ML/day</dd></div>}{nrwRecoveredPoints>.05&&<div><dt>Distribution losses recovered</dt><dd>{format(nrwRecoveredPoints,1)} NRW points</dd></div>}<div><dt>Unmet estimated demand</dt><dd className={result.shortage>.05?"at-risk":""}>{format(result.shortage)} ML/day</dd></div><div><dt>Closing storage</dt><dd>{format(result.ending)} ML</dd></div>{result.households!==withoutDevelopments.households && <div><dt>Modeled households</dt><dd>{format(result.households,0)}</dd></div>}<div><dt>Households with unmet needs</dt><dd>{format(result.affected,0)}</dd></div><div className="total financial-metric"><dt>Current plan CAPEX</dt><dd>₱{format(totalCapexMillion,1)}M</dd></div><div className="financial-metric"><dt>Current plan annual OPEX</dt><dd>₱{format(annualOpexMillion,1)}M/year</dd></div></dl><p className={`development-impact-summary${result.shortage>.05?" at-risk":""}`}>{result.shortage>.05?`${format(result.shortage)} ML/day of estimated demand cannot be covered under this scenario.`:`Current supply and usable storage cover the estimated demand.`}</p></section>
          <div className="development-status-key"><span><i className="status-proposed"/>Proposed</span><span><i className="status-approved"/>Approved</span><span><i className="status-existing"/>Existing</span></div>

          <button type="button" className="development-return" onClick={onClose}>Return to simulation <ArrowRight size={16}/></button>
        </aside>
      </div>
    </section>
  </div>;
}
