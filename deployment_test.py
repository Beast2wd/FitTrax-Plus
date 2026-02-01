#!/usr/bin/env python3
"""
FitTrax+ API Deployment Readiness Test
Focused test avoiding rate limiting issues
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any

class FitTrax+DeploymentTester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.api_url = f"{self.base_url}/api"
        self.session = requests.Session()
        self.access_token = None
        self.test_user_id = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None, params: Dict = None) -> requests.Response:
        """Make HTTP request with proper error handling"""
        url = f"{self.api_url}{endpoint}"
        
        # Add auth header if token available
        if self.access_token:
            if headers is None:
                headers = {}
            headers["Authorization"] = f"Bearer {self.access_token}"
            
        try:
            if method.upper() == "GET":
                response = self.session.get(url, params=params, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=headers, params=params, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request failed for {method} {url}: {str(e)}")
            raise

    def test_critical_endpoints(self):
        """Test critical endpoints for deployment readiness"""
        
        # 1. Health Check
        try:
            response = self.make_request("GET", "/health")
            if response.status_code == 200 and response.json().get("status") == "healthy":
                self.log_test("Health Check", True, "API is healthy")
            else:
                self.log_test("Health Check", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")

        # Wait to avoid rate limiting
        time.sleep(2)

        # 2. Try to register a new user (with unique timestamp)
        timestamp = int(time.time())
        test_email = f"deploy_test_{timestamp}@example.com"
        
        try:
            register_data = {
                "email": test_email,
                "password": "SecurePass123",
                "name": "Deploy Tester"
            }
            
            response = self.make_request("POST", "/auth/register", register_data)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data:
                    self.access_token = data["access_token"]
                    self.log_test("User Registration", True, f"User registered: {test_email}")
                else:
                    self.log_test("User Registration", False, f"Missing access_token: {data}")
            elif response.status_code == 429:
                self.log_test("User Registration", False, "Rate limited - will test with existing functionality")
            else:
                self.log_test("User Registration", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("User Registration", False, f"Exception: {str(e)}")

        # Wait to avoid rate limiting
        time.sleep(2)

        # 3. Test /auth/me if we have a token
        if self.access_token:
            try:
                response = self.make_request("GET", "/auth/me")
                if response.status_code == 200:
                    data = response.json()
                    if "user_id" in data:
                        self.test_user_id = data["user_id"]
                        self.log_test("Get Current User", True, f"User ID: {data['user_id']}")
                    else:
                        self.log_test("Get Current User", False, f"Missing user_id: {data}")
                else:
                    self.log_test("Get Current User", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Get Current User", False, f"Exception: {str(e)}")

        # 4. Test Food Search (no auth required)
        try:
            response = self.make_request("GET", "/nutrition/foods/search", params={"q": "chicken"})
            if response.status_code == 200:
                data = response.json()
                if "foods" in data and len(data["foods"]) > 0:
                    self.log_test("Food Search", True, f"Found {len(data['foods'])} foods")
                else:
                    self.log_test("Food Search", False, "No foods found")
            else:
                self.log_test("Food Search", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Food Search", False, f"Exception: {str(e)}")

        # 5. Test User Profile if we have user_id
        if self.test_user_id:
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
                    "activity_level": "moderate"
                }
                
                response = self.make_request("POST", "/user/profile", profile_data)
                if response.status_code == 200:
                    self.log_test("Create User Profile", True, "Profile created successfully")
                else:
                    self.log_test("Create User Profile", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Create User Profile", False, f"Exception: {str(e)}")

        # 6. Test Steps Logging if we have user_id
        if self.test_user_id:
            try:
                steps_data = {
                    "user_id": self.test_user_id,
                    "steps": 5000,
                    "date": datetime.now().strftime("%Y-%m-%d"),
                    "source": "manual"
                }
                
                response = self.make_request("POST", "/steps", steps_data)
                if response.status_code == 200:
                    self.log_test("Log Steps", True, "Steps logged successfully")
                else:
                    self.log_test("Log Steps", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Log Steps", False, f"Exception: {str(e)}")

        # 7. Test Dashboard if we have user_id
        if self.test_user_id:
            try:
                response = self.make_request("GET", f"/dashboard/{self.test_user_id}")
                if response.status_code == 200:
                    self.log_test("Dashboard Data", True, "Dashboard data retrieved")
                else:
                    self.log_test("Dashboard Data", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Dashboard Data", False, f"Exception: {str(e)}")

        # 8. Test Security - Invalid Token
        try:
            original_token = self.access_token
            self.access_token = "invalid_token_12345"
            
            response = self.make_request("GET", "/auth/me")
            
            if response.status_code == 401:
                self.log_test("Invalid Token Rejection", True, "Invalid token properly rejected")
            else:
                self.log_test("Invalid Token Rejection", False, f"Status: {response.status_code}")
                
            self.access_token = original_token
            
        except Exception as e:
            self.log_test("Invalid Token Rejection", False, f"Exception: {str(e)}")

    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "=" * 80)
        print("📋 FITTRAX API DEPLOYMENT READINESS SUMMARY")
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
        
        # Deployment Assessment
        print(f"\n🚀 DEPLOYMENT READINESS:")
        if success_rate >= 90:
            print("   🟢 EXCELLENT - API is deployment ready!")
        elif success_rate >= 75:
            print("   🟡 GOOD - Minor issues to address")
        elif success_rate >= 50:
            print("   🟠 FAIR - Several issues need fixing")
        else:
            print("   🔴 POOR - Major issues must be resolved")
        
        print("=" * 80)

    def run_deployment_test(self):
        """Run deployment readiness test"""
        print("🚀 FitTrax+ API Deployment Readiness Test")
        print(f"🌐 Testing API at: {self.api_url}")
        print("=" * 80)
        
        self.test_critical_endpoints()
        self.generate_summary()

if __name__ == "__main__":
    BACKEND_URL = "https://fitness-journey-294.preview.emergentagent.com"
    
    tester = FitTrax+DeploymentTester(BACKEND_URL)
    tester.run_deployment_test()