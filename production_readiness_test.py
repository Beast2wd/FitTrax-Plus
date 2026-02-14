#!/usr/bin/env python3
"""
FitTrax API Final Production Readiness Test
Focused on specific production requirements from review request
"""

import requests
import json
import base64
import time
from datetime import datetime
import uuid

# Configuration from frontend .env
BASE_URL = "https://fitness-diary-19.preview.emergentagent.com/api"
TEST_USER_EMAIL = f"prod_test_{int(time.time())}@fittrax.com"
TEST_USER_PASSWORD = "SecurePass123!"

class ProductionReadinessTest:
    def __init__(self):
        self.base_url = BASE_URL
        self.access_token = None
        self.user_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   {details}")
    
    def make_request(self, method, endpoint, data=None, headers=None):
        """Make HTTP request"""
        url = f"{self.base_url}{endpoint}"
        
        if headers is None:
            headers = {}
        
        if self.access_token and "Authorization" not in headers:
            headers["Authorization"] = f"Bearer {self.access_token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                headers["Content-Type"] = "application/json"
                response = requests.post(url, json=data, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except Exception as e:
            print(f"Request failed: {e}")
            return None
    
    def test_health_admin_endpoints(self):
        """Test health and admin endpoints as specified"""
        print("\n🏥 HEALTH & ADMIN ENDPOINTS")
        
        # Test GET /api/health
        response = self.make_request("GET", "/health")
        if response and response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                self.log_test("GET /api/health", True, "Returns healthy status")
            else:
                self.log_test("GET /api/health", False, f"Unexpected response: {data}")
        else:
            self.log_test("GET /api/health", False, f"Failed: {response.status_code if response else 'No response'}")
        
        # Test GET /api/admin/health-check
        response = self.make_request("GET", "/admin/health-check")
        if response and response.status_code == 200:
            data = response.json()
            required_fields = ["status", "database", "environment", "config_issues"]
            
            has_status = data.get("status") == "healthy"
            has_database = "database" in data and data["database"] == "connected"
            has_environment = "environment" in data and data["environment"] == "development"
            has_config_issues = "config_issues" in data
            
            if has_status and has_database and has_environment and has_config_issues:
                self.log_test("GET /api/admin/health-check", True, 
                            f"Status: {data['status']}, DB: {data['database']}, Env: {data['environment']}, Issues: {data.get('config_issues', 0)}")
            else:
                self.log_test("GET /api/admin/health-check", False, f"Missing required fields: {data}")
        else:
            self.log_test("GET /api/admin/health-check", False, f"Admin endpoint not available: {response.status_code if response else 'No response'}")
    
    def test_security_requirements(self):
        """Test security requirements"""
        print("\n🔒 SECURITY TESTS")
        
        # Register new user
        register_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "name": "Production Test User"
        }
        
        response = self.make_request("POST", "/auth/register", register_data)
        if response and response.status_code == 200:
            data = response.json()
            if "access_token" in data:
                self.access_token = data["access_token"]
                self.log_test("POST /api/auth/register", True, "New user registered")
            else:
                self.log_test("POST /api/auth/register", False, "No access token")
                return
        else:
            self.log_test("POST /api/auth/register", False, f"Registration failed: {response.status_code if response else 'No response'}")
            return
        
        # Login with new user
        login_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        if response and response.status_code == 200:
            data = response.json()
            if "access_token" in data:
                self.access_token = data["access_token"]
                self.log_test("POST /api/auth/login", True, "Login successful")
            else:
                self.log_test("POST /api/auth/login", False, "No access token in login")
        else:
            self.log_test("POST /api/auth/login", False, f"Login failed: {response.status_code if response else 'No response'}")
        
        # Test GET /api/auth/me with Bearer token
        response = self.make_request("GET", "/auth/me")
        if response and response.status_code == 200:
            data = response.json()
            if "user_id" in data:
                self.user_id = data["user_id"]
                self.log_test("GET /api/auth/me with Bearer token", True, f"User authenticated: {data.get('email')}")
            else:
                self.log_test("GET /api/auth/me with Bearer token", False, "No user_id in response")
        else:
            self.log_test("GET /api/auth/me with Bearer token", False, f"Auth/me failed: {response.status_code if response else 'No response'}")
        
        # Test rate limiting (10 rapid login attempts should return 429)
        print("   Testing rate limiting (10 rapid attempts)...")
        rate_limited = False
        
        for i in range(12):
            bad_login = {
                "email": "nonexistent@test.com",
                "password": "wrongpassword"
            }
            
            response = self.make_request("POST", "/auth/login", bad_login)
            if response and response.status_code == 429:
                rate_limited = True
                break
            time.sleep(0.1)
        
        if rate_limited:
            self.log_test("Rate limiting (10 attempts → 429)", True, "Rate limit triggered correctly")
        else:
            self.log_test("Rate limiting (10 attempts → 429)", False, "Rate limiting not working")
    
    def test_core_features(self):
        """Test core features"""
        print("\n🚀 CORE FEATURES")
        
        if not self.user_id:
            self.log_test("Core Features", False, "Cannot test - no user_id")
            return
        
        # Test POST /api/analyze-food (AI food scanner)
        test_image_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        
        food_data = {
            "user_id": self.user_id,
            "image_base64": test_image_b64,
            "meal_category": "lunch"
        }
        
        response = self.make_request("POST", "/analyze-food", food_data)
        if response and response.status_code == 200:
            data = response.json()
            if "meal" in data and "analysis" in data:
                analysis = data["analysis"]
                self.log_test("POST /api/analyze-food (AI scanner)", True, 
                            f"AI working: {analysis.get('food_name', 'Unknown')} - {analysis.get('calories', 0)} cal")
            else:
                self.log_test("POST /api/analyze-food (AI scanner)", False, "Missing meal/analysis data")
        else:
            self.log_test("POST /api/analyze-food (AI scanner)", False, f"AI scanner failed: {response.status_code if response else 'No response'}")
        
        # Test GET /api/steps/{user_id}/today
        response = self.make_request("GET", f"/steps/{self.user_id}/today")
        if response and response.status_code == 200:
            self.log_test("GET /api/steps/{user_id}/today", True, "Today's steps endpoint working")
        else:
            self.log_test("GET /api/steps/{user_id}/today", False, f"Steps today failed: {response.status_code if response else 'No response'}")
        
        # Test POST /api/steps with step data
        step_data = {
            "user_id": self.user_id,
            "steps": 8000,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "calories_burned": 320,
            "distance_miles": 4.0
        }
        
        response = self.make_request("POST", "/steps", step_data)
        if response and response.status_code == 200:
            self.log_test("POST /api/steps", True, "Step data saved successfully")
        else:
            self.log_test("POST /api/steps", False, f"Steps POST failed: {response.status_code if response else 'No response'}")
        
        # Test GET /api/dashboard/{user_id}
        response = self.make_request("GET", f"/dashboard/{self.user_id}")
        if response and response.status_code == 200:
            data = response.json()
            # Check if dashboard has meaningful data
            data_str = str(data).lower()
            has_dashboard_data = any(key in data_str for key in ["calories", "steps", "workouts", "water"])
            
            if has_dashboard_data:
                self.log_test("GET /api/dashboard/{user_id}", True, "Dashboard returns comprehensive data")
            else:
                self.log_test("GET /api/dashboard/{user_id}", False, "Dashboard data insufficient")
        else:
            self.log_test("GET /api/dashboard/{user_id}", False, f"Dashboard failed: {response.status_code if response else 'No response'}")
    
    def test_error_handling(self):
        """Test error handling"""
        print("\n⚠️ ERROR HANDLING")
        
        # Test 404 for non-existent routes
        response = self.make_request("GET", "/nonexistent-route")
        if response and response.status_code == 404:
            self.log_test("404 handling", True, "Non-existent routes return 404")
        else:
            self.log_test("404 handling", False, f"Expected 404, got: {response.status_code if response else 'No response'}")
        
        # Test 422 for invalid input validation
        invalid_data = {
            "user_id": "",  # Invalid
            "meal_category": "invalid_category"
            # Missing image_base64
        }
        
        response = self.make_request("POST", "/analyze-food", invalid_data)
        if response and response.status_code in [400, 422]:
            self.log_test("422 input validation", True, f"Invalid input rejected with {response.status_code}")
        else:
            self.log_test("422 input validation", False, f"Expected 400/422, got: {response.status_code if response else 'No response'}")
        
        # Test 401 for protected routes without token
        response = self.make_request("GET", "/auth/me", headers={"Authorization": ""})
        if response and response.status_code == 401:
            self.log_test("401 unauthorized access", True, "Protected routes require authentication")
        else:
            self.log_test("401 unauthorized access", False, f"Expected 401, got: {response.status_code if response else 'No response'}")
    
    def test_database_connectivity(self):
        """Test database connectivity"""
        print("\n💾 DATABASE CONNECTIVITY")
        
        if not self.user_id:
            self.log_test("Database connectivity", False, "Cannot test - no user_id")
            return
        
        # Test CRUD operations
        profile_data = {
            "user_id": self.user_id,
            "name": "Production Test User",
            "age": 28,
            "gender": "male",
            "height_feet": 6,
            "height_inches": 0,
            "weight": 175,
            "goal_weight": 170,
            "activity_level": "active"
        }
        
        # CREATE
        response = self.make_request("POST", "/user/profile", profile_data)
        if response and response.status_code == 200:
            self.log_test("Database CRUD - CREATE", True, "Profile created successfully")
        else:
            self.log_test("Database CRUD - CREATE", False, f"Profile creation failed: {response.status_code if response else 'No response'}")
            return
        
        # READ
        response = self.make_request("GET", f"/user/profile/{self.user_id}")
        if response and response.status_code == 200:
            data = response.json()
            if data.get("name") == "Production Test User":
                self.log_test("Database CRUD - READ", True, "Profile retrieved and data persisted")
            else:
                self.log_test("Database CRUD - READ", False, "Data persistence issue")
        else:
            self.log_test("Database CRUD - READ", False, f"Profile retrieval failed: {response.status_code if response else 'No response'}")
    
    def run_production_tests(self):
        """Run all production readiness tests"""
        print("🚀 FITTRAX API - FINAL PRODUCTION READINESS TEST")
        print("=" * 60)
        print(f"Backend URL: {self.base_url}")
        print("=" * 60)
        
        start_time = time.time()
        
        # Run all test categories
        self.test_health_admin_endpoints()
        self.test_security_requirements()
        self.test_core_features()
        self.test_error_handling()
        self.test_database_connectivity()
        
        # Generate final assessment
        end_time = time.time()
        duration = round(end_time - start_time, 2)
        
        print("\n" + "=" * 60)
        print("📊 FINAL PRODUCTION READINESS ASSESSMENT")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        success_rate = round((passed / total) * 100, 1) if total > 0 else 0
        
        print(f"📈 Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {total - passed}")
        print(f"📊 Success Rate: {success_rate}%")
        print(f"⏱️ Duration: {duration}s")
        
        # Show failed tests
        failed_tests = [r for r in self.test_results if not r["success"]]
        if failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"   • {test['test']}: {test['details']}")
        
        # Production readiness verdict
        print(f"\n🎯 PRODUCTION READINESS VERDICT:")
        
        # Check critical requirements
        critical_tests = [
            "GET /api/health",
            "POST /api/auth/register", 
            "POST /api/auth/login",
            "GET /api/auth/me with Bearer token",
            "POST /api/analyze-food (AI scanner)",
            "Database CRUD - CREATE",
            "Database CRUD - READ"
        ]
        
        critical_passed = sum(1 for r in self.test_results 
                            if r["test"] in critical_tests and r["success"])
        critical_total = len([r for r in self.test_results if r["test"] in critical_tests])
        
        if success_rate >= 95 and critical_passed == critical_total:
            print("🟢 PRODUCTION READY ✅")
            print("   • All critical systems operational")
            print("   • Health endpoints working")
            print("   • Authentication system functional") 
            print("   • AI food scanner working")
            print("   • Database connectivity confirmed")
            print("   • Error handling proper")
            return True
        elif success_rate >= 85:
            print("🟡 NEEDS MINOR FIXES ⚠️")
            print("   • Core functionality working")
            print("   • Some non-critical issues found")
            return False
        else:
            print("🔴 NOT PRODUCTION READY ❌")
            print("   • Critical issues must be resolved")
            return False

if __name__ == "__main__":
    tester = ProductionReadinessTest()
    is_ready = tester.run_production_tests()
    
    print(f"\n{'🎉 READY FOR DEPLOYMENT!' if is_ready else '⚠️ REQUIRES FIXES BEFORE DEPLOYMENT'}")