const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
function api(file){const document={getElementById:()=>({addEventListener(){}}),querySelectorAll:()=>[],addEventListener(){},createElement:()=>({})},window={addEventListener(){}};const src=fs.readFileSync(file,'utf8').replace('  boot();',' window.__imageTest={displayImage,recordMedia,bindImages,imageFallback,ph};');vm.runInNewContext(src,{document,window,URL,console,setTimeout,clearTimeout,localStorage:{getItem(){return null}},location:{hash:''},history:{}});return window.__imageTest;}
function mockMedia(markup){const media={images:[],caption:{hidden:false,dataset:{illustrative:markup.includes('data-illustrative="true"')?'true':'false'}},querySelector(selector){return selector==='.image-caption'?this.caption:selector==='.official-image'?this.images.find(i=>i.classList.contains('official-image')):null;}};
for(const match of markup.matchAll(/<img\s+([^>]+)>/g)){const attrs={};for(const a of match[1].matchAll(/([\w-]+)="([^"]*)"/g))attrs[a[1]]=a[2].replace(/&amp;/g,'&');const img={attrs,dataset:Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v])),events:{},parentElement:media,hidden:false,requests:[],classList:{contains:c=>(attrs.class||'').split(' ').includes(c)},closest:()=>null,setAttribute(k,v){attrs[k]=v},getAttribute(k){return attrs[k]},addEventListener(k,f){this.events[k]=f},remove(){media.images=media.images.filter(i=>i!==this)},set src(v){this._src=v;this.requests.push(v)},get src(){return this._src},fail(){this.events.error()}};media.images.push(img)}
const host={querySelectorAll:s=>s==='img[data-src]'?media.images:s==='.media, .d-media'?[media]:[]};return {media,host};}

const a=api(path.join(root,'assets/app.js'));let checks=0,records=0;
for(const file of ['projects','opportunities','nhc'])for(const o of JSON.parse(fs.readFileSync(path.join(root,'data',file+'.json')))){
 const kind=file==='opportunities'?'opps':file;
 assert(fs.existsSync(path.join(root,a.imageFallback(kind,o))));assert(a.recordMedia(kind,o).includes('data-generic="1"'));records++;
}
for(const type of ['شقق','استديو','فلل','فيلا','تاون هاوس','دوبلكس','']){
 const {media,host}=mockMedia(a.recordMedia('projects',{id:'fixture',n:'fixture',type,img:'https://invalid.example/missing.jpg'}));a.bindImages(host);
 const generic=media.images.find(i=>i.dataset.generic==='1'),official=media.images.find(i=>i.classList.contains('official-image'));official.fail();assert.equal(media.images.length,1);assert.equal(media.images[0],generic);
 generic.fail();assert(generic.src!==generic.attrs['data-src']);assert(fs.existsSync(path.join(root,generic.src)));generic.fail();assert(generic.src.startsWith('data:image/webp;base64,'));
 const bytes=Buffer.from(generic.src.split(',')[1],'base64');assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
 const requests=generic.requests.length;generic.fail();assert(generic.hidden);assert.equal(generic.requests.length,requests);checks++;
}
const evidence=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/image-quality-evidence.json')));
for(const r of evidence.replacements){for(const kind of ['projects','opps']){assert.equal(a.displayImage(kind,{id:r.id,img:r.oldImage}),r.image);checks++;}assert.notEqual(a.displayImage('projects',{id:r.id,img:'https://changed.example/new.jpg'}),r.image);checks++;}
for(const r of evidence.blocked){if(evidence.replacements.some(x=>x.oldImage===r.url))continue;for(const kind of ['projects','opps','nhc']){assert.equal(a.displayImage(kind,{id:'audit',img:r.url}),'');checks++;}}
assert.equal(a.displayImage('projects',{id:'other',img:'https://example.org/new-exterior.jpg'}),'https://example.org/new-exterior.jpg');checks++;
console.log(JSON.stringify({suite:'Project photos and bounded modern image fallbacks',ok:true,records,checks,actualBrowser:false}));
