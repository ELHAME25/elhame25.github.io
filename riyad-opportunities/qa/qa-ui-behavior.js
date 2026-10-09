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
  assert('verified areas, project status, official render and contact sources are exposed', !!areemNHC && areemNHC.area.includes('89,905.67 م²') && areemNHC.areaSource && !!areemSumou && areemSumou.area.startsWith('231,637.22 م²') && !!lamarya && lamarya.status.includes('تم البيع') && lamarya.phones.includes('0556388388') && !!munsiyah && !munsiyah.loc && munsiyah.img.includes('clusters.sa/_next/image') && munsiyah.imageType.includes('تصميم معماري') && sourcedCars.every(id => { const o = d.cars.find(x => x.id === id); return o && o.phones.length && o.phoneSource; }) && appMarkup.includes("['المساحة', o.area]") && appMarkup.includes('مصدر رقم التواصل') && appMarkup.includes('o.imageSourceUrl'));
  const renderCard = A.card('projects', munsiyah, null, true, false, {}), renderId = renderCard.match(/data-detail="(\d+)"/);
  if (renderId) A.openDetail(Number(renderId[1]));
  const renderCaption = !!renderId && !els.detail.innerHTML.includes('تصميم معماري رسمي من المطور') && !els.detail.innerHTML.includes('image-note');
  const sourceCar = d.cars.find(x => x.id === sourcedCars[0]);
  const sourceCard = A.card('cars', sourceCar, null, true, false, {});
  const phoneSourceMarkup = sourceCard.includes('مصدر رقم التواصل') && sourceCard.includes('dalilmadina.com');
  assert('official project image is shown without a descriptive caption', renderCaption);
  assert('showroom phone source appears in contact details', phoneSourceMarkup);
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
  A.selectBranch('161'); A.state().tab = 'offices'; A.state().radius = 5; A.state().scope = 'branch'; A.renderBranch();
  const abha5 = A.itemsFor('offices', '', 'branch'); A.state().radius = 10; const abha10 = A.itemsFor('offices', '', 'branch');
  assert('Abha uses radius controls without directional sectors', abha10.length >= abha5.length && abha10.every(x => x.rankD == null || x.rankD <= 10) && els.app.innerHTML.includes('id="radius"') && !els.app.innerHTML.includes('data-explore='));
  A.selectBranch('111'); A.state().tab = 'offices'; A.state().radius = 15; A.state().scope = 'branch'; A.renderBranch();
  const yanbu15 = A.itemsFor('offices', '', 'branch'); A.state().radius = 20; const yanbu20 = A.itemsFor('offices', '', 'branch');
  assert('Yanbu uses branch radius without being split into sectors', yanbu20.length >= yanbu15.length && yanbu20.every(x => x.rankD == null || x.rankD <= 20) && els.app.innerHTML.includes('id="radius"') && !els.app.innerHTML.includes('data-explore='));
  A.selectBranch('302', true); A.state().radius = 15; A.state().scope = 'branch';
  const dammamProject = A.itemsFor('projects', '', 'branch').find(x => x.o.id === 'P128');
  const dammamOffice = A.itemsFor('offices', '', 'branch').find(x => x.o.id === 'national-ejar-office-201861');
  const dammamCar = A.itemsFor('cars', '', 'branch').find(x => x.o.id === 'national-car-c80e0cb5068ed3');
  const dammamSihaatProject = A.itemsFor('projects', '', 'branch').find(x => x.o.id === 'P206');
  const dammamCityProjects = A.itemsFor('projects', '', 'city');
  A.state().radius = 5;
  const dammamProjectAtFive = A.itemsFor('projects', '', 'branch').some(x => x.o.id === 'P128');
  assert('Dammam branch includes pinned Qatif and Sihaat records once with true city and measured radius', !!dammamProject && !!dammamOffice && !!dammamCar && !!dammamSihaatProject && [dammamProject, dammamOffice].every(x => x.o.city === 'القطيف' && x.rankD > 0 && x.rankD <= 15) && dammamCar.o.city === 'سيهات' && dammamCar.rankD > 0 && dammamCar.rankD <= 15 && dammamSihaatProject.o.city === 'سيهات' && dammamSihaatProject.rankD > 0 && dammamSihaatProject.rankD <= 15 && dammamCityProjects.every(x => x.o.city === 'الدمام') && !dammamProjectAtFive);
  A.selectBranch('343', true); A.state().radius = 15; A.state().scope = 'branch'; A.state().tab = 'offices';
  const hammamOffice = A.itemsFor('offices', '', 'branch').find(x => x.o.id === 'national-google-office-ChIJb4iRjgoANj4RbrlqN2zXyVY');
  assert('Dammam Badr branch includes only pinned nearby Umm Al-Hamam offices and preserves source city', !!hammamOffice && hammamOffice.o.city === 'أم الحمام' && hammamOffice.rankD > 0 && hammamOffice.rankD <= 15);
  const companySource = d.companies.find(x => x.id === 'cp-1046304230');
  A.selectBranch('243');
  const companyCard = A.card('companies', companySource, null, true, false, {});
  assert('verified developer contact source appears on company cards', companySource.phones.includes('920004077') && companySource.phoneSource === 'https://darwaemaar.com/contact/' && companySource.kind === 'تطوير وبيع مباشر' && companyCard.includes('مصدر رقم التواصل') && companyCard.includes('darwaemaar.com/contact'));
  const sourcedDevelopers = ['cp-f6aebb8ded', 'cp-48cf823418', 'cp-4aeeb21c92'].map(id => d.companies.find(x => x.id === id));
  assert('newly verified developer phone sources and types are retained', sourcedDevelopers.every(x => x && x.phones.length && x.phoneSource && x.kind === 'تطوير وبيع مباشر'));
  const nhcProject = d.projects.find(x => x.id === 'P013');
  const nhcCardMarkup = A.card('projects', nhcProject, null, true, false, {});
  const nhcDetailId = (nhcCardMarkup.match(/data-detail="([^"]+)/) || [])[1];
  A.openDetail(nhcDetailId);
  assert('official NHC project contact is labeled as developer contact with its source', nhcProject.phones.includes('920033499') && nhcProject.phoneLevel === 'dev' && nhcProject.phoneSource === 'https://www.nhc.sa/contact/' && els.detail.innerHTML.includes('رقم المطور') && els.detail.innerHTML.includes('nhc.sa/contact'));
  const akariaProject = d.projects.find(x => x.id === 'P386');
  assert('official Al Akaria project contact is labeled as developer contact', akariaProject.phones.includes('920003938') && akariaProject.phoneLevel === 'dev' && akariaProject.phoneSource === 'https://www.al-akaria.com/contact/');
  const etqaan = d.offices.find(x => x.id === 'national-ejar-office-202414');
  A.selectBranch('301');
  const officeCard = A.card('offices', etqaan, null, true, false, {});
  assert('verified Khobar office phone and source appear on the office card', etqaan.phones.includes('0138949444') && etqaan.phoneSource === 'https://etqaan.com.sa/' && officeCard.includes('مصدر رقم التواصل') && officeCard.includes('etqaan.com.sa'));
  const closedOffice = d.offices.find(x => x.id === 'national-ejar-office-202402');
  A.selectBranch('403', true); A.state().tab = 'offices'; A.state().scope = 'city';
  assert('permanently closed office remains in source data but is excluded from active results', closedOffice && closedOffice.activityReviewStatus === 'closed_permanently' && !A.itemsFor('offices', '', 'city').some(x => x.o.id === closedOffice.id));
  const eliteMakkah = d.cars.find(x => x.id === 'entity-66efa1d00757');
  const carCard = A.card('cars', eliteMakkah, null, true, false, {});
  assert('Makkah showroom phone matches its address and exposes the published listing source', eliteMakkah.phones.includes('0555555112') && carCard.includes('مصدر رقم التواصل') && carCard.includes('bizmideast.com'));

  const aiProjects = ['P001','P002','P003','P004','P005','P006','P007','P009','P010','P011'].map(id => d.projects.find(x => x.id === id));
  const aiProjectCards = aiProjects.map(x => x && A.card('projects', x, null, true, false, {}));
  assert('Ten AI-generated project images are unique and displayed without image-description text', aiProjects.every((x,i) => x && x.img.startsWith('data:image/webp;base64,') && x.imageType.includes('مولّدة بالذكاء الاصطناعي') && !aiProjectCards[i].includes('صورة مفاهيمية مولّدة بالذكاء الاصطناعي') && !aiProjectCards[i].includes('صورة توضيحية') && d.projects.filter(y => y.img === x.img).length === 1) && new Set(aiProjects.map(x=>x.img)).size===10);
  const nhcIllustrations = ['P013','P585'].map(id => d.projects.find(x => x.id === id));
  const nhcIllustrationCard = nhcIllustrations[0] && A.card('projects', nhcIllustrations[0], null, true, false, {});
  const nhcIllustrationDetailId = nhcIllustrationCard && (nhcIllustrationCard.match(/data-detail="([^\"]+)/) || [])[1];
  if (nhcIllustrationDetailId) A.openDetail(nhcIllustrationDetailId);
  assert('Modern NHC images have source links and no visible image-description text', nhcIllustrations.every(x => x && x.img.startsWith('https://ruh-s3.bluvalt.com/') && x.imageSourceUrl === x.page && x.imageType.includes('صورة من صفحة NHC الرسمية') && x.imageType.includes('لا تؤكد')) && !nhcIllustrationCard.includes('صورة من صفحة NHC الرسمية') && !nhcIllustrationCard.includes('لا تؤكد') && nhcIllustrationDetailId && els.detail.innerHTML.includes('مصدر الصورة') && els.detail.innerHTML.includes('47490') && !els.detail.innerHTML.includes('لا تؤكد'));
  const areem = d.projects.find(x => x.id === 'P344');
  const areemMarkup = areem && A.card('projects', areem, null, true, false, {});
  const areemDetailId = areemMarkup && (areemMarkup.match(/data-detail="([^"]+)/) || [])[1];
  if (areemDetailId) A.openDetail(areemDetailId);
  assert('Areem area preserves the primary NHC statement and exposes its internal official-source discrepancy', !!areem && areem.area.includes('89,905.67') && areem.areaNote.includes('105,827') && areemDetailId && els.detail.innerHTML.includes('تفصيل المساحة') && els.detail.innerHTML.includes('مصدر المساحة') && els.detail.innerHTML.includes('231,637.22'));
  A.selectBranch('176', true);
  assert('Jeddah branch without a verified pin opens city data without fake zero-distance scope', A.state().scope === 'city' && !els.app.innerHTML.includes('id="radius"') && els.app.innerHTML.includes('لا تتوفر إحداثيات موثوقة لهذا الفرع'));
  A.selectBranch('307', true); const rasTanuraDefaultScope = A.state().scope; A.state().tab = 'offices'; A.renderBranch();
  assert('Ras Tanura missing pin explains that nearby offices cannot be measured', rasTanuraDefaultScope === 'branch' && !els.app.innerHTML.includes('data-scope="branch"') && els.content.innerHTML.includes('تعذر تحديد مكاتب عقار القريبة'));

  const failed = Object.entries(tests).filter(([, ok]) => !ok).map(([name]) => name);
  console.log(JSON.stringify({ suite: 'VM UI behavior regression', tests, passed: Object.values(tests).filter(Boolean).length, total: Object.keys(tests).length, failed }, null, 2));
  if (failed.length) process.exitCode = 1;
})().catch(err => { console.error(err.stack || err); process.exitCode = 1; });

