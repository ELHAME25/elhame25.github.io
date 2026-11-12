const encoder=new TextEncoder();
const width=842,height=595,margin=26,scale=2;
let prepared=null;
function drawPages(report){
 const onePage=!!report.querySelector('.periods-block');
 const pages=[];let canvas,ctx,usedHeight=height;
 const fresh=()=>{canvas=document.createElement('canvas');canvas.width=width*scale;canvas.height=(onePage?2200:height)*scale;ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.direction='rtl';ctx.textBaseline='middle';ctx.fillStyle='#230871';ctx.fillRect(margin,12,width-margin*2,3);};
 const save=()=>{let image=canvas;if(onePage){image=document.createElement('canvas');image.width=width*scale;image.height=height*scale;const out=image.getContext('2d');out.fillStyle='#fff';out.fillRect(0,0,image.width,image.height);const fit=Math.min(1,height/usedHeight),renderedWidth=width*scale*fit;out.drawImage(canvas,0,0,width*scale,usedHeight*scale,(image.width-renderedWidth)/2,0,renderedWidth,usedHeight*scale*fit);}pages.push(Uint8Array.from(atob(image.toDataURL('image/jpeg',.95).split(',')[1]),c=>c.charCodeAt(0)));};
 const font=(size=11,bold=false)=>{ctx.font=(bold?'bold ':'')+size+'px Arabic,Arial,sans-serif';};
 const write=(text,x,y,align='right',color='#302153')=>{ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(text,x,y);};
 const wrap=(text,w)=>{const out=[];for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/)){if(line&&ctx.measureText(line+' '+word).width>w){out.push(line);line=word;}else line+=(line?' ':'')+word;}out.push(line);}return out;};
 const cell=(text,x,y,w,h,bg='',size=10,bold=false)=>{if(bg){ctx.fillStyle=bg;ctx.fillRect(x,y,w,h);}ctx.strokeStyle='#dfe1e8';ctx.strokeRect(x,y,w,h);font(size,bold);const lines=wrap(text,w-12);lines.forEach((l,i)=>write(l,x+w-6,y+(h-lines.length*13)/2+7+i*13));};
 const table=(el,x,y,w)=>{if(!el)return y;const rows=[...el.querySelectorAll('tr')],hasHeader=!!el.querySelector('thead');let yy=y;for(let j=0;j<rows.length;j++){const cells=[...rows[j].children];const weights=el.matches('.repayment-list')?[.52,.30,.18]:el.matches('.constructionRules')&&cells.length===4?[.12,.12,.48,.28]:el.matches('.desktop-schedule')&&!report.querySelector('.draw-report-columns')&&cells.length>2?[.28,...Array(cells.length-1).fill(.72/(cells.length-1))]:cells.map(()=>1/cells.length);const widths=weights.map(v=>v*w);font(9);const vals=cells.map(c=>(c.querySelector('.period-name')?.textContent||c.textContent.trim()).replace(/ريال/g,''));const h=Math.max(j===0&&hasHeader?30:25,...vals.map((v,i)=>wrap(v,widths[i]-12).length*13+10));let edge=x+w;cells.forEach((c,i)=>{edge-=widths[i];cell(vals[i],edge,yy,widths[i],h,j===0&&hasHeader||rows[j].classList.contains('period-total')?'#eff5f7':'',9,c.classList.contains('payment-cell'));});yy+=h;}return yy;};
 fresh();font(16,true);write(report.querySelector('.reportHead h2')?.textContent||'حسبة العميل / ـة :' ,width/2,34,'center','#008d8c');font(9);write(onePage?'':report.querySelector('.product-title')?.textContent||'',width/2,53,'center','#857b96');
 const metrics=[...report.querySelectorAll('.resultMetrics>div')];const stacked=!!report.querySelector('.periods-block');const x=stacked?margin:width/2+12,w=stacked?width-margin*2:width/2-margin-12;let rightY=72;
 const metricHeight=Math.min(23,Math.max(18,455/Math.max(1,metrics.length)));
 for(let i=0;i<metrics.length;i++){if(!onePage&&rightY+metricHeight>height-55){save();fresh();rightY=35;}const label=metrics[i].querySelector('dt').textContent,value=metrics[i].querySelector('dd').textContent;cell(label,x+w*.48,rightY,w*.52,metricHeight,'',9);cell(value,x,rightY,w*.48,metricHeight,i===0?'#e9f4f5':'',9);rightY+=metricHeight;}
 const manual=!!report.querySelector('.draw-report-columns');
 let leftY=manual?72:table(report.querySelector('.desktop-schedule'),margin,stacked?rightY+14:72,w);if(manual){font(12,true);write('آلية صرف الدفعات حسب سياسة البنك',margin+w,81);leftY=table(report.querySelector('.constructionRules'),margin,96,w);font(12,true);write('دفعات العميل',x+w,rightY+15);rightY=table(report.querySelector('.desktop-schedule'),x,rightY+28,w);}const payment=report.querySelector('.personal-payment');if(payment){const paymentY=rightY+25;font(12,true);write('القسط الشهري',width/2,paymentY,'center');font(19,true);write(payment.textContent,width/2,paymentY+29,'center');leftY=paymentY+48;}for(const extra of report.querySelectorAll('table'))if(!extra.matches('.desktop-schedule,.constructionTable,.constructionRules,.phase-rates'))leftY=table(extra,margin,leftY+15,w);
 const supportRows=[...report.querySelectorAll('.repayment-summary>div')];
 for(const row of supportRows){const yy=leftY+6;cell(row.querySelector('dt').textContent,margin+w*.4,yy,w*.6,21,'',9);cell(row.querySelector('dd').textContent,margin,yy,w*.4,21,'',9,true);leftY=yy+21;}
 let y=Math.max(rightY,leftY)+16;
 const draw=report.querySelector('.constructionTable,.constructionRules');if(draw&&!manual){
 const rows=[...draw.querySelectorAll('tr')];let tableHeight=0;font(9);for(let j=0;j<rows.length;j++){const cells=[...rows[j].children],cw=(width-margin*2)/cells.length;tableHeight+=Math.max(j===0?30:25,...cells.map(c=>wrap(c.textContent.trim().replace(/ريال/g,''),cw-12).length*13+10));}
 if(!onePage&&y+12+tableHeight>height-55){save();fresh();y=35;}font(12,true);write('دفعات البناء الذاتي',width-margin,y);y=table(draw,margin,y+12,width-margin*2)+15;}

 const note=report.querySelector('.reportNotes p')||report.querySelector('.reportNotes');if(note){font(14);const lines=wrap(note.textContent,width-margin*2-24);const h=lines.length*19+35;if(!onePage&&y+h>height-55){save();fresh();y=35;}ctx.fillStyle='#eff7f8';ctx.fillRect(margin,y,width-margin*2,h);font(12,true);write('الملاحظات',width-margin-12,y+17);font(14);lines.forEach((l,i)=>write(l,width-margin-12,y+39+i*19));y+=h+12;}
 const identity=[...report.querySelectorAll('.reportIdentity>div')].map(d=>d.querySelector('dt').textContent+'  '+d.querySelector('dd').textContent).join('     ');const identityY=onePage?y+16:Math.min(height-22,Math.max(y+10,height-30));font(11,true);write(identity,width/2,identityY,'center');usedHeight=Math.max(height,identityY+22);save();return pages;
}
function pdfBlob(pages){
 const parts=[], offsets=[0];
 let length=0;
 const append=value=>{const bytes=typeof value==='string'?encoder.encode(value):value;parts.push(bytes);length+=bytes.length;};
 const object=(id,body)=>{offsets[id]=length;append(id+' 0 obj\n');body();append('\nendobj\n');};
 append('%PDF-1.4\n');
 object(1,()=>append('<< /Type /Catalog /Pages 2 0 R >>'));
 object(2,()=>append('<< /Type /Pages /Count '+pages.length+' /Kids ['+pages.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] >>'));
 pages.forEach((jpeg,i)=>{
  const page=3+i*3, stream=page+1, img=page+2;
  object(page,()=>append(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${stream} 0 R >>`));
  const commands=`q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q\n`;
  object(stream,()=>append(`<< /Length ${commands.length} >>\nstream\n${commands}endstream`));
  object(img,()=>{append(`<< /Type /XObject /Subtype /Image /Width ${width*scale} /Height ${height*scale} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);append(jpeg);append('\nendstream');});
 });
 const xref=length;
 append('xref\n0 '+offsets.length+'\n0000000000 65535 f \n');
 for(const offset of offsets.slice(1))append(String(offset).padStart(10,'0')+' 00000 n \n');
 append(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
 return new Blob(parts,{type:'application/pdf'});
}

export function invalidateReport(){
 if(prepared)URL.revokeObjectURL(prepared.url);prepared=null;
 const open=document.getElementById('openPdf');open.removeAttribute('href');open.hidden=true;
 document.getElementById('download').disabled=true;document.getElementById('sharePdf').disabled=true;
}
export function prepareReport(report){
 if(prepared)URL.revokeObjectURL(prepared.url);
 const blob=pdfBlob(drawPages(report));const title=(report.querySelector('.reportHead h2')?.textContent||'تقرير التمويل').replace(/[\\/:*?"<>|]/g,'-');
 prepared={blob,title,url:URL.createObjectURL(blob)};
 const open=document.getElementById('openPdf');open.href=prepared.url;open.hidden=false;
 const file=new File([blob],title+'.pdf',{type:'application/pdf'});
 document.getElementById('download').disabled=false;document.getElementById('sharePdf').disabled=false;
 document.getElementById('sharePdf').hidden=!(navigator.canShare&&navigator.canShare({files:[file]}));
}
export function downloadReport(report){
 if(!prepared)return;
 const link=document.createElement('a');link.href=prepared.url;link.download=prepared.title+'.pdf';link.target='_blank';document.body.append(link);link.click();link.remove();
}
export async function shareReport(report){
 if(!prepared)return;
 try{await navigator.share({files:[new File([prepared.blob],prepared.title+'.pdf',{type:'application/pdf'})]});}catch(e){if(e.name!=='AbortError')document.getElementById('openPdf').click();}
}
