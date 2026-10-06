import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Droplets, Grip, Plus, Save, Search, Trash2, X } from "lucide-react";
import CityMaquette from "./CityMaquette";
import { assetTemplateById, assetTemplates, calculateDevelopmentDemand, defaultDevelopmentInputs, type Development, type DevelopmentStatus } from "./engine/developments";
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
  const addedDemand=developments.filter(item=>item.active).reduce((total,item)=>total+calculateDevelopmentDemand(item),0);
  const addedAllocated=Math.max(0,result.allocation-withoutDevelopments.allocation);
  const billedVolumeValue=addedAllocated*1000*scenario.inputs[municipality.id].price;
  const sectorData=sectorNames.map((name,index)=>({name,value:result.demands[index],allocation:result.allocations[index],coverage:result.coverage[index],color:["#249f9a","#5e9a55","#df9a35","#6673d3"][index]}));

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
    setPlacing(arm);
  };
  const chooseDevelopment=(item:Development)=>{
    setTemplateId(item.templateId);
    setSelectedId(item.id);
    setPlacing(false);
  };
  const updateDevelopment=(id:string,patch:Partial<Development>)=>onChange(developments.map(item=>item.id===id?{...item,...patch}:item));
  const changeField=(key:string,value:number)=>{
    const field=template.fields.find(item=>item.key===key);
    if(!field) return;
    const next={...inputs,[key]:Math.max(field.min,Math.min(field.max,Number.isFinite(value)?value:field.min))};
    if(selected)updateDevelopment(selected.id,{inputs:next});else setDraftInputs(next);
  };
  const place=(position:[number,number])=>{
    if(!placing)return;
    const item:Development={id:crypto.randomUUID(),municipalityId:municipality.id,templateId,position,inputs:{...draftInputs},status:"proposed",active:true};
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
        <div><h2 id="development-title">Development planner</h2><p>{municipality.name} · Add establishments and see the water balance change.</p></div>
        <div className="development-head-actions"><button type="button" className="development-save" onClick={onSaveScenario}><Save size={16}/> Save as scenario</button><button ref={closeRef} type="button" className="development-close" aria-label="Close development planner" onClick={onClose}><X size={19}/></button></div>
      </header>
      <div className="development-planner-body">
        <aside className="development-library" aria-label="Development asset library">
          <div className="development-pane-head"><h3>Asset library</h3><span>{assetTemplates.length} types</span></div>
          <label className="development-search"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find an establishment" aria-label="Find an establishment"/></label>
          <p className="development-library-hint">Choose an asset, set its assumptions, then click or drag it onto the terrain.</p>
          <div className="development-library-list">{filtered.length===0?<p className="development-empty">No assets match that search.</p>:Object.entries(byCategory).map(([category,items])=><div key={category}><h4>{category}</h4>{items?.map(item=><button key={item.id} type="button" draggable className={`development-asset${templateId===item.id && !selected?" selected":""}`} onClick={()=>chooseTemplate(item.id)} onDragStart={event=>{event.dataTransfer.setData("text/plain",item.id);event.dataTransfer.effectAllowed="copy";chooseTemplate(item.id,true);}}><span>{item.name}</span><Grip size={15} aria-hidden="true"/></button>)}</div>)}</div>
        </aside>
        <div className="development-workspace">
          <div className="development-map-head"><div><h3>Place on the planning terrain</h3><p>{placing?`Move over the terrain and click to place ${template.name.toLowerCase()}. Red means the spot is unavailable.`:"Drag to rotate · Scroll to zoom · Select a placed model to edit it."}</p></div><span className="development-plan-count">{developments.length} placed</span></div>
          <div className="development-scene"><CityMaquette municipality={municipality.name} drought={scenario.inputs[municipality.id].drought} nrw={scenario.inputs[municipality.id].nrw} sectors={sectorData} focusedSector={null} onSectorHover={()=>{}} onSelectSector={()=>{}} developments={developments} placingTemplateId={placing?templateId:null} onPlace={place} selectedDevelopmentId={selectedId} onSelectDevelopment={id=>{const item=developments.find(value=>value.id===id);if(item)chooseDevelopment(item);}}/>{placing && <div className="development-placement-note">Place {template.name} on the terrain <button type="button" onClick={()=>setPlacing(false)}>Cancel</button></div>}</div>
          <div className="development-placed-head"><h3>Current plan</h3><span>{format(addedDemand)} ML/day added</span></div>
          <div className="development-placed-list">{developments.length===0?<p className="development-empty">No establishments placed yet. Start with a mall, hospital, or subdivision to see the tradeoff.</p>:developments.map(item=>{
            const asset=assetTemplateById[item.templateId];
            return <div key={item.id} className={`development-placed${selectedId===item.id?" selected":""}`}>
              <button type="button" className="development-placed-select" onClick={()=>chooseDevelopment(item)}><i className={`status-${item.status}`}/><span><strong>{asset.name}</strong><small>{statusLabels[item.status]} · {sectorNames[asset.sector]}</small></span><b>{item.active?`${format(calculateDevelopmentDemand(item))} ML/day`:"Paused"}</b></button>
              <label className="development-active"><input type="checkbox" checked={item.active} onChange={event=>updateDevelopment(item.id,{active:event.target.checked})}/><span className="sr-only">Include {asset.name} in simulation</span></label>
            </div>;
          })}</div>
        </div>
        <aside className="development-inspector" aria-label="Development assumptions and impact">
          <section className="development-config"><div className="development-pane-head"><h3>{selected?"Edit establishment":"Configure asset"}</h3><span>{selected?statusLabels[selected.status]:"New"}</span></div><h4>{template.name}</h4><p>{template.description}</p>
            {selected && <label className="development-status-field">Planning status<select value={selected.status} onChange={event=>updateDevelopment(selected.id,{status:event.target.value as DevelopmentStatus})}><option value="proposed">Proposed</option><option value="approved">Approved</option><option value="existing">Existing</option></select></label>}
            <div className="development-fields">{template.fields.map(field=><label key={field.key}><span>{field.label}<small>{field.unit}</small></span><input type="number" min={field.min} max={field.max} step={field.step||1} value={inputs[field.key]??field.initial} onChange={event=>changeField(field.key,Number(event.target.value))}/></label>)}</div>
            <div className="development-estimate"><span>Estimated demand</span><strong>{format(calculateDevelopmentDemand({templateId,inputs}),3)} <small>ML/day</small></strong><p>Added to {sectorNames[template.sector]}. Illustrative factors, editable above.</p>{template.id==="factory" && <p>Industry is grouped with this channel in the current four-sector model.</p>}</div>
            {selected?<div className="development-config-actions"><button type="button" onClick={()=>chooseTemplate(selected.templateId)}><Plus size={15}/> Place another</button><button type="button" className="remove" onClick={()=>{onChange(developments.filter(item=>item.id!==selected.id));setSelectedId(null);}}><Trash2 size={15}/> Remove</button></div>:<button type="button" className={`development-place-button${placing?" active":""}`} onClick={()=>setPlacing(value=>!value)}>{placing?<><Check size={16}/> Ready to place</>:<><Plus size={16}/> Place {template.name}</>}</button>}
          </section>
          <section className="development-impact"><div className="development-pane-head"><h3>Live water impact</h3><Droplets size={16}/></div><dl><div><dt>Existing demand</dt><dd>{format(withoutDevelopments.demand)} ML/day</dd></div><div className="added"><dt>Active developments</dt><dd>+{format(addedDemand)} ML/day</dd></div><div className="total"><dt>New total demand</dt><dd>{format(result.demand)} ML/day</dd></div><div><dt>Allocable water</dt><dd>{format(result.allocable)} ML/day</dd></div><div><dt>Unmet demand</dt><dd className={result.shortage>.05?"at-risk":""}>{format(result.shortage)} ML/day</dd></div><div><dt>Closing storage</dt><dd>{format(result.ending)} ML</dd></div>{result.households!==withoutDevelopments.households && <div><dt>Modeled households</dt><dd>{format(result.households,0)}</dd></div>}<div><dt>Households with unmet needs</dt><dd>{format(result.affected,0)}</dd></div></dl><p className={`development-impact-summary${result.shortage>.05?" at-risk":""}`}>{result.shortage>.05?`${format(result.shortage)} ML/day of demand cannot be met under this scenario.`:`Current supply and usable storage cover modeled demand.`}</p><p className="development-economics">Additional delivered water: {format(addedAllocated)} ML/day · Illustrative billed volume value: ₱{format(billedVolumeValue,0)}/day at the current tariff. This is not a revenue forecast.</p></section>
          <div className="development-status-key"><span><i className="status-proposed"/>Proposed</span><span><i className="status-approved"/>Approved</span><span><i className="status-existing"/>Existing</span></div>
          <p className="development-caveat">Placed assets add incremental demand to the municipality’s illustrative baseline, including assets marked “Existing.” Pause an asset to exclude it from calculations.</p>
          <button type="button" className="development-return" onClick={onClose}>Return to simulation <ArrowRight size={16}/></button>
        </aside>
      </div>
    </section>
  </div>;
}
