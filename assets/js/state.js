/**
 * Central app state: equipment quantities, power-budget inputs, wizard progress,
 * and checklist attestations. Persisted to localStorage so a planner's session
 * survives a reload; falls back to workbook defaults silently if storage is
 * unavailable (private browsing, etc).
 */
import { EQUIPMENT, CHECKLIST_ITEMS } from './data.js';
import { toInt } from './format.js';

const STORAGE_KEY = 'isr-site-in-a-box:v1';

function defaultState() {
  const qty = {};
  for (const item of EQUIPMENT) qty[item.id] = item.defaultQty;

  const attestations = {};
  for (const c of CHECKLIST_ITEMS) if (c.kind === 'attest') attestations[c.id] = false;

  return {
    qty,
    packingMode: 'suggested', // 'suggested' | 'optimized'
    power: {
      loadQty: {}, // overrides keyed by POWER_LOAD_ITEMS id
      occupancy: undefined,
      zoneAEnvelopeBtu: undefined,
      zoneBEnvelopeBtu: undefined,
      zoneATonsActive: undefined,
      zoneBTonsActive: undefined,
      zoneASelectedId: 'zoneA-single5',
      zoneBSelectedId: 'zoneB-dual72-n1',
      selectedGeneratorId: 'mep-806a',
    },
    wizard: {
      currentStep: 0,
      completedSteps: {},
    },
    attestations,
  };
}

class Store {
  constructor() {
    this.state = this._load();
    this.listeners = new Set();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      // Shallow-merge over defaults so new fields introduced later don't crash old saves.
      const base = defaultState();
      return {
        ...base,
        ...parsed,
        qty: { ...base.qty, ...(parsed.qty || {}) },
        power: { ...base.power, ...(parsed.power || {}), loadQty: { ...(parsed.power?.loadQty || {}) } },
        wizard: { ...base.wizard, ...(parsed.wizard || {}) },
        attestations: { ...base.attestations, ...(parsed.attestations || {}) },
      };
    } catch (e) {
      console.warn('Could not load saved state, using defaults.', e);
      return defaultState();
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('Could not persist state.', e);
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    this.save();
    for (const fn of this.listeners) fn(this.state);
  }

  // Stores the raw string as typed (so a field can be legitimately empty mid-edit
  // without snapping to "0" and corrupting further keystrokes on views that
  // re-render on every input event). Use qtyOf() to read the coerced number.
  setQty(itemId, qty) {
    this.state.qty[itemId] = qty;
    this.notify();
  }

  qtyOf(itemId) {
    return toInt(this.state.qty[itemId], 0);
  }

  /** Raw display value for a quantity input - preserves "" while a field is being edited. */
  rawQty(itemId) {
    const v = this.state.qty[itemId];
    return v === undefined || v === null ? '' : String(v);
  }

  setPackingMode(mode) {
    this.state.packingMode = mode;
    this.notify();
  }

  setPowerLoadQty(rowId, qty) {
    this.state.power.loadQty[rowId] = qty;
    this.notify();
  }

  setPowerField(field, value) {
    this.state.power[field] = value;
    this.notify();
  }

  setWizardStep(step) {
    this.state.wizard.currentStep = step;
    this.notify();
  }

  markStepComplete(stepId) {
    this.state.wizard.completedSteps[stepId] = true;
    this.notify();
  }

  setAttestation(id, value) {
    this.state.attestations[id] = value;
    this.notify();
  }

  resetAll() {
    this.state = defaultState();
    this.notify();
  }
}

export const store = new Store();
