/* دليل فرص المملكة — تطبيق ثابت بلا إطار عمل. يقرأ config/site.json ثم data/*.json
   منطق العرض:
   - نطاق المدن الكبيرة يقبل تصفح الفرع أو القطاع أو المدينة، وتبدأ النتائج الأقرب.
   - في المدن الأخرى تُعرض جميع الفئات على مستوى المدينة دون خلط المدن المتجاورة.
   - سجلات السيارات تستبعد الشركات والوكالات وموزعي العلامات التجارية، وتزيل تكرار المعرض داخل المدينة.
   - العناصر بلا إحداثيات تبقى ظاهرة دون مسافة مختلقة.
   - وجهات NHC والبناء الذاتي تخدم المدينة كلها.
   - الأرقام أعلى الصفحة تتبع العناصر المعروضة.
   - قسم واحد يُعرض في كل مرة. */
(function () {
  'use strict';

  var CFG = { siteName: 'دليل فرص المملكة', orgName: '', logo: '', tagline: [], credit: '', dataBase: 'data/', enableVcard: true,
              pageSize: 24, officeLimit: 12, updatedLabel: 'آخر تحديث للبيانات' };
  var D = {};
  var S = fresh();
  function fresh() { return { branch: null, scope: 'branch', radius: 15, explore: '', tab: '', q: {}, limit: {}, employee: (S && S.employee) || '', origin: null, nearestBranchDistance: null, carArea: '' }; }
  function employeeGreeting(name) {
    name = String(name || '').trim(); if (!name) return '';
    // تحية محايدة زمنيًا تمنع عرض صباح الخير ليلًا عند اختلاف ساعة الجهاز.
    return 'مرحبًا، ' + name;
  }
  var app = document.getElementById('app');
  var SECTORS = ['شرق', 'شمال', 'جنوب', 'غرب', 'وسط'];
  var SECTIONS = ['projects', 'opps', 'nhc', 'selfbuild', 'companies', 'offices', 'cars', 'nearby'];
  var LABEL = { opps: 'فرص عقارية حالية', selfbuild: 'البناء الذاتي', projects: 'المشاريع المعتمدة', nhc: 'وجهات NHC', companies: 'شركات التسويق والاستثمار العقاري', offices: 'مكاتب العقار', cars: 'معارض السيارات', nearby: 'فرص قريبة من الفرع' };
  var SHORT = { opps: 'فرص حالية', selfbuild: 'البناء الذاتي', projects: 'المشاريع', nhc: 'الوجهات', companies: 'شركات التسويق والاستثمار العقاري', offices: 'المكاتب', cars: 'المعارض', nearby: 'قريبة' };
  var NOUN = { opps: 'فرص عقارية حالية', selfbuild: 'مخططات للبناء الذاتي', projects: 'مشاريع معتمدة', nhc: 'وجهات NHC', companies: 'شركات تسويق أو تطوير', offices: 'مكاتب عقار', cars: 'معارض سيارات', nearby: 'فرص' };
  var SEARCH_PH = { opps: 'ابحث باسم المشروع أو المطور', selfbuild: 'ابحث عن مخطط', projects: 'ابحث باسم المشروع أو المطور أو الحي', nhc: 'ابحث عن وجهة', companies: 'ابحث عن شركة', offices: 'ابحث باسم المكتب أو الحي', cars: 'ابحث باسم المعرض أو الحي', nearby: 'ابحث في الفرص القريبة' };
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
    return fetch(path + sep + 'v=20261010-2', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(path); return r.json(); });
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
      renderHeader();
      return Promise.all(['meta', 'branches', 'projects', 'nhc', 'offices', 'cars', 'office_links', 'companies', 'city_strategy', 'opportunities', 'selfbuild']
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
      // Collapse only exact duplicate records; distinct phases sharing a developer page remain visible.
      var seenProjectPages = Object.create(null), keptProjectRecords = [];
      D.projects = D.projects.filter(function (p) {
        if (!p.page) return true;
        var identity = [cityKey(p.city), norm(p.dev), norm(p.page).replace(/\/$/, ''), norm(p.type), norm(p.nb), String(p.lat || ''), String(p.lon || '')].join('|');
        var signature = JSON.stringify(Object.keys(p).filter(function (k) { return k !== 'id' && k !== 'n' && k !== 'mapsQ'; }).sort().map(function (k) { return p[k]; }));
        var prior = seenProjectPages[identity] || [];
        for (var i = 0; i < prior.length; i++) {
          if (prior[i].signature === signature && sameProjectNameTypo(prior[i].name, p.n)) return false;
        }
        prior.push({ signature: signature, name: p.n }); seenProjectPages[identity] = prior;
        return true;
      });
      D.officeById = {}; D.offices.forEach(function (o) { D.officeById[o.id] = o; });
      D.branchByCode = {}; D.branchCount = {}; D.branches.forEach(function (b) { D.branchByCode[b.c] = b; var bk = cityKey(b.city); D.branchCount[bk] = (D.branchCount[bk] || 0) + 1; });
      D.opps = D.opportunities || [];
      D.cars = dedupeCars((D.cars || []).filter(function (o) { return !o.duplicateOf; })).filter(function (o) { return !excludedCarReportRecord(o); });
      D.cityCount = {};
      ['projects', 'opps', 'nhc', 'selfbuild', 'companies', 'offices', 'cars'].forEach(function (k) {
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
    document.title = CFG.siteName;
    var logo = CFG.logo ? '<img class="brand-logo" src="' + esc(CFG.logo) + '" alt="' + esc(CFG.orgName || 'بنك الرياض') + '">' : '';
    var tag = (CFG.tagline || ['التنفيذ', 'النتائج', 'الأثر']).join(' · ');
    document.getElementById('site-head').innerHTML = '<div class="head-main wrap"><a class="brand" href="#" data-act="home" aria-label="العودة لاختيار الفرع">' + logo + '</a><div class="head-title"><div class="tagline">' + esc(tag) + '</div><div class="brand-name">دليل الفرص – المملكة</div></div><span class="head-spacer" aria-hidden="true"></span></div><div class="head-rule"></div>';
  }
  function renderFooter() {
    document.getElementById('site-foot').innerHTML = '<div class="wrap"><span>' + esc(CFG.credit || '') + '</span><span>' + esc(CFG.updatedLabel) + ': <span class="num">' + esc((D.meta && D.meta.built) || '') + '</span></span></div>';
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
  function renderStart() {
    S = fresh();
    app.innerHTML = '<section class="start"><div class="wrap"><div class="start-card">' +
      '<h1>اختر الفرع</h1>' +
      '<div class="field"><label for="q-emp">اسم الموظف <small>(اختياري)</small></label><input id="q-emp" class="input" type="text" autocomplete="name" placeholder="اسم الموظف" value="' + esc(S.employee) + '"></div>' +
      '<p id="greet" class="greet start-greet" role="status" aria-live="polite" hidden></p>' +
      '<div class="field"><label for="q-branch">رمز الفرع أو اسمه أو المدينة</label><input id="q-branch" class="input" type="search" autocomplete="off" placeholder="اكتب رمز الفرع أو اسمه أو المدينة"></div>' +
      '<div class="field"><label for="q-city">المدينة <small>(اختيارية)</small></label><select id="q-city" class="select"><option value="">كل المدن</option>' +
      cities().map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select></div>' +
      '<div class="branch-list" id="branch-list" role="list"></div>' +
      '<button id="go-branch" class="btn primary go-branch" type="button" disabled>اذهب</button>' +
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
    S = fresh(); S.branch = b; S.scope = (b.lat == null || b.lon == null) && sectorCity(b.city) ? 'city' : 'branch'; S.origin = origin || null;
    S.nearestBranchDistance = origin ? km(origin.lat, origin.lon, b.lat, b.lon) : null;
    store('rog.branch', b.c);
    try { if (location.hash !== '#b' + b.c) location.hash = 'b' + b.c; } catch (e) { /* ignore */ }
    var c = compute(); S.tab = SECTIONS.filter(function (k) { return k !== 'nearby' && c[k].items.length; })[0] || SECTIONS.filter(function (k) { return c[k].total; })[0] || 'projects';
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
  var CITY_LEVEL = { nhc: 1, selfbuild: 1 };   // الوجهات والمخططات تخدم المدينة كلها
  var DAMMAM_NEIGHBOR_CITIES = [];
  function easternNeighborCity(city) { return DAMMAM_NEIGHBOR_CITIES.some(function (name) { return sameCity(name, city); }); }
  function isDammamBranch() { return !!S.branch && sameCity(S.branch.city, 'الدمام'); }
  // الفرع يحدد القطاع والنطاق في الرياض وجدة؛ بقية المدن تعرض فرص المدينة كاملة.
  function branchScopedKind(kind) {
    if (!S.branch || !kind || kind === 'nearby' || CITY_LEVEL[kind]) return false;
    return sectorCity(S.branch.city);
  }
  function cityScopeAvailable(kind) { return !!S.branch && sectorCity(S.branch.city) && branchScopedKind(kind); }
  function radiusApplies(kind, scope) {
    scope = scope || S.scope;
    // الفرع بلا دبوس مؤكد يعرض نطاق المدينة.
    if (S.branch && (typeof S.branch.lat !== 'number' || !isFinite(S.branch.lat) || typeof S.branch.lon !== 'number' || !isFinite(S.branch.lon))) return false;
    var anchor = S.origin || S.branch;
    // معارض الرياض تتبع بطاقة الشفا أو القادسية المختارة؛ إظهار المجموعة كاملة أهم من نصف قطر نقطة الفرع.
    if (kind === 'cars' && S.branch && sameCity(S.branch.city, 'الرياض')) return false;
    return !!(branchScopedKind(kind) && anchor && anchor.lat != null && anchor.lon != null && scope === 'branch');
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
  function rawItems(kind, scope) {
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
    return (D[kind] || []).filter(function (o) {
      var sameBranchCity = sameCity(o.city, b.city);
      var sourceCity = o.regionalListingOf ? (o.originCity || o.city) : o.city;
      if (o.regionalListingOf && !sameCity(sourceCity, b.city)) return false;
      var easternCrossCity = scope === 'branch' && !CITY_LEVEL[kind] && isDammamBranch() && easternNeighborCity(sourceCity);
      if (!sameBranchCity && !easternCrossCity) return false;
      if (easternCrossCity && o.lat == null && o.lon == null && links[o.id] == null && !(Number(o.branchRoadDistancesKm && o.branchRoadDistancesKm[String(b.c)]) > 0)) return false;
      // Keep the canonical showroom row for cross-city Eastern results; neighboring-city clones
      // share the same map pin and number and would otherwise be counted more than once.
      if (easternCrossCity && kind === 'cars' && o.regionalListingOf) return false;
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
  function itemsFor(kind, sec, scope) {
    scope = scope || S.scope;
    var out = rawItems(kind, scope);
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
        // Keep same-city records without a verified location visible, but never
        // count them as measured radius matches or assign a distance.
        return true;
      });
    }
    // نطاق الفرع الذي لا يملك دبوسًا يعتمد الحي المطابق، ثم القطاع عند غياب الحي.
    if (scope === 'branch' && S.branch.lat == null && S.branch.lon == null && branchScopedKind(kind)) {
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
    if (scope === 'branch' && sectorCity(S.branch.city) && S.branch.sec && (kind === 'projects' || kind === 'opps')) {
      if (isDammamBranch()) out = out.filter(function (x) { if (easternNeighborCity(x.o.city)) return true; var sectors = sectorsOf(x.o); return !sectors.length || sectors.indexOf(S.branch.sec) >= 0; });
      else
      out = out.filter(function (x) { var sectors = sectorsOf(x.o); return !sectors.length || sectors.indexOf(S.branch.sec) >= 0; });
    }
    // اختيار القطاع نطاق كامل مستقل؛ لا يطبق عليه نصف قطر الفرع.
    if (scope === 'sector' && sectorCity(S.branch.city) && (sec || S.explore)) {
      var selectedSector = sec || S.explore;
      var selectedSet = selectedSectors(selectedSector);
      if (kind === 'companies') {
        out = out.filter(function (x) { return x.cityOnly || x.explicitCityCoverage || sectorsOf(x.o).some(function (s) { return selectedSet.indexOf(s) >= 0; }) || x.linkedProjects.some(function (p) { return sectorsOf(p).some(function (s) { return selectedSet.indexOf(s) >= 0; }); }); });
      } else if (kind !== 'selfbuild' && kind !== 'nhc' && !(kind === 'cars' && sameCity(S.branch.city, 'الرياض'))) {
        out = out.filter(function (x) { return sectorsOf(x.o).some(function (s) { return selectedSet.indexOf(s) >= 0; }); });
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
    function pts(src) { return src.filter(function (o) { return !(src === D.cars && requiresReview(o.activityReviewStatus)) && sameCity(o.city, c); }).map(function (o) { return { o: o, d: src === D.cars && o.loc !== 'pt' && o.loc !== 'nb' ? null : dist(o) }; })
      .filter(function (x) { return x.d != null && x.d <= Number(S.radius || 15); }).sort(byDist); }
    if (g.need.nhc) pts(D.nhc).forEach(function (x) { out.push({ k: 'nhc', o: x.o, d: x.d }); });
    if (g.need.projects) pts(D.projects).slice(0, 8).forEach(function (x) { out.push({ k: 'projects', o: x.o, d: x.d }); });
    if (g.need.projects) pts(D.opps).slice(0, 8).forEach(function (x) { out.push({ k: 'opps', o: x.o, d: x.d }); });
    if (g.need.offices) pts(D.offices).slice(0, 8).forEach(function (x) { out.push({ k: 'offices', o: x.o, d: x.d }); });
    if (g.need.cars) pts(D.cars).slice(0, 8).forEach(function (x) { out.push({ k: 'cars', o: x.o, d: x.d }); });
    return out;
  }
  // كل الأرقام والقوائم تُحسب من جديد في كل عرض — لا تخزين مؤقت بين الفروع
  function compute() {
    var sec = activeSector(), out = {};
    SECTIONS.forEach(function (k) {
      if (k === 'nearby') { var n = nearbyItems(); out[k] = { items: n, total: n.length }; return; }
      out[k] = { items: itemsFor(k, sec), total: itemsFor(k, sec, 'city').length };
    });
    return out;
  }
  window.__rogQA = function () {
    var c = compute(), o = { branch: S.branch && S.branch.c, branchSec: S.branch && S.branch.sec, scope: S.scope, explore: S.explore, active: activeSector(), sections: {} };
    SECTIONS.forEach(function (k) { o.sections[k] = c[k].items.map(function (x) { return x.o.id || x.o.n; }); });
    return o;
  };
  /* ---------------- branch page ---------------- */
  function renderBranch(pre) {
    var b = S.branch, c = pre || compute(), sc = sectorCity(b.city), sec = activeSector();
    var tabs = SECTIONS.filter(function (k) { return c[k].total || (k === 'nearby' && c[k].items.length); });
    if (tabs.indexOf(S.tab) < 0) S.tab = tabs[0] || 'projects';
    var stats = tabs.filter(function (k) { return k !== 'nearby'; }).map(function (k) {
      var count = c[k].items.length;
      return '<button class="stat" data-tab="' + k + '" aria-pressed="' + (S.tab === k) + '"><b class="num">' + fmt(count) + '</b><span>' + esc(SHORT[k]) + '</span></button>';
    }).join('');
    var hasBranchPin = b.lat != null && b.lon != null;
    function btn(scope, label, on) { return '<button data-scope="' + scope + '" aria-pressed="' + on + '">' + label + '</button>'; }
    var showBranchScope = branchScopedKind(S.tab) && hasBranchPin;
    var showCityScope = cityScopeAvailable(S.tab);
    var ctl = '<div class="seg" role="group" aria-label="النطاق">' +
      (showBranchScope ? btn('branch', S.origin ? 'حول موقعي' : 'نطاق الفرع', S.scope === 'branch') : '') +
      (sc ? SECTORS.map(function (sector) { return '<button data-explore="' + esc(sector) + '" aria-pressed="' + (S.scope === 'sector' && selectedSectors().indexOf(sector) >= 0) + '">' + esc(sector) + ' ' + esc(b.city) + '</button>'; }).join('') : '') +
      (showCityScope ? btn('city', 'كل ' + esc(b.city), S.scope === 'city' || !showBranchScope) : '') + '</div>';
    if (showBranchScope && radiusApplies(S.tab, 'branch') && S.scope === 'branch') ctl += '<label class="explore distance-control">المسافة<select id="radius" aria-label="مسافة الفرص من نقطة المرجع">' + [5, 10, 15, 20].map(function (r) { return '<option value="' + r + '"' + (Number(S.radius) === r ? ' selected' : '') + '>أقرب ' + fmt(r) + ' كم</option>'; }).join('') + '</select></label>';
    var controlsMarkup = /data-(?:scope|explore)|<select id="radius"/.test(ctl) ? '<div class="controls"><div class="wrap"><div class="ctl-row">' + ctl + '</div></div></div>' : '';
    app.innerHTML =
      '<section class="b-hero"><div class="wrap"><div class="b-top"><div class="b-id">' +
      '<p class="greet">' + (S.employee ? esc(employeeGreeting(S.employee)) : (b.cityOnly ? 'عرض المدينة دون فرع' : 'فرص الفرع')) + '</p>' +
      '<h1>' + esc(b.n) + '</h1><div class="b-meta">' + (b.cityOnly ? '' : '<span class="pill code num">' + (b.codeStatus === 'local_internal_reference' ? 'مرجع داخلي ' : '') + esc(b.c) + '</span>') + '<span class="pill">' + esc(b.city) + '</span>' +
      (sc && b.sec ? '<span class="pill sec">' + esc(b.sec) + ' ' + esc(b.city) + '</span>' : '') + (b.nb ? '<span class="pill">حي ' + esc(b.nb) + '</span>' : '') +
      (S.origin ? '<span class="pill geo-pill">أقرب فرع محدد الموقع · ' + distTag(S.nearestBranchDistance, {}) + '</span><a class="pill geo-map" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + esc(b.lat + ',' + b.lon) + '">خريطة الفرع</a>' : '') + '</div>' + ((!hasBranchPin && !b.cityOnly) ? '<p class="location-note" role="status">لا تتوفر إحداثيات موثوقة لهذا الفرع؛ لم تُختلق مسافة. يعرض الدليل بيانات المدينة أو القطاع الموثق، ولا يحسب نطاقًا محليًا حتى يتوفر دبوس صحيح.</p>' : '') + '</div>' +
      '<button class="btn ghost" data-act="change">' + ICON.swap + 'تغيير الفرع</button></div>' +
      '<div class="stats" role="group" aria-label="ملخص">' + stats + '</div></div></section>' +
      controlsMarkup +
      '<main class="content wrap" id="content"></main>';
    var radius = document.getElementById('radius');
    if (radius) radius.addEventListener('change', function () { S.radius = Number(radius.value) || 15; S.scope = 'branch'; S.explore = ''; S.carArea = ''; S.q = {}; S.limit = {}; renderBranch(); });
    renderSection(c);
  }

  function renderSection(pre) {
    REG.length = 0;
    var c = pre || compute(), k = S.tab, el = document.getElementById('content');
    var all = c[k] ? c[k].items : [], items = filterQuery(k, all);
    var limit = S.limit[k] || CFG.pageSize, shown = items.slice(0, limit);
    var head = '<div class="sec-head"><div><h2>' + esc(LABEL[k]) + '</h2><p>' + esc(intro(k, items.length, items)) + '</p></div>' +
      '<div class="search">' + ICON.search + '<input id="q-sec" class="input" type="search" placeholder="' + esc(SEARCH_PH[k]) + '" value="' + esc(S.q[k] || '') + '" aria-label="' + esc(SEARCH_PH[k]) + '"></div></div>';
    if (k === 'cars' && sameCity(S.branch.city, 'الرياض')) {
      var shifaCount = (D.cars || []).filter(function (o) { return carAreaOf(o) === 'shifa'; }).length;
      var qadisiyahCount = (D.cars || []).filter(function (o) { return carAreaOf(o) === 'qadisiyah'; }).length;
      head += '<div class="car-zone-cards" role="group" aria-label="معارض الرياض">' +
      '<button class="car-zone-card" data-car-area="shifa" aria-pressed="' + carAreaSelected('shifa') + '"><span>معارض الشفا</span><strong>' + fmt(shifaCount) + '</strong></button>' +
      '<button class="car-zone-card" data-car-area="qadisiyah" aria-pressed="' + carAreaSelected('qadisiyah') + '"><span>معارض القادسية</span><strong>' + fmt(qadisiyahCount) + '</strong></button>' +
      '<button class="car-zone-card car-zone-all" data-car-area="all" aria-pressed="' + carAreaSelected('all') + '"><span>كل معارض الرياض</span><strong>' + fmt((D.cityCount.cars || {}).الرياض || 0) + '</strong></button></div>';
    }
    var body;
    if (!all.length) body = emptyState(k, c);
    else if (!items.length) body = '<div class="empty"><h3>لا نتائج مطابقة</h3></div>';
    else {
      var visual = k === 'projects' || k === 'nhc' || k === 'opps';
      body = '<div class="grid' + (visual ? '' : ' list') + '">' + shown.map(function (x) { var unlocated = S.scope === 'branch' && radiusApplies(k, 'branch') && x.rankD == null; return card(x.k || k, x.o, k === 'companies' && x.displayD !== undefined ? x.displayD : x.d, k === 'nearby', unlocated, x); }).join('') + '</div>';
      if (items.length > shown.length) body += '<div class="more-row"><button class="btn" data-more="' + k + '">عرض المزيد · <span class="num">' + fmt(items.length - shown.length) + '</span></button></div>';
      else if (k !== 'nearby' && S.scope !== 'city' && c[k].total > all.length && !S.q[k]) body += widen(k, c);
    }
    el.innerHTML = head + body;
    bindImages(el);
    var qi = document.getElementById('q-sec');
    if (qi) qi.addEventListener('input', function () {
      S.q[k] = qi.value; S.limit[k] = CFG.pageSize; var pos = qi.selectionStart; renderSection();
      var n = document.getElementById('q-sec'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
    });
  }
  function unlocatedPanel(kind, items, open) {
    var visual = kind === 'projects' || kind === 'opps' || kind === 'nhc';
    return '<details class="unlocated-panel"' + (open ? ' open' : '') + '><summary>موقع غير محدد <span class="num">' + fmt(items.length) + '</span> — تظل هذه الفرص متاحة دون مسافة</summary>' +
      '<p>لا تتوفر إحداثية موثوقة لهذه العناصر. تبقى ظاهرة هنا دون مسافة مختلقة، أو اختر «كل المدينة» لعرضها مع بقية النتائج.</p>' +
      '<div class="grid' + (visual ? '' : ' list') + '">' + items.map(function (x) { return card(x.k || kind, x.o, null, true, true, x); }).join('') + '</div></details>';
  }
  // أزرار التوسيع: أوسع ← قطاع الفرع ← كل المدينة، مع عدد ما سيظهر في كل منها
  function widen(k, c) {
    var b = S.branch, h = '';
    
    if (cityScopeAvailable(k) && sectorCity(b.city) && b.sec && S.scope !== 'sector') h += '<button class="btn" data-explore="' + esc(b.sec) + '">' + esc(b.sec) + ' ' + esc(b.city) + ' · <span class="num">' + fmt(itemsFor(k, b.sec, 'sector').length) + '</span></button>';
    if (cityScopeAvailable(k)) h += '<button class="btn primary" data-scope="city">كل ' + esc(b.city) + ' · <span class="num">' + fmt(c[k].total) + '</span></button>';
    return '<div class="more-row">' + h + '</div>';
  }
  function intro(k, n, rows) {
    var b = S.branch;
    if (k === 'projects' && S.scope === 'branch' && radiusApplies(k, 'branch') && rows) {
      var unknown = rows.filter(function (x) { return x.rankD == null; }).length;
      var approximate = rows.filter(function (x) { return x.rankD != null && x.o.loc === 'nb'; }).length;
      var located = rows.length - unknown - approximate;
      return fmt(n) + ' مشروعًا لنطاق الفرع: ' + fmt(located) + ' بإحداثيات، ' + fmt(approximate) + ' بمسافة تقريبية، ' + fmt(unknown) + ' موقع غير محدد';
    }
    if (k === 'cars' && sameCity(b.city, 'الرياض') && S.scope !== 'city') {
      var area = S.carArea || defaultCarArea(b);
      return area === 'all' ? fmt(n) + ' معرضًا في الرياض' : fmt(n) + ' معرضًا في ' + (area === 'shifa' ? 'الشفا' : 'القادسية');
    }
    if (k === 'nearby') { var g = nearbyInfo(); return g ? 'فرص من ' + g.support : ''; }
    return fmt(n) + ' ' + NOUN[k];
  }
  function emptyState(k, c) {
    var sec = activeSector(), b = S.branch;
    if (S.scope === 'city' && !sec) return '<div class="empty"><h3>لا توجد ' + esc(NOUN[k]) + ' مسجلة في ' + esc(b.city) + '</h3></div>';
    var emptyTitle = sec ? 'لا توجد ' + NOUN[k] + ' في ' + sec + ' ' + b.city : ((!b.cityOnly && branchScopedKind(k) && (b.lat == null || b.lon == null)) ? 'تعذر تحديد ' + NOUN[k] + ' القريبة: لا توجد إحداثيات موثوقة للفرع' : (radiusApplies(k, S.scope) ? 'لا توجد ' + NOUN[k] + ' ضمن ' + fmt(S.radius) + ' كم من نقطة المرجع' : 'لا توجد ' + NOUN[k] + ' في ' + b.city));
    var h = '<div class="empty"><h3>' + esc(emptyTitle) + '</h3><div class="row">';
    if (sec) h += SECTORS.filter(function (s) { return s !== sec; }).map(function (s) { return { s: s, n: itemsFor(k, s, 'sector').length }; }).filter(function (x) { return x.n; })
      .map(function (x) { return '<button class="btn" data-explore="' + x.s + '">' + esc(x.s) + ' · <span class="num">' + fmt(x.n) + '</span></button>'; }).join('');
    else {
      if (S.scope === 'branch' && b.lat != null && b.lon != null) {
        var nextRadius = [5, 10, 15, 20].filter(function (r) { return r > Number(S.radius); })[0];
        if (nextRadius) h += '<button class="btn" data-radius="' + nextRadius + '">وسّع البحث إلى ' + fmt(nextRadius) + ' كم</button>';
      }
      if (sectorCity(b.city) && b.sec) h += '<button class="btn" data-explore="' + esc(b.sec) + '">' + esc(b.sec) + ' ' + esc(b.city) + '</button>';
    }
    if (cityScopeAvailable(k)) h += '<button class="btn primary" data-scope="city">كل ' + esc(b.city) + ' · <span class="num">' + fmt(c[k].total) + '</span></button>';
    return h + '</div></div>';
  }
  function filterQuery(k, items) {
    var q = norm(S.q[k] || ''); if (!q) return items;
    return items.filter(function (x) { var o = x.o; return norm([o.n, o.dev, o.nb, o.type, o.city, o.dir, o.kind, o.scope, o.contact].join(' ')).indexOf(q) >= 0; });
  }

  /* ---------------- cards ---------------- */
  var REG = [];
  function reg(kind, o) { REG.push({ k: kind, o: o }); return REG.length - 1; }
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
    return '<img class="property-image" loading="lazy" decoding="async" alt="' + esc(title || 'صورة') + '"' + (o && o.img ? '' : ' data-generic="1"') + ' data-src="' + esc(o && o.img || imageFallback(kind, o)) + '">';
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
  function priceLine(o) { return o.price ? '<div class="price">تبدأ من ' + sar(o.price) + (o.priceBasis ? ' (' + esc(o.priceBasis) + ')' : '') + '</div>' : '<div class="price na">السعر: غير معلن</div>'; }
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

  function card(kind, o, d, showCity, unknown, item) {
    var id = reg(kind, o);
    var unknownTag = unknown ? '<span class="tag loc-unknown">الموقع غير محدد</span>' : '';
    if (kind === 'projects') {
      var where = [projectAreaLabel(o.nb), o.city].filter(Boolean).join('، ');
      var projectImage = displayImage(kind, o);
      return '<article class="vcard" data-detail="' + id + '" tabindex="0"><div class="media">' + ph(o.n, [o.type, o.city].filter(Boolean).join(' · '), kind, o) +
        (projectImage ? '<img class="property-image official-image" loading="lazy" decoding="async" alt="صورة المشروع" data-src="' + esc(projectImage) + '">' : '') + '</div>' +
      '<div class="body"><h3>' + esc(o.n) + '</h3><div class="where">' + esc([where, o.type, o.rooms ? roomText(o.rooms) : ''].filter(Boolean).join(' · ')) + '</div><div class="dev">' + esc(o.dev) + '</div>' + priceLine(o) +
        '<div class="foot"><button class="btn primary" data-detail="' + id + '" aria-label="تفاصيل ' + esc(o.n) + '">التفاصيل</button><div class="tags">' + (showCity ? '<span class="tag city">' + esc(o.city) + '</span>' : '') + (d != null ? distTag(d, o) : '') + unknownTag + '</div></div></div></article>';
    }
    if (kind === 'opps') {
      var w2 = [o.nb, o.city].filter(Boolean).join('، ');
      var opportunityImage = displayImage(kind, o);
      return '<article class="vcard" data-detail="' + id + '" tabindex="0"><div class="media">' + ph(o.n, [o.type, o.city].filter(Boolean).join(' · ')) +
        (opportunityImage ? '<img class="property-image official-image" loading="lazy" decoding="async" alt="صورة المشروع" data-src="' + esc(opportunityImage) + '">' : '') + '</div>' +
        '<div class="body"><h3>' + esc(o.n) + '</h3><div class="where">' + esc([w2, o.type, o.rooms ? roomText(o.rooms) : ''].filter(Boolean).join(' · ')) + '</div><div class="dev">' + esc(o.dev) + '</div>' + priceLine(o) +
        '<div class="foot"><button class="btn primary" data-detail="' + id + '" aria-label="تفاصيل ' + esc(o.n) + '">التفاصيل</button><div class="tags">' + (showCity ? '<span class="tag city">' + esc(o.city) + '</span>' : '') + (d != null ? distTag(d, o) : '') + unknownTag + '</div></div></div></article>';
    }
    if (kind === 'selfbuild') {
      return '<article class="lcard"><div class="head"><span class="avatar">' + ICON.selfbuild + '</span><div><h3>' + esc(o.n) + '</h3><div class="sub">' + esc([o.loc, o.city].filter(Boolean).join('، ')) + '</div></div></div>' +
        (d != null ? '<div class="tags">' + distTag(d, o) + '</div>' : '') +
        (o.details ? '<p class="sub" style="margin:0">' + esc(o.details) + '</p>' : '') + phoneLine(o.phones, id, o.phoneContacts) +
        '<div class="acts">' + actions(id, { phones: o.phones, url: o.url, mapsQ: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(o.n + ' ' + o.city), n: o.n }, 'ibtn') + '</div></article>';
    }
    if (kind === 'nhc') {
      var nhcImage = displayImage(kind, o);
      var dirSectors = ['شرق', 'شمال', 'جنوب', 'غرب', 'وسط'].filter(function (v) { return norm(o.dir || '').indexOf(norm(v)) >= 0; });
      var directionReason = dirSectors.length ? dirSectors.join(' / ') : (sectorsOf(o).length ? sectorsOf(o).join(' / ') : (o.dir || o.city));
      return '<article class="vcard" data-detail="' + id + '" tabindex="0"><div class="media">' + ph('وجهة ' + o.n, o.city, kind, o) +
        (nhcImage ? '<img class="property-image official-image" loading="lazy" decoding="async" alt="صورة الوجهة" data-src="' + esc(nhcImage) + '">' : '') + '</div>' +
        '<div class="body"><h3>' + esc(o.n) + '</h3><div class="where">' + esc(o.dir || o.city) + '</div>' +
        phoneLine(o.phones, id, o.phoneContacts) + (o.phones && o.phones.length ? '<div class="acts">' + actions(id, o, 'ibtn') + '</div>' : '') +
        '<div class="foot"><button class="btn primary" data-detail="' + id + '">التفاصيل</button><div class="tags"><span class="tag">' + esc(directionReason) + '</span>' + (showCity ? '<span class="tag city">' + esc(o.city) + '</span>' : '') + (d != null ? distTag(d, o) : '') + unknownTag + '</div></div></div></article>';
    }
    if (kind === 'companies') {
      var companyInitial = (o.n.replace(/^(الشركة|شركة|مؤسسة|مكتب)\s+/, '') || o.n).charAt(0);
      var companyAvatar = o.img ? '<img class="avatar company-avatar" data-src="' + esc(o.img) + '" data-initial="' + esc(companyInitial) + '" alt="' + esc(o.imgAlt || ('شعار ' + o.n)) + '" loading="lazy" decoding="async">' : '<span class="avatar">' + esc(companyInitial) + '</span>';
      return '<article class="lcard"><div class="head">' + companyAvatar + '<div><h3>' + esc(o.n) + '</h3>' +
        '<div class="sub">' + esc(o.kind) + ' · ' + esc(o.coverageCities && !sameCity(S.branch.city, o.city) ? ('تغطية: ' + o.coverageCities.join('، ')) : o.scope) + '</div></div></div>' +
        '<div class="tags">' + (showCity ? '<span class="tag city">' + esc(o.coverageCities && o.coverageCities.some(function (city) { return sameCity(city, S.branch.city); }) ? S.branch.city : o.city) + '</span>' : '') + ((sameCity(S.branch.city, o.city) && sectorsOf(o).length) ? '<span class="tag">' + esc(sectorsOf(o).join(' / ')) + '</span>' : '') + (item && item.serviceMatch ? '<span class="tag">تخدم هذا النطاق</span>' : '') +
        
        (o.contact ? '<span class="tag">المسؤول: ' + esc(o.contact) + '</span>' : '') + unknownTag + '</div>' +
        (o.projects && o.projects.length ? '<p class="sub" style="margin:0">' + esc(o.projects.slice(0, 4).join('، ')) + (o.projects.length > 4 ? '…' : '') + '</p>' : '') +
        phoneLine(o.phones, id, o.phoneContacts) +
        (o.salesCenters || []).map(function (center) { return '<div class="sub"><a target="_blank" rel="noopener" href="' + esc(center.maps) + '">' + esc(center.n) + ' — خرائط Google</a></div>'; }).join('') +
        '<div class="acts">' + actions(id, o, 'ibtn') + '</div></article>';
    }
    return '<article class="lcard"><div class="head"><span class="avatar">' + ICON[kind === 'cars' ? 'cars' : 'offices'] + '</span><div><h3>' + esc(o.n) + '</h3>' +
      (compactLocation(o) ? '<div class="sub">' + esc(compactLocation(o)) + '</div>' : '') + '</div></div>' +
      '<div class="tags">' + (o.regionalServiceArea ? '<span class="tag city">نطاق مشترك: ' + esc(o.regionalServiceArea) + '</span>' : (o.originCity && !sameCity(o.originCity, o.city) ? '<span class="tag city">' + esc(o.originCity) + '</span><span class="tag">قريب من ' + esc(o.city) + '</span>' : (showCity ? '<span class="tag city">' + esc(o.city) + '</span>' : ''))) + (o.sec ? '<span class="tag">' + esc(sectorsOf(o).join(' / ')) + '</span>' : '') + distTag(d, o) + unknownTag + '</div>' +
      phoneLine(o.phones, id, o.phoneContacts) + '<div class="acts">' + actions(id, o, 'ibtn') + '</div></article>';
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
      if (caption) caption.hidden = !!official;
    });
  }

  /* ---------------- detail ---------------- */
  function openDetail(id) {
    var it = REG[id]; if (!it) return; var o = it.o, k = it.k, dlg = document.getElementById('detail');
    var rows, links = '';
    if (k === 'nhc') {
      rows = [['المدينة', o.city], ['الموقع', o.dir], ['إجمالي الوحدات', o.unitCount]];
      if (o.url) links += '<a class="btn primary" target="_blank" rel="noopener" href="' + esc(o.url) + '">' + ICON.web + 'صفحة الوجهة في NHC</a>';
    } else {
      rows = [['المطور', o.dev], ['الموقع', o.nb], ['المدينة', o.city], ['نوع الوحدات', o.type], ['الغرف', o.rooms], ['عدد الوحدات', o.units], ['المساحة', o.area], ['تفصيل المساحة', o.areaNote], ['حالة العرض', o.status], ['رقم التواصل', o.phoneLevel === 'dev' && o.phones && o.phones[0] ? 'رقم المطور' : '']];
      if (o.page) links += '<a class="btn primary" target="_blank" rel="noopener" href="' + esc(o.page) + '">' + ICON.web + 'صفحة المشروع</a>';
      if (o.areaSource) links += '<a class="btn" target="_blank" rel="noopener" href="' + esc(o.areaSource) + '">' + ICON.web + 'مصدر المساحة</a>';
      var devSite = developerSite(o);
      if (o.imageSourceUrl) links += '<a class="btn" target="_blank" rel="noopener" href="' + esc(o.imageSourceUrl) + '">' + ICON.web + 'مصدر الصورة</a>';
      if (devSite && devSite !== o.page) links += '<a class="btn" target="_blank" rel="noopener" href="' + esc(devSite) + '">' + ICON.companies + 'موقع المطور</a>';
      if (o.sales) links += '<a class="btn" target="_blank" rel="noopener" href="' + esc(o.sales) + '">' + ICON.map + 'مركز المبيعات</a>';
      if (o.contactUrl) links += '<a class="btn" target="_blank" rel="noopener" href="' + esc(o.contactUrl) + '">' + ICON.phone + 'التواصل</a>';
    }
    rows = rows.filter(function (r) { return r[1]; });
    dlg.innerHTML = '<div class="d-media"><button class="close-x" data-close aria-label="إغلاق">' + ICON.x + '</button>' +
      ph(k === 'nhc' ? 'وجهة ' + o.n : o.n, [o.type, o.city].filter(Boolean).join(' · '), k, o) + (displayImage(k, o) ? '<img class="property-image official-image" alt="' + esc(o.n || 'صورة') + '" data-src="' + esc(displayImage(k, o)) + '">' : '') + '</div>' +
      '<div class="d-body"><h2>' + esc(o.n) + '</h2><button class="btn" data-close>العودة إلى القائمة</button>' + (k === 'projects' || k === 'opps' ? priceLine(o) : '') +
      (o.desc ? '<p style="margin:0;color:var(--ink-2)">' + esc(o.desc) + '</p>' : '') +
      '<dl class="kv">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' +
      phoneLine(o.phones, id, o.phoneContacts) + (links ? '<div class="d-acts">' + links + '</div>' : '') +
      '<div class="d-acts">' + actions(id, { phones: o.phones, wa: o.wa, maps: o.maps, mapsQ: o.mapsQ }, 'btn') + '</div>' +
      '</div>';
    bindImages(dlg);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }

  /* ---------------- actions ---------------- */
  function currentPhone(id, context) {
    var it = REG[id], phones = (it && it.o.phones) || [], sel = null;
    // The card and its open details dialog can both contain a number selector
    // for the same record. Resolve the selector inside the clicked control's
    // own card/dialog first so a dialog selection never reads the hidden card.
    var area = context && context.closest && context.closest('.d-body, .lcard');
    if (area && area.querySelector) sel = area.querySelector('[data-phonesel="' + id + '"]');
    if (!sel) sel = document.querySelector('[data-phonesel="' + id + '"]');
    return phones[sel ? +sel.value : 0] || '';
  }
  function shareItem(id, context) {
    var it = REG[id]; if (!it) return; var o = it.o;
    var text = [o.n, o.dev, [o.nb, o.city].filter(Boolean).join('، '), o.price ? 'تبدأ من ' + fmt(o.price) + ' ريال' : '', currentPhone(id, context), o.maps || o.url || o.page || o.web || o.site || ''].filter(Boolean).join('\n');
    if (navigator.share) navigator.share({ title: o.n, text: text }).catch(function () { /* cancelled */ }); else copy(text, 'نُسخت بيانات البطاقة');
  }
  function vcard(id, context) {
    var it = REG[id]; if (!it) return; var o = it.o, ph = currentPhone(id, context);
    var v = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + o.n, 'ORG:' + (o.dev || o.n), 'TEL;TYPE=WORK,VOICE:' + ph, (o.web || o.page || o.site) ? 'URL:' + (o.web || o.page || o.site) : '', 'NOTE:' + (o.city || ''), 'END:VCARD'].filter(Boolean).join('\r\n');
    try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([v], { type: 'text/vcard;charset=utf-8' })); a.download = (o.n || 'contact') + '.vcf'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
    catch (e) { copy(ph, 'نُسخ الرقم'); }
  }
  function closeDlg() { var d = document.getElementById('detail'); if (d.open) { if (d.close) d.close(); else d.removeAttribute('open'); } }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act],[data-tab],[data-scope],[data-radius],[data-explore],[data-car-area],[data-more],[data-share],[data-vcard],[data-close],[data-call],[data-wa],[data-detail]');
    if (!t) { if (e.target === document.getElementById('detail')) closeDlg(); return; }
    if (t.hasAttribute('data-act')) { e.preventDefault(); try { localStorage.removeItem('rog.branch'); } catch (x) { /* ignore */ } history.replaceState(null, '', location.pathname + location.search); renderStart(); window.scrollTo(0, 0); return; }
    if (t.hasAttribute('data-tab')) { S.tab = t.dataset.tab; renderBranch(); var c = document.querySelector('.controls'); if (c && window.scrollY > c.offsetTop) window.scrollTo(0, c.offsetTop); return; }
    if (t.hasAttribute('data-scope')) { S.scope = t.dataset.scope; S.explore = ''; S.carArea = ''; S.q = {}; S.limit = {}; renderBranch(); return; }
    if (t.hasAttribute('data-radius')) { S.radius = Number(t.dataset.radius) || S.radius; S.scope = 'branch'; S.carArea = ''; S.explore = ''; S.q = {}; S.limit = {}; renderBranch(); return; }
    if (t.hasAttribute('data-explore')) { S.explore = t.dataset.explore; S.scope = 'sector'; S.carArea = sameCity(S.branch.city, 'الرياض') ? (['شرق', 'شمال'].indexOf(S.explore) >= 0 ? 'qadisiyah' : (['جنوب', 'غرب'].indexOf(S.explore) >= 0 ? 'shifa' : 'all')) : ''; S.q = {}; S.limit = {}; renderBranch(); return; }
    if (t.hasAttribute('data-car-area')) { S.carArea = t.dataset.carArea; S.scope = 'city'; S.explore = ''; S.tab = 'cars'; S.q = {}; S.limit = {}; renderBranch(); return; }
    if (t.hasAttribute('data-more')) { var k = t.dataset.more; S.limit[k] = (S.limit[k] || CFG.pageSize) + CFG.pageSize; renderSection(); return; }
    if (t.hasAttribute('data-share')) { shareItem(+t.dataset.share, t); return; }
    if (t.hasAttribute('data-vcard')) { vcard(+t.dataset.vcard, t); return; }
    if (t.hasAttribute('data-close')) { closeDlg(); return; }
    if (t.hasAttribute('data-call')) { var ph = currentPhone(+t.dataset.call, t); if (!ph) { e.preventDefault(); return; } t.setAttribute('href', telHref(ph)); return; }
    if (t.hasAttribute('data-wa')) {
      var wid = +t.dataset.wa, wit = REG[wid], selectedPhone = currentPhone(wid, t);
      var w = wit && wit.o.wa && selectedPhone === ((wit.o.phones || [])[0] || '') ? wit.o.wa : ''; 
      if (!w) { e.preventDefault(); toast('هذا الرقم لا يدعم واتساب'); return; }
      t.setAttribute('href', w); return;
    }
    if (t.hasAttribute('data-detail')) { openDetail(+t.dataset.detail); return; }
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



