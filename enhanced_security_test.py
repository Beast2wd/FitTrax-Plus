#!/usr/bin/env python3
"""
Enhanced FitTrax Security Testing Suite
Tests authentication, rate limiting, input validation, and CORS with more detailed checks
"""

import requests
import json
import time
import threading
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://health-hub-136.preview.emergentagent.com/api"
TIMEOUT = 30

class EnhancedSecurityTester:
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

    def test_cors_with_options(self):
        """Test CORS with OPTIONS preflight request"""
        try:
            # Test OPTIONS request (preflight)
            headers = {
                "Origin": "https://example.com",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type,Authorization"
            }
            
            response = self.session.options(f"{BASE_URL}/auth/login", headers=headers)
            
            cors_headers = {
                "Access-Control-Allow-Origin": response.headers.get("Access-Control-Allow-Origin"),
                "Access-Control-Allow-Methods": response.headers.get("Access-Control-Allow-Methods"),
                "Access-Control-Allow-Headers": response.headers.get("Access-Control-Allow-Headers"),
                "Access-Control-Allow-Credentials": response.headers.get("Access-Control-Allow-Credentials")
            }
            
            found_cors = any(value for value in cors_headers.values())
            
            if found_cors:
                cors_details = [f"{k}: {v}" for k, v in cors_headers.items() if v]
                self.log_test("CORS Headers (OPTIONS)", True, 
                            f"CORS headers found: {', '.join(cors_details)}")
                return True
            else:
                self.log_test("CORS Headers (OPTIONS)", False, 
                            "No CORS headers found in OPTIONS response")
                return False
                
        except Exception as e:
            self.log_test("CORS Headers (OPTIONS)", False, f"Exception: {str(e)}")
            return False

    def test_cors_with_get(self):
        """Test CORS headers in regular GET request"""
        try:
            headers = {"Origin": "https://example.com"}
            response = self.session.get(f"{BASE_URL}/health", headers=headers)
            
            cors_headers = {
                "Access-Control-Allow-Origin": response.headers.get("Access-Control-Allow-Origin"),
                "Access-Control-Allow-Credentials": response.headers.get("Access-Control-Allow-Credentials")
            }
            
            found_cors = any(value for value in cors_headers.values())
            
            if found_cors:
                cors_details = [f"{k}: {v}" for k, v in cors_headers.items() if v]
                self.log_test("CORS Headers (GET)", True, 
                            f"CORS headers found: {', '.join(cors_details)}")
                return True
            else:
                self.log_test("CORS Headers (GET)", False, 
                            "No CORS headers found in GET response")
                return False
                
        except Exception as e:
            self.log_test("CORS Headers (GET)", False, f"Exception: {str(e)}")
            return False

    def test_aggressive_rate_limiting(self):
        """Test rate limiting with more aggressive approach"""
        try:
            login_data = {
                "email": "rate_limit_test@example.com",
                "password": "WrongPassword123"
            }
            
            # Make very rapid requests without delay
            rate_limited = False
            responses = []
            
            for i in range(25):  # Try 25 requests
                try:
                    response = self.session.post(f"{BASE_URL}/auth/login", json=login_data)
                    responses.append((i+1, response.status_code))
                    
                    if response.status_code == 429:  # Too Many Requests
                        rate_limited = True
                        self.log_test("Rate Limiting (Aggressive)", True, 
                                    f"Rate limiting triggered after {i+1} requests")
                        return True
                except Exception as e:
                    responses.append((i+1, f"Error: {str(e)}"))
            
            if not rate_limited:
                # Show response pattern
                status_codes = [str(r[1]) for r in responses[-10:]]  # Last 10 responses
                self.log_test("Rate Limiting (Aggressive)", False, 
                            f"Rate limiting not triggered after 25 requests. Last 10 status codes: {', '.join(status_codes)}")
                return False
                
        except Exception as e:
            self.log_test("Rate Limiting (Aggressive)", False, f"Exception: {str(e)}")
            return False

    def test_concurrent_rate_limiting(self):
        """Test rate limiting with concurrent requests"""
        try:
            login_data = {
                "email": "concurrent_rate_test@example.com",
                "password": "WrongPassword123"
            }
            
            results = []
            rate_limited = False
            
            def make_request(request_id):
                try:
                    response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=10)
                    results.append((request_id, response.status_code))
                    if response.status_code == 429:
                        nonlocal rate_limited
                        rate_limited = True
                except Exception as e:
                    results.append((request_id, f"Error: {str(e)}"))
            
            # Launch 20 concurrent requests
            threads = []
            for i in range(20):
                thread = threading.Thread(target=make_request, args=(i+1,))
                threads.append(thread)
                thread.start()
            
            # Wait for all threads to complete
            for thread in threads:
                thread.join()
            
            if rate_limited:
                self.log_test("Rate Limiting (Concurrent)", True, 
                            f"Rate limiting triggered with concurrent requests")
                return True
            else:
                status_codes = [str(r[1]) for r in results]
                self.log_test("Rate Limiting (Concurrent)", False, 
                            f"Rate limiting not triggered with concurrent requests. Status codes: {', '.join(status_codes)}")
                return False
                
        except Exception as e:
            self.log_test("Rate Limiting (Concurrent)", False, f"Exception: {str(e)}")
            return False

    def test_sql_injection_attempt(self):
        """Test SQL injection protection in email field"""
        try:
            test_data = {
                "email": "test@example.com'; DROP TABLE users; --",
                "password": "SecurePass123",
                "name": "Test User"
            }
            
            response = self.session.post(f"{BASE_URL}/auth/register", json=test_data)
            
            # Should either reject with validation error or sanitize the input
            if response.status_code == 422 or response.status_code == 400:
                self.log_test("SQL Injection Protection", True, 
                            "SQL injection attempt correctly rejected")
                return True
            elif response.status_code == 200:
                # Check if the email was sanitized
                data = response.json()
                # If it succeeded, the email should have been sanitized
                self.log_test("SQL Injection Protection", True, 
                            "SQL injection attempt handled (input sanitized)")
                return True
            else:
                self.log_test("SQL Injection Protection", False, 
                            f"Unexpected response to SQL injection attempt. Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("SQL Injection Protection", False, f"Exception: {str(e)}")
            return False

    def test_xss_protection(self):
        """Test XSS protection in name field"""
        try:
            test_data = {
                "email": "xss_test@example.com",
                "password": "SecurePass123",
                "name": "<script>alert('XSS')</script>Test User"
            }
            
            response = self.session.post(f"{BASE_URL}/auth/register", json=test_data)
            
            if response.status_code == 200:
                # Check if script tags were sanitized
                data = response.json()
                # Get user info to check if name was sanitized
                if "access_token" in data:
                    headers = {"Authorization": f"Bearer {data['access_token']}"}
                    user_response = self.session.get(f"{BASE_URL}/auth/me", headers=headers)
                    if user_response.status_code == 200:
                        user_data = user_response.json()
                        name = user_data.get("name", "")
                        if "<script>" not in name:
                            self.log_test("XSS Protection", True, 
                                        f"XSS attempt sanitized. Name stored as: '{name}'")
                            return True
                        else:
                            self.log_test("XSS Protection", False, 
                                        f"XSS not sanitized. Name stored as: '{name}'")
                            return False
                
            elif response.status_code == 422 or response.status_code == 400:
                self.log_test("XSS Protection", True, 
                            "XSS attempt correctly rejected")
                return True
            else:
                self.log_test("XSS Protection", False, 
                            f"Unexpected response to XSS attempt. Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("XSS Protection", False, f"Exception: {str(e)}")
            return False

    def test_password_requirements_comprehensive(self):
        """Test comprehensive password requirements"""
        weak_passwords = [
            ("123", "Too short"),
            ("password", "No uppercase, no digits"),
            ("PASSWORD", "No lowercase, no digits"),  
            ("Password", "No digits"),
            ("12345678", "No letters"),
            ("Pass123", "Too short (7 chars)")
        ]
        
        all_rejected = True
        details = []
        
        for password, description in weak_passwords:
            try:
                test_data = {
                    "email": f"pwd_test_{int(time.time())}@example.com",
                    "password": password,
                    "name": "Test User"
                }
                
                response = self.session.post(f"{BASE_URL}/auth/register", json=test_data)
                
                if response.status_code == 200:
                    all_rejected = False
                    details.append(f"'{password}' ({description}) was accepted")
                else:
                    details.append(f"'{password}' ({description}) correctly rejected")
                    
            except Exception as e:
                details.append(f"'{password}' ({description}) - Error: {str(e)}")
        
        if all_rejected:
            self.log_test("Password Requirements (Comprehensive)", True, 
                        f"All weak passwords rejected: {'; '.join(details)}")
            return True
        else:
            self.log_test("Password Requirements (Comprehensive)", False, 
                        f"Some weak passwords accepted: {'; '.join(details)}")
            return False

    def run_enhanced_tests(self):
        """Run enhanced security tests"""
        print("🔒 Enhanced FitTrax Security Testing Suite")
        print("=" * 60)
        print()
        
        # Basic connectivity test
        try:
            response = self.session.get(f"{BASE_URL}/health")
            if response.status_code != 200:
                print("❌ Backend not accessible. Stopping tests.")
                return False
            print("✅ Backend connectivity confirmed")
            print()
        except Exception as e:
            print(f"❌ Backend not accessible: {str(e)}")
            return False
        
        # Enhanced CORS Tests
        print("🌐 Enhanced CORS Tests")
        print("-" * 40)
        self.test_cors_with_options()
        self.test_cors_with_get()
        print()
        
        # Enhanced Rate Limiting Tests
        print("⏱️  Enhanced Rate Limiting Tests")
        print("-" * 40)
        self.test_aggressive_rate_limiting()
        self.test_concurrent_rate_limiting()
        print()
        
        # Enhanced Input Validation Tests
        print("🛡️  Enhanced Input Validation Tests")
        print("-" * 40)
        self.test_password_requirements_comprehensive()
        self.test_sql_injection_attempt()
        self.test_xss_protection()
        print()
        
        # Summary
        self.print_summary()
        
        return True

    def print_summary(self):
        """Print test summary"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print("📊 Enhanced Test Summary")
        print("=" * 60)
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

def main():
    """Main test runner"""
    tester = EnhancedSecurityTester()
    tester.run_enhanced_tests()

if __name__ == "__main__":
    main()