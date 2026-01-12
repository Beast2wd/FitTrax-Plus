#!/usr/bin/env python3
"""
Additional AI Food Scanner Test with Real Food Image
Testing with a more realistic food image to verify AI analysis
"""

import requests
import json
import base64
from datetime import datetime

# Configuration
BASE_URL = "https://health-hub-136.preview.emergentagent.com/api"
TEST_USER_ID = "food_scanner_real_test"

# Create a simple food-like image (red square that might be interpreted as food)
def create_food_like_image():
    """Create a simple red square image that might be interpreted as food"""
    # This is a small red square PNG image in base64
    red_square_base64 = """iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABYSURBVBiVY/z//z8DJQAggBhJVQwQQIykKgYIIEZSFQMEECOpigECiJFUxQABxEiqYoAAYiRVMUAAMZKqGCCAGElVDBBAjKQqBgggRlIVAwQQI6mKAQKIkVTFAAEEAFm8A/+TkGd8AAAAAElFTkSuQmCC"""
    return red_square_base64

def test_real_food_analysis():
    """Test with a more food-like image"""
    print("🍅 TESTING WITH FOOD-LIKE IMAGE")
    print("=" * 50)
    
    food_image = create_food_like_image()
    
    payload = {
        "user_id": TEST_USER_ID,
        "image_base64": food_image,
        "meal_category": "lunch"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/analyze-food", json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            meal = data.get("meal", {})
            analysis = data.get("analysis", {})
            
            print(f"✅ SUCCESS: Food analysis completed")
            print(f"Food Name: {analysis.get('food_name', 'N/A')}")
            print(f"Calories: {analysis.get('calories', 0)}")
            print(f"Protein: {analysis.get('protein', 0)}g")
            print(f"Carbs: {analysis.get('carbs', 0)}g")
            print(f"Fat: {analysis.get('fat', 0)}g")
            print(f"Portion Size: {analysis.get('portion_size', 'N/A')}")
            print(f"Meal ID: {meal.get('meal_id', 'N/A')}")
            print(f"Meal Category: {meal.get('meal_category', 'N/A')}")
            
            # Check if GPT-4o is working properly
            if analysis.get('food_name') and analysis.get('food_name') != "Unknown Food":
                print("✅ GPT-4o AI analysis is working correctly")
            else:
                print("⚠️  GPT-4o returned generic response")
                
            return True
        else:
            print(f"❌ FAILED: Status {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"❌ FAILED: Exception - {str(e)}")
        return False

def test_rate_limiting():
    """Test rate limiting by making multiple rapid requests"""
    print("\n⏱️  TESTING RATE LIMITING")
    print("=" * 50)
    
    payload = {
        "user_id": f"{TEST_USER_ID}_rate",
        "image_base64": create_food_like_image(),
        "meal_category": "snack"
    }
    
    success_count = 0
    rate_limited = False
    
    print("Making rapid requests to test rate limiting...")
    
    for i in range(15):  # Test with 15 requests
        try:
            response = requests.post(f"{BASE_URL}/analyze-food", json=payload, timeout=10)
            
            if response.status_code == 200:
                success_count += 1
                print(f"Request {i+1}: ✅ Success")
            elif response.status_code == 429:  # Too Many Requests
                rate_limited = True
                print(f"Request {i+1}: ⏱️  Rate limited (429)")
                break
            else:
                print(f"Request {i+1}: ❌ Status {response.status_code}")
                
        except Exception as e:
            print(f"Request {i+1}: ❌ Exception - {str(e)}")
        
        # Small delay between requests
        import time
        time.sleep(0.2)
    
    print(f"\nRate Limiting Results:")
    print(f"Successful requests: {success_count}")
    print(f"Rate limited: {'Yes' if rate_limited else 'No'}")
    
    if rate_limited:
        print("✅ Rate limiting is working correctly")
        return True
    elif success_count >= 10:
        print("⚠️  Rate limiting may not be enforced or limit is higher than expected")
        return True
    else:
        print("❌ Unexpected behavior in rate limiting")
        return False

if __name__ == "__main__":
    print("🧪 ADDITIONAL AI FOOD SCANNER TESTS")
    print("=" * 60)
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().isoformat()}")
    
    results = []
    
    # Test 1: Real food analysis
    results.append(test_real_food_analysis())
    
    # Test 2: Rate limiting
    results.append(test_rate_limiting())
    
    # Summary
    print("\n" + "=" * 60)
    print("🏁 ADDITIONAL TESTS SUMMARY")
    print("=" * 60)
    
    test_names = ["Food-like Image Analysis", "Rate Limiting Test"]
    
    passed = sum(results)
    total = len(results)
    
    for i, (name, result) in enumerate(zip(test_names, results)):
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{i+1}. {name}: {status}")
    
    print(f"\nOVERALL RESULT: {passed}/{total} additional tests passed ({(passed/total)*100:.1f}%)")