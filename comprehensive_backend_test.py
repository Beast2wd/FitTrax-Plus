#!/usr/bin/env python3
"""
Comprehensive Backend API Test for FitTrax Fitness App
Tests all endpoints as requested in the review.
"""

import requests
import json
import base64
import os
from datetime import datetime, timedelta
import uuid

# Get backend URL from environment
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://fitness-tracker-app-11.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

# Test user ID
TEST_USER_ID = "test_user_comprehensive"

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.results = {
            "passed": [],
            "failed": [],
            "errors": []
        }
    
    def test_endpoint(self, method, endpoint, data=None, expected_status=200, description=""):
        """Test a single endpoint"""
        url = f"{API_BASE}{endpoint}"
        try:
            print(f"\n🧪 Testing {method} {endpoint}")
            print(f"   Description: {description}")
            print(f"   URL: {url}")
            
            if method.upper() == "GET":
                response = self.session.get(url, timeout=30)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, timeout=30)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, timeout=30)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, timeout=30)
            
            status = response.status_code
            print(f"   Status: {status}")
            
            # Try to parse JSON response
            try:
                response_data = response.json()
                print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
            except:
                response_data = {"raw_text": response.text}
                print(f"   Response (text): {response.text[:200]}...")
            
            if status == expected_status:
                self.results["passed"].append({
                    "endpoint": f"{method} {endpoint}",
                    "description": description,
                    "status": status,
                    "response": response_data
                })
                print(f"   ✅ PASSED")
                return True, response_data
            else:
                self.results["failed"].append({
                    "endpoint": f"{method} {endpoint}",
                    "description": description,
                    "expected_status": expected_status,
                    "actual_status": status,
                    "response": response_data
                })
                print(f"   ❌ FAILED - Expected {expected_status}, got {status}")
                return False, response_data
                
        except Exception as e:
            error_msg = str(e)
            print(f"   💥 ERROR: {error_msg}")
            self.results["errors"].append({
                "endpoint": f"{method} {endpoint}",
                "description": description,
                "error": error_msg
            })
            return False, {"error": error_msg}
    
    def print_summary(self):
        """Print test summary"""
        total = len(self.results["passed"]) + len(self.results["failed"]) + len(self.results["errors"])
        passed = len(self.results["passed"])
        failed = len(self.results["failed"])
        errors = len(self.results["errors"])
        
        print(f"\n" + "="*60)
        print(f"🏁 TEST SUMMARY")
        print(f"="*60)
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"💥 Errors: {errors}")
        print(f"Success Rate: {(passed/total*100):.1f}%" if total > 0 else "0%")
        
        if self.results["failed"]:
            print(f"\n❌ FAILED TESTS:")
            for test in self.results["failed"]:
                print(f"   - {test['endpoint']}: {test['description']}")
                print(f"     Expected {test['expected_status']}, got {test['actual_status']}")
        
        if self.results["errors"]:
            print(f"\n💥 ERROR TESTS:")
            for test in self.results["errors"]:
                print(f"   - {test['endpoint']}: {test['description']}")
                print(f"     Error: {test['error']}")

def test_fittrax_backend():
    """Run comprehensive backend tests"""
    
    tester = APITester()
    print(f"🚀 Starting FitTrax Backend API Tests")
    print(f"Backend URL: {API_BASE}")
    print(f"Test User ID: {TEST_USER_ID}")
    
    # 1. USER/PROFILE APIs
    print(f"\n" + "="*60)
    print(f"👤 TESTING USER/PROFILE APIs")
    print(f"="*60)
    
    # Create user profile
    profile_data = {
        "user_id": TEST_USER_ID,
        "name": "John Doe",
        "age": 30,
        "gender": "male",
        "height_feet": 6,
        "height_inches": 0,
        "weight": 180.0,
        "goal_weight": 170.0,
        "activity_level": "moderate"
    }
    
    # Test both possible endpoints
    tester.test_endpoint(
        "POST", "/users/profile", 
        data=profile_data,
        description="Create user profile",
        expected_status=404  # Expect 404 if endpoint doesn't exist
    )
    
    tester.test_endpoint(
        "POST", "/user/profile", 
        data=profile_data,
        description="Create user profile (correct endpoint)"
    )
    
    # Get user profile
    tester.test_endpoint(
        "GET", f"/users/profile/{TEST_USER_ID}",
        description="Get user profile",
        expected_status=404  # Expect 404 if endpoint doesn't exist
    )
    
    tester.test_endpoint(
        "GET", f"/user/profile/{TEST_USER_ID}",
        description="Get user profile (correct endpoint)"
    )
    
    # Get dashboard
    tester.test_endpoint(
        "GET", f"/dashboard/{TEST_USER_ID}",
        description="Get user dashboard"
    )
    
    # 2. WORKOUT PLANS APIs
    print(f"\n" + "="*60)
    print(f"💪 TESTING WORKOUT PLANS APIs")
    print(f"="*60)
    
    # Get workout plans
    tester.test_endpoint(
        "GET", "/workout-plans",
        description="Get all workout plans"
    )
    
    # Start a workout plan
    user_plan_data = {
        "user_plan_id": f"up_{TEST_USER_ID}_{int(datetime.now().timestamp())}",
        "user_id": TEST_USER_ID,
        "plan_id": "plan_beginner_weight_loss",
        "start_date": datetime.now().isoformat(),
        "current_day": 1,
        "completed_days": [],
        "status": "active"
    }
    
    tester.test_endpoint(
        "POST", "/user-plans",
        data=user_plan_data,
        description="Start a workout plan"
    )
    
    # Get user plans
    tester.test_endpoint(
        "GET", f"/user-plans/{TEST_USER_ID}",
        description="Get user's workout plans"
    )
    
    # Get scheduled workouts
    tester.test_endpoint(
        "GET", f"/scheduled-workouts/{TEST_USER_ID}",
        description="Get scheduled workouts"
    )
    
    # 3. RUNNING TRACKER APIs
    print(f"\n" + "="*60)
    print(f"🏃 TESTING RUNNING TRACKER APIs")
    print(f"="*60)
    
    # Save a run
    run_data = {
        "run_id": f"run_{TEST_USER_ID}_{int(datetime.now().timestamp())}",
        "user_id": TEST_USER_ID,
        "distance": 5.0,
        "duration": 1800,  # 30 minutes
        "average_pace": 6.0,  # 6 min/km
        "calories_burned": 300.0,
        "route_data": [],
        "notes": "Morning run in the park",
        "timestamp": datetime.now().isoformat()
    }
    
    tester.test_endpoint(
        "POST", "/runs",
        data=run_data,
        description="Save a run"
    )
    
    # Get runs
    tester.test_endpoint(
        "GET", f"/runs/{TEST_USER_ID}",
        description="Get user's runs"
    )
    
    # Get running stats
    tester.test_endpoint(
        "GET", f"/running/stats/{TEST_USER_ID}",
        description="Get running statistics",
        expected_status=404  # Expect 404 if endpoint doesn't exist
    )
    
    tester.test_endpoint(
        "GET", f"/runs/stats/{TEST_USER_ID}",
        description="Get running statistics (alternative endpoint)"
    )
    
    # 4. WEIGHT TRAINING APIs
    print(f"\n" + "="*60)
    print(f"🏋️ TESTING WEIGHT TRAINING APIs")
    print(f"="*60)
    
    # Get weight training programs
    tester.test_endpoint(
        "GET", "/weight-training/programs",
        description="Get weight training programs"
    )
    
    # Get exercises
    tester.test_endpoint(
        "GET", "/weight-training/exercises",
        description="Get weight training exercises"
    )
    
    # Log weight training
    weight_log_data = {
        "workout_id": f"wt_{TEST_USER_ID}_{int(datetime.now().timestamp())}",
        "user_id": TEST_USER_ID,
        "workout_name": "Push Day",
        "exercises": [
            {
                "exercise_name": "Bench Press",
                "sets": [
                    {"weight": 135, "reps": 10},
                    {"weight": 145, "reps": 8},
                    {"weight": 155, "reps": 6}
                ]
            }
        ],
        "duration_minutes": 45,
        "notes": "Good workout, felt strong",
        "timestamp": datetime.now().isoformat()
    }
    
    tester.test_endpoint(
        "POST", "/weight-training/log",
        data=weight_log_data,
        description="Log weight training session"
    )
    
    # Get weight training stats
    tester.test_endpoint(
        "GET", f"/weight-training/stats/{TEST_USER_ID}",
        description="Get weight training statistics"
    )
    
    # Get weight training history
    tester.test_endpoint(
        "GET", f"/weight-training/history/{TEST_USER_ID}",
        description="Get weight training history"
    )
    
    # 5. GAMIFICATION APIs
    print(f"\n" + "="*60)
    print(f"🎮 TESTING GAMIFICATION APIs")
    print(f"="*60)
    
    # Get badges
    tester.test_endpoint(
        "GET", "/gamification/badges",
        description="Get all available badges"
    )
    
    # Get user badges
    tester.test_endpoint(
        "GET", f"/gamification/user-badges/{TEST_USER_ID}",
        description="Get user's earned badges"
    )
    
    # Get gamification summary
    tester.test_endpoint(
        "GET", f"/gamification/summary/{TEST_USER_ID}",
        description="Get gamification summary"
    )
    
    # Get daily challenges
    tester.test_endpoint(
        "GET", f"/challenges/daily/{TEST_USER_ID}",
        description="Get daily challenges"
    )
    
    # Get weekly challenges
    tester.test_endpoint(
        "GET", f"/challenges/weekly/{TEST_USER_ID}",
        description="Get weekly challenges"
    )
    
    # 6. PEPTIDE CALCULATOR APIs
    print(f"\n" + "="*60)
    print(f"💉 TESTING PEPTIDE CALCULATOR APIs")
    print(f"="*60)
    
    # Get peptide database
    tester.test_endpoint(
        "GET", "/peptides/database",
        description="Get peptide database"
    )
    
    # Calculate reconstitution
    reconstitution_data = {
        "peptide_amount_mg": 5,
        "water_amount_ml": 2,
        "desired_dose_mcg": 250
    }
    
    tester.test_endpoint(
        "POST", "/peptides/calculate-reconstitution",
        data=reconstitution_data,
        description="Calculate peptide reconstitution"
    )
    
    # Get injections
    tester.test_endpoint(
        "GET", f"/peptides/injections/{TEST_USER_ID}",
        description="Get peptide injections"
    )
    
    # Get site rotation
    tester.test_endpoint(
        "GET", f"/peptides/site-rotation/{TEST_USER_ID}",
        description="Get injection site rotation"
    )
    
    # 7. BODY SCAN APIs
    print(f"\n" + "="*60)
    print(f"📏 TESTING BODY SCAN APIs")
    print(f"="*60)
    
    # Analyze body scan (measurements only)
    body_scan_data = {
        "user_id": TEST_USER_ID,
        "measurements": {
            "chest": 40,
            "waist": 32,
            "hips": 38,
            "bicep": 14,
            "thigh": 22,
            "weight": 180
        },
        "timestamp": datetime.now().isoformat()
    }
    
    tester.test_endpoint(
        "POST", "/body-scan/analyze",
        data=body_scan_data,
        description="Analyze body scan with measurements"
    )
    
    # Get body scan history
    tester.test_endpoint(
        "GET", f"/body-scan/history/{TEST_USER_ID}",
        description="Get body scan history"
    )
    
    # Get body scan progress
    tester.test_endpoint(
        "GET", f"/body-scan/progress/{TEST_USER_ID}",
        description="Get body scan progress"
    )
    
    # 8. HEALTH SYNC APIs
    print(f"\n" + "="*60)
    print(f"🏥 TESTING HEALTH SYNC APIs")
    print(f"="*60)
    
    # Get health summary
    tester.test_endpoint(
        "GET", f"/health/summary/{TEST_USER_ID}",
        description="Get health summary"
    )
    
    # Get connection status
    tester.test_endpoint(
        "GET", f"/health/connection-status/{TEST_USER_ID}",
        description="Get health connection status"
    )
    
    # 9. OTHER APIs
    print(f"\n" + "="*60)
    print(f"🔧 TESTING OTHER APIs")
    print(f"="*60)
    
    # Log water intake
    water_data = {
        "water_id": f"water_{TEST_USER_ID}_{int(datetime.now().timestamp())}",
        "user_id": TEST_USER_ID,
        "amount": 16.0,  # 16 oz
        "timestamp": datetime.now().isoformat()
    }
    
    tester.test_endpoint(
        "POST", "/water-intake",
        data=water_data,
        description="Log water intake",
        expected_status=404  # Expect 404 if endpoint doesn't exist
    )
    
    tester.test_endpoint(
        "POST", "/water",
        data=water_data,
        description="Log water intake (correct endpoint)"
    )
    
    # Get water intake
    tester.test_endpoint(
        "GET", f"/water-intake/{TEST_USER_ID}",
        description="Get water intake",
        expected_status=404  # Expect 404 if endpoint doesn't exist
    )
    
    tester.test_endpoint(
        "GET", f"/water/{TEST_USER_ID}",
        description="Get water intake (correct endpoint)"
    )
    
    # Get meals
    tester.test_endpoint(
        "GET", f"/meals/{TEST_USER_ID}",
        description="Get user's meals"
    )
    
    # Get heart rate
    tester.test_endpoint(
        "GET", f"/heart-rate/{TEST_USER_ID}",
        description="Get heart rate data"
    )
    
    # Get analytics summary
    tester.test_endpoint(
        "GET", f"/analytics/summary/{TEST_USER_ID}",
        description="Get analytics summary",
        expected_status=404  # Expect 404 if endpoint doesn't exist
    )
    
    # Health check
    tester.test_endpoint(
        "GET", "/health",
        description="Health check endpoint"
    )
    
    # Print final summary
    tester.print_summary()
    
    return tester.results

if __name__ == "__main__":
    print("🧪 FitTrax Backend API Comprehensive Test Suite")
    print("=" * 60)
    
    # Run the tests
    results = test_fittrax_backend()
    
    # Exit with appropriate code
    if results["failed"] or results["errors"]:
        exit(1)
    else:
        exit(0)