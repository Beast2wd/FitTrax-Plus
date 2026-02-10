#!/usr/bin/env python3
"""
Deep AI Food Scanner Endpoint Testing
Comprehensive testing of /api/analyze-food endpoint as requested
"""

import requests
import json
import time
import base64
from datetime import datetime
import sys

# Configuration
BASE_URL = "https://mealmaster-47.preview.emergentagent.com/api"
TEST_USER_ID = "food_scanner_test_user_2024"

# Test image - small 1x1 pixel PNG (valid base64)
TEST_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

def print_test_header(test_name):
    """Print formatted test header"""
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print(f"{'='*60}")

def print_result(success, message, details=None):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if details:
        print(f"Details: {details}")

def test_health_endpoint():
    """Test 1: Verify health endpoint is working"""
    print_test_header("Health Endpoint Check")
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                print_result(True, "Health endpoint working correctly", f"Response: {data}")
                return True
            else:
                print_result(False, "Health endpoint returned unexpected response", f"Got: {data}")
                return False
        else:
            print_result(False, f"Health endpoint returned status {response.status_code}", response.text[:200])
            return False
            
    except Exception as e:
        print_result(False, "Health endpoint failed", str(e))
        return False

def test_valid_food_analysis():
    """Test 2: Valid request with real base64 image"""
    print_test_header("Valid Food Analysis Request")
    
    payload = {
        "user_id": TEST_USER_ID,
        "image_base64": TEST_IMAGE_BASE64,
        "meal_category": "lunch"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/analyze-food", json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            required_keys = ["meal", "analysis"]
            meal_keys = ["meal_id", "user_id", "food_name", "calories", "protein", "carbs", "fat", "meal_category", "image_base64", "timestamp"]
            analysis_keys = ["food_name", "calories", "protein", "carbs", "fat", "portion_size"]
            
            missing_keys = []
            for key in required_keys:
                if key not in data:
                    missing_keys.append(key)
            
            for key in meal_keys:
                if key not in data.get("meal", {}):
                    missing_keys.append(f"meal.{key}")
                    
            for key in analysis_keys:
                if key not in data.get("analysis", {}):
                    missing_keys.append(f"analysis.{key}")
            
            if missing_keys:
                print_result(False, "Response missing required keys", f"Missing: {missing_keys}")
                return False, None
            
            meal_id = data["meal"]["meal_id"]
            food_name = data["analysis"]["food_name"]
            calories = data["analysis"]["calories"]
            
            print_result(True, f"Food analysis successful", 
                        f"Food: {food_name}, Calories: {calories}, Meal ID: {meal_id}")
            return True, meal_id
            
        else:
            print_result(False, f"Request failed with status {response.status_code}", response.text[:200])
            return False, None
            
    except Exception as e:
        print_result(False, "Request failed with exception", str(e))
        return False, None

def test_meal_categories():
    """Test 3: Test all meal categories"""
    print_test_header("All Meal Categories Test")
    
    categories = ["breakfast", "lunch", "dinner", "snack"]
    results = []
    
    for category in categories:
        print(f"\nTesting category: {category}")
        
        payload = {
            "user_id": f"{TEST_USER_ID}_{category}",
            "image_base64": TEST_IMAGE_BASE64,
            "meal_category": category
        }
        
        try:
            response = requests.post(f"{BASE_URL}/analyze-food", json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                returned_category = data["meal"]["meal_category"]
                
                if returned_category == category:
                    print_result(True, f"Category '{category}' processed correctly")
                    results.append(True)
                else:
                    print_result(False, f"Category mismatch", f"Expected: {category}, Got: {returned_category}")
                    results.append(False)
            else:
                print_result(False, f"Category '{category}' failed", f"Status: {response.status_code}")
                results.append(False)
                
        except Exception as e:
            print_result(False, f"Category '{category}' exception", str(e))
            results.append(False)
        
        # Small delay between requests
        time.sleep(1)
    
    success_count = sum(results)
    print(f"\nCategory Test Summary: {success_count}/{len(categories)} categories passed")
    return success_count == len(categories)

def test_input_validation():
    """Test 4: Input validation tests"""
    print_test_header("Input Validation Tests")
    
    test_cases = [
        {
            "name": "Missing user_id",
            "payload": {
                "image_base64": TEST_IMAGE_BASE64,
                "meal_category": "lunch"
            },
            "expected_status": [400, 422]
        },
        {
            "name": "Missing image_base64", 
            "payload": {
                "user_id": TEST_USER_ID,
                "meal_category": "lunch"
            },
            "expected_status": [400, 422]
        },
        {
            "name": "Invalid meal_category",
            "payload": {
                "user_id": TEST_USER_ID,
                "image_base64": TEST_IMAGE_BASE64,
                "meal_category": "invalid_category"
            },
            "expected_status": [200]  # Should be sanitized to "snack"
        },
        {
            "name": "Empty user_id",
            "payload": {
                "user_id": "",
                "image_base64": TEST_IMAGE_BASE64,
                "meal_category": "lunch"
            },
            "expected_status": [400, 422]
        }
    ]
    
    results = []
    
    for test_case in test_cases:
        print(f"\nTesting: {test_case['name']}")
        
        try:
            response = requests.post(f"{BASE_URL}/analyze-food", json=test_case["payload"], timeout=30)
            
            if response.status_code in test_case["expected_status"]:
                if test_case["name"] == "Invalid meal_category" and response.status_code == 200:
                    # Check if category was sanitized to "snack"
                    data = response.json()
                    if data["meal"]["meal_category"] == "snack":
                        print_result(True, "Invalid category sanitized to 'snack'")
                        results.append(True)
                    else:
                        print_result(False, "Category not sanitized properly", f"Got: {data['meal']['meal_category']}")
                        results.append(False)
                else:
                    print_result(True, f"Validation working correctly (status: {response.status_code})")
                    results.append(True)
            else:
                print_result(False, f"Unexpected status code", f"Expected: {test_case['expected_status']}, Got: {response.status_code}")
                results.append(False)
                
        except Exception as e:
            print_result(False, "Validation test exception", str(e))
            results.append(False)
        
        time.sleep(0.5)
    
    success_count = sum(results)
    print(f"\nValidation Test Summary: {success_count}/{len(test_cases)} tests passed")
    return success_count == len(test_cases)

def test_database_persistence(meal_id):
    """Test 6: Database persistence verification"""
    print_test_header("Database Persistence Test")
    
    if not meal_id:
        print_result(False, "No meal_id provided for persistence test")
        return False
    
    try:
        # Get meals for the test user
        response = requests.get(f"{BASE_URL}/meals/{TEST_USER_ID}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            meals = data.get("meals", [])
            
            # Look for our meal
            found_meal = None
            for meal in meals:
                if meal.get("meal_id") == meal_id:
                    found_meal = meal
                    break
            
            if found_meal:
                print_result(True, "Meal successfully saved to database", 
                           f"Found meal: {found_meal['food_name']} with {found_meal['calories']} calories")
                return True
            else:
                print_result(False, "Meal not found in database", f"Searched for meal_id: {meal_id}")
                return False
        else:
            print_result(False, f"Failed to retrieve meals", f"Status: {response.status_code}")
            return False
            
    except Exception as e:
        print_result(False, "Database persistence test failed", str(e))
        return False

def run_ai_food_scanner_tests():
    """Run all AI Food Scanner tests as requested"""
    print("🍎 AI FOOD SCANNER DEEP TESTING")
    print("=" * 60)
    print(f"Backend URL: {BASE_URL}")
    print(f"Test User ID: {TEST_USER_ID}")
    print(f"Test Time: {datetime.now().isoformat()}")
    
    results = []
    meal_id = None
    
    # Test 1: Health Check
    results.append(test_health_endpoint())
    
    # Test 2: Valid Food Analysis
    success, meal_id = test_valid_food_analysis()
    results.append(success)
    
    # Test 3: All Meal Categories
    results.append(test_meal_categories())
    
    # Test 4: Input Validation
    results.append(test_input_validation())
    
    # Test 5: Database Persistence
    if meal_id:
        results.append(test_database_persistence(meal_id))
    else:
        print_test_header("Database Persistence Test")
        print_result(False, "Skipped - no meal_id available from previous tests")
        results.append(False)
    
    # Summary
    print("\n" + "=" * 60)
    print("🏁 AI FOOD SCANNER TEST SUMMARY")
    print("=" * 60)
    
    test_names = [
        "Health Endpoint Check",
        "Valid Food Analysis Request", 
        "All Meal Categories Test",
        "Input Validation Tests",
        "Database Persistence Test"
    ]
    
    passed = sum(results)
    total = len(results)
    
    for i, (name, result) in enumerate(zip(test_names, results)):
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{i+1}. {name}: {status}")
    
    print(f"\nOVERALL RESULT: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - AI Food Scanner is fully functional!")
    else:
        print("⚠️  Some tests failed - see details above")
    
    return passed == total

if __name__ == "__main__":
    success = run_ai_food_scanner_tests()
    sys.exit(0 if success else 1)