#!/usr/bin/env python3
"""
Comprehensive Meal Planner Backend Testing for FitTrax+
Testing all meal planner endpoints with specific test data as requested.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://fitness-diary-19.preview.emergentagent.com/api"
TEST_USER_ID = "test_comprehensive_user"
TEST_DATE = "2026-02-13"

# Test data
TEST_MEAL_DATA = {
    "id": "test_meal_001",
    "name": "Test Chicken Salad",
    "category": "lunch",
    "calories": 450,
    "protein": 35,
    "carbs": 20,
    "fat": 25,
    "sugar": 5,
    "fiber": 8,
    "date": TEST_DATE
}

UPDATED_MEAL_DATA = {
    "id": "test_meal_001",
    "name": "Updated Salad",
    "category": "lunch",
    "calories": 500,
    "protein": 40,
    "carbs": 25,
    "fat": 28,
    "sugar": 6,
    "fiber": 10,
    "date": TEST_DATE
}

CUSTOM_MEAL_DATA = {
    "user_id": TEST_USER_ID,
    "meal_name": "Test Logged Meal",
    "meal_category": "dinner",
    "calories": 600,
    "protein": 40,
    "carbs": 50,
    "fat": 30,
    "sugar": 10,
    "fiber": 5
}

GROCERY_ITEM_DATA = {
    "id": "grocery_test_001",
    "name": "Chicken Breast",
    "quantity": "2 lbs",
    "category": "Meat & Seafood",
    "checked": False
}

class MealPlannerTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.test_results = []
        self.meal_id_created = None
        self.custom_meal_id = None
        self.grocery_item_id = None

    def log_test(self, test_name, success, details="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data
        })

    def test_health_check(self):
        """Test health endpoint first"""
        try:
            response = self.session.get(f"{BASE_URL}/health")
            if response.status_code == 200:
                data = response.json()
                self.log_test("Health Check", True, f"Status: {data.get('status')}")
                return True
            else:
                self.log_test("Health Check", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")
            return False

    def test_create_planned_meal(self):
        """Test POST /api/meals/planned - Create a planned meal"""
        try:
            payload = {
                "user_id": TEST_USER_ID,
                "meal": TEST_MEAL_DATA
            }
            
            response = self.session.post(f"{BASE_URL}/meals/planned", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                self.meal_id_created = data.get("meal_id", TEST_MEAL_DATA["id"])
                self.log_test("Create Planned Meal", True, 
                             f"Created meal with ID: {self.meal_id_created}")
                return True
            else:
                self.log_test("Create Planned Meal", False, 
                             f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Create Planned Meal", False, f"Exception: {str(e)}")
            return False

    def test_get_planned_meals(self):
        """Test GET /api/meals/planned/{user_id}?date=2026-02-13 - Get planned meals"""
        try:
            response = self.session.get(f"{BASE_URL}/meals/planned/{TEST_USER_ID}?date={TEST_DATE}")
            
            if response.status_code == 200:
                data = response.json()
                meals = data.get("meals", [])
                self.log_test("Get Planned Meals", True, 
                             f"Retrieved {len(meals)} planned meals for {TEST_DATE}")
                return True
            else:
                self.log_test("Get Planned Meals", False, 
                             f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Get Planned Meals", False, f"Exception: {str(e)}")
            return False

    def test_update_planned_meal(self):
        """Test PUT /api/meals/planned/{meal_id} - Update planned meal"""
        if not self.meal_id_created:
            self.log_test("Update Planned Meal", False, "No meal ID available from create test")
            return False
            
        try:
            payload = {
                "user_id": TEST_USER_ID,
                "meal": UPDATED_MEAL_DATA
            }
            
            response = self.session.put(f"{BASE_URL}/meals/planned/{self.meal_id_created}", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                modified_count = data.get("modified", 0)
                self.log_test("Update Planned Meal", True, 
                             f"Updated meal, modified count: {modified_count}")
                return True
            else:
                self.log_test("Update Planned Meal", False, 
                             f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Update Planned Meal", False, f"Exception: {str(e)}")
            return False

    def test_mark_meal_cooked(self):
        """Test PUT /api/meals/planned/{meal_id}/cook - Mark meal as cooked"""
        if not self.meal_id_created:
            self.log_test("Mark Meal Cooked", False, "No meal ID available from create test")
            return False
            
        try:
            payload = {"user_id": TEST_USER_ID}
            
            response = self.session.put(f"{BASE_URL}/meals/planned/{self.meal_id_created}/cook", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                modified_count = data.get("modified", 0)
                self.log_test("Mark Meal Cooked", True, 
                             f"Marked meal as cooked, modified count: {modified_count}")
                return True
            else:
                self.log_test("Mark Meal Cooked", False, 
                             f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Mark Meal Cooked", False, f"Exception: {str(e)}")
            return False

    def test_delete_planned_meal(self):
        """Test DELETE /api/meals/planned/{meal_id}?user_id={user_id} - Delete meal"""
        if not self.meal_id_created:
            self.log_test("Delete Planned Meal", False, "No meal ID available from create test")
            return False
            
        try:
            response = self.session.delete(f"{BASE_URL}/meals/planned/{self.meal_id_created}?user_id={TEST_USER_ID}")
            
            if response.status_code == 200:
                data = response.json()
                deleted_count = data.get("deleted", 0)
                self.log_test("Delete Planned Meal", True, 
                             f"Deleted meal, deleted count: {deleted_count}")
                return True
            else:
                self.log_test("Delete Planned Meal", False, 
                             f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Delete Planned Meal", False, f"Exception: {str(e)}")
            return False

    def test_log_custom_meal(self):
        """Test POST /api/food/log-custom - Log custom meal to nutrition"""
        try:
            response = self.session.post(f"{BASE_URL}/food/log-custom", json=CUSTOM_MEAL_DATA)
            
            if response.status_code == 200:
                data = response.json()
                self.custom_meal_id = data.get("meal_id")
                self.log_test("Log Custom Meal", True, 
                             f"Logged custom meal with ID: {self.custom_meal_id}")
                return True
            else:
                self.log_test("Log Custom Meal", False, 
                             f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Log Custom Meal", False, f"Exception: {str(e)}")
            return False

    def test_delete_nutrition_log(self):
        """Test DELETE /api/meals/nutrition-log/{meal_id}?user_id={user_id} - Delete from nutrition log"""
        if not self.custom_meal_id:
            self.log_test("Delete Nutrition Log", False, "No custom meal ID available from log test")
            return False
            
        try:
            response = self.session.delete(f"{BASE_URL}/meals/nutrition-log/{self.custom_meal_id}?user_id={TEST_USER_ID}")
            
            if response.status_code == 200:
                data = response.json()
                deleted_count = data.get("deleted_count", 0)
                self.log_test("Delete Nutrition Log", True, 
                             f"Deleted nutrition log, deleted count: {deleted_count}")
                return True
            else:
                self.log_test("Delete Nutrition Log", False, 
                             f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Delete Nutrition Log", False, f"Exception: {str(e)}")
            return False

    def test_add_grocery_item(self):
        """Test POST /api/meals/groceries - Add grocery item"""
        try:
            payload = {
                "user_id": TEST_USER_ID,
                "item": GROCERY_ITEM_DATA
            }
            
            response = self.session.post(f"{BASE_URL}/meals/groceries", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                self.grocery_item_id = data.get("item_id", GROCERY_ITEM_DATA["id"])
                self.log_test("Add Grocery Item", True, 
                             f"Added grocery item with ID: {self.grocery_item_id}")
                return True
            else:
                self.log_test("Add Grocery Item", False, 
                             f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Add Grocery Item", False, f"Exception: {str(e)}")
            return False

    def test_get_grocery_list(self):
        """Test GET /api/meals/groceries/{user_id} - Get grocery list"""
        try:
            response = self.session.get(f"{BASE_URL}/meals/groceries/{TEST_USER_ID}")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get("items", [])
                self.log_test("Get Grocery List", True, 
                             f"Retrieved {len(items)} grocery items")
                return True
            else:
                self.log_test("Get Grocery List", False, 
                             f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Get Grocery List", False, f"Exception: {str(e)}")
            return False

    def test_toggle_grocery_item(self):
        """Test PUT /api/meals/groceries/{item_id}/toggle - Toggle checked status"""
        if not self.grocery_item_id:
            self.log_test("Toggle Grocery Item", False, "No grocery item ID available from add test")
            return False
            
        try:
            payload = {"user_id": TEST_USER_ID}
            
            response = self.session.put(f"{BASE_URL}/meals/groceries/{self.grocery_item_id}/toggle", json=payload)
            
            if response.status_code == 200:
                self.log_test("Toggle Grocery Item", True, "Toggled grocery item checked status")
                return True
            else:
                self.log_test("Toggle Grocery Item", False, 
                             f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Toggle Grocery Item", False, f"Exception: {str(e)}")
            return False

    def test_clear_checked_groceries(self):
        """Test POST /api/meals/groceries/clear-checked - Clear checked items"""
        if not self.grocery_item_id:
            self.log_test("Clear Checked Groceries", False, "No grocery item ID available")
            return False
            
        try:
            payload = {
                "user_id": TEST_USER_ID,
                "item_ids": [self.grocery_item_id]
            }
            
            response = self.session.post(f"{BASE_URL}/meals/groceries/clear-checked", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                deleted_count = data.get("deleted", 0)
                self.log_test("Clear Checked Groceries", True, 
                             f"Cleared checked items, deleted count: {deleted_count}")
                return True
            else:
                self.log_test("Clear Checked Groceries", False, 
                             f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Clear Checked Groceries", False, f"Exception: {str(e)}")
            return False

    def test_get_recipes(self):
        """Test GET /api/meals/recipes/{user_id} - Get saved recipes"""
        try:
            response = self.session.get(f"{BASE_URL}/meals/recipes/{TEST_USER_ID}")
            
            if response.status_code == 200:
                data = response.json()
                recipes = data.get("recipes", [])
                self.log_test("Get Recipes", True, 
                             f"Retrieved {len(recipes)} saved recipes")
                return True
            else:
                self.log_test("Get Recipes", False, 
                             f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Get Recipes", False, f"Exception: {str(e)}")
            return False

    def test_delete_recipe(self):
        """Test DELETE /api/meals/recipes/{recipe_id}?user_id={user_id} - Delete recipe (skip if no recipes)"""
        try:
            # First get recipes to see if any exist
            response = self.session.get(f"{BASE_URL}/meals/recipes/{TEST_USER_ID}")
            
            if response.status_code == 200:
                data = response.json()
                recipes = data.get("recipes", [])
                
                if recipes:
                    # Try to delete the first recipe
                    recipe_id = recipes[0].get("id")
                    if recipe_id:
                        delete_response = self.session.delete(f"{BASE_URL}/meals/recipes/{recipe_id}?user_id={TEST_USER_ID}")
                        
                        if delete_response.status_code == 200:
                            delete_data = delete_response.json()
                            deleted_count = delete_data.get("deleted_count", 0)
                            self.log_test("Delete Recipe", True, 
                                         f"Deleted recipe, deleted count: {deleted_count}")
                        else:
                            self.log_test("Delete Recipe", False, 
                                         f"Delete status: {delete_response.status_code}", delete_response.text)
                    else:
                        self.log_test("Delete Recipe", False, "No recipe ID found in recipe data")
                else:
                    self.log_test("Delete Recipe", True, "No recipes to delete (skipped)")
                return True
            else:
                self.log_test("Delete Recipe", False, 
                             f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Delete Recipe", False, f"Exception: {str(e)}")
            return False

    def test_dashboard_integration(self):
        """Test GET /api/dashboard/{user_id}?local_date=2026-02-13 - Verify dashboard loads with nutrition data"""
        try:
            response = self.session.get(f"{BASE_URL}/dashboard/{TEST_USER_ID}?local_date={TEST_DATE}")
            
            if response.status_code == 200:
                data = response.json()
                today_data = data.get("today", {})
                
                # Check if dashboard has nutrition data structure
                required_fields = ["calories_consumed", "protein", "carbs", "fat", "sugar", "fiber"]
                missing_fields = [field for field in required_fields if field not in today_data]
                
                if not missing_fields:
                    self.log_test("Dashboard Integration", True, 
                                 f"Dashboard loaded with nutrition data for {TEST_DATE}")
                else:
                    self.log_test("Dashboard Integration", False, 
                                 f"Missing nutrition fields: {missing_fields}")
                return True
            else:
                self.log_test("Dashboard Integration", False, 
                             f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Dashboard Integration", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run comprehensive meal planner endpoint tests"""
        print("=" * 80)
        print("COMPREHENSIVE MEAL PLANNER BACKEND TESTING FOR FITTRAX+")
        print("=" * 80)
        print(f"Base URL: {BASE_URL}")
        print(f"Test User ID: {TEST_USER_ID}")
        print(f"Test Date: {TEST_DATE}")
        print("=" * 80)
        
        # Test sequence as specified in review request
        tests = [
            # Health check first
            self.test_health_check,
            
            # 1. PLANNED MEALS CRUD
            self.test_create_planned_meal,
            self.test_get_planned_meals,
            self.test_update_planned_meal,
            self.test_mark_meal_cooked,
            self.test_delete_planned_meal,
            
            # 2. NUTRITION LOG
            self.test_log_custom_meal,
            self.test_delete_nutrition_log,
            
            # 3. GROCERY LIST
            self.test_add_grocery_item,
            self.test_get_grocery_list,
            self.test_toggle_grocery_item,
            self.test_clear_checked_groceries,
            
            # 4. RECIPES
            self.test_get_recipes,
            self.test_delete_recipe,
            
            # 5. DASHBOARD INTEGRATION
            self.test_dashboard_integration
        ]
        
        # Run all tests
        for test in tests:
            test()
            print()  # Add spacing between tests
        
        # Summary
        print("=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        # List failed tests
        failed_tests = [result for result in self.test_results if not result["success"]]
        if failed_tests:
            print("\nFAILED TESTS:")
            for test in failed_tests:
                print(f"❌ {test['test']}: {test['details']}")
        else:
            print("\n🎉 ALL TESTS PASSED!")
        
        print("=" * 80)
        
        return passed == total

if __name__ == "__main__":
    tester = MealPlannerTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)