import { OVERVIEW, EQUIPMENT, POWER_DEFAULTS } from '../data.js';
import { KEY_ITEMS, antennaApertureCount, chooseExclusive } from '../equipment-helpers.js';
import { thermalBudget } from '../power.js';
import { suggestedLoadPlan } from '../packing.js';
import { checklistProgress } from '../checklist.js';
import { fmtBtu, fmtKw, fmtPct, escapeHtml } from '../format.js';
import { captureFocus, restoreFocus } from '../focus-preserve.js';

function attestRow(store, id, title, why) {
  const checked = !!store.state.attestations[id];
  return `
    <div class="attest-row">
      <input type="checkbox" id="attest-${id}" data-attest="${id}" ${checked ? 'checked' : ''} />
      <div>
        <label for="attest-${id}" class="attest-row__title">${escapeHtml(title)}</label>
        <div class="attest-row__why">${escapeHtml(why)}</div>
      </div>
    </div>
  `;
}

function optionCard({ groupName, id, title, body, selected }) {
  return `
    <label class="option-card ${selected ? 'selected' : ''}">
      <input type="radio" name="${groupName}" value="${id}" ${selected ? 'checked' : ''} style="margin-right:8px;" />
      <h4 style="display:inline;">${escapeHtml(title)}</h4>
      <p style="margin-top:6px;">${body}</p>
    </label>
  `;
}

const STEPS = [
  {
    id: 'mission',
    title: 'Mission & Echelon',
    body: () => `
      <div class="card">
        <h2>Confirm the baseline this design assumes</h2>
        <dl class="fact-list">
          ${OVERVIEW.facts
            .slice(0, 3)
            .map((f) => `<dt>${escapeHtml(f.label)}</dt><dd>${escapeHtml(f.value)}</dd>`)
            .join('')}
        </dl>
      </div>
    `,
  },
  {
    id: 'antenna',
    title: 'Antenna Architecture',
    body: (state, store) => {
      const qtyOf = (id) => store.qtyOf(id);
      const dish = KEY_ITEMS.avlDish;
      const sBand = KEY_ITEMS.sBand;
      const pallets = KEY_ITEMS.feedPallets;
      const count = antennaApertureCount(qtyOf);
      const sBandOn = sBand ? qtyOf(sBand.id) > 0 : false;
      return `
        <div class="card">
          <h2>Antenna requirement</h2>
          <p style="color:var(--silver-500); font-size:13px; margin-top:-6px;">${escapeHtml(OVERVIEW.facts[4].value)}</p>

          <div class="grid grid--2" style="margin-top:14px;">
            <div>
              <h3>Feed-swap dishes (AvL-style, threshold 2 / objective 3)</h3>
              <label>Number of dishes:
                <input type="text" inputmode="numeric" pattern="[0-9]*" data-field="antenna-dish-qty" data-antenna-dish
                  value="${store.rawQty(dish.id)}" class="qty-input input-editable" />
              </label>
              <p style="color:var(--silver-500); font-size:12.5px; margin-top:8px;">
                Each dish covers one band at a time via quick-change feed pallets (C/X/Ku/Ka). Feed pallet
                sets scale automatically (4 pallets per dish).
              </p>
            </div>
            <div>
              <h3>S-band gap coverage</h3>
              <label style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" data-sband-toggle ${sBandOn ? 'checked' : ''} />
                Include dedicated S-band module (${escapeHtml(sBand.vendor)})
              </label>
              <p style="color:var(--silver-500); font-size:12.5px; margin-top:8px;">
                The feed-swap dish family does not publish a native S-band pallet — the S/C/X/Ku/Ka
                requirement needs this module (or a confirmed vendor alternative) to close the gap.
              </p>
            </div>
          </div>

          <div style="margin-top:14px;">
            <span class="pill ${count >= 2 ? 'pill-ok' : 'pill-danger'}">${count} antenna aperture(s) selected — threshold 2 / objective 3</span>
          </div>
        </div>

        <div class="card">
          <h2>Link budget attestation</h2>
          ${attestRow(
            store,
            'link-budget',
            'G/T sized via a formal link budget with the sensor receiver team (9-12 dB SNR requirement)',
            'Meeting the SNR requirement is a gain-to-noise-temperature problem, not just a frequency-coverage checkbox.'
          )}
        </div>
      `;
    },
  },
  {
    id: 'radome',
    title: 'Radome Selection',
    body: (state, store) => {
      const qtyOf = (id) => store.qtyOf(id);
      const rigid = KEY_ITEMS.radomeRigid;
      const air = KEY_ITEMS.radomeAir;
      const space = KEY_ITEMS.radomeSpaceFrame;
      const chosen = qtyOf(air.id) > 0 ? air.id : qtyOf(space.id) > 0 ? space.id : rigid.id;
      return `
        <div class="card">
          <h2>Radome type</h2>
          <p style="color:var(--silver-500); font-size:13px; margin-top:-6px;">
            A rigid, self-supporting radome is recommended: no continuous blower/power draw, and no single
            point of failure from a lost inflation blower.
          </p>
          ${optionCard({
            groupName: 'radome',
            id: rigid.id,
            title: 'Rigid Self-Supporting (recommended)',
            body: 'No continuous power draw. Assembles tool-free in under an hour. Stays off the power budget entirely.',
            selected: chosen === rigid.id,
          })}
          ${optionCard({
            groupName: 'radome',
            id: air.id,
            title: 'Air-Supported / Inflatable (alternate)',
            body: 'Lowest pack weight/volume. Sealed after inflation — no standing blower load — but needs an intermittent high-CFM compressor to inflate and top off.',
            selected: chosen === air.id,
          })}
          ${optionCard({
            groupName: 'radome',
            id: space.id,
            title: 'Rigid Space-Frame (extended-deployment alternate)',
            body: 'Most robust weather protection, but the longest and most complex assembly — least suited to a rapidly-deployable requirement.',
            selected: chosen === space.id,
          })}
        </div>
      `;
    },
  },
  {
    id: 'shelter-ecp',
    title: 'Shelter & ECP',
    body: (state, store) => {
      const qtyOf = (id) => store.qtyOf(id);
      const ecpTent = KEY_ITEMS.ecpTent;
      const ecpIsu = KEY_ITEMS.ecpIsu;
      const ecpChosen = qtyOf(ecpIsu.id) > 0 ? ecpIsu.id : ecpTent.id;
      return `
        <div class="card">
          <h2>Entry Control Point (ECP) module</h2>
          ${optionCard({
            groupName: 'ecp',
            id: ecpTent.id,
            title: 'Tent-integrated (HDT DRASH SEAL + Hard Door) — recommended',
            body: 'Shares the ops shelter’s conditioned air with no separate HVAC zone required — just a duct/plenum tie-in.',
            selected: ecpChosen === ecpTent.id,
          })}
          ${optionCard({
            groupName: 'ecp',
            id: ecpIsu.id,
            title: 'ISU-90 vestibule (more hardened alternate)',
            body: 'Real forced-entry resistance a fabric SEAL can’t match — but no off-the-shelf connector adapter is confirmed yet. Treat as a vendor RFI before it’s a real line item.',
            selected: ecpChosen === ecpIsu.id,
          })}
          <div style="margin-top:14px;">
            ${attestRow(
              store,
              'ecp-module',
              'ECP approach selected, and — if the ISU-90 vestibule is chosen — flagged as a vendor RFI for the connector adapter',
              'No off-the-shelf adapter is confirmed for bridging an ISU-90 door directly to a DRASH-type tent door.'
            )}
          </div>
        </div>
      `;
    },
  },
  {
    id: 'hvac-zoning',
    title: 'Shelter & HVAC Zoning',
    body: (state, store) => {
      const b = thermalBudget(store.state.power);
      return `
        <div class="card">
          <h2>Two-zone HVAC isolation</h2>
          <p style="color:var(--silver-500); font-size:13px; margin-top:-6px;">
            The sensor lives in its own isolated ISU-90 (Zone B) with dedicated HVAC, separate from the ops
            shelter + ECP (Zone A). This keeps server/fan noise off the manned work floor and lets each
            zone be sized to what's actually inside it.
          </p>
          <div class="grid grid--2" style="margin-top:10px;">
            <div class="zone-total"><span>Zone A (typical load)</span><span>${fmtBtu(b.zoneA.total)}</span></div>
            <div class="zone-total"><span>Zone B (max load)</span><span>${fmtBtu(b.zoneB.total)}</span></div>
          </div>
          <p style="color:var(--silver-500); font-size:12.5px; margin-top:10px;">
            Full sizing and ECU candidates live on the Power &amp; Thermal Budget page.
            <a href="#/power">Open calculator →</a>
          </p>
        </div>
        <div class="card">
          ${attestRow(
            store,
            'sensor-isolation',
            'Sensor housed in isolated ISU-90 (Zone B) with dedicated HVAC',
            'Keeps server/fan noise and heat off the manned ops floor; lets each zone be sized to what is actually inside it.'
          )}
          ${attestRow(
            store,
            'reach-back-link',
            'Sensor container connected to the ops shelter via fiber/network reach-back, not RF',
            'Frees the ops shelter location to be chosen for security/personnel reasons instead of RF proximity.'
          )}
        </div>
      `;
    },
  },
  {
    id: 'power',
    title: 'Power Posture',
    body: (state, store) => {
      const b = thermalBudget(store.state.power);
      const ats = KEY_ITEMS.ats;
      const atsOn = ats ? store.qtyOf(ats.id) > 0 : false;
      return `
        <div class="card">
          <h2>Backup generator</h2>
          <p style="color:var(--silver-500); font-size:13px; margin-top:-6px;">
            Tied to FOB power grid (primary), with a tactical generator as automatic-transfer backup.
            Full-site max electrical load: <strong style="color:var(--silver-100);">${fmtKw(b.fullSiteMaxLoadKw)}</strong>.
          </p>
          <div class="table-wrap">
            <table>
              <thead><tr><th></th><th>Generator</th><th class="num">Loading</th><th>Status</th></tr></thead>
              <tbody>
                ${b.generators
                  .map(
                    (g) => `
                  <tr>
                    <td><input type="radio" name="wizard-generator" value="${g.id}" ${g.id === store.state.power.selectedGeneratorId ? 'checked' : ''} data-wizard-generator /></td>
                    <td>${escapeHtml(g.label)}</td>
                    <td class="num">${fmtPct(g.loading)}</td>
                    <td><span class="pill ${g.level === 'ok' ? 'pill-ok' : 'pill-danger'}">${escapeHtml(g.statusLabel)}</span></td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          <label style="display:flex; align-items:center; gap:8px; margin-top:14px;">
            <input type="checkbox" data-ats-toggle ${atsOn ? 'checked' : ''} />
            Include Automatic Transfer Switch (FOB grid ↔ generator)
          </label>
          <p style="color:var(--silver-500); font-size:12.5px; margin-top:6px;">
            Seamless failover matters here — a sensor that loses tracking lock mid-pass costs the collection opportunity.
          </p>
        </div>
      `;
    },
  },
  {
    id: 'site-layout',
    title: 'Site Layout & RF Siting',
    body: (state, store) => {
      const qtyOf = (id) => store.qtyOf(id);
      const antennaCount = antennaApertureCount(qtyOf);
      const groundingCount = KEY_ITEMS.grounding ? qtyOf(KEY_ITEMS.grounding.id) : 0;
      return `
        <div class="card">
          <h2>RF siting</h2>
          ${attestRow(
            store,
            'rf-siting',
            'RF feed-run lengths kept short; backup SATCOM/VSAT terminal sited to avoid self-interference with the passive receive antennas',
            'Every dB of feed loss must be made up by the antenna/LNA. An active local transmitter needs a deliberate EMI-separation check.'
          )}
        </div>
        <div class="card">
          <h3>Grounding &amp; lightning protection</h3>
          <p style="color:var(--silver-500); font-size:13px;">
            ${groundingCount} grounding kit(s) provisioned for ${antennaCount} antenna pedestal(s).
            ${groundingCount >= antennaCount && antennaCount > 0 ? '<span class="pill pill-ok">Coverage OK</span>' : '<span class="pill pill-danger">Needs attention</span>'}
          </p>
          <label>Grounding kit quantity:
            <input type="text" inputmode="numeric" pattern="[0-9]*" data-field="grounding-qty" data-grounding-qty
              value="${store.rawQty(KEY_ITEMS.grounding.id)}" class="qty-input input-editable" />
          </label>
        </div>
      `;
    },
  },
  {
    id: 'equipment-review',
    title: 'Equipment & Packing Review',
    body: (state, store) => {
      const qtyOf = (id) => store.qtyOf(id);
      const plan = suggestedLoadPlan(EQUIPMENT, qtyOf);
      const chairs = KEY_ITEMS.chairs ? qtyOf(KEY_ITEMS.chairs.id) : 0;
      const occupancy = thermalBudget(store.state.power).zoneA.occupancy;
      return `
        <div class="card">
          <h2>Container load plan snapshot</h2>
          <div class="grid grid--3">
            ${plan.containers
              .map(
                (c) => `
              <div class="container-card ${c.status === 'OVER CAPACITY' ? 'over' : ''}">
                <div class="container-card__head">
                  <h3 style="font-size:13px;">${escapeHtml(c.label)}</h3>
                  <span class="pill ${c.status === 'OVER CAPACITY' ? 'pill-danger' : 'pill-ok'}">${c.status}</span>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
          <p style="color:var(--silver-500); font-size:12.5px; margin-top:12px;">
            Occupancy sizing: ${chairs} chairs for a ${occupancy}-person max simultaneous occupancy.
            ${chairs === occupancy ? '<span class="pill pill-ok">Matches</span>' : '<span class="pill pill-warn">Check quantities</span>'}
          </p>
          <p style="margin-top:10px;"><a href="#/equipment">Open full Equipment &amp; Packing editor →</a></p>
        </div>
      `;
    },
  },
  {
    id: 'final-review',
    title: 'Final Review',
    body: (state, store) => {
      const { done, total, items } = checklistProgress(store.state);
      const pending = items.filter((i) => !i.ok);
      return `
        <div class="card">
          <h2>Design Checklist status: ${done}/${total}</h2>
          ${
            pending.length === 0
              ? `<p style="color:var(--ok); font-weight:600;">All key engineering decisions are confirmed.</p>`
              : `<p style="color:var(--silver-500); font-size:13px;">Still open:</p>
                 <ul class="flag-list">${pending.map((p) => `<li>${escapeHtml(p.title)}</li>`).join('')}</ul>`
          }
          <p style="margin-top:12px;"><a href="#/checklist">Open full Design Checklist →</a></p>
        </div>
      `;
    },
  },
];

export function render(container, { store }) {
  function draw() {
    const saved = captureFocus(container);
    const stepIndex = Math.min(store.state.wizard.currentStep, STEPS.length - 1);
    const step = STEPS[stepIndex];

    container.innerHTML = `
      <div class="view-header">
        <h1>ISR Site Setup Wizard</h1>
        <p>Walk through every decision the workbook flags as easy to forget. Your answers write directly
        into Equipment &amp; Packing and Power &amp; Thermal Budget, so everything stays in sync.</p>
      </div>

      <div class="wizard-steps">
        ${STEPS.map(
          (s, i) => `
          <button type="button" class="wizard-step-chip ${i === stepIndex ? 'current' : ''} ${
            store.state.wizard.completedSteps[s.id] && i !== stepIndex ? 'done' : ''
          }" data-step="${i}">
            ${i + 1}. ${escapeHtml(s.title)}
          </button>
        `
        ).join('')}
      </div>

      ${step.body(store.state, store)}

      <div class="wizard-nav">
        <button type="button" class="btn" data-prev ${stepIndex === 0 ? 'disabled' : ''}>← Back</button>
        <button type="button" class="btn btn-primary" data-next ${stepIndex === STEPS.length - 1 ? 'disabled' : ''}>
          ${stepIndex === STEPS.length - 1 ? 'Done' : 'Next →'}
        </button>
      </div>
    `;

    restoreFocus(container, saved);
  }

  draw();

  container.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-step]');
    if (chip) {
      store.setWizardStep(Number(chip.dataset.step));
      return;
    }
    if (e.target.closest('[data-prev]')) {
      store.setWizardStep(Math.max(0, store.state.wizard.currentStep - 1));
      return;
    }
    if (e.target.closest('[data-next]')) {
      store.markStepComplete(STEPS[store.state.wizard.currentStep].id);
      store.setWizardStep(Math.min(STEPS.length - 1, store.state.wizard.currentStep + 1));
      return;
    }
  });

  container.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('[data-antenna-dish]')) store.setQty(KEY_ITEMS.avlDish.id, t.value);
    if (t.matches('[data-grounding-qty]')) store.setQty(KEY_ITEMS.grounding.id, t.value);
  });

  container.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-attest]')) store.setAttestation(t.dataset.attest, t.checked);
    if (t.matches('[data-sband-toggle]')) store.setQty(KEY_ITEMS.sBand.id, t.checked ? 1 : 0);
    if (t.matches('[data-ats-toggle]')) store.setQty(KEY_ITEMS.ats.id, t.checked ? 1 : 0);
    if (t.matches('[data-wizard-generator]')) store.setPowerField('selectedGeneratorId', t.value);
    if (t.name === 'radome') {
      chooseExclusive(
        store,
        [KEY_ITEMS.radomeRigid.id, KEY_ITEMS.radomeAir.id, KEY_ITEMS.radomeSpaceFrame.id],
        t.value,
        Math.max(1, antennaApertureCount((id) => store.qtyOf(id)))
      );
      store.setQty(KEY_ITEMS.radomeCompressor.id, t.value === KEY_ITEMS.radomeAir.id ? 1 : 0);
    }
    if (t.name === 'ecp') {
      chooseExclusive(store, [KEY_ITEMS.ecpTent.id, KEY_ITEMS.ecpIsu.id], t.value, 1);
    }
  });

  const unsubscribe = store.subscribe(draw);
  return unsubscribe;
}
