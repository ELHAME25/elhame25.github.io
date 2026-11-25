// Fixed report translations. User-entered names and notes are never translated.
const phrases={
'المعلومات الواردة أعلاه هي معلومات مبدئية وقدمت للعميل بناءً على طلبه والمعلومات المقدمة منه.':'The figures above are indicative and were prepared at the client’s request using the information provided by the client.',
'التفاصيل والمبالغ النهائية للتمويل الفعلي يتم تحديدها عند استيفاء كامل المستندات المطلوبة وبعد التحقق من السجل الائتماني للعميل.':'Final financing terms and amounts are subject to receipt of all required documents and verification of the client’s credit history.',
'القسط العقاري حتى نهاية التمويل':'Mortgage installment until the end of the financing term',
'قسط العقاري خلال فترة الشخصي':'Mortgage installment during the personal financing term',
'قسط العقاري بعد التقاعد':'Mortgage installment after retirement',
'قسط العقاري إلى التقاعد':'Mortgage installment until retirement',
'القسط الميسر خلال الإنشاء':'Reduced installment during construction',
'إجمالي استقطاع الفترة الأولى':'Total deductions during the first period',
'الرسوم الإدارية شاملة الضريبة':'Administration fee including VAT',
'صافي التمويل بعد الرسوم والضريبة':'Net financing after fees and VAT',
'صافي التمويل بعد سداد المديونية':'Net proceeds after debt settlement',
'إجمالي مديونية البنك الآخر':'Outstanding debt with the other bank',
'المبلغ المتبقي من العقد الحالي':'Outstanding balance on the current contract',
'الدفعة الإلزامية من العميل':'Required client down payment',
'الدفعة الإضافية الاختيارية':'Optional additional down payment',
'دعم الدفعة المقدمة':'Down payment support',
'القيمة السوقية للعقار':'Property market value',
'سعر العقار / الوحدة':'Property / unit price',
'الحد الأعلى للتمويل':'Maximum financing amount',
'نسبة هامش الربح السنوي':'Annual profit rate',
'إجمالي مبلغ التمويل':'Total financing amount',
'إجمالي التمويل':'Total repayment amount',
'إجمالي الأرباح':'Total profit',
'إجمالي الربح':'Total profit',
'نسبة الاستقطاع':'Deduction ratio',
'مبلغ التمويل':'Financing amount',
'مدة التمويل':'Financing term',
'سعر الأرض':'Land price',
'قسط الشخصي':'Personal financing installment',
'الالتزامات الشهرية':'Other monthly commitments',
'التزام البطاقات':'Credit card commitment',
'الدعم الشهري':'Monthly support',
'القسط الشهري':'Monthly installment',
'التمويل الشخصي':'Personal financing',
'تمويل عقاري':'Mortgage financing',
'شراء مديونية':'Debt buyout',
'إعادة تمويل':'Refinancing',
'مسؤول المبيعات':'Sales advisor',
'رقم الجوال':'Mobile number',
'الملاحظات':'Notes',
'الأقساط':'Installments',
'تقرير دفعات البناء الذاتي':'Self-build drawdown report',
'تقرير الدفعات':'Drawdown report',
'دفعات البناء الذاتي':'Self-build drawdowns',
'آلية صرف الدفعات حسب سياسة البنك':'Drawdown release schedule under bank policy',
'دفعات العميل':'Client drawdowns',
'مبلغ الموافقة':'Approved amount',
'مرحلة البناء':'Construction stage',
'أعمال الحفر، صب النظافة، خرسانة مسلحة أساسات':'Excavation, blinding concrete and reinforced concrete foundations',
'الخرسانة المسلحة للهيكل، العزل، الردم، مباني البلوك':'Reinforced concrete structure, waterproofing, backfilling and blockwork',
'الكهرباء والتكييف، السباكة، اللياسة، النجارة، الألمنيوم':'Electrical and air conditioning works, plumbing, plastering, carpentry and aluminum works',
'السيراميك والرخام، الدهانات، الواجهات، التكملات المعمارية، الموقع والشبكة الخارجية، الدرابزين':'Tiles and marble, painting, facades, architectural finishes, external works and utilities, and railings',
'عند بداية التمويل لإتمام المرحلة الأولى':'At financing commencement to complete stage 1',
'بعد الانتهاء من المرحلة الأولى لإتمام الثانية':'After completion of stage 1 to complete stage 2',
'بعد الانتهاء من المرحلة الثانية لإتمام الثالثة':'After completion of stage 2 to complete stage 3',
'بعد الانتهاء من المرحلة الثالثة لإتمام الرابعة':'After completion of stage 3 to complete stage 4',
'ربح الدفعة':'Drawdown profit',
'مبلغ الدفعة':'Drawdown amount',
'قسط الفترة':'Period installment',
'الدفعة':'Drawdown',
'المرحلة':'Stage',
'النسبة':'Percentage',
'المبلغ':'Amount',
'الأعمال':'Works',
'الصرف':'Release',
'القسط':'Installment',
'الأولى':'1','الثانية':'2','الثالثة':'3','الرابعة':'4','الخامسة':'5','السادسة':'6','السابعة':'7','الثامنة':'8',
'ريال':'SAR'
};
const replacements=Object.entries(phrases).sort((a,b)=>b[0].length-a[0].length);
export function translateReportText(text){
 let result=text;
 for(const [ar,en] of replacements)result=result.split(ar).join(en);
 return result.replace(/سنة واحدة/g,'1 year').replace(/سنتان/g,'2 years').replace(/شهر واحد/g,'1 month').replace(/شهران/g,'2 months')
 .replace(/([\d,]+)\s*(?:سنوات|سنة)/g,'$1 years').replace(/([\d,]+)\s*(?:شهرًا|أشهر|شهر)/g,'$1 months').replace(/ و(?=\d)/g,' and ');
}
export function localizedReport(report,language='ar'){
 const copy=report.cloneNode(true);
 copy.querySelector('#reportControls')?.remove();
 copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
 copy.lang=language;copy.dir=language==='en'?'ltr':'rtl';
 if(language!=='en')return copy;
 const heading=copy.querySelector('.reportHead h2');
 if(heading)heading.textContent=heading.textContent.replace(/^حسبة العميل\s*(?:\/\s*ـة)?\s*[:：]?\s*/u,'Client Financing Summary: ');
 const visit=element=>{for(const node of element.childNodes){if(node.nodeType===3)node.textContent=translateReportText(node.textContent);else if(node.nodeType===1&&!node.matches('.reportHead h2,.reportNotes p,.reportIdentity dd'))visit(node);}};
 visit(copy);
 return copy;
}
