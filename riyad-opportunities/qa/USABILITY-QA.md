# Small usability overlay

This is a delta to the approved six-card / 12-result design, not a redesign.

- The six primary categories stay unchanged. A secondary البناء الذاتي button opens the existing same-city directory in one click and retains per-category state.
- Only confirmed available records enter the ready/approved lists or numeric counts. If there are zero confirmed records but same-scope records awaiting verification, the category shows a dash and a concise pending message. A genuinely empty scope stays zero. Known sold-out, unavailable or interest-only records do not create pending stock. A missing confirmed bank catalog still uses its stronger pending-source message.
- Canonical identity/latest status is resolved globally before geographic filtering for both confirmed and pending states. Search distinguishes a pending match from no matching record; it never renders an unverified record.
- On mobile, the compact side photo is secondary to identity and evidenced commercial information. Direct actions occupy the full card width. Contact, maps, selectors and other controls have minimum 44px targets. Details put title, evidenced price and contact/map actions before the large photo.
- The visible photo-source detail action is removed. Source metadata and archived license notices remain unchanged. The active city-photo allowlist remains the existing user-supplied/CC0/public-domain set; no new images are activated.

## Latest footer and mobile correction

The header retains its centered title and original right-side logo, with no credit duplicate. The shared footer shows إعداد: خالد الماطر once on every view, with the update label/date on the left. The header slogan is التنفيــذ … النتائــج … الأثــر, and the supporting line is فرص واضحة … وصول أسرع. The photo slogan remains unchanged. Entry uses the direct اختر مدينتك وفرعك heading without خطوتك الأولى. Mobile category labels use intrinsic grid rows rather than shrinking flex content. Any browser legibility failure now saves the actual screenshot, element dimensions and font state; the original minimum-size and no-clipping assertions are not relaxed.

## Reproducible checks

Run `sh qa/run.sh` for the existing full suite plus `qa-usability.js` (13 focused in-memory groups). No fixture is written to production JSON.

Run the existing browser CI workflow. `qa-browser.js` uses real data for 1440/390/320 screenshots, including requested detail views. It waits for Noto Kufi and checks actual mobile target dimensions, text clipping, horizontal overflow, compact photo sizing, full-width actions and self-build access. Additional pending/no-results scenarios are memory-only and never captured as production screenshots. Measurements appear in `browser-results.json` under `mobileChecks`.

The local environment cannot run the browser preview, so actual responsive pixel checks and screenshots are explicitly pending CI, not claimed passed by the static/VM suite. Existing approval, contact, scope, data retention, 18 refinement and 50 behavior checks remain in place; only the obsolete expectation of a visible photo-source action is replaced with its requested absence.
