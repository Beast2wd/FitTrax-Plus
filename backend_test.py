#!/usr/bin/env python3
"""
FitTrax Security Testing Suite
Tests authentication, rate limiting, input validation, and CORS
"""

import requests
import json
import time
import base64
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://health-hub-136.preview.emergentagent.com/api"
TIMEOUT = 30

class SecurityTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.timeout = TIMEOUT
        self.test_results = []
        self.access_token = None
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if not success and response_data:
            print(f"   Response: {response_data}")
        print()

    def test_health_endpoint(self):
        """Test basic health endpoint"""
        try:
            response = self.session.get(f"{BASE_URL}/health")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_test("Health Check", True, "Backend is healthy")
                    return True
                else:
                    self.log_test("Health Check", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Health Check", False, f"Status code: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")
            return False

    def test_user_registration(self):
        """Test user registration with valid data"""
        try:
            # Generate unique email for testing
            timestamp = int(time.time())
            test_data = {
                "email": f"security_test_{timestamp}@example.com",
                "password": "SecurePass123",
                "name": "Security Tester"
            }
            
            response = self.session.post(f"{BASE_URL}/auth/register", json=test_data)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "refresh_token" in data:
                    self.access_token = data["access_token"]
                    self.log_test("User Registration", True, 
                                f"Successfully registered user: {test_data['email']}")
                    return True
                else:
                    self.log_test("User Registration", False, 
                                "Missing tokens in response", data)
                    return False
            else:
                self.log_test("User Registration", False, 
                            f"Status code: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("User Registration", False, f"Exception: {str(e)}")
            return False

    def test_user_login(self):
        """Test user login with valid credentials"""
        try:
            # Use the same credentials from registration
            timestamp = int(time.time())
            login_data = {
                "email": f"security_test_{timestamp}@example.com",
                "password": "SecurePass123"
            }
            
            # First register the user
            self.session.post(f"{BASE_URL}/auth/register", json={
                "email": login_data["email"],
                "password": login_data["password"],
                "name": "Security Tester"
            })
            
            # Now test login
            response = self.session.post(f"{BASE_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "refresh_token" in data:
                    self.access_token = data["access_token"]
                    self.log_test("User Login", True, 
                                f"Successfully logged in user: {login_data['email']}")
                    return True
                else:
                    self.log_test("User Login", False, 
                                "Missing tokens in response", data)
                    return False
            else:
                self.log_test("User Login", False, 
                            f"Status code: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("User Login", False, f"Exception: {str(e)}")
            return False

    def test_protected_endpoint(self):
        """Test /auth/me endpoint with authentication"""
        try:
            if not self.access_token:
                # Try to get a token first
                if not self.test_user_registration():
                    self.log_test("Protected Endpoint (/auth/me)", False, 
                                "No access token available")
                    return False
            
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = self.session.get(f"{BASE_URL}/auth/me", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "user_id" in data and "email" in data:
                    self.log_test("Protected Endpoint (/auth/me)", True, 
                                f"Successfully accessed protected endpoint")
                    return True
                else:
                    self.log_test("Protected Endpoint (/auth/me)", False, 
                                "Missing user data in response", data)
                    return False
            else:
                self.log_test("Protected Endpoint (/auth/me)", False, 
                            f"Status code: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Protected Endpoint (/auth/me)", False, f"Exception: {str(e)}")
            return False

    def test_rate_limiting(self):
        """Test rate limiting on login endpoint"""
        try:
            login_data = {
                "email": "rate_limit_test@example.com",
                "password": "WrongPassword123"
            }
            
            # Make rapid requests to trigger rate limiting
            rate_limited = False
            for i in range(15):  # Try 15 requests
                response = self.session.post(f"{BASE_URL}/auth/login", json=login_data)
                
                if response.status_code == 429:  # Too Many Requests
                    rate_limited = True
                    self.log_test("Rate Limiting", True, 
                                f"Rate limiting triggered after {i+1} requests")
                    return True
                
                # Small delay between requests
                time.sleep(0.1)
            
            if not rate_limited:
                self.log_test("Rate Limiting", False, 
                            "Rate limiting not triggered after 15 requests")
                return False
                
        except Exception as e:
            self.log_test("Rate Limiting", False, f"Exception: {str(e)}")
            return False

    def test_weak_password_validation(self):
        """Test password validation with weak password"""
        try:
            test_data = {
                "email": "weak_password_test@example.com",
                "password": "123",  # Weak password
                "name": "Test User"
            }
            
            response = self.session.post(f"{BASE_URL}/auth/register", json=test_data)
            
            if response.status_code == 422:  # Validation Error
                self.log_test("Weak Password Validation", True, 
                            "Weak password correctly rejected")
                return True
            elif response.status_code == 400:
                # Check if it's a validation error
                try:
                    data = response.json()
                    if "password" in str(data).lower():
                        self.log_test("Weak Password Validation", True, 
                                    "Weak password correctly rejected")
                        return True
                except:
                    pass
                
            self.log_test("Weak Password Validation", False, 
                        f"Weak password not rejected. Status: {response.status_code}", 
                        response.text)
            return False
                
        except Exception as e:
            self.log_test("Weak Password Validation", False, f"Exception: {str(e)}")
            return False

    def test_invalid_email_validation(self):
        """Test email validation with invalid email"""
        try:
            test_data = {
                "email": "not-an-email",  # Invalid email
                "password": "SecurePass123",
                "name": "Test User"
            }
            
            response = self.session.post(f"{BASE_URL}/auth/register", json=test_data)
            
            if response.status_code == 422:  # Validation Error
                self.log_test("Invalid Email Validation", True, 
                            "Invalid email correctly rejected")
                return True
            elif response.status_code == 400:
                # Check if it's a validation error
                try:
                    data = response.json()
                    if "email" in str(data).lower():
                        self.log_test("Invalid Email Validation", True, 
                                    "Invalid email correctly rejected")
                        return True
                except:
                    pass
                
            self.log_test("Invalid Email Validation", False, 
                        f"Invalid email not rejected. Status: {response.status_code}", 
                        response.text)
            return False
                
        except Exception as e:
            self.log_test("Invalid Email Validation", False, f"Exception: {str(e)}")
            return False

    def test_cors_headers(self):
        """Test CORS headers in response"""
        try:
            response = self.session.get(f"{BASE_URL}/health")
            
            cors_headers = [
                "Access-Control-Allow-Origin",
                "Access-Control-Allow-Methods", 
                "Access-Control-Allow-Headers"
            ]
            
            found_cors = False
            cors_details = []
            
            for header in cors_headers:
                if header in response.headers:
                    found_cors = True
                    cors_details.append(f"{header}: {response.headers[header]}")
            
            if found_cors:
                self.log_test("CORS Headers", True, 
                            f"CORS headers found: {', '.join(cors_details)}")
                return True
            else:
                self.log_test("CORS Headers", False, 
                            "No CORS headers found in response")
                return False
                
        except Exception as e:
            self.log_test("CORS Headers", False, f"Exception: {str(e)}")
            return False

    def test_unauthorized_access(self):
        """Test accessing protected endpoint without token"""
        try:
            response = self.session.get(f"{BASE_URL}/auth/me")
            
            if response.status_code == 401:  # Unauthorized
                self.log_test("Unauthorized Access Protection", True, 
                            "Protected endpoint correctly requires authentication")
                return True
            else:
                self.log_test("Unauthorized Access Protection", False, 
                            f"Protected endpoint accessible without auth. Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Unauthorized Access Protection", False, f"Exception: {str(e)}")
            return False

    def test_invalid_token_access(self):
        """Test accessing protected endpoint with invalid token"""
        try:
            headers = {"Authorization": "Bearer invalid_token_12345"}
            response = self.session.get(f"{BASE_URL}/auth/me", headers=headers)
            
            if response.status_code == 401:  # Unauthorized
                self.log_test("Invalid Token Protection", True, 
                            "Invalid token correctly rejected")
                return True
            else:
                self.log_test("Invalid Token Protection", False, 
                            f"Invalid token not rejected. Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Invalid Token Protection", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all security tests"""
        print("🔒 FitTrax Security Testing Suite")
        print("=" * 50)
        print()
        
        # Test basic connectivity
        if not self.test_health_endpoint():
            print("❌ Backend not accessible. Stopping tests.")
            return False
        
        # Authentication Tests
        print("🔐 Authentication Tests")
        print("-" * 30)
        self.test_user_registration()
        self.test_user_login()
        self.test_protected_endpoint()
        self.test_unauthorized_access()
        self.test_invalid_token_access()
        print()
        
        # Rate Limiting Tests
        print("⏱️  Rate Limiting Tests")
        print("-" * 30)
        self.test_rate_limiting()
        print()
        
        # Input Validation Tests
        print("🛡️  Input Validation Tests")
        print("-" * 30)
        self.test_weak_password_validation()
        self.test_invalid_email_validation()
        print()
        
        # CORS Tests
        print("🌐 CORS Tests")
        print("-" * 30)
        self.test_cors_headers()
        print()
        
        # Summary
        self.print_summary()
        
        return True

    def print_summary(self):
        """Print test summary"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print("📊 Test Summary")
        print("=" * 50)
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print()
        
        if failed_tests > 0:
            print("❌ Failed Tests:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   - {result['test']}: {result['details']}")
            print()
        
        # Security Assessment
        critical_tests = [
            "User Registration",
            "User Login", 
            "Protected Endpoint (/auth/me)",
            "Unauthorized Access Protection",
            "Invalid Token Protection",
            "Weak Password Validation",
            "Invalid Email Validation"
        ]
        
        critical_passed = sum(1 for result in self.test_results 
                            if result["test"] in critical_tests and result["success"])
        
        print("🔒 Security Assessment:")
        if critical_passed == len(critical_tests):
            print("   ✅ All critical security features working correctly")
        else:
            print(f"   ⚠️  {len(critical_tests) - critical_passed} critical security issues found")
        
        print()

def main():
    """Main test runner"""
    tester = SecurityTester()
    tester.run_all_tests()

if __name__ == "__main__":
    main()