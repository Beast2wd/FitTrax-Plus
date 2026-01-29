#!/usr/bin/env python3
"""
Comprehensive Backend API Testing Script for FitTrax
Tests ALL endpoint categories mentioned in the user request with specific test user ID
"""

import requests
import json
import base64
from datetime import datetime, timedelta
import time
import sys
import os

# Test Configuration - Using exact values from user request
BACKEND_URL = "https://fittrax-sync.preview.emergentagent.com/api"
TEST_USER_ID = "user_1767657116540"

# Test Results Tracking
test_results = {
    "total_tests": 0,
    "passed_tests": 0,
    "failed_tests": 0,
    "test_details": [],
    "categories": {}
}

def log_test(category, endpoint, method, status, details="", response_data=None):
    """Log test results"""
    test_results["total_tests"] += 1
    
    if category not in test_results["categories"]:
        test_results["categories"][category] = {"passed": 0, "failed": 0, "total": 0}
    
    test_results["categories"][category]["total"] += 1
    
    if status == "PASS":
        test_results["passed_tests"] += 1
        test_results["categories"][category]["passed"] += 1
        print(f"✅ {category} - {method} {endpoint}")
        if response_data and isinstance(response_data, dict):
            # Show key response data for successful tests
            if "status" in response_data:
                print(f"   Response: {response_data['status']}")
            elif "message" in response_data:
                print(f"   Response: {response_data['message']}")
    else:
        test_results["failed_tests"] += 1
        test_results["categories"][category]["failed"] += 1
        print(f"❌ {category} - {method} {endpoint}")
        print(f"   Error: {details}")
    
    test_results["test_details"].append({
        "category": category,
        "endpoint": endpoint,
        "method": method,
        "status": status,
        "details": details,
        "response_data": response_data
    })

def test_endpoint(method, endpoint, data=None, expected_status=200, category="General"):
    """Test an API endpoint"""
    url = f"{BACKEND_URL}{endpoint}"
    
    try:
        if method == "GET":
            response = requests.get(url, timeout=30)
        elif method == "POST":
            response = requests.post(url, json=data, timeout=30)
        elif method == "PUT":
            response = requests.put(url, json=data, timeout=30)
        elif method == "DELETE":
            response = requests.delete(url, timeout=30)
        
        response_data = None
        try:
            response_data = response.json() if response.content else {}
        except:
            response_data = {"raw_response": response.text[:200]}
        
        if response.status_code == expected_status:
            log_test(category, endpoint, method, "PASS", f"Status: {response.status_code}", response_data)
            return response_data
        else:
            log_test(category, endpoint, method, "FAIL", 
                    f"Expected {expected_status}, got {response.status_code}: {response.text[:200]}")
            return None
            
    except Exception as e:
        log_test(category, endpoint, method, "FAIL", f"Exception: {str(e)[:200]}")
        return None

def test_health_and_dashboard():
    """Test Health & Dashboard endpoints"""
    print("\n🔍 Testing Health & Dashboard Endpoints...")
    
    # 1. Health check
    test_endpoint("GET", "/health", category="Health & Dashboard")
    
    # 2. Dashboard
    test_endpoint("GET", f"/dashboard/{TEST_USER_ID}", category="Health & Dashboard")

def test_user_profile():
    """Test User Profile endpoints"""
    print("\n👤 Testing User Profile Endpoints...")
    
    # 1. Get profile
    test_endpoint("GET", f"/user/profile/{TEST_USER_ID}", category="User Profile")
    
    # 2. Create/Update profile
    profile_data = {
        "user_id": TEST_USER_ID,
        "name": "Test User Profile",
        "age": 30,
        "gender": "male",
        "height_feet": 5,
        "height_inches": 10,
        "weight": 175.0,
        "goal_weight": 165.0,
        "activity_level": "moderate"
    }
    test_endpoint("POST", "/user/profile", profile_data, category="User Profile")
    
    # 3. Update profile
    profile_data["weight"] = 170.0
    test_endpoint("PUT", f"/user/profile/{TEST_USER_ID}", profile_data, category="User Profile")

def test_meals_and_nutrition():
    """Test Meals & Nutrition endpoints"""
    print("\n🍽️ Testing Meals & Nutrition Endpoints...")
    
    # 1. Add meal (using quick-log)
    meal_data = {
        "user_id": TEST_USER_ID,
        "name": "Test Meal",
        "calories": 250.0,
        "protein": 20.0,
        "carbs": 30.0,
        "fat": 10.0,
        "meal_category": "lunch"
    }
    test_endpoint("POST", "/nutrition/quick-log", meal_data, category="Meals & Nutrition")
    
    # 2. Get meals
    test_endpoint("GET", f"/meals/{TEST_USER_ID}", category="Meals & Nutrition")
    
    # 3. Get daily summary
    today = "2026-01-18"
    test_endpoint("GET", f"/nutrition/daily-summary/{TEST_USER_ID}?date={today}", category="Meals & Nutrition")
    
    # 4. Get weekly summary
    test_endpoint("GET", f"/nutrition/weekly-summary/{TEST_USER_ID}", category="Meals & Nutrition")

def test_water_hydration():
    """Test Water/Hydration endpoints"""
    print("\n💧 Testing Water/Hydration Endpoints...")
    
    # 1. Add water intake
    water_data = {
        "water_id": f"water_{int(time.time() * 1000)}",
        "user_id": TEST_USER_ID,
        "amount": 16.0,
        "timestamp": datetime.utcnow().isoformat()
    }
    response = test_endpoint("POST", "/water", water_data, category="Water/Hydration")
    
    # 2. Get water intake
    test_endpoint("GET", f"/water/{TEST_USER_ID}", category="Water/Hydration")
    
    # 3. Delete water entry
    if response:
        water_id = water_data["water_id"]
        test_endpoint("DELETE", f"/water/{water_id}", category="Water/Hydration")

def test_workouts():
    """Test Workout endpoints"""
    print("\n💪 Testing Workout Endpoints...")
    
    # 1. Get workout plans
    test_endpoint("GET", "/workout-plans", category="Workouts")
    
    # 2. Add workout
    workout_data = {
        "workout_id": f"workout_{int(time.time() * 1000)}",
        "user_id": TEST_USER_ID,
        "workout_type": "strength",
        "duration": 45,
        "calories_burned": 300.0,
        "notes": "Test workout",
        "timestamp": datetime.utcnow().isoformat()
    }
    test_endpoint("POST", "/workouts", workout_data, category="Workouts")
    
    # 3. Get workouts
    test_endpoint("GET", f"/workouts/user/{TEST_USER_ID}", category="Workouts")

def test_heart_rate():
    """Test Heart Rate endpoints"""
    print("\n❤️ Testing Heart Rate Endpoints...")
    
    # 1. Add heart rate
    hr_data = {
        "heart_rate_id": f"hr_{int(time.time() * 1000)}",
        "user_id": TEST_USER_ID,
        "bpm": 75,
        "activity_type": "resting",
        "notes": "Test heart rate",
        "timestamp": datetime.utcnow().isoformat()
    }
    test_endpoint("POST", "/heart-rate", hr_data, category="Heart Rate")
    
    # 2. Get heart rate data
    test_endpoint("GET", f"/heart-rate/{TEST_USER_ID}", category="Heart Rate")
    
    # 3. Get heart rate zones
    test_endpoint("GET", f"/heart-rate/zones/{TEST_USER_ID}", category="Heart Rate")

def test_step_tracking():
    """Test Step Tracking endpoints"""
    print("\n👟 Testing Step Tracking Endpoints...")
    
    # 1. Add steps
    steps_data = {
        "user_id": TEST_USER_ID,
        "steps": 8500,
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "calories_burned": 340.0,
        "distance_miles": 4.25
    }
    test_endpoint("POST", "/steps", steps_data, category="Step Tracking")
    
    # 2. Get today's steps
    test_endpoint("GET", f"/steps/{TEST_USER_ID}/today", category="Step Tracking")
    
    # 3. Get step history
    test_endpoint("GET", f"/steps/{TEST_USER_ID}/history", category="Step Tracking")
    
    # 4. Get weekly steps
    test_endpoint("GET", f"/steps/{TEST_USER_ID}/weekly", category="Step Tracking")
    
    # 5. Get monthly steps
    test_endpoint("GET", f"/steps/{TEST_USER_ID}/monthly", category="Step Tracking")
    
    # 6. Get step settings
    test_endpoint("GET", f"/steps/settings/{TEST_USER_ID}", category="Step Tracking")
    
    # 7. Delete daily history
    test_endpoint("DELETE", f"/steps/{TEST_USER_ID}/history/daily", category="Step Tracking")

def test_gamification():
    """Test Gamification endpoints"""
    print("\n🏆 Testing Gamification Endpoints...")
    
    # 1. Get badges
    test_endpoint("GET", "/gamification/badges", category="Gamification")
    
    # 2. Get user badges
    test_endpoint("GET", f"/gamification/user-badges/{TEST_USER_ID}", category="Gamification")
    
    # 3. Get streak
    test_endpoint("GET", f"/gamification/streak/{TEST_USER_ID}", category="Gamification")
    
    # 4. Get gamification summary
    test_endpoint("GET", f"/gamification/summary/{TEST_USER_ID}", category="Gamification")
    
    # 5. Get leaderboard
    test_endpoint("GET", "/gamification/leaderboard", category="Gamification")
    
    # 6. Reset gamification (use test_user to avoid affecting real data)
    test_endpoint("DELETE", f"/gamification/reset/test_user", category="Gamification")

def test_challenges():
    """Test Challenge endpoints"""
    print("\n🎯 Testing Challenge Endpoints...")
    
    # 1. Get daily challenges
    test_endpoint("GET", f"/challenges/daily/{TEST_USER_ID}", category="Challenges")
    
    # 2. Get weekly challenges
    test_endpoint("GET", f"/challenges/weekly/{TEST_USER_ID}", category="Challenges")
    
    # 3. Reset challenges (use test_user to avoid affecting real data)
    test_endpoint("DELETE", f"/challenges/reset/test_user", category="Challenges")

def test_weight_training():
    """Test Weight Training endpoints"""
    print("\n🏋️ Testing Weight Training Endpoints...")
    
    # 1. Get exercises
    test_endpoint("GET", "/weight-training/exercises", category="Weight Training")
    
    # 2. Get programs
    test_endpoint("GET", "/weight-training/programs", category="Weight Training")
    
    # 3. Get history
    test_endpoint("GET", f"/weight-training/history/{TEST_USER_ID}", category="Weight Training")

def test_premium_membership():
    """Test Premium/Membership endpoints"""
    print("\n💎 Testing Premium/Membership Endpoints...")
    
    # 1. Get membership status
    test_endpoint("GET", f"/membership/status/{TEST_USER_ID}", category="Premium/Membership")
    
    # 2. Get pricing
    test_endpoint("GET", "/membership/pricing", category="Premium/Membership")

def test_ai_features():
    """Test AI Features endpoints"""
    print("\n🤖 Testing AI Features Endpoints...")
    
    # Test AI food analysis with simple test image
    ai_data = {
        "user_id": TEST_USER_ID,
        "image_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        "meal_category": "lunch"
    }
    test_endpoint("POST", "/analyze-food", ai_data, category="AI Features")

def print_comprehensive_summary():
    """Print comprehensive test summary"""
    print("\n" + "="*80)
    print("🔍 COMPREHENSIVE BACKEND API TEST RESULTS")
    print("="*80)
    
    print(f"\n📊 OVERALL STATISTICS:")
    print(f"   Total Endpoints Tested: {test_results['total_tests']}")
    print(f"   ✅ Passed: {test_results['passed_tests']}")
    print(f"   ❌ Failed: {test_results['failed_tests']}")
    
    success_rate = (test_results['passed_tests'] / test_results['total_tests'] * 100) if test_results['total_tests'] > 0 else 0
    print(f"   📈 Success Rate: {success_rate:.1f}%")
    
    print(f"\n📋 RESULTS BY CATEGORY:")
    for category, stats in test_results['categories'].items():
        category_rate = (stats['passed'] / stats['total'] * 100) if stats['total'] > 0 else 0
        status_icon = "✅" if stats['failed'] == 0 else "❌" if stats['passed'] == 0 else "⚠️"
        print(f"   {status_icon} {category}: {stats['passed']}/{stats['total']} ({category_rate:.1f}%)")
    
    if test_results['failed_tests'] > 0:
        print(f"\n❌ FAILED ENDPOINTS ({test_results['failed_tests']}):")
        for test in test_results['test_details']:
            if test['status'] == 'FAIL':
                print(f"   • {test['category']} - {test['method']} {test['endpoint']}")
                print(f"     Error: {test['details']}")
    
    print(f"\n✅ SUCCESSFUL ENDPOINTS ({test_results['passed_tests']}):")
    current_category = None
    for test in test_results['test_details']:
        if test['status'] == 'PASS':
            if test['category'] != current_category:
                current_category = test['category']
                print(f"\n   {current_category}:")
            print(f"     • {test['method']} {test['endpoint']}")
    
    print("\n" + "="*80)
    
    # Final assessment
    if success_rate >= 95:
        print("🟢 EXCELLENT: Backend API is fully functional and ready for production!")
    elif success_rate >= 85:
        print("🟡 GOOD: Backend API is mostly functional with minor issues to address.")
    elif success_rate >= 70:
        print("🟠 FAIR: Backend API has several issues that need attention.")
    else:
        print("🔴 POOR: Backend API has major issues that must be resolved.")
    
    print("="*80)

def main():
    """Run comprehensive backend API tests"""
    print("🚀 COMPREHENSIVE FITTRAX BACKEND API TESTING")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test User ID: {TEST_USER_ID}")
    print("="*80)
    
    # Run all test categories as specified in user request
    test_health_and_dashboard()
    test_user_profile()
    test_meals_and_nutrition()
    test_water_hydration()
    test_workouts()
    test_heart_rate()
    test_step_tracking()
    test_gamification()
    test_challenges()
    test_weight_training()
    test_premium_membership()
    test_ai_features()
    
    # Print comprehensive summary
    print_comprehensive_summary()
    
    # Return exit code based on results
    if test_results['failed_tests'] > 0:
        print(f"\n⚠️  {test_results['failed_tests']} endpoints failed. Review errors above.")
        return 1
    else:
        print(f"\n🎉 All {test_results['passed_tests']} endpoints passed successfully!")
        return 0

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)