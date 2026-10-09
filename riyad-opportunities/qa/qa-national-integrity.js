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
const cityKey=s=>{const k=norm(s).replace(/[.,،()\-–_]/g,' ').replace(/\s+/g,' ').trim();if(['الاحساء','الهفوف','المبرز'].includes(k))return norm('الأحساء');if([norm('سبت العلايا'),norm('سبت العلاية')].includes(k))return norm('سبت العلاية');if([norm('ضرما'),norm('ضرماء')].includes(k))return norm('ضرماء');if([norm('الأفلاج'),norm('ليلى')].includes(k))return norm('الأفلاج');return k;};
const cities=[...new Set(branches.map(b=>cityKey(b.city)))];
const carOnlyCities=[...new Set(cars.map(o=>cityKey(o.city)))].filter(c=>!cities.includes(c));
const allCityChoices=new Set([...cities,...carOnlyCities]);
for(const rows of [projects,opps,nhc,read('selfbuild'),companies,offices,cars])for(const o of rows)for(const city of [o.city,...(o.coverageCities||[])].filter(Boolean))allCityChoices.add(cityKey(city));
const cityOnlyDataCities=[...allCityChoices].filter(c=>!cities.includes(c));
check('قائمة المدن الموحدة تشمل كل الفئات وتطابق metadata بعد دمج الأسماء', cities.length===77 && meta.branchCityChoiceCount===77 && carOnlyCities.length===2 && allCityChoices.size===81 && meta.cityChoiceCount===81 && meta.cityOnlyShowroomCityCount===2 && meta.cityOnlyDataCityCount===4 && cityOnlyDataCities.length===4 && cityOnlyDataCities.includes(cityKey('أحد رفيدة'))&&cityOnlyDataCities.includes(cityKey('بقعاء')), {branchCities:cities.length,carOnlyCities,cityOnlyDataCities,allChoices:allCityChoices.size,meta:meta.cityChoiceCount});
check('تهجئتا سبت العلايا وسبت العلاية مدينة واحدة و5 مكاتبها تدخل في العد',cityKey('سبت العلايا')===cityKey('سبت العلاية')&&offices.filter(o=>cityKey(o.city)===cityKey('سبت العلاية')).length===5,{offices:offices.filter(o=>cityKey(o.city)===cityKey('سبت العلاية')).length});
check('الفلاج وضرماء موحدتان مع ربط الفرعين الصحيحين',cityKey(branches.find(b=>String(b.c)==='215')?.city)===cityKey('الأفلاج')&&cityKey(branches.find(b=>String(b.c)==='219')?.city)===cityKey('ضرماء'),{aflaj:branches.find(b=>String(b.c)==='215')?.city,dhurma:branches.find(b=>String(b.c)==='219')?.city});
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
check('الأصول المفاهيمية المولدة موسومة وفريدة لكل مشروع مسند إليها',(()=>{const xs=projects.filter(p=>p.imageType&&p.imageType.includes('مولّدة بالذكاء الاصطناعي'));return xs.length===10&&xs.every(p=>p.img.startsWith('data:image/webp;base64,')&&projects.filter(q=>q.img===p.img).length===1)})(),projects.filter(p=>p.imageType&&p.imageType.includes('مولّدة بالذكاء الاصطناعي')).map(p=>p.id));
check('كل صور fallback المشار إليها موجودة',['real-estate-illustrative-villa.svg','real-estate-illustrative-apartments.svg','real-estate-illustrative-townhomes.svg','real-estate-illustrative-courtyard.svg'].every(x=>fs.existsSync(path.join(root,'assets/images',x))));
check('تحديث ملفات البيانات متوافق مع أعداد metadata',projects.length===meta.counts.projects&&nhc.length===meta.counts.nhc&&opps.length===meta.counts.opportunities&&companies.length===meta.counts.companies&&cars.length===meta.counts.cars&&offices.length===meta.counts.offices,{projects:projects.length,nhc:nhc.length,opportunities:opps.length,companies:companies.length,cars:cars.length,offices:offices.length,meta:meta.counts});
const result={ok:failures.length===0,branches:branches.length,canonicalCities:cities.length,urlFieldsValidated:urlCount,carRecordsWithMapSearch:cars.length,failures};
console.log(JSON.stringify(result,null,2));if(failures.length)process.exit(1);


const imageUrls=projects.filter(p=>p.img).map(p=>p.img);
check('كل صورة مشروع غير فارغة فريدة ولا تتكرر بين السجلات',new Set(imageUrls).size===imageUrls.length,{images:imageUrls.length,unique:new Set(imageUrls).size,duplicates:imageUrls.length-new Set(imageUrls).size});
