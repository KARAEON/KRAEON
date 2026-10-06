export type DevelopmentStatus = "proposed" | "approved" | "existing";
export type Development = {
  id: string;
  municipalityId: string;
  templateId: string;
  position: [number, number];
  inputs: Record<string, number>;
  active: boolean;
  status: DevelopmentStatus;
};

export type AssetField = {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step?: number;
  initial: number;
};
export type AssetTemplate = {
  id: string;
  name: string;
  category: string;
  sector: 0 | 1 | 2 | 3;
  description: string;
  fields: AssetField[];
  litersPerDay: (v: Record<string, number>) => number;
};

// Illustrative planning factors in liters/day. These are editable scenario
// assumptions, not official consumption standards or a demand forecast.
export const assetTemplates: AssetTemplate[] = [
  {
    id: "mall", name: "Shopping mall", category: "Commercial", sector: 2,
    description: "Retail floor space, visitors, staff, and food service.",
    fields: [
      {key:"floorArea",label:"Floor area",unit:"m²",min:100,max:100000,step:100,initial:18000},
      {key:"employees",label:"Employees",unit:"people",min:0,max:10000,initial:350},
      {key:"visitors",label:"Visitors per day",unit:"people",min:0,max:100000,initial:4000},
      {key:"restaurants",label:"Food outlets",unit:"outlets",min:0,max:200,initial:12},
      {key:"efficiency",label:"Fixture savings",unit:"%",min:0,max:60,initial:10},
      {key:"rainwater",label:"Rainwater offset",unit:"m³/day",min:0,max:5000,initial:0},
    ],
    litersPerDay:v=>(v.floorArea*18+v.employees*85+v.visitors*24+v.restaurants*25000)*(1-v.efficiency/100)-v.rainwater*1000,
  },
  {
    id:"subdivision",name:"Subdivision",category:"Residential",sector:0,
    description:"Occupied homes and shared landscaping.",
    fields:[
      {key:"units",label:"Housing units",unit:"homes",min:1,max:30000,initial:1200},
      {key:"householdSize",label:"People per home",unit:"people",min:1,max:12,step:.1,initial:4},
      {key:"occupancy",label:"Occupancy",unit:"%",min:0,max:100,initial:85},
      {key:"landscaping",label:"Shared landscaping",unit:"m³/day",min:0,max:1000,initial:15},
    ],
    litersPerDay:v=>v.units*v.householdSize*v.occupancy/100*140+v.landscaping*1000,
  },
  {
    id:"hospital",name:"Hospital",category:"Public services",sector:3,
    description:"Beds, staff, daily patients, and laundry.",
    fields:[
      {key:"beds",label:"Beds",unit:"beds",min:1,max:5000,initial:250},
      {key:"staff",label:"Staff",unit:"people",min:0,max:10000,initial:700},
      {key:"patients",label:"Outpatients per day",unit:"people",min:0,max:20000,initial:900},
      {key:"laundry",label:"Laundry",unit:"m³/day",min:0,max:1000,initial:45},
    ],
    litersPerDay:v=>v.beds*850+v.staff*90+v.patients*45+v.laundry*1000,
  },
  {
    id:"school",name:"School",category:"Public services",sector:3,
    description:"Students, staff, operating days, and canteen use.",
    fields:[
      {key:"students",label:"Students",unit:"people",min:1,max:50000,initial:1600},
      {key:"staff",label:"Staff",unit:"people",min:0,max:5000,initial:110},
      {key:"days",label:"Operating days",unit:"days/week",min:1,max:7,initial:5},
      {key:"canteen",label:"Canteen use",unit:"m³/operating day",min:0,max:500,initial:9},
    ],
    litersPerDay:v=>(v.students*25+v.staff*70+v.canteen*1000)*v.days/7,
  },
  {
    id:"hotel",name:"Hotel",category:"Tourism",sector:2,
    description:"Occupied rooms, staff, dining, and pool use.",
    fields:[
      {key:"rooms",label:"Rooms",unit:"rooms",min:1,max:5000,initial:220},
      {key:"occupancy",label:"Room occupancy",unit:"%",min:0,max:100,initial:70},
      {key:"staff",label:"Staff",unit:"people",min:0,max:5000,initial:160},
      {key:"dining",label:"Dining",unit:"m³/day",min:0,max:500,initial:16},
      {key:"pool",label:"Pool and spa",unit:"m³/day",min:0,max:500,initial:7},
    ],
    litersPerDay:v=>v.rooms*v.occupancy/100*420+v.staff*85+(v.dining+v.pool)*1000,
  },
  {
    id:"market",name:"Public market",category:"Commercial",sector:2,
    description:"Stalls, visitors, and daily washdown.",
    fields:[
      {key:"stalls",label:"Stalls",unit:"stalls",min:1,max:10000,initial:260},
      {key:"visitors",label:"Visitors per day",unit:"people",min:0,max:100000,initial:4000},
      {key:"washdown",label:"Washdown",unit:"m³/day",min:0,max:1000,initial:20},
    ],
    litersPerDay:v=>v.stalls*280+v.visitors*5+v.washdown*1000,
  },
  {
    id:"factory",name:"Factory",category:"Industry",sector:2,
    description:"Workers, process water, and cooling.",
    fields:[
      {key:"workers",label:"Workers",unit:"people",min:0,max:30000,initial:500},
      {key:"process",label:"Process water",unit:"m³/day",min:0,max:10000,initial:280},
      {key:"cooling",label:"Cooling",unit:"m³/day",min:0,max:10000,initial:80},
      {key:"reuse",label:"Reuse savings",unit:"%",min:0,max:90,initial:15},
    ],
    litersPerDay:v=>(v.workers*120+(v.process+v.cooling)*1000)*(1-v.reuse/100),
  },
  {
    id:"poultry",name:"Poultry farm",category:"Agriculture",sector:1,
    description:"Bird water, cleaning, and workers.",
    fields:[
      {key:"birds",label:"Birds",unit:"birds",min:1,max:2000000,initial:60000},
      {key:"cleaning",label:"Cleaning",unit:"m³/day",min:0,max:3000,initial:18},
      {key:"workers",label:"Workers",unit:"people",min:0,max:10000,initial:45},
    ],
    litersPerDay:v=>v.birds*.5+v.cleaning*1000+v.workers*80,
  },
  {
    id:"government",name:"Government facility",category:"Public services",sector:3,
    description:"Staff, public visits, and building services.",
    fields:[
      {key:"staff",label:"Staff",unit:"people",min:1,max:20000,initial:500},
      {key:"visitors",label:"Visitors per day",unit:"people",min:0,max:50000,initial:1300},
      {key:"services",label:"Building services",unit:"m³/day",min:0,max:1000,initial:14},
    ],
    litersPerDay:v=>v.staff*85+v.visitors*18+v.services*1000,
  },
  {
    id:"evacuation",name:"Evacuation center",category:"Public services",sector:3,
    description:"Daily occupants, staff, and sanitation.",
    fields:[
      {key:"occupants",label:"Occupants",unit:"people",min:0,max:100000,initial:850},
      {key:"staff",label:"Staff",unit:"people",min:0,max:10000,initial:50},
      {key:"sanitation",label:"Sanitation",unit:"m³/day",min:0,max:3000,initial:25},
    ],
    litersPerDay:v=>v.occupants*110+v.staff*80+v.sanitation*1000,
  },
];

export const assetTemplateById = Object.fromEntries(assetTemplates.map(template => [template.id,template])) as Record<string,AssetTemplate>;
export function defaultDevelopmentInputs(template: AssetTemplate): Record<string,number> {
  return Object.fromEntries(template.fields.map(field => [field.key,field.initial]));
}
export function calculateDevelopmentDemand(development: Pick<Development,"templateId" | "inputs">): number {
  const template=assetTemplateById[development.templateId];
  if(!template) return 0;
  const values=Object.fromEntries(template.fields.map(field => {
    const raw=development.inputs[field.key];
    return [field.key,Number.isFinite(raw)?Math.max(field.min,Math.min(field.max,raw)):field.initial];
  }));
  return Math.max(0,template.litersPerDay(values))/1_000_000;
}
export function validDevelopment(value: unknown): value is Development {
  if(!value || typeof value!=="object") return false;
  const item=value as Partial<Development>;
  return typeof item.id==="string" && typeof item.municipalityId==="string" && typeof item.templateId==="string"
    && !!assetTemplateById[item.templateId] && Array.isArray(item.position) && item.position.length===2
    && item.position.every(coordinate=>typeof coordinate==="number" && Number.isFinite(coordinate))
    && !!item.inputs && typeof item.inputs==="object" && typeof item.active==="boolean"
    && ["proposed","approved","existing"].includes(item.status || "");
}
