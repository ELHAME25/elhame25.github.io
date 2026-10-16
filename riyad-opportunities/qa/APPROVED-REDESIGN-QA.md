# Approved portal redesign QA

## Run

From `riyad-opportunities`: `sh qa/run.sh`.
For a local preview: `python3 -m http.server 8126 --directory riyad-opportunities` from the repository root.
Browser QA: install the workflow-pinned Playwright runtime, then run `node riyad-opportunities/qa/qa-browser.js` with that runtime in `NODE_PATH`.

The isolated-branch workflow `.github/workflows/riyad-opportunities-qa.yml` runs regression and browser jobs. The browser job uploads `portal-browser-qa-<commit>` for 14 days, including desktop (1440 px), mobile (390 px), narrow mobile (320 px), real-data entry and category screenshots, and `browser-results.json`. Failure output is also retained. Screenshots never use evidence fixtures. The separate interaction context injects test-only proof records in memory; it does not edit data JSON.

## Coverage retained and migrated

`qa-ui-refinement.js` retains 18 explicit assertions, not a shim:

1. Branch title: scoped city heading and branch identity.
2. Showroom groups: Qadisiyyah 33, Shifa 15, Riyadh all 55; no inappropriate radius.
3. Active styling: selected category navy and scope dropdown rather than old pills.
4. Destination ranking: near-first destination order and visibility.
5. Project details: explicit, labeled native details button.
6. Location labels: neighborhood, plan and destination wording.
7. Images: lazy loading and asynchronous decoding.
8. Price: no fabricated missing-price label; evidence required.
9. Rooms: no unverified rooms on cards; evidence required.
10. Search: always present above results/categories.
11. Sector projects: not incorrectly restricted by branch radius.
12. Missing office pin: retain a verified sector when known; otherwise city fallback, with no invented distance.
13. Internal audit copy: not exposed to visitors.
14. Mobile tagline: retained responsive sizing.
15. Narrow layout: one-column result lists and approved 3-by-2 category layout.
16. Keyboard detail action: native button and visible focus.
17. Long names: wrap without clipping.
18. Optional office distance: explicit 5/10/15/20 km choices, never a default boundary.

`qa-ui-behavior.js` retains its 50 interaction/data/markup checks; changed expectations follow the approved evidence gates and dropdowns. NHC expected counts are independently derived from source `serviceSectors` (otherwise physical sectors), not assumed to be permanently three destinations. Project physical sectors remain independent.

`qa-approved-redesign.js` adds focused contracts for the six exact categories, employee/branch/city entry order, 12+12 pagination, branch 252 with a known West sector but no GPS, whole-city offices in independent non-sector cities, sourced Tabuk branch coverage with honest city fallback, source-backed availability/approval, canonical identity resolution, global newest unknown/sold-out suppression before geographic filtering, quantitative field evidence, real city attribution, NHC exact destination joins and verified linked contacts, nested modal Back, filter/scroll preservation, and verified-phone-only rendering without raw-data loss.

Existing national scope, 371-case scope, city picker, integrity, PDF showroom coverage, company coverage, action markup, phone-context, company/radius and retained-data suites remain in the run list. Do not weaken their data invariants merely to accept an updated packet; investigate or explicitly review changed source expectations.

## Release gate

The pre-audit baseline intentionally has zero records satisfying the new active-sale and approval evidence gates. Zero-filled gated categories are not a production-ready release. Integrate audited data, then report raw and canonical available totals and the intersection with verified bank approval. Preserve unknown/sold-out/interest-only records in data and audit, but do not advertise them as available.

Project IDs and bank approval codes are internal; branch codes remain visible. New launches can be available for sale without completed construction. NHC `serviceSectors` affects destination recommendations only. Exact `destinationName`, `destinationCity`, and `destinationSource`/`destinationEvidence` link project drilldowns. Contacts use only explicit project/company links, and `verifiedPhones`, when present, controls every rendered/action number while raw phone arrays stay intact.

Local DOM/syntax/regression tests are executable in the cloud filesystem. Browser screenshots have not been produced locally because the available Chromium runtime cannot start under the socket sandbox and the supported cloud browser cannot reach this filesystem's local server. Review the isolated-branch CI screenshot artifact before merging. No main-site publication is implied by local QA.

## Latest scope-policy delta

- Companies remain citywide everywhere.
- Riyadh/Jeddah projects and offices default to the complete verified sector, without mandatory kilometer exclusion. Unknown sectors are available in city view, not assigned arbitrarily. NHC recommendations use `serviceSectors` when supplied, otherwise physical sectors. Riyadh showroom group protections are unchanged.
- Other cities, including Abha, Buraidah, Unaizah, Ar Rass, Az Zulfi and Hail, default to the whole city for offices as well as the other categories. Proximity can sort the list; the optional office-distance mode is a deliberate dropdown selection, not the default.
- Tabuk is the exception: `branchCoverage: {branchCodes: ['401'], source, checkedAt}` permits an exact documented branch recommendation. Current branches 401/409/410/416/421 have pins and neighborhoods but no documented catchment boundaries. Without such coverage the UI honestly selects whole-city, never a fabricated radius or nearest-branch partition; all-city remains available when coverage exists. Companies still stay citywide.
- Canonical project identity and latest evidence resolve across the complete two-dataset catalog before any city/sector filter. Approval is carried only across proven exact identity, and an approved-view identity must have a project-source record.
