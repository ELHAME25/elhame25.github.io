import json,subprocess,pathlib,hashlib,datetime
root=pathlib.Path('/workspace/shared/opportunities-fix-20261027');base='8d733985b56185b6ade5d4c311b373f1bf9f4dec';report={'baseline':base,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':{},'failures':[],'recordChanges':[]};active={'page','dsite','web','site','url','contactUrl','maps','mapsQ','wa','img','image'}
for f in ['branches','projects','opportunities','nhc','companies','offices','cars','selfbuild','dealers']:
 p=f'riyad-opportunities/data/{f}.json';raw=(root/p).read_bytes();oldraw=subprocess.check_output(['git','show',f'{base}:{p}'],cwd=root);new=json.loads(raw);old=json.loads(oldraw);key=lambda x:x.get('id') or x.get('c') or (x.get('n','')+'|'+x.get('city',''));oi={key(x):x for x in old};ni={key(x):x for x in new};r={'before':len(old),'after':len(new),'idsEqual':list(map(key,old))==list(map(key,new)),'sha256':hashlib.sha256(raw).hexdigest(),'byteIdentical':raw==oldraw};report['files'][f]=r
 if not r['idsEqual'] or len(new)!=len(old):report['failures'].append(f+' record loss/order change')
 for id,x in ni.items():
  for fld in active:
   if 'almadaralwaed.com' in str(x.get(fld,'')):report['failures'].append(f'{f}/{id}/{fld} active compromised domain')
  if id in oi and x!=oi[id]:
   fields=sorted(k for k in set(x)|set(oi[id]) if x.get(k)!=oi[id].get(k));report['recordChanges'].append({'file':f,'id':id,'fields':fields,'availabilityBefore':oi[id].get('availability',{}).get('status'),'availabilityAfter':x.get('availability',{}).get('status')})
 if f=='cars':
  q=[x for x in new if x.get('zone')=='qadisiyah'];oq=[x for x in old if x.get('zone')=='qadisiyah'];report['qadisiyyah']={'before':len(oq),'after':len(q),'identical':q==oq};
  if q!=oq:report['failures'].append('Qadisiyyah changed')
report['ok']=not report['failures'];out=root/'riyad-opportunities/audits/national-scope-20261027/final-no-loss-data.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
