import io
import json
import unittest
from pathlib import Path
import pandas as pd

import app as backend_app
import data_access

class SmokeUiDataTest(unittest.TestCase):
    def setUp(self):
        backend_app.app.config['TESTING'] = True
        self.client = backend_app.app.test_client()

    def test_2026_upload_lifecycle_and_endpoints(self):
        # 1. Prepare 2026 CSV with intentional shortfalls
        csv_content = (
            "timestamp,actual_generation,temperature,humidity,wind_speed\n"
            "2026-03-01 10:00:00,1.2,28.0,45.0,2.5\n"
            "2026-03-01 10:30:00,1.5,29.0,44.0,2.6\n"
            "2026-03-01 11:00:00,2.0,30.5,42.0,2.8\n"
            "2026-03-01 11:30:00,1.8,31.0,40.0,3.0\n"
            "2026-03-01 12:00:00,2.5,32.0,38.0,3.2\n"
        )

        data = {
            'site': 'site-1',
            'file': (io.BytesIO(csv_content.encode('utf-8')), 'test_2026_upload_SYNTHETIC.csv')
        }
        res = self.client.post('/api/live/upload', data=data, content_type='multipart/form-data')
        self.assertEqual(res.status_code, 200, f"Upload failed: {res.get_data(as_text=True)}")
        upload_resp = res.get_json()
        self.assertTrue(upload_resp.get('success'))
        self.assertEqual(upload_resp.get('accepted'), 5)
        batch_id = upload_resp.get('batch_id')
        self.assertTrue(bool(batch_id))

        try:
            # 2. Assert date range in /api/sites extends to 2026
            sites_res = self.client.get('/api/sites')
            self.assertEqual(sites_res.status_code, 200)
            sites_data = sites_res.get_json().get('sites', [])
            site1 = next((s for s in sites_data if s['id'] == 'site-1'), None)
            self.assertIsNotNone(site1)
            self.assertEqual(site1['end_date'], '2026-03-01')
            self.assertEqual(site1['uploaded_count'], 5)
            self.assertEqual(site1['uploaded_range'], '2026-03-01 to 2026-03-01')

            # 3. Assert /api/anomalies returns the 2026 shortfall, tagged 'Uploaded', no high-output events
            anom_res = self.client.get('/api/anomalies?site=site-1&end=2026-03-01T12:00:00&days=7')
            self.assertEqual(anom_res.status_code, 200)
            anom_json = anom_res.get_json()
            anomalies = anom_json.get('anomalies', [])
            self.assertGreater(len(anomalies), 0, "Expected at least one shortfall anomaly in 2026 data")
            for a in anomalies:
                self.assertLess(a['actual_kW'], a['expected_kW'], "Never flag high output where act > exp")
            uploaded_anoms = [a for a in anomalies if a.get('source') == 'Uploaded']
            self.assertGreater(len(uploaded_anoms), 0, "Expected anomaly tagged 'Uploaded'")

            # 4. Assert /api/history returns uploaded points
            hist_res = self.client.get('/api/history?site=site-1&start=2026-03-01&end=2026-03-01')
            self.assertEqual(hist_res.status_code, 200)
            hist_json = hist_res.get_json()
            self.assertEqual(hist_json.get('count'), 5)

            # 5. Assert /api/daily-summary includes 2026
            ds_res = self.client.get('/api/daily-summary?site=site-1&date=2026-03-01')
            self.assertEqual(ds_res.status_code, 200)

            # 6. Assert /api/trend includes 2026
            trend_res = self.client.get('/api/trend?site=site-1')
            self.assertEqual(trend_res.status_code, 200)

            # 7. Assert /api/cleaning-decision works with 2026 timestamp
            clean_res = self.client.get('/api/cleaning-decision?site=site-1&timestamp=2026-03-01T12:00:00')
            self.assertEqual(clean_res.status_code, 200)
            self.assertTrue(clean_res.get_json().get('success'))

            # 8. Assert /api/simulate runs successfully
            sim_res = self.client.get('/api/simulate?site=site-1')
            self.assertEqual(sim_res.status_code, 200)
            self.assertTrue(sim_res.get_json().get('success'))

        finally:
            # 9. Clean up batch and verify site date reverts to historical extent
            del_res = self.client.delete(f'/api/live/batches/{batch_id}')
            self.assertEqual(del_res.status_code, 200)
            sites_after = self.client.get('/api/sites').get_json().get('sites', [])
            s1_after = next((s for s in sites_after if s['id'] == 'site-1'), None)
            self.assertEqual(s1_after['end_date'], '2020-08-19')
            self.assertEqual(s1_after['uploaded_count'], 0)

if __name__ == '__main__':
    unittest.main()

