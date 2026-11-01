/* Local-only PDF renderer. Native canvas shapes Arabic/RTL; JPEG pages keep that
   exact rendering in PDF viewers. No user data leaves the browser. */
(()=>{'use strict';
const W=1240,H=1754,M=100,BOTTOM=1590;
function pdfFromJpegs(pages,links=[]){
 const encoder=new TextEncoder(),parts=[],offsets=[0];let length=0;
 const put=v=>{const b=typeof v==='string'?encoder.encode(v):v;parts.push(b);length+=b.length;};
 const object=(id,body)=>{offsets[id]=length;put(`${id} 0 obj\n`);put(body);put('\nendobj\n');};
 put('%PDF-1.4\n% Elhami local export\n');
 object(1,'<< /Type /Catalog /Pages 2 0 R >>');
 object(2,`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`);
 pages.forEach((bytes,i)=>{const id=3+i*3;object(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im${i} ${id+1} 0 R >> >> /Contents ${id+2} 0 R /Annots [${(links[i]||[]).map(link=>`<< /Type /Annot /Subtype /Link /Rect [${link.rect.join(' ')}] /Border [0 0 0] /A << /S /URI /URI (${link.url.replace(/[\\()]/g,'\\$&')}) >> >>`).join(' ')}] >>`);
 offsets[id+1]=length;put(`${id+1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);put(bytes);put('\nendstream\nendobj\n');
 const stream=`q\n595.28 0 0 841.89 0 0 cm\n/Im${i} Do\nQ\n`;object(id+2,`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`);});
 const start=length,count=3+pages.length*3;put(`xref\n0 ${count}\n0000000000 65535 f \n`);for(let i=1;i<count;i++)put(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);put(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`);return new Blob(parts,{type:'application/pdf'});
}
function wrap(ctx,text,width){
 const out=[];for(const paragraph of String(text??'').replace(/\r\n?/g,'\n').split('\n')){
  if(!paragraph){out.push('');continue;}let line='';
  for(const word of paragraph.split(/\s+/u)){
   const candidate=line?line+' '+word:word;if(ctx.measureText(candidate).width<=width){line=candidate;continue;}
   if(line){out.push(line);line='';}
   if(ctx.measureText(word).width<=width){line=word;continue;}
   const chars=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('ar',{granularity:'grapheme'}).segment(word)].map(x=>x.segment):Array.from(word);
   for(const char of chars){if(line&&ctx.measureText(line+char).width>width){out.push(line);line='';}line+=char;}
  }out.push(line);
 }return out;
}
async function render(x,{baseURL,blocks,onProgress=()=>{}}={}){
 const font=new FontFace('ElhamiPDF',`url("${new URL('assets/ibm-plex-sans-arabic-regular.ttf',baseURL)}")`);await font.load();document.fonts.add(font);await document.fonts.load('28px ElhamiPDF');
 const logo=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('تعذر تحميل شعار الملف'));image.src=new URL('assets/logo-extended-v2.webp',baseURL).href;});
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('الرسم غير متاح');const pages=[],links=[];let pageLinks=[],y=0;
 const text=(value,size,color,right,top)=>{ctx.font=`${size}px ElhamiPDF`;ctx.fillStyle=color;ctx.direction='rtl';ctx.textAlign='right';ctx.textBaseline='top';ctx.fillText(value,right,top);};
 const begin=()=>{ctx.fillStyle='#fffdf8';ctx.fillRect(0,0,W,H);ctx.fillStyle='#5c8198';ctx.fillRect(M,55,W-2*M,5);ctx.drawImage(logo,W-M-238,83,238,238*logo.height/logo.width);text('إلهامي',27,'#456b7f',W-M,195);text(x.dateLabel,19,'#637a82',W-M,250);ctx.fillStyle='#dcd7ca';ctx.fillRect(M,295,W-2*M,1);y=330;pageLinks=[];};
 const finish=async()=>{ctx.fillStyle='#dcd7ca';ctx.fillRect(M,1631,W-2*M,1);const name=x.authorName||'غير محدد';ctx.font='22px ElhamiPDF';const size=Math.min(22,22*(W-2*M)/Math.max(1,ctx.measureText(name).width));text(name,size,'#456b7f',W-M,1653);text(String(pages.length+1),18,'#637a82',M+35,1653);const data=canvas.toDataURL('image/jpeg',.93).split(',')[1];pages.push(Uint8Array.from(atob(data),c=>c.charCodeAt(0)));links.push(pageLinks);onProgress(pages.length);await new Promise(r=>setTimeout(r,0));};
 begin();for(const b of blocks){const size=b.size||28,lineHeight=b.lineHeight||Math.ceil(size*1.8);ctx.font=`${size}px ElhamiPDF`;const lines=wrap(ctx,b.text,W-2*M);if(y+(b.gap||0)+lineHeight*Math.min(lines.length,b.keep?3:1)>BOTTOM){await finish();begin();}y+=b.gap||0;for(const line of lines){if(y+lineHeight>BOTTOM){await finish();begin();}text(line,size,b.color||'#294759',W-M,y);if(b.href&&line){pageLinks.push({url:b.href,rect:[M/W*595.28,(H-y-lineHeight)/H*841.89,(W-M)/W*595.28,(H-y)/H*841.89]});}y+=lineHeight;}}
 await finish();canvas.width=canvas.height=1;return {blob:pdfFromJpegs(pages,links),pageCount:pages.length};
}
window.ElhamiPDF={render,pdfFromJpegs,wrap};
})();
