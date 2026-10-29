/* دليل فرص المملكة — تطبيق ثابت بلا إطار عمل. يقرأ config/site.json ثم data/*.json
   منطق العرض:
   - نطاق المدن الكبيرة يقبل تصفح الفرع أو القطاع أو المدينة، وتبدأ النتائج الأقرب.
   - تبقى سجلات المدن منفصلة؛ الثقبة ضمن الخبر، وبدائل الوجهات القريبة معلّمة بمدينتها.
   - سجلات السيارات تستبعد الشركات والوكالات وموزعي العلامات التجارية، وتزيل تكرار المعرض داخل المدينة.
   - سجلات الحي الموثق قد تظهر بجوار الفرع دون مسافة؛ الدبابيس الفعلية فقط تدخل حساب المسافة، وبقية السجلات محفوظة في كامل المدينة.
   - وجهات NHC تبدأ بقطاعها ثم بديل قريب منفصل عند الفراغ؛ كل وجهات المدينة خيار مستقل.
   - الأرقام أعلى الصفحة تتبع العناصر المعروضة.
   - قسم واحد يُعرض في كل مرة. */
(function () {
  'use strict';

  var CFG = { siteName: 'دليل فرص المملكة', orgName: '', logo: '', tagline: [], credit: '', dataBase: 'data/', enableVcard: true,
              pageSize: 12, officeLimit: 12, updatedLabel: 'آخر تحديث للبيانات' };
  var D = {};
  var S = fresh();
  function fresh() { return { branch: null, scope: 'branch', radius: 5, explore: '', tab: '', q: {}, limit: {}, employee: (S && S.employee) || '', origin: null, nearestBranchDistance: null, carArea: '', nhcView: 'local', views: {} }; }
  function employeeGreeting(name) {
    name = String(name || '').trim(); if (!name) return '';
    // تحية محايدة زمنيًا تمنع عرض صباح الخير ليلًا عند اختلاف ساعة الجهاز.
    return 'مرحبًا، ' + name;
  }
  var app = document.getElementById('app');
  var SECTORS = ['شرق', 'شمال', 'جنوب', 'غرب', 'وسط'];
  var PRIMARY_SECTIONS = ['opps', 'projects', 'nhc', 'companies', 'offices', 'cars'];
  var SECTIONS = ['projects', 'opps', 'nhc', 'selfbuild', 'companies', 'offices', 'cars', 'dealers', 'nearby'];
  var LABEL = { opps: 'المشاريع والفرص المتاحة للبيع', selfbuild: 'البناء الذاتي', projects: 'المشاريع المعتمدة لدى البنك', nhc: 'وجهات ومشاريع NHC', companies: 'شركات الاستثمار والتطوير العقاري', offices: 'مكاتب العقار', cars: 'معارض السيارات', dealers: 'وكالات السيارات الرسمية', nearby: 'فرص قريبة من الفرع' };
  var SHORT = { opps: 'فرص حالية', selfbuild: 'البناء الذاتي', projects: 'المشاريع', nhc: 'وجهات ومشاريع NHC', companies: 'شركات الوساطة والاستثمار العقاري', offices: 'المكاتب', cars: 'المعارض', dealers: 'الوكالات الرسمية', nearby: 'قريبة' };
  var NOUN = { opps: 'فرص عقارية حالية', selfbuild: 'مخططات للبناء الذاتي', projects: 'مشاريع معتمدة', nhc: 'وجهات ومشاريع NHC', companies: 'شركات تسويق أو تطوير', offices: 'مكاتب عقار', cars: 'معارض سيارات', dealers: 'وكالات سيارات رسمية', nearby: 'فرص' };
  var SEARCH_PH = { opps: 'ابحث باسم المشروع أو المطور', selfbuild: 'ابحث عن مخطط', projects: 'ابحث باسم المشروع أو المطور أو الحي', nhc: 'ابحث عن وجهة أو مشروع', companies: 'ابحث عن شركة', offices: 'ابحث باسم المكتب أو الحي', cars: 'ابحث باسم المعرض أو الحي', dealers: 'ابحث باسم الوكالة أو المدينة', nearby: 'ابحث في الفرص القريبة' };
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
    // الثقبة حي في الخبر؛ نبقي اسم الفرع الأصلي ونوحد تغطية المدينة.
    if (k === norm('الثقبة') || k === norm('الثغبة')) return norm('الخبر');
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
    if (key === norm('الخبر')) return 'الخبر';
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
      if (cityFromHash() && cities().some(function (c) { return sameCity(c, cityFromHash()) && !D.branches.some(function (b) { return sameCity(b.city, c); }); })) selectCity(cityFromHash(), true);
      else if (bootHash && D.branchByCode[bootHash[1]]) selectBranch(bootHash[1], true);
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
    entryClickGuard = null; // A fresh entry journey must not inherit the previous click sequence.
    S = fresh();
    app.innerHTML = '<section class="start"><div class="entry-shell wrap"><div class="entry-visual has-tower">' + (ENTRY_TOWER_ASSET ? '<svg class="entry-tower-photo" viewBox="0 307 710 945" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><image href="' + esc(ENTRY_TOWER_ASSET) + '" x="0" y="0" width="710" height="1536" onload="this.dataset.loaded=1"></image></svg>' : '') + '<div class="entry-copy"><h1>فرص أقرب.<br>إنجاز أكبر.</h1><p>ابدأ من فرعك.</p></div></div><div class="start-card">' +
      '<div class="entry-form-heading"><h2>اختر مدينتك وفرعك</h2></div>' +
      '<div class="field"><label for="q-emp">اسم الموظف <small>(اختياري)</small></label><input id="q-emp" class="input" type="text" autocomplete="name" placeholder="اسم الموظف" value="' + esc(S.employee) + '"></div>' +
      '<p id="greet" class="greet start-greet" role="status" aria-live="polite" hidden></p>' +
      '<div class="field"><label for="q-branch">رمز الفرع أو اسمه</label><input id="q-branch" class="input" type="search" autocomplete="off" placeholder="مثال: 243 أو القادسية"></div>' +
      '<div class="field"><label for="q-city">المدينة</label><select id="q-city" class="select"><option value="">كل المدن</option>' +
      cities().map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select></div>' +
      '<div class="branch-list" id="branch-list" role="list"></div>' +
      '<button id="go-branch" class="btn primary go-branch" type="button" disabled>دخول <span aria-hidden="true">←</span></button>' +
      '<button id="use-location" class="btn geo-btn">' + ICON.nearby + 'استخدم موقعي — أقرب فرع</button>' +
      '<p id="geo-status" class="list-note" role="status" aria-live="polite" hidden></p></div></div></section>';
    var qb = document.getElementById('q-branch'), qc = document.getElementById('q-city'), qe = document.getElementById('q-emp'), go = document.getElementById('go-branch');
    document.getElementById('use-location').addEventListener('click', function (e) {
      var button = e.currentTarget, status = document.getElementById('geo-status');
      function explain(message) { status.textContent = message; status.hidden = false; }
      function reset() { button.disabled = false; button.textContent = 'استخدم موقعي — أقرب فرع'; }
      if (button.disabled) return;
      if (!navigator.geolocation) { explain('خدمة تحديد الموقع غير متاحة في هذا المتصفح. اختر الفرع يدويًا.'); return; }
      button.disabled = true; button.textContent = 'جارٍ تحديد الموقع…';
      status.hidden = true;
      navigator.geolocation.getCurrentPosition(function (pos) {
        if (!button.isConnected) return;
        var origin = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracyMeters: typeof pos.coords.accuracy === 'number' && isFinite(pos.coords.accuracy) && pos.coords.accuracy >= 0 ? pos.coords.accuracy : null }, nearest = nearestBranch(origin);
        if (!nearest) { reset(); explain('تعذّر العثور على فرع بإحداثيات مؤكدة. يمكنك اختيار الفرع يدويًا.'); return; }
        selectBranch(nearest.c, false, origin);
      }, function () { if (!button.isConnected) return; reset(); explain('تعذّر تحديد موقعك. يمكنك اختيار الفرع يدويًا.'); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    });
    var selectedCode = '';
    function list(chosenCode) {
      var raw = qb.value.trim(), q = norm(raw), city = qc.value;
      qb.disabled = false;
      if (!city && !q) { selectedCode = ''; go.disabled = true; document.getElementById('branch-list').innerHTML = ''; return; }
      var items = D.branches.filter(function (b) {
        if (city && !sameCity(b.city, city)) return false;
        if (!q) return true;
        return (b.codeStatus !== 'local_internal_reference' && String(b.c).indexOf(raw) >= 0) || norm(b.n).indexOf(q) >= 0;
      });
      var exact = D.branchByCode[raw];
      selectedCode = typeof chosenCode === 'string' && items.some(function (b) { return b.c === chosenCode; }) ? chosenCode : (exact && exact.codeStatus !== 'local_internal_reference' && (!city || sameCity(exact.city, city)) ? exact.c : '');
      var shown = items.slice(0, 80);
      document.getElementById('branch-list').innerHTML = shown.map(function (b) {
        return '<button class="branch-item' + (selectedCode === b.c ? ' selected' : '') + '" type="button" role="listitem" aria-pressed="' + (selectedCode === b.c) + '" data-code="' + esc(b.c) + '"><span class="code num">' + (b.codeStatus === 'local_internal_reference' ? 'مرجع داخلي' : esc(b.c)) + '</span><span class="bn">' + esc(b.n) + '</span><span class="bc">' + esc(b.city) + (sectorCity(b.city) && b.sec ? ' · ' + esc(b.sec) : '') + '</span></button>';
      }).join('') + (!shown.length ? '<p class="list-note">لا يوجد فرع مطابق</p>' : '');
      var browseCity = city || cities().filter(function (c) { return q && sameCity(c, raw); })[0];
      if (browseCity && !D.branches.some(function (b) { return sameCity(b.city, browseCity); })) document.getElementById('branch-list').innerHTML += '<button class="btn" type="button" data-browse-city="' + esc(browseCity) + '">تصفح فرص ' + esc(browseCity) + ' بدون اختيار فرع</button>';
      go.disabled = !selectedCode;
    }
    qb.addEventListener('input', list);
    qc.addEventListener('change', function () { list(); var status = document.getElementById('geo-status'); if (status) status.hidden = true; });
    qb.addEventListener('keydown', function (e) { if (e.key === 'Enter' && selectedCode) selectBranch(selectedCode); });
    go.addEventListener('click', function (e) { if (selectedCode) { armEntryClickGuard(e); selectBranch(selectedCode); } });
    qe.addEventListener('input', function () { S.employee = qe.value.trim(); var g = document.getElementById('greet'); if (g) { g.textContent = employeeGreeting(S.employee); g.hidden = !S.employee; } });
    var greeting = document.getElementById('greet'); greeting.textContent = employeeGreeting(S.employee); greeting.hidden = !S.employee;
    document.getElementById('branch-list').addEventListener('click', function (e) {
      var cityButton = e.target.closest('[data-browse-city]'); if (cityButton) { armEntryClickGuard(e); selectCity(cityButton.dataset.browseCity); return; }
      var b = e.target.closest('[data-code]'); if (!b) return;
      selectedCode = b.dataset.code; var selected = D.branchByCode[selectedCode]; qb.value = selected && selected.codeStatus === 'local_internal_reference' ? selected.n : selectedCode; list(selectedCode); go.focus();
    });
    list();
    if (location.hash) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ } }
  }

  // A double-click on entry must not hit a category exposed by the first click.
  // Restrict this guard to the same screen point; fast clicks elsewhere and keyboard input remain usable.
  var entryClickGuard = null;
  function armEntryClickGuard(e) {
    if (e && e.detail > 0 && Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) entryClickGuard = { x: e.clientX, y: e.clientY, until: Date.now() + 600 };
  }
  document.addEventListener('click', function (e) {
    if (!entryClickGuard || Date.now() > entryClickGuard.until) { entryClickGuard = null; return; }
    if (e.detail > 0 && Math.abs(e.clientX - entryClickGuard.x) <= 6 && Math.abs(e.clientY - entryClickGuard.y) <= 6) {
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, true);

  /* ---------------- branch & state ---------------- */
  // الفرع مرجع الترتيب؛ سجلات المدينة الكاملة محفوظة خارج مجموعة المحيط الأولية.
  function selectBranch(code, fromBoot, origin) {
    var b = D.branchByCode[code]; if (!b) return;
    // تصفير كامل: لا يبقى أي اختيار أو نتيجة من الفرع السابق
    S = fresh(); S.branch = b; S.scope = km(b.lat, b.lon, b.lat, b.lon) == null ? 'city' : 'branch'; S.origin = origin || null;
    S.nearestBranchDistance = origin ? km(origin.lat, origin.lon, b.lat, b.lon) : null;
    store('rog.branch', b.c);
    try { if (location.hash !== '#b' + b.c) location.hash = 'b' + b.c; } catch (e) { /* ignore */ }
    var c = compute(); S.tab = PRIMARY_SECTIONS.filter(function (k) { return k !== 'nearby' && c[k].items.length; })[0] || 'opps';
    renderBranch(c);
    if (!fromBoot) window.scrollTo(0, 0);
  }
  // City browsing is not an invented bank branch and never widens to a province.
  function selectCity(city, fromBoot) {
    var canonical = cities().filter(function (c) { return sameCity(c, city); })[0];
    if (!canonical || D.branches.some(function (b) { return sameCity(b.city, canonical); })) return;
    S = fresh(); S.branch = { c: '', n: 'تصفح المدينة بدون فرع', city: canonical, cityOnly: true, sec: '', lat: null, lon: null }; S.scope = 'city';
    try { localStorage.removeItem('rog.branch'); location.hash = 'city=' + encodeURIComponent(canonical); } catch (e) { /* ignore */ }
    var c = compute(); S.tab = PRIMARY_SECTIONS.filter(function (k) { return c[k].items.length; })[0] || 'opps';
    renderBranch(c); if (!fromBoot) window.scrollTo(0, 0);
  }
  function cityFromHash() {
    if ((location.hash || '').indexOf('#city=') !== 0) return '';
    try { return decodeURIComponent(location.hash.slice(6)); } catch (e) { return ''; }
  }
  function sectorCity(city) { return ['الرياض', 'جدة'].some(function (x) { return sameCity(x, city); }); }
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
  // Primary destinations follow physical sectors; service coverage is shown separately as nearby.
  function nhcCoverageSectors(o) { return sectorsOf(o); }
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
    // GPS chooses the nearest recorded branch, independently of the manual city filter.
    // A branch location is not a claim of the user's municipal boundary or neighborhood.
    var candidates = D.branches.map(function (b) { return { b: b, d: km(origin.lat, origin.lon, b.lat, b.lon) }; })
      .filter(function (x) { return x.d != null; }).sort(function (a, b) { return a.d - b.d; });
    return candidates.length ? candidates[0].b : null;
  }
  function dist(o) {
    if (multiLocationRecord(o)) return null;
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
    if (!item || !branch || multiLocationRecord(item)) return null;
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
  function branchNearbyKind(kind) { return ['projects', 'opps', 'offices'].indexOf(kind) >= 0; }
  function neighborhoodKey(value) { return norm(String(value || '').replace(/^حي\s+/, '').trim()); }
  function sameBranchNeighborhood(o) {
    if (!o || o.locationVerificationStatus === 'location_unverified' || !sameCity(o.city, S.branch.city)) return false;
    var nb = neighborhoodKey(S.branch.nb);
    // A branch name or an unsourced district label cannot establish neighborhood membership.
    if (!nb || !/^https?:\/\//.test(String(S.branch.neighborhoodSource || ''))) return false;
    if (multiLocationRecord(o)) return recordLocations(o).some(function (site) { return sameCity(site.city, S.branch.city) && neighborhoodKey(site.nb) === nb; });
    return neighborhoodKey(o.nb) === nb;
  }
  function physicalSiteDistance(o) {
    if (!o || multiLocationRecord(o) || o.locationVerificationStatus === 'location_unverified' || ['project', 'pt', 'office'].indexOf(o.loc) < 0) return null;
    return km(S.branch.lat, S.branch.lon, o.lat, o.lon);
  }
  function branchNearbyCompare(a, b, scope, kind) {
    if (scope !== 'external') {
      if (kind === 'offices' || !sectorCity(S.branch.city) || scope === 'branch' || scope === 'radius') {
        if (!!a.sameNeighborhood !== !!b.sameNeighborhood) return a.sameNeighborhood ? -1 : 1;
        if (!!a.branchLocal !== !!b.branchLocal) return a.branchLocal ? -1 : 1;
      } else if (scope === 'city' && S.branch.sec) {
        var as = sectorsOf(a.o).indexOf(S.branch.sec) >= 0, bs = sectorsOf(b.o).indexOf(S.branch.sec) >= 0;
        if (as !== bs) return as ? -1 : 1;
      }
    }
    return byDist(a, b) || String(a.o.n || '').localeCompare(String(b.o.n || ''), 'ar');
  }
  function radiusApplies(kind, scope) {
    scope = scope || S.scope;
    return branchNearbyKind(kind) && (scope === 'branch' || scope === 'radius') && S.branch && sectorCity(S.branch.city) && km(S.branch.lat, S.branch.lon, S.branch.lat, S.branch.lon) != null;
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
    // Exact reviewed business identity precedes legacy name/zone heuristics.
    // A market compound is not counted as one independent showroom or declared an official agency.
    var review = o && o.showroomReview;
    if (review && review.checkedAt && Array.isArray(review.sources) && review.sources.length) {
      if (review.status === 'market_aggregate' || review.status === 'official_agency') return true;
      if (review.status === 'verified_individual') return false;
    }
    if (o && (o.pdfShowroomVerified === true || (o.city === 'الرياض' && (o.zone === 'shifa' || o.zone === 'qadisiyah')))) return false;
    return /(?:^|\s)(?:شركة|الشركة|مؤسسة)(?:\s|$)|وكالة|التوكيلات|محمد يوسف ناغي|عبد\s*اللطيف جميل|المجدوعي|شانجان|changan|جينيسيس|genesis|هيونداي|hyundai|تويوتا|toyota|كيا|kia|مازدا|mazda|شيري|chery|جيتور|jetour|دونغ\s*فينغ|dongfeng|موزع\s+جيلي/i.test(String(o && o.n || ''));
  }
  function carPlaceCid(o) {
    try { var u = new URL(o.maps || ''), cid = u.searchParams.get('cid'); return /(^|\.)google\.com$/.test(u.hostname) && /^\/maps(?:\/|$)/.test(u.pathname) && /^\d+$/.test(cid || '') ? cid : ''; } catch (e) { return ''; }
  }
  function carPhonesKey(o) { return (o.phones || []).filter(Boolean).map(String).sort().join(','); }
  function verifiedRegionalCar(o, source) {
    // A regional alias is not a second business. Require the explicit source link
    // AND the same exact place CID, identity, phones and physical/display city.
    var cid = carPlaceCid(o);
    return !!(source && !source.regionalListingOf && o.regionalListingOf === source.id && cid && cid === carPlaceCid(source) &&
      String(o.n || '').trim() && String(o.n).trim() === String(source.n || '').trim() && carPhonesKey(o) && carPhonesKey(o) === carPhonesKey(source) &&
      sameCity(o.city, source.city) && sameCity(o.originCity || o.city, source.city));
  }
  function dedupeCars(rows) {
    var groups = {}, keys = [], byId = {};
    rows.forEach(function (o) { if (o.id) byId[o.id] = o; });
    rows.forEach(function (o) {
      var identity = verifiedRegionalCar(o, byId[o.regionalListingOf]) ? byId[o.regionalListingOf] : o;
      var place = [norm(identity.nb), identity.lat == null ? '' : String(identity.lat), identity.lon == null ? '' : String(identity.lon), norm(identity.maps || identity.sales || identity.mapsQ)].join('|');
      var key = [cityKey(identity.city), norm(identity.n), carPhonesKey(identity), place].join('|');
      if (!groups[key]) { groups[key] = []; keys.push(key); } groups[key].push(o);
    });
    return keys.map(function (key) {
      var list = groups[key].slice().sort(function (a, b) {
        function score(o) { return (o.web ? 4 : 0) + (o.maps ? 3 : 0) + (o.lat != null && o.lon != null ? 4 : 0) + (o.nb ? 1 : 0) + ((o.phones || []).length); }
        return score(b) - score(a);
      });
      var base = Object.assign({}, list[0]), phones = [];
      var verifiedPin = list.find(function (o) { return o.mapReviewStatus === 'verified_direct_pin' && carPlaceCid(o) && typeof o.lat === 'number' && typeof o.lon === 'number' && isFinite(o.lat) && isFinite(o.lon); });
      if (verifiedPin) ['lat', 'lon', 'loc', 'maps', 'mapReviewStatus', 'mapReviewNote'].forEach(function (field) { if (verifiedPin[field] !== undefined) base[field] = verifiedPin[field]; });
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
  function primaryCarArea(b, sector) {
    if (!b || !sameCity(b.city, 'الرياض')) return '';
    var sec = norm(sector || b.sec || '');
    if (sec.indexOf('شرق') >= 0 || sec.indexOf('شمال') >= 0) return 'qadisiyah';
    if (sec.indexOf('غرب') >= 0 || sec.indexOf('جنوب') >= 0 || sec.indexOf('وسط') >= 0) return 'shifa';
    // Unknown sector is the whole city, never an invented nearest group.
    return 'all';
  }
  function defaultCarArea(b) { return primaryCarArea(b, ''); }
  function currentCarArea(sec, scope) {
    scope = scope || S.scope;
    // An explicit city inventory query must not inherit a narrower tab selection.
    if (scope === 'city') return 'all';
    if (['qadisiyah', 'shifa', 'all', 'combined'].indexOf(S.carArea) >= 0) return S.carArea === 'combined' ? 'all' : S.carArea;
    return primaryCarArea(S.branch, scope === 'sector' ? (sec || S.explore) : '');
  }
  function carAreaOf(o) { return o && (o.zone === 'shifa' || o.zone === 'qadisiyah') ? o.zone : ''; }
  function carAreaSelected(area) { return currentCarArea(activeSector(), S.scope) === area; }
  function carGroupName(area) { return area === 'qadisiyah' ? 'القادسية' : area === 'shifa' ? 'الشفا' : 'الرياض'; }
  function riyadhCarGroupsHTML(rows) {
    var html = '', last = null;
    rows.forEach(function (x) {
      var area = carAreaOf(x.o);
      if (area !== last) {
        if (last !== null) html += '</div></section>';
        html += '<section class="car-zone-group" data-car-zone="' + esc(area) + '"><h3>معارض ' + esc(area ? carGroupName(area) : 'أخرى في الرياض') + '</h3><div class="grid list">';
        last = area;
      }
      html += card('cars', x.o, x.d, false, false, x);
    });
    return html + (last !== null ? '</div></section>' : '');
  }
  function requiresReview(value) { return String(value || '').trim().toUpperCase() === 'REVIEW_REQUIRED'; }
  function rawItems(kind, scope, sourceRows, selectedSec) {
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
      if (scope === 'external' && branchNearbyKind(kind)) { if (sameBranchCity) return false; }
      else if (!sameBranchCity && !easternCrossCity) return false;
      if (easternCrossCity && o.lat == null && o.lon == null && links[o.id] == null && !(Number(o.branchRoadDistancesKm && o.branchRoadDistancesKm[String(b.c)]) > 0)) return false;
      // Keep the canonical showroom row for cross-city Eastern results; neighboring-city clones
      // share the same map pin and number and would otherwise be counted more than once.
      if (easternCrossCity && kind === 'cars' && o.regionalListingOf) return false;
      if (kind === 'cars' && o.authorizedDealer === true) return false;
      if (kind === 'cars' && requiresReview(o.activityReviewStatus)) return false;
      if (kind === 'offices' && o.activityReviewStatus === 'closed_permanently') return false;
      if (kind === 'selfbuild' && requiresReview(o.availabilityStatus)) return false;
      if (kind === 'cars' && sameCity(b.city, 'الرياض')) {
        var area = currentCarArea(selectedSec, scope);
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
    if (branchNearbyKind(kind)) {
      var localRadius = Number(S.radius || 5), fullScope = scope === 'city' || scope === 'sector' || !sectorCity(S.branch.city) || km(S.branch.lat, S.branch.lon, S.branch.lat, S.branch.lon) == null;
      var nearbyRows = rawItems(kind, scope, sourceRows, sec).map(function (entry) {
        var d = physicalSiteDistance(entry.o), sameNeighborhood = sameBranchNeighborhood(entry.o);
        return Object.assign({}, entry, { d: d, rankD: d, distanceSource: d == null ? '' : 'branch-straight-line', sameNeighborhood: sameNeighborhood, branchLocal: sameNeighborhood || (d != null && d <= localRadius) });
      });
      if (scope === 'external') nearbyRows = nearbyRows.filter(function (entry) { return entry.d != null; });
      else if (!fullScope) nearbyRows = nearbyRows.filter(function (entry) { return entry.branchLocal; });
      if (scope === 'sector' && sectorCity(S.branch.city) && (sec || S.explore)) nearbyRows = nearbyRows.filter(function (entry) { return sectorsOf(entry.o).indexOf(sec || S.explore) >= 0; });
      return nearbyRows.sort(function (a, b) { return branchNearbyCompare(a, b, scope, kind); });
    }
    if (scope === 'unassigned' && ['projects', 'opps', 'offices'].indexOf(kind) < 0) scope = 'branch';
    if (scope === 'radius' && kind !== 'offices') scope = 'branch';
    // الشركات دليل المدينة؛ المكاتب تتبع المسافة ولا ترث اختيار قطاع من تبويب آخر.
    if (kind === 'companies') scope = 'city';
    if (!sectorCity(S.branch.city)) scope = 'city';
    if (kind === 'offices' && scope === 'radius' && !radiusApplies(kind, scope)) scope = 'city';
    var out = rawItems(kind, scope, sourceRows, sec);
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
    if (scope === 'unassigned') out = out.filter(function (x) { return !sectorsOf(x.o).length; });
    if (kind === 'projects' || kind === 'opps') {
      out.sort(function (x, y) { return byDist(x, y) || fallbackCompare(x, y, sec) || (!!y.o.img - !!x.o.img) || (!!y.o.price - !!x.o.price) || ((TIER[x.o.tier] || 0) - (TIER[y.o.tier] || 0)) || x.o.n.localeCompare(y.o.n, 'ar'); });
    } else out.sort(function (x, y) {
      if (kind === 'companies') return x.o.n.localeCompare(y.o.n, 'ar');
      if (kind === 'cars' && sameCity(S.branch.city, 'الرياض') && currentCarArea(sec, scope) === 'all') {
        var primary = primaryCarArea(S.branch, scope === 'sector' ? sec : '');
        if (primary === 'all') primary = 'qadisiyah'; // Stable group order, not a proximity claim.
        var zx = carAreaOf(x.o) === primary ? 0 : carAreaOf(x.o) ? 1 : 2;
        var zy = carAreaOf(y.o) === primary ? 0 : carAreaOf(y.o) ? 1 : 2;
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
  // Previously published market records retain their existing evidence and display eligibility.
  // This preserves visibility, not a fabricated new stock verification.
  var LEGACY_MARKET_IDS = new Set(["op-6cf8280cf2","op-c4e61f63eb","op-aa8f2b3bd7","op-9aeaeabf64","op-92d62c2952","op-9bdff30503","op-21f5bccc51","op-5046d876a5","op-e6c81c2e4c","op-d548ada844","op-bedc991b18","op-58de4e2bcb","op-91e60fc473","op-40f125b23d","op-fa16a2f12a","op-eb84ba8ffa","op-84c3053ad6","op-bf307dc814","op-e118cfc05a","op-5fa7a028e8","op-fd1da59075","op-26ef587adb","op-eadff43203","op-07bb291d20","op-b1477b528b","op-da237ec55c","op-1a41c2312e","op-0b48226878","op-c88f814722","op-bd44cf509c","op-077bc3526a","op-564e7568c3","op-3e4c921421","op-fadd906367","op-dd0ad93cb0","op-63c43386e8","op-56425058d4","op-5f18dc32da","op-2eb4c99291","op-5fce3b66f5","op-88c8c2ed5f","op-8d588a0051","op-986c367806","op-32e232cc3b","op-be848defad","op-80eac9cd1e","op-02272f177f","op-ef61c44e7e","op-bcfae3a457","op-414f44f7f2","op-106805c72b","op-0bcaf1c1da","op-8ac020632c","op-23a074185b","op-3d03edea17","op-b99a27d35e","op-bb13845a44","op-b6995209f0","op-f7e8e9db00","op-52a9e665a0","op-103c11b035","op-0b5a6ec4ab","op-20310b6845","op-7da4fc9325","op-643f167f1b","op-a90446c13e","op-4157cb7904","op-128308ca56","op-a34818568b","op-0115894542","op-d2a26058b9","op-c6f22a416f","op-19fdbf57f8","op-909fe9f5d0","op-fe7befe26f","op-3258b85f44","op-2a65b649da","op-dfce31e536","op-a173941e4b","op-0bea401f51","op-db2b9c7835","op-8bbd0d34a5","op-92fd7ad3e4","op-ed2b80d442","op-563ce097fe","op-ca23dcc86d","op-5b8475b594","op-8f45656ba8","op-0f122325c3","op-3a3a418180","op-e777502aee","op-43b49159be","op-3cb4bf24a5","op-a2a32c9749","op-534e7d4386","op-28b58c8fde","op-eb044aa634","op-e86e7ec2ab","op-e92ccbbef8","op-323b38ea7d","op-977bb7a9f8","op-823f2e492b","op-b1c78504c5","op-c06707b037","op-731f7331a3","op-65c9e34375","op-bdbadfcca1","op-f28651b1f9","op-be31b28d37","op-ee249c0e73","op-68835c3bee","op-9587621b14","op-0a45957caf","op-2ff4296152","op-e7bb2ba7af","op-98b9dc4679","op-35ccd4c6d3","op-5b2f9d8e96","op-7e5bf1194e","op-a19df42c77","op-7b49cde78f","op-af5f60f35b","op-1973b599c7","op-e66aebb960","op-a3aaeb77f1","op-a3f6104459","op-1c478fee1c","op-cb3209b493","op-94620b9b85","op-5e6ecc09ae","op-2b3d456e5e","op-79b9486379","op-087b2cb6a5","op-60b8be8855","op-e9bea16f62","op-98933e57dd","op-9a1b2afbfc","op-7bebb2ddfe","op-3c5a33128c","op-202b388197","op-52e4c45f99","op-f5a3415c84","op-a69de45595","op-08552de73e","op-4218f9a017","op-1e91bfe3f9","op-a6da8756eb","op-cbb0665a9b","op-803d74391b","op-2b376f916b","op-286e2aa544","op-5cb61b273e","op-74d92f6952","op-6e6ff7e980","op-3420ef74d3","op-f6ed802802","op-ec3e8f97e1","op-6e43273225","op-0157f690d2","op-0e80d73d6b","op-ffc986a07a","op-a7d7e3699a","op-b1633dffa8","op-b3e303b406","op-f875fc6a0d","op-a53981f866","op-e4faa097ee","op-9e6e2a99ce","op-85324fb079","op-1532cc33a4","op-d30f44f4db","op-d54b0a57b3","op-74c358905b","op-40270879a4","op-3bbfea78ba","op-680494b934","op-4b25bb1cae","op-285c66c81c","op-7612e01863","op-b4c2cbc4fc","op-168cc2fe00","op-692b8fbfab","op-72f8de5f76","op-bb95a04ca7","op-d142035d97","op-add3d9b1a0","op-01a58a294a","op-7b5ea8a4fe","op-ddafcad181","op-576126fa92","op-76d161b0fd","op-2fba998544","op-d92fc52fae","op-d339692188","op-b3268c9b8a","op-82b0bbc91c","op-03b613e713","op-7e20a8d084","op-702556dba0","op-6e9eac6b3c","op-40fac9dbc7","op-3a5cb86bbf","op-8353b25a6b","op-7e454acf64","op-e4faaab8ee","op-10eeb88c96","op-0048bb26f5","op-f0f4a94ad6","op-e96c92cd2d","op-2f7386ef59","op-88aaad32de","op-13cb693f8e","op-50729e461e","op-70f07c2af6","op-1c83f5ae7f","op-7745b17713","op-972efae72e","op-39775bf4c9","op-a6d048bab3","op-61aa6228a6","op-25b8669278","op-30ea1de6a0","op-6e0e52049b","op-cdbfb76ce9","op-37ac78807e","op-8a7ce01114","op-1bfd22e562","op-0cad70aeac","op-494444575f","op-12e497d431","op-6a937025f3","op-54d000f82c","op-05b2e03ede","op-a69531296c","op-75ec561074","op-89e26db94e","op-c1598b0cc6","op-a91c615c8a","op-fa53daaf93","op-36e7e5e056","op-d328624406","op-442b8d57e2","op-77674a123a","op-aae1e8fd21","op-6ec51fcedb","op-3b45e661df","op-475d2cbc01","op-0010b35fa2","op-8f90335d4f","op-f25f939b41","op-6884d04d6a","op-202d39f20d","op-e1452e1635","op-9e6c0941f2","op-933992854a","op-5b9794460c","op-5a881e942e","op-a085806bb1","op-161278013f","op-771251effd","op-2e190e6a82","op-9353fc8549","op-39b0202135","op-f5241bec31","op-7440d7945c","op-f4951d103e","op-92328b1308","op-a89c6d3b46","op-c9f0c9dc99","op-a4795f3188","op-8854b4dbea","op-ed773e20b1","op-d800df010f","op-0abc204d28","op-a043da207c","op-12579e1b02","op-71f7b77752","op-c5fd74f7ac","op-18441fbccc","op-662bcd3365","op-26d9446b7e","op-c18f660995","op-b4a8b8723e","op-d88b779983","op-d5de570fa9","op-793f2228e5","op-a279e28895","op-967f627346","op-ab555a121c","op-562667a5a1","op-bf63342ff2","op-d23c723eef","op-f9b808ffad","op-a1c384bef6","op-e0a60cc27f","op-15ea07b35f","op-e5c34ff39d","op-15fc701f25","op-8096a1593d","op-5d13140a30","op-604f283c23","op-2ca667f239","op-ee655a97dc","op-805a970bf9","op-7a6a28d966","op-302ae439fb","op-e85a49855d","op-ce34bb0131","op-8b0ff3346e","op-35d37a81c0","op-44dea0f520","op-217e5b4f7d","op-fcb45ad40d","op-3daaa48dc7","op-766a84b108","op-d9dcf34dc7","op-ea830c104e","op-936310dbb2","op-1088c25af9","op-d6573a899d","op-294370289a","op-f12630b9b0","op-3ef031a105","op-8e04bd683b","op-20277666bf","op-6ea7a20c21","op-afd865842c","op-8d46f9c9ec","op-27bfb7a5fe","op-539a3a6bcb","op-485979a4fa","op-9f5c9b22f0","op-336e2fa759","op-f6b536da3d","op-b6a5d916fd","op-bd5021b16b","op-b5fb9dc1c1","op-6a6f4baa62","op-1a8595cee0","op-628ed8792e","op-ab0a4c3f24","op-41e8ef082f","op-7e17e5f159","op-1ff533b54e","op-85f2f1a8fc","op-edd9dd0ca9","op-ade50945c3","op-17ab7cb78f","op-4ed2299723","op-b98410aeb2","op-91e5f4f92d","op-1a4e7f0c1b","op-67d424762c","op-fec7a04ed4","op-888709bfba","op-afea46da3e","op-4085f8f0eb","op-b326196c73","op-944b580bbf","op-e89aa0a0f1","op-1ac74ed043","op-41509c0f7c","op-9deee7f382","op-nhc-47169","op-nhc-47472","op-nhc-47631","op-nhc-47483","op-nhc-301","op-nhc-300","op-nhc-303","op-nhc-47212","op-nhc-47675","op-nhc-47650","op-nhc-47216","op-nhc-47525","op-nhc-47685","op-nhc-47318","op-nhc-47316","op-nhc-47317","op-nhc-45284","op-nhc-47501","op-senan-301520","op-senan-301522","op-senan-301380","op-senan-301512","op-senan-301371","op-nhc-47097","op-nhc-47666","op-nhc-47701","op-nhc-47700","op-senan-301381","op-senan-301513","op-senan-301515","op-karden25-abha","op-baqaa-rimal-127br-29","op-center-riyadh-yaqut-a","op-center-riyadh-yaqut-14","op-center-riyadh-makeen-66","op-center-riyadh-makeen-80","op-center-riyadh-makeen-68","op-center-riyadh-makeen-71","op-center-riyadh-refah-57","op-center-buraidah-bastatin-villas","op-center-buraidah-mughna-58","op-center-buraidah-majalat-73","op-center-buraidah-majalat-74","op-center-buraidah-samaya","op-center-buraidah-hazm-deluxe","op-center-buraidah-awad-deluxe-residence","op-center-buraidah-dar-buraidah","op-center-buraidah-safa-86","op-center-jeddah-jeddah-heights","op-center-riyadh-aljamee-40","op-center-riyadh-aljamee-50","op-center-riyadh-aljamee-45"]);
  function nonSaleState(o) {
    return ['sold_out', 'unavailable', 'interest_only', 'booking_closed', 'fully_reserved', 'prebooking', 'coming_soon'].indexOf((o.availability || {}).status) >= 0 || /مباع بالكامل|تم بيع كامل/.test(String(o.status || ''));
  }
  function displayEligible(kind, o, entry) {
    if ((o.availability || {}).status === 'sold_out' || /مباع بالكامل|تم بيع كامل/.test(String(o.status || ''))) return false;
    if (kind === 'projects') return !bankApprovalPending() && approvalIdentityVerified(o) && !!(o.bankApproval && o.bankApproval.status === 'verified' && o.bankApproval.sourceType === 'bank_approved_inventory' && String(o.bankApproval.code || '').trim() && validEvidence(o.bankApproval));
    if (kind === 'opps') return (o.availability || {}).status !== 'unverified' && !nonSaleState(o) && (!!(entry && entry.hasLegacyMarketSource) || LEGACY_MARKET_IDS.has(o.id) || !!(o.availability && o.availability.status === 'available' && validEvidence(o.availability)));
    return true;
  }
  function canonicalProjectItems(candidates) {
    var keys = {}, output = [];
    candidates.forEach(function (x) {
      var key = x.o.canonicalProjectId ? 'canonical:' + x.o.canonicalProjectId : x.o.id ? 'id:' + x.o.id : '';
      if (!key || keys[key] === undefined) { if (key) keys[key] = output.length; output.push(Object.assign({}, x, { hasLegacyMarketSource: LEGACY_MARKET_IDS.has(x.o.id) || x.hasLegacyMarketSource, hasProjectSource: x.k === 'projects' || x.hasProjectSource })); return; }
      var index = keys[key], prior = output[index];
      var oldDate = Date.parse((prior.o.availability || {}).checkedAt) || 0, newDate = Date.parse((x.o.availability || {}).checkedAt) || 0;
      // A documented newer unknown/closed state must not revive an older sale.
      var chooseNew = newDate > oldDate || (newDate === oldDate && (prior.o.availability || {}).status === 'available' && (x.o.availability || {}).status !== 'available');
      var chosen = chooseNew ? x : prior, other = chooseNew ? prior : x;
      var approval = chosen.o.bankApproval, otherApproval = other.o.bankApproval;
      if (otherApproval && (!approval || (Date.parse(otherApproval.checkedAt) || 0) > (Date.parse(approval.checkedAt) || 0))) approval = otherApproval;
      // Merge approval evidence only after an explicit identity match, never by names or URLs.
      output[index] = Object.assign({}, chosen, { hasLegacyMarketSource: prior.hasLegacyMarketSource || LEGACY_MARKET_IDS.has(x.o.id) || x.hasLegacyMarketSource, hasProjectSource: prior.hasProjectSource || x.k === 'projects' || x.hasProjectSource, o: approval && approval !== chosen.o.bankApproval ? Object.assign({}, chosen.o, { bankApproval: approval }) : chosen.o });
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
    var resolved = (resolvedRows || allCanonicalProjects()).filter(function (x) { return (kind !== 'projects' || x.hasProjectSource) && include(x.o, x); });
    var output = [];
    ['opps', 'projects'].forEach(function (sourceKind) {
      var rows = resolved.filter(function (x) { return x.k === sourceKind; }).map(function (x) { return x.o; });
      output = output.concat(itemsFor(sourceKind, sec, scope, rows).map(function (x) { return Object.assign({}, x, { k: sourceKind }); }));
    });
    return output.sort(function (a, b) { return branchNearbyCompare(a, b, scope || S.scope, kind); });
  }
  function visibleItemsFor(kind, sec, scope, resolvedRows) {
    if (kind !== 'opps' && kind !== 'projects') return itemsFor(kind, sec, scope);
    return scopedProjectItems(kind, sec, scope, function (o, entry) { return displayEligible(kind, o, entry); }, resolvedRows);
  }
  function verificationPending(kind, o, entry) {
    if (kind !== 'projects' && kind !== 'opps') return false;
    // Known non-sale states are not a verification queue. Unknown records never
    // enter the public confirmed list or increase its count.
    if (nonSaleState(o)) return false;
    var approval = o.bankApproval || {};
    if (kind === 'projects' && ['rejected', 'not_approved', 'revoked'].indexOf(approval.status) >= 0) return false;
    return !displayEligible(kind, o, entry);
  }
  function pendingItemsFor(kind, sec, scope, resolvedRows) {
    if (kind === 'selfbuild') return (D.selfbuild || []).filter(function (o) { return sameCity(o.city, S.branch.city) && requiresReview(o.availabilityStatus); }).map(function (o) { return { k: kind, o: o, d: dist(o) }; });
    if (kind !== 'projects' && kind !== 'opps') return [];
    return scopedProjectItems(kind, sec, scope, function (o, entry) { return verificationPending(kind, o, entry); }, resolvedRows);
  }
  function pendingLabel(kind) {
    return kind === 'projects' && bankApprovalPending() ? 'بانتظار قائمة المشاريع المعتمدة' : 'جارٍ التحقق من الفرص في هذا النطاق';
  }
  function destinationGroups(sec) {
    var b = S.branch, selected = sec || b.sec || '';
    var all = itemsFor('nhc', '', 'city');
    if (!sectorCity(b.city)) {
      var strategy = D.city_strategy[b.city] || D.city_strategy[cityLabel(b.city)] || {};
      var supported = ['metro_support', 'nearby_auto_if_category_sparse'].indexOf(strategy.mode) >= 0 && strategy.support && !sameCity(strategy.support, b.city);
      var alternatives = supported ? (D.nhc || []).filter(function (o) { return sameCity(o.city, strategy.support); }).map(function (o) {
        var d = distanceFromBranch(o, S.origin || b);
        return { o: o, d: d, rankD: d, nearbyDestination: true };
      }).filter(function (x) { return x.d != null; }).sort(byDist).slice(0, 2) : [];
      // The pre-existing nearby discovery radius also applies when the city strategy
      // has no destination in its support city. Never fill a gap with a remote city.
      if (!all.length && !alternatives.length) alternatives = (D.nhc || []).filter(function (o) { return !sameCity(o.city, b.city); }).map(function (o) {
        var d = distanceFromBranch(o, S.origin || b);
        return { o: o, d: d, rankD: d, nearbyDestination: true };
      }).filter(function (x) { return x.d != null && x.d <= 15; }).sort(byDist).slice(0, 2);
      return { local: all, nearby: alternatives, fallback: !all.length && alternatives.length > 0, selected: cityLabel(b.city), crossCity: alternatives.length > 0 };
    }
    if (!selected) return { local: all, nearby: [], fallback: false, selected: selected };
    var anchor = S.scope === 'sector' ? sectorAnchor(b.city, selected, S.origin || b) : (S.origin || b);
    var local = all.filter(function (x) { return sectorsOf(x.o).indexOf(selected) >= 0; });
    var nearby = all.filter(function (x) { return sectorsOf(x.o).indexOf(selected) < 0; }).map(function (x) {
      var d = distanceFromBranch(x.o, anchor);
      return Object.assign({}, x, { d: d, rankD: d, nearbyDestination: true });
    }).filter(function (x) { return x.d != null; }).sort(byDist).slice(0, 2);
    local = local.map(function (x) { var d = distanceFromBranch(x.o, anchor); return Object.assign({}, x, { d: d, rankD: d }); }).sort(byDist);
    return { local: local, nearby: nearby, fallback: !local.length && nearby.length > 0, selected: selected };
  }
  // كل الأرقام والقوائم تُحسب من جديد في كل عرض — لا تخزين مؤقت بين الفروع
  function compute() {
    var sec = activeSector(), out = {}, resolvedRows = allCanonicalProjects();
    SECTIONS.forEach(function (k) {
      if (k === 'nearby') { var n = nearbyItems(); out[k] = { items: n, total: n.length }; return; }
      out[k] = { items: visibleItemsFor(k, sec, null, resolvedRows), total: visibleItemsFor(k, sec, 'city', resolvedRows).length, pending: pendingItemsFor(k, sec, null, resolvedRows) };
    });
    var destinations = destinationGroups(sec);
    out.nhc.local = destinations.local; out.nhc.nearby = destinations.nearby; out.nhc.fallback = destinations.fallback; out.nhc.selectedSector = destinations.selected; out.nhc.crossCity = destinations.crossCity; out.nhc.localTotal = out.nhc.total;
    if (destinations.crossCity) out.nhc.total += destinations.nearby.length;
    out.nhc.items = S.scope === 'city' && sectorCity(S.branch.city) ? visibleItemsFor('nhc', '', 'city') : S.nhcView === 'nearby' && destinations.nearby.length ? destinations.nearby : (destinations.local.length ? destinations.local : destinations.nearby.slice(0, 1));
    return out;
  }
  window.__rogQA = function () {
    var c = compute(), o = { branch: S.branch && S.branch.c, branchSec: S.branch && S.branch.sec, scope: S.scope, explore: S.explore, active: activeSector(), sections: {}, pendingCounts: {}, bankApprovalPending: bankApprovalPending(), releaseCounts: { approved: bankApprovalPending() ? null : c.projects.items.length, available: c.opps.items.length } };
    SECTIONS.forEach(function (k) { o.sections[k] = c[k].items.map(function (x) { return x.o.id || x.o.n; }); o.pendingCounts[k] = (c[k].pending || []).length; });
    o.nhcScope = { local: c.nhc.local.map(function (x) { return x.o.id || x.o.n; }), nearby: c.nhc.nearby.map(function (x) { return { name: x.o.n, city: x.o.city, distanceKm: x.d }; }), fallback: c.nhc.fallback, crossCity: !!c.nhc.crossCity };
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
  "الباحة": {
    "src": "assets/images/cities/al-baha-cc0.webp",
    "position": "50% 52%",
    "real": true,
    "displayPermission": "CC0"
  },
  "الخبر": {
    "src": "assets/images/cities/khobar-authentic-city.webp",
    "position": "50% 55%",
    "mobilePosition": "50% 55%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY_2.0_linked_credit",
    "creditAnchor": "verified-wide-khobar-20261028"
  },
  "جدة": {
    "src": "assets/images/cities/jeddah-pexels-night.webp",
    "position": "65% 65%",
    "real": true,
    "displayPermission": "pexels_license"
  },
  "الظهران": {
    "src": "assets/images/cities/dhahran-authentic-campus.webp",
    "position": "50% 70%",
    "mobilePosition": "50% 70%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY-SA_4.0_linked_credit",
    "creditAnchor": "verified-wide-dhahran-20261028"
  },
  "الجبيل": {
    "src": "assets/images/cities/jubail-pexels.webp",
    "position": "65% 55%",
    "real": true,
    "displayPermission": "pexels_license"
  },
  "ينبع": {
    "src": "assets/images/cities/yanbu-authentic-waterfront.webp",
    "position": "50% 30%",
    "mobilePosition": "50% 32%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY-SA_4.0_linked_credit",
    "creditAnchor": "verified-wide-yanbu-20261028"
  },
  "بريدة": {
    "src": "assets/images/cities/buraidah-selected-spa.webp",
    "position": "50% 55%",
    "mobilePosition": "50% 55%",
    "fit": "cover",
    "real": true,
    "displayPermission": "user_selected_copyrighted_source",
    "creditAnchor": "buraidah-selected-spa-20261028"
  },
  "الرياض": {
    "src": "assets/images/city-riyadh.webp",
    "position": "50% 50%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "أبها": {
    "src": "assets/images/cities/abha.webp",
    "position": "50% 52%",
    "real": true,
    "displayPermission": "CC0"
  },
  "مكة المكرمة": {
    "src": "assets/images/cities/makkah.webp",
    "position": "50% 52%",
    "real": true,
    "displayPermission": "CC0"
  },
  "المدينة المنورة": {
    "src": "assets/images/cities/madinah-panorama.webp",
    "position": "50% 45%",
    "real": true,
    "displayPermission": "public_domain"
  }
};
  // BEGIN GENERATED CITY IDENTITIES
  var GENERATED_CITY_IDENTITIES = {
  "عنيزة": {
    "src": "assets/images/cities/unaizah-ringroad.webp",
    "position": "50% 50%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC BY-SA 4.0_linked_credit",
    "creditAnchor": "verified-unaizah-ringroad"
  },
  "الخرج": {
    "src": "assets/images/cities/kharj.webp",
    "position": "50% 50%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC BY-SA 4.0_linked_credit",
    "creditAnchor": "verified-kharj"
  },
  "الدرعية": {
    "src": "assets/images/cities/diriyah-real-cc0.jpg",
    "position": "50% 30%",
    "real": true,
    "displayPermission": "CC0"
  },
  "البكيرية": {
    "src": "assets/images/cities/bukayriyah-panorama-faithful.webp",
    "position": "50% 50%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": false,
    "displayPermission": "generated_illustration",
    "creditAnchor": "enhanced-bukayriyah-20261028"
  },
  "الدوادمي": {
    "src": "assets/images/cities/dawadmi-palace-real.jpg",
    "position": "50% 25%",
    "mobilePosition": "50% 25%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY-SA4_0_linked_credit",
    "creditAnchor": "verified-continuation-dawadmi-palace-real"
  },
  "الغاط": {
    "src": "assets/images/cities/ghat-mosque-real.jpg",
    "position": "50% 55%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY_2_0_linked_credit",
    "creditAnchor": "verified-ghat-mosque-real"
  },
  "المجمعة": {
    "src": "assets/images/cities/majmaah-panorama-faithful.webp",
    "position": "50% 50%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": false,
    "displayPermission": "generated_illustration",
    "creditAnchor": "enhanced-majmaah-20261028"
  },
  "المذنب": {
    "src": "assets/images/cities/spa-city-2551563.jpg",
    "position": "50% 50%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY_SA_4_0_linked_credit",
    "creditAnchor": "verified-spa-2551563"
  },
  "الدلم": {
    "src": "assets/images/cities/dilam-panorama-faithful.webp",
    "position": "50% 50%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": false,
    "displayPermission": "generated_illustration",
    "creditAnchor": "enhanced-dilam-20261028"
  },
  "الرس": {
    "src": "assets/images/cities/rass-shinana-real.jpg",
    "position": "50% 48%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY_2_0_linked_credit",
    "creditAnchor": "verified-rass-shinana"
  },
  "الارطاوية": {
    "src": "assets/images/cities/generated/central-artawiyah.webp",
    "position": "50% 58%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "رياض الخبراء": {
    "src": "assets/images/cities/generated/central-riyad-al-khabra.webp",
    "position": "50% 68%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "المزاحمية": {
    "src": "assets/images/cities/muzahimiyah-panorama-faithful.webp",
    "position": "50% 50%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": false,
    "displayPermission": "generated_illustration",
    "creditAnchor": "enhanced-muzahimiyah-20261028"
  },
  "القويعية": {
    "src": "assets/images/cities/quwayiyah-musher-real.jpg",
    "position": "50% 50%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY-SA4_0_linked_credit",
    "creditAnchor": "verified-continuation-quwayiyah-musher-real"
  },
  "وادي الدواسر": {
    "src": "assets/images/cities/wadi-dawasir-panorama-faithful.webp",
    "position": "50% 70%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": false,
    "displayPermission": "generated_illustration",
    "creditAnchor": "enhanced-wadi-dawasir-20261028"
  },
  "السليل": {
    "src": "assets/images/cities/sulayyil-park-real.jpg",
    "position": "50% 50%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC0",
    "creditAnchor": "verified-continuation-sulayyil-park-real"
  },
  "الزلفي": {
    "src": "assets/images/cities/zulfi-panorama-faithful.webp",
    "position": "50% 70%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": false,
    "displayPermission": "generated_illustration",
    "creditAnchor": "enhanced-zulfi-20261028"
  },
  "حوطة سدير": {
    "src": "assets/images/cities/generated/central-hawtat-sudair.webp",
    "position": "50% 60%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "ضرما": {
    "src": "assets/images/cities/dhurma-heritage-real.jpg",
    "position": "50% 50%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY-SA4_0_linked_credit",
    "creditAnchor": "verified-continuation-dhurma-heritage-real"
  },
  "شقراء": {
    "src": "assets/images/cities/shaqra-gate-real.jpg",
    "position": "50% 55%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY_2_0_linked_credit",
    "creditAnchor": "verified-shaqra-gate-real"
  },
  "ليلى": {
    "src": "assets/images/cities/city-real-15133211720.jpg",
    "position": "50% 55%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC BY-SA 2.0_linked_credit",
    "creditAnchor": "verified-city-real-15133211720"
  },
  "تبوك": {
    "src": "assets/images/cities/tabuk-panorama-faithful.webp",
    "position": "50% 55%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": false,
    "displayPermission": "generated_illustration",
    "creditAnchor": "enhanced-tabuk-20261028"
  },
  "حائل": {
    "src": "assets/images/cities/hail-panorama-faithful.webp",
    "position": "50% 50%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": false,
    "displayPermission": "generated_illustration",
    "creditAnchor": "enhanced-hail-20261028"
  },
  "سكاكا": {
    "src": "assets/images/cities/sakaka-zabal-real.jpg",
    "position": "50% 35%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY_2_0_linked_credit",
    "creditAnchor": "verified-sakaka-zabal"
  },
  "دومة الجندل": {
    "src": "assets/images/cities/dumat-jandal-panorama-faithful.webp",
    "position": "50% 50%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": false,
    "displayPermission": "generated_illustration",
    "creditAnchor": "enhanced-dumat-jandal-20261028"
  },
  "خيبر": {
    "src": "assets/images/cities/khaybar-qamus-real.jpg",
    "position": "50% 75%",
    "mobilePosition": "50% 75%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY-SA4_0_linked_credit",
    "creditAnchor": "verified-continuation-khaybar-qamus-real"
  },
  "الدمام": {
    "src": "assets/images/cities/dammam.webp",
    "position": "50% 50%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC BY 3.0 PL_linked_credit",
    "creditAnchor": "verified-dammam"
  },
  "الأحساء": {
    "src": "assets/images/cities/ahsa-hofuf.webp",
    "position": "50% 50%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC BY-SA 4.0_linked_credit",
    "creditAnchor": "verified-ahsa-hofuf"
  },
  "حقل": {
    "src": "assets/images/cities/city-real-9625493833.jpg",
    "position": "50% 55%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC BY 2.0_linked_credit",
    "creditAnchor": "verified-city-real-9625493833"
  },
  "ضباء": {
    "src": "assets/images/cities/spa-city-2369525.jpg",
    "position": "50% 46%",
    "mobilePosition": "50% 46%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY_SA_4_0_linked_credit",
    "creditAnchor": "verified-spa-2369525"
  },
  "الوجه": {
    "src": "assets/images/cities/al-wajh-corniche-real.webp",
    "position": "50% 55%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC BY-SA 4.0_linked_credit",
    "creditAnchor": "verified-al-wajh-corniche"
  },
  "أملج": {
    "src": "assets/images/cities/spa-city-2507676.jpg",
    "position": "50% 28%",
    "mobilePosition": "50% 28%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY_SA_4_0_linked_credit",
    "creditAnchor": "verified-spa-2507676"
  },
  "سيهات": {
    "src": "assets/images/cities/saihat-corniche-real.jpg",
    "position": "50% 50%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY-SA4_0_linked_credit",
    "creditAnchor": "verified-continuation-saihat-corniche-real"
  },
  "رأس تنورة": {
    "src": "assets/images/cities/city-real-9123857748.jpg",
    "position": "50% 55%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC BY-SA 2.0_linked_credit",
    "creditAnchor": "verified-city-real-9123857748"
  },
  "الخفجي": {
    "src": "assets/images/cities/khafji-panorama-faithful.webp",
    "position": "50% 50%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": false,
    "displayPermission": "generated_illustration",
    "creditAnchor": "enhanced-khafji-20261028"
  },
  "القطيف": {
    "src": "assets/images/cities/qatif-authentic-corniche.webp",
    "position": "50% 37%",
    "mobilePosition": "50% 37%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY-SA_4.0_linked_credit",
    "creditAnchor": "verified-wide-qatif-20261028"
  },
  "عرعر": {
    "src": "assets/images/cities/arar-panorama-faithful.webp",
    "position": "50% 70%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": false,
    "displayPermission": "generated_illustration",
    "creditAnchor": "enhanced-arar-20261028"
  },
  "المبرز": {
    "src": "assets/images/cities/generated/north-east-al-mubarraz.webp",
    "position": "50% 50%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "العلا": {
    "src": "assets/images/cities/city-real-49712771757.jpg",
    "position": "50% 45%",
    "mobilePosition": "50% 45%",
    "fit": "cover",
    "real": true,
    "displayPermission": "Public Domain Work_linked_credit",
    "creditAnchor": "verified-alula-elephant-rock"
  },
  "الهفوف": {
    "src": "assets/images/cities/generated/north-east-hofuf.webp",
    "position": "50% 65%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "النعيرية": {
    "src": "assets/images/cities/generated/north-east-nuairiyah.webp",
    "position": "50% 50%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "بقيق": {
    "src": "assets/images/cities/generated/north-east-abqaiq.webp",
    "position": "50% 40%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "حفر الباطن": {
    "src": "assets/images/cities/hafar-panorama-faithful.webp",
    "position": "50% 50%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": false,
    "displayPermission": "generated_illustration",
    "creditAnchor": "enhanced-hafar-20261028"
  },
  "الرقعي": {
    "src": "assets/images/cities/generated/north-east-al-raqai.webp",
    "position": "50% 50%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "أم الحمام": {
    "src": "assets/images/cities/generated/north-east-umm-al-hammam.webp",
    "position": "50% 60%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "الثقبة": {
    "src": "assets/images/cities/generated/north-east-al-thuqbah.webp",
    "position": "50% 50%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "صفوى": {
    "src": "assets/images/cities/safwa-coast-real.jpg",
    "position": "50% 74%",
    "mobilePosition": "50% 74%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY-SA4_0_linked_credit",
    "creditAnchor": "verified-continuation-safwa-coast-real"
  },
  "القريات": {
    "src": "assets/images/cities/qurayyat-kaf-real.jpg",
    "position": "50% 50%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY-SA4_0_linked_credit",
    "creditAnchor": "verified-continuation-qurayyat-kaf-real"
  },
  "قرية العليا": {
    "src": "assets/images/cities/generated/north-east-qaryat-al-ulya-v2.webp",
    "position": "50% 50%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "طريف": {
    "src": "assets/images/cities/generated/north-east-turaif.webp",
    "position": "50% 50%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "بقعاء": {
    "src": "assets/images/cities/generated/north-east-baqaa.webp",
    "position": "50% 50%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "الروضة": {
    "src": "assets/images/cities/generated/north-east-rawdah-hail.webp",
    "position": "50% 34%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "الطائف": {
    "src": "assets/images/cities/taif-panorama-faithful.webp",
    "position": "50% 65%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": false,
    "displayPermission": "generated_illustration",
    "creditAnchor": "enhanced-taif-20261028"
  },
  "نجران": {
    "src": "assets/images/cities/najran-panorama-faithful.webp",
    "position": "50% 75%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": false,
    "displayPermission": "generated_illustration",
    "creditAnchor": "enhanced-najran-20261028"
  },
  "جازان": {
    "src": "assets/images/cities/jazan-panorama-faithful.webp",
    "position": "50% 60%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": false,
    "displayPermission": "generated_illustration",
    "creditAnchor": "enhanced-jazan-20261028"
  },
  "أبو عريش": {
    "src": "assets/images/cities/spa-city-2382886.jpg",
    "position": "50% 50%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY_SA_4_0_linked_credit",
    "creditAnchor": "verified-spa-2382886"
  },
  "النماص": {
    "src": "assets/images/cities/alnamas-panorama-faithful.webp",
    "position": "50% 70%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": false,
    "displayPermission": "generated_illustration",
    "creditAnchor": "enhanced-alnamas-20261028"
  },
  "القنفذة": {
    "src": "assets/images/cities/generated/south-west-qunfudhah-illustrative.webp",
    "position": "50% 50%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "بدر": {
    "src": "assets/images/cities/badr-panorama-faithful.webp",
    "position": "50% 65%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": false,
    "displayPermission": "generated_illustration",
    "creditAnchor": "enhanced-badr-20261028"
  },
  "بلجرشي": {
    "src": "assets/images/cities/baljurashi-panorama-faithful.webp",
    "position": "50% 50%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": false,
    "displayPermission": "generated_illustration",
    "creditAnchor": "enhanced-baljurashi-20261028"
  },
  "أحد المسارحة": {
    "src": "assets/images/cities/generated/south-west-ahad-masarihah-illustrative.webp",
    "position": "50% 40%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "خميس مشيط": {
    "src": "assets/images/cities/khamis-panorama-natural.webp",
    "position": "50% 45%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": false,
    "displayPermission": "generated_illustration",
    "creditAnchor": "enhanced-khamis-20261028"
  },
  "صامطة": {
    "src": "assets/images/cities/generated/south-west-samtah-illustrative.webp",
    "position": "50% 50%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "صبيا": {
    "src": "assets/images/cities/generated/south-west-sabya-illustrative.webp",
    "position": "50% 60%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "بيشة": {
    "src": "assets/images/cities/bisha-dam-real.jpg",
    "position": "50% 50%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY-SA4_0_linked_credit",
    "creditAnchor": "verified-continuation-bisha-dam-real"
  },
  "تربة": {
    "src": "assets/images/cities/generated/south-west-turbah-illustrative.webp",
    "position": "50% 65%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "رابغ": {
    "src": "assets/images/cities/rabigh-streetscape-real.jpg",
    "position": "50% 85%",
    "mobilePosition": "50% 85%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY3_0_linked_credit",
    "creditAnchor": "verified-continuation-rabigh-streetscape-real"
  },
  "سبت العلاية": {
    "src": "assets/images/cities/generated/south-west-sabt-alalaya-illustrative.webp",
    "position": "50% 50%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "شرورة": {
    "src": "assets/images/cities/generated/south-west-sharurah-illustrative.webp",
    "position": "50% 50%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "محايل عسير": {
    "src": "assets/images/cities/generated/south-west-muhayil-asir-illustrative.webp",
    "position": "50% 50%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "أحد رفيدة": {
    "src": "assets/images/cities/generated/south-west-ahad-rufaidah-illustrative.webp",
    "position": "50% 50%",
    "real": false,
    "displayPermission": "generated_illustration"
  },
  "بيش": {
    "src": "assets/images/cities/spa-city-2310374.jpg",
    "position": "50% 50%",
    "mobilePosition": "50% 50%",
    "fit": "cover",
    "real": true,
    "displayPermission": "CC_BY_SA_4_0_linked_credit",
    "creditAnchor": "verified-spa-2310374"
  }
};
  Object.keys(GENERATED_CITY_IDENTITIES).forEach(function (city) { CITY_HERO_ASSETS[city] = GENERATED_CITY_IDENTITIES[city]; });
  // END GENERATED CITY IDENTITIES
  function cityHeroMedia(hero) {
    if (hero.creditAnchor) {
      var photo = Object.assign({}, hero); delete photo.creditAnchor;
      return '<a class="city-photo-credit" href="assets/images/cities/credits.html#' + esc(hero.creditAnchor) + '" aria-label="حقوق الصورة ومصدرها" title="حقوق الصورة ومصدرها">' + cityHeroMedia(photo) + '</a>';
    }
    if (hero.viewBox) return '<svg class="city-photo" viewBox="' + esc(hero.viewBox) + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><image href="' + esc(hero.src) + '" width="710" height="1536" onload="this.dataset.loaded=1"></image></svg>';
    var portrait = hero.fit === 'contain', portraitSrc = portrait && location.href ? new URL(hero.src, location.href).href : hero.src;
    return (portrait ? '<span class="city-portrait-photo" style="--portrait-photo:url(&quot;' + esc(portraitSrc) + '&quot;)" aria-hidden="true">' : '') + '<img src="' + esc(hero.src) + '" alt="" decoding="async" style="object-fit:' + (hero.fit || 'cover') + ';object-position:' + hero.position + ';--city-mobile-position:' + (hero.mobilePosition || hero.position) + '" onerror="if(!this.dataset.fallback){this.dataset.fallback=1;this.src=\'' + CITY_HERO_FALLBACK + '\'}else{this.hidden=true}">' + (portrait ? '</span>' : '');
  }
  var CITY_HERO_FALLBACK = 'assets/images/city-neutral.webp';
  function scopeOptions() {
    var b = Object.assign({}, S.branch, { city: cityLabel(S.branch.city) }), k = S.tab, sc = sectorCity(b.city), options = [], selected = 'city';
    if (branchNearbyKind(k)) {
      if (sc && !b.cityOnly && km(b.lat, b.lon, b.lat, b.lon) != null) options.push(['branch', 'حول الفرع']);
      options.push(['city', sc ? 'كامل النطاق — ' + b.city : b.city]);
      if (sc) SECTORS.forEach(function (sec) { options.push(['sector:' + sec, sec + ' ' + b.city]); });
      if (km(b.lat, b.lon, b.lat, b.lon) != null) options.push(['external', 'خيارات خارج المدينة']);
      selected = S.scope === 'sector' ? 'sector:' + S.explore : S.scope === 'radius' ? 'branch' : S.scope;
      if (!options.some(function (o) { return o[0] === selected; })) selected = 'city';
    } else if (k === 'cars' && sameCity(b.city, 'الرياض')) {
      var sector = activeSector();
      var first = primaryCarArea(b, sector) === 'shifa' ? 'shifa' : 'qadisiyah';
      [first, first === 'shifa' ? 'qadisiyah' : 'shifa', 'all'].forEach(function (area) {
        options.push([area, area === 'all' ? 'كل معارض الرياض' : 'معارض ' + (area === 'shifa' ? 'الشفا' : 'القادسية')]);
      });
      selected = currentCarArea(sector, S.scope);
    } else if (k === 'companies' || k === 'selfbuild' || !sc) {
      options.push(['city', sc ? 'كل ' + b.city : b.city]);
    } else {
      if (sc && b.sec) options.push(['branch', k === 'nhc' ? 'وجهات نطاق الفرع' : b.sec + ' ' + b.city]);
      if (!sc && hasBranchCoverage(k)) options.push(['branch', 'نطاق الفرع الموثق']);
      if (sc) SECTORS.forEach(function (sec) { if (sec !== b.sec || k === 'nhc') options.push(['sector:' + sec, sec + ' ' + b.city]); });
      options.push(['city', 'كل ' + b.city]);
      if (k === 'offices' && b.lat != null && b.lon != null && !isTabuk()) options.push(['radius', 'حسب المسافة (اختياري)']);
      selected = S.scope === 'sector' ? 'sector:' + S.explore : S.scope;
      if (sc && k !== 'nhc' && selected === 'sector:' + b.sec) selected = 'branch';
      if (!options.some(function (o) { return o[0] === selected; })) selected = 'city';
    }
    return '<label class="scope-field" for="scope-select"><span>' + (k === 'cars' && sameCity(b.city, 'الرياض') ? 'نطاق المعارض' : 'نطاق العرض') + '</span><select class="select" id="scope-select"' + (options.length === 1 ? ' disabled' : '') + '>' + options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === selected ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>';
  }
  function hasSelfbuild(city) { return (D.selfbuild || []).some(function (o) { return sameCity(o.city, city); }); }
  function renderBranch(pre) {
    if (!sectorCity(S.branch.city) && S.scope !== 'external') { S.scope = 'city'; S.explore = ''; pre = null; }
    if ((PRIMARY_SECTIONS.indexOf(S.tab) < 0 && S.tab !== 'selfbuild') || (S.tab === 'selfbuild' && !hasSelfbuild(S.branch.city))) S.tab = 'opps';
    if (S.tab === 'selfbuild') { S.scope = 'city'; S.explore = ''; }
    var b = Object.assign({}, S.branch, { city: cityLabel(S.branch.city) }), c = pre || compute();
    var stats = PRIMARY_SECTIONS.map(function (k) {
      var pending = (k === 'projects' && bankApprovalPending()) || (!c[k].items.length && (c[k].pending || []).length > 0);
      var count = k === 'nhc' ? (c[k].total ? fmt(c[k].items.length) + ' من ' + fmt(c[k].total) : '0') : (pending ? '—' : fmt(c[k].items.length));
      var countLabel = k === 'nhc' ? c[k].items.length + ' وجهات معروضة من أصل ' + c[k].total : (pending ? pendingLabel(k) : '');
      return '<button class="stat" data-tab="' + k + '" aria-pressed="' + (S.tab === k) + '" aria-controls="content"><b class="num' + (k === 'nhc' ? ' nhc-stat-count' : '') + '"' + (countLabel ? ' aria-label="' + esc(countLabel) + '"' : '') + '>' + count + '</b><span>' + esc(LABEL[k]) + '</span></button>';
    }).join('');
    var selfbuildLink = hasSelfbuild(b.city) ? '<div class="secondary-discovery"><button class="btn selfbuild-link" data-tab="selfbuild" aria-controls="content" aria-pressed="' + (S.tab === 'selfbuild') + '">' + ICON.selfbuild + 'البناء الذاتي</button></div>' : '';
    var headingSector = S.tab !== 'companies' && S.tab !== 'selfbuild' && S.scope !== 'city' && S.scope !== 'unassigned' && sectorCity(b.city) ? (activeSector() || b.sec || '') : '';
    var hero = CITY_HERO_ASSETS[b.city] || CITY_HERO_ASSETS[S.branch.city] || { src: CITY_HERO_FALLBACK, position: '50% 50%', real: false };
    app.innerHTML = '<div class="results-shell wrap"><section class="city-hero' + (hero.creditAnchor ? ' has-photo-credit' : '') + (hero.displayPermission === 'user_selected_copyrighted_source' ? ' selected-source-hero' : '') + '" aria-label="' + esc(b.city) + '">' + cityHeroMedia(hero) + '<div class="city-hero-copy">' + '<p class="greet">' + (S.employee ? esc(employeeGreeting(S.employee)) : 'مرحبًا بك') + '</p><div class="hero-branch">' + ICON.map + '<span>' + esc(b.n) + (b.cityOnly ? '' : ' · ' + (b.codeStatus === 'local_internal_reference' ? 'مرجع داخلي ' : '') + esc(b.c)) + '</span></div></div></section>' +
      '<div class="page-title"><h1>فرص ' + esc([headingSector, b.city].filter(Boolean).join(' ')) + '</h1><button class="btn change-branch" data-act="change">' + ICON.swap + 'تغيير الفرع</button></div>' +
      '<div class="discovery-controls">' + scopeOptions() + '<div class="search">' + ICON.search + '<input id="q-sec" class="input" type="search" placeholder="' + esc(SEARCH_PH[S.tab]) + '" value="' + esc(S.q[S.tab] || '') + '" aria-label="' + esc(SEARCH_PH[S.tab]) + '"></div></div>' +
      '<div class="stats" role="group" aria-label="الفئات الرئيسية">' + stats + '</div>' + selfbuildLink + '<main class="content" id="content" aria-live="polite"></main></div>';
    var scope = document.getElementById('scope-select');
    if (scope) scope.addEventListener('change', function () {
      var value = scope.value;
      if (S.tab === 'cars' && sameCity(b.city, 'الرياض')) { S.carArea = value; if (S.scope === 'city') S.scope = 'branch'; }
      else if (value.indexOf('sector:') === 0) { S.scope = 'sector'; S.explore = value.slice(7); S.carArea = ''; }
      else { S.scope = value; S.explore = ''; S.carArea = ''; }
      S.nhcView = 'local'; S.q[S.tab] = ''; S.limit[S.tab] = CFG.pageSize; renderBranch();
    });
    var qi = document.getElementById('q-sec');
    if (qi) qi.addEventListener('input', function () { S.q[S.tab] = qi.value; S.limit[S.tab] = CFG.pageSize; renderSection(); });
    renderSection(c);
  }

  function renderSection(pre) {
    REG.length = 0; renderRevision++;
    var c = pre || compute(), k = S.tab, el = document.getElementById('content'), b = Object.assign({}, S.branch, { city: cityLabel(S.branch.city) });
    var all = c[k] ? c[k].items : [], items = filterQuery(k, all), limit = S.limit[k] || CFG.pageSize, shown = items.slice(0, limit);
    var catalogPending = k === 'projects' && bankApprovalPending();
    var pending = catalogPending || (!items.length && filterQuery(k, c[k].pending || []).length > 0);
    var summary = k === 'nhc' ? (c.nhc.total ? fmt(all.length) + ' من ' + fmt(c.nhc.total) + (c.nhc.crossCity ? '' : ' في ' + b.city) : 'لا توجد وجهات مسجلة في ' + b.city) : intro(k, items.length, items);
    var head = '<div class="sec-head"><div><h2>' + esc(LABEL[k]) + '</h2>' + (pending ? '' : '<p' + (k === 'nhc' ? ' class="nhc-count-summary"' : '') + '>' + esc(summary) + '</p>') + '</div>';
    if (branchNearbyKind(k) && radiusApplies(k, S.scope)) head += '<label class="radius-field" for="radius">المسافة<select class="select" id="radius">' + [5,10,15,20].map(function (r) { return '<option value="' + r + '"' + (Number(S.radius) === r ? ' selected' : '') + '>ضمن ' + r + ' كم</option>'; }).join('') + '</select></label>';
    head += '</div>';
    if (k === 'nhc' && (sectorCity(b.city) || c.nhc.crossCity) && c.nhc.selectedSector) {
      var nhcSector = c.nhc.selectedSector;
      head += '<div class="nhc-alternatives" role="group" aria-label="نطاق وجهات NHC"><button class="btn" data-nhc-view="local" aria-pressed="' + ((S.scope !== 'city' || c.nhc.crossCity) && S.nhcView !== 'nearby') + '">وجهات ' + esc(nhcSector) + ' <span class="num">' + fmt(c.nhc.local.length) + '</span></button><button class="btn" data-nhc-view="nearby" aria-pressed="' + ((S.scope !== 'city' || c.nhc.crossCity) && S.nhcView === 'nearby') + '"' + (!c.nhc.nearby.length ? ' disabled' : '') + '>وجهات أخرى <span class="num">' + fmt(c.nhc.nearby.length) + '</span></button>' + (c.nhc.crossCity ? '' : '<button class="btn" data-nhc-view="city">كل وجهات ' + esc(b.city) + ' <span class="num">' + fmt(c.nhc.localTotal) + '</span></button>') + '</div>';
    }
    var body;
    if (pending) body = '<div class="empty ' + (catalogPending ? 'approval-pending' : 'verification-pending') + '" role="status"><h3>' + esc(pendingLabel(k)) + '</h3>' + (catalogPending ? '' : '<p>ستظهر الفرص بعد اكتمال التحقق.</p>') + '</div>';
    else if (!all.length && !norm(S.q[k] || '')) {
      var isGated = k === 'projects' || k === 'opps';
      body = '<div class="empty"><span class="empty-icon">' + ICON[k] + '</span><h3>' + (isGated ? 'لا توجد سجلات معروضة في هذا النطاق' : 'لا توجد نتائج مسجلة في هذا النطاق') + '</h3></div>';
    } else if (!items.length) body = '<div class="empty"><h3>لا نتائج مطابقة</h3><p>جرّب اسمًا أو حيًا آخر.</p></div>';
    else {
      var visual = k === 'projects' || k === 'nhc' || k === 'opps';
      body = '<div class="grid' + (visual ? '' : ' list') + '">' + shown.map(function (x) { return card(x.k || k, x.o, k === 'companies' && x.displayD !== undefined ? x.displayD : x.d, false, false, x); }).join('') + '</div>';
      if (branchNearbyKind(k) && shown.length) {
        var lastGroup = '';
        body = '<div class="grid' + (visual ? '' : ' list') + '">' + shown.map(function (entry) {
          var group = S.scope === 'external' ? entry.o.city : entry.branchLocal ? 'في محيط الفرع' : (sectorCity(b.city) && b.sec && sectorsOf(entry.o).indexOf(b.sec) >= 0 ? 'بقية ' + b.sec + ' ' + b.city : 'خيارات أخرى في ' + b.city);
          var heading = group !== lastGroup ? '<h3 class="scope-group-heading" style="grid-column:1/-1">' + esc(group) + '</h3>' : '';
          lastGroup = group;
          return heading + card(entry.k || k, entry.o, entry.d, S.scope === 'external', false, entry);
        }).join('') + '</div>';
      }
      if (k === 'cars' && sameCity(b.city, 'الرياض') && currentCarArea(activeSector(), S.scope) === 'all') body = riyadhCarGroupsHTML(shown);
      body += '<div class="pagination">' + (items.length > shown.length ? '<button class="btn load-more" data-more="' + k + '">عرض المزيد</button>' : '') + '<p>عرض <span class="num">' + fmt(shown.length) + '</span> من <span class="num">' + fmt(items.length) + '</span></p></div>';
    }
    if (branchNearbyKind(k)) {
      var localScope = sectorCity(b.city) && (S.scope === 'branch' || S.scope === 'radius');
      if (localScope) body += '<div class="more-row"><button class="btn" data-scope="city">كامل النطاق — ' + esc(b.city) + ' <span class="num">' + fmt(c[k].total) + '</span></button></div>';
      if (!all.length && localScope) body += '<p class="sub">لا توجد نتائج في هذا المحيط. تصفح كامل النطاق.</p>';
    }
    if (k === 'cars' && sameCity(b.city, 'الرياض')) {
      var selectedArea = currentCarArea(activeSector(), S.scope);
      if (selectedArea !== 'all') {
        var otherArea = selectedArea === 'qadisiyah' ? 'shifa' : 'qadisiyah';
        var otherRows = visibleItemsFor('cars', '', 'city').filter(function (x) { return carAreaOf(x.o) === otherArea; });
        var otherMatches = filterQuery('cars', otherRows).length;
        var cityCarRows = visibleItemsFor('cars', '', 'city');
        var hasOtherCityVenues = cityCarRows.some(function (x) { return !carAreaOf(x.o); });
        body += '<div class="car-alternative more-row"><button class="btn" data-car-area="' + otherArea + '">الاطلاع على معارض ' + esc(carGroupName(otherArea)) + ' <span class="num">' + fmt(otherRows.length) + '</span></button>' + (hasOtherCityVenues ? '<button class="btn" data-car-area="all">كل معارض الرياض <span class="num">' + fmt(cityCarRows.length) + '</span></button>' : '') + (norm(S.q.cars || '') ? '<p class="sub">' + fmt(otherMatches) + ' نتيجة مطابقة للبحث في المجموعة الأخرى</p>' : '') + '</div>';
      } else {
        var allRows = visibleItemsFor('cars', '', 'city');
        var firstArea = primaryCarArea(S.branch, activeSector()) === 'shifa' ? 'shifa' : 'qadisiyah';
        var chooser = '<div class="car-group-chooser more-row" aria-label="الانتقال إلى مجموعة معارض محددة">' + [firstArea, firstArea === 'shifa' ? 'qadisiyah' : 'shifa'].map(function (area) {
          var rows = allRows.filter(function (x) { return carAreaOf(x.o) === area; });
          return '<button class="btn" data-car-area="' + area + '">الاطلاع على معارض ' + esc(carGroupName(area)) + ' <span class="num">' + fmt(rows.length) + '</span></button>';
        }).join('') + '</div>';
        // Both groups are reachable on page one, before any pagination action.
        body = body.indexOf('<div class="pagination">') >= 0 ? body.replace('<div class="pagination">', chooser + '<div class="pagination">') : body + chooser;
      }
    }
    el.innerHTML = head + body;
    bindImages(el);
    var radius = document.getElementById('radius');
    if (radius) radius.addEventListener('change', function () { S.radius = Number(radius.value) || 5; S.limit[k] = CFG.pageSize; renderBranch(); });
  }
  // أزرار التوسيع: أوسع ← قطاع الفرع ← كل المدينة، مع عدد ما سيظهر في كل منها
  function widen(k, c) {
    var b = S.branch, h = '';
    
    if (k !== 'offices' && cityScopeAvailable(k) && sectorCity(b.city) && b.sec && S.scope !== 'sector') h += '<button class="btn" data-explore="' + esc(b.sec) + '">' + esc(b.sec) + ' ' + esc(b.city) + ' · <span class="num">' + fmt(itemsFor(k, b.sec, 'sector').length) + '</span></button>';
    if (cityScopeAvailable(k)) h += '<button class="btn primary" data-scope="city">كل ' + esc(b.city) + ' · <span class="num">' + fmt(c[k].total) + '</span></button>';
    return '<div class="more-row">' + h + '</div>';
  }
  function intro(k, n, rows) {
    var b = Object.assign({}, S.branch, { city: cityLabel(S.branch.city) });
    if (branchNearbyKind(k)) {
      if (S.scope === 'external') return fmt(n) + ' ' + NOUN[k] + ' خارج ' + b.city;
      if (sectorCity(b.city) && (S.scope === 'branch' || S.scope === 'radius')) return fmt(n) + ' ' + NOUN[k] + ' في محيط الفرع · ' + fmt(S.radius) + ' كم';
      return fmt(n) + ' ' + NOUN[k] + ' في ' + (activeSector() ? activeSector() + ' ' : '') + b.city;
    }
    if (S.scope === 'unassigned') return fmt(n) + ' ' + NOUN[k] + ' في ' + b.city + ' لم يحدد نطاقها';
    if (k === 'companies') return fmt(n) + ' شركة تخدم ' + b.city;
    if ((k === 'projects' || k === 'opps') && sectorCity(b.city) && (activeSector() || b.sec) && S.scope !== 'city') return fmt(n) + ' ' + NOUN[k] + ' في ' + (activeSector() || b.sec) + ' ' + b.city + (S.branch.lat != null && S.branch.lon != null ? ' · الأقرب أولًا' : '');
    if (k === 'projects' && S.scope === 'branch' && radiusApplies(k, 'branch') && rows) {
      return fmt(n) + ' مشروعًا ضمن نطاق الفرع';
    }
    if (k === 'cars' && sameCity(b.city, 'الرياض')) {
      var area = currentCarArea(activeSector(), S.scope);
      return area === 'all' ? fmt(n) + ' معرضًا في الرياض — مرتبة حسب مجموعات المعارض' : fmt(n) + ' معرضًا في ' + carGroupName(area) + ' · تتوفر المجموعة الأخرى أدناه';
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
  var GENERIC_PROPERTY_IMAGE = 'assets/images/modern-apartments-illustrative.webp';
  // Last-resort decorative image is embedded so a missing asset cannot leave a broken card.
  var EMBEDDED_PROPERTY_FALLBACK = 'data:image/webp;base64,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';
  var PROPERTY_ILLUSTRATIONS = [GENERIC_PROPERTY_IMAGE, 'assets/images/modern-villa-illustrative.webp', GENERIC_PROPERTY_IMAGE, 'assets/images/modern-villa-illustrative.webp'];
  function imageFallback(kind, o) {
    var type = String(o && o.type || '');
    if (/شقق|استديو/i.test(type)) return 'assets/images/modern-apartments-simple-illustrative.png';
    if (/تاون|دوبلكس|متصل/i.test(type)) return 'assets/images/modern-villa-simple-illustrative.png';
    if (/فلل|فيلا/i.test(type)) return 'assets/images/modern-villa-simple-illustrative.png';
    return GENERIC_PROPERTY_IMAGE;
  }
  function ph(title, sub, kind, o) {
    return '<img class="property-image" loading="lazy" decoding="async" alt="صورة عقارية توضيحية وليست تصويرًا للمشروع" data-generic="1" data-src="' + esc(imageFallback(kind, o)) + '">';
  }
  // Exact-source visual review: prefer verified project renders, reject logos/maps/text cards.
  var REVIEWED_PROJECT_IMAGES = {
    "P496": ["https://cms-apis.liwan.sa/media/4ialr1bx/liwan-render_page-0002.jpg", "https://cms-apis.liwan.sa/media/4ialr1bx/liwan-render_page-0002.jpg?width=1920&format=webp&quality=75&v=1dc63f1437bd790"],
    "P111": [
        "https://azyanaldhahran.com/wp-content/uploads/2025/02/Dhahran-Golden-1.png",
        "https://azyanaldhahran.com/wp-content/uploads/2026/01/TYPE-A-FRONT-01.png"
    ],
    "P234": [
        "https://darwaemaar.com/wp-content/uploads/2023/07/Buhirat-copy-logo-1-1024x580.png",
        "https://darwaemaar.com/wp-content/uploads/2023/07/X2-copy-People-scaled.jpg"
    ],
    "P437": [
        "https://storage.googleapis.com/marcom-roshn-sa-cms-prod/212_WAREFA_01_20dd70f863/212_WAREFA_01_20dd70f863.svg",
        "https://storage.googleapis.com/marcom-roshn-sa-cms-prod/1806_J_02_S3_Pocket_Park_Hummingbird_R7_8_K_1_baab970dd1/1806_J_02_S3_Pocket_Park_Hummingbird_R7_8_K_1_baab970dd1.png"
    ]
};
  var NON_PROJECT_IMAGE_SOURCES = {
    "https://alajlaninvest.com/wp-content/uploads/2024/01/Riv-27.jpg": true,
    "https://aknann.com/wp-content/uploads/2025/03/alawali%404x.png": true,
    "https://aknann.com/wp-content/uploads/2025/03/heights@4x.png": true,
    "https://aknann.com/wp-content/uploads/2025/04/fursan@4x.png": true,
    "https://aknann.com/wp-content/uploads/2025/04/sharq@4x.png": true,
    "https://alajlaninvest.com/wp-content/uploads/2021/11/riv34-scaled.jpg": true,
    "https://alajlaninvest.com/wp-content/uploads/2022/03/riv42-scaled.jpg": true,
    "https://azyanaldhahran.com/wp-content/uploads/2025/02/Dhahran-Golden-1.png": true,
    "https://cdn.sanity.io/images/9wslge8c/production/75f1e37dc7b8372d9da160a93d07196e407dc906-2656x1784.png": true,
    "https://darwaemaar.com/wp-content/uploads/2023/07/Buhirat-copy-logo-1-1024x580.png": true,
    "https://dor.sa/wp-content/uploads/2017/11/alsakab-video-1100x550.jpg": true,
    "https://momah.gov.sa/sites/default/files/styles/news_details_image/public/2022-04/alwtnyt-llaskan-tutlq-ghdaan-almrhlt-althanyt-lmshrw-sraya-aljwan-shmal-alryad-min.jpg.webp": true,
    "https://nuzul-saas-production.s3.us-east-2.amazonaws.com/tenants/5201/t-projects/301021/8a653ed1-138b-4310-99a4-909cc09da10f_1080.webp": true,
    "https://ruh-s3.bluvalt.com/api-nhc.sa/s3fs-public/2024-11/Album%20size_0.jpg": true,
    "https://ruh-s3.bluvalt.com/api-nhc.sa/s3fs-public/2025-01/alsadeem.png": true,
    "https://sakanun.com.sa/lib/images/fairooz.png": true,
    "https://storage.googleapis.com/marcom-roshn-sa-cms-prod/SEDRA_5new_fc4cffb3d1/SEDRA_5new_fc4cffb3d1.jpg": true,
    "https://storage.googleapis.com/marcom-roshn-sa-cms-prod/sedra_4th_432c709c57/sedra_4th_432c709c57.png": true,
    "https://teladco.sa/wp-content/uploads/2026/05/news-5-1.jpg": true,
    "https://thabatre.sa/wp-content/uploads/2024/12/%D9%85%D8%A8%D8%A7%D8%B9-01.png": true,
    "https://www.alhabibinv.com/DynamicImages/HighlightsImages/Pic-M-12-638834047350310419.webp": true
};
  function displayImage(kind, o) {
    var url = String(o && o.img || ''), id = String(o && o.id || ''), decoded = url;
    try { decoded = decodeURIComponent(url); } catch (e) { /* keep the source URL */ }
    var reviewed = REVIEWED_PROJECT_IMAGES[id];
    if (reviewed && url === reviewed[0]) return reviewed[1];
    if (NON_PROJECT_IMAGE_SOURCES[url]) return '';
    if ((kind === 'projects' && (id === 'P519' || id === 'P125' || id === 'P284' || id === 'P437')) || (kind === 'nhc' && o && o.n === 'الدار')) return '';
    if (/poster|banner|brochure|flyer|licen[cs]e|permit|screenshot|لقطة.?الشاشة/i.test(decoded)) return '';
    return url;
  }
  function developerSite(o) {
    var host = String(o && o.dsite || '').replace(/^https?:\/\//i, '').split('/')[0];
    if (o && o.id === 'P519' && /(^|\.)rakez\.sa$/i.test(host)) return '';
    return o && o.dsite || '';
  }
  // Suppress only an exact, reviewed HTTP404 link when a working corporate alternative exists.
  // Keep the source URL in data; temporary blocks (403/429/timeouts) are not treated as missing pages.
  function reviewedUnavailableUrl(o, url) {
    var check = o && o.projectPageCheck;
    return !!(url && check && check.url === url && check.httpStatus === 404 && check.fallbackHttpStatus === 200 && check.fallbackUrl === o.dsite && validEvidence({source:check.url,checkedAt:check.checkedAt}));
  }
  function projectPage(o) {
    return reviewedUnavailableUrl(o, o && o.page) ? '' : o && o.page || '';
  }
  function projectSiteLabel(o) {
    if (o.siteRole === 'marketer' || (o.marketer && !o.dev)) return 'موقع المسوّق';
    if (o.marketer || unclearDeveloperRole(o)) return 'موقع الجهة';
    return 'موقع المطور';
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
    if (/^unit_specific/.test(String(o.priceBasis || '')) && /^[0-9]{1,6}$/.test(String(o.priceUnitNumber || ''))) {
      basis = [basis[0], basis[1].replace('للوحدة الموضحة', 'للوحدة ' + o.priceUnitNumber)];
    }
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
  function mapActionLabel(map) {
    try {
      var u = new URL(map), query = u.searchParams.get('query') || u.searchParams.get('q') || '';
      var coordinate = /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(query);
      return (u.pathname.indexOf('/maps/search') >= 0 || query) && !coordinate && !u.searchParams.get('query_place_id') ? 'بحث في الخرائط' : 'خرائط';
    } catch (e) { return 'خرائط'; }
  }
  function bankRecordCompanySite(o) {
    if (!o || o.locationVerificationStatus !== 'location_unverified') return '';
    return ({ P391: 'https://canaryvilla.net/', P516: 'https://www.tatweerinv.com/', P578: 'https://www.rafal.com.sa/' })[o.id] || '';
  }
  function actions(id, o, cls) {
    var ph = (o.phones || [])[0] || '', wa = o.wa || '';
    var bankCompany = bankRecordCompanySite(o), map = bankCompany || multiLocationRecord(o) ? '' : (o.maps || o.sales || o.mapsQ), site = bankCompany || o.web || projectPage(o) || o.site || o.dsite || o.url || o.contactUrl, h = '';
    if (map && !reviewedUnavailableUrl(o, map)) {
      var mapHost = ''; try { mapHost = new URL(map, window.location.href).hostname.toLowerCase(); } catch (e) { /* validated separately */ }
      var mapIsGoogle = mapHost.indexOf('google.') >= 0 || mapHost === 'maps.app.goo.gl' || mapHost === 'goo.gl';
      var mapLabel = mapHost.indexOf('waze.com') >= 0 ? 'Waze' : mapHost.indexOf('yango.com') >= 0 ? 'Yango Maps' : mapIsGoogle ? (map.indexOf('/maps/search') >= 0 || /[?&]query=/.test(map) ? 'بحث في Google Maps' : 'Google Maps') : 'الخريطة';
      h += '<a class="' + cls + '" title="' + mapLabel + '" aria-label="' + mapLabel + '" target="_blank" rel="noopener" href="' + esc(map) + '">' + ICON.map + (cls === 'btn' ? mapActionLabel(map) : '') + '</a>';
    }
    if (ph) h += '<a class="' + cls + '" title="اتصال" aria-label="اتصال" data-call="' + id + '" href="' + esc(telHref(ph)) + '">' + ICON.phone + (cls === 'btn' ? 'اتصال' : '') + '</a>';
    if (wa && waMatchesPhone(o)) h += '<a class="' + cls + ' wa" title="واتساب" aria-label="واتساب" data-wa="' + id + '" target="_blank" rel="noopener" href="' + esc(wa) + '">' + ICON.wa + (cls === 'btn' ? 'واتساب' : '') + '</a>';
    if (site && !reviewedUnavailableUrl(o, site)) h += '<a class="' + cls + '" title="' + (bankCompany ? 'موقع الشركة' : 'الموقع') + '" aria-label="' + (bankCompany ? 'موقع الشركة' : 'الموقع الإلكتروني') + '" target="_blank" rel="noopener" href="' + esc(site) + '">' + ICON.web + (cls === 'btn' ? (bankCompany ? 'موقع الشركة' : 'الموقع') : '') + '</a>';
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

  function recordLocations(o) {
    if (!o || ['multi_location_series', 'villa_model'].indexOf(o.geographicEntityType) < 0) return [];
    return (o.verifiedLocations || []).filter(function (place) {
      return place.city && place.nb && Array.isArray(place.sources) && place.sources.some(function (url) { return /^https:\/\//.test(url); });
    });
  }
  function multiLocationRecord(o) { return recordLocations(o).length > 0; }
  function locationInformation(o) {
    if (bankRecordCompanySite(o)) return '<p class="d-note location-verification-note">بيانات المشروع حسب ملف البنك</p>';
    var locations = recordLocations(o); if (!locations.length) return '';
    return '<section class="verified-locations" id="verified-locations"><h3>معلومات المواقع المرتبطة بالسجل</h3><p class="d-note">سجل واحد ' + (o.geographicEntityType === 'villa_model' ? 'لنموذج فيلا' : 'لسلسلة متعددة المواقع') + '؛ هذه معلومات مواقع وليست اعتمادات بنكية مستقلة لكل موقع. لا توجد نقطة واحدة تمثل جميع المواقع.</p><ul>' + locations.map(function (place) {
      return '<li><strong>' + esc([place.nb, place.city].join('، ')) + '</strong> ' + place.sources.map(function (url) { return evidenceLink(url, 'مصدر الموقع', o); }).join(' ') + (place.maps ? evidenceLink(place.maps, 'خريطة هذا الموقع', o) : '') + '</li>';
    }).join('') + '</ul></section>';
  }

  function compactLocation(o) {
    if (bankRecordCompanySite(o)) return (o.city || '') + ' · بيانات المشروع حسب ملف البنك';
    if (multiLocationRecord(o)) return 'مواقع متعددة: ' + recordLocations(o).map(function (place) { return [place.nb, place.city].join('، '); }).join(' · ');
    var city = String(o.city || '').trim();
    var parts = String(o.nb || '').split(/[،,]+/).map(function (part) {
      return (city ? part.split(city).join('') : part)
        .replace(/المملكة العربية السعودية|المملكة|السعودية|Saudi Arabia/gi, '')
        .replace(/[0-9٠-٩۰-۹]+/g, '').replace(/\s+/g, ' ').trim();
    }).filter(function (part, i, all) { return part && all.indexOf(part) === i; });
    return parts.concat(city ? [city] : []).join('، ');
  }

  function cardActions(id, o) {
    var bankCompany = bankRecordCompanySite(o), ph = (o.phones || [])[0], map = bankCompany || multiLocationRecord(o) ? '' : (o.maps || o.sales || o.mapsQ);
    return '<div class="card-actions"><button class="btn primary" data-detail="' + id + '" aria-label="تفاصيل ' + esc(o.n) + '">' + ICON.card + 'تفاصيل</button>' +
      (ph ? '<a class="btn" data-call="' + id + '" href="' + esc(telHref(ph)) + '" aria-label="اتصال بـ ' + esc(o.n) + '">' + ICON.phone + 'اتصال</a>' : '<span class="btn unavailable" aria-label="رقم الاتصال غير متاح">' + ICON.phone + 'غير متاح</span>') +
      (bankCompany ? '<a class="btn" target="_blank" rel="noopener" href="' + esc(bankCompany) + '">' + ICON.web + 'موقع الشركة</a>' : multiLocationRecord(o) ? '<button class="btn" data-detail="' + id + '" data-anchor="verified-locations">المواقع</button>' : map ? '<a class="btn" target="_blank" rel="noopener" href="' + esc(map) + '" aria-label="خرائط ' + esc(o.n) + '">' + ICON.map + mapActionLabel(map) + '</a>' : '<span class="btn unavailable" aria-label="الخريطة غير متاحة">' + ICON.map + 'غير متاح</span>') + '</div>';
  }
  function destinationCardActions(id, o) {
    if (o.entityType === 'nhc_partner_project') return cardActions(id, o);
    var map = o.maps || o.mapsQ;
    return '<div class="card-actions destination-actions"><button class="btn primary" data-detail="' + id + '" data-anchor="destination-projects">مشاريع الوجهة</button><button class="btn" data-detail="' + id + '" data-anchor="destination-contacts">تواصل المطورين</button>' +
      (map ? '<a class="btn" target="_blank" rel="noopener" href="' + esc(map) + '" aria-label="خرائط ' + esc(o.n) + '">' + ICON.map + mapActionLabel(map) + '</a>' : '<button class="btn" data-detail="' + id + '">تفاصيل</button>') + '</div>';
  }
  function isIllustrative(o, source) { return /توضيحي|مولّد|مولد|مفاهيم|illustrative|ai-illustrative/i.test([o.imageType, o.imageSource, source].join(' ')); }
  function recordMedia(kind, o) {
    var source = displayImage(kind, o), illustrative = !source || isIllustrative(o, source);
    return '<div class="media">' + ph(o.n, '', kind, o) + (source ? '<img class="property-image official-image" loading="lazy" decoding="async" alt="' + esc(illustrative ? 'صورة توضيحية وليست تصويرًا موثقًا للمشروع' : o.n) + '" data-src="' + esc(source) + '">' : '') + '<span class="image-caption"' + (!illustrative ? ' hidden' : '') + ' data-illustrative="' + illustrative + '">صورة توضيحية</span></div>';
  }
  function card(kind, o, d, showCity, unknown, item) {
    o = contactView(o);
    var id = reg(kind, o), visual = kind === 'projects' || kind === 'opps' || kind === 'nhc';
    var where = kind === 'nhc' ? (o.dir && o.dir.indexOf(o.city) >= 0 ? o.dir : [o.city, o.dir].filter(Boolean).join('، ')) : kind === 'selfbuild' ? [o.loc, o.city].filter(Boolean).join('، ') : compactLocation(o), h = '';
    if (visual) {
      h = '<article class="vcard" data-record-id="' + esc(o.id || o.n) + '">' + '<div class="body"><h3>' + esc(o.n) + '</h3><div class="where">' + esc(where) + '</div>' + (o.marketer ? '<div class="dev">التسويق: ' + esc(o.marketer) + '</div>' : o.dev ? '<div class="dev">' + (unclearDeveloperRole(o) ? 'جهة التواصل: ' : '') + esc(o.dev) + '</div>' : '') + (kind !== 'nhc' ? priceLine(o) : '') + '</div>' + (kind === 'nhc' ? destinationCardActions(id, o) : cardActions(id, o)) + recordMedia(kind, o) + '</article>';
    } else {
      var icon = ICON[kind] || ICON.offices;
      h = '<article class="lcard" data-record-id="' + esc(o.id || o.n) + '"><div class="head"><span class="business-icon">' + icon + '</span><div><h3>' + esc(o.n) + '</h3><div class="sub">' + esc(where || (kind === 'companies' ? S.branch.city : '')) + '</div></div></div>' +
        (item && item.serviceMatch ? '<p class="coverage-note">تخدم هذا النطاق</p>' : '') + (o.contact ? '<p class="contact-name">المسؤول: ' + esc(o.contact) + '</p>' : '') + phoneLine(o.phones, id, o.phoneContacts) + cardActions(id, o) + '</article>';
    }
    if (branchNearbyKind(kind) && d != null && item && item.distanceSource === 'branch-straight-line') h = h.replace('</h3>', '</h3><span class="branch-distance" title="مسافة بخط مستقيم من الفرع">' + distTag(d) + '</span>');
    if (kind === 'nhc' && o.entityType === 'nhc_partner_project') h = h.replace('</h3>', '</h3><span class="tag">مشروع بالشراكة مع NHC</span>');
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
      img.addEventListener('load', function () {
        var media = img.parentElement;
        if (img.classList.contains('official-image') && img.naturalWidth > 0 && media && media.classList && media.classList.contains('d-media')) media.classList.add('has-official-photo');
      });
      img.addEventListener('error', function () {
        if (img.dataset && img.dataset.generic === '1') {
          // Try the other bundled illustration once, then a small embedded illustration.
          if (!img.dataset.fallbackStage) {
            img.dataset.fallbackStage = '1';
            img.src = img.getAttribute('data-src') === GENERIC_PROPERTY_IMAGE ? PROPERTY_ILLUSTRATIONS[1] : GENERIC_PROPERTY_IMAGE;
          } else if (img.dataset.fallbackStage === '1') {
            img.dataset.fallbackStage = '2';
            img.src = EMBEDDED_PROPERTY_FALLBACK;
          } else {
            img.hidden = true; // Never loop or leave a broken-image icon if decoding itself fails.
          }
          return;
        }
        if (img.classList.contains('company-avatar')) {
          var avatar = document.createElement('span'); avatar.className = 'avatar'; avatar.textContent = img.dataset.initial || 'ع';
          if (img.parentElement) img.parentElement.replaceChild(avatar, img);
          return;
        }
        var media = img.parentElement;
        if (img.classList.contains('official-image')) {
          if (media && media.classList && media.classList.contains('d-media')) media.classList.remove('has-official-photo');
          img.remove();
        }
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
      if (o.url) links += '<a class="btn primary" target="_blank" rel="noopener" href="' + esc(o.url) + '">' + ICON.web + (o.entityType === 'nhc_partner_project' ? (/nhc\.sa\//.test(o.url) ? 'المصدر في NHC' : 'صفحة المشروع') : 'صفحة الوجهة في NHC') + '</a>';
    } else if (k === 'projects' || k === 'opps') {
      rows = [[unclearDeveloperRole(o) ? 'الجهة المرتبطة' : 'المطور', o.dev], ['المسوّق', o.marketer], ['الموقع', o.nb], ['المدينة', o.city], ['نوع الوحدات', o.type], ['الغرف', verifiedField(o, 'rooms')], ['عدد الوحدات', verifiedField(o, 'units')], ['المساحة', verifiedField(o, 'area')], ['تفصيل المساحة', verifiedField(o, 'area') ? o.areaNote : ''], ['حالة الإنشاء', constructionLabel(o)], ['حالة العرض', validEvidence(o.availability) && o.availability.status === 'available' ? 'متاح للبيع وفق المصدر الموثق' : ''], ['رقم التواصل', o.phoneLevel === 'dev' && o.phones && o.phones[0] ? (unclearDeveloperRole(o) ? 'رقم الجهة' : 'رقم المطور') : '']];
      var projectPageUrl = bankRecordCompanySite(o) ? '' : projectPage(o);
      if (projectPageUrl) links += '<a class="btn primary" target="_blank" rel="noopener" href="' + esc(projectPageUrl) + '">' + ICON.web + 'صفحة المشروع</a>';
      if (o.areaSource) links += evidenceLink(o.areaSource, 'مصدر المساحة', o);
      var devSite = bankRecordCompanySite(o) ? '' : developerSite(o);
      if (devSite && devSite !== projectPageUrl) links += '<a class="btn" target="_blank" rel="noopener" href="' + esc(devSite) + '">' + ICON.companies + projectSiteLabel(o) + '</a>';
      if (!bankRecordCompanySite(o) && o.sales) links += evidenceLink(o.sales, mapActionLabel(o.sales) === 'بحث في الخرائط' ? 'بحث عن مركز المبيعات' : 'مركز المبيعات', o);
      if (o.contactUrl) links += evidenceLink(o.contactUrl, 'التواصل', o);
    }
    if (k === 'selfbuild') rows = [['المدينة', o.city], ['الموقع', o.loc]];
    if (k === 'companies' || k === 'offices' || k === 'cars') {
      rows = [['المدينة', o.city], ['الموقع', o.nb], ['النشاط', o.kind], ['المسؤول', o.contact]];
      (o.salesCenters || []).forEach(function (center) { if (center.maps) links += evidenceLink(center.maps, mapActionLabel(center.maps) === 'بحث في الخرائط' ? 'بحث عن مركز مبيعات الشركة' : 'مركز مبيعات الشركة', o); });
    }
    if ((k === 'projects' || k === 'opps') && displayEligible('projects', o)) { rows.push(['اعتماد البنك', multiLocationRecord(o) ? 'موثق للسجل المذكور فقط؛ لا يعني اعتمادًا مستقلًا لكل موقع' : 'موثق وفق المصدر'], ['تاريخ التحقق', o.bankApproval.checkedAt]); links += evidenceLink(o.bankApproval.source, 'مصدر اعتماد البنك', o); }
    if ((k === 'opps' || k === 'projects') && o.availability && o.availability.status === 'available' && validEvidence(o.availability)) { rows.push(['تاريخ التحقق من الإتاحة', o.availability.checkedAt]); links += evidenceLink(o.availability.source, 'مصدر الإتاحة للبيع', o); }
    if (o.destinationName && (o.destinationSource || validEvidence(o.destinationEvidence))) { rows.push(['الوجهة', o.destinationName]); links += evidenceLink(o.destinationSource || o.destinationEvidence.source, 'مصدر الارتباط بالوجهة', o); }
    rows = (rows || []).filter(function (r) { return r[1]; });
    dlg.innerHTML = '<div class="d-top"><button class="btn back-results" data-close>← ' + backLabel + '</button></div>' +       '<div class="d-body"><h2>' + esc(o.n) + '</h2><button class="btn" data-close>العودة إلى القائمة</button>' + (k === 'projects' || k === 'opps' ? priceLine(o) : '') +
      phoneLine(o.phones, id, o.phoneContacts) + '<div class="d-acts primary-contact-actions">' + actions(id, o, 'btn') + '</div>' +
      (verifiedField(o, 'desc') ? '<p style="margin:0;color:var(--ink-2)">' + esc(verifiedField(o, 'desc')) + '</p>' : '') +
      '<dl class="kv">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' +
      locationInformation(o) + (k === 'nhc' && o.entityType !== 'nhc_partner_project' ? destinationProjectSection(o) + destinationContactSection(o) : '') +
      (k === 'nhc' && (o.phones || []).length ? '<p class="d-note">التواصل المسجّل في بيانات الوجهة</p>' : '') + (links ? '<div class="d-acts">' + links + '</div>' : '') +
      '</div>' + (k === 'projects' || k === 'opps' || k === 'nhc' ? '<div class="d-media"><button class="close-x" data-close aria-label="إغلاق">' + ICON.x + '</button>' +
      ph(k === 'nhc' ? 'وجهة ' + o.n : o.n, [o.type, o.city].filter(Boolean).join(' · '), k, o) + (displayImage(k, o) ? '<img class="property-image official-image" alt="' + esc(isIllustrative(o, displayImage(k, o)) ? 'صورة توضيحية وليست تصويرًا موثقًا للمشروع' : (o.n || 'صورة')) + '" data-src="' + esc(displayImage(k, o)) + '">' : '') + '<span class="image-caption" data-illustrative="' + (!displayImage(k, o) || isIllustrative(o, displayImage(k, o))) + '">صورة توضيحية</span></div>' : '');
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
    var shareLocation = bankRecordCompanySite(o) || (multiLocationRecord(o) ? (projectPage(o) || o.web || o.site || developerSite(o) || '') : (o.maps || o.url || projectPage(o) || o.web || o.site || developerSite(o) || ''));
    var text = [o.n, o.dev, multiLocationRecord(o) ? compactLocation(o) : [o.nb, o.city].filter(Boolean).join('، '), priceText(o), currentPhone(id, context), shareLocation].filter(Boolean).join('\n');
    if (navigator.share) navigator.share({ title: o.n, text: text }).catch(function () { /* cancelled */ }); else copy(text, 'نُسخت بيانات البطاقة');
  }
  function vcard(id, context) {
    var it = REG[id]; if (!it) return; var o = it.o, ph = currentPhone(id, context);
    var v = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + o.n, 'ORG:' + (o.dev || o.n), 'TEL;TYPE=WORK,VOICE:' + ph, (bankRecordCompanySite(o) || o.web || projectPage(o) || o.site || developerSite(o)) ? 'URL:' + (bankRecordCompanySite(o) || o.web || projectPage(o) || o.site || developerSite(o)) : '', 'NOTE:' + (o.city || ''), 'END:VCARD'].filter(Boolean).join('\r\n');
    try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([v], { type: 'text/vcard;charset=utf-8' })); a.download = (o.n || 'contact') + '.vcf'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
    catch (e) { copy(ph, 'نُسخ الرقم'); }
  }
  var detailReturn = null, detailRecord = null;
  function evidenceLink(source, label, o) { if (reviewedUnavailableUrl(o, source)) return '<span class="d-note">' + esc(label) + ': رابط المصدر غير متاح حاليًا</span>'; return /^https?:\/\//i.test(String(source || '')) ? '<a class="btn" target="_blank" rel="noopener" href="' + esc(source) + '">' + esc(label) + '</a>' : ''; }
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
      S.views[S.tab] = { scope: S.scope, explore: S.explore, carArea: S.carArea, nhcView: S.nhcView };
      S.tab = t.dataset.tab;
      var view = S.views[S.tab] || { scope: km(S.branch.lat, S.branch.lon, S.branch.lat, S.branch.lon) == null || (sectorCity(S.branch.city) && !S.branch.sec) ? 'city' : 'branch', explore: '', carArea: '' };
      S.scope = view.scope; S.explore = view.explore; S.carArea = view.carArea; S.nhcView = view.nhcView || 'local';
      renderBranch(); return;
    }
    if (t.hasAttribute('data-nhc-view')) { if (t.dataset.nhcView === 'city') { S.scope = 'city'; S.explore = ''; } else if (S.scope === 'city') { S.scope = 'branch'; } S.nhcView = t.dataset.nhcView === 'nearby' ? 'nearby' : 'local'; S.q.nhc = ''; S.limit.nhc = CFG.pageSize; renderBranch(); return; }
    if (t.hasAttribute('data-scope')) { S.nhcView = 'local'; S.scope = t.dataset.scope; S.explore = ''; S.carArea = ''; S.q = {}; S.limit = {}; renderBranch(); return; }
    if (t.hasAttribute('data-radius')) { S.radius = Number(t.dataset.radius) || S.radius; S.scope = 'radius'; S.carArea = ''; S.explore = ''; S.q = {}; S.limit = {}; renderBranch(); return; }
    if (t.hasAttribute('data-explore')) { S.nhcView = 'local'; S.explore = t.dataset.explore; S.scope = 'sector'; S.carArea = sameCity(S.branch.city, 'الرياض') ? primaryCarArea(S.branch, S.explore) : ''; S.q = {}; S.limit = {}; renderBranch(); return; }
    if (t.hasAttribute('data-car-area')) { S.carArea = t.dataset.carArea; if (S.scope === 'city') S.scope = 'branch'; S.tab = 'cars'; S.limit.cars = CFG.pageSize; renderBranch(); return; }
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
    var m = /^#b([0-9A-Za-z]+)$/.exec(location.hash || ''), city = cityFromHash();
    var validCity = city && D.branches && cities().some(function (c) { return sameCity(c, city); }) && !D.branches.some(function (b) { return sameCity(b.city, city); });
    if (validCity) { if (!S.branch || !S.branch.cityOnly || !sameCity(S.branch.city, city)) selectCity(city); return; }
    if (m && D.branchByCode && D.branchByCode[m[1]]) { if (!S.branch || S.branch.c !== m[1]) selectBranch(m[1]); return; }
    // Never leave a previous branch beneath an unknown or malformed route.
    if (S.branch || location.hash) renderStart();
  });

  boot();
})();



