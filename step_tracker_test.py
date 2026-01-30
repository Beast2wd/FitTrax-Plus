#!/usr/bin/env python3
"""
Step Tracker Backend API Testing
Tests all step tracking endpoints for the FitTrax+ application
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# Backend URL from environment
BACKEND_URL = "https://premium-fittrax.preview.emergentagent.com/api"

def test_health_endpoint():
    """Test health check endpoint"""
    print("🔍 Testing health endpoint...")
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                print("✅ Health endpoint working correctly")
                return True
            else:
                print(f"❌ Health endpoint returned unexpected data: {data}")
                return False
        else:
            print(f"❌ Health endpoint failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health endpoint error: {str(e)}")
        return False

def test_save_steps():
    """Test POST /api/steps - Save steps"""
    print("\n🔍 Testing POST /api/steps - Save steps...")
    
    test_data = {
        "user_id": "step_test_user",
        "steps": 5000,
        "date": "2026-01-12",
        "source": "pedometer"
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/steps",
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            expected_keys = ["message", "date", "steps", "calories_burned", "distance_miles"]
            
            if all(key in data for key in expected_keys):
                if (data["steps"] == 5000 and 
                    data["date"] == "2026-01-12" and
                    data["calories_burned"] == 200.0 and  # 5000 * 0.04
                    data["distance_miles"] == 2.5):  # 5000 / 2000
                    print("✅ POST /api/steps working correctly")
                    print(f"   Steps: {data['steps']}, Calories: {data['calories_burned']}, Distance: {data['distance_miles']} miles")
                    return True
                else:
                    print(f"❌ POST /api/steps returned incorrect calculations: {data}")
                    return False
            else:
                print(f"❌ POST /api/steps missing expected keys: {data}")
                return False
        else:
            print(f"❌ POST /api/steps failed with status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ POST /api/steps error: {str(e)}")
        return False

def test_get_today_steps():
    """Test GET /api/steps/{user_id}/today - Get today's steps"""
    print("\n🔍 Testing GET /api/steps/{user_id}/today - Get today's steps...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/steps/step_test_user/today", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            expected_keys = ["date", "steps", "calories_burned", "distance_miles", "source"]
            
            if all(key in data for key in expected_keys):
                today = datetime.utcnow().strftime("%Y-%m-%d")
                if data["date"] == today:
                    print("✅ GET /api/steps/{user_id}/today working correctly")
                    print(f"   Today's steps: {data['steps']}, Date: {data['date']}")
                    return True
                else:
                    print(f"❌ GET /api/steps/{{user_id}}/today returned wrong date: {data}")
                    return False
            else:
                print(f"❌ GET /api/steps/{{user_id}}/today missing expected keys: {data}")
                return False
        else:
            print(f"❌ GET /api/steps/{{user_id}}/today failed with status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/steps/{{user_id}}/today error: {str(e)}")
        return False

def test_get_step_history():
    """Test GET /api/steps/{user_id}/history - Get step history"""
    print("\n🔍 Testing GET /api/steps/{user_id}/history - Get step history...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/steps/step_test_user/history?days=7", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            expected_keys = ["entries", "summary"]
            
            if all(key in data for key in expected_keys):
                summary = data["summary"]
                summary_keys = ["total_steps", "total_calories", "total_distance", "average_steps", "days_tracked"]
                
                if all(key in summary for key in summary_keys):
                    print("✅ GET /api/steps/{user_id}/history working correctly")
                    print(f"   Days tracked: {summary['days_tracked']}, Total steps: {summary['total_steps']}")
                    return True
                else:
                    print(f"❌ GET /api/steps/{{user_id}}/history missing summary keys: {summary}")
                    return False
            else:
                print(f"❌ GET /api/steps/{{user_id}}/history missing expected keys: {data}")
                return False
        else:
            print(f"❌ GET /api/steps/{{user_id}}/history failed with status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/steps/{{user_id}}/history error: {str(e)}")
        return False

def test_get_weekly_steps():
    """Test GET /api/steps/{user_id}/weekly - Get weekly aggregated data"""
    print("\n🔍 Testing GET /api/steps/{user_id}/weekly - Get weekly aggregated data...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/steps/step_test_user/weekly", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if "weekly_data" in data:
                weekly_data = data["weekly_data"]
                if isinstance(weekly_data, list):
                    print("✅ GET /api/steps/{user_id}/weekly working correctly")
                    print(f"   Weekly data entries: {len(weekly_data)}")
                    
                    # Check structure of first entry if exists
                    if weekly_data:
                        first_entry = weekly_data[0]
                        expected_keys = ["week_start", "total_steps", "average_daily", "days_tracked"]
                        if all(key in first_entry for key in expected_keys):
                            print(f"   Sample week: {first_entry['week_start']}, Steps: {first_entry['total_steps']}")
                        else:
                            print(f"   Warning: Weekly entry missing some keys: {first_entry}")
                    
                    return True
                else:
                    print(f"❌ GET /api/steps/{{user_id}}/weekly weekly_data is not a list: {data}")
                    return False
            else:
                print(f"❌ GET /api/steps/{{user_id}}/weekly missing weekly_data key: {data}")
                return False
        else:
            print(f"❌ GET /api/steps/{{user_id}}/weekly failed with status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/steps/{{user_id}}/weekly error: {str(e)}")
        return False

def test_get_monthly_steps():
    """Test GET /api/steps/{user_id}/monthly - Get monthly aggregated data"""
    print("\n🔍 Testing GET /api/steps/{user_id}/monthly - Get monthly aggregated data...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/steps/step_test_user/monthly", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if "monthly_data" in data:
                monthly_data = data["monthly_data"]
                if isinstance(monthly_data, list):
                    print("✅ GET /api/steps/{user_id}/monthly working correctly")
                    print(f"   Monthly data entries: {len(monthly_data)}")
                    
                    # Check structure of first entry if exists
                    if monthly_data:
                        first_entry = monthly_data[0]
                        expected_keys = ["month", "total_steps", "average_daily", "days_tracked"]
                        if all(key in first_entry for key in expected_keys):
                            print(f"   Sample month: {first_entry['month']}, Steps: {first_entry['total_steps']}")
                        else:
                            print(f"   Warning: Monthly entry missing some keys: {first_entry}")
                    
                    return True
                else:
                    print(f"❌ GET /api/steps/{{user_id}}/monthly monthly_data is not a list: {data}")
                    return False
            else:
                print(f"❌ GET /api/steps/{{user_id}}/monthly missing monthly_data key: {data}")
                return False
        else:
            print(f"❌ GET /api/steps/{{user_id}}/monthly failed with status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/steps/{{user_id}}/monthly error: {str(e)}")
        return False

def test_save_step_settings():
    """Test POST /api/steps/settings - Save user settings"""
    print("\n🔍 Testing POST /api/steps/settings - Save user settings...")
    
    test_settings = {
        "user_id": "step_test_user",
        "daily_goal": 10000,
        "tracking_enabled": True,
        "auto_sync_health": True
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/steps/settings",
            json=test_settings,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if "message" in data and "settings" in data:
                settings = data["settings"]
                if (settings["daily_goal"] == 10000 and
                    settings["tracking_enabled"] == True and
                    settings["auto_sync_health"] == True):
                    print("✅ POST /api/steps/settings working correctly")
                    print(f"   Daily goal: {settings['daily_goal']}, Tracking: {settings['tracking_enabled']}")
                    return True
                else:
                    print(f"❌ POST /api/steps/settings returned incorrect settings: {settings}")
                    return False
            else:
                print(f"❌ POST /api/steps/settings missing expected keys: {data}")
                return False
        else:
            print(f"❌ POST /api/steps/settings failed with status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ POST /api/steps/settings error: {str(e)}")
        return False

def test_get_step_settings():
    """Test GET /api/steps/settings/{user_id} - Get user settings"""
    print("\n🔍 Testing GET /api/steps/settings/{user_id} - Get user settings...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/steps/settings/step_test_user", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            expected_keys = ["daily_goal", "tracking_enabled", "auto_sync_health"]
            
            if all(key in data for key in expected_keys):
                if (data["daily_goal"] == 10000 and
                    data["tracking_enabled"] == True and
                    data["auto_sync_health"] == True):
                    print("✅ GET /api/steps/settings/{user_id} working correctly")
                    print(f"   Daily goal: {data['daily_goal']}, Tracking: {data['tracking_enabled']}")
                    return True
                else:
                    print(f"❌ GET /api/steps/settings/{{user_id}} returned incorrect values: {data}")
                    return False
            else:
                print(f"❌ GET /api/steps/settings/{{user_id}} missing expected keys: {data}")
                return False
        else:
            print(f"❌ GET /api/steps/settings/{{user_id}} failed with status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/steps/settings/{{user_id}} error: {str(e)}")
        return False

def main():
    """Run all step tracker tests"""
    print("🚀 Starting Step Tracker Backend API Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 60)
    
    tests = [
        ("Health Check", test_health_endpoint),
        ("Save Steps", test_save_steps),
        ("Get Today's Steps", test_get_today_steps),
        ("Get Step History", test_get_step_history),
        ("Get Weekly Steps", test_get_weekly_steps),
        ("Get Monthly Steps", test_get_monthly_steps),
        ("Save Step Settings", test_save_step_settings),
        ("Get Step Settings", test_get_step_settings),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ {test_name} crashed: {str(e)}")
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"📊 STEP TRACKER TEST RESULTS:")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
    
    if failed == 0:
        print("🎉 All Step Tracker endpoints are working correctly!")
        return 0
    else:
        print("⚠️  Some Step Tracker endpoints have issues that need attention.")
        return 1

if __name__ == "__main__":
    sys.exit(main())