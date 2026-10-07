import json,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class FinalGuidance(unittest.TestCase):
 def test_picker_order_code_city_go_and_live_greeting(self):
  s=(ROOT/'assets/app.js').read_text()
  start=s[s.index('function renderStart()'):s.index('/* ---------------- branch & state ---------------- */')]
  self.assertLess(start.index('for="q-emp"'),start.index('for="q-branch"'))
  self.assertLess(start.index('for="q-branch"'),start.index('for="q-city"'))
  self.assertIn('كل المدن',start)
  self.assertIn('id="go-branch"',start)
  self.assertIn('id="greet"',start)
  self.assertIn("qe.addEventListener('input'",start)
  self.assertNotIn('id="q-branch" class="input" type="search" autocomplete="off" placeholder="أدخل رمز الفرع أو ابحث باسمه" disabled',start)
  self.assertIn("go.addEventListener('click'",start)
  self.assertIn('استخدم موقعي — أقرب فرع',start)
  self.assertNotIn('var code = m ? m[1] : store',s)
 def test_curated_shaffa_and_qadisiyah_records(self):
  cars=json.loads((ROOT/'data/cars.json').read_text())
  shifa=[o for o in cars if o.get('zone')=='shifa']
  qadisiyah=[o for o in cars if o.get('zone')=='qadisiyah']
  self.assertEqual(len(shifa),13)
  self.assertEqual(len(qadisiyah),30)
  self.assertEqual(sum(not o.get('zone') for o in cars if o.get('city')=='الرياض'),8)
  self.assertTrue(all(o.get('maps','').startswith('https://www.google.com/maps/search/') for o in shifa))
  self.assertTrue(all(o.get('lat') is None and o.get('lon') is None for o in shifa))
 def test_location_conflicts_are_not_used_and_images_have_local_fallback(self):
  branches=json.loads((ROOT/'data/branches.json').read_text())
  by_code={b['c']:b for b in branches}
  # Correct the former 323 candidate using the approved directory row keyed by branch code.
  self.assertEqual((by_code['323']['lat'],by_code['323']['lon']),(27.067676,49.537495))
  self.assertNotEqual((by_code['323']['lat'],by_code['323']['lon']),(by_code['308']['lat'],by_code['308']['lon']))
  self.assertEqual(by_code['323'].get('officialMapStatus'),'reviewed')
  # Code 345 is in Qatif; the matched bank place is in Qatif, not Dammam.
  self.assertEqual(by_code['345']['city'],'القطيف')
  self.assertAlmostEqual(by_code['345']['lat'],26.5664014)
  self.assertAlmostEqual(by_code['345']['lon'],50.0116137)
  # Keep unresolved coordinates hidden where the matched directory still conflicts or has none.
  for code in ['307','176']:
   self.assertIsNone(by_code[code].get('lat')); self.assertIsNone(by_code[code].get('lon'))
   self.assertEqual(by_code[code].get('officialMapStatus'),'held')
  self.assertTrue((ROOT/'assets/images/real-estate-illustrative-villa.jpg').exists())
  app=(ROOT/'assets/app.js').read_text()
  self.assertIn('صورة توضيحية',app)
  self.assertIn('img.src = GENERIC_PROPERTY_IMAGE',app)
  self.assertIn('displayImage(kind, o)',app)
  self.assertIn('developerSite(o)',app)
  self.assertIn('poster|banner|brochure',app)
 def test_shared_unverified_whatsapp_destinations_removed(self):
  for kind in ['companies','projects','opportunities','nhc']:
   records=json.loads((ROOT/f'data/{kind}.json').read_text())
   self.assertFalse(any(o.get('wa') and ('MFDPXBNPC5ZWM1' in o['wa'] or 'wa.me/966920' in o['wa'] or 'wa.me/+966920' in o['wa']) for o in records))
 def test_header_and_card_navigation(self):
  s=(ROOT/'assets/app.js').read_text()
  self.assertIn('دليل الفرص – المملكة',s)
  self.assertIn('شركات التسويق والاستثمار العقاري',s)
  self.assertNotIn('<nav class="tabs"',s)
  self.assertNotIn('badge teal',s)
 def test_riviera_not_duplicated_and_project_count_preserved(self):
  p=json.loads((ROOT/'data/projects.json').read_text())
  self.assertEqual(len(p),641)
  # Four approved bank project codes are merged into their matching project cards.
  aliases={a:x['id'] for x in p for a in x.get('alsoIds',[])}
  self.assertEqual(aliases,{'P121':'P120','P645':'P138','P349':'P338','P363':'P351'})
  self.assertEqual(len(p)+len(aliases),645)
  self.assertEqual(sum(('رفييرا 51' in (x.get('n') or '') or 'ريفييرا 51' in (x.get('n') or '')) for x in p),2)
  s=(ROOT/'assets/app.js').read_text()
  self.assertIn('sameProjectNameTypo',s)
  self.assertIn('Math.abs(a.length - b.length) !== 1',s)
 def test_verified_whatsapp_destinations_have_matching_published_numbers(self):
  p=json.loads((ROOT/'data/projects.json').read_text())
  byid={x['id']:x for x in p}
  for pid,number in {'P158':'0566800151','P159':'0566800151','P250':'0500654888','P284':'0500654888','P300':'0500654888'}.items():
   self.assertIn(number,byid[pid]['phones'])
   self.assertEqual(byid[pid]['waVerifiedSource'],'الصفحة الرسمية للشركة تعرض الرقم نفسه كرابط WhatsApp.')
   self.assertTrue(byid[pid]['wa'].startswith('https://wa.me/'))
if __name__=='__main__':unittest.main(verbosity=2)
