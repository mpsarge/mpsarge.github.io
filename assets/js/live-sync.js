/**
 * On startup, replace the bundled static content of EQUIPMENT / POWER_LOAD_ITEMS /
 * ANTENNA_COMPARISON / RADOME_COMPARISON (in assets/js/data.js) with live rows
 * from the backend, if one is configured and reachable. Every other module
 * imports those same array bindings, so mutating them in place (splice, not
 * reassignment) is enough to make the change visible everywhere without
 * threading a "data source" through the whole app.
 *
 * This runs — and is awaited — before any view module is imported (see
 * main.js), specifically so that modules which compute lookups from EQUIPMENT
 * once at import time (equipment-helpers.js, checklist.js) never see stale
 * bundled data race against a live sync that finishes later.
 *
 * Failure is always silent from the user's point of view: no backend
 * configured, offline, misconfigured table, whatever — the bundled data.js
 * content just stays as-is and the site works exactly as it does today.
 */
import { isConfigured, fetchTable } from './backend.js';
import { EQUIPMENT, POWER_LOAD_ITEMS, ANTENNA_COMPARISON, RADOME_COMPARISON } from './data.js';

let liveDataActive = false;
let lastSyncedAt = null;
let lastSyncError = null;

export function getLiveDataStatus() {
  return { active: liveDataActive, lastSyncedAt, error: lastSyncError };
}

function withTimeout(promise, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return promise(controller.signal).finally(() => clearTimeout(timer));
}

function toEquipment(row) {
  return {
    id: row.id,
    category: row.category,
    item: row.item,
    vendor: row.vendor,
    defaultQty: row.default_qty,
    unitWeight: Number(row.unit_weight),
    unitVolume: Number(row.unit_volume),
    transport: row.transport,
    container: row.container,
    pros: row.pros,
    cons: row.cons,
    notes: row.notes,
    source: row.source,
  };
}

function toPowerLoadItem(row) {
  return {
    id: row.id,
    label: row.label,
    typicalW: Number(row.typical_w),
    maxW: Number(row.max_w),
    qty: Number(row.qty),
    qtyEditable: Boolean(row.qty_editable),
    notes: row.notes,
  };
}

function toAntennaComparison(row) {
  return {
    id: row.id,
    system: row.system,
    architecture: row.architecture,
    bandCoverage: row.band_coverage,
    orbitalRegimes: row.orbital_regimes,
    packForm: row.pack_form,
    acquisition: row.acquisition,
    pros: row.pros,
    cons: row.cons,
    source: row.source,
  };
}

function toRadomeComparison(row) {
  return {
    id: row.id,
    system: row.system,
    structureType: row.structure_type,
    continuousPower: row.continuous_power,
    setupTime: row.setup_time,
    pros: row.pros,
    cons: row.cons,
    source: row.source,
  };
}

function replaceContents(arr, next) {
  arr.splice(0, arr.length, ...next);
}

export async function syncLiveData({ timeoutMs = 2500 } = {}) {
  if (!isConfigured()) return;

  try {
    const [equipment, powerLoadItems, antennaComparison, radomeComparison] = await withTimeout(
      (signal) =>
        Promise.all([
          fetchTable('equipment', { signal }),
          fetchTable('power_load_items', { signal }),
          fetchTable('antenna_comparison', { signal }),
          fetchTable('radome_comparison', { signal }),
        ]),
      timeoutMs
    );

    if (!equipment?.length || !powerLoadItems?.length) {
      throw new Error('Backend returned no rows - keeping bundled data.');
    }

    replaceContents(EQUIPMENT, equipment.map(toEquipment));
    replaceContents(POWER_LOAD_ITEMS, powerLoadItems.map(toPowerLoadItem));
    replaceContents(ANTENNA_COMPARISON, antennaComparison.map(toAntennaComparison));
    replaceContents(RADOME_COMPARISON, radomeComparison.map(toRadomeComparison));

    liveDataActive = true;
    lastSyncedAt = new Date();
    lastSyncError = null;
  } catch (err) {
    liveDataActive = false;
    lastSyncError = err?.message ?? String(err);
    console.warn('[live-sync] Falling back to bundled static data:', lastSyncError);
  }
}
