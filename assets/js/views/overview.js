import { OVERVIEW, CONTAINER_SPEC } from '../data.js';
import { escapeHtml } from '../format.js';

export function render(container) {
  container.innerHTML = `
    <div class="view-header">
      <h1>${escapeHtml(OVERVIEW.title)}</h1>
      <p>${escapeHtml(OVERVIEW.subtitle)}</p>
    </div>

    <div class="grid grid--2">
      <div class="card">
        <h2>Mission &amp; Design Parameters</h2>
        <dl class="fact-list">
          ${OVERVIEW.facts
            .map((f) => `<dt>${escapeHtml(f.label)}</dt><dd>${escapeHtml(f.value)}</dd>`)
            .join('')}
        </dl>
      </div>

      <div class="card">
        <h2>ISU-90 Container Reference</h2>
        <dl class="fact-list">
          <dt>Exterior Dimensions (W x L x H)</dt><dd>${escapeHtml(CONTAINER_SPEC.exteriorDims)}</dd>
          <dt>Interior Usable Dimensions (W x D x H)</dt><dd>${escapeHtml(CONTAINER_SPEC.interiorDims)}</dd>
          <dt>Interior Volume</dt><dd>${escapeHtml(CONTAINER_SPEC.interiorVolumeNote)} (planner uses ${CONTAINER_SPEC.volumeCapacityCuFt} cu ft)</dd>
          <dt>Tare (empty) Weight</dt><dd>${escapeHtml(CONTAINER_SPEC.tareWeightNote)}</dd>
          <dt>Rated Payload Capacity</dt><dd>${CONTAINER_SPEC.payloadCapacityLb.toLocaleString()} lb</dd>
          <dt>Maximum Gross Weight</dt><dd>${escapeHtml(CONTAINER_SPEC.maxGrossWeightNote)}</dd>
          <dt>Transport Compatibility</dt><dd>${escapeHtml(CONTAINER_SPEC.transportCompat)}</dd>
        </dl>
      </div>
    </div>

    <div class="card">
      <h2>Key Engineering Flags Carried Into This Design</h2>
      <p style="color:var(--silver-500); margin-top:-6px; margin-bottom:14px; font-size:13px;">
        These are the design decisions the workbook flags as easy to get wrong or forget.
        The Setup Wizard walks through each one and the Design Checklist tracks them for the
        rest of your session.
      </p>
      <ul class="flag-list">
        ${OVERVIEW.engineeringFlags.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}
      </ul>
    </div>

    <div class="card">
      <h2>Where To Go Next</h2>
      <div class="grid grid--3">
        <div>
          <h3>Setup Wizard</h3>
          <p style="color:var(--silver-500); font-size:13px;">Walk step-by-step through sensor, antenna, radome, shelter, HVAC, and power decisions.</p>
          <a class="btn btn-primary" href="#/wizard" style="display:inline-block;margin-top:8px;">Start wizard →</a>
        </div>
        <div>
          <h3>Equipment &amp; Packing</h3>
          <p style="color:var(--silver-500); font-size:13px;">Select items and quantities, then see a live ISU-90 load plan with capacity checks.</p>
          <a class="btn" href="#/equipment" style="display:inline-block;margin-top:8px;">Open packing tool →</a>
        </div>
        <div>
          <h3>Power &amp; Thermal Budget</h3>
          <p style="color:var(--silver-500); font-size:13px;">Live electrical, HVAC, and generator sizing calculator, split into Zone A / Zone B.</p>
          <a class="btn" href="#/power" style="display:inline-block;margin-top:8px;">Open calculator →</a>
        </div>
      </div>
    </div>
  `;
}
