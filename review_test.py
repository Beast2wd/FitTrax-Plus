#!/usr/bin/env python3
"""
FitTrax+ Review Request Testing
Testing specific endpoints requested in the review
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://fittrax-sync.preview.emergentagent.com/api"
TEST_USER_ID = "user_1769564539081"

def test_endpoint(method, endpoint, data=None):
    """Test a single API endpoint"""
    url = f"{BASE_URL}{endpoint}"
    
    try:
        print(f"\n🔍 Testing {method} {endpoint}")
        
        if method == "GET":
            response = requests.get(url, timeout=30)
        elif method == "POST":
            headers = {"Content-Type": "application/json"}
            response = requests.post(url, json=data, headers=headers, timeout=30)
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                json_data = response.json()
                print(f"   ✅ SUCCESS - Valid JSON response")
                print(f"   Response keys: {list(json_data.keys()) if isinstance(json_data, dict) else 'Non-dict response'}")
                return True
            except json.JSONDecodeError:
                print(f"   ❌ FAIL - Invalid JSON response")
                return False
        else:
            print(f"   ❌ FAIL - Status code: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"   ❌ FAIL - Error: {str(e)}")
        return False

def main():
    """Test the specific endpoints from the review request"""
    print("=" * 60)
    print("FitTrax+ Review Request Testing")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"Test User ID: {TEST_USER_ID}")
    print(f"Test Time: {datetime.now().isoformat()}")
    
    # Test cases from review request
    test_cases = [
        {
            "name": "Membership Status",
            "method": "GET", 
            "endpoint": f"/membership/status/{TEST_USER_ID}",
        },
        {
            "name": "Membership Pricing",
            "method": "GET",
            "endpoint": "/membership/pricing", 
        },
        {
            "name": "Dashboard Data with Date",
            "method": "GET",
            "endpoint": f"/dashboard/{TEST_USER_ID}?local_date=2026-01-29",
        },
        {
            "name": "Gamification Streak",
            "method": "GET",
            "endpoint": f"/gamification/streak/{TEST_USER_ID}",
        },
        {
            "name": "Sync Gamification Progress", 
            "method": "POST",
            "endpoint": f"/gamification/sync-progress/{TEST_USER_ID}",
            "data": {
                "activity_type": "workout",
                "points": 50,
                "timestamp": datetime.now().isoformat()
            }
        }
    ]
    
    # Run tests
    results = []
    for test_case in test_cases:
        print(f"\n{'='*60}")
        print(f"TEST: {test_case['name']}")
        
        success = test_endpoint(
            method=test_case["method"],
            endpoint=test_case["endpoint"], 
            data=test_case.get("data")
        )
        
        results.append({
            "name": test_case["name"],
            "success": success,
            "endpoint": test_case["endpoint"]
        })
    
    # Summary
    print(f"\n{'='*60}")
    print("REVIEW REQUEST TEST SUMMARY")
    print(f"{'='*60}")
    
    passed = sum(1 for r in results if r["success"])
    total = len(results)
    
    for result in results:
        status = "✅ PASS" if result["success"] else "❌ FAIL"
        print(f"{status} {result['name']}")
    
    print(f"\nResults: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 All requested endpoints are working correctly!")
        print("✅ All endpoints return 200 OK status")
        print("✅ All endpoints return proper JSON responses")
        print("✅ No server errors detected")
    else:
        print(f"⚠️  {total - passed} endpoint(s) failed.")

if __name__ == "__main__":
    main()