from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pathlib import Path
import os
import logging
import base64
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.getenv('DB_NAME', 'fitness_tracker_db')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Create the main app without a prefix
app = FastAPI(title="FitTraxx API", version="1.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

# User Profile Models
class UserProfile(BaseModel):
    user_id: str
    name: str
    age: int
    gender: str  # "male" or "female"
    height_feet: int
    height_inches: int
    weight: float  # in lbs
    goal_weight: float  # in lbs
    activity_level: str  # sedentary, light, moderate, active, very_active
    daily_calorie_goal: Optional[float] = None
    created_at: Optional[str] = Field(default_factory=lambda: datetime.utcnow().isoformat())

class UserProfileCreate(BaseModel):
    user_id: str
    name: str
    age: int
    gender: str
    height_feet: int
    height_inches: int
    weight: float
    goal_weight: float
    activity_level: str

# Food/Meal Models
class FoodAnalysisRequest(BaseModel):
    user_id: str
    image_base64: str
    meal_category: str  # breakfast, lunch, dinner, snack

class FoodAnalysis(BaseModel):
    food_name: str
    calories: float
    protein: float
    carbs: float
    fat: float
    portion_size: str

class Meal(BaseModel):
    meal_id: str
    user_id: str
    food_name: str
    calories: float
    protein: float
    carbs: float
    fat: float
    meal_category: str
    image_base64: str
    timestamp: str

# Workout Models
class Workout(BaseModel):
    workout_id: str
    user_id: str
    workout_type: str  # cardio, strength, flexibility, sports, other
    duration: int  # minutes
    calories_burned: float
    notes: Optional[str] = ""
    timestamp: str

class WorkoutCreate(BaseModel):
    workout_id: str
    user_id: str
    workout_type: str
    duration: int
    calories_burned: float
    notes: Optional[str] = ""
    timestamp: str

# Water Intake Models
class WaterIntake(BaseModel):
    water_id: str
    user_id: str
    amount: float  # in oz
    timestamp: str

class WaterIntakeCreate(BaseModel):
    water_id: str
    user_id: str
    amount: float
    timestamp: str

# Heart Rate Models
class HeartRate(BaseModel):
    heart_rate_id: str
    user_id: str
    bpm: int
    activity_type: str  # resting, workout, general
    notes: Optional[str] = ""
    timestamp: str

class HeartRateCreate(BaseModel):
    heart_rate_id: str
    user_id: str
    bpm: int
    activity_type: str
    notes: Optional[str] = ""
    timestamp: str

# Workout Plan Models
class Exercise(BaseModel):
    name: str
    sets: Optional[int] = 0
    reps: Optional[str] = ""
    duration: Optional[int] = 0  # minutes
    rest: Optional[int] = 0  # seconds
    notes: Optional[str] = ""

class WorkoutDay(BaseModel):
    day: int
    title: str
    estimated_duration: int  # minutes
    exercises: List[Exercise]

class WorkoutPlan(BaseModel):
    plan_id: str
    name: str
    description: str
    level: str  # beginner, intermediate, advanced
    goal: str  # weight_loss, muscle_gain, endurance, general
    type: str  # strength, cardio, flexibility, mixed
    duration_weeks: int
    days: List[WorkoutDay]
    created_at: Optional[str] = Field(default_factory=lambda: datetime.utcnow().isoformat())

# User Plan Models
class UserPlan(BaseModel):
    user_plan_id: str
    user_id: str
    plan_id: str
    start_date: str
    current_day: int
    completed_days: List[int]
    status: str  # active, completed, paused

class UserPlanCreate(BaseModel):
    user_plan_id: str
    user_id: str
    plan_id: str
    start_date: str
    current_day: int = 1
    completed_days: List[int] = []
    status: str = "active"

# Scheduled Workout Models
class ScheduledWorkout(BaseModel):
    scheduled_id: str
    user_id: str
    workout_plan_id: Optional[str] = None
    workout_day: Optional[int] = None
    custom_workout: Optional[dict] = None
    scheduled_date: str
    scheduled_time: str
    reminder_enabled: bool = False
    reminder_minutes_before: int = 15
    completed: bool = False
    notes: Optional[str] = ""

class ScheduledWorkoutCreate(BaseModel):
    scheduled_id: str
    user_id: str
    workout_plan_id: Optional[str] = None
    workout_day: Optional[int] = None
    custom_workout: Optional[dict] = None
    scheduled_date: str
    scheduled_time: str
    reminder_enabled: bool = False
    reminder_minutes_before: int = 15
    completed: bool = False
    notes: Optional[str] = ""

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def calculate_bmr(age: int, gender: str, height_feet: int, height_inches: int, weight: float) -> float:
    """Calculate Basal Metabolic Rate using Mifflin-St Jeor equation"""
    # Convert height to cm and weight to kg
    height_cm = (height_feet * 12 + height_inches) * 2.54
    weight_kg = weight * 0.453592
    
    if gender.lower() == "male":
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    else:
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    
    return bmr

def calculate_daily_calories(bmr: float, activity_level: str, goal_weight: float, current_weight: float) -> float:
    """Calculate daily calorie goal based on BMR, activity level, and goal"""
    # Activity multipliers
    activity_multipliers = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9
    }
    
    tdee = bmr * activity_multipliers.get(activity_level, 1.2)
    
    # Adjust for goal
    if goal_weight < current_weight:  # Weight loss
        tdee -= 500  # 500 calorie deficit for ~1 lb/week loss
    elif goal_weight > current_weight:  # Weight gain
        tdee += 300  # 300 calorie surplus for weight gain
    
    return round(tdee)

def calculate_heart_rate_zones(age: int):
    """Calculate heart rate zones based on age"""
    max_hr = 220 - age
    return {
        "max_heart_rate": max_hr,
        "resting": {"min": 50, "max": 100},
        "fat_burn": {"min": int(max_hr * 0.5), "max": int(max_hr * 0.7)},
        "cardio": {"min": int(max_hr * 0.7), "max": int(max_hr * 0.85)},
        "peak": {"min": int(max_hr * 0.85), "max": max_hr}
    }

async def analyze_food_with_ai(image_base64: str) -> FoodAnalysis:
    """Analyze food image using GPT-4o"""
    try:
        api_key = os.getenv('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")
        
        # Create chat instance
        chat = LlmChat(
            api_key=api_key,
            session_id=f"food_analysis_{datetime.now().timestamp()}",
            system_message="You are a nutrition expert. Analyze food images and provide accurate nutritional information."
        ).with_model("openai", "gpt-4o")
        
        # Create image content
        image_content = ImageContent(image_base64=image_base64)
        
        # Create user message with structured output request
        prompt = """Analyze this food image and provide nutritional information in JSON format.

Return ONLY a valid JSON object with these exact fields:
{
  "food_name": "name of the food",
  "calories": numeric value,
  "protein": numeric value in grams,
  "carbs": numeric value in grams,
  "fat": numeric value in grams,
  "portion_size": "description like '1 cup' or '200g'"
}

Provide your best estimate for the portion shown in the image."""
        
        user_message = UserMessage(
            text=prompt,
            file_contents=[image_content]
        )
        
        # Get response
        response = await chat.send_message(user_message)
        logger.info(f"AI Response: {response}")
        
        # Parse response
        import json
        # Extract JSON from response (handle markdown code blocks)
        response_text = response.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        data = json.loads(response_text)
        
        return FoodAnalysis(
            food_name=data.get("food_name", "Unknown Food"),
            calories=float(data.get("calories", 0)),
            protein=float(data.get("protein", 0)),
            carbs=float(data.get("carbs", 0)),
            fat=float(data.get("fat", 0)),
            portion_size=data.get("portion_size", "1 serving")
        )
    
    except Exception as e:
        logger.error(f"Error analyzing food: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze food image: {str(e)}")

# ============================================================================
# API ENDPOINTS
# ============================================================================

@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

# ============================================================================
# USER PROFILE ENDPOINTS
# ============================================================================

@api_router.post("/user/profile")
async def create_or_update_profile(profile_data: UserProfileCreate):
    """Create or update user profile"""
    try:
        # Calculate BMR and daily calorie goal
        bmr = calculate_bmr(
            profile_data.age,
            profile_data.gender,
            profile_data.height_feet,
            profile_data.height_inches,
            profile_data.weight
        )
        
        daily_calories = calculate_daily_calories(
            bmr,
            profile_data.activity_level,
            profile_data.goal_weight,
            profile_data.weight
        )
        
        # Create profile object
        profile = UserProfile(
            **profile_data.dict(),
            daily_calorie_goal=daily_calories
        )
        
        # Upsert to database
        await db.users.update_one(
            {"user_id": profile.user_id},
            {"$set": profile.dict()},
            upsert=True
        )
        
        return {
            "message": "Profile saved successfully",
            "profile": profile.dict()
        }
    
    except Exception as e:
        logger.error(f"Error saving profile: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/user/profile/{user_id}")
async def get_profile(user_id: str):
    """Get user profile"""
    profile = await db.users.find_one({"user_id": user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Remove MongoDB _id field
    profile.pop('_id', None)
    return profile

# ============================================================================
# FOOD ANALYSIS ENDPOINTS
# ============================================================================

@api_router.post("/analyze-food")
async def analyze_food(request: FoodAnalysisRequest):
    """Analyze food image with AI and save meal"""
    try:
        # Analyze food with AI
        analysis = await analyze_food_with_ai(request.image_base64)
        
        # Create meal record
        meal = Meal(
            meal_id=f"meal_{int(datetime.now().timestamp() * 1000)}",
            user_id=request.user_id,
            food_name=analysis.food_name,
            calories=analysis.calories,
            protein=analysis.protein,
            carbs=analysis.carbs,
            fat=analysis.fat,
            meal_category=request.meal_category,
            image_base64=request.image_base64,
            timestamp=datetime.utcnow().isoformat()
        )
        
        # Save to database
        await db.meals.insert_one(meal.dict())
        
        return {
            "meal": meal.dict(),
            "analysis": analysis.dict()
        }
    
    except Exception as e:
        logger.error(f"Error in analyze_food: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# MEALS ENDPOINTS
# ============================================================================

@api_router.get("/meals/{user_id}")
async def get_meals(user_id: str, days: int = 7):
    """Get user's meals for the last N days"""
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        cutoff_iso = cutoff_date.isoformat()
        
        meals_cursor = db.meals.find({
            "user_id": user_id,
            "timestamp": {"$gte": cutoff_iso}
        }).sort("timestamp", -1)
        
        meals = await meals_cursor.to_list(length=1000)
        
        # Remove MongoDB _id field
        for meal in meals:
            meal.pop('_id', None)
        
        return {"meals": meals}
    
    except Exception as e:
        logger.error(f"Error getting meals: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/meals/{meal_id}")
async def delete_meal(meal_id: str):
    """Delete a meal"""
    result = await db.meals.delete_one({"meal_id": meal_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    return {"message": "Meal deleted successfully"}

# ============================================================================
# WORKOUTS ENDPOINTS
# ============================================================================

@api_router.post("/workouts")
async def add_workout(workout: WorkoutCreate):
    """Add a workout"""
    await db.workouts.insert_one(workout.dict())
    return {"message": "Workout added successfully", "workout": workout.dict()}

@api_router.get("/workouts/{user_id}")
async def get_workouts(user_id: str, days: int = 7):
    """Get user's workouts"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    cutoff_iso = cutoff_date.isoformat()
    
    workouts_cursor = db.workouts.find({
        "user_id": user_id,
        "timestamp": {"$gte": cutoff_iso}
    }).sort("timestamp", -1)
    
    workouts = await workouts_cursor.to_list(length=1000)
    
    for workout in workouts:
        workout.pop('_id', None)
    
    return {"workouts": workouts}

@api_router.delete("/workouts/{workout_id}")
async def delete_workout(workout_id: str):
    """Delete a workout"""
    result = await db.workouts.delete_one({"workout_id": workout_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    return {"message": "Workout deleted successfully"}

# ============================================================================
# WATER INTAKE ENDPOINTS
# ============================================================================

@api_router.post("/water")
async def add_water(water: WaterIntakeCreate):
    """Add water intake"""
    await db.water_intake.insert_one(water.dict())
    return {"message": "Water intake added successfully", "water": water.dict()}

@api_router.get("/water/{user_id}")
async def get_water_intake(user_id: str, days: int = 7):
    """Get user's water intake"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    cutoff_iso = cutoff_date.isoformat()
    
    water_cursor = db.water_intake.find({
        "user_id": user_id,
        "timestamp": {"$gte": cutoff_iso}
    }).sort("timestamp", -1)
    
    water_intake = await water_cursor.to_list(length=1000)
    
    for water in water_intake:
        water.pop('_id', None)
    
    return {"water_intake": water_intake}

# ============================================================================
# HEART RATE ENDPOINTS
# ============================================================================

@api_router.post("/heart-rate")
async def add_heart_rate(heart_rate: HeartRateCreate):
    """Add heart rate measurement"""
    if heart_rate.bpm < 30 or heart_rate.bpm > 250:
        raise HTTPException(status_code=400, detail="BPM must be between 30 and 250")
    
    await db.heart_rate.insert_one(heart_rate.dict())
    return {"message": "Heart rate added successfully", "heart_rate": heart_rate.dict()}

@api_router.get("/heart-rate/{user_id}")
async def get_heart_rate(user_id: str, days: int = 7):
    """Get user's heart rate measurements"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    cutoff_iso = cutoff_date.isoformat()
    
    hr_cursor = db.heart_rate.find({
        "user_id": user_id,
        "timestamp": {"$gte": cutoff_iso}
    }).sort("timestamp", -1)
    
    heart_rates = await hr_cursor.to_list(length=1000)
    
    for hr in heart_rates:
        hr.pop('_id', None)
    
    return {"heart_rates": heart_rates}

@api_router.get("/heart-rate/zones/{user_id}")
async def get_heart_rate_zones(user_id: str):
    """Get heart rate zones for user"""
    profile = await db.users.find_one({"user_id": user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    zones = calculate_heart_rate_zones(profile['age'])
    return zones

# ============================================================================
# WORKOUT PLANS ENDPOINTS
# ============================================================================

@api_router.post("/workout-plans/init")
async def initialize_workout_plans():
    """Initialize default workout plans"""
    
    # Check if plans already exist
    existing_count = await db.workout_plans.count_documents({})
    if existing_count > 0:
        return {"message": "Workout plans already initialized", "count": existing_count}
    
    default_plans = [
        {
            "plan_id": "plan_beginner_weight_loss",
            "name": "Beginner Weight Loss",
            "description": "4-week program combining cardio and light strength training",
            "level": "beginner",
            "goal": "weight_loss",
            "type": "mixed",
            "duration_weeks": 4,
            "days": [
                {
                    "day": 1,
                    "title": "Full Body & Cardio",
                    "estimated_duration": 30,
                    "exercises": [
                        {"name": "Warm-up Walk", "sets": 0, "reps": "", "duration": 5, "rest": 0, "notes": "Easy pace"},
                        {"name": "Bodyweight Squats", "sets": 3, "reps": "10", "duration": 0, "rest": 30, "notes": ""},
                        {"name": "Push-ups (modified)", "sets": 3, "reps": "8", "duration": 0, "rest": 30, "notes": ""},
                        {"name": "Walking", "sets": 0, "reps": "", "duration": 15, "rest": 0, "notes": "Moderate pace"},
                    ]
                },
                {
                    "day": 2,
                    "title": "Rest or Light Activity",
                    "estimated_duration": 20,
                    "exercises": [
                        {"name": "Gentle Stretching", "sets": 0, "reps": "", "duration": 20, "rest": 0, "notes": "Focus on major muscle groups"}
                    ]
                },
                {
                    "day": 3,
                    "title": "Cardio Focus",
                    "estimated_duration": 35,
                    "exercises": [
                        {"name": "Brisk Walking", "sets": 0, "reps": "", "duration": 30, "rest": 0, "notes": ""},
                        {"name": "Cool-down Stretch", "sets": 0, "reps": "", "duration": 5, "rest": 0, "notes": ""}
                    ]
                }
            ],
            "created_at": datetime.utcnow().isoformat()
        },
        {
            "plan_id": "plan_intermediate_muscle_gain",
            "name": "Intermediate Muscle Gain",
            "description": "6-week strength-focused program for muscle building",
            "level": "intermediate",
            "goal": "muscle_gain",
            "type": "strength",
            "duration_weeks": 6,
            "days": [
                {
                    "day": 1,
                    "title": "Upper Body Push",
                    "estimated_duration": 45,
                    "exercises": [
                        {"name": "Bench Press", "sets": 4, "reps": "8-10", "duration": 0, "rest": 90, "notes": ""},
                        {"name": "Overhead Press", "sets": 3, "reps": "10", "duration": 0, "rest": 60, "notes": ""},
                        {"name": "Dips", "sets": 3, "reps": "12", "duration": 0, "rest": 60, "notes": ""},
                        {"name": "Tricep Extensions", "sets": 3, "reps": "12", "duration": 0, "rest": 45, "notes": ""}
                    ]
                },
                {
                    "day": 2,
                    "title": "Lower Body",
                    "estimated_duration": 50,
                    "exercises": [
                        {"name": "Squats", "sets": 4, "reps": "8-10", "duration": 0, "rest": 120, "notes": ""},
                        {"name": "Romanian Deadlifts", "sets": 3, "reps": "10", "duration": 0, "rest": 90, "notes": ""},
                        {"name": "Leg Press", "sets": 3, "reps": "12", "duration": 0, "rest": 60, "notes": ""},
                        {"name": "Calf Raises", "sets": 4, "reps": "15", "duration": 0, "rest": 45, "notes": ""}
                    ]
                },
                {
                    "day": 3,
                    "title": "Rest Day",
                    "estimated_duration": 0,
                    "exercises": [
                        {"name": "Active Recovery", "sets": 0, "reps": "", "duration": 20, "rest": 0, "notes": "Light walk or stretching"}
                    ]
                }
            ],
            "created_at": datetime.utcnow().isoformat()
        },
        {
            "plan_id": "plan_advanced_endurance",
            "name": "Advanced Endurance",
            "description": "8-week high-intensity cardio and HIIT program",
            "level": "advanced",
            "goal": "endurance",
            "type": "cardio",
            "duration_weeks": 8,
            "days": [
                {
                    "day": 1,
                    "title": "HIIT Training",
                    "estimated_duration": 40,
                    "exercises": [
                        {"name": "Warm-up Jog", "sets": 0, "reps": "", "duration": 5, "rest": 0, "notes": ""},
                        {"name": "Sprint Intervals", "sets": 8, "reps": "30s work, 30s rest", "duration": 0, "rest": 30, "notes": "Max effort"},
                        {"name": "Burpees", "sets": 3, "reps": "15", "duration": 0, "rest": 60, "notes": ""},
                        {"name": "Cool-down", "sets": 0, "reps": "", "duration": 5, "rest": 0, "notes": ""}
                    ]
                },
                {
                    "day": 2,
                    "title": "Long Run",
                    "estimated_duration": 60,
                    "exercises": [
                        {"name": "Distance Run", "sets": 0, "reps": "", "duration": 60, "rest": 0, "notes": "Steady pace"}
                    ]
                },
                {
                    "day": 3,
                    "title": "Active Recovery",
                    "estimated_duration": 30,
                    "exercises": [
                        {"name": "Easy Cycling or Swimming", "sets": 0, "reps": "", "duration": 30, "rest": 0, "notes": "Low intensity"}
                    ]
                }
            ],
            "created_at": datetime.utcnow().isoformat()
        },
        {
            "plan_id": "plan_beginner_flexibility",
            "name": "Beginner Flexibility",
            "description": "4-week yoga and stretching program",
            "level": "beginner",
            "goal": "general",
            "type": "flexibility",
            "duration_weeks": 4,
            "days": [
                {
                    "day": 1,
                    "title": "Morning Yoga Flow",
                    "estimated_duration": 30,
                    "exercises": [
                        {"name": "Sun Salutations", "sets": 3, "reps": "5 rounds", "duration": 0, "rest": 30, "notes": ""},
                        {"name": "Warrior Sequence", "sets": 2, "reps": "Hold 30s each", "duration": 0, "rest": 30, "notes": ""},
                        {"name": "Seated Forward Fold", "sets": 0, "reps": "", "duration": 2, "rest": 0, "notes": "Deep breathing"}
                    ]
                },
                {
                    "day": 2,
                    "title": "Rest Day",
                    "estimated_duration": 0,
                    "exercises": [
                        {"name": "Meditation", "sets": 0, "reps": "", "duration": 10, "rest": 0, "notes": "Focus on breathing"}
                    ]
                },
                {
                    "day": 3,
                    "title": "Full Body Stretch",
                    "estimated_duration": 25,
                    "exercises": [
                        {"name": "Neck Stretches", "sets": 0, "reps": "", "duration": 3, "rest": 0, "notes": ""},
                        {"name": "Shoulder Rolls", "sets": 3, "reps": "10", "duration": 0, "rest": 15, "notes": ""},
                        {"name": "Hip Stretches", "sets": 0, "reps": "", "duration": 5, "rest": 0, "notes": ""},
                        {"name": "Hamstring Stretch", "sets": 0, "reps": "", "duration": 3, "rest": 0, "notes": ""}
                    ]
                }
            ],
            "created_at": datetime.utcnow().isoformat()
        }
    ]
    
    await db.workout_plans.insert_many(default_plans)
    
    return {"message": "Workout plans initialized successfully", "count": len(default_plans)}

@api_router.get("/workout-plans")
async def get_workout_plans(
    level: Optional[str] = None,
    goal: Optional[str] = None,
    type: Optional[str] = None
):
    """Get all workout plans with optional filters"""
    query = {}
    if level:
        query["level"] = level
    if goal:
        query["goal"] = goal
    if type:
        query["type"] = type
    
    plans_cursor = db.workout_plans.find(query)
    plans = await plans_cursor.to_list(length=100)
    
    for plan in plans:
        plan.pop('_id', None)
    
    return {"plans": plans}

@api_router.get("/workout-plans/{plan_id}")
async def get_workout_plan(plan_id: str):
    """Get a single workout plan"""
    plan = await db.workout_plans.find_one({"plan_id": plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Workout plan not found")
    
    plan.pop('_id', None)
    return plan

# ============================================================================
# USER PLANS ENDPOINTS
# ============================================================================

@api_router.post("/user-plans")
async def start_workout_plan(user_plan: UserPlanCreate):
    """Start a workout plan for a user"""
    # Verify plan exists
    plan = await db.workout_plans.find_one({"plan_id": user_plan.plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Workout plan not found")
    
    await db.user_plans.insert_one(user_plan.dict())
    
    return {"message": "Workout plan started successfully", "user_plan": user_plan.dict()}

@api_router.get("/user-plans/{user_id}")
async def get_user_plans(user_id: str, status: Optional[str] = None):
    """Get user's workout plans"""
    query = {"user_id": user_id}
    if status:
        query["status"] = status
    
    user_plans_cursor = db.user_plans.find(query)
    user_plans = await user_plans_cursor.to_list(length=100)
    
    # Populate plan details
    for up in user_plans:
        up.pop('_id', None)
        plan = await db.workout_plans.find_one({"plan_id": up["plan_id"]})
        if plan:
            plan.pop('_id', None)
            up["plan_details"] = plan
    
    return {"user_plans": user_plans}

@api_router.put("/user-plans/{user_plan_id}")
async def update_user_plan(
    user_plan_id: str,
    current_day: Optional[int] = None,
    completed_days: Optional[str] = None,
    status: Optional[str] = None
):
    """Update user plan progress"""
    update_data = {}
    
    if current_day is not None:
        update_data["current_day"] = current_day
    
    if completed_days is not None:
        import json
        try:
            update_data["completed_days"] = json.loads(completed_days)
        except:
            raise HTTPException(status_code=400, detail="Invalid completed_days format")
    
    if status:
        update_data["status"] = status
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.user_plans.update_one(
        {"user_plan_id": user_plan_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User plan not found")
    
    return {"message": "User plan updated successfully"}

# ============================================================================
# SCHEDULED WORKOUTS ENDPOINTS
# ============================================================================

@api_router.post("/scheduled-workouts")
async def schedule_workout(scheduled: ScheduledWorkoutCreate):
    """Schedule a workout"""
    await db.scheduled_workouts.insert_one(scheduled.dict())
    return {"message": "Workout scheduled successfully", "scheduled_workout": scheduled.dict()}

@api_router.get("/scheduled-workouts/{user_id}")
async def get_scheduled_workouts(
    user_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get scheduled workouts"""
    query = {"user_id": user_id}
    
    if start_date and end_date:
        query["scheduled_date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["scheduled_date"] = {"$gte": start_date}
    elif end_date:
        query["scheduled_date"] = {"$lte": end_date}
    
    scheduled_cursor = db.scheduled_workouts.find(query).sort("scheduled_date", 1)
    scheduled_workouts = await scheduled_cursor.to_list(length=1000)
    
    for sw in scheduled_workouts:
        sw.pop('_id', None)
    
    return {"scheduled_workouts": scheduled_workouts}

@api_router.put("/scheduled-workouts/{scheduled_id}")
async def update_scheduled_workout(
    scheduled_id: str,
    completed: Optional[bool] = None,
    notes: Optional[str] = None
):
    """Update scheduled workout"""
    update_data = {}
    if completed is not None:
        update_data["completed"] = completed
    if notes is not None:
        update_data["notes"] = notes
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.scheduled_workouts.update_one(
        {"scheduled_id": scheduled_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Scheduled workout not found")
    
    return {"message": "Scheduled workout updated successfully"}

@api_router.delete("/scheduled-workouts/{scheduled_id}")
async def delete_scheduled_workout(scheduled_id: str):
    """Delete scheduled workout"""
    result = await db.scheduled_workouts.delete_one({"scheduled_id": scheduled_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Scheduled workout not found")
    
    return {"message": "Scheduled workout deleted successfully"}

@api_router.get("/scheduled-workouts/reminders/{user_id}")
async def get_upcoming_reminders(user_id: str):
    """Get upcoming workout reminders (next 24 hours)"""
    now = datetime.utcnow()
    tomorrow = now + timedelta(days=1)
    
    scheduled_cursor = db.scheduled_workouts.find({
        "user_id": user_id,
        "reminder_enabled": True,
        "completed": False,
        "scheduled_date": {"$gte": now.strftime("%Y-%m-%d"), "$lte": tomorrow.strftime("%Y-%m-%d")}
    }).sort("scheduled_date", 1)
    
    reminders = await scheduled_cursor.to_list(length=100)
    
    for reminder in reminders:
        reminder.pop('_id', None)
    
    return {"reminders": reminders}

# ============================================================================
# DASHBOARD ENDPOINT
# ============================================================================

@api_router.get("/dashboard/{user_id}")
async def get_dashboard(user_id: str):
    """Get comprehensive dashboard data"""
    try:
        # Get user profile
        profile = await db.users.find_one({"user_id": user_id})
        if profile:
            profile.pop('_id', None)
        
        # Get today's data
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_iso = today_start.isoformat()
        
        # Today's meals
        meals_cursor = db.meals.find({
            "user_id": user_id,
            "timestamp": {"$gte": today_iso}
        })
        today_meals = await meals_cursor.to_list(length=1000)
        
        calories_consumed = sum(m['calories'] for m in today_meals)
        protein = sum(m['protein'] for m in today_meals)
        carbs = sum(m['carbs'] for m in today_meals)
        fat = sum(m['fat'] for m in today_meals)
        
        # Today's workouts
        workouts_cursor = db.workouts.find({
            "user_id": user_id,
            "timestamp": {"$gte": today_iso}
        })
        today_workouts = await workouts_cursor.to_list(length=1000)
        
        calories_burned = sum(w['calories_burned'] for w in today_workouts)
        
        # Today's water
        water_cursor = db.water_intake.find({
            "user_id": user_id,
            "timestamp": {"$gte": today_iso}
        })
        today_water = await water_cursor.to_list(length=1000)
        
        water_intake = sum(w['amount'] for w in today_water)
        
        # Today's heart rate
        hr_cursor = db.heart_rate.find({
            "user_id": user_id,
            "timestamp": {"$gte": today_iso}
        })
        today_hr = await hr_cursor.to_list(length=1000)
        
        avg_hr = sum(h['bpm'] for h in today_hr) / len(today_hr) if today_hr else 0
        
        # Weekly data
        week_ago = datetime.utcnow() - timedelta(days=7)
        week_iso = week_ago.isoformat()
        
        weekly_meals_cursor = db.meals.find({
            "user_id": user_id,
            "timestamp": {"$gte": week_iso}
        }).sort("timestamp", -1)
        weekly_meals = await weekly_meals_cursor.to_list(length=1000)
        
        weekly_workouts_cursor = db.workouts.find({
            "user_id": user_id,
            "timestamp": {"$gte": week_iso}
        }).sort("timestamp", -1)
        weekly_workouts = await weekly_workouts_cursor.to_list(length=1000)
        
        weekly_hr_cursor = db.heart_rate.find({
            "user_id": user_id,
            "timestamp": {"$gte": week_iso}
        }).sort("timestamp", -1)
        weekly_heart_rates = await weekly_hr_cursor.to_list(length=1000)
        
        # Remove MongoDB _id fields
        for item in weekly_meals:
            item.pop('_id', None)
        for item in weekly_workouts:
            item.pop('_id', None)
        for item in weekly_heart_rates:
            item.pop('_id', None)
        
        # Calculate net calories
        net_calories = calories_consumed - calories_burned
        calorie_goal = profile.get('daily_calorie_goal', 2000) if profile else 2000
        
        return {
            "profile": profile,
            "today": {
                "calories_consumed": round(calories_consumed, 1),
                "calories_burned": round(calories_burned, 1),
                "net_calories": round(net_calories, 1),
                "calories_goal": calorie_goal,
                "protein": round(protein, 1),
                "carbs": round(carbs, 1),
                "fat": round(fat, 1),
                "water_intake": round(water_intake, 1),
                "meals_count": len(today_meals),
                "workouts_count": len(today_workouts),
                "avg_heart_rate": round(avg_hr, 1),
                "heart_rate_count": len(today_hr)
            },
            "weekly_meals": weekly_meals,
            "weekly_workouts": weekly_workouts,
            "weekly_heart_rates": weekly_heart_rates
        }
    
    except Exception as e:
        logger.error(f"Error getting dashboard: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# RUNNING DISTANCE TRACKER ENDPOINTS
# ============================================================================

class RunCreate(BaseModel):
    run_id: str
    user_id: str
    distance: float  # in kilometers
    duration: int  # in seconds
    average_pace: float  # min/km
    calories_burned: float
    route_data: Optional[list] = []  # GPS coordinates
    notes: Optional[str] = ""
    timestamp: str

@api_router.post("/runs")
async def add_run(run: RunCreate):
    """Add a running session"""
    await db.runs.insert_one(run.dict())
    return {"message": "Run added successfully", "run": run.dict()}

@api_router.get("/runs/{user_id}")
async def get_runs(user_id: str, days: int = 30):
    """Get user's running sessions"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    cutoff_iso = cutoff_date.isoformat()
    
    runs_cursor = db.runs.find({
        "user_id": user_id,
        "timestamp": {"$gte": cutoff_iso}
    }).sort("timestamp", -1)
    
    runs = await runs_cursor.to_list(length=1000)
    
    for run in runs:
        run.pop('_id', None)
    
    return {"runs": runs}

@api_router.delete("/runs/{run_id}")
async def delete_run(run_id: str):
    """Delete a run"""
    result = await db.runs.delete_one({"run_id": run_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Run not found")
    
    return {"message": "Run deleted successfully"}

@api_router.get("/runs/stats/{user_id}")
async def get_running_stats(user_id: str):
    """Get weekly and monthly running statistics"""
    try:
        # Get all runs for calculations
        week_ago = datetime.utcnow() - timedelta(days=7)
        month_ago = datetime.utcnow() - timedelta(days=30)
        
        week_iso = week_ago.isoformat()
        month_iso = month_ago.isoformat()
        
        # Weekly runs
        weekly_runs_cursor = db.runs.find({
            "user_id": user_id,
            "timestamp": {"$gte": week_iso}
        })
        weekly_runs = await weekly_runs_cursor.to_list(length=1000)
        
        # Monthly runs
        monthly_runs_cursor = db.runs.find({
            "user_id": user_id,
            "timestamp": {"$gte": month_iso}
        })
        monthly_runs = await monthly_runs_cursor.to_list(length=1000)
        
        # Calculate weekly stats
        weekly_distance = sum(r['distance'] for r in weekly_runs)
        weekly_duration = sum(r['duration'] for r in weekly_runs)
        weekly_calories = sum(r['calories_burned'] for r in weekly_runs)
        weekly_count = len(weekly_runs)
        weekly_avg_pace = sum(r['average_pace'] for r in weekly_runs) / weekly_count if weekly_count > 0 else 0
        
        # Calculate monthly stats
        monthly_distance = sum(r['distance'] for r in monthly_runs)
        monthly_duration = sum(r['duration'] for r in monthly_runs)
        monthly_calories = sum(r['calories_burned'] for r in monthly_runs)
        monthly_count = len(monthly_runs)
        monthly_avg_pace = sum(r['average_pace'] for r in monthly_runs) / monthly_count if monthly_count > 0 else 0
        
        return {
            "weekly": {
                "total_distance": round(weekly_distance, 2),
                "total_duration": weekly_duration,
                "total_calories": round(weekly_calories, 1),
                "run_count": weekly_count,
                "average_pace": round(weekly_avg_pace, 2),
                "average_distance": round(weekly_distance / weekly_count, 2) if weekly_count > 0 else 0
            },
            "monthly": {
                "total_distance": round(monthly_distance, 2),
                "total_duration": monthly_duration,
                "total_calories": round(monthly_calories, 1),
                "run_count": monthly_count,
                "average_pace": round(monthly_avg_pace, 2),
                "average_distance": round(monthly_distance / monthly_count, 2) if monthly_count > 0 else 0
            }
        }
    
    except Exception as e:
        logger.error(f"Error getting running stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# MEMBERSHIP & SUBSCRIPTION ENDPOINTS
# ============================================================================

import stripe
import time

# Initialize Stripe with test key
stripe.api_key = os.getenv('STRIPE_SECRET_KEY', 'sk_test_placeholder')
STRIPE_PRICE_ID = os.getenv('STRIPE_PRICE_ID', 'price_placeholder')

# Membership Models
class MembershipCustomerCreate(BaseModel):
    user_id: str
    email: str
    name: str

class SubscriptionCreate(BaseModel):
    user_id: str
    price_id: Optional[str] = None

class MembershipStatus(BaseModel):
    user_id: str
    is_premium: bool
    is_trial: bool
    trial_days_remaining: int
    subscription_status: str
    subscription_ends_at: Optional[str] = None
    features: List[str]

# Premium Features List
PREMIUM_FEATURES = [
    "personalized_workouts",
    "ai_workout_generation",
    "nutrition_integration",
    "meal_planning",
    "gamification",
    "badges_challenges",
    "advanced_analytics",
    "wearable_integration",
    "diverse_workouts",
    "accessibility_features",
    "multi_language"
]

FREE_FEATURES = [
    "basic_tracking",
    "food_scanning",
    "water_tracking",
    "heart_rate_logging"
]

@api_router.post("/membership/create-customer")
async def create_membership_customer(request: MembershipCustomerCreate):
    """Create or retrieve a Stripe customer for the user"""
    try:
        # Check if customer already exists
        existing = await db.membership_customers.find_one({"user_id": request.user_id})
        if existing:
            return {
                "customer_id": existing["stripe_customer_id"],
                "user_id": request.user_id,
                "email": existing["email"]
            }
        
        # Check if Stripe key is configured
        if stripe.api_key == 'sk_test_placeholder':
            # Mock mode - create local record only
            mock_customer_id = f"cus_mock_{request.user_id}"
            await db.membership_customers.insert_one({
                "user_id": request.user_id,
                "email": request.email,
                "name": request.name,
                "stripe_customer_id": mock_customer_id,
                "mock_mode": True,
                "created_at": datetime.utcnow().isoformat()
            })
            return {
                "customer_id": mock_customer_id,
                "user_id": request.user_id,
                "email": request.email,
                "mock_mode": True
            }
        
        # Create Stripe customer
        customer = stripe.Customer.create(
            email=request.email,
            name=request.name,
            metadata={"user_id": request.user_id, "app": "fittraxx"}
        )
        
        # Store in MongoDB
        await db.membership_customers.insert_one({
            "user_id": request.user_id,
            "email": request.email,
            "name": request.name,
            "stripe_customer_id": customer.id,
            "mock_mode": False,
            "created_at": datetime.utcnow().isoformat()
        })
        
        return {
            "customer_id": customer.id,
            "user_id": request.user_id,
            "email": request.email
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating customer: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/membership/start-trial")
async def start_free_trial(request: SubscriptionCreate):
    """Start a 3-day free trial for the user"""
    try:
        # Get customer
        customer = await db.membership_customers.find_one({"user_id": request.user_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found. Create customer first.")
        
        # Check if already has subscription
        existing_sub = await db.subscriptions.find_one({
            "user_id": request.user_id,
            "status": {"$in": ["trialing", "active"]}
        })
        if existing_sub:
            raise HTTPException(status_code=400, detail="User already has an active subscription or trial")
        
        trial_end = datetime.utcnow() + timedelta(days=3)
        
        # Mock mode handling
        if customer.get("mock_mode", False) or stripe.api_key == 'sk_test_placeholder':
            subscription_id = f"sub_mock_{request.user_id}_{int(time.time())}"
            
            await db.subscriptions.insert_one({
                "subscription_id": subscription_id,
                "user_id": request.user_id,
                "stripe_customer_id": customer["stripe_customer_id"],
                "status": "trialing",
                "trial_start": datetime.utcnow().isoformat(),
                "trial_end": trial_end.isoformat(),
                "mock_mode": True,
                "created_at": datetime.utcnow().isoformat()
            })
            
            return {
                "subscription_id": subscription_id,
                "status": "trialing",
                "trial_ends_at": trial_end.isoformat(),
                "mock_mode": True,
                "message": "3-day free trial started! Stripe integration pending."
            }
        
        # Real Stripe subscription with trial
        price_id = request.price_id or STRIPE_PRICE_ID
        subscription = stripe.Subscription.create(
            customer=customer["stripe_customer_id"],
            items=[{"price": price_id}],
            trial_period_days=3,
            payment_behavior="default_incomplete",
            payment_settings={"save_default_payment_method": "on_subscription"},
            expand=["latest_invoice.payment_intent"]
        )
        
        await db.subscriptions.insert_one({
            "subscription_id": subscription.id,
            "user_id": request.user_id,
            "stripe_customer_id": customer["stripe_customer_id"],
            "status": subscription.status,
            "trial_start": datetime.fromtimestamp(subscription.trial_start).isoformat() if subscription.trial_start else None,
            "trial_end": datetime.fromtimestamp(subscription.trial_end).isoformat() if subscription.trial_end else None,
            "mock_mode": False,
            "created_at": datetime.utcnow().isoformat()
        })
        
        return {
            "subscription_id": subscription.id,
            "status": subscription.status,
            "trial_ends_at": datetime.fromtimestamp(subscription.trial_end).isoformat() if subscription.trial_end else None,
            "client_secret": subscription.latest_invoice.payment_intent.client_secret if subscription.latest_invoice and subscription.latest_invoice.payment_intent else None
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error starting trial: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error starting trial: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/membership/status/{user_id}")
async def get_membership_status(user_id: str):
    """Get the membership status for a user"""
    try:
        # Get latest subscription
        subscription = await db.subscriptions.find_one(
            {"user_id": user_id},
            sort=[("created_at", -1)]
        )
        
        if not subscription:
            return {
                "user_id": user_id,
                "is_premium": False,
                "is_trial": False,
                "trial_days_remaining": 0,
                "subscription_status": "none",
                "subscription_ends_at": None,
                "features": FREE_FEATURES
            }
        
        # Calculate trial days remaining
        trial_days_remaining = 0
        is_trial = subscription["status"] == "trialing"
        is_premium = subscription["status"] in ["trialing", "active"]
        
        if is_trial and subscription.get("trial_end"):
            trial_end = datetime.fromisoformat(subscription["trial_end"].replace("Z", ""))
            remaining = (trial_end - datetime.utcnow()).days
            trial_days_remaining = max(0, remaining)
            
            # Check if trial has expired
            if trial_days_remaining == 0 and is_trial:
                await db.subscriptions.update_one(
                    {"subscription_id": subscription["subscription_id"]},
                    {"$set": {"status": "trial_expired"}}
                )
                is_premium = False
                is_trial = False
        
        features = PREMIUM_FEATURES + FREE_FEATURES if is_premium else FREE_FEATURES
        
        return {
            "user_id": user_id,
            "is_premium": is_premium,
            "is_trial": is_trial,
            "trial_days_remaining": trial_days_remaining,
            "subscription_status": subscription["status"],
            "subscription_ends_at": subscription.get("trial_end") or subscription.get("current_period_end"),
            "features": features
        }
    except Exception as e:
        logger.error(f"Error getting membership status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/membership/subscribe")
async def subscribe_annual(request: SubscriptionCreate):
    """Subscribe to the $25/year annual plan"""
    try:
        customer = await db.membership_customers.find_one({"user_id": request.user_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Mock mode
        if customer.get("mock_mode", False) or stripe.api_key == 'sk_test_placeholder':
            subscription_id = f"sub_annual_{request.user_id}_{int(time.time())}"
            period_end = datetime.utcnow() + timedelta(days=365)
            
            # Update or create subscription
            await db.subscriptions.update_one(
                {"user_id": request.user_id},
                {"$set": {
                    "subscription_id": subscription_id,
                    "status": "active",
                    "current_period_start": datetime.utcnow().isoformat(),
                    "current_period_end": period_end.isoformat(),
                    "plan": "annual",
                    "amount": 2500,
                    "mock_mode": True,
                    "updated_at": datetime.utcnow().isoformat()
                }},
                upsert=True
            )
            
            return {
                "subscription_id": subscription_id,
                "status": "active",
                "plan": "annual",
                "amount": "$25.00/year",
                "period_ends_at": period_end.isoformat(),
                "mock_mode": True,
                "message": "Annual subscription activated! (Mock mode)"
            }
        
        # Real Stripe subscription
        price_id = request.price_id or STRIPE_PRICE_ID
        subscription = stripe.Subscription.create(
            customer=customer["stripe_customer_id"],
            items=[{"price": price_id}],
            payment_behavior="default_incomplete",
            payment_settings={"save_default_payment_method": "on_subscription"},
            expand=["latest_invoice.payment_intent"]
        )
        
        await db.subscriptions.update_one(
            {"user_id": request.user_id},
            {"$set": {
                "subscription_id": subscription.id,
                "status": subscription.status,
                "current_period_start": datetime.fromtimestamp(subscription.current_period_start).isoformat(),
                "current_period_end": datetime.fromtimestamp(subscription.current_period_end).isoformat(),
                "plan": "annual",
                "mock_mode": False,
                "updated_at": datetime.utcnow().isoformat()
            }},
            upsert=True
        )
        
        return {
            "subscription_id": subscription.id,
            "status": subscription.status,
            "client_secret": subscription.latest_invoice.payment_intent.client_secret if subscription.latest_invoice and subscription.latest_invoice.payment_intent else None
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error subscribing: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/membership/cancel/{user_id}")
async def cancel_subscription(user_id: str):
    """Cancel an active subscription"""
    try:
        subscription = await db.subscriptions.find_one({
            "user_id": user_id,
            "status": {"$in": ["trialing", "active"]}
        })
        
        if not subscription:
            raise HTTPException(status_code=404, detail="No active subscription found")
        
        # Mock mode
        if subscription.get("mock_mode", False):
            await db.subscriptions.update_one(
                {"subscription_id": subscription["subscription_id"]},
                {"$set": {
                    "status": "canceled",
                    "canceled_at": datetime.utcnow().isoformat()
                }}
            )
            return {"status": "canceled", "message": "Subscription canceled (Mock mode)"}
        
        # Cancel in Stripe
        canceled = stripe.Subscription.delete(subscription["subscription_id"])
        
        await db.subscriptions.update_one(
            {"subscription_id": subscription["subscription_id"]},
            {"$set": {
                "status": "canceled",
                "canceled_at": datetime.utcnow().isoformat()
            }}
        )
        
        return {"status": "canceled", "subscription_id": canceled.id}
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error canceling: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error canceling subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/membership/pricing")
async def get_pricing():
    """Get membership pricing information"""
    return {
        "plan": "annual",
        "name": "FitTraxx Premium",
        "price": 25.00,
        "currency": "USD",
        "interval": "year",
        "trial_days": 3,
        "features": [
            "AI-Personalized Workouts",
            "Custom Meal Planning & Nutrition",
            "Gamification: Badges & Challenges",
            "Advanced Progress Analytics",
            "Wearable Device Integration",
            "Diverse Workout Library (Yoga, HIIT, Dance, Martial Arts)",
            "Multi-Language Support (EN, ES, DE)",
            "Accessibility Features"
        ],
        "free_features": [
            "Basic Food Tracking",
            "Water Intake Logging",
            "Heart Rate Monitoring",
            "Running Tracker"
        ]
    }

# ============================================================================
# GAMIFICATION ENDPOINTS
# ============================================================================

# Badge definitions
BADGES = [
    {"id": "first_workout", "name": "First Step", "description": "Complete your first workout", "icon": "🏃", "points": 10},
    {"id": "week_streak", "name": "Week Warrior", "description": "7-day workout streak", "icon": "🔥", "points": 50},
    {"id": "month_streak", "name": "Monthly Champion", "description": "30-day workout streak", "icon": "🏆", "points": 200},
    {"id": "calorie_crusher", "name": "Calorie Crusher", "description": "Burn 10,000 calories total", "icon": "💪", "points": 100},
    {"id": "hydration_hero", "name": "Hydration Hero", "description": "Log water for 7 consecutive days", "icon": "💧", "points": 30},
    {"id": "meal_master", "name": "Meal Master", "description": "Log 50 meals", "icon": "🍽️", "points": 75},
    {"id": "run_5k", "name": "5K Runner", "description": "Complete a 5km run", "icon": "🏅", "points": 50},
    {"id": "run_10k", "name": "10K Champion", "description": "Complete a 10km run", "icon": "🥇", "points": 100},
    {"id": "early_bird", "name": "Early Bird", "description": "Complete 10 workouts before 7am", "icon": "🌅", "points": 40},
    {"id": "night_owl", "name": "Night Owl", "description": "Complete 10 workouts after 8pm", "icon": "🦉", "points": 40},
]

@api_router.get("/gamification/badges")
async def get_all_badges():
    """Get all available badges"""
    return {"badges": BADGES}

@api_router.get("/gamification/user-badges/{user_id}")
async def get_user_badges(user_id: str):
    """Get badges earned by a user"""
    try:
        user_badges = await db.user_badges.find({"user_id": user_id}).to_list(100)
        earned_badge_ids = [b["badge_id"] for b in user_badges]
        
        badges_with_status = []
        for badge in BADGES:
            badges_with_status.append({
                **badge,
                "earned": badge["id"] in earned_badge_ids,
                "earned_at": next((b["earned_at"] for b in user_badges if b["badge_id"] == badge["id"]), None)
            })
        
        total_points = sum(b["points"] for b in BADGES if b["id"] in earned_badge_ids)
        
        return {
            "user_id": user_id,
            "badges": badges_with_status,
            "total_points": total_points,
            "badges_earned": len(earned_badge_ids),
            "badges_total": len(BADGES)
        }
    except Exception as e:
        logger.error(f"Error getting user badges: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/gamification/check-badges/{user_id}")
async def check_and_award_badges(user_id: str):
    """Check user progress and award any earned badges"""
    try:
        awarded = []
        
        # Get user stats
        workouts = await db.workouts.find({"user_id": user_id}).to_list(1000)
        meals = await db.meals.find({"user_id": user_id}).to_list(1000)
        water = await db.water_intake.find({"user_id": user_id}).to_list(1000)
        runs = await db.runs.find({"user_id": user_id}).to_list(100)
        
        existing_badges = await db.user_badges.find({"user_id": user_id}).to_list(100)
        existing_ids = [b["badge_id"] for b in existing_badges]
        
        async def award_badge(badge_id: str):
            if badge_id not in existing_ids:
                badge = next((b for b in BADGES if b["id"] == badge_id), None)
                if badge:
                    await db.user_badges.insert_one({
                        "user_id": user_id,
                        "badge_id": badge_id,
                        "earned_at": datetime.utcnow().isoformat()
                    })
                    awarded.append(badge)
        
        # Check badges
        if len(workouts) >= 1:
            await award_badge("first_workout")
        
        if len(meals) >= 50:
            await award_badge("meal_master")
        
        # Check for 5K and 10K runs
        for run in runs:
            if run.get("distance", 0) >= 5:
                await award_badge("run_5k")
            if run.get("distance", 0) >= 10:
                await award_badge("run_10k")
        
        # Check total calories burned
        total_calories = sum(w.get("calories_burned", 0) for w in workouts)
        total_calories += sum(r.get("calories_burned", 0) for r in runs)
        if total_calories >= 10000:
            await award_badge("calorie_crusher")
        
        return {
            "user_id": user_id,
            "new_badges_awarded": awarded,
            "total_badges": len(existing_ids) + len(awarded)
        }
    except Exception as e:
        logger.error(f"Error checking badges: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/gamification/leaderboard")
async def get_leaderboard(limit: int = 10):
    """Get top users by points"""
    try:
        # Aggregate user points
        pipeline = [
            {"$group": {"_id": "$user_id", "badges": {"$push": "$badge_id"}}},
            {"$project": {
                "user_id": "$_id",
                "badge_count": {"$size": "$badges"},
                "badges": 1
            }},
            {"$sort": {"badge_count": -1}},
            {"$limit": limit}
        ]
        
        results = await db.user_badges.aggregate(pipeline).to_list(limit)
        
        leaderboard = []
        for i, result in enumerate(results):
            points = sum(
                next((b["points"] for b in BADGES if b["id"] == bid), 0)
                for bid in result.get("badges", [])
            )
            
            # Get user profile for name
            profile = await db.user_profiles.find_one({"user_id": result["user_id"]})
            
            leaderboard.append({
                "rank": i + 1,
                "user_id": result["user_id"],
                "name": profile.get("name", "Anonymous") if profile else "Anonymous",
                "badge_count": result["badge_count"],
                "total_points": points
            })
        
        return {"leaderboard": leaderboard}
    except Exception as e:
        logger.error(f"Error getting leaderboard: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# MIDDLEWARE AND APP SETUP
# ============================================================================

# Include the router in the main app
app.include_router(api_router)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
