import { thermalBudget } from '../power.js';
import { POWER_DEFAULTS } from '../data.js';
import { fmtNum, fmtW, fmtBtu, fmtKw, fmtPct, escapeHtml } from '../format.js';
import { captureFocus, restoreFocus } from '../focus-preserve.js';

function pillFor(level, label) {
  const cls = level === 'ok' ? 'pill-ok' : level === 'warn' ? 'pill-warn' : 'pill-danger';
  return `<span class="pill ${cls}">${escapeHtml(label)}</span>`;
}

function candidateCard(c, groupName, selectedId) {
  const selected = c.id === selectedId;
  return `
    <label class="option-card ${selected ? 'selected' : ''}" style="display:block; cursor:pointer;">
      <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
        <div>
          <input type="radio" name="${groupName}" value="${c.id}" ${selected ? 'checked' : ''} style="margin-right:8px;" />
          <strong style="color:var(--silver-100); font-size:13.5px;">${escapeHtml(c.label)}</strong>
          <div style="color:var(--silver-500); font-size:12px; margin-top:4px; margin-left:22px;">
            Installed ${fmtBtu(c.installedBtu)} &middot; Running (N) ${fmtBtu(c.runningBtu)}
          </div>
        </div>
        ${pillFor(c.level, c.statusLabel)}
      </div>
    </label>
  `;
}

export function render(container, { store }) {
  function draw() {
    // Preserve focus/cursor across the full innerHTML rebuild below, since typing
    // into any editable field triggers a store update -> re-render on every keystroke.
    const saved = captureFocus(container);

    const b = thermalBudget(store.state.power);

    container.innerHTML = `
      <div class="view-header">
        <h1>Power &amp; Thermal Budget</h1>
        <p>Live calculation ported from the workbook. Editable fields are highlighted; everything else recalculates automatically.</p>
      </div>

      <div class="card">
        <h2>1. Electrical Load Budget</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Load Item</th>
                <th class="num">Typical W (ea)</th>
                <th class="num">Max W (ea)</th>
                <th class="num">Qty</th>
                <th class="num">Typical Subtotal</th>
                <th class="num">Max Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${b.load.rows
                .map(
                  (r) => `
                <tr>
                  <td>${escapeHtml(r.label)}<div style="color:var(--silver-700); font-size:11.5px; margin-top:2px;">${escapeHtml(r.notes)}</div></td>
                  <td class="num">${fmtW(r.typicalW)}</td>
                  <td class="num">${fmtW(r.maxW)}</td>
                  <td class="num">
                    ${
                      r.qtyEditable
                        ? `<input class="qty-input input-editable" type="text" inputmode="numeric" pattern="[0-9]*" value="${r.rawQty}" data-load-qty="${r.id}" data-field="load-qty:${r.id}" />`
                        : `${r.qty}`
                    }
                  </td>
                  <td class="num">${fmtW(r.typicalSubtotal)}</td>
                  <td class="num">${fmtW(r.maxSubtotal)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
            <tfoot>
              <tr>
                <th colspan="4">Non-HVAC Electrical Subtotal (feeds generator sizing, Section 4)</th>
                <th class="num">${fmtW(b.load.typicalTotal)}</th>
                <th class="num">${fmtW(b.load.maxTotal)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div class="card">
        <h2>2. Heat Load &amp; HVAC (ECU) Sizing — Two Isolated Zones</h2>
        <p style="color:var(--silver-500); font-size:12.5px; margin-top:-6px;">
          Zone A (ops shelter + ECP) is sized to the sensor's <em>typical</em> load; Zone B (isolated sensor container) is sized to its <em>max</em> load —
          a sealed steel box has far less thermal buffering than the fabric shelter and can't ride through a peak the same way.
        </p>

        <div class="grid grid--2">
          <div>
            <h3>Zone A — Ops Shelter + ECP</h3>
            <dl class="fact-list">
              <dt>Electrical Heat Gain (IT + lighting + comms, typical)</dt><dd>${fmtBtu(b.zoneA.electricalHeatGain)}</dd>
              <dt>Personnel Heat Gain (${POWER_DEFAULTS.personnelHeatGainBtuPerPerson} BTU/hr &times;
                <input type="text" inputmode="numeric" pattern="[0-9]*" value="${store.state.power.occupancy ?? POWER_DEFAULTS.maxSimultaneousOccupancy}" data-occupancy data-field="occupancy" style="width:48px;" class="input-editable" /> occupants)</dt>
              <dd>${fmtBtu(b.zoneA.personnelHeatGain)}</dd>
              <dt>Envelope / Solar Gain (editable — climate dependent)</dt>
              <dd><input type="text" inputmode="numeric" pattern="[0-9]*" value="${store.state.power.zoneAEnvelopeBtu ?? POWER_DEFAULTS.zoneAEnvelopeSolarGainBtu}" data-zone-a-envelope data-field="zone-a-envelope" class="input-editable" style="width:100px;" /> BTU/hr</dd>
            </dl>
            <div class="zone-total"><span>Zone A Total Heat Load</span><span>${fmtBtu(b.zoneA.total)} (${fmtNum(b.zoneA.tons, 2)} tons)</span></div>
            <div style="margin-top:12px;">
              ${b.zoneA.candidates.map((c) => candidateCard(c, 'zoneA-candidate', store.state.power.zoneASelectedId)).join('')}
            </div>
          </div>

          <div>
            <h3>Zone B — Isolated Sensor Container</h3>
            <dl class="fact-list">
              <dt>Electrical Heat Gain (sensor MAX draw, not typical)</dt><dd>${fmtBtu(b.zoneB.electricalHeatGain)}</dd>
              <dt>Container Envelope / Solar Gain (editable — climate dependent)</dt>
              <dd><input type="text" inputmode="numeric" pattern="[0-9]*" value="${store.state.power.zoneBEnvelopeBtu ?? POWER_DEFAULTS.zoneBEnvelopeSolarGainBtu}" data-zone-b-envelope data-field="zone-b-envelope" class="input-editable" style="width:100px;" /> BTU/hr</dd>
            </dl>
            <div class="zone-total"><span>Zone B Total Heat Load</span><span>${fmtBtu(b.zoneB.total)} (${fmtNum(b.zoneB.tons, 2)} tons)</span></div>
            <div style="margin-top:12px;">
              ${b.zoneB.candidates.map((c) => candidateCard(c, 'zoneB-candidate', store.state.power.zoneBSelectedId)).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>3. Full-Site Electrical Load</h2>
        <div class="grid grid--2">
          <div>
            <dl class="fact-list">
              <dt>ECU Electrical Draw Rate</dt><dd>${POWER_DEFAULTS.ecuElectricalDrawKwPerTon} kW per ton</dd>
              <dt>Zone A Tons Active (running ECU)</dt>
              <dd><input type="text" inputmode="numeric" pattern="[0-9]*" value="${store.state.power.zoneATonsActive ?? POWER_DEFAULTS.zoneATonsActiveDefault}" data-zone-a-tons data-field="zone-a-tons" class="input-editable" style="width:64px;" /> tons</dd>
              <dt>Zone B Tons Active (running ECU)</dt>
              <dd><input type="text" inputmode="numeric" pattern="[0-9]*" value="${store.state.power.zoneBTonsActive ?? POWER_DEFAULTS.zoneBTonsActiveDefault}" data-zone-b-tons data-field="zone-b-tons" class="input-editable" style="width:64px;" /> tons</dd>
              <dt>Combined ECU Electrical Draw</dt><dd>${fmtKw(b.combinedEcuDrawKw)}</dd>
            </dl>
          </div>
          <div>
            <div class="zone-total"><span>Full-Site Max Electrical Load</span><span>${fmtKw(b.fullSiteMaxLoadKw)}</span></div>
            <p style="color:var(--silver-500); font-size:12.5px;">Max non-HVAC electrical (${fmtKw(b.load.maxTotal / 1000)}) + combined ECU draw. Drives generator sizing below.</p>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>4. Backup Generator Sizing Check</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th></th><th>Candidate Generator</th><th class="num">Rated Capacity</th><th class="num">Loading</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${b.generators
                .map(
                  (g) => `
                <tr>
                  <td><input type="radio" name="generator" value="${g.id}" ${g.id === store.state.power.selectedGeneratorId ? 'checked' : ''} data-generator /></td>
                  <td>${escapeHtml(g.label)}</td>
                  <td class="num">${fmtKw(g.kw, 0)}</td>
                  <td class="num">${fmtPct(g.loading)}</td>
                  <td>${pillFor(g.level, g.statusLabel)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    restoreFocus(container, saved);
  }

  draw();

  container.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('[data-load-qty]')) store.setPowerLoadQty(t.dataset.loadQty, t.value);
    else if (t.matches('[data-occupancy]')) store.setPowerField('occupancy', t.value);
    else if (t.matches('[data-zone-a-envelope]')) store.setPowerField('zoneAEnvelopeBtu', t.value);
    else if (t.matches('[data-zone-b-envelope]')) store.setPowerField('zoneBEnvelopeBtu', t.value);
    else if (t.matches('[data-zone-a-tons]')) store.setPowerField('zoneATonsActive', t.value);
    else if (t.matches('[data-zone-b-tons]')) store.setPowerField('zoneBTonsActive', t.value);
  });

  container.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-generator]')) store.setPowerField('selectedGeneratorId', t.value);
    else if (t.name === 'zoneA-candidate') store.setPowerField('zoneASelectedId', t.value);
    else if (t.name === 'zoneB-candidate') store.setPowerField('zoneBSelectedId', t.value);
  });

  const unsubscribe = store.subscribe(draw);
  return unsubscribe;
}
