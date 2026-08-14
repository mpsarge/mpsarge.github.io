import { ANTENNA_COMPARISON, RADOME_COMPARISON } from '../data.js';
import { escapeHtml } from '../format.js';
import { suggestCorrectionUrl } from '../github-issue.js';

function correctLink(itemLabel, itemId, currentData) {
  return `<a href="${suggestCorrectionUrl({ itemLabel, itemId, currentData })}" target="_blank" rel="noopener" style="font-size:11.5px; white-space:nowrap;">Suggest a correction ↗</a>`;
}

export function render(container) {
  container.innerHTML = `
    <div class="view-header">
      <h1>Antenna &amp; Radome Comparison</h1>
      <p>Reference trade-space ported from the workbook's comparison tab. Approach: mechanically change
      feeds/apertures across 2-3 dish-type antennas, or substitute an electronically-steered/panel antenna
      for the bands it covers — not one aperture receiving all five bands (S/C/X/Ku/Ka) simultaneously.</p>
    </div>

    <div class="card">
      <h2>Antenna Systems</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>System</th><th>Architecture</th><th>Band Coverage</th><th>Orbital Regimes</th>
              <th>Pack / Transport Form</th><th>Pros</th><th>Cons</th><th>Source</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${ANTENNA_COMPARISON.map(
              (a) => `
              <tr>
                <td style="min-width:160px;"><strong>${escapeHtml(a.system)}</strong></td>
                <td style="min-width:160px;">${escapeHtml(a.architecture)}</td>
                <td style="min-width:180px;">${escapeHtml(a.bandCoverage)}</td>
                <td style="min-width:140px;">${escapeHtml(a.orbitalRegimes)}</td>
                <td style="min-width:160px;">${escapeHtml(a.packForm)}</td>
                <td style="min-width:220px; color:var(--silver-300);">${escapeHtml(a.pros)}</td>
                <td style="min-width:220px; color:var(--silver-500);">${escapeHtml(a.cons)}</td>
                <td style="min-width:120px; color:var(--silver-500);">${escapeHtml(a.source)}</td>
                <td style="min-width:140px;">${correctLink(a.system, a.id, a)}</td>
              </tr>
            `
            ).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h2>Radome Options</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>System</th><th>Structure Type</th><th>Continuous Power?</th><th>Setup Time</th><th>Pros</th><th>Cons</th><th>Source</th><th></th></tr>
          </thead>
          <tbody>
            ${RADOME_COMPARISON.map(
              (r) => `
              <tr>
                <td style="min-width:200px;"><strong>${escapeHtml(r.system)}</strong></td>
                <td style="min-width:180px;">${escapeHtml(r.structureType)}</td>
                <td style="min-width:200px;">${escapeHtml(r.continuousPower)}</td>
                <td style="min-width:140px;">${escapeHtml(r.setupTime)}</td>
                <td style="min-width:220px; color:var(--silver-300);">${escapeHtml(r.pros)}</td>
                <td style="min-width:220px; color:var(--silver-500);">${escapeHtml(r.cons)}</td>
                <td style="min-width:120px; color:var(--silver-500);">${escapeHtml(r.source)}</td>
                <td style="min-width:140px;">${correctLink(r.system, r.id, r)}</td>
              </tr>
            `
            ).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <p style="color:var(--silver-700); font-size:11.5px; margin:0;">
        Band coverage and orbital-regime claims are as published by each vendor; none of this constitutes a
        completed link budget or G/T analysis against the actual emitters of interest. Confirm before
        down-selecting an antenna. Go to Equipment &amp; Packing to set quantities, or the Setup Wizard to
        record your architecture decision.
      </p>
    </div>
  `;
}
