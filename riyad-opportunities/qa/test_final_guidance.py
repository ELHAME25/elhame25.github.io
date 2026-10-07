import json,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class FinalGuidance(unittest.TestCase):
 def test_picker_order_cities_and_no_auto_branch(self):
  s=(ROOT/'assets/app.js').read_text()
  start=s[s.index('function renderStart()'):s.index('/* ---------------- branch & state ---------------- */')]
  self.assertLess(start.index('for="q-emp"'),start.index('for="q-city"'))
  self.assertLess(start.index('for="q-city"'),start.index('for="q-branch"'))
  self.assertIn('cities().map',start)
  self.assertIn('disabled></div>',start)
  self.assertIn('renderStart();',s)
  self.assertNotIn('var code = m ? m[1] : store',s)
 def test_curated_shaffa_and_qadisiyah_records(self):
  cars=json.loads((ROOT/'data/cars.json').read_text())
  phones=['0507218678','0540998075','0539444885','0537031513','0536623945','0510686130','0500781804','0547777703','0561047060','0557004484','0554715999','0555299169','0554444604']
  by_phone={p:[o for o in cars if p in o.get('phones',[])] for p in phones}
  self.assertTrue(all(len(v)==1 for v in by_phone.values()))
  self.assertEqual(sum(o.get('zone')=='shifa' for o in cars),13)
  self.assertEqual(sum(o.get('zone')=='qadisiyah' for o in cars),30)
  for p in phones:
   o=by_phone[p][0]
   self.assertTrue(o['maps'].startswith('https://www.google.com/maps/search/'))
   self.assertIsNone(o['lat']); self.assertIsNone(o['lon'])
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
  self.assertIn(len(p),(640,641))
  self.assertEqual(sum('ريفييرا 51' in (x.get('n') or '') for x in p),1)
  self.assertIn('seenProjectPages',(ROOT/'assets/app.js').read_text())
if __name__=='__main__':unittest.main(verbosity=2)
