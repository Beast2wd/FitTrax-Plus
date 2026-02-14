#!/usr/bin/env python3
"""
FitTrax+ Meal Planner Backend Testing
Testing the new meal planner endpoints as requested in review.
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend .env
BACKEND_URL = "https://fitness-diary-19.preview.emergentagent.com/api"

# Test data
TEST_USER_ID = "test_meal_user_123"
TEST_DATE = "2026-02-10"
TEST_MEAL_ID = "meal_test_001"
TEST_GROCERY_ID = "grocery_test_001"

def test_health_endpoint():
    """Test health endpoint first"""
    print("🔍 Testing health endpoint...")
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            print("✅ Health endpoint working")
            return True
        else:
            print(f"❌ Health endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health endpoint error: {str(e)}")
        return False

def test_create_planned_meal():
    """Test POST /api/meals/planned - Create a planned meal"""
    print("\n🔍 Testing POST /api/meals/planned - Create planned meal...")
    
    payload = {
        "user_id": TEST_USER_ID,
        "meal": {
            "id": TEST_MEAL_ID,
            "name": "Test Breakfast",
            "category": "breakfast",
            "calories": 450,
            "protein": 25,
            "carbs": 40,
            "fat": 15,
            "sugar": 10,
            "fiber": 5,
            "date": TEST_DATE
        }
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/meals/planned",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if "message" in data and data["message"] == "Meal planned successfully":
                print("✅ Create planned meal working correctly")
                return True
            else:
                print(f"❌ Unexpected response format: {data}")
                return False
        else:
            print(f"❌ Create planned meal failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Create planned meal error: {str(e)}")
        return False

def test_get_planned_meals():
    """Test GET /api/meals/planned/{user_id}?date=2026-02-10 - Get planned meals for date"""
    print(f"\n🔍 Testing GET /api/meals/planned/{TEST_USER_ID}?date={TEST_DATE} - Get planned meals...")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/meals/planned/{TEST_USER_ID}?date={TEST_DATE}",
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if "meals" in data and isinstance(data["meals"], list):
                print(f"✅ Get planned meals working correctly - Found {len(data['meals'])} meals")
                return True
            else:
                print(f"❌ Unexpected response format: {data}")
                return False
        else:
            print(f"❌ Get planned meals failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Get planned meals error: {str(e)}")
        return False

def test_update_planned_meal():
    """Test PUT /api/meals/planned/{meal_id} - Update a planned meal"""
    print(f"\n🔍 Testing PUT /api/meals/planned/{TEST_MEAL_ID} - Update planned meal...")
    
    payload = {
        "user_id": TEST_USER_ID,
        "meal": {
            "id": TEST_MEAL_ID,
            "name": "Updated Breakfast",
            "category": "breakfast",
            "calories": 500,
            "protein": 30,
            "carbs": 45,
            "fat": 18,
            "sugar": 12,
            "fiber": 6,
            "date": TEST_DATE
        }
    }
    
    try:
        response = requests.put(
            f"{BACKEND_URL}/meals/planned/{TEST_MEAL_ID}",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if "message" in data and "modified" in data:
                print("✅ Update planned meal working correctly")
                return True
            else:
                print(f"❌ Unexpected response format: {data}")
                return False
        else:
            print(f"❌ Update planned meal failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Update planned meal error: {str(e)}")
        return False

def test_mark_meal_cooked():
    """Test PUT /api/meals/planned/{meal_id}/cook - Mark meal as cooked"""
    print(f"\n🔍 Testing PUT /api/meals/planned/{TEST_MEAL_ID}/cook - Mark meal as cooked...")
    
    payload = {
        "user_id": TEST_USER_ID
    }
    
    try:
        response = requests.put(
            f"{BACKEND_URL}/meals/planned/{TEST_MEAL_ID}/cook",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if "message" in data and "modified" in data:
                print("✅ Mark meal as cooked working correctly")
                return True
            else:
                print(f"❌ Unexpected response format: {data}")
                return False
        else:
            print(f"❌ Mark meal as cooked failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Mark meal as cooked error: {str(e)}")
        return False

def test_log_custom_meal():
    """Test POST /api/food/log-custom - Log a custom meal to nutrition tracker"""
    print("\n🔍 Testing POST /api/food/log-custom - Log custom meal...")
    
    payload = {
        "user_id": TEST_USER_ID,
        "meal_name": "Grilled Chicken",
        "meal_category": "lunch",
        "calories": 350,
        "protein": 45,
        "carbs": 5,
        "fat": 12,
        "sugar": 0,
        "fiber": 0
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/food/log-custom",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if "message" in data and "meal_id" in data:
                print("✅ Log custom meal working correctly")
                print(f"   Meal ID: {data['meal_id']}")
                return True
            else:
                print(f"❌ Unexpected response format: {data}")
                return False
        else:
            print(f"❌ Log custom meal failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Log custom meal error: {str(e)}")
        return False

def test_add_grocery_item():
    """Test POST /api/meals/groceries - Add a grocery item"""
    print("\n🔍 Testing POST /api/meals/groceries - Add grocery item...")
    
    payload = {
        "user_id": TEST_USER_ID,
        "item": {
            "id": TEST_GROCERY_ID,
            "name": "Chicken Breast",
            "quantity": "2 lbs",
            "category": "Meat & Seafood",
            "checked": False
        }
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/meals/groceries",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if "message" in data and data["message"] == "Item added":
                print("✅ Add grocery item working correctly")
                return True
            else:
                print(f"❌ Unexpected response format: {data}")
                return False
        else:
            print(f"❌ Add grocery item failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Add grocery item error: {str(e)}")
        return False

def test_get_grocery_list():
    """Test GET /api/meals/groceries/{user_id} - Get grocery list"""
    print(f"\n🔍 Testing GET /api/meals/groceries/{TEST_USER_ID} - Get grocery list...")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/meals/groceries/{TEST_USER_ID}",
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if "items" in data and isinstance(data["items"], list):
                print(f"✅ Get grocery list working correctly - Found {len(data['items'])} items")
                return True
            else:
                print(f"❌ Unexpected response format: {data}")
                return False
        else:
            print(f"❌ Get grocery list failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Get grocery list error: {str(e)}")
        return False

def test_toggle_grocery_item():
    """Test PUT /api/meals/groceries/{item_id}/toggle - Toggle grocery checked"""
    print(f"\n🔍 Testing PUT /api/meals/groceries/{TEST_GROCERY_ID}/toggle - Toggle grocery item...")
    
    payload = {
        "user_id": TEST_USER_ID
    }
    
    try:
        response = requests.put(
            f"{BACKEND_URL}/meals/groceries/{TEST_GROCERY_ID}/toggle",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if "message" in data and data["message"] == "Item toggled":
                print("✅ Toggle grocery item working correctly")
                return True
            else:
                print(f"❌ Unexpected response format: {data}")
                return False
        else:
            print(f"❌ Toggle grocery item failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Toggle grocery item error: {str(e)}")
        return False

def test_get_saved_recipes():
    """Test GET /api/meals/recipes/{user_id} - Get saved recipes"""
    print(f"\n🔍 Testing GET /api/meals/recipes/{TEST_USER_ID} - Get saved recipes...")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/meals/recipes/{TEST_USER_ID}",
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if "recipes" in data and isinstance(data["recipes"], list):
                print(f"✅ Get saved recipes working correctly - Found {len(data['recipes'])} recipes")
                return True
            else:
                print(f"❌ Unexpected response format: {data}")
                return False
        else:
            print(f"❌ Get saved recipes failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Get saved recipes error: {str(e)}")
        return False

def test_delete_planned_meal():
    """Test DELETE /api/meals/planned/{meal_id}?user_id={user_id} - Delete planned meal"""
    print(f"\n🔍 Testing DELETE /api/meals/planned/{TEST_MEAL_ID}?user_id={TEST_USER_ID} - Delete planned meal...")
    
    try:
        response = requests.delete(
            f"{BACKEND_URL}/meals/planned/{TEST_MEAL_ID}?user_id={TEST_USER_ID}",
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if "message" in data and "deleted" in data:
                print("✅ Delete planned meal working correctly")
                return True
            else:
                print(f"❌ Unexpected response format: {data}")
                return False
        else:
            print(f"❌ Delete planned meal failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Delete planned meal error: {str(e)}")
        return False

def verify_custom_meal_storage():
    """Verify that custom meal was stored with flat fields"""
    print(f"\n🔍 Verifying custom meal storage - checking if meal appears in nutrition tracking...")
    
    try:
        # Get meals for the user to verify the custom meal was stored correctly
        response = requests.get(
            f"{BACKEND_URL}/meals/{TEST_USER_ID}?days=1",
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if "meals" in data:
                meals = data["meals"]
                custom_meals = [m for m in meals if m.get("food_name") == "Grilled Chicken"]
                
                if custom_meals:
                    meal = custom_meals[0]
                    print(f"✅ Custom meal found in nutrition tracking")
                    print(f"   Food Name: {meal.get('food_name')}")
                    print(f"   Calories: {meal.get('calories')}")
                    print(f"   Protein: {meal.get('protein')}")
                    print(f"   Carbs: {meal.get('carbs')}")
                    print(f"   Fat: {meal.get('fat')}")
                    
                    # Verify flat fields (not nested in analysis object)
                    if all(key in meal for key in ['calories', 'protein', 'carbs', 'fat']):
                        print("✅ Meal stored with flat fields (not nested in analysis object)")
                        return True
                    else:
                        print("❌ Meal not stored with proper flat fields")
                        return False
                else:
                    print("❌ Custom meal not found in nutrition tracking")
                    return False
            else:
                print(f"❌ Unexpected response format: {data}")
                return False
        else:
            print(f"❌ Failed to get meals: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Verification error: {str(e)}")
        return False

def main():
    """Run all meal planner endpoint tests"""
    print("🚀 FitTrax+ Meal Planner Backend Testing")
    print("=" * 50)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test User ID: {TEST_USER_ID}")
    print(f"Test Date: {TEST_DATE}")
    print("=" * 50)
    
    # Track test results
    tests = []
    
    # Health check first
    tests.append(("Health Check", test_health_endpoint()))
    
    # Test all meal planner endpoints in order
    tests.append(("Create Planned Meal", test_create_planned_meal()))
    tests.append(("Get Planned Meals", test_get_planned_meals()))
    tests.append(("Update Planned Meal", test_update_planned_meal()))
    tests.append(("Mark Meal Cooked", test_mark_meal_cooked()))
    tests.append(("Log Custom Meal", test_log_custom_meal()))
    tests.append(("Verify Custom Meal Storage", verify_custom_meal_storage()))
    tests.append(("Add Grocery Item", test_add_grocery_item()))
    tests.append(("Get Grocery List", test_get_grocery_list()))
    tests.append(("Toggle Grocery Item", test_toggle_grocery_item()))
    tests.append(("Get Saved Recipes", test_get_saved_recipes()))
    tests.append(("Delete Planned Meal", test_delete_planned_meal()))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    passed = 0
    failed = 0
    
    for test_name, result in tests:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:<30} {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print("=" * 50)
    print(f"Total Tests: {len(tests)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Success Rate: {(passed/len(tests)*100):.1f}%")
    
    if failed == 0:
        print("\n🎉 ALL MEAL PLANNER ENDPOINTS WORKING CORRECTLY!")
        return True
    else:
        print(f"\n⚠️  {failed} ENDPOINT(S) NEED ATTENTION")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)