// مرجع المستخدم: IMG_3462.jpeg (الشخصي)، IMG_3473.jpeg (العقاري، مرجع أكتوبر الأحدث).
// التحديث في هذا الملف فقط؛ لا تتغير النسب بحسب التاريخ أو اتصال خارجي.
export const pricingReference={
 personal:{
  privateA:[[3000,6.64,7.04,6.04],[5000,6.06,6.46,5.96],[8000,5.50,5.90,5.01],[10000,3.78,4.18,3.75],[20000,3.10,3.50,3.00],[25000,3.00,3.40,2.45],[40000,2.68,3.08,2.22],[70000,2.62,3.02,2.12]],
  privateB:[[3000,6.74,7.14,6.14],[5000,6.16,6.56,6.06],[8000,5.60,6.00,5.11],[10000,3.88,4.28,3.85],[20000,3.20,3.60,3.10],[25000,3.10,3.50,2.55],[40000,2.78,3.18,2.32],[70000,2.72,3.12,2.22]],
  privateC:[[3000,7.04,7.44,6.34],[5000,6.46,6.86,6.26],[8000,5.90,6.30,5.31],[10000,4.18,4.58,4.05],[20000,3.50,3.90,3.30],[25000,3.40,3.80,2.75],[40000,3.08,3.48,2.52],[70000,3.02,3.42,2.42]],
  civil:[[3000,5.59,5.99,4.99],[5000,4.69,5.09,4.59],[8000,4.69,5.09,4.25],[10000,3.52,3.92,3.49],[20000,3.09,3.49,2.99],[25000,2.99,3.39,2.44],[40000,2.65,3.05,2.19],[70000,2.59,2.99,2.09]],
  military:[[3000,5.85,6.25,5.25],[5000,5.26,5.66,5.16],[8000,5.05,5.45,4.61],[10000,3.67,4.07,3.64],[20000,3.26,3.66,2.24],[25000,3.06,3.46,2.51],[40000,2.65,3.05,2.19],[70000,2.59,2.99,2.09]],
  corporation:[[3000,6.12,6.52,5.52],[5000,5.54,5.94,5.44],[8000,5.00,5.40,4.56],[10000,3.70,4.10,3.67],[20000,3.16,3.56,3.06],[25000,3.06,3.46,2.51],[40000,2.79,3.19,2.33],[70000,2.73,3.13,2.23]],
  retired:[[3000,5.59,5.99,4.99],[5000,4.69,5.09,4.59],[8000,4.69,5.09,4.25],[10000,3.52,3.92,3.49],[20000,3.09,3.49,2.99],[25000,2.99,3.39,2.44],[40000,2.65,3.05,2.19],[70000,2.59,2.99,2.09]],
  trainee:[[2000,7.99,null,null],[5000,7.99,null,null],[20000,7.99,null,null]],
  unapproved:[[15000,6.35,6.75,6.30],[20000,6.21,6.61,6.16],[25000,6.15,6.55,6.10],[40000,6.10,6.50,6.05],[70000,6.00,6.40,5.95]],
  nonSaudi:[[5000,6.40,6.80,5.81],[8000,5.15,5.55,4.55],[10000,5.00,5.40,3.80],[20000,4.50,4.90,3.25],[25000,4.40,4.80,4.19],[40000,4.30,4.70,4.10],[70000,4.05,4.45,4.00]],
  nonSalaryBanker:[[8000,6.74,7.14,null],[10000,6.40,6.80,null],[20000,6.26,6.66,null],[40000,5.99,6.39,null]]
 },
 // العمود الأول Flat Rate؛ موحد للأنواع وفق تعليمات المستخدم.
 mortgage:{months:[60,120,180,240,300,360],supported:[4.05,4.25,4.57,4.90,5.25,5.56],unsupported:[5.30,5.40,5.50,5.80,6.20,6.60],lienUnsupported:[5.90,6.15,6.40,6.65,7.15,7.40]}
};
export const personalClasses={privateA:{minimum:5000,months:60},privateB:{minimum:8000,months:48},privateC:{minimum:10000,months:36},unapproved:{minimum:0,months:12}};
export function validatePersonalClass(sector,income){const rule=personalClasses[sector];if(rule&&income<rule.minimum)throw Error('الراتب أقل من الحد الأدنى لفئة '+sector.slice(-1)+': '+rule.minimum.toLocaleString('en-US')+' ريال.');}
export function personalRate(sector,income,product='new'){
 validatePersonalClass(sector,income);
 const col={new:1,refinance:2,buyout:3}[product];
 if(col===undefined)throw Error('اختر نوع التمويل الشخصي.');
 const row=pricingReference.personal[sector]?.findLast(r=>income>=r[0]);
 if(!row||row[col]===null)throw Error('لا توجد نسبة مطابقة في المرجع لهذه الحالة.');
 return row[col];
}
export function mortgageRate(months,support,property='ready'){
 const table=pricingReference.mortgage;
 if(!Number.isInteger(months)||months<1||months>360)throw Error('أدخل مدة عقاري بين 1 و360 شهرًا.');
 return table[support==='monthly'||support==='package'?'supported':property==='lien'?'lienUnsupported':'unsupported'][table.months.findIndex(max=>months<=max)];
}
const cents=n=>Math.round((n+Number.EPSILON)*100)/100;
export function financingDeductions(principal,product='personal',balance=0){
 if(!Number.isFinite(principal)||principal<0||!Number.isFinite(balance)||balance<0)throw Error('أدخل مبلغًا صحيحًا للمديونية.');
 const fee=cents(Math.min(principal*.005,product==='personal'?2500:5000));
 const vat=cents(fee*.15),charges=cents(fee+vat),afterFees=product==='personal'?cents(principal-charges):principal;
 return {fee,vat,charges,afterFees,feesPaidSeparately:product!=='personal',balance,netCash:cents(afterFees-balance)};
}
