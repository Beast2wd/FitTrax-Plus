#!/usr/bin/env python3
"""
Simple Rate Limit Test for FitTrax API
"""

import requests
import time
from datetime import datetime

BASE_URL = "https://health-hub-136.preview.emergentagent.com/api"

def test_rate_limit_simple():
    """Test rate limiting with exactly 11 requests to trigger the 10/minute limit"""
    print("🔍 Testing Rate Limiting - 10/minute limit")
    print("Making 11 requests to /auth/login within 1 minute...")
    
    login_data = {
        "email": "rate_test@example.com",
        "password": "TestPassword123"
    }
    
    session = requests.Session()
    
    for i in range(11):
        try:
            start_time = time.time()
            response = session.post(f"{BASE_URL}/auth/login", json=login_data, timeout=10)
            end_time = time.time()
            
            print(f"Request {i+1}: Status {response.status_code} (took {end_time-start_time:.2f}s)")
            
            if response.status_code == 429:
                print(f"✅ Rate limiting triggered on request {i+1}")
                print(f"Response headers: {dict(response.headers)}")
                return True
            
            # Small delay between requests
            time.sleep(1)
            
        except Exception as e:
            print(f"Request {i+1}: Error - {str(e)}")
    
    print("❌ Rate limiting not triggered after 11 requests")
    return False

def test_rate_limit_burst():
    """Test rate limiting with burst requests (no delay)"""
    print("\n🔍 Testing Rate Limiting - Burst requests")
    print("Making 15 rapid requests to /auth/login...")
    
    login_data = {
        "email": "burst_test@example.com", 
        "password": "TestPassword123"
    }
    
    session = requests.Session()
    
    for i in range(15):
        try:
            response = session.post(f"{BASE_URL}/auth/login", json=login_data, timeout=10)
            print(f"Request {i+1}: Status {response.status_code}")
            
            if response.status_code == 429:
                print(f"✅ Rate limiting triggered on request {i+1}")
                print(f"Response headers: {dict(response.headers)}")
                return True
                
        except Exception as e:
            print(f"Request {i+1}: Error - {str(e)}")
    
    print("❌ Rate limiting not triggered after 15 burst requests")
    return False

def main():
    print("🔒 FitTrax Rate Limiting Test")
    print("=" * 50)
    
    # Test basic connectivity
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            print("✅ Backend is accessible")
        else:
            print(f"❌ Backend returned status {response.status_code}")
            return
    except Exception as e:
        print(f"❌ Backend not accessible: {str(e)}")
        return
    
    # Run rate limit tests
    test1_result = test_rate_limit_simple()
    test2_result = test_rate_limit_burst()
    
    print("\n📊 Summary")
    print("-" * 20)
    if test1_result or test2_result:
        print("✅ Rate limiting is working")
    else:
        print("❌ Rate limiting may not be configured properly")
        print("   This could be due to:")
        print("   - Rate limiter not properly initialized")
        print("   - Rate limit threshold too high")
        print("   - Rate limiter using different key (IP-based vs session-based)")

if __name__ == "__main__":
    main()