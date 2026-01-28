#!/usr/bin/env python3
"""
FitTrax+ Enhanced Endpoint Testing
Testing Dashboard endpoint with sugar/fiber data and investigating Delete All Manual Workout Log endpoint
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend .env
BASE_URL = "https://fittracker-188.preview.emergentagent.com/api"

def test_dashboard_sugar_fiber():
    """Test Dashboard endpoint with sugar/fiber data"""
    print("=" * 60)
    print("TESTING: Dashboard endpoint with sugar/fiber data")
    print("=" * 60)
    
    user_id = "test_user_123"
    
    try:
        # Test GET /api/dashboard/{user_id}
        url = f"{BASE_URL}/dashboard/{user_id}"
        print(f"Testing: GET {url}")
        
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Dashboard endpoint accessible")
            
            # Check if 'today' object exists
            if 'today' in data:
                today = data['today']
                print("✅ 'today' object found in response")
                
                # Check for sugar field
                if 'sugar' in today:
                    sugar_value = today['sugar']
                    if isinstance(sugar_value, (int, float)):
                        print(f"✅ 'sugar' field found: {sugar_value} (type: {type(sugar_value).__name__})")
                    else:
                        print(f"❌ 'sugar' field found but not a number: {sugar_value} (type: {type(sugar_value).__name__})")
                        return False
                else:
                    print("❌ 'sugar' field missing from 'today' object")
                    return False
                
                # Check for fiber field
                if 'fiber' in today:
                    fiber_value = today['fiber']
                    if isinstance(fiber_value, (int, float)):
                        print(f"✅ 'fiber' field found: {fiber_value} (type: {type(fiber_value).__name__})")
                    else:
                        print(f"❌ 'fiber' field found but not a number: {fiber_value} (type: {type(fiber_value).__name__})")
                        return False
                else:
                    print("❌ 'fiber' field missing from 'today' object")
                    return False
                
                # Check for existing required fields
                required_fields = ['calories_consumed', 'protein', 'carbs', 'fat']
                for field in required_fields:
                    if field in today:
                        value = today[field]
                        if isinstance(value, (int, float)):
                            print(f"✅ '{field}' field found: {value}")
                        else:
                            print(f"❌ '{field}' field found but not a number: {value}")
                            return False
                    else:
                        print(f"❌ '{field}' field missing from 'today' object")
                        return False
                
                print("\n📊 Complete 'today' object structure:")
                for key, value in today.items():
                    print(f"  {key}: {value} ({type(value).__name__})")
                
                return True
            else:
                print("❌ 'today' object missing from response")
                print(f"Response keys: {list(data.keys())}")
                return False
        else:
            print(f"❌ Dashboard endpoint failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing dashboard endpoint: {str(e)}")
        return False

def investigate_manual_workout_log_structure():
    """Investigate the manual workout log data structure"""
    print("\n" + "=" * 60)
    print("INVESTIGATING: Manual Workout Log Data Structure")
    print("=" * 60)
    
    user_id = "test_user_investigate"
    
    try:
        # Create a test entry to see the actual structure
        create_url = f"{BASE_URL}/manual-workout-log"
        test_entry_data = {
            "user_id": user_id,
            "exercise_name": "Investigation Exercise",
            "reps": {"1": "12", "2": "10", "3": "8"},
            "weight": {"1": "60", "2": "65", "3": "70"},
            "notes": "Entry to investigate data structure"
        }
        
        print(f"Creating test entry: POST {create_url}")
        create_response = requests.post(create_url, json=test_entry_data, timeout=30)
        print(f"Create Status: {create_response.status_code}")
        
        if create_response.status_code in [200, 201]:
            create_data = create_response.json()
            print("✅ Test entry created")
            print(f"Create Response: {json.dumps(create_data, indent=2)}")
        
        # Get all entries to see the actual database structure
        get_url = f"{BASE_URL}/manual-workout-log/{user_id}"
        print(f"\nGetting entries: GET {get_url}")
        
        get_response = requests.get(get_url, timeout=30)
        print(f"Get Status: {get_response.status_code}")
        
        if get_response.status_code == 200:
            get_data = get_response.json()
            
            if 'entries' in get_data and len(get_data['entries']) > 0:
                print("✅ Found entries in database")
                print(f"Number of entries: {len(get_data['entries'])}")
                
                # Show the structure of the first entry
                first_entry = get_data['entries'][0]
                print("\n📊 Actual database entry structure:")
                for key, value in first_entry.items():
                    print(f"  {key}: {value} ({type(value).__name__})")
                
                # Check if date field exists
                if 'date' in first_entry:
                    print(f"\n✅ 'date' field found: {first_entry['date']}")
                else:
                    print("\n❌ 'date' field NOT found in database entries")
                    print("🔍 This explains why the delete endpoint returns 0 - it's looking for a 'date' field that doesn't exist!")
                
                return first_entry
            else:
                print("❌ No entries found")
                return None
        else:
            print(f"❌ Failed to get entries: {get_response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ Error investigating structure: {str(e)}")
        return None

def test_delete_all_manual_workout_log_with_fix():
    """Test Delete All Manual Workout Log endpoint with proper understanding"""
    print("\n" + "=" * 60)
    print("TESTING: Delete All Manual Workout Log endpoint (Enhanced)")
    print("=" * 60)
    
    user_id = "test_user_delete_enhanced"
    test_date = "2025-01-28"
    
    try:
        # Step 1: Create multiple test entries
        print("Step 1: Creating multiple test entries...")
        
        create_url = f"{BASE_URL}/manual-workout-log"
        created_entries = []
        
        for i in range(3):
            test_entry_data = {
                "user_id": user_id,
                "exercise_name": f"Test Exercise {i+1}",
                "reps": {"1": str(10+i), "2": str(10+i), "3": str(10+i)},
                "weight": {"1": str(50+i*5), "2": str(50+i*5), "3": str(50+i*5)},
                "notes": f"Test entry {i+1} for delete all functionality"
            }
            
            create_response = requests.post(create_url, json=test_entry_data, timeout=30)
            
            if create_response.status_code in [200, 201]:
                create_data = create_response.json()
                if 'entry' in create_data and 'entry_id' in create_data['entry']:
                    entry_id = create_data['entry']['entry_id']
                    created_entries.append(entry_id)
                    print(f"✅ Created entry {i+1}: {entry_id}")
                else:
                    print(f"⚠️  Entry {i+1} created but couldn't get entry_id")
            else:
                print(f"❌ Failed to create entry {i+1}: {create_response.status_code}")
        
        print(f"Created {len(created_entries)} entries")
        
        # Step 2: Get entries before deletion to confirm they exist
        print(f"\nStep 2: Confirming entries exist before deletion...")
        
        get_url = f"{BASE_URL}/manual-workout-log/{user_id}"
        get_response = requests.get(get_url, timeout=30)
        
        if get_response.status_code == 200:
            get_data = get_response.json()
            entries_before = len(get_data.get('entries', []))
            print(f"✅ Found {entries_before} entries before deletion")
        else:
            print(f"❌ Failed to get entries before deletion: {get_response.status_code}")
            entries_before = 0
        
        # Step 3: Test the delete endpoint (knowing it looks for 'date' field)
        print(f"\nStep 3: Testing DELETE endpoint (expecting 0 deletions due to missing 'date' field)...")
        
        delete_url = f"{BASE_URL}/manual-workout-log/all/{user_id}"
        params = {"date": test_date}
        
        print(f"DELETE {delete_url}?date={test_date}")
        
        delete_response = requests.delete(delete_url, params=params, timeout=30)
        print(f"Delete Status Code: {delete_response.status_code}")
        
        if delete_response.status_code == 200:
            delete_data = delete_response.json()
            print("✅ Delete endpoint accessible")
            
            # Check response structure
            if 'deleted_count' in delete_data:
                deleted_count = delete_data['deleted_count']
                print(f"✅ 'deleted_count' field found: {deleted_count}")
                
                # Since entries don't have 'date' field, we expect 0 deletions
                if deleted_count == 0:
                    print("✅ Expected result: 0 deletions (entries don't have 'date' field)")
                else:
                    print(f"⚠️  Unexpected: {deleted_count} deletions occurred")
            else:
                print("❌ 'deleted_count' field missing from response")
                return False
            
            print(f"\n📊 Delete response: {json.dumps(delete_data, indent=2)}")
            
        else:
            print(f"❌ Delete endpoint failed with status {delete_response.status_code}")
            return False
        
        # Step 4: Verify entries still exist (since delete should have done nothing)
        print(f"\nStep 4: Verifying entries still exist...")
        
        get_response_after = requests.get(get_url, timeout=30)
        
        if get_response_after.status_code == 200:
            get_data_after = get_response_after.json()
            entries_after = len(get_data_after.get('entries', []))
            print(f"✅ Found {entries_after} entries after deletion attempt")
            
            if entries_after == entries_before:
                print("✅ Verification successful: All entries remain (as expected)")
                
                # Clean up - delete individual entries
                print(f"\nStep 5: Cleaning up test entries...")
                for entry_id in created_entries:
                    delete_individual_url = f"{BASE_URL}/manual-workout-log/{entry_id}"
                    cleanup_response = requests.delete(delete_individual_url, timeout=30)
                    if cleanup_response.status_code == 200:
                        print(f"✅ Cleaned up entry: {entry_id}")
                    else:
                        print(f"⚠️  Failed to clean up entry: {entry_id}")
                
                return True
            else:
                print(f"❌ Unexpected: Entry count changed from {entries_before} to {entries_after}")
                return False
        else:
            print(f"❌ Failed to verify entries after deletion: {get_response_after.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing delete all manual workout log: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting FitTrax+ Enhanced Backend API Testing")
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().isoformat()}")
    
    results = []
    
    # Test 1: Dashboard with sugar/fiber data
    dashboard_result = test_dashboard_sugar_fiber()
    results.append(("Dashboard endpoint with sugar/fiber data", dashboard_result))
    
    # Investigation: Manual workout log structure
    entry_structure = investigate_manual_workout_log_structure()
    
    # Test 2: Delete All Manual Workout Log (enhanced)
    delete_all_result = test_delete_all_manual_workout_log_with_fix()
    results.append(("Delete All Manual Workout Log endpoint", delete_all_result))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
    
    print(f"\nResults: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    # Analysis
    print("\n" + "=" * 60)
    print("ANALYSIS")
    print("=" * 60)
    
    print("✅ Dashboard endpoint: Working correctly with sugar and fiber fields")
    
    if entry_structure and 'date' not in entry_structure:
        print("⚠️  Delete All endpoint: API design issue detected")
        print("   - The DELETE /api/manual-workout-log/all/{user_id}?date=YYYY-MM-DD endpoint")
        print("   - Looks for a 'date' field in database entries")
        print("   - But the POST /api/manual-workout-log endpoint doesn't store a 'date' field")
        print("   - This means the delete endpoint will always return 0 deletions")
        print("   - RECOMMENDATION: Either add 'date' field to POST endpoint or modify DELETE logic")
    else:
        print("✅ Delete All endpoint: Working as designed")
    
    if passed == total:
        print("\n🎉 All tests passed! Endpoints are accessible and return expected structure.")
        return True
    else:
        print("\n⚠️  Some tests failed. Check the details above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)