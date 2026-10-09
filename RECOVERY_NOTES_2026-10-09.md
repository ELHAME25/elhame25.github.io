# Recovery checkpoint — 2026-10-09

## Verified refs
- Repair branch: `codex/audit-repair-20261009-0851` at `12558ee20fa8885a03e3c6b16d89fa081b542d90`.
- Local commit `45b91dc6447ede859483681ca41cb6e3daa95cc1` is not found on GitHub (API 422). Its alleged local presence and all uncommitted workspace changes remain unverified because the terminal session does not return output. Do not overwrite/reset the existing workspace.
- This note is saved to recovery branch `codex/audit-repair-recovery-20261009`, a copy of 12558ee. The repair branch and live site are unchanged. No merge or deployment.

## Data inventory from remote repair branch 12558ee
- 248 branches; 647 projects; 119 companies; 1,058 car showrooms; 1,524 offices; 394 opportunities; 10 self-build entries.
- Projects: 263 have an image URL, 249 distinct URLs, 384 blank image fields. 14 image uses are in excess of one use per unique URL. 46 populated image rows have `imageSourceUrl`; 203 rows with image URLs have neither `imageSourceUrl` nor `imageSource`. These are field counts only; external response and visual suitability were not checked.
- Existing numbers without `phoneSource`: projects 247, companies 105, cars 995, offices 1,485, opportunities 313, self-build 1. Do not treat every such number as verified.
- ID, name and city presence checks found no missing values or duplicate IDs in the seven datasets. Data cities without a directly matching branch city: أحد رفيدة، الأرطاوية، الأفلاج، الروضة، بيش، سبت العلايا، ضرماء. Check against the project's intended multi-section coverage before changing.
- 46 `pageSource` values in project/opportunity datasets do not start with HTTP(S); each needs record-level review, not blanket deletion.
- Latest recorded QA log includes prior passes (371/371 scope, 47/47 UI behavior, 18/18 refinement, 1,736 branch/category and 105 sector/category checks). Its final note says wider audit and final full run are pending. The workflow script `riyad-opportunities/qa/run.sh` runs app syntax and ten QA scripts. It has not been rerun against final HEAD in this session.

## Read-only phone research — do not treat as applied changes

Company research (agent-reported 22 company rows with primary sources; duplicated entity rows need care):
- Retal 8003030888 — https://retal.com.sa/contact/
- Alsoliman 920003511 — https://www.alsoliman.com.sa/ar
- Diriyah Company 920021727 — https://www.diriyahcompany.sa/ar/contact-us
- Alajlan 920033158 — https://alajlaninvest.com/
- Alramz 920031440 — https://alramzre.com/projects/ربوة_الرمز/
- Dar wa Emaar 920004077 — https://darwaemaar.com/contact/
- Al Mousa 920008699 — https://almousadev.com/contact
- Safa 920001912 — https://safainv.sa/contact-us
- Mobtakeron 920010493 — https://mobtakeron.com.sa/en/
- Tatwirco 920020156 — https://azyanburaydah.com/your-investment/
- Najoom Al Salam 920004468 — https://nag.com.sa/
- Tamkeen 920000140 — https://tamkean.sa/contact/
- Thabat Al Maskan 920001304 — https://thabatre.sa/english/contact-us-eng/
- Clusters 0575556000 — https://clusters.sa/ar/projects/alnarjis-clusters-ar
- Alaqtar 920011058 — https://alzumuruda.alaqtar.com/public/assets/Al%27Zumuruda-Brochure-EN.pdf
- Sumou 920028029 — https://sumou.com.sa/
- Ledar 920001001 — https://ledar.com/contact-us/
- Aknan 920033007 — https://aknann.com/
- Maya 920007905 — https://maya.sa.com/contacts
Only company-level public numbers are described as company-level. Personal mobiles not shown on first-party sources were rejected.

Project developer-level source results (agent-reported 63 existing project records, plus 16 NHC records already sourced; not written to data):
- Retal 8003030888: P443,P462,P485,P486,P511,P532,P537,P549 — https://retal.com.sa/contact/
- Tilal 8001110100: P446 — https://www.tilalre.com/ar/
- Alajlan 920033158: P450–453,P526,P573,P588,P617 — https://alajlaninvest.com/
- Thabat Al Maskan 920001304: P460,P548 — https://thabatre.sa/english/contact-us-eng/
- Dar wa Emaar 920004077: P461,P535,P539,P592,P613,P618 — https://darwaemaar.com/contact/
- Mobtakeron 920010493: P468 — https://mobtakeron.com.sa/en/
- Al Akaria 920003938: P469,P495,P639 — https://al-akaria.com/wp-content/uploads/2024/05/Al-Dhahia.pdf
- ROSHN 920022288: P476,P477,P498,P594 — https://www.roshn.sa/ar/roshn-care
- Alsoliman 920003511: P478,P479 — https://www.alsoliman.com.sa/ar/project/سكينة-كمباوند
- Miskan 920013350: P483,P484 — https://miskan.com.sa/docs/default-source/pdfs/download-profile.pdf
- Diriyah 920021727: P490,P632–P638 — https://www.diriyahcompany.sa/ar/terms-and-conditions
- Thabat Red 920031100: P505 — https://thabatred.com/
- Makiiyoon 920000355: P531 — https://makkiyoon.com/contact-us/
- Najoom Al Salam 920004468: P534 — https://nag.com.sa/contact/
- Safa 920001912: P544,P568,P580 — https://safainv.sa/contact-us
- Osus 920022230: P545 only; do not apply to P619 until entity mismatch is resolved — https://osus.com.sa/contact/
- Alramz 920031440: P556,P610,P627 — https://alramzre.com/projects/ربوة_الرمز/
- Lamarya 0556388388: P572 — https://lamarya.sa/about-us
- Clusters 0575556000: P576,P625 needs name/entity match — https://clusters.sa/ar/projects/alnarjis-clusters-ar
- Arweqa 920009210: P582 — https://arweqah.com.sa/contact/
- Ledar 920001001: P591 — https://ledar.com/contact-us/
- Tatwirco 920020156: P605,P608 — https://tatwirco.sa/privacy-policy-ar/
- Canna 920007246: P621 — https://www.canna.sa/contact
- NHC 920033499: NHC developer records; already sourced in the current data — https://www.nhc.sa/contact/

Potential source-backed missing project phones, pending exact local-row match: Tiraz P448/P502 920005688 https://tiraz.com.sa/تواصل-معنا/; Al Rashid P463/P464/P529/P538/P614 920027239 https://alrashid-properties.sa/communities/al-narjis-view-1; Ajdan P598/P601/P602 920000658 https://ajdan.com/. These are developer contact numbers, not project-specific lines. Preserve existing mobile/number history until directly matched and reviewed. Researcher explicitly rejected unverified or mismatched numbers on P449, P466/P470/P471, P467, P519, P503/P504/P508/P509/P510/P521/P551/P564, P527/P569–P571/P579/P586/P616/P620, P561, P562, P607, and others.

## Read-only image research P221–P330
Seven distinct image URLs not currently used by any `projects.img` in the GitHub snapshot:
- P251 قرية موجان: https://szgroup.co/wp-content/uploads/2024/05/3443-01.png — source https://szgroup.co/en/portfolio/mojan-village/; project delivery/engineering partner, not listed developer.
- P252 دار سمو: https://pbs.twimg.com/media/Esjlpp_XEAE34Zu.jpg — https://x.com/DarSumou/status/1353584214277554181; branding mentions Dar Sumou/NHC and Khayala.
- P253 داري قريش: https://media.alj.com/app/uploads/2020/07/2019-Dari-Q-begins-construction.jpg — https://alj.com/en/land-and-real-estate/real-estate-overview/; official AlJ image titled Q Dari.
- P254 روابي الحجاز: https://momah.gov.sa/sites/default/files/2022-01/%25D8%25B1%25D9%2588%25D8%25A7%25D8%25A8%25D9%258A%2520%25D8%25A7%25D9%2584%25D8%25AD%25D8%25AC%25D8%25A7%25D8%25B2_01.png — https://momah.gov.sa/ar/node/8183; ministry page names the project.
- P257 ميلاء: https://ruh-s3.bluvalt.com/api-nhc.sa/s3fs-public/2026-05/WEB_Artboard%201.png — https://nhc.sa/media-center/news/47915/; destination-level material, not a confirmed image of this individual project.
- P265 بيلار: https://pbs.twimg.com/profile_banners/1447958150297042947/1676190207 — https://x.com/BelarJeddah; project/developer branding.
- P274 يسر فيلج: https://alramzre.com/wp-content/uploads/2025/10/JAM02400-1024x683.jpg — https://alramzre.com/projects/يُسر-فيلج/; official project gallery.
P252/P253/P254/P265/P274 were reported as stronger matches; P251 partner image and P257 destination art need clear source-type marking. No files changed; images not downloaded/visually inspected.

## Resume protocol
1. Recover the original workspace and inspect branch, HEAD, staged/unstaged/untracked files before touching it. Preserve any local state.
2. Reconcile this ledger with local records; add only evidenced values, at appropriate project/developer/branch level, with source links.
3. Receive remaining phone/image research, verify duplicate numbers and image uniqueness, visually inspect image candidates and mobile UI.
4. Run all of `qa/run.sh` on the completed candidate, plus full branch/category/radius checks and link/data audit. Record actual results; prior passes are not proof for a later untested HEAD.
5. Keep repair branch and live site unchanged until audit complete. No merge/deploy is authorized by this checkpoint.
