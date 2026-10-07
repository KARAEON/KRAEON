import { validDevelopment } from './developments';
import { defaultPriorityOrder, isPriorityOrder, municipalities, simulateMunicipality, type Inputs, type Scenario } from './simulation';

export const scenarioStorageKey = 'water-economics-scenarios-v1';
export const scenarioBackupKey = 'water-economics-scenarios-v1-pre-daloy-4ef113b';
type ScenarioStorage = Pick<Storage, 'getItem' | 'setItem'>;
const pilots = municipalities.filter(m => m.activeInSimulation);
const numericArray = (value: unknown, length: number): value is number[] =>
  Array.isArray(value) && value.length === length && value.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0);

export function migrateScenario(value: unknown): Scenario | null {
  if (!value || typeof value !== 'object') return null;
  const saved = value as Scenario;
  if (typeof saved.id !== 'string' || typeof saved.name !== 'string' || !saved.inputs) return null;
  const developments = Array.isArray(saved.developments) ? saved.developments.filter(validDevelopment) : [];
  const priorityOrder = isPriorityOrder(saved.priorityOrder) ? [...saved.priorityOrder] as Scenario['priorityOrder'] : [...defaultPriorityOrder] as Scenario['priorityOrder'];
  const inputs: Record<string, Inputs> = {};
  for (const municipality of pilots) {
    const p = saved.inputs[municipality.id];
    if (!p || typeof p !== 'object' || !Object.values(p).every(v => typeof v === 'boolean' ||
      (typeof v === 'number' && Number.isFinite(v) && v >= 0) ||
      (Array.isArray(v) && v.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0))) ||
      !(p.income > 0) || p.drought > 100 ||
      (p.demand !== undefined && p.demand > 150) || (p.allocation !== undefined && p.allocation > 100) ||
      !numericArray(p.sourceOutputs, municipality.sources.length) || !numericArray(p.sectorDemand, 4) ||
      (p.allocationTargets !== undefined && !numericArray(p.allocationTargets, 4)) ||
      (p.allocationShares !== undefined && !numericArray(p.allocationShares, 4))) return null;
    const defaults = { supply: 100, drought: 0, nrw: 28, reserve: 22, supplementary: false, protect: false, price: 32, income: municipality.income, budget: 0 };
    const { demand, allocation, allocationShares: _shares, actualUse: _obsoleteActualUse, ...current } = p as Inputs & { actualUse?: number };
    const sectorDemand = p.sectorDemand.map(v => v * (demand ?? 100) / 100) as Inputs['sectorDemand'];
    const allocationTargets = (p.allocationTargets ? [...p.allocationTargets] : sectorDemand.map(v => v * (allocation ?? 100) / 100)) as Inputs['allocationTargets'];
    const migrated: Inputs = { ...defaults, ...current, sectorDemand, allocationTargets };
    const allocable = simulateMunicipality(municipality, migrated, developments, priorityOrder).allocable;
    migrated.allocationTargets = allocationTargets.map(v => Math.min(v, allocable)) as Inputs['allocationTargets'];
    inputs[municipality.id] = migrated;
  }
  return { id: saved.id, name: saved.name, inputs, priorityOrder, developments };
}

export function readSavedScenarios(storage: Pick<ScenarioStorage, 'getItem'>): Scenario[] {
  try {
    const raw: unknown = JSON.parse(storage.getItem(scenarioStorageKey) || '[]');
    return Array.isArray(raw) ? raw.map(migrateScenario).filter((value): value is Scenario => value !== null) : [];
  } catch {
    return [];
  }
}

export function persistSavedScenarios(scenarios: Scenario[], storage: ScenarioStorage): void {
  const original = storage.getItem(scenarioStorageKey);
  if (original !== null && storage.getItem(scenarioBackupKey) === null) {
    storage.setItem(scenarioBackupKey, original);
  }
  storage.setItem(scenarioStorageKey, JSON.stringify(scenarios.filter(s => !['baseline', 'drought'].includes(s.id))));
}
