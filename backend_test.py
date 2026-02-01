#!/usr/bin/env python3
"""
Comprehensive FitTrax+ API Testing Suite
Tests all critical endpoints for deployment readiness
"""

import requests
import json
import time
import base64
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import uuid

class FitTraxAPITester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.api_url = f"{self.base_url}/api"
        self.session = requests.Session()
        self.access_token = None
        self.refresh_token = None
        self.test_user_id = None
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
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None, params: Dict = None) -> requests.Response:
        """Make HTTP request with proper error handling"""
        url = f"{self.api_url}{endpoint}"
        
        # Add auth header if token available
        if self.access_token and headers is None:
            headers = {}
        if self.access_token and headers is not None:
            headers["Authorization"] = f"Bearer {self.access_token}"
        elif self.access_token:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            
        try:
            if method.upper() == "GET":
                response = self.session.get(url, params=params, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=headers, params=params, timeout=30)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, headers=headers, params=params, timeout=30)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=headers, params=params, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request failed for {method} {url}: {str(e)}")
            raise

    def test_health_endpoint(self):
        """Test health check endpoint"""
        try:
            response = self.make_request("GET", "/health")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_test("Health Check", True, "API is healthy", data)
                else:
                    self.log_test("Health Check", False, f"Unexpected health status: {data}")
            else:
                self.log_test("Health Check", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")

    def test_authentication_flow(self):
        """Test complete authentication flow"""
        # Generate unique test user
        timestamp = int(time.time())
        test_email = f"deploy_test_{timestamp}@example.com"
        test_password = "SecurePass123"
        test_name = "Deploy Tester"
        
        # Test Registration
        try:
            register_data = {
                "email": test_email,
                "password": test_password,
                "name": test_name
            }
            
            response = self.make_request("POST", "/auth/register", register_data)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "refresh_token" in data:
                    self.access_token = data["access_token"]
                    self.refresh_token = data["refresh_token"]
                    self.log_test("User Registration", True, f"User registered successfully: {test_email}", data)
                else:
                    self.log_test("User Registration", False, f"Missing tokens in response: {data}")
            else:
                self.log_test("User Registration", False, f"Status code: {response.status_code}, Response: {response.text}")
                return
                
        except Exception as e:
            self.log_test("User Registration", False, f"Exception: {str(e)}")
            return

        # Test Login
        try:
            login_data = {
                "email": test_email,
                "password": test_password
            }
            
            response = self.make_request("POST", "/auth/login", login_data)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data:
                    self.access_token = data["access_token"]
                    self.log_test("User Login", True, f"Login successful for: {test_email}", data)
                else:
                    self.log_test("User Login", False, f"Missing access_token: {data}")
            else:
                self.log_test("User Login", False, f"Status code: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("User Login", False, f"Exception: {str(e)}")

        # Test /auth/me endpoint
        try:
            response = self.make_request("GET", "/auth/me")
            
            if response.status_code == 200:
                data = response.json()
                if "user_id" in data and "email" in data:
                    self.test_user_id = data["user_id"]
                    self.log_test("Get Current User", True, f"User info retrieved: {data['email']}", data)
                else:
                    self.log_test("Get Current User", False, f"Missing user info: {data}")
            else:
                self.log_test("Get Current User", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Get Current User", False, f"Exception: {str(e)}")

        # Test Token Refresh
        if self.refresh_token:
            try:
                refresh_data = {"refresh_token": self.refresh_token}
                response = self.make_request("POST", "/auth/refresh", refresh_data)
                
                if response.status_code == 200:
                    data = response.json()
                    if "access_token" in data:
                        self.access_token = data["access_token"]
                        self.log_test("Token Refresh", True, "Token refreshed successfully", data)
                    else:
                        self.log_test("Token Refresh", False, f"Missing new access_token: {data}")
                else:
                    self.log_test("Token Refresh", False, f"Status code: {response.status_code}")
                    
            except Exception as e:
                self.log_test("Token Refresh", False, f"Exception: {str(e)}")

    def test_user_profile_endpoints(self):
        """Test user profile CRUD operations"""
        if not self.test_user_id:
            self.log_test("User Profile Tests", False, "No test user ID available")
            return
            
        # Test Profile Creation
        try:
            profile_data = {
                "user_id": self.test_user_id,
                "name": "Deploy Tester",
                "age": 30,
                "gender": "male",
                "height_feet": 5,
                "height_inches": 10,
                "weight": 180.0,
                "goal_weight": 170.0,
                "activity_level": "moderate",
                "custom_calorie_goal": 2200
            }
            
            response = self.make_request("POST", "/user/profile", profile_data)
            
            if response.status_code == 200:
                data = response.json()
                if "profile" in data:
                    self.log_test("Create User Profile", True, f"Profile created with BMR calculation", data)
                else:
                    self.log_test("Create User Profile", False, f"Missing profile in response: {data}")
            else:
                self.log_test("Create User Profile", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Create User Profile", False, f"Exception: {str(e)}")

        # Test Profile Retrieval
        try:
            response = self.make_request("GET", f"/user/profile/{self.test_user_id}")
            
            if response.status_code == 200:
                data = response.json()
                if "user_id" in data and "daily_calorie_goal" in data:
                    self.log_test("Get User Profile", True, f"Profile retrieved with calorie goal: {data.get('daily_calorie_goal')}", data)
                else:
                    self.log_test("Get User Profile", False, f"Missing profile data: {data}")
            else:
                self.log_test("Get User Profile", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Get User Profile", False, f"Exception: {str(e)}")

    def test_nutrition_endpoints(self):
        """Test nutrition and meal endpoints"""
        if not self.test_user_id:
            self.log_test("Nutrition Tests", False, "No test user ID available")
            return

        # Test Food Search
        try:
            response = self.make_request("GET", "/nutrition/foods/search", params={"q": "chicken"})
            
            if response.status_code == 200:
                data = response.json()
                if "foods" in data and len(data["foods"]) > 0:
                    self.log_test("Food Search", True, f"Found {len(data['foods'])} foods for 'chicken'", data)
                else:
                    self.log_test("Food Search", False, f"No foods found: {data}")
            else:
                self.log_test("Food Search", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Food Search", False, f"Exception: {str(e)}")

        # Test Quick Log Meal
        try:
            meal_data = {
                "user_id": self.test_user_id,
                "name": "Grilled Chicken Breast",
                "calories": 187,
                "protein": 35,
                "carbs": 0,
                "fat": 4,
                "meal_category": "lunch",
                "serving_size": "4 oz",
                "servings": 1.0
            }
            
            response = self.make_request("POST", "/nutrition/quick-log", meal_data)
            
            if response.status_code == 200:
                data = response.json()
                if "meal" in data:
                    self.log_test("Quick Log Meal", True, f"Meal logged successfully", data)
                else:
                    self.log_test("Quick Log Meal", False, f"Missing meal in response: {data}")
            else:
                self.log_test("Quick Log Meal", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Quick Log Meal", False, f"Exception: {str(e)}")

        # Test Get Meals
        try:
            response = self.make_request("GET", f"/meals/{self.test_user_id}")
            
            if response.status_code == 200:
                data = response.json()
                if "meals" in data:
                    self.log_test("Get User Meals", True, f"Retrieved {len(data['meals'])} meals", data)
                else:
                    self.log_test("Get User Meals", False, f"Missing meals in response: {data}")
            else:
                self.log_test("Get User Meals", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Get User Meals", False, f"Exception: {str(e)}")

        # Test Daily Nutrition Summary
        try:
            today = datetime.now().strftime("%Y-%m-%d")
            response = self.make_request("GET", f"/nutrition/daily-summary/{self.test_user_id}", params={"date": today})
            
            if response.status_code == 200:
                data = response.json()
                if "totals" in data and "goals" in data:
                    self.log_test("Daily Nutrition Summary", True, f"Daily summary for {today}", data)
                else:
                    self.log_test("Daily Nutrition Summary", False, f"Missing summary data: {data}")
            else:
                self.log_test("Daily Nutrition Summary", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Daily Nutrition Summary", False, f"Exception: {str(e)}")

    def test_workout_endpoints(self):
        """Test workout endpoints"""
        if not self.test_user_id:
            self.log_test("Workout Tests", False, "No test user ID available")
            return

        # Test Get Workouts
        try:
            response = self.make_request("GET", f"/workouts/user/{self.test_user_id}")
            
            if response.status_code == 200:
                data = response.json()
                if "workouts" in data:
                    self.log_test("Get User Workouts", True, f"Retrieved {len(data['workouts'])} workouts", data)
                else:
                    self.log_test("Get User Workouts", False, f"Missing workouts in response: {data}")
            else:
                self.log_test("Get User Workouts", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Get User Workouts", False, f"Exception: {str(e)}")

        # Test Create Workout
        try:
            workout_data = {
                "workout_id": f"workout_{int(time.time())}",
                "user_id": self.test_user_id,
                "workout_type": "cardio",
                "duration": 30,
                "calories_burned": 250.0,
                "notes": "Morning run",
                "timestamp": datetime.now().isoformat()
            }
            
            response = self.make_request("POST", "/workouts", workout_data)
            
            if response.status_code == 200:
                data = response.json()
                if "workout" in data:
                    self.log_test("Create Workout", True, f"Workout created successfully", data)
                else:
                    self.log_test("Create Workout", False, f"Missing workout in response: {data}")
            else:
                self.log_test("Create Workout", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Create Workout", False, f"Exception: {str(e)}")

        # Test Get Scheduled Workouts
        try:
            response = self.make_request("GET", f"/scheduled-workouts/{self.test_user_id}")
            
            if response.status_code == 200:
                data = response.json()
                if "scheduled_workouts" in data:
                    self.log_test("Get Scheduled Workouts", True, f"Retrieved {len(data['scheduled_workouts'])} scheduled workouts", data)
                else:
                    self.log_test("Get Scheduled Workouts", False, f"Missing scheduled_workouts in response: {data}")
            else:
                self.log_test("Get Scheduled Workouts", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Get Scheduled Workouts", False, f"Exception: {str(e)}")

    def test_step_tracker_endpoints(self):
        """Test step tracker endpoints"""
        if not self.test_user_id:
            self.log_test("Step Tracker Tests", False, "No test user ID available")
            return

        # Test Log Steps
        try:
            steps_data = {
                "user_id": self.test_user_id,
                "steps": 5000,
                "date": datetime.now().strftime("%Y-%m-%d"),
                "source": "manual"
            }
            
            response = self.make_request("POST", "/steps", steps_data)
            
            if response.status_code == 200:
                data = response.json()
                if "steps" in data or "message" in data:
                    self.log_test("Log Steps", True, f"Steps logged: 5000 steps", data)
                else:
                    self.log_test("Log Steps", False, f"Unexpected response: {data}")
            else:
                self.log_test("Log Steps", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Log Steps", False, f"Exception: {str(e)}")

        # Test Get Today's Steps
        try:
            response = self.make_request("GET", f"/steps/{self.test_user_id}/today")
            
            if response.status_code == 200:
                data = response.json()
                if "steps" in data or "total_steps" in data:
                    self.log_test("Get Today's Steps", True, f"Today's steps retrieved", data)
                else:
                    self.log_test("Get Today's Steps", False, f"Missing steps data: {data}")
            else:
                self.log_test("Get Today's Steps", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Get Today's Steps", False, f"Exception: {str(e)}")

        # Test Get Steps History
        try:
            response = self.make_request("GET", f"/steps/{self.test_user_id}/history", params={"days": 7})
            
            if response.status_code == 200:
                data = response.json()
                if "entries" in data or "history" in data or "steps" in data:
                    self.log_test("Get Steps History", True, f"Steps history retrieved with {len(data.get('entries', []))} entries", data)
                else:
                    self.log_test("Get Steps History", False, f"Missing history data: {data}")
            else:
                self.log_test("Get Steps History", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Get Steps History", False, f"Exception: {str(e)}")

        # Test Get Weekly Steps
        try:
            response = self.make_request("GET", f"/steps/{self.test_user_id}/weekly")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Get Weekly Steps", True, f"Weekly steps retrieved", data)
            else:
                self.log_test("Get Weekly Steps", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Get Weekly Steps", False, f"Exception: {str(e)}")

        # Test Get Monthly Steps
        try:
            response = self.make_request("GET", f"/steps/{self.test_user_id}/monthly")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Get Monthly Steps", True, f"Monthly steps retrieved", data)
            else:
                self.log_test("Get Monthly Steps", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Get Monthly Steps", False, f"Exception: {str(e)}")

        # Test Step Settings
        try:
            settings_data = {
                "user_id": self.test_user_id,
                "daily_goal": 10000,
                "tracking_enabled": True,
                "auto_sync": True
            }
            
            response = self.make_request("POST", "/steps/settings", settings_data)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Set Step Settings", True, f"Step settings saved", data)
            else:
                self.log_test("Set Step Settings", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Set Step Settings", False, f"Exception: {str(e)}")

        # Test Get Step Settings
        try:
            response = self.make_request("GET", f"/steps/settings/{self.test_user_id}")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Get Step Settings", True, f"Step settings retrieved", data)
            else:
                self.log_test("Get Step Settings", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Get Step Settings", False, f"Exception: {str(e)}")

    def test_body_scan_heart_rate_endpoints(self):
        """Test body scan and heart rate endpoints"""
        if not self.test_user_id:
            self.log_test("Body Scan & Heart Rate Tests", False, "No test user ID available")
            return

        # Test Get Body Scan Progress
        try:
            response = self.make_request("GET", f"/body-scan/progress/{self.test_user_id}")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Get Body Scan Progress", True, f"Body scan progress retrieved", data)
            else:
                self.log_test("Get Body Scan Progress", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Get Body Scan Progress", False, f"Exception: {str(e)}")

        # Test Get Heart Rate Data
        try:
            response = self.make_request("GET", f"/heart-rate/{self.test_user_id}")
            
            if response.status_code == 200:
                data = response.json()
                if "heart_rates" in data:
                    self.log_test("Get Heart Rate Data", True, f"Heart rate data retrieved", data)
                else:
                    self.log_test("Get Heart Rate Data", False, f"Missing heart_rates in response: {data}")
            else:
                self.log_test("Get Heart Rate Data", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Get Heart Rate Data", False, f"Exception: {str(e)}")

    def test_dashboard_endpoint(self):
        """Test dashboard endpoint"""
        if not self.test_user_id:
            self.log_test("Dashboard Test", False, "No test user ID available")
            return

        try:
            response = self.make_request("GET", f"/dashboard/{self.test_user_id}")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Get Dashboard Data", True, f"Dashboard data retrieved", data)
            else:
                self.log_test("Get Dashboard Data", False, f"Status code: {response.status_code}")
                
        except Exception as e:
            self.log_test("Get Dashboard Data", False, f"Exception: {str(e)}")

    def test_membership_endpoints(self):
        """Test membership endpoints"""
        # Test with specific user ID from review request
        test_user_id = "user_1769564539081"
        
        # Test Membership Status
        try:
            response = self.make_request("GET", f"/membership/status/{test_user_id}")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Membership Status", True, f"Membership status retrieved for {test_user_id}", data)
            else:
                self.log_test("Membership Status", False, f"Status code: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Membership Status", False, f"Exception: {str(e)}")

        # Test Membership Pricing
        try:
            response = self.make_request("GET", "/membership/pricing")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Membership Pricing", True, f"Pricing information retrieved", data)
            else:
                self.log_test("Membership Pricing", False, f"Status code: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Membership Pricing", False, f"Exception: {str(e)}")

    def test_gamification_endpoints(self):
        """Test gamification endpoints"""
        # Test with specific user ID from review request
        test_user_id = "user_1769564539081"
        
        # Test Gamification Streak
        try:
            response = self.make_request("GET", f"/gamification/streak/{test_user_id}")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Gamification Streak", True, f"Streak data retrieved for {test_user_id}", data)
            else:
                self.log_test("Gamification Streak", False, f"Status code: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Gamification Streak", False, f"Exception: {str(e)}")

        # Test Sync Gamification Progress
        try:
            sync_data = {
                "activity_type": "workout",
                "points": 50,
                "timestamp": datetime.now().isoformat()
            }
            
            response = self.make_request("POST", f"/gamification/sync-progress/{test_user_id}", sync_data)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Sync Gamification Progress", True, f"Progress synced for {test_user_id}", data)
            else:
                self.log_test("Sync Gamification Progress", False, f"Status code: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Sync Gamification Progress", False, f"Exception: {str(e)}")

    def test_dashboard_with_date(self):
        """Test dashboard endpoint with specific date parameter"""
        # Test with specific user ID and date from review request
        test_user_id = "user_1769564539081"
        test_date = "2026-01-29"
        
        try:
            response = self.make_request("GET", f"/dashboard/{test_user_id}", params={"local_date": test_date})
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Dashboard with Date", True, f"Dashboard data retrieved for {test_user_id} on {test_date}", data)
            else:
                self.log_test("Dashboard with Date", False, f"Status code: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Dashboard with Date", False, f"Exception: {str(e)}")

    def test_peptide_endpoints(self):
        """Test new peptide features as requested in review"""
        print("\n🧪 Testing Peptide Features (Review Request)...")
        
        # Use specific user ID from review request
        test_user_id = "user_1769564539081"
        
        # Test 1: POST /api/peptides/stacks/save - Save a new stack
        try:
            stack_data = {
                "user_id": test_user_id,
                "name": "Recovery Stack",
                "peptides": ["BPC-157", "TB-500"],
                "goal": "Injury recovery",
                "created_by": "manual"
            }
            
            response = self.make_request("POST", "/peptides/stacks/save", stack_data)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Save Peptide Stack", True, f"Stack saved successfully for {test_user_id}", data)
            else:
                self.log_test("Save Peptide Stack", False, f"Status code: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Save Peptide Stack", False, f"Exception: {str(e)}")

        # Test 2: GET /api/peptides/stacks/user_1769564539081 - Get user's stacks
        try:
            response = self.make_request("GET", f"/peptides/stacks/{test_user_id}")
            
            if response.status_code == 200:
                data = response.json()
                stacks = data.get("stacks", [])
                self.log_test("Get Peptide Stacks", True, f"Retrieved {len(stacks)} stacks for {test_user_id}", data)
            else:
                self.log_test("Get Peptide Stacks", False, f"Status code: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Get Peptide Stacks", False, f"Exception: {str(e)}")

        # Test 3: POST /api/peptides/chat/save - Save a chat conversation
        try:
            chat_data = {
                "user_id": test_user_id,
                "conversation_id": "conv_test_123",
                "title": "Test Conversation",
                "messages": [
                    {
                        "role": "user",
                        "content": "What is BPC-157?",
                        "timestamp": "2026-01-30T12:00:00Z"
                    }
                ]
            }
            
            response = self.make_request("POST", "/peptides/chat/save", chat_data)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Save Peptide Chat", True, f"Chat conversation saved for {test_user_id}", data)
            else:
                self.log_test("Save Peptide Chat", False, f"Status code: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Save Peptide Chat", False, f"Exception: {str(e)}")

        # Test 4: GET /api/peptides/chat/history/user_1769564539081 - Get saved conversations
        try:
            response = self.make_request("GET", f"/peptides/chat/history/{test_user_id}")
            
            if response.status_code == 200:
                data = response.json()
                conversations = data.get("conversations", [])
                self.log_test("Get Peptide Chat History", True, f"Retrieved {len(conversations)} conversations for {test_user_id}", data)
            else:
                self.log_test("Get Peptide Chat History", False, f"Status code: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Get Peptide Chat History", False, f"Exception: {str(e)}")

    def test_security_features(self):
        """Test security features"""
        
        # Test Rate Limiting on Auth Endpoints
        print("\n🔒 Testing Rate Limiting (this may take a moment)...")
        
        try:
            # Make rapid requests to test rate limiting
            failed_attempts = 0
            for i in range(15):  # Try 15 rapid requests
                try:
                    invalid_login = {
                        "email": "invalid@test.com",
                        "password": "wrongpassword"
                    }
                    response = self.make_request("POST", "/auth/login", invalid_login)
                    
                    if response.status_code == 429:  # Rate limited
                        self.log_test("Rate Limiting", True, f"Rate limiting triggered after {i+1} requests")
                        break
                    elif response.status_code == 401:  # Expected invalid login
                        failed_attempts += 1
                        
                    time.sleep(0.1)  # Small delay between requests
                    
                except Exception as e:
                    continue
                    
            if failed_attempts >= 10:  # If we made 10+ requests without rate limiting
                self.log_test("Rate Limiting", False, f"Rate limiting not triggered after {failed_attempts} requests")
                
        except Exception as e:
            self.log_test("Rate Limiting", False, f"Exception: {str(e)}")

        # Test Invalid Token Rejection
        try:
            # Save current token
            original_token = self.access_token
            
            # Set invalid token
            self.access_token = "invalid_token_12345"
            
            response = self.make_request("GET", "/auth/me")
            
            if response.status_code == 401:
                self.log_test("Invalid Token Rejection", True, "Invalid token properly rejected")
            else:
                self.log_test("Invalid Token Rejection", False, f"Invalid token not rejected, status: {response.status_code}")
                
            # Restore original token
            self.access_token = original_token
            
        except Exception as e:
            self.log_test("Invalid Token Rejection", False, f"Exception: {str(e)}")

        # Test Input Validation - Weak Password
        try:
            weak_password_data = {
                "email": "test_weak@example.com",
                "password": "123",  # Weak password
                "name": "Test User"
            }
            
            response = self.make_request("POST", "/auth/register", weak_password_data)
            
            if response.status_code in [400, 422]:  # Should reject weak password
                self.log_test("Weak Password Validation", True, "Weak password properly rejected")
            else:
                self.log_test("Weak Password Validation", False, f"Weak password not rejected, status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Weak Password Validation", False, f"Exception: {str(e)}")

        # Test Input Validation - Invalid Email
        try:
            invalid_email_data = {
                "email": "invalid-email",  # Invalid email format
                "password": "ValidPassword123",
                "name": "Test User"
            }
            
            response = self.make_request("POST", "/auth/register", invalid_email_data)
            
            if response.status_code in [400, 422]:  # Should reject invalid email
                self.log_test("Invalid Email Validation", True, "Invalid email properly rejected")
            else:
                self.log_test("Invalid Email Validation", False, f"Invalid email not rejected, status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Invalid Email Validation", False, f"Exception: {str(e)}")

    def run_comprehensive_test(self):
        """Run all tests in sequence"""
        print("🚀 Starting Comprehensive FitTrax+ API Testing Suite")
        print(f"🌐 Testing API at: {self.api_url}")
        print("=" * 80)
        
        # 1. Health & Basic
        print("\n📊 Testing Health & Basic Endpoints...")
        self.test_health_endpoint()
        
        # 2. Authentication Flow
        print("\n🔐 Testing Authentication Flow...")
        self.test_authentication_flow()
        
        # 3. User Profile
        print("\n👤 Testing User Profile Endpoints...")
        self.test_user_profile_endpoints()
        
        # 4. Nutrition/Meals
        print("\n🍎 Testing Nutrition & Meal Endpoints...")
        self.test_nutrition_endpoints()
        
        # 5. Workouts
        print("\n💪 Testing Workout Endpoints...")
        self.test_workout_endpoints()
        
        # 6. Step Tracker
        print("\n👟 Testing Step Tracker Endpoints...")
        self.test_step_tracker_endpoints()
        
        # 7. Body Scan & Heart Rate
        print("\n❤️ Testing Body Scan & Heart Rate Endpoints...")
        self.test_body_scan_heart_rate_endpoints()
        
        # 8. Dashboard
        print("\n📈 Testing Dashboard Endpoint...")
        self.test_dashboard_endpoint()
        
        # 9. Membership Endpoints (Review Request)
        print("\n💳 Testing Membership Endpoints...")
        self.test_membership_endpoints()
        
        # 10. Gamification Endpoints (Review Request)
        print("\n🎮 Testing Gamification Endpoints...")
        self.test_gamification_endpoints()
        
        # 11. Dashboard with Date (Review Request)
        print("\n📅 Testing Dashboard with Date Parameter...")
        self.test_dashboard_with_date()
        
        # 12. Peptide Features (Review Request)
        print("\n🧪 Testing Peptide Features...")
        self.test_peptide_endpoints()
        
        # 13. Security Tests
        print("\n🔒 Testing Security Features...")
        self.test_security_features()
        
        # Generate Summary
        self.generate_summary()

    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "=" * 80)
        print("📋 COMPREHENSIVE TEST RESULTS SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"📊 Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS ({failed_tests}):")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   • {result['test']}: {result['details']}")
        
        print(f"\n✅ PASSED TESTS ({passed_tests}):")
        for result in self.test_results:
            if result["success"]:
                print(f"   • {result['test']}")
        
        # Deployment Readiness Assessment
        print(f"\n🚀 DEPLOYMENT READINESS ASSESSMENT:")
        if success_rate >= 95:
            print("   🟢 EXCELLENT - API is deployment ready!")
        elif success_rate >= 85:
            print("   🟡 GOOD - Minor issues to address before deployment")
        elif success_rate >= 70:
            print("   🟠 FAIR - Several issues need fixing before deployment")
        else:
            print("   🔴 POOR - Major issues must be resolved before deployment")
        
        print("=" * 80)

if __name__ == "__main__":
    # Use the backend URL from environment
    BACKEND_URL = "https://fitness-journey-294.preview.emergentagent.com"
    
    print(f"🎯 FitTrax+ API Comprehensive Testing Suite")
    print(f"🌐 Backend URL: {BACKEND_URL}")
    
    tester = FitTraxAPITester(BACKEND_URL)
    tester.run_comprehensive_test()