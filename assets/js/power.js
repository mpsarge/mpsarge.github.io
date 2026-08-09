/**
 * Power & Thermal Budget calculator.
 * Ports the workbook's "Power & Thermal Budget (live calculation)" tab formulas:
 * electrical load subtotal, two-zone heat load / ECU sizing, full-site electrical
 * load, and backup-generator loading checks.
 */
import { POWER_LOAD_ITEMS, POWER_DEFAULTS } from './data.js';
import { numOr } from './format.js';

const BTU_PER_WATT = 3.412;
const BTU_PER_TON = 12000;

export function electricalLoad(qtyOverrides) {
  const rows = POWER_LOAD_ITEMS.map((row) => {
    const raw = qtyOverrides[row.id];
    const qty = row.qtyEditable ? Math.max(0, Math.floor(numOr(raw, row.qty))) : row.qty;
    const rawQty = row.qtyEditable ? (raw === undefined ? String(row.qty) : String(raw)) : String(row.qty);
    return {
      ...row,
      qty,
      rawQty,
      typicalSubtotal: row.typicalW * qty,
      maxSubtotal: row.maxW * qty,
    };
  });
  const typicalTotal = rows.reduce((s, r) => s + r.typicalSubtotal, 0);
  const maxTotal = rows.reduce((s, r) => s + r.maxSubtotal, 0);
  return { rows, typicalTotal, maxTotal };
}

function ecuStatus(runningBtu, heatLoad) {
  if (runningBtu < heatLoad) return { status: 'INSUFFICIENT', statusLabel: 'INSUFFICIENT vs. heat load', level: 'danger' };
  if (runningBtu < heatLoad * 1.15)
    return { status: 'TIGHT', statusLabel: 'OK BUT TIGHT MARGIN (<15%) - not recommended alone', level: 'warn' };
  return { status: 'OK', statusLabel: 'OK - comfortable margin', level: 'ok' };
}

export function thermalBudget(state) {
  const load = electricalLoad(state.loadQty || {});
  const findRow = (id) => load.rows.find((r) => r.id === id);

  const itLoad = findRow('it-load');
  const lighting = findRow('lighting-hotel');
  const backupComms = findRow('backup-comms');
  const sensor = findRow('sensor');

  const occupancy = Math.max(1, Math.floor(numOr(state.occupancy, POWER_DEFAULTS.maxSimultaneousOccupancy)));
  const zoneAEnvelope = Math.max(0, numOr(state.zoneAEnvelopeBtu, POWER_DEFAULTS.zoneAEnvelopeSolarGainBtu));
  const zoneBEnvelope = Math.max(0, numOr(state.zoneBEnvelopeBtu, POWER_DEFAULTS.zoneBEnvelopeSolarGainBtu));

  const zoneAElectricalHeatGain =
    (itLoad.typicalSubtotal + lighting.typicalSubtotal + backupComms.typicalSubtotal) * BTU_PER_WATT;
  const personnelHeatGain = POWER_DEFAULTS.personnelHeatGainBtuPerPerson * occupancy;
  const zoneATotal = zoneAElectricalHeatGain + personnelHeatGain + zoneAEnvelope;
  const zoneATons = zoneATotal / BTU_PER_TON;

  const zoneBElectricalHeatGain = sensor.maxSubtotal * BTU_PER_WATT;
  const zoneBTotal = zoneBElectricalHeatGain + zoneBEnvelope;
  const zoneBTons = zoneBTotal / BTU_PER_TON;

  const zoneACandidates = POWER_DEFAULTS.zoneACandidates.map((c) => ({ ...c, ...ecuStatus(c.runningBtu, zoneATotal) }));
  const zoneBCandidates = POWER_DEFAULTS.zoneBCandidates.map((c) => ({ ...c, ...ecuStatus(c.runningBtu, zoneBTotal) }));

  const zoneATonsActive = Math.max(0, numOr(state.zoneATonsActive, POWER_DEFAULTS.zoneATonsActiveDefault));
  const zoneBTonsActive = Math.max(0, numOr(state.zoneBTonsActive, POWER_DEFAULTS.zoneBTonsActiveDefault));
  const combinedEcuDrawKw = POWER_DEFAULTS.ecuElectricalDrawKwPerTon * (zoneATonsActive + zoneBTonsActive);
  const fullSiteMaxLoadKw = load.maxTotal / 1000 + combinedEcuDrawKw;

  const generators = POWER_DEFAULTS.generators.map((g) => {
    const loading = fullSiteMaxLoadKw / g.kw;
    let level, statusLabel;
    if (loading > 0.85) {
      level = 'danger';
      statusLabel = 'OVER 85% LOADING - not recommended for sustained run';
    } else if (loading > 0.6) {
      level = 'ok';
      statusLabel = 'OK - adequate margin';
    } else {
      level = 'ok';
      statusLabel = 'OK - generous margin';
    }
    return { ...g, loading, level, statusLabel };
  });

  return {
    load,
    zoneA: {
      electricalHeatGain: zoneAElectricalHeatGain,
      personnelHeatGain,
      envelopeGain: zoneAEnvelope,
      total: zoneATotal,
      tons: zoneATons,
      candidates: zoneACandidates,
      occupancy,
    },
    zoneB: {
      electricalHeatGain: zoneBElectricalHeatGain,
      envelopeGain: zoneBEnvelope,
      total: zoneBTotal,
      tons: zoneBTons,
      candidates: zoneBCandidates,
    },
    combinedEcuDrawKw,
    fullSiteMaxLoadKw,
    zoneATonsActive,
    zoneBTonsActive,
    generators,
  };
}

export function bestGenerator(generators) {
  // First generator (ascending kW, as declared) that lands at or under 85% loading.
  return generators.find((g) => g.loading <= 0.85) ?? generators[generators.length - 1];
}
