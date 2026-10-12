import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const carsPath = path.join(root, 'data', 'cars.json');
const auditsDir = path.join(root, 'audits');
const manifestPath = path.join(root, 'CAR_CORRECTION_APPLICATION_MANIFEST_212_2026-10-11.json');

const cars = JSON.parse(fs.readFileSync(carsPath, 'utf8'));
const originalCount = cars.length;
const beforeById = new Map(cars.map((row) => [row.id, JSON.stringify(row)]));
const protectedIds = new Set(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).protected_qadisiyah_ids || []);
if (protectedIds.size !== 33) throw new Error(`Expected 33 protected Qadisiyah IDs, found ${protectedIds.size}`);

const selected = fs.readdirSync(auditsDir)
  .filter((name) => /^(CAR_AUDIT_|FINAL_PARALLEL_).*\.json$/.test(name))
  .sort();

const byId = new Map(cars.map((row) => [row.id, row]));
const removeIds = new Set();
const replacements = [];
const applied = [];
const skipped = [];

function setField(row, key, value, source) {
  if (value === undefined || value === null) return;
  if (key === 'name' || key === 'n') row.n = value;
  else if (key === 'phone') row.phones = [value];
  else if (key === 'phones') row.phones = value;
  else if (key === 'lng' || key === 'lon') row.lon = value;
  else if (key === 'lat') row.lat = value;
  else if (key === 'maps') row.maps = value;
  else if (key === 'maps_cid') row.maps = `https://www.google.com/maps/?cid=${value}`;
  else if (key === 'address' || key === 'neighborhood' || key === 'nb') row.nb = value;
  else if (key === 'city') row.city = value;
  else return;
  applied.push({ id: row.id, field: key, source });
}

for (const name of selected) {
  const doc = JSON.parse(fs.readFileSync(path.join(auditsDir, name), 'utf8'));
  for (const rec of doc.records || doc.decisions || []) {
    if (protectedIds.has(rec.id)) throw new Error(`Protected Qadisiyah record targeted: ${rec.id} in ${name}`);
    if (rec.decision === 'archive' || rec.decision === 'archive_and_replace' || rec.decision === 'archive_duplicate') {
      removeIds.add(rec.id);
      if (rec.replacement) replacements.push({
        rec: { id: `replacement-${rec.id}`, city: rec.city, observed: rec.replacement },
        change: { ...rec.replacement, add_as_replacement_for: rec.id },
        source: name
      });
      continue;
    }
    const proposed = rec.proposed_change || rec.proposed_changes || rec.proposedChange || rec.proposed || rec.proposed_correction?.new_value || rec.proposed_correction || null;
    const change = proposed || ((rec.decision === 'correct' || rec.decision === 'unresolved_phone') ? rec.verified : null);
    if (!change || typeof change !== 'object') continue;

    if (change.add_as_replacement_for) {
      replacements.push({ rec, change, source: name });
      continue;
    }
    if (change.archive_from_display || change.archive_duplicate_from_display || change.archive_duplicate || change.archive) {
      removeIds.add(rec.id);
      continue;
    }

    const row = byId.get(rec.id);
    if (!row) {
      skipped.push({ id: rec.id, reason: 'not_in_current_cars', source: name });
      continue;
    }
    for (const [key, value] of Object.entries(change)) setField(row, key, value, name);
  }
}

for (const { rec, change, source } of replacements) {
  if (byId.has(rec.id)) continue;
  const o = rec.observed || {};
  const row = {
    id: rec.id,
    n: o.name,
    city: rec.city,
    nb: o.address || '',
    phones: o.phones || (o.phone ? [o.phone] : []),
    web: '',
    maps: change.maps || (o.maps_cid ? `https://www.google.com/maps/?cid=${o.maps_cid}` : ''),
    lat: o.lat ?? null,
    lon: o.lng ?? o.lon ?? null,
    sec: '',
    loc: 'pt',
    pdfShowroomVerified: true,
    mapReviewStatus: 'verified_live_google_2026-10-12'
  };
  if (!row.n || !row.city || !row.maps || row.lat == null || row.lon == null) {
    skipped.push({ id: rec.id, reason: 'incomplete_replacement', source });
    continue;
  }
  byId.set(row.id, row);
  cars.push(row);
  applied.push({ id: row.id, field: 'replacement_added', source });
}

const output = cars.filter((row) => !removeIds.has(row.id));
const outputIds = new Set(output.map((row) => row.id));
if (outputIds.size !== output.length) throw new Error('Duplicate IDs after applying audits');
for (const id of protectedIds) {
  const row = output.find((candidate) => candidate.id === id);
  if (!row) throw new Error(`Protected Qadisiyah record removed: ${id}`);
  if (JSON.stringify(row) !== beforeById.get(id)) throw new Error(`Protected Qadisiyah record changed: ${id}`);
}

fs.writeFileSync(carsPath, `${JSON.stringify(output, null, 2)}\n`);
const report = {
  generated_at: new Date().toISOString(),
  audits_considered: selected,
  cars_before: originalCount,
  cars_after: output.length,
  protected_qadisiyah_unchanged: protectedIds.size,
  removed_ids: [...removeIds].filter((id) => !outputIds.has(id)),
  added_replacements: replacements.map(({ rec }) => rec.id).filter((id) => outputIds.has(id)),
  applied_field_operations: applied.length,
  skipped
};
fs.writeFileSync(path.join(auditsDir, 'FINAL_CAR_APPLICATION_REPORT_2026-10-12.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
