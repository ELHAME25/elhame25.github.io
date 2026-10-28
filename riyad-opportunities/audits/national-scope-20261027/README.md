# National routing audit — 27 October 2026

Read-only runtime audit against the working tree based on main `8d733985b56185b6ade5d4c311b373f1bf9f4dec`. Production code was being repaired concurrently, so these are checkpoint results, not deployment certification. Re-run after final changes.

- 249 branch entries, 79 original city labels (aliases deliberately preserved).
- 1,743 branch/category routing cases (7 categories per branch).
- 996 office-radius cases (5/10/15/20 km); radius is applicable to 88 branches in the current implementation.
- No duplicate raw result IDs, unintended cross-city result leakage, radius overflow, or non-monotonic radius counts found.
- 36 raw default-empty/city-nonempty cases: 35 NHC cases in central Riyadh and central/western Jeddah, plus northern Jeddah branch 165 with no local-sector showroom records. Raw NHC empty counts are not final UI counts: destinationGroups adds nearby fallback separately.
- NHC display checkpoint: 125 branches have local destinations, 41 have nearby fallback, 83 have neither under the strategy-based fallback at this checkpoint. Many have no local inventory or lack a usable nearby pin; Qatif and Umm Al Hammam were specifically reported for further category-aware fallback review.
- Inventory-only cities with no branch: Damad, Ahad Rufaidah, Baysh, Al Rawdah. These are city-choice entries, not necessarily unreachable records.
- Canonical unassigned-sector records: Riyadh approved 88/232 and available 34/354; Jeddah approved 64/100 and available 24/90. These must remain discoverable without guessing sector membership. The implementation agent added a separately labelled unassigned-sector view.
- This is routing/data consistency QA, not verification of every business, phone number, price, image, or destination point with external sources.

Artifacts include raw per-branch/category counts, office radius behavior, NHC grouping and the exact canonical unassigned-sector list. `visible` in the branch matrix uses `visibleItemsFor`, not `compute`'s NHC fallback. Read `nhc-display-matrix.json` for that distinction.

Run the audit scripts with the absolute directory `riyad-opportunities` as the first argument. Scripts write their machine-readable result under `/tmp` and do not modify production files.

## Stable candidate recheck at 20:35 UTC

The separately named `final-*` artifacts supersede the earlier NHC checkpoint. App SHA256 at this check: `cb54fb3bef77fbbce4e96393aca138f7d003d404a12dd6ab7e7e335319b57533`.

- Full 249-branch destination grouping: 125 with local entries; 45 with nearby fallback; 79 without a supported located destination. The final group includes Qatif's three branches and Umm Al Hammam using Qumra in Safwa, with its original city retained.
- Eligible unassigned-sector lists exactly match canonical city records: Riyadh approved 88, available 34, offices 10; Jeddah approved 64, available 24, offices 15. No sector was guessed or written to source data.
- Actual delegated click-handler tests pass: switching scope clears query; entering the NHC tab does not inherit unassigned scope; choosing a sector resets nearby mode; tab returns restore each tab's independent scope.
- Representative rendered counts pass for Qatif, Umm Al Hammam, Dhahran, Saihat, Diriyah, Riyadh and Jeddah: no nonzero result with zero denominator. Unassigned content is explicitly labelled city-level, not nearest or in the branch sector.
- Current city-choice total is 80: 76 canonical branch cities plus four data-only city choices, while 79 original branch locality labels remain preserved.
- Completed all 498 rendered NHC view checks (249 branches × local/nearby), with no positive count over a zero denominator and no shown count exceeding total. To reduce redundant static identity-resolution work in this test only, `allCanonicalProjects` was memoized once; production code was not altered. Rendering, state changes and counts used the candidate application functions.

Final focused rerun at 20:39 UTC passed against app SHA256 `a426d3ad9e925b54c639d7dd647557b92fc3ae0521417cfe6bbdc81e04f39028`. The only production change after the full 498-view run was clarification of two NHC notes to say “destination or sales-center recorded point”; no routing/counting logic changed. Main candidate commit at this recheck was `bfe34f5`, with those wording edits still in the working tree.

## Final link-data and retention verification at 20:58 UTC

`final-no-loss-data.json` compares all nine production record arrays with original main `8d733985`. Counts, identifiers and order are retained: 249 branches, 648 projects, 485 opportunities, 29 NHC destinations, 169 companies, 1,524 offices, 783 cars, 10 self-build and one dealer. All 33 Qadisiyyah car records are exactly unchanged. Changed fields are enumerated; no records were removed. Data and final code/image hashes are saved independently.

`audit-final-links.js` passes on app SHA256 `b1dc3d817e42db2f38376dfd9a862c7d2d6a459a545b9893943c0ee392ea42b9`. A real regression was caught and corrected before completion: legacy eligibility previously kept two newly verified prebooking/coming-soon records in sale results. All three affected Senan records now remain stored, but are neither sale-eligible nor incorrectly pending verification. Nine explicit status fixtures verify known non-sale, unknown, and available behavior without changing records to sold-out.

Two exact dead project pages correctly suppress only the broken project action and retain verified corporate-site alternatives. The former `almadaralwaed.com` domain is absent from active URL action fields and the rendered P091 card; historical source evidence remains preserved. This does not claim HTTP verification of every stored URL.

Final follow-up at 21:16 UTC: refreshed all no-loss/data hashes after one additional office expired-Snapchat action suppression and P316's disabled-hosting replacement with the exact matching developer-branded brochure. All record IDs/order/counts and Qadisiyyah33 are preserved. P316 changed only page/dsite/link evidence, with no availability, phone or map change. Final link runtime assertions (including those two follow-ups) and scope recovery regression both passed. This confirms the local candidate only; no publication is implied.
