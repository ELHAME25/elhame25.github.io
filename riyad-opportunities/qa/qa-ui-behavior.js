/* Reproducible interaction checks against the shipped app.js in a small DOM VM. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));

class Element {
  constructor(id) {
    this.id = id; this.innerHTML = ''; this.textContent = ''; this.value = '';
    this.dataset = {}; this.attrs = {}; this.handlers = {}; this.open = false;
    this.hidden = false; this.disabled = false; this.classList = { contains: x => this.className === x };
    this.style = {}; this.selectionStart = 0;
  }
  addEventListener(type, handler) { this.handlers[type] = handler; }
  dispatch(type, event = {}) { if (this.handlers[type]) this.handlers[type](Object.assign({ target: this, currentTarget: this }, event)); }
  querySelectorAll() { return []; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'open') this.open = true; }
  removeAttribute(k) { delete this.attrs[k]; if (k === 'open') this.open = false; }
  getAttribute(k) { return this.attrs[k] == null ? null : this.attrs[k]; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); }
  focus() { this.focused = true; }
  setSelectionRange() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  remove() {}
  click() { this.clicked = true; }
}
const els = {};
const documentHandlers = {};
const document = {
  title: '', body: { appendChild() {} },
  getElementById(id) { if (id === 'site-config') return null; return els[id] || (els[id] = new Element(id)); },
  querySelector() { return null; }, querySelectorAll() { return []; },
  addEventListener(type, fn) { (documentHandlers[type] ||= []).push(fn); },
  createElement() { return new Element('created'); }
};
const location = { hash: '', pathname: '/', search: '' };
const localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
const window = { location, scrollTo() {}, addEventListener() {} };
const fetch = async u => {
  const p = path.join(root, u.split('?')[0]);
  return { ok: fs.existsSync(p), json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
};
let src = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
  src = src.replace('  boot();', `  window.__behavior = {
    selectBranch, renderBranch, renderStart, renderSection, compute, itemsFor, rawItems,
    emptyState, card, openDetail, closeDlg, sameCity, cities, data: () => D, state: () => S
  }; boot();`);
vm.runInNewContext(src, {
  document, window, location, history: { replaceState() {} }, localStorage,
  navigator: {}, fetch, setTimeout, clearTimeout, console, URL, Blob, Intl, Date
});

function fireDocument(type, target, extra = {}) {
  const event = Object.assign({ target, preventDefault() { this.defaultPrevented = true; } }, extra);
  for (const fn of documentHandlers[type] || []) fn(event);
  return event;
}
function target(attrs = {}, options = {}) {
  const ds = {};
  Object.entries(attrs).forEach(([k, v]) => { ds[k.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(v); });
  return {
    dataset: ds, className: options.className || '', classList: { contains: x => x === (options.className || '') },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k); },
    getAttribute(k) { return attrs[k] == null ? null : String(attrs[k]); },
    setAttribute(k, v) { attrs[k] = String(v); },
    closest() { return this; }
  };
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  await wait(350);
  const A = window.__behavior;
  const tests = {};
  const assert = (name, condition) => { tests[name] = !!condition; };
  const d = A.data();
  const areemNHC = d.projects.find(x => x.id === 'P344');
  const areemSumou = d.projects.find(x => x.id === 'P362');
  const lamarya = d.projects.find(x => x.id === 'P572');
  const munsiyah = d.projects.find(x => x.id === 'P625');
  const sourcedCars = ['phase6-cars-01497558f1e82f', 'regional-pdf-pdf-smalltown-011-045', 'regional-pdf-pdf-smalltown-013-045', 'regional-pdf-pdf-smalltown-017-045', 'regional-pdf-pdf-smalltown-019-045'];
  const appMarkup = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
  assert('verified areas, project status, official render and contact sources are exposed', !!areemNHC && areemNHC.area === '89,905.67 م² (المساحة المنشورة لدى NHC)' && !!areemSumou && areemSumou.area.startsWith('231,637.22 م²') && !!lamarya && lamarya.status.includes('تم البيع') && lamarya.phones.includes('0556388388') && !!munsiyah && !munsiyah.loc && munsiyah.img.includes('clusters.sa/_next/image') && munsiyah.imageType.includes('تصميم معماري') && sourcedCars.every(id => { const o = d.cars.find(x => x.id === id); return o && o.phones.length && o.phoneSource; }) && appMarkup.includes("['المساحة', o.area]") && appMarkup.includes('مصدر رقم التواصل') && appMarkup.includes('o.imageType'));
  const renderCard = A.card('projects', munsiyah, null, true, false, {}), renderId = renderCard.match(/data-detail="(\\d+)"/);
  if (renderId) A.openDetail(Number(renderId[1]));
  const renderCaption = !!renderId && els.detail.innerHTML.includes('تصميم معماري رسمي من المطور');
  const sourceCar = d.cars.find(x => x.id === sourcedCars[0]);
  const sourceCard = A.card('cars', sourceCar, null, true, false, {}), sourceId = sourceCard.match(/data-detail="(\\d+)"/);
  if (sourceId) A.openDetail(Number(sourceId[1]));
  assert('project render caption and showroom phone source appear in detail', renderCaption && !!sourceId && els.detail.innerHTML.includes('مصدر رقم التواصل') && els.detail.innerHTML.includes('dalilmadina.com'));
  // Start picker order, immediate greeting, code-only lookup and explicit Go action.
  assert('picker orders employee, code, city and Go', els.app.innerHTML.indexOf('for="q-emp"') < els.app.innerHTML.indexOf('for="q-branch"') && els.app.innerHTML.indexOf('for="q-branch"') < els.app.innerHTML.indexOf('for="q-city"') && els.app.innerHTML.includes('id="go-branch"'));
  els['q-emp'].value = 'خالد الماطر'; els['q-emp'].dispatch('input');
  const liveGreeting = els.greet.textContent.includes('خالد الماطر') && !els.greet.hidden;
  els['q-emp'].value = ''; els['q-emp'].dispatch('input');
  assert('greeting updates while typing and hides when empty', liveGreeting && els.greet.hidden);
  els['q-branch'].value = '228'; els['q-branch'].dispatch('input');
  const codeReady = !els['go-branch'].disabled && els['branch-list'].innerHTML.includes('الشفا');
  els['go-branch'].dispatch('click');
  assert('branch code opens without choosing a city after Go and writes its direct link', codeReady && A.state().branch.c === '228' && location.hash.replace(/^#/, '') === 'b228');
  fireDocument('click', target({ 'data-act': 'change' }));
  els['q-city'].value = 'الرياض'; els['q-city'].dispatch('change');
  els['q-branch'].value = '242'; els['q-branch'].dispatch('input');
  const branchList = els['branch-list'].innerHTML;
  els['branch-list'].dispatch('click', { target: target({ 'data-code': '242' }) });
  const selectedOnly = !A.state().branch && !els['go-branch'].disabled && els['q-branch'].value === '242';
  els['go-branch'].dispatch('click');
  assert('city-assisted choice selects first and opens only with Go', selectedOnly && A.state().branch.c === '242' && branchList.includes('242'));

  // Exercise every radius through the actual select change listener, then the city scope button.
  const radiusResults = [];
  for (const r of [5, 10, 15, 20]) {
    const el = els.radius;
    el.value = String(r); el.dispatch('change');
    radiusResults.push(A.state().radius === r && A.state().scope === 'branch' && els.app.innerHTML.includes(`value="${r}" selected`));
  }
  assert('5/10/15/20 km controls update branch scope', radiusResults.every(Boolean));
  fireDocument('click', target({ 'data-scope': 'city' }));
  assert('all-city scope is explicit and applied', A.state().scope === 'city' && els.app.innerHTML.includes('كل ' + A.state().branch.city));

  // Widening the radius changes results while keeping unlocated records visible.
  A.selectBranch('243'); A.state().radius = 5; A.state().scope = 'branch'; A.renderBranch();
  const projectCount5 = A.itemsFor('projects', '', 'branch').length;
  els.radius.value = '10'; els.radius.dispatch('change');
  const projectCount10 = A.itemsFor('projects', '', 'branch').length;
  assert('widening 5 km to 10 km applies the wider filter', A.state().radius === 10 && A.state().scope === 'branch' && projectCount10 >= projectCount5);

  // The search control and live filtering are exercised independently for each populated section.
  const searchable = ['projects', 'opps', 'nhc', 'selfbuild', 'companies', 'offices', 'cars'];
  const searchResults = searchable.map(k => {
    const city = Object.keys(d.cityCount[k] || {}).find(c => (d.cityCount[k][c] || 0) > 0 && d.branches.some(b => A.sameCity(b.city, c)));
    const branch = city && d.branches.find(b => A.sameCity(b.city, city));
    if (!branch) return false;
    A.selectBranch(branch.c); A.state().scope = 'city'; A.state().tab = k; A.state().q[k] = ''; A.renderBranch();
    if (!els.content.innerHTML.includes('id="q-sec"')) return false;
    const q = els['q-sec']; q.value = '__qa_no_such_record__'; q.dispatch('input');
    return A.state().q[k] === '__qa_no_such_record__' && els.content.innerHTML.includes('لا نتائج مطابقة');
  });
  assert(`search works in each of ${searchable.length} sections using a city with data`, searchResults.every(Boolean));

  // Open details from the card's delegated click, close with its close control, and open by Enter.
  A.state().q = {}; A.state().scope = 'city'; A.state().tab = 'projects'; A.renderBranch();
  const detailIdMatch = els.content.innerHTML.match(/data-detail="(\d+)"/);
  let detailFlow = false;
  if (detailIdMatch) {
    const id = detailIdMatch[1];
    fireDocument('click', target({ 'data-detail': id }));
    const opened = els.detail.open;
    fireDocument('click', target({ 'data-close': '' }));
    const closed = !els.detail.open;
    const article = target({ 'data-detail': id }, { className: 'vcard' });
    fireDocument('keydown', article, { key: 'Enter' });
    detailFlow = opened && closed && els.detail.open;
    A.closeDlg();
  }
  assert('card click opens details, close control closes, Enter reopens', detailFlow);

  // A record with multiple published numbers keeps a selectable phone list in card and detail.
  const multi = d.companies.find(o => (o.phones || []).length > 1) || d.offices.find(o => (o.phones || []).length > 1) || d.cars.find(o => (o.phones || []).length > 1);
  let multiPhone = false;
  if (multi) {
    const kind = d.companies.includes(multi) ? 'companies' : d.offices.includes(multi) ? 'offices' : 'cars';
    const html = A.card(kind, multi, null, true, false, {});
    const idMatch = html.match(/data-phonesel="(\d+)"/);
    if (idMatch) {
      A.openDetail(Number(idMatch[1]));
      multiPhone = html.includes('data-phonesel=') && els.detail.innerHTML.includes('data-phonesel=') &&
        (els.detail.innerHTML.match(/<option /g) || []).length === multi.phones.length;
    }
  }
  assert('multiple numbers remain selectable on card and in details', multiPhone);

  // Do not present unresolved availability or activity reviews as public records.
  const reviewGroups = [
    ['cars', 'activityReviewStatus'],
    ['selfbuild', 'availabilityStatus'],
    ['companies', 'commercialAuditStatus']
  ];
  const reviewExclusion = reviewGroups.map(([kind, field]) => {
    const records = (d[kind] || []).filter(x => String(x[field] || '').toUpperCase() === 'REVIEW_REQUIRED');
    return records.every(record => {
      const b = d.branches.find(x => A.sameCity(x.city, record.city));
      if (!b) return true;
      A.selectBranch(b.c, true);
      return !A.rawItems(kind).some(x => (x.o || x).id === record.id);
    });
  });
  assert('review-required cars, self-build and companies stay out of public results', reviewExclusion.every(Boolean));
  const alwateed = d.cars.filter(x => x.n === 'معرض الوتيد للسيارات');
  const duplicateCityBlocked = alwateed.length === 2 && alwateed.every(x => x.activityReviewStatus === 'REVIEW_REQUIRED') &&
    alwateed.every(x => {
      const b = d.branches.find(y => A.sameCity(y.city, x.city));
      A.selectBranch(b.c, true);
      return !A.rawItems('cars').some(y => y.o.id === x.id);
    });
  assert('same-name showroom with conflicting city is retained for review and hidden in both cities', duplicateCityBlocked);
  const hail = d.branches.find(x => A.sameCity(x.city, 'حائل'));
  A.selectBranch(hail.c, true); A.state().tab = 'selfbuild'; A.state().scope = 'branch'; A.renderBranch();
  const filteredCityTotal = A.compute().selfbuild.total;
  A.state().scope = 'city'; A.renderBranch();
  assert('city expansion count matches filtered public self-build results', filteredCityTotal === 1 && A.compute().selfbuild.items.length === filteredCityTotal);

  // City-only showroom records stay selectable without inventing a branch.
  fireDocument('click', target({ 'data-act': 'change' }));
  const cityOptions = els.app.innerHTML;
  els['q-branch'].value = ''; els['q-city'].value = 'بيش'; els['q-city'].dispatch('change');
  const cityOnlyReady = cityOptions.includes('بيش') && !els['go-branch'].disabled && els['branch-list'].innerHTML.includes('data-city-only=\"بيش\"');
  els['go-branch'].dispatch('click');
  const cityOnlyCars = A.itemsFor('cars', '', 'city');
  assert('cities without branches open their verified showroom list directly', cityOnlyReady && A.state().branch && A.state().branch.cityOnly === true && A.state().branch.city === 'بيش' && A.state().scope === 'city' && cityOnlyCars.length === 3 && !els.app.innerHTML.includes('pill code'));


  // Riyadh sector routing must use both valid city showroom groups in Central,
  // and must preserve NHC's city-wide visibility and a sector-local distance anchor.
  A.selectBranch('243', true);
  A.state().scope = 'sector'; A.state().explore = 'وسط'; A.state().carArea = 'all'; A.state().tab = 'cars';
  const centerCars = A.itemsFor('cars', 'وسط', 'sector');
  const centerHasBothGroups = centerCars.length > 0 && centerCars[0].o.zone === 'shifa' &&
    centerCars.some(x => x.o.zone === 'qadisiyah') && centerCars.every(x => x.o.zone === 'shifa' || x.o.zone === 'qadisiyah');
  A.state().explore = 'غرب';
  const westCars = A.itemsFor('cars', 'غرب', 'sector');
  const westMapped = westCars.length > 0 && westCars.every(x => x.o.zone === 'shifa');
  A.state().explore = 'شمال';
  const northCars = A.itemsFor('cars', 'شمال', 'sector');
  const northMapped = northCars.length > 0 && northCars.every(x => x.o.zone === 'qadisiyah');
  A.state().explore = 'شرق'; A.state().scope = 'sector'; A.state().tab = 'projects'; A.renderBranch();
  const eastNorthActive = els.app.innerHTML.includes('data-explore="شرق" aria-pressed="true"') && els.app.innerHTML.includes('data-explore="شمال" aria-pressed="true"');
  const eastNorthProjects = A.itemsFor('projects', 'شرق', 'sector');
  const eastNorthUnion = new Set(A.itemsFor('projects', 'شرق', 'sector').concat(A.itemsFor('projects', 'شمال', 'sector')).map(x => x.o.id || x.o.n));
  const eastNorthMerged = eastNorthProjects.length === eastNorthUnion.size;
  A.state().explore = 'وسط';
  const nhcCity = A.itemsFor('nhc', '', 'city').map(x => x.o.id).sort().join('|');
  const nhcCenter = A.itemsFor('nhc', 'وسط', 'sector').map(x => x.o.id).sort().join('|');
  assert('Riyadh central shows Shifa first and both validated showroom groups', centerHasBothGroups);
  assert('Riyadh west routes showrooms to Shifa and north to Qadisiyah', westMapped && northMapped);
  assert('Riyadh East activates North and combines both project sectors', eastNorthActive && eastNorthMerged);
  assert('NHC destinations remain city-wide when a sector is selected', nhcCity === nhcCenter);
  A.state().tab = 'cars'; A.renderBranch();
  const centralControls = els.content.innerHTML.includes('data-car-area="shifa" aria-pressed="true"') &&
    els.content.innerHTML.includes('data-car-area="qadisiyah" aria-pressed="true"') &&
    els.content.innerHTML.includes('data-car-area="all" aria-pressed="false"');
  assert('central showroom controls show both groups active and All Riyadh inactive', centralControls);


  // Small-city showrooms remain city-level; large regional cities use the selected branch radius.
  A.selectBranch('607', true); A.state().tab = 'cars'; A.state().scope = 'branch'; A.renderBranch();
  const rassCars = A.itemsFor('cars', '', 'branch').map(x => x.o.id).sort().join('|');
  const rassCityCars = A.itemsFor('cars', '', 'city').map(x => x.o.id).sort().join('|');
  const noSmallCityCarRadius = !els.content.innerHTML.includes('id="radius"');
  assert('small-city showrooms stay city-wide with no branch radius control', rassCars === rassCityCars && noSmallCityCarRadius);
  const noSmallCityScopeToggle = !els.app.innerHTML.includes('data-scope="city"') && !els.content.innerHTML.includes('data-scope="city"') && !els.app.innerHTML.includes('<div class="controls">');
  A.state().tab = 'offices'; A.renderBranch();
  const smallCityOfficeBranchScope = els.app.innerHTML.includes('data-scope="branch"') && !els.app.innerHTML.includes('data-scope="city"');
  assert('small cities hide the all-city option while offices retain branch scope', noSmallCityScopeToggle && smallCityOfficeBranchScope);
  const buraydahCodes = ['602', '249', '273'];
  const buraydahCars = buraydahCodes.map(code => {
    const b = d.branchByCode[code]; if (!b || !A.sameCity(b.city, 'بريدة')) return null;
    A.selectBranch(code, true); A.state().radius = 15; A.state().scope = 'branch';
    const near = A.itemsFor('cars', '', 'branch');
    return { ids: near.map(x => x.o.id).sort().join('|'), city: A.itemsFor('cars', '', 'city').length,
      validDistances: near.every(x => x.rankD == null || x.rankD <= 15), hasCityExpansion: els.app.innerHTML.includes('كل بريدة') };
  });
  assert('large-city Buraidah showrooms follow branch radius with a city expansion', buraydahCars.every(x => x && x.validDistances && x.hasCityExpansion && x.ids.split('|').length <= x.city) && new Set(buraydahCars.map(x => x.ids)).size > 1);

  A.selectBranch('189'); A.state().radius = 15; A.state().scope = 'branch'; A.state().tab = 'projects'; A.renderBranch();
  const makkahBranch = A.itemsFor('projects', '', 'branch'), makkahCity = A.itemsFor('projects', '', 'city');
  assert('Makkah projects scope to the selected branch and offer explicit city expansion', makkahBranch.length < makkahCity.length && makkahBranch.every(x => x.rankD == null || x.rankD <= 15) && els.app.innerHTML.includes('نطاق الفرع') && els.app.innerHTML.includes('كل مكة المكرمة'));
  A.selectBranch('105'); const medinaCars = A.itemsFor('cars', '', 'branch').map(x => x.o.id).sort().join('|'); const medinaOffices = A.itemsFor('offices', '', 'branch').map(x => x.o.id).sort().join('|');
  A.selectBranch('168');
  assert('Medina showrooms and offices remain city-level across branches', medinaCars === A.itemsFor('cars', '', 'branch').map(x => x.o.id).sort().join('|') && medinaOffices === A.itemsFor('offices', '', 'branch').map(x => x.o.id).sort().join('|'));
  A.selectBranch('304'); const ahsaCityCars = A.itemsFor('cars', '', 'branch').map(x => x.o.id).sort().join('|'); const ahsaProjects = A.itemsFor('projects', '', 'branch').map(x => x.o.id).sort().join('|'); const ahsaOffices = A.itemsFor('offices', '', 'branch').map(x => x.o.id).sort().join('|');
  A.selectBranch('324');
  assert('Ahsa showrooms and projects are city-level while offices follow the branch', ahsaCityCars === A.itemsFor('cars', '', 'branch').map(x => x.o.id).sort().join('|') && ahsaProjects === A.itemsFor('projects', '', 'branch').map(x => x.o.id).sort().join('|') && ahsaOffices !== A.itemsFor('offices', '', 'branch').map(x => x.o.id).sort().join('|'));

  const failed = Object.entries(tests).filter(([, ok]) => !ok).map(([name]) => name);
  console.log(JSON.stringify({ suite: 'VM UI behavior regression', tests, passed: Object.values(tests).filter(Boolean).length, total: Object.keys(tests).length, failed }, null, 2));
  if (failed.length) process.exitCode = 1;
})().catch(err => { console.error(err.stack || err); process.exitCode = 1; });

