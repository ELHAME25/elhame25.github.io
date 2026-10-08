#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name + '.json'), 'utf8'));
const failures = [];
const check = (name, ok, detail) => { if (!ok) failures.push({name, detail}); };
const meta=read('meta'), branches=read('branches'), projects=read('projects'), nhc=read('nhc'), opps=read('opportunities'), companies=read('companies'), cars=read('cars'), offices=read('offices');
const norm=s=>String(s||'').replace(/[أإآ]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
const cityAliases={ 'الهفوف':'الأحساء','المبرز':'الأحساء' };
const cities=[...new Set(branches.map(b=>cityAliases[b.city]||b.city).map(norm))];
const carOnlyCities=[...new Set(cars.map(o=>cityAliases[o.city]||o.city).map(norm))].filter(c=>!cities.includes(c));
const allCityChoices=new Set([...cities,...carOnlyCities]);
check('خيارات الفروع تبقى كاملة مع إتاحة مدن المعارض بلا فرع', cities.length===77 && meta.branchCityChoiceCount===77 && carOnlyCities.length===4 && meta.cityChoiceCount===allCityChoices.size, {branchCities:cities.length,cityOnlyCities:carOnlyCities,allChoices:allCityChoices.size,meta:meta.cityChoiceCount});
check('إجمالي الفروع يطابق metadata',branches.length===meta.counts.branches,{branches:branches.length,meta:meta.counts.branches});
const noCoords=branches.filter(b=>b.lat==null||b.lon==null).map(b=>String(b.c));
check('الفروع بلا إحداثيات نشطة محصورة في 176 و307',JSON.stringify(noCoords.sort())===JSON.stringify(['176','307']),noCoords);
check('سيهات مصنفة في مدينتها الصحيحة',projects.some(p=>p.id==='P206'&&p.city==='سيهات'&&p.nb==='الفيحاء الشرقية'&&p.maps&&p.page&&p.img),projects.find(p=>p.id==='P206'));
check('سرايا البدر ترتبط بصفحتها الرسمية في المدينة المنورة',projects.some(p=>p.id==='P163'&&p.city==='المدينة المنورة'&&p.page==='https://darwaemaar.com/project/saraya-al-bader-al-madinah-ar/'),projects.find(p=>p.id==='P163')?.page);
const records=[...projects,...nhc,...opps,...companies,...cars,...offices];
const fields=['maps','mapsQ','sales','web','page','dsite','url','contactUrl','wa','img','geoSource','pageSource','pageEvidence','nbSource'];
let urlCount=0;
for(const o of records) for(const f of fields){const v=o[f];if(typeof v!=='string'||!v.trim())continue;if(v.startsWith('assets/')){check('مسار صورة محلي موجود',fs.existsSync(path.join(root,v)),{id:o.id,field:f,value:v});continue}if(!/^https?:\/\//i.test(v))continue;urlCount++;try{const u=new URL(v);check('الرابط يستخدم بروتوكولًا آمنًا',u.protocol==='https:'||u.protocol==='http:',{id:o.id,field:f});check('الرابط يملك اسم مضيف',!!u.hostname,{id:o.id,field:f,value:v.slice(0,120)});}catch(e){failures.push({name:'صيغة رابط البيانات صحيحة',detail:{id:o.id,field:f,value:v.slice(0,160)}})}}
check('كل سجلات المعارض الخام لها رابط خرائط قابل للفتح',cars.every(o=>o.maps||o.sales||o.mapsQ),cars.filter(o=>!(o.maps||o.sales||o.mapsQ)).map(o=>o.id));
check('كل صور fallback المشار إليها موجودة',['real-estate-illustrative-villa.svg','real-estate-illustrative-apartments.svg','real-estate-illustrative-townhomes.svg','real-estate-illustrative-courtyard.svg'].every(x=>fs.existsSync(path.join(root,'assets/images',x))));
check('تحديث ملفات البيانات متوافق مع أعداد metadata',projects.length===meta.counts.projects&&nhc.length===meta.counts.nhc&&opps.length===meta.counts.opportunities&&companies.length===meta.counts.companies&&cars.length===meta.counts.cars&&offices.length===meta.counts.offices,{projects:projects.length,nhc:nhc.length,opportunities:opps.length,companies:companies.length,cars:cars.length,offices:offices.length,meta:meta.counts});
const result={ok:failures.length===0,branches:branches.length,canonicalCities:cities.length,urlFieldsValidated:urlCount,carRecordsWithMapSearch:cars.length,failures};
console.log(JSON.stringify(result,null,2));if(failures.length)process.exit(1);
