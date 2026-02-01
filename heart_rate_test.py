#!/usr/bin/env python3
"""
FitTrax+ Heart Rate Endpoints Testing
Quick health check for heart rate feature endpoints as requested in review
"""

import requests
import json
import os
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://fitness-journey-294.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

def test_heart_rate_endpoints():
    """Test heart rate endpoints as requested in review"""
    print("=" * 60)
    print("FITTRAX+ HEART RATE ENDPOINTS TESTING")
    print("=" * 60)
    
    test_user_id = "user_1769564539081"
    results = []
    
    # Test 1: POST /api/heart-rate - Add heart rate reading
    print("\n1. Testing POST /api/heart-rate (Add heart rate reading)")
    print("-" * 50)
    
    # Generate unique heart_rate_id and timestamp
    timestamp = datetime.utcnow().isoformat()
    heart_rate_id = f"hr_{int(datetime.now().timestamp() * 1000)}"
    
    # Note: The review request has "source" and "activity" fields, but the backend model expects different fields
    # Backend expects: heart_rate_id, user_id, bpm, activity_type, notes, timestamp
    heart_rate_data = {
        "heart_rate_id": heart_rate_id,
        "user_id": test_user_id,
        "bpm": 72,
        "activity_type": "resting",  # Backend uses "activity_type" not "activity"
        "notes": "Camera measurement",  # Using notes field instead of "source"
        "timestamp": timestamp
    }
    
    try:
        response = requests.post(f"{API_BASE}/heart-rate", json=heart_rate_data, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ POST /api/heart-rate working correctly")
            results.append(("POST /api/heart-rate", True, "Heart rate added successfully"))
        else:
            print(f"❌ POST /api/heart-rate failed with status {response.status_code}")
            results.append(("POST /api/heart-rate", False, f"Status {response.status_code}: {response.text}"))
            
    except Exception as e:
        print(f"❌ POST /api/heart-rate error: {str(e)}")
        results.append(("POST /api/heart-rate", False, f"Request error: {str(e)}"))
    
    # Test 2: GET /api/heart-rate/{user_id}?days=7 - Get recent readings
    print("\n2. Testing GET /api/heart-rate/{user_id}?days=7 (Get recent readings)")
    print("-" * 50)
    
    try:
        response = requests.get(f"{API_BASE}/heart-rate/{test_user_id}?days=7", timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            heart_rates = data.get("heart_rates", [])
            print(f"✅ GET /api/heart-rate/{test_user_id}?days=7 working correctly")
            print(f"   Found {len(heart_rates)} heart rate readings")
            results.append(("GET /api/heart-rate/{user_id}?days=7", True, f"Retrieved {len(heart_rates)} heart rate readings"))
        else:
            print(f"❌ GET /api/heart-rate/{test_user_id}?days=7 failed with status {response.status_code}")
            results.append(("GET /api/heart-rate/{user_id}?days=7", False, f"Status {response.status_code}: {response.text}"))
            
    except Exception as e:
        print(f"❌ GET /api/heart-rate/{test_user_id}?days=7 error: {str(e)}")
        results.append(("GET /api/heart-rate/{user_id}?days=7", False, f"Request error: {str(e)}"))
    
    # Summary
    print("\n" + "=" * 60)
    print("HEART RATE ENDPOINTS TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, success, _ in results if success)
    total = len(results)
    
    for endpoint, success, message in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {endpoint}")
        if not success:
            print(f"   Issue: {message}")
    
    print(f"\nResults: {passed}/{total} tests passed ({(passed/total)*100:.1f}% success rate)")
    
    # Important findings
    print("\n" + "=" * 60)
    print("IMPORTANT FINDINGS")
    print("=" * 60)
    
    print("1. API Model Mismatch:")
    print("   - Review request specifies: 'source': 'camera', 'activity': 'resting'")
    print("   - Backend model expects: 'activity_type': 'resting', 'notes': '...'")
    print("   - No 'source' field exists in HeartRateCreate model")
    print("   - Field name is 'activity_type' not 'activity'")
    
    print("\n2. Required Fields:")
    print("   - Backend requires: heart_rate_id, user_id, bpm, activity_type, timestamp")
    print("   - Review request missing: heart_rate_id, timestamp")
    
    if passed == total:
        print(f"\n✅ All {total} heart rate endpoints are working correctly!")
    else:
        print(f"\n❌ {total - passed} endpoint(s) have issues that need attention")
    
    return results

if __name__ == "__main__":
    test_heart_rate_endpoints()