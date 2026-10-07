/* دليل فرص المملكة — تطبيق ثابت بلا إطار عمل. يقرأ config/site.json ثم data/*.json
   منطق العرض:
   - الفرع نقطة مرجعية لنطاق فعلي 5/10/15/20 كم؛ توسيع المدينة اختيار صريح.
   - القطاع أداة أولوية استكشاف في الرياض/جدة/الدمام، ولا يحجب الفرص القريبة من القطاعات المجاورة.
   - العناصر بلا إحداثيات تبقى ظاهرة بعد العناصر ذات المسافة الموثقة؛ ولا تُنسب لها مسافة تقديرية.
   - وجهات NHC والبناء الذاتي تخدم المدينة كلها. فرع وحيد في مدينته: نطاقه المدينة كلها.
   - الأرقام أعلى الصفحة تتبع البيانات المعروضة، ويُكتب تحتها نطاقها.
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
    var hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
    return (hour >= 5 && hour < 12 ? 'صباح الخير ' : 'مساء الخير ') + name;
  }
  var app = document.getElementById('app');
  var SECTORS = ['شمال', 'جنوب', 'شرق', 'غرب', 'وسط'];
  var SECTIONS = ['projects', 'opps', 'nhc', 'selfbuild', 'companies', 'offices', 'cars', 'nearby'];
  var LABEL = { opps: 'فرص عقارية حالية', selfbuild: 'البناء الذاتي', projects: 'المشاريع المعتمدة', nhc: 'وجهات NHC', companies: 'شركات التسويق والاستثمار العقاري', offices: 'مكاتب العقار', cars: 'معارض السيارات', nearby: 'فرص قريبة من الفرع' };
  var SHORT = { opps: 'فرص حالية', selfbuild: 'البناء الذاتي', projects: 'المشاريع', nhc: 'الوجهات', companies: 'التسويق والاستثمار العقاري', offices: 'المكاتب', cars: 'المعارض', nearby: 'قريبة' };
  var NOUN = { opps: 'فرص عقارية حالية', selfbuild: 'مخططات للبناء الذاتي', projects: 'مشاريع معتمدة', nhc: 'وجهات NHC', companies: 'شركات تسويق أو تطوير', offices: 'مكاتب عقار', cars: 'معارض سيارات', nearby: 'فرص' };
  var SEARCH_PH = { opps: 'ابحث باسم المشروع أو المطور', selfbuild: 'ابحث عن مخطط', projects: 'ابحث باسم المشروع أو المطور أو الحي', nhc: 'ابحث عن وجهة', companies: 'ابحث عن شركة', offices: 'ابحث باسم المكتب أو الحي', cars: 'ابحث باسم المعرض أو الحي', nearby: 'ابحث في الفرص القريبة' };
  var NEARBY_MODE = { metro_support: 5, nearby_auto_if_category_sparse: 5, nearby_optional: 1 };

  /* ---------------- helpers ---------------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function cityKey(s) {
    var k = norm(s).replace(/[.,،()\-–_]/g, ' ').replace(/\s+/g, ' ').trim();
    // الهفوف والمبرز تسميتان موضعيتان ضمن نطاق الأحساء؛ نجمعها للبحث والعد مع إبقاء اسم الفرع الأصلي.
    if (k === 'الاحساء' || k === 'الهفوف' || k === 'المبرز') return 'الاحساء';
    return k;
  }
  function cityLabel(s) { return cityKey(s) === 'الاحساء' ? 'الأحساء' : s; }
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
  function waLink(p) {
    var d = String(p || '').replace(/[^\d+]/g, '');
    if (/^05\d{8}$/.test(d)) return 'https://wa.me/966' + d.slice(1);
    if (/^\+?9665\d{8}$/.test(d)) return 'https://wa.me/' + d.replace('+', '');
    if (/^5\d{8}$/.test(d)) return 'https://wa.me/966' + d;
    return '';
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
    return fetch(path + sep + 'v=20261007-4', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(path); return r.json(); });
  }
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
      D.officeById = {}; D.offices.forEach(function (o) { D.officeById[o.id] = o; });
      D.branchByCode = {}; D.branchCount = {}; D.branches.forEach(function (b) { D.branchByCode[b.c] = b; var bk = cityKey(b.city); D.branchCount[bk] = (D.branchCount[bk] || 0) + 1; });
      D.cityCount = {};
      D.opps = D.opportunities || [];
      ['projects', 'opps', 'nhc', 'selfbuild', 'companies', 'offices', 'cars'].forEach(function (k) {
        D.cityCount[k] = {}; D[k].forEach(function (o) {
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
      renderStart();
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
    D.branches.forEach(function (b) { var k = cityKey(b.city); if (!seen[k]) { seen[k] = 1; out.push(cityLabel(b.city)); } });
    return out.sort(function (a, b) { return a.localeCompare(b, 'ar'); });
  }
  function renderStart() {
    S = fresh();
    app.innerHTML = '<section class="start"><div class="wrap"><div class="start-card">' +
      '<h1>اختر الفرع</h1><p class="sub">حدد المدينة ثم ابحث باسم الفرع أو رقمه.</p>' +
      '<div class="field"><label for="q-emp">اسم الموظف <small>(اختياري)</small></label><input id="q-emp" class="input" type="text" autocomplete="name" placeholder="اسم الموظف" value="' + esc(S.employee) + '"></div>' +
      '<div class="field"><label for="q-city">المدينة</label><select id="q-city" class="select"><option value="">اختر المدينة</option>' +
      cities().map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="q-branch">اسم الفرع أو رمزه</label><input id="q-branch" class="input" type="search" autocomplete="off" placeholder="اختر المدينة أولًا" disabled></div>' +
      '<div class="branch-list" id="branch-list" role="list"></div>' +
      '<button id="use-location" class="btn geo-btn">' + ICON.nearby + 'استخدم موقعي — أقرب فرع</button>' +
      '</div></div></section>';
    var qb = document.getElementById('q-branch'), qc = document.getElementById('q-city'), qe = document.getElementById('q-emp');
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
    function list() {
      var raw = qb.value.trim(), q = norm(raw), city = qc.value;
      qb.disabled = !city;
      if (!city) { document.getElementById('branch-list').innerHTML = ''; return; }
      var items = D.branches.filter(function (b) {
        if (!sameCity(b.city, city)) return false;
        if (!q) return true;
        return String(b.c).indexOf(raw) >= 0 || norm(b.n).indexOf(q) >= 0 || (b.nb && norm(b.nb).indexOf(q) >= 0);
      });
      var shown = items.slice(0, 80);
      document.getElementById('branch-list').innerHTML = shown.map(function (b) {
        return '<button class="branch-item" role="listitem" data-code="' + esc(b.c) + '"><span class="code num">' + esc(b.c) + '</span><span class="bn">' + esc(b.n) + '</span><span class="bc">' + esc(b.city) + (b.sec ? ' · ' + esc(b.sec) : '') + '</span></button>';
      }).join('') + (!shown.length ? '<p class="list-note">لا يوجد فرع مطابق في هذه المدينة</p>' : '');
    }
    qb.addEventListener('input', list);
    qc.addEventListener('change', function () { qb.value = ''; list(); if (qc.value) qb.focus(); });
    qb.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var f = document.querySelector('.branch-item'); if (f) selectBranch(f.dataset.code); } });
    qe.addEventListener('input', function () { S.employee = qe.value.trim(); var g = document.getElementById('greet'); g.textContent = employeeGreeting(S.employee); g.hidden = !S.employee; });
    document.getElementById('branch-list').addEventListener('click', function (e) { var b = e.target.closest('[data-code]'); if (b) selectBranch(b.dataset.code); });
    list();
    if (location.hash) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ } }
  }

  /* ---------------- branch & state ---------------- */
  // الفرع هو نقطة ترتيب النتائج. لا يُسقط حدّ مسافة ثابت الفرص البعيدة أو التي ينقصها دبوس.
  function selectBranch(code, fromBoot, origin) {
    var b = D.branchByCode[code]; if (!b) return;
    // تصفير كامل: لا يبقى أي اختيار أو نتي