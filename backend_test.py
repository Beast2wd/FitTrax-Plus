#!/usr/bin/env python3
"""
Backend API Testing for FitTrax - New Endpoints
Testing the following new endpoints:
1. DELETE /api/body-scan/{scan_id} - Delete a body scan entry
2. DELETE /api/heart-rate/{heart_rate_id} - Delete a heart rate entry  
3. GET /api/body-scan/progress/{user_id} - Verify it returns scan_id in each progress entry
"""

import requests
import json
import uuid
from datetime import datetime
import base64

# Backend URL from environment
BACKEND_URL = "https://health-hub-136.preview.emergentagent.com/api"

def test_health_check():
    """Test if backend is running"""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        print(f"✅ Health check: {response.status_code} - {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def create_test_user():
    """Create a test user profile for testing"""
    user_id = f"test_user_{uuid.uuid4().hex[:8]}"
    profile_data = {
        "user_id": user_id,
        "name": "Test User",
        "age": 30,
        "gender": "male",
        "height_feet": 5,
        "height_inches": 10,
        "weight": 180.0,
        "goal_weight": 170.0,
        "activity_level": "moderate"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/user/profile", json=profile_data, timeout=10)
        if response.status_code == 200:
            print(f"✅ Test user created: {user_id}")
            return user_id
        else:
            print(f"❌ Failed to create test user: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error creating test user: {e}")
        return None

def create_test_body_scan(user_id):
    """Create a test body scan entry"""
    scan_data = {
        "user_id": user_id,
        "height_inches": 70,
        "weight_lbs": 180,
        "body_fat_percentage": 15.0,
        "fitness_goal": "muscle_gain",
        "workout_location": "gym",
        "experience_level": "intermediate",
        "photos": [],
        "measurements": {
            "chest": 42.0,
            "waist": 32.0,
            "hips": 38.0,
            "bicep": 14.0,
            "thigh": 24.0
        }
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/body-scan/analyze", json=scan_data, timeout=15)
        if response.status_code == 200:
            result = response.json()
            scan_id = result.get("scan_id")
            print(f"✅ Test body scan created: {scan_id}")
            return scan_id
        else:
            print(f"❌ Failed to create test body scan: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error creating test body scan: {e}")
        return None

def create_test_heart_rate(user_id):
    """Create a test heart rate entry"""
    heart_rate_id = f"hr_{uuid.uuid4().hex[:8]}"
    hr_data = {
        "heart_rate_id": heart_rate_id,
        "user_id": user_id,
        "bpm": 75,
        "activity_type": "resting",
        "notes": "Test heart rate entry",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/heart-rate", json=hr_data, timeout=10)
        if response.status_code == 200:
            print(f"✅ Test heart rate created: {heart_rate_id}")
            return heart_rate_id
        else:
            print(f"❌ Failed to create test heart rate: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error creating test heart rate: {e}")
        return None

def test_delete_body_scan(scan_id):
    """Test DELETE /api/body-scan/{scan_id}"""
    print(f"\n🧪 Testing DELETE /api/body-scan/{scan_id}")
    
    try:
        # Test deleting existing scan
        response = requests.delete(f"{BACKEND_URL}/body-scan/{scan_id}", timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ DELETE body scan successful: {result}")
            
            # Verify scan is actually deleted by trying to get it
            get_response = requests.get(f"{BACKEND_URL}/body-scan/{scan_id}", timeout=10)
            if get_response.status_code == 404:
                print("✅ Verified: Body scan was actually deleted")
                return True
            else:
                print(f"❌ Body scan still exists after deletion: {get_response.status_code}")
                return False
        else:
            print(f"❌ DELETE body scan failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing DELETE body scan: {e}")
        return False

def test_delete_body_scan_not_found():
    """Test DELETE /api/body-scan/{scan_id} with non-existent scan_id"""
    print(f"\n🧪 Testing DELETE /api/body-scan/nonexistent_scan")
    
    try:
        response = requests.delete(f"{BACKEND_URL}/body-scan/nonexistent_scan", timeout=10)
        
        if response.status_code == 404:
            print("✅ DELETE non-existent body scan correctly returned 404")
            return True
        else:
            print(f"❌ DELETE non-existent body scan returned unexpected status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing DELETE non-existent body scan: {e}")
        return False

def test_delete_heart_rate(heart_rate_id):
    """Test DELETE /api/heart-rate/{heart_rate_id}"""
    print(f"\n🧪 Testing DELETE /api/heart-rate/{heart_rate_id}")
    
    try:
        # Test deleting existing heart rate
        response = requests.delete(f"{BACKEND_URL}/heart-rate/{heart_rate_id}", timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ DELETE heart rate successful: {result}")
            return True
        else:
            print(f"❌ DELETE heart rate failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing DELETE heart rate: {e}")
        return False

def test_delete_heart_rate_not_found():
    """Test DELETE /api/heart-rate/{heart_rate_id} with non-existent heart_rate_id"""
    print(f"\n🧪 Testing DELETE /api/heart-rate/nonexistent_hr")
    
    try:
        response = requests.delete(f"{BACKEND_URL}/heart-rate/nonexistent_hr", timeout=10)
        
        if response.status_code == 404:
            print("✅ DELETE non-existent heart rate correctly returned 404")
            return True
        else:
            print(f"❌ DELETE non-existent heart rate returned unexpected status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing DELETE non-existent heart rate: {e}")
        return False

def test_body_scan_progress_with_scan_id(user_id):
    """Test GET /api/body-scan/progress/{user_id} - verify scan_id is included"""
    print(f"\n🧪 Testing GET /api/body-scan/progress/{user_id}")
    
    try:
        # First create a body scan to ensure we have data
        scan_id = create_test_body_scan(user_id)
        if not scan_id:
            print("❌ Could not create test body scan for progress test")
            return False
        
        # Now test the progress endpoint
        response = requests.get(f"{BACKEND_URL}/body-scan/progress/{user_id}", timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ GET body scan progress successful")
            
            # Check if progress data exists and contains scan_id
            if result.get("has_data") and result.get("progress"):
                progress_entries = result["progress"]
                print(f"📊 Found {len(progress_entries)} progress entries")
                
                # Verify each progress entry has scan_id
                all_have_scan_id = True
                for i, entry in enumerate(progress_entries):
                    if "scan_id" not in entry:
                        print(f"❌ Progress entry {i} missing scan_id: {entry}")
                        all_have_scan_id = False
                    else:
                        print(f"✅ Progress entry {i} has scan_id: {entry['scan_id']}")
                
                if all_have_scan_id:
                    print("✅ All progress entries include scan_id field")
                    return True
                else:
                    print("❌ Some progress entries missing scan_id field")
                    return False
            else:
                print("ℹ️ No progress data found (empty result)")
                return True  # Empty result is valid
                
        else:
            print(f"❌ GET body scan progress failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing GET body scan progress: {e}")
        return False

def run_all_tests():
    """Run all tests for the new endpoints"""
    print("🚀 Starting Backend API Tests for New Endpoints")
    print("=" * 60)
    
    # Test results
    results = {
        "health_check": False,
        "delete_body_scan_existing": False,
        "delete_body_scan_not_found": False,
        "delete_heart_rate_existing": False,
        "delete_heart_rate_not_found": False,
        "body_scan_progress_scan_id": False
    }
    
    # 1. Health check
    results["health_check"] = test_health_check()
    if not results["health_check"]:
        print("❌ Backend is not healthy, stopping tests")
        return results
    
    # 2. Create test user
    user_id = create_test_user()
    if not user_id:
        print("❌ Could not create test user, stopping tests")
        return results
    
    # 3. Test DELETE body scan endpoints
    scan_id = create_test_body_scan(user_id)
    if scan_id:
        results["delete_body_scan_existing"] = test_delete_body_scan(scan_id)
    
    results["delete_body_scan_not_found"] = test_delete_body_scan_not_found()
    
    # 4. Test DELETE heart rate endpoints
    heart_rate_id = create_test_heart_rate(user_id)
    if heart_rate_id:
        results["delete_heart_rate_existing"] = test_delete_heart_rate(heart_rate_id)
    
    results["delete_heart_rate_not_found"] = test_delete_heart_rate_not_found()
    
    # 5. Test body scan progress with scan_id
    results["body_scan_progress_scan_id"] = test_body_scan_progress_with_scan_id(user_id)
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, passed_test in results.items():
        status = "✅ PASS" if passed_test else "❌ FAIL"
        print(f"{status} - {test_name}")
        if passed_test:
            passed += 1
    
    print(f"\n🎯 Overall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed! New endpoints are working correctly.")
    else:
        print("⚠️ Some tests failed. Check the details above.")
    
    return results

if __name__ == "__main__":
    run_all_tests()