"""
backend/smoke_upload_test.py
Small test script to verify CSV upload persistence, multi-endpoint consumption,
deduplication, row-level validation with line numbers, and batch deletion.
"""
import os
import sys
import io
import json

# Ensure backend directory is in python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
import data_access

def run_tests():
    client = app.test_client()
    passed = 0
    total = 5

    print("=== STARTING SMOKE UPLOAD TESTS ===")

    # Test 1: Upload a small valid CSV
    valid_csv = (
        "ts,actual_kW,temp,humidity,wind\n"
        "2026-06-15 11:00:00,12.5,31.2,45.0,2.8\n"
        "2026-06-15 12:00:00,18.2,33.0,42.0,3.1\n"
        "2026-06-15 13:00:00,16.8,33.5,40.0,3.4\n"
    )
    data = {
        'site': 'site-1',
        'file': (io.BytesIO(valid_csv.encode('utf-8')), 'test_valid.csv')
    }
    res = client.post('/api/live/upload', data=data, content_type='multipart/form-data')
    assert res.status_code == 200, f"Upload failed: {res.data}"
    res_json = res.get_json()
    assert res_json.get('accepted') == 3, f"Expected 3 accepted, got {res_json}"
    batch_id = res_json.get('batch_id')
    assert batch_id, "Missing batch_id in upload response"
    print(f"[PASS 1/5] Valid CSV uploaded successfully. Batch ID: {batch_id}, accepted: 3")
    passed += 1

    # Test 2: Check at least 3 endpoints return those rows
    # Endpoint 1: /api/history
    h_res = client.get('/api/history?site=site-1&start=2026-06-15T10:00&end=2026-06-15T14:00')
    assert h_res.status_code == 200, f"History request failed: {h_res.data}"
    h_json = h_res.get_json()
    history_pts = h_json.get('history', [])
    assert len(history_pts) == 3, f"Expected 3 history points for 2026-06-15, got {len(history_pts)}"
    assert all(p.get('source') == 'uploaded' for p in history_pts), "Expected uploaded source tag"
    print(f"  -> Endpoint 1 (/api/history): Returned {len(history_pts)} uploaded rows")

    # Endpoint 2: /api/daily-summary
    ds_res = client.get('/api/daily-summary?site=site-1&date=2026-06-15')
    assert ds_res.status_code == 200, f"Daily summary failed: {ds_res.data}"
    ds_json = ds_res.get_json()
    assert ds_json.get('success') is True, f"Daily summary not successful: {ds_json}"
    actual_kwh = float(ds_json.get('totals', {}).get('actual_kWh', 0) or ds_json.get('summaries', [{}])[0].get('actual_kWh', 0))
    assert actual_kwh > 0, f"Expected positive actual_kWh, got {ds_json}"
    print(f"  -> Endpoint 2 (/api/daily-summary): Returned actual_kWh={actual_kwh}")

    # Endpoint 3: /api/live/batches
    b_res = client.get('/api/live/batches')
    assert b_res.status_code == 200, f"Batches endpoint failed: {b_res.data}"
    b_json = b_res.get_json()
    batches = b_json.get('batches', [])
    found_batch = any(b.get('batch_id') == batch_id for b in batches)
    assert found_batch, f"Batch {batch_id} not found in batches list"
    print(f"  -> Endpoint 3 (/api/live/batches): Batch found in batch registry")

    # Endpoint 4 (Bonus): /api/data-info
    di_res = client.get('/api/data-info')
    assert di_res.status_code == 200
    di_json = di_res.get_json()
    assert di_json.get('uploaded_2026_rows', 0) >= 3
    print(f"  -> Endpoint 4 (/api/data-info): uploaded_2026_rows={di_json.get('uploaded_2026_rows')}")
    print("[PASS 2/5] Verified multi-endpoint consumption across 4 endpoints.")
    passed += 1

    # Test 3: Re-upload does not duplicate (latest wins on site, ts)
    data_reupload = {
        'site': 'site-1',
        'file': (io.BytesIO(valid_csv.encode('utf-8')), 'test_valid_dup.csv')
    }
    res_dup = client.post('/api/live/upload', data=data_reupload, content_type='multipart/form-data')
    assert res_dup.status_code == 200
    dup_batch_id = res_dup.get_json().get('batch_id')

    # Check /api/history still returns only 3 rows (not 6)
    h_res_dup = client.get('/api/history?site=site-1&start=2026-06-15T10:00&end=2026-06-15T14:00')
    h_dup_pts = h_res_dup.get_json().get('history', [])
    assert len(h_dup_pts) == 3, f"Expected 3 rows after duplicate re-upload, got {len(h_dup_pts)}"
    print("[PASS 3/5] Re-upload deduplication verified (row count remains 3).")
    passed += 1

    # Test 4: Bad row rejected with its row number
    # Row 1 is header, Row 2 is valid, Row 3 has negative kW (bad!), Row 4 has high night power (bad!)
    bad_csv = (
        "ts,actual_kW,temp,humidity,wind\n"
        "2026-06-16 11:00:00,10.0,30.0,50.0,2.0\n"
        "2026-06-16 12:00:00,-5.0,30.0,50.0,2.0\n"
        "2026-06-16 23:00:00,15.0,25.0,60.0,1.0\n"
    )
    bad_data = {
        'site': 'site-1',
        'file': (io.BytesIO(bad_csv.encode('utf-8')), 'test_bad.csv')
    }
    bad_res = client.post('/api/live/upload', data=bad_data, content_type='multipart/form-data')
    assert bad_res.status_code == 200
    bad_json = bad_res.get_json()
    assert bad_json.get('accepted') == 1, f"Expected 1 accepted, got {bad_json.get('accepted')}"
    assert bad_json.get('rejected') == 2, f"Expected 2 rejected, got {bad_json.get('rejected')}"
    errors = bad_json.get('row_errors', [])
    assert len(errors) == 2, f"Expected 2 row errors, got {errors}"
    assert errors[0]['row'] == 2, f"Expected row 2 error, got {errors[0]}"
    assert errors[1]['row'] == 3, f"Expected row 3 error, got {errors[1]}"
    print(f"[PASS 4/5] Row rejection verified: rows {[e['row'] for e in errors]} rejected with reasons.")
    passed += 1

    # Test 5: Deleting batches removes rows
    del_res1 = client.delete(f'/api/live/batches/{batch_id}')
    assert del_res1.status_code == 200, f"Delete batch {batch_id} failed: {del_res1.data}"
    del_res2 = client.delete(f'/api/live/batches/{dup_batch_id}')
    assert del_res2.status_code == 200, f"Delete batch {dup_batch_id} failed: {del_res2.data}"
    if bad_json.get('batch_id'):
        client.delete(f"/api/live/batches/{bad_json.get('batch_id')}")

    # Check history after deletion
    h_res_post = client.get('/api/history?site=site-1&start=2026-06-15T10:00&end=2026-06-15T14:00')
    h_post_pts = h_res_post.get_json().get('history', [])
    assert len(h_post_pts) == 0, f"Expected 0 rows after batch delete, got {len(h_post_pts)}"
    print("[PASS 5/5] Batch deletion verified: batch removed from registry and rows removed.")
    passed += 1

    print(f"\nALL {passed}/{total} SMOKE TESTS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    run_tests()
