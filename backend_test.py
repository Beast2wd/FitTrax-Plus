#!/usr/bin/env python3
"""
FitTraxx Backend API Comprehensive Test Suite
Tests all backend endpoints for the fitness tracker application
"""

import requests
import json
import base64
import time
from datetime import datetime, timedelta
from typing import Dict, Any
import os

# Configuration
BASE_URL = "https://fittraxx.preview.emergentagent.com/api"
TEST_USER_ID = "test_user_fittraxx"

class FitTraxxAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.test_user_id = TEST_USER_ID
        self.session = requests.Session()
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None) -> tuple:
        """Make HTTP request and return (success, response, error_msg)"""
        try:
            url = f"{self.base_url}{endpoint}"
            
            if method.upper() == "GET":
                response = self.session.get(url, params=params, timeout=30)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, timeout=30)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, params=params, timeout=30)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, timeout=30)
            else:
                return False, None, f"Unsupported method: {method}"
                
            return True, response, None
            
        except requests.exceptions.RequestException as e:
            return False, None, str(e)
    
    def create_sample_food_image(self) -> str:
        """Create a sample food image in base64 format for testing"""
        # Create a more realistic test image that looks like food
        import io
        try:
            from PIL import Image, ImageDraw
            # Create a simple test image that looks like food (apple)
            img = Image.new('RGB', (200, 200), color='white')
            draw = ImageDraw.Draw(img)
            
            # Draw a simple apple shape
            draw.ellipse([50, 50, 150, 150], fill='red', outline='darkred')
            draw.ellipse([90, 40, 110, 60], fill='green')  # stem
            
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_data = buffer.getvalue()
            return base64.b64encode(img_data).decode('utf-8')
        except ImportError:
            # Fallback: create a minimal PNG base64 string that represents food
            # This is a small red square that could represent food
            return "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8/5+hnoEIwDiqkL4KAcT9GO0U4BxoAAAAAElFTkSuQmCC"

    def test_health_check(self):
        """Test health check endpoint"""
        success, response, error = self.make_request("GET", "/health")
        
        if not success:
            self.log_test("Health Check", False, f"Request failed: {error}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                self.log_test("Health Check", True, "API is healthy")
                return True
            else:
                self.log_test("Health Check", False, f"Unexpected response: {data}")
                return False
        else:
            self.log_test("Health Check", False, f"HTTP {response.status_code}: {response.text}")
            return False

    def test_user_profile(self):
        """Test user profile creation and retrieval"""
        # Test profile creation
        profile_data = {
            "user_id": self.test_user_id,
            "name": "John Doe",
            "age": 30,
            "gender": "male",
            "height_feet": 6,
            "height_inches": 0,
            "weight": 180.0,
            "goal_weight": 170.0,
            "activity_level": "moderate"
        }
        
        success, response, error = self.make_request("POST", "/user/profile", profile_data)
        
        if not success:
            self.log_test("User Profile Creation", False, f"Request failed: {error}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            profile = data.get("profile", {})
            daily_calories = profile.get("daily_calorie_goal")
            
            if daily_calories and daily_calories > 0:
                self.log_test("User Profile Creation", True, f"Profile created with {daily_calories} cal/day goal", data)
            else:
                self.log_test("User Profile Creation", False, "Daily calorie goal not calculated properly")
                return False
        else:
            self.log_test("User Profile Creation", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
        # Test profile retrieval
        success, response, error = self.make_request("GET", f"/user/profile/{self.test_user_id}")
        
        if not success:
            self.log_test("User Profile Retrieval", False, f"Request failed: {error}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            if data.get("user_id") == self.test_user_id:
                self.log_test("User Profile Retrieval", True, "Profile retrieved successfully", data)
                return True
            else:
                self.log_test("User Profile Retrieval", False, "Profile data mismatch")
                return False
        else:
            self.log_test("User Profile Retrieval", False, f"HTTP {response.status_code}: {response.text}")
            return False

    def test_food_analysis_ai(self):
        """Test AI-powered food analysis"""
        # Create sample image
        sample_image = self.create_sample_food_image()
        
        food_request = {
            "user_id": self.test_user_id,
            "image_base64": sample_image,
            "meal_category": "lunch"
        }
        
        success, response, error = self.make_request("POST", "/analyze-food", food_request)
        
        if not success:
            self.log_test("Food Analysis AI", False, f"Request failed: {error}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            meal = data.get("meal", {})
            analysis = data.get("analysis", {})
            
            # Check if analysis contains required fields
            required_fields = ["food_name", "calories", "protein", "carbs", "fat", "portion_size"]
            missing_fields = [field for field in required_fields if field not in analysis]
            
            if missing_fields:
                self.log_test("Food Analysis AI", False, f"Missing analysis fields: {missing_fields}")
                return False
                
            # Check if meal was saved with proper ID format
            meal_id = meal.get("meal_id", "")
            if meal_id.startswith("meal_") and meal.get("user_id") == self.test_user_id:
                self.log_test("Food Analysis AI", True, f"Food analyzed: {analysis.get('food_name')} - {analysis.get('calories')} cal", data)
                return True
            else:
                self.log_test("Food Analysis AI", False, "Meal not saved properly")
                return False
        else:
            self.log_test("Food Analysis AI", False, f"HTTP {response.status_code}: {response.text}")
            return False

    def test_meals_crud(self):
        """Test meals CRUD operations"""
        # Test getting meals (should include the one from food analysis)
        success, response, error = self.make_request("GET", f"/meals/{self.test_user_id}", params={"days": 7})
        
        if not success:
            self.log_test("Meals Retrieval", False, f"Request failed: {error}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            meals = data.get("meals", [])
            self.log_test("Meals Retrieval", True, f"Retrieved {len(meals)} meals", data)
            
            # Test meal deletion if we have meals
            if meals:
                meal_to_delete = meals[0]["meal_id"]
                success, response, error = self.make_request("DELETE", f"/meals/{meal_to_delete}")
                
                if not success:
                    self.log_test("Meal Deletion", False, f"Request failed: {error}")
                    return False
                    
                if response.status_code == 200:
                    self.log_test("Meal Deletion", True, "Meal deleted successfully")
                    return True
                else:
                    self.log_test("Meal Deletion", False, f"HTTP {response.status_code}: {response.text}")
                    return False
            else:
                self.log_test("Meal Deletion", True, "No meals to delete (test skipped)")
                return True
        else:
            self.log_test("Meals Retrieval", False, f"HTTP {response.status_code}: {response.text}")
            return False

    def test_workouts_crud(self):
        """Test workouts CRUD operations"""
        # Create a workout
        workout_data = {
            "workout_id": f"workout_{int(time.time() * 1000)}",
            "user_id": self.test_user_id,
            "workout_type": "cardio",
            "duration": 30,
            "calories_burned": 250.0,
            "notes": "Morning run",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        success, response, error = self.make_request("POST", "/workouts", workout_data)
        
        if not success:
            self.log_test("Workout Creation", False, f"Request failed: {error}")
            return False
            
        if response.status_code == 200:
            self.log_test("Workout Creation", True, "Workout created successfully")
        else:
            self.log_test("Workout Creation", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
        # Test getting workouts
        success, response, error = self.make_request("GET", f"/workouts/{self.test_user_id}", params={"days": 7})
        
        if not success:
            self.log_test("Workouts Retrieval", False, f"Request failed: {error}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            workouts = data.get("workouts", [])
            self.log_test("Workouts Retrieval", True, f"Retrieved {len(workouts)} workouts", data)
            
            # Test workout deletion
            if workouts:
                workout_to_delete = workouts[0]["workout_id"]
                success, response, error = self.make_request("DELETE", f"/workouts/{workout_to_delete}")
                
                if not success:
                    self.log_test("Workout Deletion", False, f"Request failed: {error}")
                    return False
                    
                if response.status_code == 200:
                    self.log_test("Workout Deletion", True, "Workout deleted successfully")
                    return True
                else:
                    self.log_test("Workout Deletion", False, f"HTTP {response.status_code}: {response.text}")
                    return False
            else:
                self.log_test("Workout Deletion", True, "No workouts to delete (test skipped)")
                return True
        else:
            self.log_test("Workouts Retrieval", False, f"HTTP {response.status_code}: {response.text}")
            return False

    def test_water_tracking(self):
        """Test water intake tracking"""
        # Add water intake
        water_data = {
            "water_id": f"water_{int(time.time() * 1000)}",
            "user_id": self.test_user_id,
            "amount": 16.0,  # 16 oz
            "timestamp": datetime.utcnow().isoformat()
        }
        
        success, response, error = self.make_request("POST", "/water", water_data)
        
        if not success:
            self.log_test("Water Intake Addition", False, f"Request failed: {error}")
            return False
            
        if response.status_code == 200:
            self.log_test("Water Intake Addition", True, "Water intake added successfully")
        else:
            self.log_test("Water Intake Addition", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
        # Get water intake
        success, response, error = self.make_request("GET", f"/water/{self.test_user_id}", params={"days": 7})
        
        if not success:
            self.log_test("Water Intake Retrieval", False, f"Request failed: {error}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            water_intake = data.get("water_intake", [])
            self.log_test("Water Intake Retrieval", True, f"Retrieved {len(water_intake)} water entries", data)
            return True
        else:
            self.log_test("Water Intake Retrieval", False, f"HTTP {response.status_code}: {response.text}")
            return False

    def test_heart_rate_tracking(self):
        """Test heart rate tracking and zones"""
        # Add heart rate
        hr_data = {
            "heart_rate_id": f"hr_{int(time.time() * 1000)}",
            "user_id": self.test_user_id,
            "bpm": 75,
            "activity_type": "resting",
            "notes": "Morning measurement",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        success, response, error = self.make_request("POST", "/heart-rate", hr_data)
        
        if not success:
            self.log_test("Heart Rate Addition", False, f"Request failed: {error}")
            return False
            
        if response.status_code == 200:
            self.log_test("Heart Rate Addition", True, "Heart rate added successfully")
        else:
            self.log_test("Heart Rate Addition", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
        # Test BPM validation (should fail)
        invalid_hr_data = hr_data.copy()
        invalid_hr_data["bpm"] = 300  # Invalid BPM
        invalid_hr_data["heart_rate_id"] = f"hr_invalid_{int(time.time() * 1000)}"
        
        success, response, error = self.make_request("POST", "/heart-rate", invalid_hr_data)
        
        if success and response.status_code == 400:
            self.log_test("Heart Rate Validation", True, "BPM validation working correctly")
        else:
            self.log_test("Heart Rate Validation", False, "BPM validation not working")
            
        # Get heart rate
        success, response, error = self.make_request("GET", f"/heart-rate/{self.test_user_id}", params={"days": 7})
        
        if not success:
            self.log_test("Heart Rate Retrieval", False, f"Request failed: {error}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            heart_rates = data.get("heart_rates", [])
            self.log_test("Heart Rate Retrieval", True, f"Retrieved {len(heart_rates)} heart rate entries", data)
        else:
            self.log_test("Heart Rate Retrieval", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
        # Test heart rate zones
        success, response, error = self.make_request("GET", f"/heart-rate/zones/{self.test_user_id}")
        
        if not success:
            self.log_test("Heart Rate Zones", False, f"Request failed: {error}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            required_zones = ["max_heart_rate", "resting", "fat_burn", "cardio", "peak"]
            missing_zones = [zone for zone in required_zones if zone not in data]
            
            if missing_zones:
                self.log_test("Heart Rate Zones", False, f"Missing zones: {missing_zones}")
                return False
            else:
                max_hr = data.get("max_heart_rate")
                expected_max_hr = 220 - 30  # Age from profile
                if max_hr == expected_max_hr:
                    self.log_test("Heart Rate Zones", True, f"Zones calculated correctly (Max HR: {max_hr})", data)
                    return True
                else:
                    self.log_test("Heart Rate Zones", False, f"Max HR calculation incorrect: {max_hr} vs expected {expected_max_hr}")
                    return False
        else:
            self.log_test("Heart Rate Zones", False, f"HTTP {response.status_code}: {response.text}")
            return False

    def test_workout_plans(self):
        """Test workout plans functionality"""
        # Initialize workout plans
        success, response, error = self.make_request("POST", "/workout-plans/init")
        
        if not success:
            self.log_test("Workout Plans Initialization", False, f"Request failed: {error}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            self.log_test("Workout Plans Initialization", True, f"Plans initialized: {data.get('message')}")
        else:
            self.log_test("Workout Plans Initialization", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
        # Get all workout plans
        success, response, error = self.make_request("GET", "/workout-plans")
        
        if not success:
            self.log_test("Workout Plans Retrieval", False, f"Request failed: {error}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            plans = data.get("plans", [])
            if len(plans) >= 4:  # Should have 4 default plans
                self.log_test("Workout Plans Retrieval", True, f"Retrieved {len(plans)} workout plans")
                
                # Test filtered retrieval
                success, response, error = self.make_request("GET", "/workout-plans", params={"level": "beginner", "goal": "weight_loss"})
                
                if success and response.status_code == 200:
                    filtered_data = response.json()
                    filtered_plans = filtered_data.get("plans", [])
                    self.log_test("Workout Plans Filtering", True, f"Filtered to {len(filtered_plans)} plans")
                else:
                    self.log_test("Workout Plans Filtering", False, "Filter not working")
                    
                # Test getting specific plan
                if plans:
                    plan_id = plans[0]["plan_id"]
                    success, response, error = self.make_request("GET", f"/workout-plans/{plan_id}")
                    
                    if success and response.status_code == 200:
                        plan_data = response.json()
                        self.log_test("Single Workout Plan Retrieval", True, f"Retrieved plan: {plan_data.get('name')}")
                        return True
                    else:
                        self.log_test("Single Workout Plan Retrieval", False, "Failed to get specific plan")
                        return False
                        
            else:
                self.log_test("Workout Plans Retrieval", False, f"Expected 4+ plans, got {len(plans)}")
                return False
        else:
            self.log_test("Workout Plans Retrieval", False, f"HTTP {response.status_code}: {response.text}")
            return False

    def test_user_plans_management(self):
        """Test user plans management"""
        # First get a workout plan to start
        success, response, error = self.make_request("GET", "/workout-plans")
        
        if not success or response.status_code != 200:
            self.log_test("User Plans Management", False, "Cannot get workout plans for testing")
            return False
            
        plans = response.json().get("plans", [])
        if not plans:
            self.log_test("User Plans Management", False, "No workout plans available")
            return False
            
        # Start a workout plan
        user_plan_data = {
            "user_plan_id": f"user_plan_{int(time.time() * 1000)}",
            "user_id": self.test_user_id,
            "plan_id": plans[0]["plan_id"],
            "start_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "current_day": 1,
            "completed_days": [],
            "status": "active"
        }
        
        success, response, error = self.make_request("POST", "/user-plans", user_plan_data)
        
        if not success:
            self.log_test("User Plan Start", False, f"Request failed: {error}")
            return False
            
        if response.status_code == 200:
            self.log_test("User Plan Start", True, "User plan started successfully")
        else:
            self.log_test("User Plan Start", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
        # Get user plans
        success, response, error = self.make_request("GET", f"/user-plans/{self.test_user_id}", params={"status": "active"})
        
        if not success:
            self.log_test("User Plans Retrieval", False, f"Request failed: {error}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            user_plans = data.get("user_plans", [])
            self.log_test("User Plans Retrieval", True, f"Retrieved {len(user_plans)} active plans")
            
            # Test updating user plan progress
            if user_plans:
                user_plan_id = user_plans[0]["user_plan_id"]
                update_params = {
                    "current_day": 2,
                    "completed_days": "[1]",
                    "status": "active"
                }
                
                success, response, error = self.make_request("PUT", f"/user-plans/{user_plan_id}", params=update_params)
                
                if success and response.status_code == 200:
                    self.log_test("User Plan Update", True, "User plan progress updated")
                    return True
                else:
                    self.log_test("User Plan Update", False, f"Failed to update plan: {response.text if response else error}")
                    return False
            else:
                self.log_test("User Plan Update", True, "No plans to update (test skipped)")
                return True
        else:
            self.log_test("User Plans Retrieval", False, f"HTTP {response.status_code}: {response.text}")
            return False

    def test_scheduled_workouts(self):
        """Test scheduled workouts and reminders"""
        # Schedule a workout
        scheduled_data = {
            "scheduled_id": f"scheduled_{int(time.time() * 1000)}",
            "user_id": self.test_user_id,
            "workout_plan_id": None,
            "workout_day": None,
            "custom_workout": {"name": "Custom Cardio", "duration": 30},
            "scheduled_date": (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "scheduled_time": "08:00",
            "reminder_enabled": True,
            "reminder_minutes_before": 15,
            "completed": False,
            "notes": "Morning workout"
        }
        
        success, response, error = self.make_request("POST", "/scheduled-workouts", scheduled_data)
        
        if not success:
            self.log_test("Scheduled Workout Creation", False, f"Request failed: {error}")
            return False
            
        if response.status_code == 200:
            self.log_test("Scheduled Workout Creation", True, "Workout scheduled successfully")
        else:
            self.log_test("Scheduled Workout Creation", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
        # Get scheduled workouts
        success, response, error = self.make_request("GET", f"/scheduled-workouts/{self.test_user_id}")
        
        if not success:
            self.log_test("Scheduled Workouts Retrieval", False, f"Request failed: {error}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            scheduled_workouts = data.get("scheduled_workouts", [])
            self.log_test("Scheduled Workouts Retrieval", True, f"Retrieved {len(scheduled_workouts)} scheduled workouts")
            
            # Test updating scheduled workout
            if scheduled_workouts:
                scheduled_id = scheduled_workouts[0]["scheduled_id"]
                update_params = {
                    "completed": True,
                    "notes": "Workout completed successfully"
                }
                
                success, response, error = self.make_request("PUT", f"/scheduled-workouts/{scheduled_id}", params=update_params)
                
                if success and response.status_code == 200:
                    self.log_test("Scheduled Workout Update", True, "Scheduled workout updated")
                else:
                    self.log_test("Scheduled Workout Update", False, f"Failed to update: {response.text if response else error}")
                    
                # Test deletion
                success, response, error = self.make_request("DELETE", f"/scheduled-workouts/{scheduled_id}")
                
                if success and response.status_code == 200:
                    self.log_test("Scheduled Workout Deletion", True, "Scheduled workout deleted")
                else:
                    self.log_test("Scheduled Workout Deletion", False, f"Failed to delete: {response.text if response else error}")
                    
            # Test reminders
            success, response, error = self.make_request("GET", f"/scheduled-workouts/reminders/{self.test_user_id}")
            
            if success and response.status_code == 200:
                data = response.json()
                reminders = data.get("reminders", [])
                self.log_test("Workout Reminders", True, f"Retrieved {len(reminders)} reminders")
                return True
            else:
                self.log_test("Workout Reminders", False, f"Failed to get reminders: {response.text if response else error}")
                return False
        else:
            self.log_test("Scheduled Workouts Retrieval", False, f"HTTP {response.status_code}: {response.text}")
            return False

    def test_dashboard(self):
        """Test dashboard comprehensive data"""
        success, response, error = self.make_request("GET", f"/dashboard/{self.test_user_id}")
        
        if not success:
            self.log_test("Dashboard Data", False, f"Request failed: {error}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            
            # Check required sections
            required_sections = ["profile", "today", "weekly_meals", "weekly_workouts", "weekly_heart_rates"]
            missing_sections = [section for section in required_sections if section not in data]
            
            if missing_sections:
                self.log_test("Dashboard Data", False, f"Missing sections: {missing_sections}")
                return False
                
            # Check today's data structure
            today = data.get("today", {})
            required_today_fields = ["calories_consumed", "calories_burned", "net_calories", "calories_goal", 
                                   "protein", "carbs", "fat", "water_intake", "meals_count", "workouts_count"]
            missing_today_fields = [field for field in required_today_fields if field not in today]
            
            if missing_today_fields:
                self.log_test("Dashboard Data", False, f"Missing today fields: {missing_today_fields}")
                return False
                
            self.log_test("Dashboard Data", True, f"Dashboard complete - {today.get('meals_count', 0)} meals, {today.get('workouts_count', 0)} workouts today", data)
            return True
        else:
            self.log_test("Dashboard Data", False, f"HTTP {response.status_code}: {response.text}")
            return False

    def run_all_tests(self):
        """Run all backend tests"""
        print(f"\n🚀 Starting FitTraxx Backend API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print(f"👤 Test User: {self.test_user_id}")
        print("=" * 60)
        
        # Test order based on dependencies
        test_methods = [
            self.test_health_check,
            self.test_user_profile,
            self.test_food_analysis_ai,
            self.test_meals_crud,
            self.test_workouts_crud,
            self.test_water_tracking,
            self.test_heart_rate_tracking,
            self.test_workout_plans,
            self.test_user_plans_management,
            self.test_scheduled_workouts,
            self.test_dashboard
        ]
        
        passed = 0
        failed = 0
        
        for test_method in test_methods:
            try:
                result = test_method()
                if result:
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ FAIL {test_method.__name__}: Exception - {str(e)}")
                failed += 1
                
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {passed} passed, {failed} failed")
        
        if failed > 0:
            print("\n❌ Failed Tests:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
                    
        return failed == 0

if __name__ == "__main__":
    tester = FitTraxxAPITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ All tests passed! Backend API is working correctly.")
    else:
        print("\n❌ Some tests failed. Check the details above.")
        
    exit(0 if success else 1)