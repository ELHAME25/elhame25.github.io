/* دليل فرص المملكة — تطبيق ثابت بلا إطار عمل. يقرأ config/site.json ثم data/*.json
   منطق العرض:
   - نطاق المدن الكبيرة يقبل تصفح الفرع أو القطاع أو المدينة، وتبدأ النتائج الأقرب.
   - في المدن الأخرى تُعرض جميع الفئات على مستوى المدينة دون خلط المدن المتجاورة.
   - سجلات السيارات تستبعد الشركات والوكالات وموزعي العلامات التجارية، وتزيل تكرار المعرض داخل المدينة.
   - المشاريع بلا إحداثيات تبقى ظاهرة في عرض المدينة ولا تُحتسب ضمن نطاق الفرع؛ وجهات NHC تُرشح بقطاعها عند اختيار قطاع.
   - وجهات NHC والبناء الذاتي تخدم المدينة كلها.
   - الأرقام أعلى الصفحة تتبع العناصر المعروضة.
   - قسم واحد يُعرض في كل مرة. */
(function () {
  'use strict';

  var CFG = { siteName: 'دليل فرص المملكة', orgName: '', logo: '', tagline: [], credit: '', dataBase: 'data/', enableVcard: true,
              pageSize: 12, officeLimit: 12, updatedLabel: 'آخر تحديث للبيانات' };
  var D = {};
  var S = fresh();
  function fresh() { return { branch: null, scope: 'branch', radius: 15, explore: '', tab: '', q: {}, limit: {}, employee: (S && S.employee) || '', origin: null, nearestBranchDistance: null, carArea: '', views: {} }; }
  function employeeGreeting(name) {
    name = String(name || '').trim(); if (!name) return '';
    // تحية محايدة زمنيًا تمنع عرض صباح الخير ليلًا عند اختلاف ساعة الجهاز.
    return 'مرحبًا، ' + name;
  }
  var app = document.getElementById('app');
  var SECTORS = ['شرق', 'شمال', 'جنوب', 'غرب', 'وسط'];
  var PRIMARY_SECTIONS = ['opps', 'projects', 'nhc', 'companies', 'offices', 'cars'];
  var SECTIONS = ['projects', 'opps', 'nhc', 'selfbuild', 'companies', 'offices', 'cars', 'dealers', 'nearby'];
  var LABEL = { opps: 'المشاريع والفرص الجاهزة للبيع', selfbuild: 'البناء الذاتي', projects: 'المشاريع المعتمدة لدى البنك', nhc: 'وجهات NHC', companies: 'شركات الاستثمار والتطوير العقاري', offices: 'مكاتب العقار', cars: 'معارض السيارات', dealers: 'وكالات السيارات الرسمية', nearby: 'فرص قريبة من الفرع' };
  var SHORT = { opps: 'فرص حالية', selfbuild: 'البناء الذاتي', projects: 'المشاريع', nhc: 'وجهات NHC', companies: 'شركات الوساطة والاستثمار العقاري', offices: 'المكاتب', cars: 'المعارض', dealers: 'الوكالات الرسمية', nearby: 'قريبة' };
  var NOUN = { opps: 'فرص عقارية حالية', selfbuild: 'مخططات للبناء الذاتي', projects: 'مشاريع معتمدة', nhc: 'وجهات NHC', companies: 'شركات تسويق أو تطوير', offices: 'مكاتب عقار', cars: 'معارض سيارات', dealers: 'وكالات سيارات رسمية', nearby: 'فرص' };
  var SEARCH_PH = { opps: 'ابحث باسم المشروع أو المطور', selfbuild: 'ابحث عن مخطط', projects: 'ابحث باسم المشروع أو المطور أو الحي', nhc: 'ابحث عن وجهة', companies: 'ابحث عن شركة', offices: 'ابحث باسم المكتب أو الحي', cars: 'ابحث باسم المعرض أو الحي', dealers: 'ابحث باسم الوكالة أو المدينة', nearby: 'ابحث في الفرص القريبة' };
  var NEARBY_MODE = { metro_support: 5, nearby_auto_if_category_sparse: 5, nearby_optional: 1 };

  /* ---------------- helpers ---------------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function sameProjectNameTypo(a, b) {
    a = norm(a); b = norm(b);
    var numsA = (a.match(/\d+/g) || []).join(','), numsB = (b.match(/\d+/g) || []).join(',');
    if (numsA !== numsB || Math.abs(a.length - b.length) !== 1) return false;
    var shortName = a.length < b.length ? a : b, longName = a.length < b.length ? b : a;
    var i = 0, j = 0, insertions = 0;
    while (i < shortName.length && j < longName.length) {
      if (shortName[i] === longName[j]) { i++; j++; continue; }
      if (++insertions > 1) return false;
      j++;
    }
    if (j < longName.length) insertions++;
    return insertions === 1;
  }
  function cityKey(s) {
    var k = norm(s).replace(/[.,،()\-–_]/g, ' ').replace(/\s+/g, ' ').trim();
    // الهفوف والمبرز تسميتان موضعيتان ضمن نطاق الأحساء؛ نجمعها للبحث والعد مع إبقاء اسم الفرع الأصلي.
    if (k === 'الاحساء' || k === 'الهفوف' || k === 'المبرز') return 'الاحساء';
    // اختلاف كتابة ضرما/ضرماء لا ينشئ مدينة ثانية؛ نعتمد اسم المدينة في دليل النطاق.
    if (k === norm('ضرما') || k === norm('ضرماء')) return norm('ضرماء');
    // فرع الأفلاج رقم 215 مسجل في ليلى؛ نوحد مفتاحي المدينة حتى تلتحق سجلات الأفلاج بالفرع.
    if (k === norm('الأفلاج') || k === norm('ليلى')) return norm('ليلى');
    // سبت العلايا وسبت العلاية تهجئتان للمدينة نفسها في ملفات المصادر.
    if (k === norm('سبت العلايا') || k === norm('سبت العلاية')) return norm('سبت العلاية');
    return k;
  }
  function cityLabel(s) {
    var key = cityKey(s);
    if (key === 'الاحساء') return 'الأحساء';
    if (key === norm('ضرماء')) return 'ضرماء';
    if (key === norm('ليلى')) return 'ليلى';
    if (key === norm('سبت العلاية')) return 'سبت العلاية';
    return s;
  }
  function sameCity(a, b) { return cityKey(a) === cityKey(b); }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function km(a, b, c, d) {
    if (![a,b,c,d].every(function (v) { return typeof v === 'number' && isFinite(v); }) || Math.abs(a) > 90 || Math.abs(c) > 90 || Math.abs(b) > 180 || Math.abs(d) > 180 || (a === 0 && b === 0) || (c === 0 && d === 0)) return null;
    var R = 6371, p1 = a * Math.PI / 180, p2 = c * Math.PI / 180, dp = (c - a) * Math.PI / 180, dl = (d - b) * Math.PI / 180;
    var h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function toast(msg) { var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2200); }
  function copy(text, ok) { try { navigator.clipboard.writeText(text).then(function () { toast(ok || 'تم النسخ'); }, function () { toast(text); }); } catch (e) { toast(text); } }
  function normalizeContactNumber(p) {
    var d = String(p || '').replace(/\D/g, '');
    if (d.indexOf('00966') === 0) d = d.slice(2);
    if (d.indexOf('966') === 0) return '0' + d.slice(3);
    return d;
  }
  function waMatchesPhone(o) {
    var m = String(o && o.wa || '').match(/wa\.me\/(?:\+)?(\d{8,15})/i);
    if (!m) return false;
    var target = normalizeContactNumber(m[1]);
    return (o.phones || []).some(function (p) { return normalizeContactNumber(p) === target; });
  }
  function telHref(p) { return 'tel:' + String(p || '').replace(/[^\d+]/g, ''); }
  function sar(n) { return '<span class="num">' + fmt(n) + '</span> ريال'; }

  var I = function (p, w) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var ICON = {
    phone: I('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
    wa: I('<path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4z"/><path d="M9 9.5c.3 2 2.5 4.2 4.6 4.6l1.1-1.1 1.8.9c-.2 1-1 1.7-2 1.7C11 15.6 8.4 13 8.4 9.5c0-1 .7-1.8 1.7-2l.9 1.8z"/>'),
    map: I('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
    web: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
    share: I('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>'),
    card: I('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14 10h4M14 13h3"/>'),
    projects: I('<path d="M4 21V9l8-5 8 5v12"/><path d="M9 21v-6h6v6M3 21h18"/>'),
    nhc: I('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
    companies: I('<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3"/>'),
    offices: I('<path d="M3 21h18M5 21V10l7-5 7 5v11"/><path d="M10 21v-5h4v5"/>'),
    cars: I('<path d="M5 16V11l2-4.5h10L19 11v5"/><path d="M3 16h18v2H3z"/><circle cx="7.5" cy="18.5" r="1.5"/><circle cx="16.5" cy="18.5" r="1.5"/>'),
    opps: I('<path d="M3 21h18M6 21V8l6-4 6 4v13"/><path d="M10 12h4M10 16h4"/>'),
    selfbuild: I('<path d="M3 21h18M4 17l4-4 3 3 5-6 4 4"/><circle cx="8" cy="7" r="2"/>'),
    nearby: I('<circle cx="12" cy="10" r="3"/><path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/>'),
    swap: I('<path d="M7 7h11l-3-3M17 17H6l3 3"/>'),
    search: I('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
    x: I('<path d="M6 6l12 12M18 6L6 18"/>', 2)
  };
  var MARK = '<svg class="mk" viewBox="0 0 40 40" aria-hidden="true"><rect x="2" y="2" width="17" height="36" rx="2" fill="#2b256c"/><rect x="21" y="2" width="17" height="17" rx="2" fill="#009c94"/></svg>';

  /* ---------------- boot ---------------- */
  function getJSON(path) {
    // Version query prevents a stale Pages/CDN copy of a corrected JSON file from breaking startup.
    var sep = path.indexOf('?') === -1 ? '?' : '&';
    return fetch(path + sep + 'v=20261010-3', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(path); return r.json(); });
  }
  var DECORATIVE_PROJECT_IMAGES = {
    P013: ['https://ruh-s3.bluvalt.com/api-nhc.sa/s3fs-public/2025-01/351x562_0.png', 'https://www.nhc.sa/ar/real-estate-development/projects/47490'],
    P369: ['https://ruh-s3.bluvalt.com/api-nhc.sa/s3fs-public/2025-01/Artboard%201%20copy%2021.png', 'https://nhc.sa/en/real-estate-development/communities/47502/'],
    P394: ['https://etmaam-public.almajdiah.com/site/gallery/xdgQ5Ias0OinoLLMgv5AxCJ9zAWX6Snr9P9vcsFf.jpg', 'https://almajdiah.com/projects/108'],
    P395: ['https://etmaam-public.almajdiah.com/site/gallery/PgHnQqWM0qFhXT3hQTA2OK6FfbLG07GPs3pxv900.jpg', 'https://almajdiah.com/projects/156'],
    P425: ['https://tamkean.sa/wp-content/uploads/2023/12/site-03-300x167.jpg', 'https://tamkean.sa/en/reem/'],
    P426: ['https://tilalre.com/wp-content/uploads/2025/11/Fursan1.png', 'https://tilalre.com/ar/'],
    P446: ['https://tilalre.com/wp-content/uploads/2025/11/Narjis1.png', 'https://tilalre.com/ar/'],
    P460: ['https://thabatre.sa/wp-content/uploads/2024/12/%D9%85%D8%A8%D8%A7%D8%B9-01.png', 'https://thabatre.sa/al-muhanadeya/'],
    P474: ['https://ruh-s3.bluvalt.com/api-nhc.sa/s3fs-public/styles/800x500/public/2024-11/RAWAA%20desktop.png?h=0c8c25d9&itok=M3TZx9FT', 'https://www.nhc.sa/en/real-estate-development/projects-page/'],
    P490: ['https://assets-diriyahco.diriyah.me/51401548b1074f73b701388154736c0b?format=webp&quality=80&transform=true&width=1920', 'https://www.diriyahcompany.sa/en/diriyah-living/our-residences/ritz-carlton'],
    P546: ['https://ruh-s3.bluvalt.com/api-nhc.sa/s3fs-public/2025-05/WEB-news-04.png', 'https://nhc.sa/media-center/news/47580/'],
    P585: ['https://ruh-s3.bluvalt.com/api-nhc.sa/s3fs-public/2025-07/W351%20x%20H562%20%D8%B5%D9%88%D8%B1%D8%A9%20%D8%B9%D8%B1%D8%B6%20%D9%84%D9%84%D8%AC%D9%88%D8%A7%D9%84.png', 'https://www.nhc.sa/ar/real-estate-development/projects/47614']
  };
  function boot() {
    var cfgEl = document.getElementById('site-config');
    var cfgP = cfgEl ? Promise.resolve(JSON.parse(cfgEl.textContent)) : getJSON('config/site.json').catch(function () { return {}; });
    cfgP.then(function (c) {
      Object.keys(c || {}).forEach(function (k) { CFG[k] = c[k]; });
      CFG.pageSize = 12; // تصميم القائمة المعتمد: 12 نتيجة ثم 12 إضافية في الصفحة نفسها.
      renderHeader();
      return Promise.all(['meta', 'branches', 'projects', 'nhc', 'offices', 'cars', 'office_links', 'companies', 'dealers', 'city_strategy', 'opportunities', 'selfbuild']
        .map(function (n) {
          // نسخة الملف الواحد: البيانات مضمّنة في الصفحة (window.ROG_DATA) فلا تحتاج خادماً
          if (window.ROG_DATA && window.ROG_DATA[n]) { D[n] = window.ROG_DATA[n]; return Promise.resolve(); }
          return getJSON(CFG.dataBase + n + '.json').then(function (v) { D[n] = v; });
        }));
    }).then(function () {
      D.projects.forEach(function (p) {
        var image = DECORATIVE_PROJECT_IMAGES[p.id];
        if (!image) return;
        if (!p.img) { p.img = image[0]; if (!p.imageSourceUrl) p.imageSourceUrl = image[1]; }
      });
      D.offices.forEach(function (o) {
        if (o.id !== 'national-ejar-office-195881') return;
        o.phones = [];
        delete o.phoneSource;
        o.phoneVerificationStatus = 'unverified';
      });
      D.officeById = {}; D.offices.forEach(function (o) { D.officeById[o.id] = o; });
      D.branchByCode = {}; D.branchCount = {}; D.branches.forEach(function (b) { D.branchByCode[b.c] = b; var bk = cityKey(b.city); D.branchCount[bk] = (D.branchCount[bk] || 0) + 1; });
      D.opps = D.opportunities || [];
      D.cars = dedupeCars((D.cars || []).filter(function (o) { return !o.duplicateOf; })).filter(function (o) { return !excludedCarReportRecord(o); });
      D.cityCount = {};
      ['projects', 'opps', 'nhc', 'selfbuild', 'companies', 'offices', 'cars', 'dealers'].forEach(function (k) {
        D.cityCount[k] = {}; D[k].forEach(function (o) {
          if (o.regionalListingOf && !sameCity(o.originCity || o.city, o.city)) return;
          var cityList = k === 'companies' && o.coverageCities && o.coverageCities.length ? o.coverageCities : [o.city], citySeen = {};
          cityList.forEach(function (city) {
            var ck = cityKey(city);
            if (citySeen[ck]) return;
            citySeen[ck] = true;
            if (k === 'companies') {
              D.companyCitySeen = D.companyCitySeen || {};
              var brand = companyKey(o.n), seenKey = ck + '|' + brand;
              if (D.companyCitySeen[seenKey]) return;
              D.companyCitySeen[seenKey] = true;
            }
            D.cityCount[k][ck] = (D.cityCount[k][ck] || 0) + 1;
          });
        });
      });
      var bootHash = /^#b([0-9A-Za-z]+)$/.exec(location.hash || '');
      if (bootHash && D.branchByCode[bootHash[1]]) selectBranch(bootHash[1], true);
      else renderStart();
      renderFooter();
    }).catch(function (e) {
      app.innerHTML = '<div class="loading">تعذّر تحميل البيانات. شغّل الموقع عبر خادم ويب.<br><small>' + esc(e.message) + '</small></div>';
    });
  }

  function renderHeader() {
    document.title = 'دليل الفرص';
    var logo = CFG.logo ? '<img class="brand-logo" src="' + esc(CFG.logo) + '" alt="بنك الرياض">' : '';
    document.getElementById('site-head').innerHTML = '<div class="head-main wrap"><a class="brand" href="#" data-act="home" aria-label="العودة لاختيار الفرع">' + logo + '</a><div class="head-title"><div class="brand-name">دليل الفرص</div><div class="tagline">التنفيــذ … النتائــج … الأثــر</div></div></div>';
  }
  function renderFooter() {
    document.getElementById('site-foot').innerHTML = '<div class="wrap"><strong class="footer-credit">إعداد: خالد الماطر</strong><span class="footer-updated">' + esc(CFG.updatedLabel) + ': <span class="num">' + esc((D.meta && D.meta.built) || '') + '</span></span></div>';
  }

  /* ---------------- start ---------------- */
  function cities() {
    var seen = {}, out = [];
    function add(city) { var k = cityKey(city); if (!seen[k]) { seen[k] = 1; out.push(cityLabel(city)); } }
    D.branches.forEach(function (b) { add(b.city); });
    // المدينة خيار تصفح وطني؛ أدرج كل فئات الدليل وتغطيات الشركات متعددة المدن.
    ['projects', 'opps', 'nhc', 'selfbuild', 'companies', 'offices', 'cars'].forEach(function (kind) {
      (D[kind] || []).forEach(function (o) {
        add(o.city);
        (o.coverageCities || []).forEach(add);
      });
    });
    return out.sort(function (a, b) { return a.localeCompare(b, 'ar'); });
  }
  // User-supplied Riyad Bank facade. Source JPEG stays unchanged; viewBox excludes phone UI.
  var ENTRY_TOWER_ASSET = 'assets/images/entry-riyad-bank.jpeg';
  function renderStart() {
    S = fresh();
    app.innerHTML = '<section class="start"><div class="entry-shell wrap"><div class="entry-visual has-tower">' + (ENTRY_TOWER_ASSET ? '<svg class="entry-tower-photo" viewBox="0 307 710 945" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><image href="' + esc(ENTRY_TOWER_ASSET) + '" x="0" y="0" width="710" height="1536" onload="this.dataset.loaded=1"></image></svg>' : '') + '<div class="entry-copy"><h1>فرص أقرب.<br>إنجاز أكبر.</h1><p>ابدأ من فرعك.</p></div></div><div class="start-card">' +
      '<div class="entry-form-heading"><h2>اختر مدينتك وفرعك</h2><p>فرص واضحة … وصول أسرع</p></div>' +
      '<div class="field"><label for="q-emp">اسم الموظف <small>(اختياري)</small></label><input id="q-emp" class="input" type="text" autocomplete="name" placeholder="اسم الموظف" value="' + esc(S.employee) + '"></div>' +
      '<p id="greet" class="greet start-greet" role="status" aria-live="polite" hidden></p>' +
      '<div class="field"><label for="q-branch">رمز الفرع أو اسمه</label><input id="q-branch" class="input" type="search" autocomplete="off" placeholder="مثال: 243 أو القادسية"></div>' +
      '<div class="field"><label for="q-city">المدينة <small>(اختيارية)</small></label><select id="q-city" class="select"><option value="">كل المدن</option>' +
      cities().map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select></div>' +
      '<div class="branch-list" id="branch-list" role="list"></div>' +
      '<button id="go-branch" class="btn primary go-branch" type="button" disabled>دخول <span aria-hidden="true">←</span></button>' +
      '<button id="use-location" class="btn geo-btn">' + ICON.nearby + 'استخدم موقعي — أقرب فرع</button>' +
      '</div></div></section>';
    var qb = document.getElementById('q-branch'), qc = document.getElementById('q-city'), qe = document.getElementById('q-emp'), go = document.getElementById('go-branch');
    document.getElementById('use-location').addEventListener('click', function (e) {
      var button = e.currentTarget;
      if (!navigator.geolocation) { toast('خدمة تحديد الموقع غير متاحة في هذا المتصفح'); return; }
      button.disabled = true; button.textContent = 'جارٍ تحديد الموقع…';
      navigator.geolocation.getCurrentPosition(function (pos) {
        var origin = { lat: pos.coords.latitude, lon: pos.coords.longitude }, nearest = nearestBranch(origin);
        if (!nearest) { button.disabled = false; button.textContent = 'استخدم موقعي — أقرب فرع'; toast('تعذّر العثور على فرع بإحداثيات مؤكدة'); return; }
        selectBranch(nearest.c, false, origin);
      }, function () { button.disabled = false; button.textContent = 'استخدم موقعي — أقرب فرع'; toast('تعذّر تحديد موقعك. يمكنك اختيار الفرع يدويًا.'); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    });
    var selectedCode = '';
    function list() {
      var raw = qb.value.trim(), q = norm(raw), city = qc.value, cityQuery = !!q && D.branches.some(function (b) { return sameCity(b.city, raw); });
      qb.disabled = false;
      if (!city && !q) { selectedCode = ''; go.disabled = true; document.getElementById('branch-list').innerHTML = ''; return; }
      var items = D.branches.filter(function (b) {
        if (city && !sameCity(b.city, city)) return false;
        if (!q) return true;
        if (cityQuery) return sameCity(b.city, raw);
        return (b.codeStatus !== 'local_internal_reference' && String(b.c).indexOf(raw) >= 0) || norm(b.n).indexOf(q) >= 0 || sameCity(b.city, raw) || norm(b.city).indexOf(q) >= 0 || (b.nb && norm(b.nb).indexOf(q) >= 0);
      });
      var exact = D.branchByCode[raw];
      selectedCode = exact && exact.codeStatus !== 'local_internal_reference' && (!city || sameCity(exact.city, city)) ? exact.c : '';
      var shown = items.slice(0, 80);
      document.getElementById('branch-list').innerHTML = shown.map(function (b) {
        return '<button class="branch-item' + (selectedCode === b.c ? ' selected' : '') + '" type="button" role="listitem" aria-pressed="' + (selectedCode === b.c) + '" data-code="' + esc(b.c) + '"><span class="code num">' + (b.codeStatus === 'local_internal_reference' ? 'مرجع داخلي' : esc(b.c)) + '</span><span class="bn">' + esc(b.n) + '</span><span class="bc">' + esc(b.city) + (b.sec ? ' · ' + esc(b.sec) : '') + '</span></button>';
      }).join('') + (!shown.length ? '<p class="list-note">لا يوجد فرع مطابق</p>' : '');
      go.disabled = !selectedCode;
    }
    qb.addEventListener('input', list);
    qc.addEventListener('change', list);
    qb.addEventListener('keydown', function (e) { if (e.key === 'Enter' && selectedCode) selectBranch(selectedCode); });
    go.addEventListener('click', function () { if (selectedCode) selectBranch(selectedCode); });
    qe.addEventListener('input', function () { S.employee = qe.value.trim(); var g = document.getElementById('greet'); if (g) { g.textContent = employeeGreeting(S.employee); g.hidden = !S.employee; } });
    var greeting = document.getElementById('greet'); greeting.textContent = employeeGreeting(S.employee); greeting.hidden = !S.employee;
    document.getElementById('branch-list').addEventListener('click', function (e) {
      var b = e.target.closest('[data-code]'); if (!b) return;
      selectedCode = b.dataset.code; qb.value = selectedCode; list(); go.focus();
    });
    list();
    if (location.hash) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ } }
  }

  /* ---------------- branch & state ---------------- */
  // الفرع هو نقطة ترتيب النتائج. لا يُسقط حدّ مسافة ثابت الفرص البعيدة أو التي ينقصها دبوس.
  function selectBranch(code, fromBoot, origin) {
    var b = D.branchByCode[code]; if (!b) return;
    // تصفير كامل: لا يبقى أي اختيار أو نتيجة من الفرع السابق
    S = fresh(); S.branch = b; S.scope = (b.lat == null || b.lon == null) && sectorCity(b.city) && !b.sec ? 'city' : 'branch'; S.origin = origin || null;
    S.nearestBranchDistance = origin ? km(origin.lat, origin.lon, b.lat, b.lon) : null;
    store('rog.branch', b.c);
    try { if (location.hash !== '#b' + b.c) location.hash = 'b' + b.c; } catch (e) { /* ignore */ }
    var c = compute(); S.tab = PRIMARY_SECTIONS.filter(function (k) { return k !== 'nearby' && c[k].items.length; })[0] || 'opps';
    renderBranch(c);
    if (!fromBoot) window.scrollTo(0, 0);
  }
  function sectorCity(city) { return (D.meta.sectorCities || []).some(function (x) { return sameCity(x, city); }); }
  function soleBranch() { return (D.branchCount[cityKey(S.branch.city)] || 0) <= 1; }
  // قطاع العرض الحالي: الاستكشاف اليدوي إن وُجد، وإلا قطاع الفرع المعتمد. لا يغيّر أي منهما قيمة branch.sec
  function activeSector() { return S.scope === 'sector' && sectorCity(S.branch.city) ? (S.explore || '') : ''; }
  // Sector buttons are exclusive: choosing East must never activate North implicitly.
  // Shared showroom groups are handled separately by car-area routing.
  function selectedSectors(sec) {
    var selected = sec || S.explore || '';
    return selected ? [selected] : [];
  }
  function sectorsOf(o) { return o.sectors && o.sectors.length ? o.sectors : (o.sec ? [o.sec] : []); }
  // Destination service coverage is independent of the project's physical sector.
  function nhcCoverageSectors(o) { return Array.isArray(o.serviceSectors) ? o.serviceSectors : sectorsOf(o); }
  // Remove generic legal/activity words only; the remaining brand name is the city-level dedupe key.
  function companyKey(name) {
    var generic = { العقاريه: 1, العقاري: 1, للاستثمار: 1, الاستثمار: 1, للتطوير: 1, التطوير: 1, العمراني: 1,
      والعقاريه: 1, والعقاري: 1, والاستثمار: 1, والتطوير: 1, والعمراني: 1, وشركاؤه: 1, وشركائه: 1 };
    var tokens = norm(name).replace(/^(الشركه|شركه|مؤسسه|مكتب)\s*/, '').split(/\s+/)
      .filter(function (token) { return token && !generic[token]; });
    var compact = [];
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i] === 'و' && tokens[i + 1]) compact.push('و' + tokens[++i]);
      else compact.push(tokens[i]);
    }
    var key = compact.join(' ').trim();
    // Verified aliases in this dataset: Riyadh records share alhabibinv.com and
    // 920033157; only spelling/expanded family-name variants are collapsed.
    if (key === 'محمد الحبيب' || key === 'محمد عبدالعزيز الحبيب') return 'محمد الحبيب';
    return key;
  }
  function nearestBranch(origin) {
    var candidates = D.branches.map(function (b) { return { b: b, d: km(origin.lat, origin.lon, b.lat, b.lon) }; })
      .filter(function (x) { return x.d != null; }).sort(function (a, b) { return a.d - b.d; });
    return candidates.length ? candidates[0].b : null;
  }
  function dist(o) {
    // سجلات الحي تستخدم دبوس الحي وتظهر المسافة بعلامة تقريبية.
    var b = S.origin || S.branch; return b ? km(b.lat, b.lon, o.lat, o.lon) : null;
  }
  function byDist(a, b) {
    var ad = a.rankD === undefined ? a.d : a.rankD, bd = b.rankD === undefined ? b.d : b.rankD;
    if (ad == null && bd == null) return 0; if (ad == null) return 1; if (bd == null) return -1; return ad - bd;
  }
  function sectorAnchor(city, sec, origin) {
    var candidates = D.branches.filter(function (b) {
      return sameCity(b.city, city) && norm(b.sec || '') === norm(sec || '') && b.lat != null && b.lon != null;
    }).map(function (b) { return { b: b, d: origin ? km(origin.lat, origin.lon, b.lat, b.lon) : null }; });
    candidates.sort(function (a, b) {
      if (a.d == null && b.d == null) return String(a.b.c).localeCompare(String(b.b.c));
      if (a.d == null) return 1; if (b.d == null) return -1; return a.d - b.d;
    });
    return candidates.length ? candidates[0].b : null;
  }
  function distanceFromBranch(item, branch) {
    if (!item || !branch) return null;
    var route = item.branchRoadDistancesKm && Number(item.branchRoadDistancesKm[String(branch.c)]);
    if (isFinite(route) && route > 0) return route;
    return km(branch.lat, branch.lon, item.lat, item.lon);
  }
  function fallbackCompare(a, b, sec) {
    var nb = norm(S.branch && S.branch.nb), an = nb && norm(a.o.nb) === nb, bn = nb && norm(b.o.nb) === nb;
    if (an !== bn) return an ? -1 : 1;
    if (sec) {
      var as = sectorsOf(a.o).indexOf(sec) >= 0, bs = sectorsOf(b.o).indexOf(sec) >= 0;
      if (as !== bs) return as ? -1 : 1;
    }
    var branchSector = S.branch && S.branch.sec;
    if (branchSector) {
      var ac = sectorsOf(a.o).indexOf(branchSector) >= 0, bc = sectorsOf(b.o).indexOf(branchSector) >= 0;
      if (ac !== bc) return ac ? -1 : 1;
    }
    return 0;
  }
  var TIER = { full: 0, partial: 1, dev: 2, basic: 3 };
  var companyProjectCache = {};
  function nearScope() { return !!S.branch && (S.scope === 'branch' || S.scope === 'sector'); }
  var CITY_LEVEL = { nhc: 1, selfbuild: 1, companies: 1 };   // الوجهات والمخططات تخدم المدينة كلها
  var DAMMAM_NEIGHBOR_CITIES = [];
  function easternNeighborCity(city) { return DAMMAM_NEIGHBOR_CITIES.some(function (name) { return sameCity(name, city); }); }
  function isDammamBranch() { return !!S.branch && sameCity(S.branch.city, 'الدمام'); }
  // الفرع يحدد القطاع والنطاق في الرياض وجدة؛ بقية المدن تعرض فرص المدينة كاملة.
  function branchScopedKind(kind) {
    if (!S.branch || !kind || kind === 'nearby' || CITY_LEVEL[kind]) return false;
    return kind === 'offices' || sectorCity(S.branch.city);
  }
  function cityScopeAvailable(kind) { return !!S.branch && branchScopedKind(kind); }
  function radiusApplies(kind, scope) {
    scope = scope || S.scope;
    // Distance is opt-in, never the default definition of a branch catchment.
    return kind === 'offices' && scope === 'radius' && S.branch && typeof S.branch.lat === 'number' && isFinite(S.branch.lat) && typeof S.branch.lon === 'number' && isFinite(S.branch.lon);
  }
  function isTabuk() { return S.branch && sameCity(S.branch.city, 'تبوك'); }
  function documentedBranchCoverage(o) {
    var coverage = o.branchCoverage;
    return !!(coverage && validEvidence(coverage) && Array.isArray(coverage.branchCodes) && coverage.branchCodes.map(String).indexOf(String(S.branch.c)) >= 0);
  }
  function hasBranchCoverage(kind, sourceRows) {
    return isTabuk() && (sourceRows || (kind === 'opps' ? (D.opps || []).concat(D.projects || []) : D[kind]) || []).some(function (o) { return sameCity(o.city, S.branch.city) && documentedBranchCoverage(o); });
  }
  function excludedCarReportRecord(o) {
    // دليل المعارض يعرض المعارض المستقلة فقط؛ الشركات والوكالات وموزعو العلامات لهم أدلة أخرى.
    if (o && (o.pdfShowroomVerified === true || (o.city === 'الرياض' && (o.zone === 'shifa' || o.zone === 'qadisiyah')))) return false;
    return /(?:^|\s)(?:شركة|الشركة|مؤسسة)(?:\s|$)|وكالة|التوكيلات|محمد يوسف ناغي|عبد\s*اللطيف جميل|المجدوعي|شانجان|changan|جينيسيس|genesis|هيونداي|hyundai|تويوتا|toyota|كيا|kia|مازدا|mazda|شيري|chery|جيتور|jetour|دونغ\s*فينغ|dongfeng|موزع\s+جيلي/i.test(String(o && o.n || ''));
  }
  function dedupeCars(rows) {
    var groups = {}, keys = [];
    rows.forEach(function (o) { var phones = (o.phones || []).slice().filter(Boolean).sort().join(','); var place = [norm(o.nb), o.lat == null ? '' : String(o.lat), o.lon == null ? '' : String(o.lon), norm(o.maps || o.sales || o.mapsQ)].join('|'); var key = [cityKey(o.city), norm(o.n), phones, place].join('|'); if (!groups[key]) { groups[key] = []; keys.push(key); } groups[key].push(o); });
    return keys.map(function (key) {
      var list = groups[key].slice().sort(function (a, b) {
        function score(o) { return (o.web ? 4 : 0) + (o.maps ? 3 : 0) + (o.lat != null && o.lon != null ? 4 : 0) + (o.nb ? 1 : 0) + ((o.phones || []).length); }
        return score(b) - score(a);
      });
      var base = Object.assign({}, list[0]), phones = [];
      list.forEach(function (o) { (o.phones || []).forEach(function (p) { if (p && phones.indexOf(p) < 0) phones.push(p); }); });
      if (phones.length) base.phones = phones;
      return base;
    });
  }

  function cityCompanyRecords(city) {
    var groups = {};
    (D.companies || []).forEach(function (o) {
      if (requiresReview(o.commercialAuditStatus)) return;
      var local = sameCity(o.city, city);
      var covered = (o.coverageCities || []).some(function (c) { return sameCity(c, city); });
      if (!local && !covered) return;
      var key = companyKey(o.n);
      (groups[key] = groups[key] || { local: [], coverage: [] })[local ? 'local' : 'coverage'].push(o);
    });
    return Object.keys(groups).map(function (key) {
      var g = groups[key], rows = g.local;
      if (rows.length) {
        // Merge only records whose own city is the selected city. Never import local projects,
        // sectors, pins, maps or contacts from another covered city.
        rows.sort(function (a, b) { return companyRichness(b) - companyRichness(a); });
        var base = Object.assign({}, rows[0]);
        ['projects', 'phones'].forEach(function (field) {
          var vals = [];
          rows.forEach(function (r) { (r[field] || []).forEach(function (v) { if (v && vals.indexOf(v) < 0) vals.push(v); }); });
          if (vals.length) base[field] = vals;
        });
        var phoneOwners = {};
        rows.forEach(function (r) { (r.phones || []).forEach(function (p, i) {
          var owner = (r.phoneContacts || [])[i] || (i === 0 ? r.contact : '');
          if (owner && !phoneOwners[p]) phoneOwners[p] = owner;
        }); });
        if (Object.keys(phoneOwners).length) base.phoneContacts = (base.phones || []).map(function (p) { return phoneOwners[p] || ''; });
        var localSectors = [];
        rows.forEach(function (r) { sectorsOf(r).forEach(function (v) { if (v && localSectors.indexOf(v) < 0) localSectors.push(v); }); });
        if (localSectors.length) { base.sectors = localSectors; delete base.sec; }
        base.city = city;
        var coveredCities = [];
        g.local.concat(g.coverage).forEach(function (r) { (r.coverageCities || []).concat([r.city]).forEach(function (c) {
          if (c && !coveredCities.some(function (x) { return sameCity(x, c); })) coveredCities.push(c);
        }); });
        base.coverageCities = coveredCities;
        var explicitCityCoverage = g.local.concat(g.coverage).some(function (r) {
          return (r.coverageCities || []).some(function (c) { return sameCity(c, city); });
        });
        return { record: base, cityCovered: true, cityOnly: false, explicitCityCoverage: explicitCityCoverage, key: key };
      }
      // A central row can establish that the company serves this city, but its source-city
      // projects, sectors, map pin and personal contact are not copied into the target city.
      var central = g.coverage.slice().sort(function (a, b) { return companyRichness(b) - companyRichness(a); })[0];
      var sharedPhones = [];
      (D.companies || []).filter(function (r) { return companyKey(r.n) === key; }).forEach(function (r) {
        (r.phones || []).forEach(function (p) {
          var cityCount = (D.companies || []).filter(function (z) { return companyKey(z.n) === key && sameCity(z.city, city); }).length;
          if (cityCount && (D.companies || []).filter(function (z) { return companyKey(z.n) === key && (z.phones || []).indexOf(p) >= 0; }).length >= 2 && sharedPhones.indexOf(p) < 0) sharedPhones.push(p);
        });
      });
      var proxy = Object.assign({}, central, { city: city, coverageCities: [city], projects: [], sectors: [], sec: '', scope: 'تغطية موثقة على مستوى المدينة', phones: sharedPhones, contact: '', wa: '', maps: '', dsite: '', loc: '', lat: null, lon: null });
      delete proxy.nb;
      return { record: proxy, cityCovered: true, cityOnly: true, explicitCityCoverage: true, key: key };
    });
  }
  function companyRichness(o) {
    return ((o.projects || []).length * 4) + (sectorsOf(o).length * 3) + ((o.phones || []).length * 2) +
      ['site', 'maps', 'contact', 'scope', 'kind'].filter(function (k) { return !!o[k]; }).length;
  }
  function defaultCarArea(b) {
    if (!b || !sameCity(b.city, 'الرياض')) return '';
    var sec = norm(b.sec || '');
    if (sec.indexOf('غرب') >= 0 || sec.indexOf('جنوب') >= 0) return 'shifa';
    if (sec.indexOf('شرق') >= 0 || sec.indexOf('شمال') >= 0) return 'qadisiyah';
    // الفروع بلا قطاع معتمد تعرض الرياض كاملة؛ لا نستنتج جهتها من نقطة تقريبية.
    return 'all';
  }
  function carAreaOf(o) { return o && (o.zone === 'shifa' || o.zone === 'qadisiyah') ? o.zone : ''; }
  function carAreaSelected(area) {
    if (sameCity(S.branch && S.branch.city, 'الرياض') && S.scope === 'sector') {
      if (S.explore === 'وسط') return area === 'shifa' || area === 'qadisiyah';
      if (S.explore === 'شرق' || S.explore === 'شمال') return area === 'qadisiyah';
      if (S.explore === 'غرب' || S.explore === 'جنوب') return area === 'shifa';
    }
    var current = S.carArea || (S.scope === 'city' ? '' : defaultCarArea(S.branch));
    return area === 'all' ? (current === 'all' || !current) : current === area;
  }
  function requiresReview(value) { return String(value || '').trim().toUpperCase() === 'REVIEW_REQUIRED'; }
  function rawItems(kind, scope, sourceRows) {
    var b = S.branch, links = {}; scope = scope || S.scope;
    if (kind === 'offices') (D.office_links[b.c] || []).forEach(function (l) { links[l[0]] = l[1]; });
    if (kind === 'companies') {
      var companyEntries = cityCompanyRecords(b.city);
      // فروع الدمام تستوعب الشركات من المدن الشرقية المجاورة فقط بوجود دبوس فعلي داخل النطاق.
      if (scope === 'branch' && isDammamBranch()) DAMMAM_NEIGHBOR_CITIES.forEach(function (city) {
        (D.companies || []).filter(function (o) {
          if (!sameCity(o.city, city) || requiresReview(o.commercialAuditStatus) || o.lat == null || o.lon == null) return false;
          var companyDistance = dist(o), maxRadius = Number(S.radius || 15);
          return companyDistance != null && companyDistance <= maxRadius;
        }).forEach(function (o) {
          companyEntries.push({ record: o, cityCovered: true, cityOnly: false, explicitCityCoverage: false, key: companyKey(o.n) + '|' + cityKey(o.city) });
        });
      });
      return companyEntries.map(function (entry) {
      var o = entry.record, d = entry.cityOnly ? null : dist(o), rankD = d, source = 'coordinates';
      var linkedProjects = companyProjects(o, b);
      var linkedDistances = linkedProjects.map(function (p) { return dist(p); }).filter(function (x) { return x != null; }).sort(function (x, y) { return x - y; });
      if (d == null && linkedDistances.length) { rankD = linkedDistances[0]; source = 'linked-project'; }
      return { o: o, d: d, rankD: rankD, distanceSource: source, linkedProjects: linkedProjects, linkedDistances: linkedDistances,
        companyKey: entry.key, cityCovered: entry.cityCovered, cityOnly: entry.cityOnly, explicitCityCoverage: entry.explicitCityCoverage,
        easternCrossCity: isDammamBranch() && !sameCity(o.city, b.city) };
      });
    }
    return (sourceRows || D[kind] || []).filter(function (o) {
      var sameBranchCity = sameCity(o.city, b.city);
      var sourceCity = o.regionalListingOf ? (o.originCity || o.city) : o.city;
      if (o.regionalListingOf && !sameCity(sourceCity, b.city)) return false;
      var easternCrossCity = scope === 'branch' && !CITY_LEVEL[kind] && isDammamBranch() && easternNeighborCity(sourceCity);
      if (!sameBranchCity && !easternCrossCity) return false;
      if (easternCrossCity && o.lat == null && o.lon == null && links[o.id] == null && !(Number(o.branchRoadDistancesKm && o.branchRoadDistancesKm[String(b.c)]) > 0)) return false;
      // Keep the canonical showroom row for cross-city Eastern results; neighboring-city clones
      // share the same map pin and number and would otherwise be counted more than once.
      if (easternCrossCity && kind === 'cars' && o.regionalListingOf) return false;
      if (kind === 'cars' && o.authorizedDealer === true) return false;
      if (kind === 'cars' && requiresReview(o.activityReviewStatus)) return false;
      if (kind === 'offices' && o.activityReviewStatus === 'closed_permanently') return false;
      if (kind === 'selfbuild' && requiresReview(o.availabilityStatus)) return false;
      if (kind === 'cars' && sameCity(b.city, 'الرياض')) {
        var selectedSector = S.scope === 'sector' ? S.explore : '';
        var area = selectedSector === 'وسط' ? 'combined' :
          (selectedSector === 'شرق' || selectedSector === 'شمال' ? 'qadisiyah' :
          (selectedSector === 'غرب' || selectedSector === 'جنوب' ? 'shifa' :
          (S.carArea || (S.scope === 'city' ? 'all' : defaultCarArea(b)))));
        var zone = carAreaOf(o);
        if (area === 'combined') return zone === 'shifa' || zone === 'qadisiyah';
        if (area === 'all') return true;
        return zone === area;
      }
      return true;
    }).map(function (o) {
      var d = dist(o), rankD = d, source = 'coordinates';
      if ((kind === 'cars' || !sameCity(o.city, b.city)) && o.loc !== 'pt' && o.loc !== 'nb' && !(o.lat != null && o.lon != null)) { d = null; rankD = null; }
      var routeDistance = o.branchRoadDistancesKm && Number(o.branchRoadDistancesKm[String(b.c)]);
      if (isFinite(routeDistance) && routeDistance > 0) { d = routeDistance; rankD = routeDistance; source = 'google-maps-driving'; }
      if (d == null && links[o.id] != null) { d = links[o.id]; rankD = d; source = 'verified-office-link'; }
      return { o: o, d: d, rankD: rankD, distanceSource: source };
    });
  }
  // اربط الشركة بمشاريعها المسجلة في نفس المدينة؛ لا يُسمح لمطابقة اسم المطور وحدها بجلب مدينة أخرى.
  function companyProjects(o, b) {
    var cacheKey = (o.id || o.n) + '|' + cityKey(b.city);
    if (companyProjectCache[cacheKey]) return companyProjectCache[cacheKey];
    var names = (o.projects || []).map(norm), developer = devKey(o.n);
    companyProjectCache[cacheKey] = (D.projects || []).concat(D.opps || []).filter(function (p) {
      return (sameCity(p.city, b.city) || (isDammamBranch() && nearScope() && easternNeighborCity(p.city))) && ((developer && devKey(p.dev) === developer) || names.indexOf(norm(p.n)) >= 0);
    });
    return companyProjectCache[cacheKey];
  }
  function itemsFor(kind, sec, scope, sourceRows) {
    scope = scope || S.scope;
    if (scope === 'radius' && kind !== 'offices') scope = 'branch';
    // الشركات دليل المدينة؛ المكاتب تتبع المسافة ولا ترث اختيار قطاع من تبويب آخر.
    if (kind === 'companies') scope = 'city';
    if (scope !== 'city' && scope !== 'radius' && !sectorCity(S.branch.city) && (kind === 'companies' || !hasBranchCoverage(kind, sourceRows))) scope = 'city';
    if (kind === 'offices' && scope === 'radius' && !radiusApplies(kind, scope)) scope = 'city';
    var out = rawItems(kind, scope, sourceRows);
    if (kind !== 'companies' && isTabuk() && scope === 'branch') out = out.filter(function (x) { return documentedBranchCoverage(x.o); });
    if (kind === 'companies') out = out.map(function (x) {
      return Object.assign({}, x, { rankD: x.d, displayD: x.d, serviceMatch: x.d == null });
    });
    // سجلات بلا موقع تبقى ضمن النتائج بلا مسافة؛ النطاق يرشح المواقع المعروفة فقط.
    if (radiusApplies(kind, scope)) {
      var radius = Number(S.radius || 15);
      var regionalRiyadhCars = kind === 'cars' && sameCity(S.branch.city, 'الرياض');
      if (kind === 'companies') {
        var targetSector = scope === 'sector' ? (sec || S.explore || S.branch.sec) : S.branch.sec;
        out = out.map(function (x) {
          var officeNear = x.d != null && x.d <= radius;
          var companySector = !!targetSector && sectorsOf(x.o).indexOf(targetSector) >= 0;
          var projectSector = !!targetSector && x.linkedProjects.some(function (p) { return sectorsOf(p).indexOf(targetSector) >= 0; });
          var projectNear = x.linkedDistances.some(function (d) { return d <= radius; });
          var cityCoverage = !x.easternCrossCity && (x.cityOnly || x.explicitCityCoverage || (!sectorsOf(x.o).length && x.linkedProjects.length > 0));
          var serviceMatch = !officeNear && (cityCoverage || companySector || projectSector || projectNear);
          if (x.easternCrossCity) serviceMatch = !officeNear && projectNear;
          return Object.assign({}, x, { serviceMatch: serviceMatch, displayD: officeNear ? x.d : null,
            coverageMatchReason: cityCoverage ? 'city-coverage' : companySector ? 'company-sector' : projectSector ? 'project-sector' : projectNear ? 'project-radius' : '' });
        }).filter(function (x) { return x.d == null || x.d <= radius || x.serviceMatch; });
      } else if (!regionalRiyadhCars) out = out.filter(function (x) {
        if (x.rankD != null) return x.rankD <= radius;
        // Projects without a verified location stay available in city view,
        // but cannot be represented as inside a branch radius.
        return kind !== 'projects' && kind !== 'opps' && kind !== 'offices';
      });
    }
    // نطاق الفرع الذي لا يملك دبوسًا يعتمد الحي المطابق، ثم القطاع عند غياب الحي.
    if (scope === 'branch' && S.branch.lat == null && S.branch.lon == null && branchScopedKind(kind) && kind !== 'projects' && kind !== 'opps' && kind !== 'offices' && !(kind === 'cars' && sameCity(S.branch.city, 'الرياض'))) {
      var branchNb = norm(S.branch.nb || ''), branchSec = S.branch.sec || '';
      var hasNeighborhoodMatch = branchNb && out.some(function (x) { return norm(x.o.nb || '') === branchNb; });
      out = out.filter(function (x) {
        var exactNeighborhood = branchNb && norm(x.o.nb || '') === branchNb;
        var sameSector = branchSec && sectorsOf(x.o).indexOf(branchSec) >= 0;
        if (kind === 'companies') sameSector = sameSector || x.linkedProjects.some(function (p) { return sectorsOf(p).indexOf(branchSec) >= 0; });
        return hasNeighborhoodMatch ? exactNeighborhood : sameSector;
      });
    }
    // نطاق فرع المدن الكبرى يقتصر على قطاع الفرع؛ لا يخلط مشاريع الشمال أو الوسط بنتائج فرع الشرق.
    if ((scope === 'branch' || (scope === 'radius' && kind === 'offices')) && sectorCity(S.branch.city) && S.branch.sec && (kind === 'projects' || kind === 'opps' || kind === 'offices' || (kind === 'cars' && !sameCity(S.branch.city, 'الرياض')))) {
      if (isDammamBranch()) out = out.filter(function (x) { if (easternNeighborCity(x.o.city)) return true; var sectors = sectorsOf(x.o); return !sectors.length || sectors.indexOf(S.branch.sec) >= 0; });
      else
      out = out.filter(function (x) { var sectors = sectorsOf(x.o); return sectors.indexOf(S.branch.sec) >= 0; });
    } else if (scope === 'branch' && sectorCity(S.branch.city) && S.branch.sec && kind === 'nhc') {
      out = out.filter(function (x) { return nhcCoverageSectors(x.o).indexOf(S.branch.sec) >= 0; });
    }
    // اختيار القطاع نطاق كامل مستقل؛ لا يطبق عليه نصف قطر الفرع.
    if (scope === 'sector' && sectorCity(S.branch.city) && (sec || S.explore)) {
      var selectedSector = sec || S.explore;
      var selectedSet = selectedSectors(selectedSector);
      if (kind === 'companies') {
        out = out.filter(function (x) { return x.cityOnly || x.explicitCityCoverage || sectorsOf(x.o).some(function (s) { return selectedSet.indexOf(s) >= 0; }) || x.linkedProjects.some(function (p) { return sectorsOf(p).some(function (s) { return selectedSet.indexOf(s) >= 0; }); }); });
      } else if (kind !== 'selfbuild' && !(kind === 'cars' && sameCity(S.branch.city, 'الرياض'))) {
        out = out.filter(function (x) { return (kind === 'nhc' ? nhcCoverageSectors(x.o) : sectorsOf(x.o)).some(function (s) { return selectedSet.indexOf(s) >= 0; }); });
      }
      var anchors = {};
      selectedSet.forEach(function (s) { anchors[s] = sectorAnchor(S.branch.city, s, S.origin || S.branch); });
      if (selectedSet.some(function (s) { return !!anchors[s]; })) {
        out = out.map(function (x) {
          var itemSector = sectorsOf(x.o).filter(function (s) { return selectedSet.indexOf(s) >= 0; })[0] || selectedSector;
          var anchor = anchors[itemSector] || anchors[selectedSector];
          if (!anchor) return x;
          var d = distanceFromBranch(x.o, anchor);
          if (kind === 'cars' && x.o.loc !== 'pt' && x.o.loc !== 'nb') d = null;
          if (kind === 'companies') {
            var linked = (x.linkedProjects || []).map(function (p) { return distanceFromBranch(p, anchor); }).filter(function (v) { return v != null; }).sort(function (a, b) { return a - b; });
            return Object.assign({}, x, { d: x.cityOnly ? null : d, rankD: x.cityOnly ? null : (d == null && linked.length ? linked[0] : d),
              linkedDistances: linked, distanceSource: d == null && linked.length ? 'linked-project' : 'sector-branch' });
          }
          return Object.assign({}, x, { d: d, rankD: d, distanceSource: 'sector-branch' });
        });
      }
    }
    if (kind === 'projects' || kind === 'opps') {
      out.sort(function (x, y) { return byDist(x, y) || fallbackCompare(x, y, sec) || (!!y.o.img - !!x.o.img) || (!!y.o.price - !!x.o.price) || ((TIER[x.o.tier] || 0) - (TIER[y.o.tier] || 0)) || x.o.n.localeCompare(y.o.n, 'ar'); });
    } else out.sort(function (x, y) {
      if (kind === 'companies') return x.o.n.localeCompare(y.o.n, 'ar');
      if (kind === 'cars' && sec === 'وسط' && sameCity(S.branch.city, 'الرياض')) {
        var zx = carAreaOf(x.o) === 'shifa' ? 0 : 1, zy = carAreaOf(y.o) === 'shifa' ? 0 : 1;
        if (zx !== zy) return zx - zy;
      }
      return byDist(x, y) || fallbackCompare(x, y, sec) || x.o.n.localeCompare(y.o.n, 'ar');
    });
    return out;
  }
  function unlocatedItemsFor(kind) {
    return [];
  }
  function xName(a, b) { return String(a.o.n || '').localeCompare(String(b.o.n || ''), 'ar'); }
  function devKey(s) { return norm(String(s || '').replace(/^(الشركة|شركة|مؤسسة)\s+/, '').replace(/\s*\(.*?\)\s*/g, '')); }
  function nearbyInfo() {
    var g = D.city_strategy[S.branch.city] || Object.keys(D.city_strategy).map(function (k) { return { key: k, value: D.city_strategy[k] }; }).filter(function (x) { return sameCity(x.key, S.branch.city); })[0];
    if (g && g.value) g = g.value;
    if (!g || !g.support || g.support === S.branch.city || sectorCity(S.branch.city)) return null;
    var th = NEARBY_MODE[g.mode]; if (!th) return null;
    var need = {};
    ['projects', 'nhc', 'offices', 'cars'].forEach(function (k) {
      var local = (D.cityCount[k] || {})[cityKey(S.branch.city)] || 0, there = ((D.cityCount[k] || {})[cityKey(g.support)] || 0) + (k === 'projects' ? ((D.cityCount.opps || {})[cityKey(g.support)] || 0) : 0);
      if (local < ((k === 'projects' || k === 'nhc') ? 1 : th) && there > 0) need[k] = true;
    });
    return Object.keys(need).length ? { support: g.support, km: g.km, need: need } : null;
  }
  function nearbyItems() {
    var g = nearbyInfo(); if (!g) return [];
    var c = g.support, out = [];
    function pts(src) { return src.filter(function (o) {
      if (src === D.cars && requiresReview(o.activityReviewStatus)) return false;
      if (sameCity(o.city, c)) return true;
      return src === D.cars && (o.serviceCities || []).some(function (city) { return sameCity(city, S.branch.city); });
    }).map(function (o) { return { o: o, d: src === D.cars && o.loc !== 'pt' && o.loc !== 'nb' ? null : dist(o) }; })
      .filter(function (x) { return x.d != null && x.d <= Number(S.radius || 15); }).sort(byDist); }
    if (g.need.nhc) pts(D.nhc).forEach(function (x) { out.push({ k: 'nhc', o: x.o, d: x.d }); });
    if (g.need.projects) pts(D.projects).slice(0, 8).forEach(function (x) { out.push({ k: 'projects', o: x.o, d: x.d }); });
    if (g.need.projects) pts(D.opps).slice(0, 8).forEach(function (x) { out.push({ k: 'opps', o: x.o, d: x.d }); });
    if (g.need.offices) pts(D.offices).slice(0, 8).forEach(function (x) { out.push({ k: 'offices', o: x.o, d: x.d }); });
    if (g.need.cars) {
      var localCarIds = {}, seenCarIds = {};
      rawItems('cars', 'city').forEach(function (x) { localCarIds[x.o.id] = true; });
      pts(D.cars).filter(function (x) {
        var id = x.o.id;
        if (localCarIds[id] || seenCarIds[id]) return false;
        seenCarIds[id] = true; return true;
      }).slice(0, 8).forEach(function (x) { out.push({ k: 'cars', o: x.o, d: x.d }); });
    }
    return out;
  }
  function validEvidence(evidence) {
    return !!(evidence && String(evidence.source || '').trim() && evidence.checkedAt && !isNaN(Date.parse(evidence.checkedAt)));
  }
  // Bank approval is a separate, confirmed inventory, never a market-guide inference.
  function bankApprovalPending() {
    var catalog = D.meta && D.meta.bankApprovalCatalog;
    return !(catalog && catalog.status === 'verified' && validEvidence(catalog));
  }
  function approvalIdentityVerified(o) {
    var approval = o.bankApproval || {}, collision = approval.sourceCodeCollision;
    if (!collision || !collision.detected) return true;
    var identity = approval.sourceIdentity || {};
    if (collision.resolution !== 'separate_composite_identities_verified' || Number(approval.sourcePage) <= 0 || Number(approval.sourceRow) <= 0 || !approval.sourcePage || !approval.sourceRow) return false;
    function matches(subject) { return identity.name === subject.n && identity.developer === subject.dev && identity.city === subject.city; }
    if (matches(o)) return true;
    // A proven canonical alias may use another display label. Validate the original
    // bank inventory row, not a fuzzy label and never another row sharing its code.
    return (D.projects || []).some(function (subject) {
      var sameIdentity = (o.id && subject.id === o.id) || (o.canonicalProjectId && subject.canonicalProjectId === o.canonicalProjectId);
      var source = subject.bankApproval || {};
      return sameIdentity && matches(subject) && source.sourceType === 'bank_approved_inventory' &&
        source.code === approval.code && source.source === approval.source &&
        source.sourcePage === approval.sourcePage && source.sourceRow === approval.sourceRow;
    });
  }
  function displayEligible(kind, o) {
    if (kind === 'projects') return !bankApprovalPending() && approvalIdentityVerified(o) && !!(o.availability && o.availability.status === 'available' && validEvidence(o.availability)) && !!(o.bankApproval && o.bankApproval.status === 'verified' && o.bankApproval.sourceType === 'bank_approved_inventory' && String(o.bankApproval.code || '').trim() && validEvidence(o.bankApproval));
    if (kind === 'opps') return !!(o.availability && o.availability.status === 'available' && validEvidence(o.availability));
    return true;
  }
  function canonicalProjectItems(candidates) {
    var keys = {}, output = [];
    candidates.forEach(function (x) {
      var key = x.o.canonicalProjectId ? 'canonical:' + x.o.canonicalProjectId : x.o.id ? 'id:' + x.o.id : '';
      if (!key || keys[key] === undefined) { if (key) keys[key] = output.length; output.push(Object.assign({}, x, { hasProjectSource: x.k === 'projects' || x.hasProjectSource })); return; }
      var index = keys[key], prior = output[index];
      var oldDate = Date.parse((prior.o.availability || {}).checkedAt) || 0, newDate = Date.parse((x.o.availability || {}).checkedAt) || 0;
      // A documented newer unknown/closed state must not revive an older sale.
      var chooseNew = newDate > oldDate || (newDate === oldDate && (prior.o.availability || {}).status === 'available' && (x.o.availability || {}).status !== 'available');
      var chosen = chooseNew ? x : prior, other = chooseNew ? prior : x;
      var approval = chosen.o.bankApproval, otherApproval = other.o.bankApproval;
      if (otherApproval && (!approval || (Date.parse(otherApproval.checkedAt) || 0) > (Date.parse(approval.checkedAt) || 0))) approval = otherApproval;
      // Merge approval evidence only after an explicit identity match, never by names or URLs.
      output[index] = Object.assign({}, chosen, { hasProjectSource: prior.hasProjectSource || x.k === 'projects' || x.hasProjectSource, o: approval && approval !== chosen.o.bankApproval ? Object.assign({}, chosen.o, { bankApproval: approval }) : chosen.o });
    });
    return output;
  }
  function allCanonicalProjects() {
    return canonicalProjectItems((D.opps || []).map(function (o) { return { k: 'opps', o: o }; })
      .concat((D.projects || []).map(function (o) { return { k: 'projects', o: o }; })));
  }
  function scopedProjectItems(kind, sec, scope, include, resolvedRows) {
    // Resolve latest identity evidence globally BEFORE geography. A later unknown/sold-out
    // copy in another scope must never resurrect an older advertised sale.
    var resolved = (resolvedRows || allCanonicalProjects()).filter(function (x) { return (kind !== 'projects' || x.hasProjectSource) && include(x.o); });
    var output = [];
    ['opps', 'projects'].forEach(function (sourceKind) {
      var rows = resolved.filter(function (x) { return x.k === sourceKind; }).map(function (x) { return x.o; });
      output = output.concat(itemsFor(sourceKind, sec, scope, rows).map(function (x) { return Object.assign({}, x, { k: sourceKind }); }));
    });
    return output.sort(byDist);
  }
  function visibleItemsFor(kind, sec, scope, resolvedRows) {
    if (kind !== 'opps' && kind !== 'projects') return itemsFor(kind, sec, scope);
    return scopedProjectItems(kind, sec, scope, function (o) { return displayEligible(kind, o); }, resolvedRows);
  }
  function verificationPending(kind, o) {
    if (kind !== 'projects' && kind !== 'opps') return false;
    // Known non-sale states are not a verification queue. Unknown records never
    // enter the public confirmed list or increase its count.
    var status = o.availability && o.availability.status;
    if (['sold_out', 'unavailable', 'interest_only'].indexOf(status) >= 0) return false;
    var approval = o.bankApproval || {};
    if (kind === 'projects' && ['rejected', 'not_approved', 'revoked'].indexOf(approval.status) >= 0) return false;
    return !displayEligible(kind, o);
  }
  function pendingItemsFor(kind, sec, scope, resolvedRows) {
    if (kind === 'selfbuild') return (D.selfbuild || []).filter(function (o) { return sameCity(o.city, S.branch.city) && requiresReview(o.availabilityStatus); }).map(function (o) { return { k: kind, o: o, d: dist(o) }; });
    if (kind !== 'projects' && kind !== 'opps') return [];
    return scopedProjectItems(kind, sec, scope, function (o) { return verificationPending(kind, o); }, resolvedRows);
  }
  function pendingLabel(kind) {
    return kind === 'projects' && bankApprovalPending() ? 'بانتظار قائمة المشاريع المعتمدة' : 'جارٍ التحقق من الفرص في هذا النطاق';
  }
  // كل الأرقام والقوائم تُحسب من جديد في كل عرض — لا تخزين مؤقت بين الفروع
  function compute() {
    var sec = activeSector(), out = {}, resolvedRows = allCanonicalProjects();
    SECTIONS.forEach(function (k) {
      if (k === 'nearby') { var n = nearbyItems(); out[k] = { items: n, total: n.length }; return; }
      out[k] = { items: visibleItemsFor(k, sec, null, resolvedRows), total: visibleItemsFor(k, sec, 'city', resolvedRows).length, pending: pendingItemsFor(k, sec, null, resolvedRows) };
    });
    return out;
  }
  window.__rogQA = function () {
    var c = compute(), o = { branch: S.branch && S.branch.c, branchSec: S.branch && S.branch.sec, scope: S.scope, explore: S.explore, active: activeSector(), sections: {}, pendingCounts: {}, bankApprovalPending: bankApprovalPending(), releaseCounts: { approved: bankApprovalPending() ? null : c.projects.items.length, available: c.opps.items.length } };
    SECTIONS.forEach(function (k) { o.sections[k] = c[k].items.map(function (x) { return x.o.id || x.o.n; }); o.pendingCounts[k] = (c[k].pending || []).length; });
    return o;
  };
  /* ---------------- branch page ---------------- */
  // Archived photos retain their attribution/license files, but are not automatically displayed.
  var CITY_IMAGE_ARCHIVE = {
    "الرياض": {
        "src": "assets/images/cities/riyadh.webp",
        "position": "50% 58%",
        "real": true
    },
    "أبها": {
        "src": "assets/images/cities/abha.webp",
        "position": "50% 52%",
        "real": true
    },
    "بريدة": {
        "src": "assets/images/cities/buraidah-road.webp",
        "position": "50% 52%",
        "real": true
    },
    "عنيزة": {
        "src": "assets/images/cities/unaizah-ringroad.webp",
        "position": "50% 58%",
        "real": true
    },
    "جدة": {
        "src": "assets/images/cities/jeddah.webp",
        "position": "50% 75%",
        "real": true
    },
    "الدمام": {
        "src": "assets/images/cities/dammam.webp",
        "position": "50% 64%",
        "real": true
    },
    "الخبر": {
        "src": "assets/images/cities/khobar.webp",
        "position": "50% 52%",
        "real": true
    },
    "المدينة المنورة": {
        "src": "assets/images/cities/madinah.webp",
        "position": "50% 45%",
        "real": true
    },
    "مكة المكرمة": {
        "src": "assets/images/cities/makkah.webp",
        "position": "50% 52%",
        "real": true
    },
    "الطائف": {
        "src": "assets/images/cities/taif.webp",
        "position": "50% 40%",
        "real": true
    },
    "تبوك": {
        "src": "assets/images/cities/tabuk.webp",
        "position": "58% 50%",
        "real": true
    },
    "حائل": {
        "src": "assets/images/cities/hail.webp",
        "position": "70% 35%",
        "real": true
    }
};
  // Only sources cleared for this caption-free interface are renderable.
  var CITY_HERO_ASSETS = {
    'الرياض': { src: ENTRY_TOWER_ASSET, viewBox: '0 780 710 250', real: true, displayPermission: 'user_supplied' },
    'أبها': Object.assign({}, CITY_IMAGE_ARCHIVE['أبها'], { displayPermission: 'CC0' }),
    'مكة المكرمة': Object.assign({}, CITY_IMAGE_ARCHIVE['مكة المكرمة'], { displayPermission: 'CC0' }),
    'المدينة المنورة': { src: 'assets/images/cities/madinah-panorama.webp', position: '50% 45%', real: true, displayPermission: 'public_domain' }
  };
  function cityHeroMedia(hero) {
    if (hero.viewBox) return '<svg class="city-photo" viewBox="' + esc(hero.viewBox) + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><image href="' + esc(hero.src) + '" width="710" height="1536" onload="this.dataset.loaded=1"></image></svg>';
    return '<img src="' + esc(hero.src) + '" alt="" decoding="async" style="object-position:' + hero.position + '" onerror="if(!this.dataset.fallback){this.dataset.fallback=1;this.src=\'' + CITY_HERO_FALLBACK + '\'}else{this.hidden=true}">';
  }
  var CITY_HERO_FALLBACK = 'assets/images/city-neutral.webp';
  function scopeOptions() {
    var b = S.branch, k = S.tab, sc = sectorCity(b.city), options = [], selected = 'city';
    if (k === 'cars' && sameCity(b.city, 'الرياض')) {
      var sector = activeSector();
      var first = sector ? (['شرق','شمال'].indexOf(sector) >= 0 ? 'qadisiyah' : 'shifa') : defaultCarArea(b) === 'shifa' ? 'shifa' : 'qadisiyah';
      if (sector === 'وسط') options.push(['combined', 'القادسية والشفا']);
      [first, first === 'shifa' ? 'qadisiyah' : 'shifa', 'all'].forEach(function (area) {
        options.push([area, area === 'all' ? 'كل معارض الرياض' : 'معارض ' + (area === 'shifa' ? 'الشفا' : 'القادسية')]);
      });
      selected = S.carArea || (S.scope === 'city' ? 'all' : defaultCarArea(b));
      if (S.scope === 'sector') selected = ['شرق','شمال'].indexOf(S.explore) >= 0 ? 'qadisiyah' : ['جنوب','غرب'].indexOf(S.explore) >= 0 ? 'shifa' : 'combined';
    } else if (k === 'companies' || k === 'selfbuild' || (!sc && !hasBranchCoverage(k) && k !== 'offices')) {
      options.push(['city', 'كل ' + b.city]);
    } else {
      if (sc && b.sec) options.push(['branch', k === 'nhc' ? 'وجهات نطاق الفرع' : 'قطاع الفرع · ' + b.sec + ' ' + b.city]);
      if (!sc && hasBranchCoverage(k)) options.push(['branch', 'نطاق الفرع الموثق']);
      if (sc) SECTORS.forEach(function (sec) { options.push(['sector:' + sec, sec + ' ' + b.city]); });
      options.push(['city', 'كل ' + b.city]);
      if (k === 'offices' && b.lat != null && b.lon != null && !isTabuk()) options.push(['radius', 'حسب المسافة (اختياري)']);
      selected = S.scope === 'sector' ? 'sector:' + S.explore : S.scope;
      if (!options.some(function (o) { return o[0] === selected; })) selected = 'city';
    }
    return '<label class="scope-field" for="scope-select"><span>' + (k === 'cars' && sameCity(b.city, 'الرياض') ? 'نطاق المعارض' : 'النطاق الجغرافي') + '</span><select class="select" id="scope-select"' + (options.length === 1 ? ' disabled' : '') + '>' + options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === selected ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>';
  }
  function renderBranch(pre) {
    if (S.scope !== 'city' && S.scope !== 'radius' && !sectorCity(S.branch.city) && (S.tab === 'companies' || !hasBranchCoverage(S.tab))) { S.scope = 'city'; S.explore = ''; pre = null; }
    if (PRIMARY_SECTIONS.indexOf(S.tab) < 0 && S.tab !== 'selfbuild') S.tab = 'opps';
    if (S.tab === 'selfbuild') { S.scope = 'city'; S.explore = ''; }
    var b = S.branch, c = pre || compute();
    var stats = PRIMARY_SECTIONS.map(function (k) {
      var pending = (k === 'projects' && bankApprovalPending()) || (!c[k].items.length && (c[k].pending || []).length > 0);
      return '<button class="stat" data-tab="' + k + '" aria-pressed="' + (S.tab === k) + '" aria-controls="content"><b class="num"' + (pending ? ' aria-label="' + esc(pendingLabel(k)) + '"' : '') + '>' + (pending ? '—' : fmt(c[k].items.length)) + '</b><span>' + esc(LABEL[k]) + '</span></button>';
    }).join('');
    var headingSector = S.tab !== 'companies' && S.tab !== 'selfbuild' && S.scope !== 'city' && sectorCity(b.city) ? (activeSector() || b.sec || '') : '';
    var hero = CITY_HERO_ASSETS[b.city] || { src: CITY_HERO_FALLBACK, position: '50% 50%', real: false };
    app.innerHTML = '<div class="results-shell wrap"><section class="city-hero" aria-label="' + esc(b.city) + '">' + cityHeroMedia(hero) + '<div class="city-hero-copy"><p class="greet">' + (S.employee ? esc(employeeGreeting(S.employee)) : 'مرحبًا بك') + '</p><div class="hero-branch">' + ICON.map + '<span>' + esc(b.n) + (b.cityOnly ? '' : ' · ' + (b.codeStatus === 'local_internal_reference' ? 'مرجع داخلي ' : '') + esc(b.c)) + '</span></div></div></section>' +
      '<div class="page-title"><h1>فرص ' + esc([headingSector, b.city].filter(Boolean).join(' ')) + '</h1><button class="btn change-branch" data-act="change">' + ICON.swap + 'تغيير الفرع</button></div>' +
      '<div class="discovery-controls">' + scopeOptions() + '<div class="search">' + ICON.search + '<input id="q-sec" class="input" type="search" placeholder="' + esc(SEARCH_PH[S.tab]) + '" value="' + esc(S.q[S.tab] || '') + '" aria-label="' + esc(SEARCH_PH[S.tab]) + '"></div></div>' +
      '<div class="stats" role="group" aria-label="الفئات الرئيسية">' + stats + '</div><div class="secondary-discovery"><button class="btn selfbuild-link" data-tab="selfbuild" aria-controls="content" aria-pressed="' + (S.tab === 'selfbuild') + '">' + ICON.selfbuild + 'البناء الذاتي</button></div><main class="content" id="content" aria-live="polite"></main></div>';
    var scope = document.getElementById('scope-select');
    if (scope) scope.addEventListener('change', function () {
      var value = scope.value;
      if (S.tab === 'cars' && sameCity(b.city, 'الرياض')) { S.carArea = value; S.scope = 'branch'; S.explore = ''; }
      else if (value.indexOf('sector:') === 0) { S.scope = 'sector'; S.explore = value.slice(7); S.carArea = ''; }
      else { S.scope = value; S.explore = ''; S.carArea = ''; }
      S.limit[S.tab] = CFG.pageSize; renderBranch();
    });
    var qi = document.getElementById('q-sec');
    if (qi) qi.addEventListener('input', function () { S.q[S.tab] = qi.value; S.limit[S.tab] = CFG.pageSize; renderSection(); });
    renderSection(c);
  }

  function renderSection(pre) {
    REG.length = 0; renderRevision++;
    var c = pre || compute(), k = S.tab, el = document.getElementById('content'), b = S.branch;
    var all = c[k] ? c[k].items : [], items = filterQuery(k, all), limit = S.limit[k] || CFG.pageSize, shown = items.slice(0, limit);
    var catalogPending = k === 'projects' && bankApprovalPending();
    var pending = catalogPending || (!items.length && filterQuery(k, c[k].pending || []).length > 0);
    var head = '<div class="sec-head"><div><h2>' + esc(LABEL[k]) + '</h2>' + (pending ? '' : '<p>' + esc(intro(k, items.length, items)) + '</p>') + '</div>';
    if (k === 'offices' && radiusApplies(k, S.scope)) head += '<label class="radius-field" for="radius">المسافة<select class="select" id="radius">' + [5,10,15,20].map(function (r) { return '<option value="' + r + '"' + (Number(S.radius) === r ? ' selected' : '') + '>أقرب ' + r + ' كم</option>'; }).join('') + '</select></label>';
    head += '</div>';
    if (k === 'nhc' && sectorCity(b.city) && b.sec) {
      var nhcSector = activeSector() || b.sec, nearbyCount = itemsFor('nhc', nhcSector, 'sector').length;
      head += '<div class="nhc-alternatives" role="group" aria-label="نطاق وجهات NHC"><button class="btn" data-nhc-view="sector" aria-pressed="' + (S.scope !== 'city') + '">وجهات ' + esc(nhcSector) + ' <span class="num">' + fmt(nearbyCount) + '</span></button><button class="btn" data-nhc-view="city" aria-pressed="' + (S.scope === 'city') + '">كل وجهات ' + esc(b.city) + ' <span class="num">' + fmt(c.nhc.total) + '</span></button></div>';
    }
    var body;
    if (pending) body = '<div class="empty ' + (catalogPending ? 'approval-pending' : 'verification-pending') + '" role="status"><h3>' + esc(pendingLabel(k)) + '</h3>' + (catalogPending ? '' : '<p>ستظهر الفرص بعد اكتمال التحقق.</p>') + '</div>';
    else if (!all.length && !norm(S.q[k] || '')) {
      var isGated = k === 'projects' || k === 'opps';
      body = '<div class="empty"><span class="empty-icon">' + ICON[k] + '</span><h3>' + (isGated ? 'لا توجد فرص متاحة موثقة في هذا النطاق' : 'لا توجد نتائج مسجلة في هذا النطاق') + '</h3></div>';
    } else if (!items.length) body = '<div class="empty"><h3>لا نتائج مطابقة</h3><p>جرّب اسمًا أو حيًا آخر.</p></div>';
    else {
      var visual = k === 'projects' || k === 'nhc' || k === 'opps';
      body = '<div class="grid' + (visual ? '' : ' list') + '">' + shown.map(function (x) { return card(x.k || k, x.o, k === 'companies' && x.displayD !== undefined ? x.displayD : x.d, false, false, x); }).join('') + '</div>';
      body += '<div class="pagination">' + (items.length > shown.length ? '<button class="btn load-more" data-more="' + k + '">عرض المزيد</button>' : '') + '<p>عرض <span class="num">' + fmt(shown.length) + '</span> من <span class="num">' + fmt(items.length) + '</span></p></div>';
    }
    el.innerHTML = head + body;
    bindImages(el);
    var radius = document.getElementById('radius');
    if (radius) radius.addEventListener('change', function () { S.radius = Number(radius.value) || 15; S.limit[k] = CFG.pageSize; renderBranch(); });
  }
  // أزرار التوسيع: أوسع ← قطاع الفرع ← كل المدينة، مع عدد ما سيظهر في كل منها
  function widen(k, c) {
    var b = S.branch, h = '';
    
    if (k !== 'offices' && cityScopeAvailable(k) && sectorCity(b.city) && b.sec && S.scope !== 'sector') h += '<button class="btn" data-explore="' + esc(b.sec) + '">' + esc(b.sec) + ' ' + esc(b.city) + ' · <span class="num">' + fmt(itemsFor(k, b.sec, 'sector').length) + '</span></button>';
    if (cityScopeAvailable(k)) h += '<button class="btn primary" data-scope="city">كل ' + esc(b.city) + ' · <span class="num">' + fmt(c[k].total) + '</span></button>';
    return '<div class="more-row">' + h + '</div>';
  }
  function intro(k, n, rows) {
    var b = S.branch;
    if (k === 'companies') return fmt(n) + ' شركة تخدم ' + b.city;
    if ((k === 'projects' || k === 'opps') && sectorCity(b.city) && (activeSector() || b.sec) && S.scope !== 'city') return fmt(n) + ' ' + NOUN[k] + ' في ' + (activeSector() || b.sec) + ' ' + b.city + (S.branch.lat != null && S.branch.lon != null ? ' · الأقرب أولًا' : '');
    if (k === 'projects' && S.scope === 'branch' && radiusApplies(k, 'branch') && rows) {
      return fmt(n) + ' مشروعًا ضمن نطاق الفرع';
    }
    if (k === 'cars' && sameCity(b.city, 'الرياض') && S.scope !== 'city') {
      var chosen = activeSector();
      if (chosen === 'وسط') return fmt(n) + ' معرضًا في القادسية والشفا';
      var area = chosen ? (chosen === 'شرق' || chosen === 'شمال' ? 'qadisiyah' : 'shifa') : (S.carArea || defaultCarArea(b));
      return area === 'all' ? fmt(n) + ' معرضًا في الرياض' : fmt(n) + ' معرضًا في ' + (area === 'shifa' ? 'الشفا' : 'القادسية');
    }
    if (k === 'nearby') { var g = nearbyInfo(); return g ? 'فرص من ' + g.support : ''; }
    return fmt(n) + ' ' + NOUN[k];
  }
  function emptyState(k, c) {
    var sec = activeSector(), b = S.branch;
    if ((S.scope === 'city' && !sec) || k === 'companies') return '<div class="empty"><h3>لا توجد ' + esc(NOUN[k]) + ' مسجلة في ' + esc(b.city) + '</h3></div>';
    var emptyTitle = sec ? 'لا توجد ' + NOUN[k] + ' في ' + sec + ' ' + b.city : (radiusApplies(k, S.scope) ? 'لا توجد ' + NOUN[k] + ' ضمن ' + fmt(S.radius) + ' كم من نقطة المرجع' : 'لا توجد ' + NOUN[k] + ' في ' + b.city);
    var h = '<div class="empty"><h3>' + esc(emptyTitle) + '</h3><div class="row">';
    if (sec) h += SECTORS.filter(function (s) { return s !== sec; }).map(function (s) { return { s: s, n: itemsFor(k, s, 'sector').length }; }).filter(function (x) { return x.n; })
      .map(function (x) { return '<button class="btn" data-explore="' + x.s + '">' + esc(x.s) + ' · <span class="num">' + fmt(x.n) + '</span></button>'; }).join('');
    else {
      if (S.scope === 'branch' && radiusApplies(k, 'branch') && b.lat != null && b.lon != null) {
        var nextRadius = [5, 10, 15, 20].filter(function (r) { return r > Number(S.radius); })[0];
        if (nextRadius) h += '<button class="btn" data-radius="' + nextRadius + '">وسّع البحث إلى ' + fmt(nextRadius) + ' كم</button>';
      }
      if (k !== 'offices' && sectorCity(b.city) && b.sec) h += '<button class="btn" data-explore="' + esc(b.sec) + '">' + esc(b.sec) + ' ' + esc(b.city) + '</button>';
    }
    if (cityScopeAvailable(k)) h += '<button class="btn primary" data-scope="city">كل ' + esc(b.city) + ' · <span class="num">' + fmt(c[k].total) + '</span></button>';
    return h + '</div></div>';
  }
  function filterQuery(k, items) {
    var q = norm(S.q[k] || ''); if (!q) return items;
    return items.filter(function (x) { var o = x.o; return norm((k === 'companies' ? [o.n, o.city, o.kind, o.contact] : [o.n, o.dev, o.nb, o.type, o.city, o.dir, o.kind, o.scope, o.contact]).join(' ')).indexOf(q) >= 0; });
  }

  /* ---------------- cards ---------------- */
  var REG = [], renderRevision = 0;
  function contactView(o) {
    if (!Array.isArray(o.verifiedPhones)) return o;
    var raw = o.phones || [], labels = o.phoneContacts || [], seen = {};
    var phones = o.verifiedPhones.filter(function (phone) { var key = normalizeContactNumber(phone); if (!key || seen[key]) return false; seen[key] = true; return true; });
    var contacts = phones.map(function (phone) { var key = normalizeContactNumber(phone), index = raw.map(normalizeContactNumber).indexOf(key); return index >= 0 ? (labels[index] || '') : ''; });
    var view = Object.assign({}, o, { phones: phones, phoneContacts: contacts });
    if (view.wa && !waMatchesPhone(view)) view.wa = '';
    return view;
  }
  function reg(kind, o) { REG.push({ k: kind, o: contactView(o) }); return REG.length - 1; }
  var GENERIC_PROPERTY_IMAGE = 'assets/images/real-estate-illustrative-apartments.svg';
  var PROPERTY_ILLUSTRATIONS = [GENERIC_PROPERTY_IMAGE, 'assets/images/real-estate-illustrative-townhomes.svg', 'assets/images/real-estate-illustrative-courtyard.svg', 'assets/images/real-estate-illustrative-villa.svg'];
  function imageFallback(kind, o) {
    var type = String(o && o.type || '');
    if (/شقق|استديو/i.test(type)) return PROPERTY_ILLUSTRATIONS[0];
    if (/تاون|دوبلكس|متصل/i.test(type)) return PROPERTY_ILLUSTRATIONS[1];
    if (/فلل|فيلا/i.test(type)) return PROPERTY_ILLUSTRATIONS[3];
    return GENERIC_PROPERTY_IMAGE;
  }
  function ph(title, sub, kind, o) {
    return '<img class="property-image" loading="lazy" decoding="async" alt="رسم عقاري توضيحي" data-generic="1" data-src="' + esc(imageFallback(kind, o)) + '">';
  }
  function displayImage(kind, o) {
    var url = String(o && o.img || ''), id = String(o && o.id || ''), decoded = url;
    try { decoded = decodeURIComponent(url); } catch (e) { /* keep the source URL */ }
    if ((kind === 'projects' && (id === 'P519' || id === 'P125' || id === 'P284')) || (kind === 'nhc' && o && o.n === 'الدار')) return '';
    if (/poster|banner|brochure|flyer|licen[cs]e|permit|screenshot|لقطة.?الشاشة/i.test(decoded)) return '';
    return url;
  }
  function developerSite(o) {
    var host = String(o && o.dsite || '').replace(/^https?:\/\//i, '').split('/')[0];
    if (o && o.id === 'P519' && /(^|\.)rakez\.sa$/i.test(host)) return '';
    return o && o.dsite || '';
  }
  function roomText(value) {
    var text = String(value || '').trim();
    if (/غرف\s+فأكثر$/.test(text)) return text;
    return text.replace(/\s*غرف\s*$/,'').trim() + ' غرف';
  }
  function verifiedField(o, field) {
    var evidence = o.fieldEvidence && o.fieldEvidence[field];
    var source = evidence && evidence.source || o[field + 'Source'];
    if (!source || !/^https?:\/\//i.test(String(source))) return '';
    // A generic home page is not field-specific evidence.
    try { if (!new URL(source).pathname.replace(/\//g, '')) return ''; } catch (e) { return ''; }
    if (evidence && !validEvidence(evidence)) return '';
    if (field === 'area' && /إجمالي|ارض|أرض|مخطط|وجهة|project|land|total/i.test(String(evidence && evidence.scope || o.areaScope || o.areaBasis || ''))) return '';
    return o[field] == null ? '' : o[field];
  }
  function priceInfo(o) {
    var price = verifiedField(o, 'price');
    if (!price) return '';
    var bases = {
      starting_from: ['تبدأ من', ''], starting_price_sar: ['تبدأ من', ''],
      starting_from_excluding_vat: ['تبدأ من', 'غير شامل الضريبة'],
      starting_from_including_vat: ['تبدأ من', 'شامل الضريبة'],
      unit_specific: ['السعر', 'للوحدة الموضحة'],
      unit_specific_excluding_vat: ['السعر', 'للوحدة الموضحة · غير شامل الضريبة'],
      unit_specific_including_vat: ['السعر', 'للوحدة الموضحة · شامل الضريبة'],
      excluding_vat: ['السعر', 'غير شامل الضريبة'], including_vat: ['السعر', 'شامل الضريبة'],
      'قبل ضريبة القيمة المضافة': ['السعر', 'غير شامل الضريبة'],
      'غير شامل الضريبة': ['السعر', 'غير شامل الضريبة'], 'شامل الضريبة': ['السعر', 'شامل الضريبة']
    };
    var basis = Object.prototype.hasOwnProperty.call(bases, o.priceBasis) ? bases[o.priceBasis] : ['السعر', ''];
    return { value: price, prefix: basis[0], suffix: basis[1] };
  }
  function priceText(o) {
    var p = priceInfo(o);
    return p ? p.prefix + ' ' + fmt(p.value) + ' ريال' + (p.suffix ? ' (' + p.suffix + ')' : '') : '';
  }
  function priceLine(o) {
    var p = priceInfo(o);
    return p ? '<div class="price">' + p.prefix + ' ' + sar(p.value) + (p.suffix ? ' (' + p.suffix + ')' : '') + '</div>' : '';
  }
  function constructionLabel(o) {
    var construction = validEvidence(o.construction) ? o.construction : null;
    var status = construction ? (construction.status || construction.label) : verifiedField(o, 'constructionStatus');
    var labels = { under_construction: 'تحت الإنشاء', off_plan: 'على الخارطة', completed: 'مكتمل', delivered: 'تم التسليم', ready: 'جاهز', not_started: 'لم يبدأ الإنشاء' };
    if (Object.prototype.hasOwnProperty.call(labels, status)) return labels[status];
    // Preserve sourced Arabic labels only; never expose unknown normalized codes.
    var label = construction && construction.label;
    return label && /[\u0600-\u06ff]/.test(label) && !/[A-Za-z_]/.test(label) ? label : '';
  }
  function phoneLine(phones, id, contacts) {
    if (!phones || !phones.length) return '';
    function label(i) { return contacts && contacts[i] ? ' — ' + esc(contacts[i]) : ''; }
    if (phones.length === 1) return '<div class="phone"><span class="num">' + esc(phones[0]) + '</span>' + (contacts && contacts[0] ? '<span class="sub">' + label(0) + '</span>' : '') + '</div>';
    return '<div class="phone"><select data-phonesel="' + id + '" aria-label="اختر الرقم">' + phones.map(function (p, i) { return '<option value="' + i + '">' + esc(p) + label(i) + '</option>'; }).join('') + '</select></div>';
  }
  function actions(id, o, cls) {
    var ph = (o.phones || [])[0] || '', wa = o.wa || '';
    var map = o.maps || o.sales || o.mapsQ, site = o.web || o.page || o.site || o.dsite || o.url || o.contactUrl, h = '';
    if (map) {
      var mapHost = ''; try { mapHost = new URL(map, window.location.href).hostname.toLowerCase(); } catch (e) { /* validated separately */ }
      var mapIsGoogle = mapHost.indexOf('google.') >= 0 || mapHost === 'maps.app.goo.gl' || mapHost === 'goo.gl';
      var mapLabel = mapHost.indexOf('waze.com') >= 0 ? 'Waze' : mapHost.indexOf('yango.com') >= 0 ? 'Yango Maps' : mapIsGoogle ? (map.indexOf('/maps/search') >= 0 || /[?&]query=/.test(map) ? 'بحث في Google Maps' : 'Google Maps') : 'الخريطة';
      h += '<a class="' + cls + '" title="' + mapLabel + '" aria-label="' + mapLabel + '" target="_blank" rel="noopener" href="' + esc(map) + '">' + ICON.map + (cls === 'btn' ? 'الخريطة' : '') + '</a>';
    }
    if (ph) h += '<a class="' + cls + '" title="اتصال" aria-label="اتصال" data-call="' + id + '" href="' + esc(telHref(ph)) + '">' + ICON.phone + (cls === 'btn' ? 'اتصال' : '') + '</a>';
    if (wa && waMatchesPhone(o)) h += '<a class="' + cls + ' wa" title="واتساب" aria-label="واتساب" data-wa="' + id + '" target="_blank" rel="noopener" href="' + esc(wa) + '">' + ICON.wa + (cls === 'btn' ? 'واتساب' : '') + '</a>';
    if (site) h += '<a class="' + cls + '" title="الموقع" aria-label="الموقع الإلكتروني" target="_blank" rel="noopener" href="' + esc(site) + '">' + ICON.web + (cls === 'btn' ? 'الموقع' : '') + '</a>';
    if (CFG.enableVcard && ph) h += '<button class="' + cls + '" title="حفظ جهة اتصال" aria-label="حفظ جهة اتصال" data-vcard="' + id + '">' + ICON.card + (cls === 'btn' ? 'حفظ' : '') + '</button>';
    h += '<button class="' + cls + '" title="مشاركة" aria-label="مشاركة" data-share="' + id + '">' + ICON.share + (cls === 'btn' ? 'مشاركة' : '') + '</button>';
    return h;
  }
  function distTag(d, o) { return d != null ? '<span class="tag dist num">' + (o && o.loc === 'nb' ? '~' : '') + (d < 1 ? fmt(Math.round(d * 1000)) + ' m' : fmt(Math.round(d * 10) / 10) + ' km') + '</span>' : ''; }

  function projectAreaLabel(value) {
    var area = String(value || '').trim();
    if (!area) return '';
    if (/^(?:حي|مخطط|وجهة)(?:\s|$)/.test(area)) return area;
    return 'حي ' + area;
  }

  function compactLocation(o) {
    var city = String(o.city || '').trim();
    var parts = String(o.nb || '').split(/[،,]+/).map(function (part) {
      return (city ? part.split(city).join('') : part)
        .replace(/المملكة العربية السعودية|المملكة|السعودية|Saudi Arabia/gi, '')
        .replace(/[0-9٠-٩۰-۹]+/g, '').replace(/\s+/g, ' ').trim();
    }).filter(function (part, i, all) { return part && all.indexOf(part) === i; });
    return parts.concat(city ? [city] : []).join('، ');
  }

  function cardActions(id, o) {
    var ph = (o.phones || [])[0], map = o.maps || o.sales || o.mapsQ;
    return '<div class="card-actions"><button class="btn primary" data-detail="' + id + '" aria-label="تفاصيل ' + esc(o.n) + '">' + ICON.card + 'تفاصيل</button>' +
      (ph ? '<a class="btn" data-call="' + id + '" href="' + esc(telHref(ph)) + '" aria-label="اتصال بـ ' + esc(o.n) + '">' + ICON.phone + 'اتصال</a>' : '<span class="btn unavailable" aria-label="رقم الاتصال غير متاح">' + ICON.phone + 'غير متاح</span>') +
      (map ? '<a class="btn" target="_blank" rel="noopener" href="' + esc(map) + '" aria-label="خرائط ' + esc(o.n) + '">' + ICON.map + 'خرائط</a>' : '<span class="btn unavailable" aria-label="الخريطة غير متاحة">' + ICON.map + 'غير متاح</span>') + '</div>';
  }
  function destinationCardActions(id, o) {
    var map = o.maps || o.mapsQ;
    return '<div class="card-actions destination-actions"><button class="btn primary" data-detail="' + id + '" data-anchor="destination-projects">مشاريع الوجهة</button><button class="btn" data-detail="' + id + '" data-anchor="destination-contacts">تواصل المطورين</button>' +
      (map ? '<a class="btn" target="_blank" rel="noopener" href="' + esc(map) + '" aria-label="خرائط ' + esc(o.n) + '">' + ICON.map + 'خرائط</a>' : '<button class="btn" data-detail="' + id + '">تفاصيل</button>') + '</div>';
  }
  function isIllustrative(o, source) { return /توضيحي|مولّد|مولد|مفاهيم|illustrative|ai-illustrative/i.test([o.imageType, o.imageSource, source].join(' ')); }
  function recordMedia(kind, o) {
    var source = displayImage(kind, o), illustrative = !source || isIllustrative(o, source);
    return '<div class="media">' + ph(o.n, '', kind, o) + (source ? '<img class="property-image official-image" loading="lazy" decoding="async" alt="' + esc(illustrative ? 'صورة توضيحية وليست تصويرًا موثقًا للمشروع' : o.n) + '" data-src="' + esc(source) + '">' : '') + '<span class="image-caption"' + (!illustrative ? ' hidden' : '') + ' data-illustrative="' + illustrative + '">صورة توضيحية</span></div>';
  }
  function card(kind, o, d, showCity, unknown, item) {
    o = contactView(o);
    var id = reg(kind, o), visual = kind === 'projects' || kind === 'opps' || kind === 'nhc';
    var where = kind === 'nhc' ? (o.dir || o.city) : kind === 'selfbuild' ? [o.loc, o.city].filter(Boolean).join('، ') : compactLocation(o), h = '';
    if (visual) {
      h = '<article class="vcard" data-record-id="' + esc(o.id || o.n) + '">' + '<div class="body"><h3>' + esc(o.n) + '</h3><div class="where">' + esc(where) + '</div>' + (o.marketer ? '<div class="dev">التسويق: ' + esc(o.marketer) + '</div>' : o.dev ? '<div class="dev">' + (unclearDeveloperRole(o) ? 'جهة التواصل: ' : '') + esc(o.dev) + '</div>' : '') + (kind !== 'nhc' ? priceLine(o) : '') + '</div>' + (kind === 'nhc' ? destinationCardActions(id, o) : cardActions(id, o)) + recordMedia(kind, o) + '</article>';
    } else {
      var icon = ICON[kind] || ICON.offices;
      h = '<article class="lcard" data-record-id="' + esc(o.id || o.n) + '"><div class="head"><span class="business-icon">' + icon + '</span><div><h3>' + esc(o.n) + '</h3><div class="sub">' + esc(where || (kind === 'companies' ? S.branch.city : '')) + '</div></div></div>' +
        (item && item.serviceMatch ? '<p class="coverage-note">تخدم هذا النطاق</p>' : '') + (o.contact ? '<p class="contact-name">المسؤول: ' + esc(o.contact) + '</p>' : '') + phoneLine(o.phones, id, o.phoneContacts) + cardActions(id, o) + '</article>';
    }
    return h;
  }
  function bindImages(root) {
    root.querySelectorAll('details.unlocated-panel').forEach(function (panel) {
      panel.addEventListener('toggle', function () { if (panel.open) bindImages(panel); });
    });
    root.querySelectorAll('img[data-src]').forEach(function (img) {
      var panel = img.closest && img.closest('details.unlocated-panel');
      if (panel && !panel.open) return;
      if (img.getAttribute('data-bound') === '1') return;
      img.setAttribute('data-bound', '1');
      img.addEventListener('error', function () {
        if (img.dataset && img.dataset.generic === '1') return;
        if (img.classList.contains('company-avatar')) {
          var avatar = document.createElement('span'); avatar.className = 'avatar'; avatar.textContent = img.dataset.initial || 'ع';
          if (img.parentElement) img.parentElement.replaceChild(avatar, img);
          return;
        }
        var media = img.parentElement;
        if (img.classList.contains('official-image')) img.remove();
        var caption = media && media.querySelector('.image-caption'); if (caption) caption.hidden = false;
      });
      img.src = img.getAttribute('data-src');
    });
    root.querySelectorAll('.media, .d-media').forEach(function (media) {
      var official = media.querySelector('.official-image'), caption = media.querySelector('.image-caption');
      if (caption) caption.hidden = !!official && caption.dataset.illustrative !== 'true';
    });
  }

  function unclearDeveloperRole(o) { return /راكز|rakez/i.test(String(o.dev || '')) && o.developerVerified !== true; }

  function destinationProjects(destination) {
    return visibleItemsFor('opps', '', 'city').filter(function (x) {
      var o = x.o, evidence = o.destinationEvidence;
      var sourced = String(o.destinationSource || '').trim() || validEvidence(evidence);
      return sourced && String(o.destinationName || '').trim() === String(destination.n || '').trim() && sameCity(o.destinationCity || o.city, destination.city);
    });
  }
  function destinationProjectSection(destination) {
    var rows = destinationProjects(destination);
    return '<section class="destination-projects" id="destination-projects"><h3>المشاريع المتاحة في الوجهة <span class="num">' + fmt(rows.length) + '</span></h3>' +
      (rows.length ? '<div class="grid">' + rows.map(function (x) { return card(x.k, x.o, null, false, false, x); }).join('') + '</div>' : '<p class="d-note">لا توجد مشاريع متاحة موثقة في هذه الوجهة حاليًا.</p>') + '</section>';
  }

  function destinationContactSection(destination) {
    var contacts = [], seen = {};
    destinationProjects(destination).forEach(function (x) {
      var o = x.o, candidates = [o];
      [o.developerCompanyId, o.marketerCompanyId].filter(Boolean).forEach(function (id) {
        var company = (D.companies || []).filter(function (c) { return c.id === id; })[0];
        if (company) candidates.push(company);
      });
      candidates.forEach(function (rawContact) {
        var contact = contactView(rawContact);
        if (!(contact.phones || []).length || !(contact.phoneSource || (contact.phoneEvidence && validEvidence(contact.phoneEvidence)) || Array.isArray(contact.verifiedPhones))) return;
        var name = rawContact === o ? (o.marketer || o.dev || o.n) : contact.n;
        var key = name + '|' + contact.phones.join('|'); if (seen[key]) return; seen[key] = true;
        var id = reg(rawContact === o ? x.k : 'companies', contact);
        contacts.push('<article class="destination-contact"><h4>' + esc(name) + '</h4><p class="d-note">تواصل مرتبط بمشروع ' + esc(o.n) + '</p>' + phoneLine(contact.phones, id, contact.phoneContacts) + '<div class="d-acts">' + actions(id, contact, 'btn') + '</div></article>');
      });
    });
    return '<section class="destination-contacts" id="destination-contacts"><h3>تواصل الجهات المرتبطة بالمشاريع</h3>' +
      (contacts.length ? contacts.join('') : '<p class="d-note">لا توجد جهات تواصل موثقة حاليًا.</p>') + '</section>';
  }

  /* ---------------- detail ---------------- */
  function openDetail(id, fromHistory, anchor) {
    var it = REG[id]; if (!it) return; var o = it.o, k = it.k, dlg = document.getElementById('detail');
    var rows, links = '';
    if (!dlg.open) detailReturn = { scroll: window.scrollY || 0, focus: document.activeElement };
    if (!fromHistory) { try { history.pushState({ rogDetail: true, record: id, revision: renderRevision, parentRecord: dlg.open ? detailRecord : null }, '', location.href); } catch (e) { /* no history support */ } }
    detailRecord = Number(id);
    var backLabel = history.state && history.state.parentRecord != null ? 'العودة إلى الوجهة' : 'العودة إلى النتائج';
    if (k === 'nhc') {
      rows = [['المدينة', o.city], ['الموقع', o.dir], ['إجمالي الوحدات', verifiedField(o, 'unitCount')]];
      if (o.url) links += '<a class="btn primary" target="_blank" rel="noopener" href="' + esc(o.url) + '">' + ICON.web + 'صفحة الوجهة في NHC</a>';
    } else if (k === 'projects' || k === 'opps') {
      rows = [[unclearDeveloperRole(o) ? 'الجهة المرتبطة' : 'المطور', o.dev], ['المسوّق', o.marketer], ['الموقع', o.nb], ['المدينة', o.city], ['نوع الوحدات', o.type], ['الغرف', verifiedField(o, 'rooms')], ['عدد الوحدات', verifiedField(o, 'units')], ['المساحة', verifiedField(o, 'area')], ['تفصيل المساحة', verifiedField(o, 'area') ? o.areaNote : ''], ['حالة الإنشاء', constructionLabel(o)], ['حالة العرض', validEvidence(o.availability) && o.availability.status === 'available' ? 'متاح للبيع وفق المصدر الموثق' : ''], ['رقم التواصل', o.phoneLevel === 'dev' && o.phones && o.phones[0] ? (unclearDeveloperRole(o) ? 'رقم الجهة' : 'رقم المطور') : '']];
      if (o.page) links += '<a class="btn primary" target="_blank" rel="noopener" href="' + esc(o.page) + '">' + ICON.web + 'صفحة المشروع</a>';
      if (o.areaSource) links += '<a class="btn" target="_blank" rel="noopener" href="' + esc(o.areaSource) + '">' + ICON.web + 'مصدر المساحة</a>';
      var devSite = developerSite(o);
      if (devSite && devSite !== o.page) links += '<a class="btn" target="_blank" rel="noopener" href="' + esc(devSite) + '">' + ICON.companies + (unclearDeveloperRole(o) ? 'موقع الجهة' : 'موقع المطور') + '</a>';
      if (o.sales) links += '<a class="btn" target="_blank" rel="noopener" href="' + esc(o.sales) + '">' + ICON.map + 'مركز المبيعات</a>';
      if (o.contactUrl) links += '<a class="btn" target="_blank" rel="noopener" href="' + esc(o.contactUrl) + '">' + ICON.phone + 'التواصل</a>';
    }
    if (k === 'selfbuild') rows = [['المدينة', o.city], ['الموقع', o.loc]];
    if (k === 'companies' || k === 'offices' || k === 'cars') {
      rows = [['المدينة', o.city], ['الموقع', o.nb], ['النشاط', o.kind], ['المسؤول', o.contact]];
      (o.salesCenters || []).forEach(function (center) { if (center.maps) links += '<a class="btn" target="_blank" rel="noopener" href="' + esc(center.maps) + '">مركز مبيعات الشركة</a>'; });
    }
    if ((k === 'projects' || k === 'opps') && displayEligible('projects', o)) { rows.push(['اعتماد البنك', 'موثق وفق المصدر'], ['تاريخ التحقق', o.bankApproval.checkedAt]); links += evidenceLink(o.bankApproval.source, 'مصدر اعتماد البنك'); }
    if ((k === 'opps' || k === 'projects') && displayEligible('opps', o)) { rows.push(['تاريخ التحقق من الإتاحة', o.availability.checkedAt]); links += evidenceLink(o.availability.source, 'مصدر الإتاحة للبيع'); }
    if (o.destinationName && (o.destinationSource || validEvidence(o.destinationEvidence))) { rows.push(['الوجهة', o.destinationName]); links += evidenceLink(o.destinationSource || o.destinationEvidence.source, 'مصدر الارتباط بالوجهة'); }
    rows = (rows || []).filter(function (r) { return r[1]; });
    dlg.innerHTML = '<div class="d-top"><button class="btn back-results" data-close>← ' + backLabel + '</button></div>' +       '<div class="d-body"><h2>' + esc(o.n) + '</h2><button class="btn" data-close>العودة إلى القائمة</button>' + (k === 'projects' || k === 'opps' ? priceLine(o) : '') +
      phoneLine(o.phones, id, o.phoneContacts) + '<div class="d-acts primary-contact-actions">' + actions(id, o, 'btn') + '</div>' +
      (verifiedField(o, 'desc') ? '<p style="margin:0;color:var(--ink-2)">' + esc(verifiedField(o, 'desc')) + '</p>' : '') +
      '<dl class="kv">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' +
      (k === 'nhc' ? destinationProjectSection(o) + destinationContactSection(o) : '') +
      (k === 'nhc' && (o.phones || []).length ? '<p class="d-note">التواصل المسجّل في بيانات الوجهة</p>' : '') + (links ? '<div class="d-acts">' + links + '</div>' : '') +
      '</div>' + (k === 'projects' || k === 'opps' || k === 'nhc' ? '<div class="d-media"><button class="close-x" data-close aria-label="إغلاق">' + ICON.x + '</button>' +
      ph(k === 'nhc' ? 'وجهة ' + o.n : o.n, [o.type, o.city].filter(Boolean).join(' · '), k, o) + (displayImage(k, o) ? '<img class="property-image official-image" alt="' + esc(o.n || 'صورة') + '" data-src="' + esc(displayImage(k, o)) + '">' : '') + '<span class="image-caption" data-illustrative="' + (!displayImage(k, o) || isIllustrative(o, displayImage(k, o))) + '">صورة توضيحية</span></div>' : '');
    bindImages(dlg);
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
    dlg.scrollTop = 0;
    if (anchor && dlg.querySelector) { var target = dlg.querySelector('#' + anchor); if (target) target.scrollIntoView({ block: 'start' }); }
  }

  /* ---------------- actions ---------------- */
  function currentPhone(id, context) {
    var it = REG[id], phones = (it && it.o.phones) || [], sel = null;
    // The card and its open details dialog can both contain a number selector
    // for the same record. Resolve the selector inside the clicked control's
    // own card/dialog first so a dialog selection never reads the hidden card.
    var area = context && context.closest && context.closest('.d-body, .lcard, .vcard');
    if (area && area.querySelector) sel = area.querySelector('[data-phonesel="' + id + '"]');
    if (!sel) sel = document.querySelector('[data-phonesel="' + id + '"]');
    return phones[sel ? +sel.value : 0] || '';
  }
  function shareItem(id, context) {
    var it = REG[id]; if (!it) return; var o = it.o;
    var text = [o.n, o.dev, [o.nb, o.city].filter(Boolean).join('، '), priceText(o), currentPhone(id, context), o.maps || o.url || o.page || o.web || o.site || ''].filter(Boolean).join('\n');
    if (navigator.share) navigator.share({ title: o.n, text: text }).catch(function () { /* cancelled */ }); else copy(text, 'نُسخت بيانات البطاقة');
  }
  function vcard(id, context) {
    var it = REG[id]; if (!it) return; var o = it.o, ph = currentPhone(id, context);
    var v = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + o.n, 'ORG:' + (o.dev || o.n), 'TEL;TYPE=WORK,VOICE:' + ph, (o.web || o.page || o.site) ? 'URL:' + (o.web || o.page || o.site) : '', 'NOTE:' + (o.city || ''), 'END:VCARD'].filter(Boolean).join('\r\n');
    try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([v], { type: 'text/vcard;charset=utf-8' })); a.download = (o.n || 'contact') + '.vcf'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
    catch (e) { copy(ph, 'نُسخ الرقم'); }
  }
  var detailReturn = null, detailRecord = null;
  function evidenceLink(source, label) { return /^https?:\/\//i.test(String(source || '')) ? '<a class="btn" target="_blank" rel="noopener" href="' + esc(source) + '">' + esc(label) + '</a>' : ''; }
  function closeDlg(fromHistory) {
    var d = document.getElementById('detail');
    if (!fromHistory && history.state && history.state.rogDetail && history.state.parentRecord != null) { history.back(); return; }
    if (d.open) { if (d.close) d.close(); else d.removeAttribute('open'); }
    if (detailReturn) { window.scrollTo(0, detailReturn.scroll); if (detailReturn.focus && detailReturn.focus.focus) detailReturn.focus.focus({ preventScroll: true }); detailReturn = null; }
    detailRecord = null;
    if (!fromHistory && history.state && history.state.rogDetail) history.back();
  }
  var detailDialog = document.getElementById('detail');
  detailDialog.addEventListener('cancel', function (e) { e.preventDefault(); closeDlg(); });
  window.addEventListener('popstate', function () {
    var state = history.state;
    if (state && state.rogDetail && state.revision === renderRevision && REG[state.record]) { if (!document.getElementById('detail').open || detailRecord !== Number(state.record)) openDetail(state.record, true); }
    else if (document.getElementById('detail').open) closeDlg(true);
  });

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act],[data-tab],[data-scope],[data-radius],[data-explore],[data-car-area],[data-nhc-view],[data-more],[data-share],[data-vcard],[data-close],[data-call],[data-wa],[data-detail]');
    if (!t) { if (e.target === document.getElementById('detail')) closeDlg(); return; }
    if (t.hasAttribute('data-act')) { e.preventDefault(); try { localStorage.removeItem('rog.branch'); } catch (x) { /* ignore */ } history.replaceState(null, '', location.pathname + location.search); renderStart(); window.scrollTo(0, 0); return; }
    if (t.hasAttribute('data-tab')) {
      S.views[S.tab] = { scope: S.scope, explore: S.explore, carArea: S.carArea };
      S.tab = t.dataset.tab;
      var view = S.views[S.tab] || { scope: 'branch', explore: '', carArea: '' };
      S.scope = view.scope; S.explore = view.explore; S.carArea = view.carArea;
      renderBranch(); return;
    }
    if (t.hasAttribute('data-nhc-view')) { if (t.dataset.nhcView === 'city') { S.scope = 'city'; S.explore = ''; } else { S.scope = 'sector'; S.explore = activeSector() || S.branch.sec || ''; } S.q = {}; S.limit = {}; renderBranch(); return; }
    if (t.hasAttribute('data-scope')) { S.scope = t.dataset.scope; S.explore = ''; S.carArea = ''; S.q = {}; S.limit = {}; renderBranch(); return; }
    if (t.hasAttribute('data-radius')) { S.radius = Number(t.dataset.radius) || S.radius; S.scope = 'radius'; S.carArea = ''; S.explore = ''; S.q = {}; S.limit = {}; renderBranch(); return; }
    if (t.hasAttribute('data-explore')) { S.explore = t.dataset.explore; S.scope = 'sector'; S.carArea = sameCity(S.branch.city, 'الرياض') ? (['شرق', 'شمال'].indexOf(S.explore) >= 0 ? 'qadisiyah' : (['جنوب', 'غرب'].indexOf(S.explore) >= 0 ? 'shifa' : 'all')) : ''; S.q = {}; S.limit = {}; renderBranch(); return; }
    if (t.hasAttribute('data-car-area')) { S.carArea = t.dataset.carArea; S.scope = 'city'; S.explore = ''; S.tab = 'cars'; S.q = {}; S.limit = {}; renderBranch(); return; }
    if (t.hasAttribute('data-more')) { var k = t.dataset.more; S.limit[k] = (S.limit[k] || CFG.pageSize) + CFG.pageSize; renderSection(); return; }
    if (t.hasAttribute('data-share')) { shareItem(+t.dataset.share, t); return; }
    if (t.hasAttribute('data-vcard')) { vcard(+t.dataset.vcard, t); return; }
    if (t.hasAttribute('data-close')) { closeDlg(); return; }
    if (t.hasAttribute('data-call')) { var ph = currentPhone(+t.dataset.call, t); if (!ph) { e.preventDefault(); return; } t.setAttribute('href', telHref(ph)); return; }
    if (t.hasAttribute('data-wa')) {
      var wid = +t.dataset.wa, wit = REG[wid], selectedPhone = currentPhone(wid, t);
      var w = wit && wit.o.wa && waMatchesPhone({ wa: wit.o.wa, phones: [selectedPhone] }) ? wit.o.wa : ''; 
      if (!w) { e.preventDefault(); toast('هذا الرقم لا يدعم واتساب'); return; }
      t.setAttribute('href', w); return;
    }
    if (t.hasAttribute('data-detail')) { openDetail(+t.dataset.detail, false, t.dataset.anchor); return; }
  });
  document.addEventListener('keydown', function (e) {
    if (!e.target.classList || !e.target.classList.contains('vcard')) return;
    if (e.key === 'Enter' || e.key === ' ') { if (e.key === ' ') e.preventDefault(); openDetail(+e.target.dataset.detail); }
  });
  window.addEventListener('hashchange', function () {
    var m = /^#b([0-9A-Za-z]+)$/.exec(location.hash || '');
    if (m && D.branchByCode && D.branchByCode[m[1]] && (!S.branch || S.branch.c !== m[1])) selectBranch(m[1]);
    else if (!location.hash && S.branch) renderStart();
  });

  boot();
})();



