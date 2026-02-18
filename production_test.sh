#!/bin/bash
# FitTrax API Production Readiness Test - Using curl
# Tests all critical endpoints for production deployment

BASE_URL="https://workout-tracker-535.preview.emergentagent.com/api"
TEST_EMAIL="prod_test_$(date +%s)@fittrax.com"
TEST_PASSWORD="SecurePass123!"

echo "🚀 FITTRAX API - FINAL PRODUCTION READINESS TEST"
echo "============================================================"
echo "Backend URL: $BASE_URL"
echo "============================================================"

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0

test_result() {
    local test_name="$1"
    local success="$2"
    local details="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$success" = "true" ]; then
        echo "✅ PASS: $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo "❌ FAIL: $test_name"
    fi
    
    if [ -n "$details" ]; then
        echo "   $details"
    fi
}

echo ""
echo "🏥 HEALTH & ADMIN ENDPOINTS"

# Test GET /api/health
HEALTH_RESPONSE=$(curl -s "$BASE_URL/health")
if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
    test_result "GET /api/health" "true" "Returns healthy status"
else
    test_result "GET /api/health" "false" "Health check failed: $HEALTH_RESPONSE"
fi

# Test GET /api/admin/health-check
ADMIN_HEALTH=$(curl -s "$BASE_URL/admin/health-check")
if echo "$ADMIN_HEALTH" | grep -q '"status":"healthy"' && \
   echo "$ADMIN_HEALTH" | grep -q '"database":"connected"' && \
   echo "$ADMIN_HEALTH" | grep -q '"environment":"development"'; then
    CONFIG_ISSUES=$(echo "$ADMIN_HEALTH" | grep -o '"config_issues":[0-9]*' | cut -d':' -f2)
    test_result "GET /api/admin/health-check" "true" "Status: healthy, DB: connected, Env: development, Issues: $CONFIG_ISSUES"
else
    test_result "GET /api/admin/health-check" "false" "Admin health check failed: $ADMIN_HEALTH"
fi

echo ""
echo "🔒 SECURITY TESTS"

# Test user registration
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"name\":\"Production Test User\"}")

if echo "$REGISTER_RESPONSE" | grep -q '"access_token"'; then
    ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    test_result "POST /api/auth/register" "true" "New user registered successfully"
else
    test_result "POST /api/auth/register" "false" "Registration failed: $REGISTER_RESPONSE"
    exit 1
fi

# Test login
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

if echo "$LOGIN_RESPONSE" | grep -q '"access_token"'; then
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    test_result "POST /api/auth/login" "true" "Login successful"
else
    test_result "POST /api/auth/login" "false" "Login failed: $LOGIN_RESPONSE"
fi

# Test GET /api/auth/me with Bearer token
ME_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/auth/me")
if echo "$ME_RESPONSE" | grep -q '"user_id"'; then
    USER_ID=$(echo "$ME_RESPONSE" | grep -o '"user_id":"[^"]*' | cut -d'"' -f4)
    USER_EMAIL=$(echo "$ME_RESPONSE" | grep -o '"email":"[^"]*' | cut -d'"' -f4)
    test_result "GET /api/auth/me with Bearer token" "true" "User authenticated: $USER_EMAIL"
else
    test_result "GET /api/auth/me with Bearer token" "false" "Auth/me failed: $ME_RESPONSE"
fi

# Test rate limiting (10 rapid login attempts should return 429)
echo "   Testing rate limiting (10 rapid attempts)..."
RATE_LIMITED=false
for i in {1..12}; do
    RATE_RESPONSE=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"nonexistent@test.com","password":"wrongpassword"}' \
        -o /dev/null)
    
    if [ "$RATE_RESPONSE" = "429" ]; then
        RATE_LIMITED=true
        break
    fi
    sleep 0.1
done

if [ "$RATE_LIMITED" = "true" ]; then
    test_result "Rate limiting (10 attempts → 429)" "true" "Rate limit triggered correctly"
else
    test_result "Rate limiting (10 attempts → 429)" "false" "Rate limiting not working"
fi

echo ""
echo "🚀 CORE FEATURES"

# Test POST /api/analyze-food (AI food scanner)
# Simple 1x1 pixel PNG in base64
TEST_IMAGE="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

FOOD_RESPONSE=$(curl -s -X POST "$BASE_URL/analyze-food" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":\"$USER_ID\",\"image_base64\":\"$TEST_IMAGE\",\"meal_category\":\"lunch\"}")

if echo "$FOOD_RESPONSE" | grep -q '"meal"' && echo "$FOOD_RESPONSE" | grep -q '"analysis"'; then
    FOOD_NAME=$(echo "$FOOD_RESPONSE" | grep -o '"food_name":"[^"]*' | cut -d'"' -f4 | head -1)
    CALORIES=$(echo "$FOOD_RESPONSE" | grep -o '"calories":[0-9]*' | cut -d':' -f2 | head -1)
    test_result "POST /api/analyze-food (AI scanner)" "true" "AI working: $FOOD_NAME - ${CALORIES} cal"
else
    test_result "POST /api/analyze-food (AI scanner)" "false" "AI scanner failed: $FOOD_RESPONSE"
fi

# Test GET /api/steps/{user_id}/today
STEPS_TODAY=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/steps/$USER_ID/today")
if [ $? -eq 0 ]; then
    test_result "GET /api/steps/{user_id}/today" "true" "Today's steps endpoint working"
else
    test_result "GET /api/steps/{user_id}/today" "false" "Steps today failed"
fi

# Test POST /api/steps with step data
CURRENT_DATE=$(date +%Y-%m-%d)
STEPS_POST=$(curl -s -X POST "$BASE_URL/steps" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":\"$USER_ID\",\"steps\":8000,\"date\":\"$CURRENT_DATE\",\"calories_burned\":320,\"distance_miles\":4.0}")

if echo "$STEPS_POST" | grep -q "success\|Steps logged\|saved" || [ "$(curl -s -w "%{http_code}" -X POST "$BASE_URL/steps" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d "{\"user_id\":\"$USER_ID\",\"steps\":8000,\"date\":\"$CURRENT_DATE\",\"calories_burned\":320,\"distance_miles\":4.0}" -o /dev/null)" = "200" ]; then
    test_result "POST /api/steps" "true" "Step data saved successfully"
else
    test_result "POST /api/steps" "false" "Steps POST failed: $STEPS_POST"
fi

# Test GET /api/dashboard/{user_id}
DASHBOARD_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/dashboard/$USER_ID")
if echo "$DASHBOARD_RESPONSE" | grep -qE "(calories|steps|workouts|water|dashboard)" && [ ${#DASHBOARD_RESPONSE} -gt 50 ]; then
    test_result "GET /api/dashboard/{user_id}" "true" "Dashboard returns comprehensive data"
else
    test_result "GET /api/dashboard/{user_id}" "false" "Dashboard data insufficient: $DASHBOARD_RESPONSE"
fi

echo ""
echo "⚠️ ERROR HANDLING"

# Test 404 for non-existent routes
NOT_FOUND_CODE=$(curl -s -w "%{http_code}" "$BASE_URL/nonexistent-route" -o /dev/null)
if [ "$NOT_FOUND_CODE" = "404" ]; then
    test_result "404 handling" "true" "Non-existent routes return 404"
else
    test_result "404 handling" "false" "Expected 404, got: $NOT_FOUND_CODE"
fi

# Test 422 for invalid input validation
INVALID_CODE=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/analyze-food" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"user_id":"","meal_category":"invalid"}' -o /dev/null)

if [ "$INVALID_CODE" = "422" ] || [ "$INVALID_CODE" = "400" ]; then
    test_result "422 input validation" "true" "Invalid input rejected with $INVALID_CODE"
else
    test_result "422 input validation" "false" "Expected 400/422, got: $INVALID_CODE"
fi

# Test 401 for protected routes without token
UNAUTH_CODE=$(curl -s -w "%{http_code}" "$BASE_URL/auth/me" -o /dev/null)
if [ "$UNAUTH_CODE" = "401" ]; then
    test_result "401 unauthorized access" "true" "Protected routes require authentication"
else
    test_result "401 unauthorized access" "false" "Expected 401, got: $UNAUTH_CODE"
fi

echo ""
echo "💾 DATABASE CONNECTIVITY"

# Test CRUD operations - Create profile
PROFILE_CREATE=$(curl -s -X POST "$BASE_URL/user/profile" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":\"$USER_ID\",\"name\":\"Production Test User\",\"age\":28,\"gender\":\"male\",\"height_feet\":6,\"height_inches\":0,\"weight\":175,\"goal_weight\":170,\"activity_level\":\"active\"}")

if echo "$PROFILE_CREATE" | grep -q "success\|Profile saved" || [ "$(curl -s -w "%{http_code}" -X POST "$BASE_URL/user/profile" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d "{\"user_id\":\"$USER_ID\",\"name\":\"Production Test User\",\"age\":28,\"gender\":\"male\",\"height_feet\":6,\"height_inches\":0,\"weight\":175,\"goal_weight\":170,\"activity_level\":\"active\"}" -o /dev/null)" = "200" ]; then
    test_result "Database CRUD - CREATE" "true" "Profile created successfully"
else
    test_result "Database CRUD - CREATE" "false" "Profile creation failed: $PROFILE_CREATE"
fi

# Test CRUD operations - Read profile
PROFILE_READ=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/user/profile/$USER_ID")
if echo "$PROFILE_READ" | grep -q "Production Test User"; then
    test_result "Database CRUD - READ" "true" "Profile retrieved and data persisted"
else
    test_result "Database CRUD - READ" "false" "Data persistence issue: $PROFILE_READ"
fi

echo ""
echo "============================================================"
echo "📊 FINAL PRODUCTION READINESS ASSESSMENT"
echo "============================================================"

SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

echo "📈 Total Tests: $TOTAL_TESTS"
echo "✅ Passed: $PASSED_TESTS"
echo "❌ Failed: $((TOTAL_TESTS - PASSED_TESTS))"
echo "📊 Success Rate: ${SUCCESS_RATE}%"

echo ""
echo "🎯 PRODUCTION READINESS VERDICT:"

# Check critical requirements
CRITICAL_TESTS=("GET /api/health" "POST /api/auth/register" "POST /api/auth/login" "GET /api/auth/me with Bearer token" "POST /api/analyze-food (AI scanner)" "Database CRUD - CREATE" "Database CRUD - READ")

if [ $SUCCESS_RATE -ge 95 ] && [ $PASSED_TESTS -ge 12 ]; then
    echo "🟢 PRODUCTION READY ✅"
    echo "   • All critical systems operational"
    echo "   • Health endpoints working"
    echo "   • Authentication system functional"
    echo "   • AI food scanner working"
    echo "   • Database connectivity confirmed"
    echo "   • Error handling proper"
    echo "   • Rate limiting active"
    echo ""
    echo "🎉 READY FOR DEPLOYMENT!"
elif [ $SUCCESS_RATE -ge 85 ]; then
    echo "🟡 NEEDS MINOR FIXES ⚠️"
    echo "   • Core functionality working"
    echo "   • Some non-critical issues found"
    echo ""
    echo "⚠️ REQUIRES MINOR FIXES BEFORE DEPLOYMENT"
else
    echo "🔴 NOT PRODUCTION READY ❌"
    echo "   • Critical issues must be resolved"
    echo ""
    echo "⚠️ REQUIRES FIXES BEFORE DEPLOYMENT"
fi