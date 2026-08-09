# ISR Site-in-a-Box

An unofficial planning tool for packing ISU-90 containers and standing up a
rapidly deployable Electronic Support (ES) collection site. Ported from a
spreadsheet workbook ("ISR Site in a Box", Rev. 2) covering antennas, radomes,
shelter, power, HVAC, processing/exploitation IT, and site support equipment.

**Not affiliated with, or endorsed by, the U.S. Space Force or the Department
of Defense.** The visual style is inspired by DoD/USSF digital branding
conventions (a restrained near-black / deep space-blue / silver palette); no
official seals, insignia, or trademarks are used or implied.

## What it does

- **Equipment & Packing** — select equipment quantities and see a live ISU-90
  load plan (weight/volume per container, 10,000 lb / 385 cu ft each), either
  grouped by the workbook's category-based assignment or auto-optimized
  (first-fit-decreasing bin packing) to minimize the number of containers.
- **Power & Thermal Budget** — a live calculator for the electrical load
  budget, two-zone HVAC/ECU sizing (ops shelter vs. isolated sensor
  container), and backup generator loading, matching the workbook's formulas.
- **Setup Wizard** — walks through the design decisions the workbook flags as
  easy to forget: antenna architecture, radome type, shelter/ECP module, HVAC
  zoning, power posture, and site layout/RF siting.
- **Design Checklist** — tracks every one of those key engineering flags
  across the whole session, auto-verifying what it can from your selections
  (container capacity, generator loading, grounding-kit coverage, occupancy
  sizing, ...) and requiring explicit confirmation for judgment calls (link
  budget, RF siting) that the tool can't verify on its own.
- **Antenna & Radome Comparison** — reference trade-space tables ported from
  the workbook's comparison tab.

## Tech

Zero-build static site: plain HTML/CSS/JS (ES modules), no framework, no
external services, no network calls, no build step. State persists to
`localStorage` only. This keeps it portable to any static host — GitHub
Pages, or otherwise — with `index.html` as the entry point and everything
else served as relative static assets under `assets/`.

To run locally:

```
python3 -m http.server 8000
# open http://localhost:8000
```

## Source data

All equipment, power/thermal formulas, and comparison tables in
`assets/js/data.js` are transcribed from the source workbook. Figures are
engineering estimates — confirm against vendor datasheets and unit SOPs
before real-world use.
