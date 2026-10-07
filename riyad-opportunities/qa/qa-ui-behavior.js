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
    selectBranch, renderBranch, renderStart, renderSection, compute, itemsFor,
    emptyState, card, openDetail, closeDlg, sameCity, data: () => D, state: () => S
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

  // Branch selection and branch change use the same functions/listeners as the UI.
  A.selectBranch('243');
  assert('select branch 243 renders its identity', A.state().branch.c === '243' && els.app.innerHTML.includes('القادسية'));
  fireDocument('click', target({ 'data-act': 'change' }));
  assert('change branch returns to branch picker', !A.state().branch && els.app.innerHTML.includes('اختر الفرع'));
  els['q-city'].value = 'الرياض'; els['q-city'].dispatch('change');
  els['q-branch'].value = '242'; els['q-branch'].dispatch('input');
  const branchList = els['branch-list'].innerHTML;
  els['branch-list'].dispatch('click', { target: target({ 'data-code': '242' }) });
  assert('picker selects a different branch 242', A.state().branch.c === '242' && branchList.includes('242'));

  // Exercise every radius through the actual select change listener, then the city scope button.
  const radiusResults = [];
  for (const r of [5, 10, 15, 20]) {
    const el = els.radius;
    el.value = String(r); el.dispatch('change');
    radiusResults.push(A.state().radius === r && A.state().scope === 'branch' && els.app.innerHTML.includes(`value="${r}" selected`));
  }
  assert('5/10/15/20 km controls update branch scope', radiusResults.every(Boolean));
  fireDocument('click', target({ 'data-scope': 'city' }));
  assert('all-city scope is explicit and applied', A.state().scope === 'city' && els.app.innerHTML.includes('كل المدينة'));

  // Find a genuine zero-result radius case in the included data and test expansion end-to-end.
  A.selectBranch('243'); A.state().radius = 5; A.state().scope = 'branch';
  const candidate = ['projects', 'opps', 'offices', 'cars'].find(k =>
    ((d.cityCount[k] || {}).الرياض || 0) > 0 && A.itemsFor(k, '', 'branch').length === 0);
  let expanded = false;
  if (candidate) {
    A.state().tab = candidate; A.renderBranch();
    const zeroMarkup = els.content.innerHTML;
    fireDocument('click', target({ 'data-radius': '10' }));
    expanded = zeroMarkup.includes('data-radius="10"') && A.state().radius === 10 && A.state().scope === 'branch';
  }
  assert('zero-result 5 km state offers and applies 10 km expansion', expanded);

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

  const failed = Object.entries(tests).filter(([, ok]) => !ok).map(([name]) => name);
  console.log(JSON.stringify({ suite: 'VM UI behavior regression', tests, passed: Object.values(tests).filter(Boolean).length, total: Object.keys(tests).length, failed }, null, 2));
  if (failed.length) process.exitCode = 1;
})().catch(err => { console.error(err.stack || err); process.exitCode = 1; });
