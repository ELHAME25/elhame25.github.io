import {personalClasses,validatePersonalClass,financingDeductions} from './pricing.mjs?v=9415f061b3b300cc';
export const ranks = {
 'جندي / جندي أول':[44,44], 'عريف':[46,46], 'وكيل رقيب':[48,48], 'رقيب / رقيب أول':[50,50], 'رئيس رقباء':[52,52],
 'ملازم / ملازم أول':[44,42], 'نقيب':[48,46], 'رائد':[50,48], 'مقدم':[52,50], 'عقيد':[54,52], 'عميد':[56,54], 'لواء':[58,56]
};
// المدني: سن 60؛ تحقق مستقل من إكسل الرياض بتاريخ 2026-11-12.
const retirementBySector={civil:60,privateA:60,privateB:60,privateC:60,bank:60,corporation:60,unapproved:60};
function retirementAgeFor(x){
 if(x.sector==='retired')return null;
 if(x.sector==='military'){
  if(!ranks[x.rank])throw Error('اختر الرتبة العسكرية الحالية.');
  // سياسة الرياض المعتمدة من المستخدم: سن الرتبة دون تمديد، للمدة والمعاش.
  return ranks[x.rank][x.pilot?1:0];
 }
 if(!(x.sector in retirementBySector))throw Error('اختر جهة العمل.');
 return retirementBySector[x.sector];
}
const activeDebt=(debts,month)=>debts.reduce((total,d)=>total+(month>=(d.start??1)&&month<=d.months?d.amount:0),0);
const cap = (income,support) => support==='monthly'||income>15000 ? 65 : 55;
export function addMonths(date,months) {
 const [y,m,d]=date.split('-').map(Number);
 const last=new Date(Date.UTC(y,m+months,0)).getUTCDate();
 return new Date(Date.UTC(y,m-1+months,Math.min(d,last))).toISOString().slice(0,10);
}
export function monthsBetween(start,end) {
 const a=start.split('-').map(Number),b=end.split('-').map(Number);
 const span=(b[0]-a[0])*12+b[1]-a[1];
 return span-(addMonths(start,span)>end?1:0);
}
// مصفوفة الدعم 5، الأعمدة A:C. معاملات الشرائح من معادلات الصفوف 3 و1003 إلى 7003.
export function monthlySupport(income) {
 if(income>10000)return 416;
 const bands=[[9000,673,.074],[8000,757,.084],[7000,850,.093],[6000,955,.105],[5000,1073,.118],[4000,1206,.133],[3000,1350,.144]];
 const [start,amount,slope]=bands.find(([start])=>income>=start)??bands.at(-1);
 return amount-Math.max(0,income-start)*slope;
}
const arabicDigits='٠١٢٣٤٥٦٧٨٩';
export function hijriDate(value,years=0) {
 const input=value.replace(/\s+/g,'').replace(/[٠-٩]/g,n=>arabicDigits.indexOf(n)).replace(/[۰-۹]/g,n=>n.charCodeAt(0)-1776);
 if(!/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(input))throw Error('اكتب التاريخ الهجري باليوم / الشهر / السنة.');
 const [d,m,y]=input.split(/[/-]/).map(Number);
 const leap=year=>(11*year+14)%30<11;
 const last=year=>m===12?(leap(year)?30:29):m%2?30:29;
 if(y>=1700)throw Error('التاريخ الميلادي غير مقبول؛ أدخل التاريخ الهجري.');
 if(m<1||m>12||d<1||d>last(y)||y<1250||y>1600)throw Error('أدخل تاريخًا هجريًا صالحًا.');
 const year=y+years;
 // التحويل الحسابي من ورقة Operation، مساري AT32 وAN32.
 const julian=Math.floor((11*year+3)/30)+354*year+30*m-Math.floor((m-1)/2)+Math.min(d,last(year))+1948440-385;
 const j=julian+68569, century=Math.floor(4*j/146097);
 const rem=Math.floor(j-(146097*century+3)/4), yearPart=Math.floor(4000*(rem+1)/1461001);
 const elapsed=rem-Math.floor(1461*yearPart/4)+31, monthPart=Math.floor(80*elapsed/2447);
 const day=elapsed-Math.floor(2447*monthPart/80), shift=Math.floor(monthPart/11);
 const month=monthPart+2-12*shift, gregorianYear=100*(century-49)+yearPart+shift;
 return new Date(Date.UTC(gregorianYear,month-1,day)).toISOString().slice(0,10);
}
export function validateBirth(x){
 if(!x.birth||x.birth>=x.today)throw Error('أدخل تاريخ ميلاد هجريًا صحيحًا.');
 if(x.birthHijri){
  if(hijriDate(x.birthHijri,18)>x.today)throw Error('العمر يجب أن يكون 18 سنة هجريًا فأعلى.');
  if(hijriDate(x.birthHijri,75)<x.today)throw Error('العمر يتجاوز الحد الأعلى 75 سنة هجريًا.');
 }
 return x.birth;
}
function ageYears(start,end){
 const first=Number(start.slice(0,4)),last=Number(end.slice(0,4));
 const average=(Date.UTC(last+1,0,1)-Date.UTC(first,0,1))/86400000/(last-first+1);
 return (Date.parse(end)-Date.parse(start))/86400000/average;
}
function ageDates(x,years){
 return x.birthHijri?hijriDate(x.birthHijri,years):addMonths(x.birth,years*12);
}
const personalTermBySector=Object.fromEntries(Object.entries(personalClasses).map(([key,value])=>[key,value.months]));
function personalMonthsAvailable(x,retirementAge){
 // حاسبة الرياض، Operation!Q42:Q46 وR46.
 const age=ageYears(x.birth,x.today);
 const ceiling=retirementAge??70;
 const months=x.birthHijri?Math.floor((ceiling-age-Math.round(age*11/355*100)/100)*12+1e-9):monthsBetween(x.today,ageDates(x,ceiling));
 return Math.max(0,Math.min(personalTermBySector[x.sector]??60,months-2));
}
// الرياض Operation: AU76=ROUNDUP(AN46*12,0)، AV75=ROUNDDOWN(AT77*12,0)-5،
// AU78=AU76+AV75؛ AT80=الأساسي*AU78/480 للمدني و/420 للعسكري.
// شهر الخدمة المتوقع للمعاش مستقل عن المدة المختارة للتمويل.
export function estimatePension(x){
 const retirementAge=retirementAgeFor(x);
 const military=x.sector==='military';
 const alreadyRetired=retirementAge===null;
 const workLeft=alreadyRetired?0:Math.max(0,monthsBetween(x.today,ageDates(x,retirementAge)));
 const worked=x.hire?Math.ceil(ageYears(x.hire,x.today)*12):0;
 const age=ageYears(x.birth,x.today);
 const projected=alreadyRetired?0:x.birthHijri?Math.max(0,Math.floor((retirementAge-age-Math.round(age*11/355*100)/100)*12)-5):workLeft;
 const service=x.hire?worked+projected:0;
 const pension=alreadyRetired?x.income:x.pension??x.basic*service/(military?420:480);
 return {service,pension};
}
export function calculatePersonal(x) {
 validateBirth(x);
 validatePersonalClass(x.sector,x.income);
 const retirementAge=retirementAgeFor(x);
 const retired=retirementAge===null;
 const months=Math.min(x.term,personalMonthsAvailable(x,retirementAge));
 if(!months) throw Error('لا توجد مدة متاحة للتمويل الشخصي.');
 const rate=retired?25:33.33, credit=x.credit*.05;
 const obligations=Math.max(...Array.from({length:months},(_,i)=>activeDebt(x.debts,i+1)))+credit;
 const ceiling=Math.max(0,x.income*rate/100-obligations);
 const factor=1+x.margin/100*months/12;
 const payment=x.method==='amount'?x.request*factor/months:x.method==='payment'?x.request:ceiling;
 if(x.method!=='max'&&!(x.request>0)) throw Error('أدخل القيمة المطلوبة.');
 if(payment<0)throw Error('أدخل قيمة صحيحة.');
 if(payment>ceiling+.005) throw Error('القسط المطلوب يتجاوز الحد المتاح '+ceiling.toFixed(2)+' ريال.');
 const total=payment*months,net=total/factor;
 if(x.personalKind&&x.personalKind!=='new'&&financingDeductions(net,'personal',x.settlement??0).netCash<0)throw Error('صافي مبلغ التمويل أقل من المديونية.');
 return {rate,credit,months,work:retired?0:months,retired:retired?months:0,personal:payment,net,total,profit:total-net,
 rows:[{label:'التمويل الشخصي',start:1,end:months,rate,payment:0,personal:payment,obligations}],draws:[]};
}
function constructionSchedule(x,capacity,work,months) {
 const factor=1+x.margin/100*months/12;
 const sum=(start,end)=>capacity.slice(start,end).reduce((s,r)=>s+r.available,0);
 const maxBefore=Math.floor(sum(0,work)/factor), maxAfter=sum(work,months)/factor;
 const propertyLimit=x.property?x.property*.9:Infinity;
 const limit=Math.min(maxBefore+maxAfter,propertyLimit);
 const schedule=amount=>{
  const split=amount/(maxBefore+maxAfter||1);
  const remaining=capacity.map(r=>r.available), payments=capacity.map(()=>0);
  let unpaid=0;
  const allocate=(principal,start,end,drawStart)=>{
   const installments=[];
   let due=principal*(1+x.margin/100*(months-drawStart)/12);
   for(let i=start;i<end;i++){
    const payment=Math.min(remaining[i],due/(end-i));
    payments[i]+=payment;remaining[i]-=payment;due-=payment;
    installments.push({month:i+1,payment});
   }
   unpaid+=due;
   return installments;
  };
  const draws=x.draws.map(d=>{
   const start=d.month-1, before=start<work?maxBefore*split*d.share/100:0;
   const after=amount*d.share/100-before;
   return {...d,amount:before+after,before,after,start};
  });
  for(const d of draws) d.installments=[...allocate(d.before,d.start,work,d.start),...allocate(d.after,Math.max(work,d.start),months,d.start)];
  return {payments,draws,unpaid};
 };
 let result=schedule(limit);
 if(result.unpaid>.005){
  let lo=0,hi=limit;
  for(let i=0;i<40;i++){
   const mid=(lo+hi)/2,test=schedule(mid);
   if(test.unpaid>.005) hi=mid;
   else {lo=mid;result=test;}
  }
 }
 return result;
}
const propertyRatio=x=>x.type==='lien'&&x.repayment==='flex'?.85:.90;
function sizeFixed(result,x){
 if(!x.fixedMethod||x.fixedMethod==='max')return result;
 if(!(x.fixedRequest>0))throw Error(x.fixedMethod==='amount'?'أدخل مبلغ التمويل المطلوب.':'أدخل القسط المطلوب.');
 const regular=result.rows.filter(r=>r.label!=='خلال الإنشاء');
 const reference=regular[0]?.payment??0;
 const locked=result.rows.filter(r=>r.label==='خلال الإنشاء').reduce((sum,r)=>sum+r.payment*(r.end-r.start+1),0);
 const factor=1+x.margin/100*result.months/12;
 const financedLocked=locked/factor;
 const scale=x.fixedMethod==='amount'?(x.fixedRequest-financedLocked)/(result.net-financedLocked):x.fixedRequest/reference;
 if(!Number.isFinite(scale)||scale<0)throw Error('المبلغ المطلوب لا يغطي أقساط فترة الإنشاء.');
 if(scale>1+1e-10)throw Error('القيمة المطلوبة تتجاوز الحد الأعلى.');
 const rows=result.rows.map(r=>r.label==='خلال الإنشاء'?r:{...r,payment:r.payment*scale});
 const net=x.fixedMethod==='amount'?x.fixedRequest:financedLocked+(result.net-financedLocked)*scale;
 const total=locked+(result.total-locked)*scale;
 const financedProperty=x.property?Math.min(net,x.property*propertyRatio(x)):null;
 const draws=result.draws.map(d=>({...d,amount:d.amount*scale,installments:d.installments?.map(p=>({...p,payment:p.payment*scale}))}));
 return {...result,rows,net,total,profit:total-net,maximum:result.net,draws,financedProperty,
  customerGap:x.property?Math.max(0,x.property-financedProperty-result.packageAmount):null};
}
export function mortgageWindow(x){
 validateBirth(x);
 const retirementAge=retirementAgeFor(x);
 const alreadyRetired=retirementAge===null;
 const retireDate=alreadyRetired?null:ageDates(x,retirementAge);
 const age=ageYears(x.birth,x.today);
 const adjustedAge=x.birthHijri?age+Math.round(age*11/355*100)/100:age;
 const workLeft=alreadyRetired?0:Math.max(0,x.birthHijri?Math.floor((retirementAge-adjustedAge)*12+1e-9)-2:monthsBetween(x.today,retireDate));
 const toMaximumAge=x.birthHijri?Math.floor((75-adjustedAge)/365.2425*354.367*12):monthsBetween(x.today,ageDates(x,75));
 const maxMonths=Math.min(360,Math.max(0,toMaximumAge),(alreadyRetired||x.after)?360:workLeft);
 return {retirementAge,alreadyRetired,retireDate,workLeft,maxMonths};
}
export function calculate(x) {
 const fixed=x.repayment==='fixed';
 const beforeRate=cap(x.income,x.support);
 const second=x.second??beforeRate;
 if(second<0||second>beforeRate) throw Error('نسبة الفترة الثانية يجب أن تكون بين صفر والسقف '+beforeRate+'%.');
 const {retirementAge,alreadyRetired,retireDate,workLeft,maxMonths}=mortgageWindow(x);
 if(x.term!=null&&(!Number.isInteger(x.term)||x.term<1||x.term>maxMonths))throw Error('المدة القصوى المتاحة '+maxMonths+' شهرًا؛ لا يمكن تجاوز حد العمر.');
 const months=x.term??maxMonths;
 if(!months||!x.income) throw Error('أدخل دخلاً ومدة متاحة للتمويل.');
 const work=Math.min(months,workLeft), retired=months-work;
 if(retired&&!alreadyRetired&&x.pension==null&&(!x.hire||x.hire<=x.birth||x.hire>x.today||x.hire>retireDate||!x.basic)) throw Error('أدخل الراتب الأساسي وتاريخ التعيين لحساب مرحلة التقاعد.');
 const {service,pension}=estimatePension(x);
 if(retired&&pension<=0) throw Error('أدخل راتبًا تقاعديًا صالحًا.');
 const afterCap=cap(pension,x.support),afterRate=x.afterDeduction??afterCap;if(afterRate<0||afterRate>afterCap)throw Error('استقطاع ما بعد التقاعد يتجاوز السقف '+afterCap+'%.');
 const credit=x.credit*.05;
 const external=m=>activeDebt(x.debts,m);
 const personal=x.personalMonths ? (x.personal??Math.max(0,x.income*(alreadyRetired?.25:.3333)-Math.max(...Array.from({length:x.personalMonths},(_,i)=>external(i+1)))-credit)):0;
 if(x.personal==null&&x.personalMonths>personalMonthsAvailable(x,retirementAgeFor(x))) throw Error('مدة الشخصي الجديد تتجاوز المدة المتاحة حسب جهة العمل والعمر.');
 if(x.personalMonths&&personal<=0) throw Error('سقف الشخصي مستنفد أو قسط الشخصي غير صالح.');
 const grace=x.type==='offplan'?(x.buildMonths||0):0;const gracePayment=x.constructionPayment??400;
 if(!Number.isInteger(grace)||grace<0||grace>=months)throw Error('فترة الإنشاء يجب أن تكون عدد أشهر صحيحًا وأقل من مدة التمويل.');
 if(grace&&(!Number.isFinite(gracePayment)||gracePayment<0))throw Error('أدخل قسطًا ميسرًا صحيحًا.');
 if(x.type==='self'&&(Math.abs(x.draws.reduce((s,d)=>s+d.share,0)-100)>1e-8||!x.draws.length||x.draws[0].month!==1||x.draws.some((d,i)=>d.month>months||(i>0&&d.month<x.draws[i-1].month)))) throw Error('دفعات البناء تبدأ في الشهر 1، وتترتب داخل المدة، ويكون مجموعها 100%.');
 const rows=[], capacity=[];
 for(let month=1;month<=months;month++){
   const isRetired=month>work;
   const hasPersonal=month<=x.personalMonths&&personal>0;
   const phase=isRetired?3:hasPersonal?1:2;
   const rate=isRetired?afterRate:fixed?second:phase===1?beforeRate:second;
   const p=hasPersonal?personal:0, obligations=external(month)+credit;
   const available=(isRetired?pension:x.income)*rate/100-p-obligations;
   const building=x.type==='offplan'&&month<=grace;
   const draw=x.type==='self'?x.draws.filter(d=>d.month<=month).reduce((sum,d)=>sum+d.share,0):100;
   const installment=building?gracePayment:available;
   if(available<-.005||building&&installment>available+.005) throw Error('القسط والالتزامات تتجاوز سقف الاستقطاع في الشهر '+month+'.');
   const label=building?'خلال الإنشاء':phase===1?'الفترة الأولى':phase===2?(fixed?'قبل التقاعد':'الفترة الثانية'):'بعد التقاعد';
   capacity.push({month,label,rate,p,obligations,draw,phase,available:Math.max(0,available),installment});
 }
 if(fixed){
  const fix=(start,end)=>{
   const band=capacity.slice(start,end).filter(r=>r.label!=='خلال الإنشاء');
   if(!band.length)return;
   const payment=Math.min(...band.map(r=>r.available));
   for(const r of band){r.available=payment;r.installment=payment;}
  };
  fix(0,work);fix(work,months);
 }
 // Same fixed off-plan rule in both sources: Operation!DR178/DR181.
 // Discount all installments by the full term Flat Rate factor, then subtract
 // construction installments from principal. Reconcile that deduction by reducing
 // the regular working installments; the construction payment stays unchanged.
 if(fixed&&grace){
  const regular=capacity.filter(r=>r.month>grace&&r.month<=work);
  const band=regular.length?regular:capacity.filter(r=>r.month>grace);
  const reduction=grace*gracePayment*(1+x.margin/100*months/12)/band.length;
  for(const r of band){if(r.installment<reduction-.005)throw Error('القسط الميسر وفترة الإنشاء لا يتركان مبلغ تمويل متاحًا.');r.installment=Math.max(0,r.installment-reduction);}
 }
 const construction=x.type==='self'?constructionSchedule(x,capacity,work,months):null;
 for(const {month,label,rate,p,obligations,draw,phase,installment} of capacity){
   const payment=Math.max(0,construction?.payments[month-1]??installment);
   const last=rows.at(-1);
   if(last&&last.label===label&&last.rate===rate&&Math.abs(last.payment-payment)<1e-8&&last.personal===p&&last.obligations===obligations&&last.draw===draw&&last.phase===phase){last.end=month;}
   else rows.push({label,phase,rate,payment,personal:p,obligations,draw,start:month,end:month});
 }
 const total=rows.reduce((sum,r)=>sum+r.payment*(r.end-r.start+1),0);
 const net=construction?construction.draws.reduce((sum,d)=>sum+d.amount,0):total/(1+x.margin/100*months/12);
 const packageAmount=x.support==='package'&&!x.packageReceived?100000:0;
 const financedProperty=x.property?Math.min(net,x.property*propertyRatio(x)):null;
 const required=x.property?Math.max(0,x.property-financedProperty-packageAmount):null;
 const personalNet=x.personal==null&&x.personalMonths&&x.personalMargin!=null?personal*x.personalMonths/(1+x.personalMargin/100*x.personalMonths/12):null;
 const result={rows,total,net,personalNet,monthlySupport:x.support==='monthly'?monthlySupport(x.income):0,profit:total-net,months,work,retired,retireDate,pension,service,beforeRate,second,afterRate,afterCap,personal,credit,packageAmount,required,financedProperty,customerGap:required,draws:construction?.draws??[]};
 let bounded=result;
 if(x.type==='lien'&&x.property&&result.net>result.financedProperty){
  bounded=sizeFixed(result,{...x,fixedMethod:'amount',fixedRequest:result.financedProperty});
  delete bounded.maximum;
 }
 return fixed?sizeFixed(bounded,x):bounded;
}
