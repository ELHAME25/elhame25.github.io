Warning: truncated output (original token count: 9004)
Total output lines: 403

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
  assert('verified areas, project status, official render and contact sources are exposed', !!areemNHC && areemNHC.area.includes('89,905.67 م²') && areemNHC.areaSource && !!areemSumou && areemSumou.area.startsWith('231,637.22 م²') && !!lamarya && lamarya.status.includes('تم البيع') && lamarya.phones.includes('0556388388') && !!munsiyah && !munsiyah.loc && munsiyah.img.includes('clusters.sa/_next/image') && munsiyah.imageType.includes('تصميم معماري') && sourcedCars.every(id => { const o = d.cars.find(x => x.id === id); return o && o.phones.length && o.phoneSource; }) && appMarkup.includes("['المساحة', o.area]") && !appMarkup.includes('مصدر رقم التواصل') && appMarkup.includes('o.imageSourceUrl'));
  const renderCard = A.card('projects', munsiyah, null, true, false, {}), renderId = renderCard.match(/data-detail="(\d+)"/);
  if (renderId) A.openDetail(Number(renderId[1]));
  const renderCaption = !!renderId && !els.detail.innerHTML.includes('تصميم معماري رسمي من المطور') && !els.detail.innerHTML.includes('image-note');
  const sourceCar = d.cars.find(x => x.id === sourcedCars[0]);
  const sourceCard = A.card('cars', sourceCar, null, true, false, {});
  const phoneSourceMarkup = !sourceCard.includes('مصدر رقم التواصل') && !sourceCard.includes('dalilmadina.com') && sourceCar.phoneSource.includes('dalilmadina.com') && sourceCard.includes('0172216248');
  const gulfCar = d.cars.find(x => x.id === 'phase6-cars-ad77d20fffff8b');
  const gulfCard = A.card('cars', gulfCar, null, true, false, {});
  assert('showroom cards show compact locations without postal noise or modifying source addresses', sourceCard.includes('خميس مشيط') && !sourceCard.includes('5098') && !sourceCard.includes('62451') && !sourceCard.includes('المملكة العربية السعودية') && gulfCard.includes('حي المعارض، خميس مشيط') && !gulfCard.includes('62451') && sourceCar.nb.includes('5098') && gulfCar.nb.includes('62451'));
  assert('official project image is shown without a descriptive caption', renderCaption);
  assert('showroom phone source is retained without displaying provenance labels', phoneSourceMarkup);
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

  // Branch totals include only geographically verifiable projects; city view retains unlocated projects.
  A.selectBranch('243'); A.state().radius = 5; A.state().scope = 'branch'; A.renderBranch();
  const projectCount5 = A.itemsFor('projects', '', 'branch');
  const cityProjectCount = A.itemsFor('projects', '', 'city');
  const unknownInBranch = projectCount5.filter(x => x.rankD == null).length;
  const unknownInCity = cityProjectCount.filter(x => x.rankD == null).length;
  els.radius.value = '10'; els.radius.dispatch('change');
  const projectCount10 = A.itemsFor('projects', '', 'branch').length;
  assert('branch radius excludes unlocated records while city view retains them', A.state().radius === 10 && A.state().scope === 'branch' && projectCount10 >= projectCount5.length && unknownInBranch === 0 && unknownInCity > 0);

  // The search control and live filtering are exercised independently for each populated section.
  const searchable = ['projects', 'opps', 'nhc', 'selfbuild', 'companies', 'offices', 'cars'];
  const searchResults = searchable.map(k => {
    const city = Object.keys(d.cityCount[k] || {}).find(c => (d.cityCount[k][c] || 0) >…4004 tokens truncated…ces', '', 'branch');
  assert('Yanbu remains city-wide without radius or sector controls', yanbu20.length > 0 && yanbu20.map(x=>x.o.id).sort().join('|') === yanbu15.map(x=>x.o.id).sort().join('|') && yanbu20.every(x => A.sameCity(x.o.city,'ينبع')) && !els.app.innerHTML.includes('id="radius"') && !els.app.innerHTML.includes('data-explore='));
  A.selectBranch('302', true); A.state().radius = 15; A.state().scope = 'branch';
  const dammamProject = A.itemsFor('projects', '', 'branch').find(x => x.o.id === 'P128');
  const dammamOffice = A.itemsFor('offices', '', 'branch').find(x => x.o.id === 'national-ejar-office-201861');
  const dammamCar = A.itemsFor('cars', '', 'branch').find(x => x.o.id === 'national-car-c80e0cb5068ed3');
  const dammamSihaatProject = A.itemsFor('projects', '', 'branch').find(x => x.o.id === 'P206');
  const dammamCityProjects = A.itemsFor('projects', '', 'city');
  A.state().radius = 5;
  const dammamProjectAtFive = A.itemsFor('projects', '', 'branch').some(x => x.o.id === 'P128');
  assert('Dammam excludes adjacent-city projects, offices and showrooms at every radius',
    !dammamProject && !dammamOffice && !dammamCar && !dammamSihaatProject && !dammamProjectAtFive &&
    dammamCityProjects.length > 0 && dammamCityProjects.every(x=>A.sameCity(x.o.city,'الدمام')) &&
    ['projects','opps','offices','cars'].every(kind=>A.itemsFor(kind,'','branch').every(x=>A.sameCity(x.o.city,'الدمام'))));
  A.selectBranch('343', true); A.state().radius = 15; A.state().scope = 'branch'; A.state().tab = 'offices';
  const hammamOffice = A.itemsFor('offices', '', 'branch').find(x => x.o.id === 'national-google-office-ChIJb4iRjgoANj4RbrlqN2zXyVY');
  assert('Dammam Badr excludes Umm Al-Hamam offices while preserving them in source data', !hammamOffice && d.offices.some(x=>x.id==='national-google-office-ChIJb4iRjgoANj4RbrlqN2zXyVY' && x.city==='أم الحمام'));
  const companySource = d.companies.find(x => x.id === 'cp-1046304230');
  A.selectBranch('243');
  const companyCard = A.card('companies', companySource, null, true, false, {});
  assert('verified developer phone remains on cards without provenance labels', companySource.phones.includes('920004077') && companySource.phoneSource === 'https://darwaemaar.com/contact/' && companySource.kind === 'تطوير وبيع مباشر' && !companyCard.includes('مصدر رقم التواصل') && companyCard.includes('920004077'));
  const sourcedDevelopers = ['cp-f6aebb8ded', 'cp-48cf823418', 'cp-4aeeb21c92'].map(id => d.companies.find(x => x.id === id));
  assert('newly verified developer phone sources and types are retained', sourcedDevelopers.every(x => x && x.phones.length && x.phoneSource && x.kind === 'تطوير وبيع مباشر'));
  const nhcProject = d.projects.find(x => x.id === 'P585');
  const nhcCardMarkup = A.card('projects', nhcProject, null, true, false, {});
  const nhcDetailId = (nhcCardMarkup.match(/data-detail="([^"]+)/) || [])[1];
  A.openDetail(nhcDetailId);
  assert('official NHC project contact is labeled as developer contact with its source', nhcProject.phones.includes('920033499') && nhcProject.phoneLevel === 'dev' && nhcProject.phoneSource === 'https://www.nhc.sa/contact/' && els.detail.innerHTML.includes('رقم المطور') && !els.detail.innerHTML.includes('مصدر رقم التواصل'));
  const nhcUnits = {'الفرسان':'أكثر من 50,000 وحدة','الربى':'أكثر من 9,000 وحدة','خزام':'أكثر من 52,000 وحدة','الأصالة':'5,835 وحدة','المشرقية':'15,055 وحدة'};
  const nhcUnitsVisible = Object.entries(nhcUnits).every(([name, count]) => {
    const destination = d.nhc.find(x => x.n === name && x.city === 'الرياض');
    const detailId = destination && (A.card('nhc', destination, null, true, false, {}).match(/data-detail="([^\"]+)/) || [])[1];
    if (!detailId) return false;
    A.openDetail(detailId);
    return els.detail.innerHTML.includes('إجمالي الوحدات') && els.detail.innerHTML.includes(count) && els.detail.innerHTML.includes('العودة إلى القائمة');
  });
  assert('Riyadh NHC destination details show only their confirmed total unit count and return control', nhcUnitsVisible);
  const akariaProject = d.projects.find(x => x.id === 'P386');
  assert('official Al Akaria project contact is labeled as developer contact', akariaProject.phones.includes('920003938') && akariaProject.phoneLevel === 'dev' && akariaProject.phoneSource === 'https://www.al-akaria.com/contact/');
  const etqaan = d.offices.find(x => x.id === 'national-ejar-office-202414');
  A.selectBranch('301');
  const officeCard = A.card('offices', etqaan, null, true, false, {});
  assert('verified Khobar office phone is shown and its source retained in data', etqaan.phones.includes('0138949444') && etqaan.phoneSource === 'https://etqaan.com.sa/' && !officeCard.includes('مصدر رقم التواصل') && officeCard.includes('0138949444'));
  const closedOffice = d.offices.find(x => x.id === 'national-ejar-office-202402');
  A.selectBranch('403', true); A.state().tab = 'offices'; A.state().scope = 'city';
  assert('permanently closed office remains in source data but is excluded from active results', closedOffice && closedOffice.activityReviewStatus === 'closed_permanently' && !A.itemsFor('offices', '', 'city').some(x => x.o.id === closedOffice.id));
  const unverifiedEjarOffice = d.offices.find(x => x.id === 'national-ejar-office-195881');
  assert('Ejar placeholder phone is suppressed instead of publishing an unverified directory number', !!unverifiedEjarOffice && unverifiedEjarOffice.phoneVerificationStatus === 'unverified' && unverifiedEjarOffice.phones.length === 0 && !unverifiedEjarOffice.phoneSource);
  const eliteMakkah = d.cars.find(x => x.id === 'entity-66efa1d00757');
  const carCard = A.card('cars', eliteMakkah, null, true, false, {});
  assert('Makkah showroom phone matches its address and retains the listing source in data', eliteMakkah.phones.includes('0555555112') && !carCard.includes('مصدر رقم التواصل') && eliteMakkah.phoneSource.includes('bizmideast.com'));

  const aiProjects = ['P001','P002','P003','P004','P005','P006','P007','P009','P010','P011'].map(id => d.projects.find(x => x.id === id));
  const aiProjectCards = aiProjects.map(x => x && A.card('projects', x, null, true, false, {}));
  assert('Ten AI-generated project images are unique and displayed without image-description text', aiProjects.every((x,i) => x && x.img.startsWith('data:image/webp;base64,') && x.imageType.includes('مولّدة بالذكاء الاصطناعي') && !aiProjectCards[i].includes('صورة مفاهيمية مولّدة بالذكاء الاصطناعي') && !aiProjectCards[i].includes('صورة توضيحية') && d.projects.filter(y => y.img === x.img).length === 1) && new Set(aiProjects.map(x=>x.img)).size===10);
  const nhcIllustrations = ['P013','P585'].map(id => d.projects.find(x => x.id === id));
  const nhcIllustrationCard = nhcIllustrations[0] && A.card('projects', nhcIllustrations[0], null, true, false, {});
  const nhcIllustrationDetailId = nhcIllustrationCard && (nhcIllustrationCard.match(/data-detail="([^\"]+)/) || [])[1];
  if (nhcIllustrationDetailId) A.openDetail(nhcIllustrationDetailId);
  assert('Modern NHC images have source links and no visible image-description text', nhcIllustrations.every(x => x && x.img.startsWith('https://ruh-s3.bluvalt.com/') && x.imageSourceUrl === x.page && x.page.includes('nhc.sa')) && !nhcIllustrationCard.includes('صورة من صفحة NHC الرسمية') && nhcIllustrationDetailId && els.detail.innerHTML.includes('47490'));
  const curatedProjectImages = ['P013','P369','P394','P395','P425','P426','P446','P460','P474','P490','P546','P585'].map(id => d.projects.find(x => x.id === id));
  assert('Twelve decorative project images load from developer/company pages with distinct image URLs', curatedProjectImages.every(x => x && x.img && x.imageSourceUrl && /^https:\/\//.test(x.img) && /^https:\/\//.test(x.imageSourceUrl)) && new Set(curatedProjectImages.map(x => x.img)).size === curatedProjectImages.length);
  const areem = d.projects.find(x => x.id === 'P344');
  const areemMarkup = areem && A.card('projects', areem, null, true, false, {});
  const areemDetailId = areemMarkup && (areemMarkup.match(/data-detail="([^"]+)/) || [])[1];
  if (areemDetailId) A.openDetail(areemDetailId);
  assert('Areem area preserves the primary NHC statement and exposes its internal official-source discrepancy', !!areem && areem.area.includes('89,905.67') && areem.areaNote.includes('105,827') && areemDetailId && els.detail.innerHTML.includes('تفصيل المساحة') && els.detail.innerHTML.includes('مصدر المساحة') && els.detail.innerHTML.includes('231,637.22'));
  A.selectBranch('176', true);
  assert('Jeddah branch without a verified pin opens city data without fake zero-distance scope', A.state().scope === 'city' && !els.app.innerHTML.includes('id="radius"') && !els.app.innerHTML.includes('إحداثيات موثوقة لهذا الفرع'));
  A.selectBranch('307', true); const rasTanuraDefaultScope = A.state().scope; A.state().tab = 'offices'; A.renderBranch();
  assert('Ras Tanura missing pin still opens full city offices without invented radius', rasTanuraDefaultScope === 'branch' && !els.app.innerHTML.includes('data-scope="branch"') && !els.app.innerHTML.includes('id="radius"') && A.itemsFor('offices','','branch').map(x=>x.o.id).sort().join('|') === A.itemsFor('offices','','city').map(x=>x.o.id).sort().join('|'));

  const failed = Object.entries(tests).filter(([, ok]) => !ok).map(([name]) => name);
  console.log(JSON.stringify({ suite: 'VM UI behavior regression', tests, passed: Object.values(tests).filter(Boolean).length, total: Object.keys(tests).length, failed }, null, 2));
  if (failed.length) process.exitCode = 1;
})().catch(err => { console.error(err.stack || err); process.exitCode = 1; });

