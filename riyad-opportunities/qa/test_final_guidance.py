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
  for code in ['323','345']:
   b=next(x for x in branches if x['c']==code)
   self.assertIsNone(b.get('lat')); self.assertIsNone(b.get('lon'))
   self.assertEqual(b.get('officialMapStatus'),'held')
   self.assertEqual(b.get('candidateCoordinates',{}).get('status'),'REVIEW_REQUIRED')
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
  self.assertEqual(sum(('رفييرا 51' in (x.get('n') or '') or 'ريفييرا 51' in (x.get('n') or '')) for x in p),2)
  s=(ROOT/'assets/app.js').read_text()
  self.assertIn('sameProjectNameTypo',s)
  self.assertIn('Math.abs(a.length - b.length) !== 1',s)
if __name__=='__main__':unittest.main(verbosity=2)
