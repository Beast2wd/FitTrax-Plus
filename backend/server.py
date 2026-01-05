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
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

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

@api_router.get("/workouts/user/{user_id}")
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

@api_router.delete("/workouts/item/{workout_id}")
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

class RescheduleWorkout(BaseModel):
    new_date: str

@api_router.put("/scheduled-workouts/{scheduled_id}/reschedule")
async def reschedule_workout(scheduled_id: str, data: RescheduleWorkout):
    """Reschedule a workout to a new date"""
    result = await db.scheduled_workouts.update_one(
        {"scheduled_id": scheduled_id},
        {"$set": {"scheduled_date": data.new_date, "updated_at": datetime.utcnow().isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Scheduled workout not found")
    
    return {"message": "Workout rescheduled successfully", "new_date": data.new_date}

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
# AI PERSONALIZED WORKOUTS
# ============================================================================

import json

# Workout Categories
WORKOUT_CATEGORIES = {
    "strength": {
        "name": "Strength Training",
        "description": "Build muscle and increase strength",
        "icon": "💪",
        "color": "#EF4444"
    },
    "weight_training": {
        "name": "Weight Training",
        "description": "Progressive overload with weights",
        "icon": "🏋️",
        "color": "#7C3AED"
    },
    "cardio": {
        "name": "Cardio",
        "description": "Improve heart health and burn calories",
        "icon": "🏃",
        "color": "#3B82F6"
    },
    "hiit": {
        "name": "HIIT",
        "description": "High-Intensity Interval Training",
        "icon": "⚡",
        "color": "#F59E0B"
    },
    "yoga": {
        "name": "Yoga",
        "description": "Flexibility, balance, and mindfulness",
        "icon": "🧘",
        "color": "#10B981"
    },
    "pilates": {
        "name": "Pilates",
        "description": "Core strength and body control",
        "icon": "🤸",
        "color": "#8B5CF6"
    },
    "dance": {
        "name": "Dance Fitness",
        "description": "Fun, rhythmic cardio workouts",
        "icon": "💃",
        "color": "#EC4899"
    },
    "martial_arts": {
        "name": "Martial Arts",
        "description": "Combat-inspired fitness training",
        "icon": "🥋",
        "color": "#14B8A6"
    },
    "stretching": {
        "name": "Stretching & Recovery",
        "description": "Improve flexibility and aid recovery",
        "icon": "🙆",
        "color": "#6366F1"
    }
}

class AIWorkoutRequest(BaseModel):
    user_id: str
    workout_type: str  # strength, cardio, hiit, yoga, pilates, dance, martial_arts, stretching
    duration_minutes: int = 30
    difficulty: str = "intermediate"  # beginner, intermediate, advanced
    focus_area: Optional[str] = None  # upper_body, lower_body, core, full_body
    equipment: List[str] = []  # dumbbells, barbell, kettlebell, resistance_bands, none
    goals: Optional[List[str]] = None  # weight_loss, muscle_gain, endurance, flexibility

class AIWorkoutResponse(BaseModel):
    workout_id: str
    title: str
    description: str
    workout_type: str
    difficulty: str
    duration_minutes: int
    calories_estimate: int
    exercises: List[dict]
    warmup: List[dict]
    cooldown: List[dict]
    tips: List[str]
    generated_at: str

@api_router.get("/workouts/categories")
async def get_workout_categories():
    """Get all available workout categories"""
    return {"categories": WORKOUT_CATEGORIES}

@api_router.post("/workouts/generate-ai")
async def generate_ai_workout(request: AIWorkoutRequest):
    """Generate a personalized workout using AI"""
    try:
        # Check premium status
        subscription = await db.subscriptions.find_one({
            "user_id": request.user_id,
            "status": {"$in": ["trialing", "active"]}
        })
        
        if not subscription:
            raise HTTPException(
                status_code=403, 
                detail="Premium membership required for AI workout generation"
            )
        
        # Get user profile for personalization
        profile = await db.user_profiles.find_one({"user_id": request.user_id})
        
        # Build the prompt
        equipment_str = ", ".join(request.equipment) if request.equipment else "no equipment (bodyweight only)"
        focus_str = request.focus_area.replace("_", " ") if request.focus_area else "full body"
        goals_str = ", ".join(request.goals) if request.goals else "general fitness"
        
        profile_context = ""
        if profile:
            profile_context = f"""
User Profile:
- Age: {profile.get('age', 'unknown')}
- Gender: {profile.get('gender', 'unknown')}
- Current Weight: {profile.get('weight', 'unknown')} lbs
- Goal Weight: {profile.get('goal_weight', 'unknown')} lbs
- Fitness Goal: {profile.get('goal', 'general fitness')}
"""
        
        prompt = f"""Create a {request.duration_minutes}-minute {request.workout_type} workout plan.

{profile_context}

Requirements:
- Difficulty Level: {request.difficulty}
- Focus Area: {focus_str}
- Available Equipment: {equipment_str}
- User Goals: {goals_str}

Generate a complete workout with:
1. Warm-up exercises (3-5 minutes)
2. Main workout exercises
3. Cool-down/stretching (3-5 minutes)

For each exercise, include:
- Exercise name
- Duration (seconds) or reps
- Sets (if applicable)
- Rest period (seconds)
- Brief instructions

Also provide:
- Estimated calories burned
- 3 helpful tips for the workout

Return ONLY valid JSON in this exact format:
{{
    "title": "Workout Title",
    "description": "Brief workout description",
    "calories_estimate": 250,
    "warmup": [
        {{"name": "Exercise Name", "duration": 60, "instructions": "How to do it"}}
    ],
    "exercises": [
        {{"name": "Exercise Name", "reps": "12", "sets": 3, "rest": 30, "instructions": "How to do it"}}
    ],
    "cooldown": [
        {{"name": "Stretch Name", "duration": 30, "instructions": "How to do it"}}
    ],
    "tips": ["Tip 1", "Tip 2", "Tip 3"]
}}"""

        # Call AI
        emergent_key = os.getenv("EMERGENT_LLM_KEY")
        import uuid
        session_id = f"workout_gen_{request.user_id}_{uuid.uuid4().hex[:8]}"
        
        chat = LlmChat(
            api_key=emergent_key,
            session_id=session_id,
            system_message="You are an expert fitness trainer. Generate detailed, safe, and effective workout plans. Always return valid JSON only, no markdown."
        ).with_model('openai', 'gpt-4o')
        
        user_msg = UserMessage(text=prompt)
        response = await chat.send_message(user_msg)
        
        # Parse the response
        try:
            # Clean up response if needed
            response_text = response.strip()
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
            response_text = response_text.strip()
            
            workout_data = json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response: {response}")
            raise HTTPException(status_code=500, detail="Failed to generate workout plan")
        
        # Create workout record
        workout_id = f"ai_workout_{request.user_id}_{int(datetime.utcnow().timestamp())}"
        
        workout = {
            "workout_id": workout_id,
            "user_id": request.user_id,
            "title": workout_data.get("title", f"{request.workout_type.title()} Workout"),
            "description": workout_data.get("description", ""),
            "workout_type": request.workout_type,
            "difficulty": request.difficulty,
            "duration_minutes": request.duration_minutes,
            "focus_area": request.focus_area,
            "equipment": request.equipment,
            "calories_estimate": workout_data.get("calories_estimate", request.duration_minutes * 8),
            "warmup": workout_data.get("warmup", []),
            "exercises": workout_data.get("exercises", []),
            "cooldown": workout_data.get("cooldown", []),
            "tips": workout_data.get("tips", []),
            "generated_at": datetime.utcnow().isoformat(),
            "is_ai_generated": True
        }
        
        # Save to database
        await db.ai_workouts.insert_one(workout.copy())
        
        # Remove any ObjectId that MongoDB might have added
        workout.pop("_id", None)
        
        return workout
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating AI workout: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/workouts/ai-history/{user_id}")
async def get_ai_workout_history(user_id: str, limit: int = 20):
    """Get user's AI-generated workout history"""
    try:
        workouts = await db.ai_workouts.find(
            {"user_id": user_id}
        ).sort("generated_at", -1).limit(limit).to_list(limit)
        
        for w in workouts:
            w.pop("_id", None)
        
        return {"workouts": workouts}
    except Exception as e:
        logger.error(f"Error getting AI workout history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/workouts/ai/{workout_id}")
async def get_ai_workout(workout_id: str):
    """Get a specific AI-generated workout"""
    try:
        workout = await db.ai_workouts.find_one({"workout_id": workout_id})
        if not workout:
            raise HTTPException(status_code=404, detail="Workout not found")
        
        workout.pop("_id", None)
        return workout
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting AI workout: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/workouts/ai/{workout_id}/complete")
async def complete_ai_workout(workout_id: str, user_id: str, actual_duration: int = None):
    """Mark an AI workout as completed and log it"""
    try:
        workout = await db.ai_workouts.find_one({"workout_id": workout_id})
        if not workout:
            raise HTTPException(status_code=404, detail="Workout not found")
        
        # Create workout log entry
        workout_log = {
            "workout_id": f"log_{workout_id}_{int(datetime.utcnow().timestamp())}",
            "user_id": user_id,
            "workout_type": workout["workout_type"],
            "duration": actual_duration or workout["duration_minutes"],
            "calories_burned": workout["calories_estimate"],
            "notes": f"Completed AI workout: {workout['title']}",
            "timestamp": datetime.utcnow().isoformat(),
            "ai_workout_id": workout_id
        }
        
        await db.workouts.insert_one(workout_log)
        
        # Update AI workout completion count
        await db.ai_workouts.update_one(
            {"workout_id": workout_id},
            {"$inc": {"completion_count": 1}, "$set": {"last_completed": datetime.utcnow().isoformat()}}
        )
        
        # Check for badges
        await check_and_award_badges(user_id)
        
        return {
            "message": "Workout completed!",
            "calories_burned": workout_log["calories_burned"],
            "duration": workout_log["duration"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing AI workout: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# EXERCISE IMAGE GENERATION
# ============================================================================

class ExerciseImageRequest(BaseModel):
    exercise_name: str
    exercise_type: str = "strength"  # strength, yoga, cardio, stretching
    instructions: Optional[str] = None

@api_router.post("/exercises/generate-image")
async def generate_exercise_image(request: ExerciseImageRequest):
    """Generate an AI image demonstrating proper exercise form"""
    try:
        # Check cache first
        cached = await db.exercise_images.find_one({
            "exercise_name": request.exercise_name.lower()
        })
        if cached and cached.get("image_base64"):
            return {
                "exercise_name": request.exercise_name,
                "image_base64": cached["image_base64"],
                "cached": True
            }
        
        # Generate image using GPT-image-1
        emergent_key = os.getenv("EMERGENT_LLM_KEY")
        image_gen = OpenAIImageGeneration(api_key=emergent_key)
        
        # Build detailed prompt for exercise demonstration
        exercise_type_style = {
            "strength": "athletic person performing strength training exercise",
            "yoga": "person in yoga pose, peaceful studio setting",
            "cardio": "athletic person doing cardio exercise, energetic pose",
            "stretching": "person doing stretching exercise, flexible pose",
            "hiit": "athletic person in high-intensity exercise position",
            "martial_arts": "martial artist demonstrating technique",
            "dance": "dancer in dynamic dance fitness pose",
            "pilates": "person performing pilates exercise on mat"
        }
        
        style = exercise_type_style.get(request.exercise_type, "athletic person exercising")
        
        prompt = f"""Create a clear, professional fitness instruction image showing:
Exercise: {request.exercise_name}
Style: {style}
{f'Movement: {request.instructions}' if request.instructions else ''}

Requirements:
- Clean white or gym background
- Professional fitness photography style
- Clear demonstration of proper form
- Athletic person with proper posture
- No text or labels on the image
- Well-lit, high quality
- Safe, achievable position"""

        logger.info(f"Generating exercise image for: {request.exercise_name}")
        
        images = await image_gen.generate_images(
            prompt=prompt,
            model="gpt-image-1",
            number_of_images=1
        )
        
        if not images or len(images) == 0:
            raise HTTPException(status_code=500, detail="Failed to generate image")
        
        # Convert to base64
        image_base64 = base64.b64encode(images[0]).decode('utf-8')
        
        # Cache the result
        await db.exercise_images.update_one(
            {"exercise_name": request.exercise_name.lower()},
            {
                "$set": {
                    "exercise_name": request.exercise_name.lower(),
                    "display_name": request.exercise_name,
                    "exercise_type": request.exercise_type,
                    "image_base64": image_base64,
                    "generated_at": datetime.utcnow().isoformat()
                }
            },
            upsert=True
        )
        
        return {
            "exercise_name": request.exercise_name,
            "image_base64": image_base64,
            "cached": False
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating exercise image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/exercises/image/{exercise_name}")
async def get_exercise_image(exercise_name: str):
    """Get a cached exercise image or return placeholder info"""
    try:
        cached = await db.exercise_images.find_one({
            "exercise_name": exercise_name.lower()
        })
        
        if cached and cached.get("image_base64"):
            return {
                "exercise_name": exercise_name,
                "image_base64": cached["image_base64"],
                "exists": True
            }
        
        return {
            "exercise_name": exercise_name,
            "image_base64": None,
            "exists": False
        }
    except Exception as e:
        logger.error(f"Error getting exercise image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/exercises/generate-workout-images/{workout_id}")
async def generate_workout_images(workout_id: str, user_id: str):
    """Generate images for all exercises in a workout (Premium feature)"""
    try:
        # Check premium status
        subscription = await db.subscriptions.find_one({
            "user_id": user_id,
            "status": {"$in": ["trialing", "active"]}
        })
        
        if not subscription:
            raise HTTPException(
                status_code=403, 
                detail="Premium membership required for exercise image generation"
            )
        
        # Get workout
        workout = await db.ai_workouts.find_one({"workout_id": workout_id})
        if not workout:
            raise HTTPException(status_code=404, detail="Workout not found")
        
        # Collect all exercises
        all_exercises = []
        if workout.get("warmup"):
            all_exercises.extend(workout["warmup"])
        if workout.get("exercises"):
            all_exercises.extend(workout["exercises"])
        if workout.get("cooldown"):
            all_exercises.extend(workout["cooldown"])
        
        generated_images = []
        for exercise in all_exercises[:5]:  # Limit to 5 images per request
            exercise_name = exercise.get("name", "")
            if not exercise_name:
                continue
                
            # Check cache first
            cached = await db.exercise_images.find_one({
                "exercise_name": exercise_name.lower()
            })
            
            if cached and cached.get("image_base64"):
                generated_images.append({
                    "exercise_name": exercise_name,
                    "cached": True
                })
                continue
            
            # Generate new image
            try:
                emergent_key = os.getenv("EMERGENT_LLM_KEY")
                image_gen = OpenAIImageGeneration(api_key=emergent_key)
                
                prompt = f"""Professional fitness instruction image:
Exercise: {exercise_name}
{f'Instructions: {exercise.get("instructions", "")}' if exercise.get("instructions") else ''}
Style: Clean gym background, proper form demonstration, athletic person, well-lit, no text"""
                
                images = await image_gen.generate_images(
                    prompt=prompt,
                    model="gpt-image-1",
                    number_of_images=1
                )
                
                if images and len(images) > 0:
                    image_base64 = base64.b64encode(images[0]).decode('utf-8')
                    
                    await db.exercise_images.update_one(
                        {"exercise_name": exercise_name.lower()},
                        {
                            "$set": {
                                "exercise_name": exercise_name.lower(),
                                "display_name": exercise_name,
                                "exercise_type": workout.get("workout_type", "strength"),
                                "image_base64": image_base64,
                                "generated_at": datetime.utcnow().isoformat()
                            }
                        },
                        upsert=True
                    )
                    
                    generated_images.append({
                        "exercise_name": exercise_name,
                        "cached": False
                    })
            except Exception as img_error:
                logger.error(f"Error generating image for {exercise_name}: {str(img_error)}")
                continue
        
        return {
            "workout_id": workout_id,
            "images_generated": len(generated_images),
            "exercises": generated_images
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating workout images: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Pre-built workout templates for each category
WORKOUT_TEMPLATES = {
    "yoga": [
        {
            "template_id": "yoga_morning_flow",
            "title": "Morning Flow Yoga",
            "description": "Energizing morning sequence to start your day",
            "duration_minutes": 20,
            "difficulty": "beginner",
            "exercises": [
                {"name": "Cat-Cow Stretch", "duration": 60, "instructions": "Flow between arching and rounding your spine"},
                {"name": "Downward Dog", "duration": 45, "instructions": "Form an inverted V shape"},
                {"name": "Sun Salutation A", "reps": "5 rounds", "instructions": "Complete flow sequence"},
                {"name": "Warrior I", "duration": 30, "instructions": "Hold each side"},
                {"name": "Warrior II", "duration": 30, "instructions": "Hold each side"},
                {"name": "Triangle Pose", "duration": 30, "instructions": "Hold each side"},
                {"name": "Tree Pose", "duration": 30, "instructions": "Balance on each leg"},
                {"name": "Seated Forward Fold", "duration": 60, "instructions": "Relax and breathe deeply"},
                {"name": "Savasana", "duration": 120, "instructions": "Final relaxation"}
            ]
        }
    ],
    "hiit": [
        {
            "template_id": "hiit_fat_burner",
            "title": "Fat Burning HIIT",
            "description": "High-intensity intervals to maximize calorie burn",
            "duration_minutes": 25,
            "difficulty": "intermediate",
            "exercises": [
                {"name": "Jumping Jacks", "duration": 30, "rest": 10, "sets": 3},
                {"name": "Burpees", "reps": "10", "rest": 20, "sets": 3},
                {"name": "Mountain Climbers", "duration": 30, "rest": 10, "sets": 3},
                {"name": "Squat Jumps", "reps": "15", "rest": 20, "sets": 3},
                {"name": "High Knees", "duration": 30, "rest": 10, "sets": 3},
                {"name": "Push-Up to Plank", "reps": "10", "rest": 20, "sets": 3}
            ]
        }
    ],
    "dance": [
        {
            "template_id": "dance_cardio_party",
            "title": "Dance Cardio Party",
            "description": "Fun, energetic dance workout",
            "duration_minutes": 30,
            "difficulty": "beginner",
            "exercises": [
                {"name": "Warm-Up Groove", "duration": 180, "instructions": "Light movement to music"},
                {"name": "Step Touch Combo", "duration": 120, "instructions": "Side steps with arm movements"},
                {"name": "Grapevine", "duration": 90, "instructions": "Step behind and travel sideways"},
                {"name": "Cha-Cha Slides", "duration": 120, "instructions": "Quick feet forward and back"},
                {"name": "Hip Hop Bounce", "duration": 120, "instructions": "Rhythmic bouncing with attitude"},
                {"name": "Salsa Steps", "duration": 120, "instructions": "Basic salsa forward and back"},
                {"name": "Free Dance", "duration": 180, "instructions": "Express yourself!"},
                {"name": "Cool Down Sway", "duration": 120, "instructions": "Gentle swaying to slow music"}
            ]
        }
    ],
    "martial_arts": [
        {
            "template_id": "kickboxing_basics",
            "title": "Kickboxing Basics",
            "description": "Combat-inspired cardio and strength",
            "duration_minutes": 30,
            "difficulty": "intermediate",
            "exercises": [
                {"name": "Fighter Stance & Footwork", "duration": 120, "instructions": "Practice basic stance and movement"},
                {"name": "Jab-Cross Combo", "reps": "20 each side", "sets": 3, "rest": 15},
                {"name": "Front Kicks", "reps": "15 each leg", "sets": 3, "rest": 15},
                {"name": "Hook Punches", "reps": "15 each side", "sets": 3, "rest": 15},
                {"name": "Roundhouse Kicks", "reps": "10 each leg", "sets": 3, "rest": 20},
                {"name": "Uppercuts", "reps": "15 each side", "sets": 3, "rest": 15},
                {"name": "Speed Bag Simulation", "duration": 60, "sets": 3, "rest": 15},
                {"name": "Shadow Boxing", "duration": 180, "instructions": "Combine all moves freely"}
            ]
        }
    ]
}

@api_router.get("/workouts/templates")
async def get_workout_templates(category: str = None):
    """Get pre-built workout templates"""
    if category:
        templates = WORKOUT_TEMPLATES.get(category, [])
        return {"templates": templates, "category": category}
    
    all_templates = []
    for cat, templates in WORKOUT_TEMPLATES.items():
        for t in templates:
            t["category"] = cat
            all_templates.append(t)
    
    return {"templates": all_templates}

@api_router.get("/workouts/recommended/{user_id}")
async def get_recommended_workouts(user_id: str):
    """Get personalized workout recommendations based on user history"""
    try:
        # Get user profile
        profile = await db.user_profiles.find_one({"user_id": user_id})
        
        # Get recent workouts
        recent_workouts = await db.workouts.find(
            {"user_id": user_id}
        ).sort("timestamp", -1).limit(10).to_list(10)
        
        # Analyze workout patterns
        workout_types = {}
        for w in recent_workouts:
            wt = w.get("workout_type", "other")
            workout_types[wt] = workout_types.get(wt, 0) + 1
        
        # Recommend variety - suggest categories user hasn't tried recently
        all_categories = list(WORKOUT_CATEGORIES.keys())
        tried_categories = list(workout_types.keys())
        
        recommendations = []
        
        # Add untried categories first
        for cat in all_categories:
            if cat not in tried_categories:
                cat_info = WORKOUT_CATEGORIES[cat]
                recommendations.append({
                    "category": cat,
                    "name": cat_info["name"],
                    "reason": "Try something new!",
                    "icon": cat_info["icon"]
                })
        
        # Add templates from favorite categories
        most_popular = sorted(workout_types.items(), key=lambda x: x[1], reverse=True)[:2]
        for cat, count in most_popular:
            if cat in WORKOUT_TEMPLATES:
                for template in WORKOUT_TEMPLATES[cat]:
                    recommendations.append({
                        "category": cat,
                        "template_id": template["template_id"],
                        "title": template["title"],
                        "reason": f"You enjoy {cat} workouts!",
                        "duration": template["duration_minutes"]
                    })
        
        return {
            "recommendations": recommendations[:6],
            "workout_history_count": len(recent_workouts)
        }
    except Exception as e:
        logger.error(f"Error getting recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# WEIGHT TRAINING
# ============================================================================

# Exercise Library
WEIGHT_EXERCISES = {
    "chest": [
        {"name": "Bench Press", "equipment": ["barbell", "bench"], "muscle_groups": ["chest", "triceps", "shoulders"]},
        {"name": "Incline Bench Press", "equipment": ["barbell", "bench"], "muscle_groups": ["upper chest", "shoulders"]},
        {"name": "Dumbbell Flyes", "equipment": ["dumbbells", "bench"], "muscle_groups": ["chest"]},
        {"name": "Cable Crossover", "equipment": ["cable machine"], "muscle_groups": ["chest"]},
        {"name": "Dumbbell Press", "equipment": ["dumbbells", "bench"], "muscle_groups": ["chest", "triceps"]},
        {"name": "Push-Ups", "equipment": ["bodyweight"], "muscle_groups": ["chest", "triceps", "core"]},
    ],
    "back": [
        {"name": "Deadlift", "equipment": ["barbell"], "muscle_groups": ["back", "hamstrings", "glutes"]},
        {"name": "Bent Over Row", "equipment": ["barbell"], "muscle_groups": ["back", "biceps"]},
        {"name": "Lat Pulldown", "equipment": ["cable machine"], "muscle_groups": ["lats", "biceps"]},
        {"name": "Seated Cable Row", "equipment": ["cable machine"], "muscle_groups": ["back", "biceps"]},
        {"name": "Pull-Ups", "equipment": ["pull-up bar"], "muscle_groups": ["lats", "biceps"]},
        {"name": "Dumbbell Row", "equipment": ["dumbbells"], "muscle_groups": ["back", "biceps"]},
        {"name": "T-Bar Row", "equipment": ["barbell", "landmine"], "muscle_groups": ["back"]},
    ],
    "shoulders": [
        {"name": "Overhead Press", "equipment": ["barbell"], "muscle_groups": ["shoulders", "triceps"]},
        {"name": "Dumbbell Shoulder Press", "equipment": ["dumbbells"], "muscle_groups": ["shoulders"]},
        {"name": "Lateral Raises", "equipment": ["dumbbells"], "muscle_groups": ["side delts"]},
        {"name": "Front Raises", "equipment": ["dumbbells"], "muscle_groups": ["front delts"]},
        {"name": "Face Pulls", "equipment": ["cable machine"], "muscle_groups": ["rear delts", "traps"]},
        {"name": "Arnold Press", "equipment": ["dumbbells"], "muscle_groups": ["shoulders"]},
    ],
    "legs": [
        {"name": "Squat", "equipment": ["barbell", "squat rack"], "muscle_groups": ["quads", "glutes", "hamstrings"]},
        {"name": "Leg Press", "equipment": ["leg press machine"], "muscle_groups": ["quads", "glutes"]},
        {"name": "Romanian Deadlift", "equipment": ["barbell"], "muscle_groups": ["hamstrings", "glutes"]},
        {"name": "Leg Curl", "equipment": ["leg curl machine"], "muscle_groups": ["hamstrings"]},
        {"name": "Leg Extension", "equipment": ["leg extension machine"], "muscle_groups": ["quads"]},
        {"name": "Lunges", "equipment": ["dumbbells"], "muscle_groups": ["quads", "glutes"]},
        {"name": "Calf Raises", "equipment": ["machine", "dumbbells"], "muscle_groups": ["calves"]},
        {"name": "Hip Thrust", "equipment": ["barbell", "bench"], "muscle_groups": ["glutes"]},
    ],
    "arms": [
        {"name": "Barbell Curl", "equipment": ["barbell"], "muscle_groups": ["biceps"]},
        {"name": "Dumbbell Curl", "equipment": ["dumbbells"], "muscle_groups": ["biceps"]},
        {"name": "Hammer Curl", "equipment": ["dumbbells"], "muscle_groups": ["biceps", "forearms"]},
        {"name": "Tricep Pushdown", "equipment": ["cable machine"], "muscle_groups": ["triceps"]},
        {"name": "Skull Crushers", "equipment": ["barbell", "bench"], "muscle_groups": ["triceps"]},
        {"name": "Tricep Dips", "equipment": ["dip bars"], "muscle_groups": ["triceps", "chest"]},
        {"name": "Preacher Curl", "equipment": ["ez bar", "preacher bench"], "muscle_groups": ["biceps"]},
    ],
    "core": [
        {"name": "Plank", "equipment": ["bodyweight"], "muscle_groups": ["core"]},
        {"name": "Cable Crunch", "equipment": ["cable machine"], "muscle_groups": ["abs"]},
        {"name": "Hanging Leg Raise", "equipment": ["pull-up bar"], "muscle_groups": ["abs", "hip flexors"]},
        {"name": "Russian Twist", "equipment": ["bodyweight", "weight plate"], "muscle_groups": ["obliques"]},
        {"name": "Ab Wheel Rollout", "equipment": ["ab wheel"], "muscle_groups": ["abs", "core"]},
    ]
}

# Pre-built weight training programs
WEIGHT_TRAINING_PROGRAMS = {
    "push_pull_legs": {
        "name": "Push/Pull/Legs",
        "description": "Classic 3-day split focusing on movement patterns",
        "frequency": "3-6 days/week",
        "level": "intermediate",
        "days": [
            {
                "name": "Push Day",
                "focus": ["chest", "shoulders", "triceps"],
                "exercises": [
                    {"name": "Bench Press", "sets": 4, "reps": "8-10", "rest": 90},
                    {"name": "Overhead Press", "sets": 3, "reps": "8-10", "rest": 90},
                    {"name": "Incline Dumbbell Press", "sets": 3, "reps": "10-12", "rest": 60},
                    {"name": "Lateral Raises", "sets": 3, "reps": "12-15", "rest": 45},
                    {"name": "Tricep Pushdown", "sets": 3, "reps": "12-15", "rest": 45},
                    {"name": "Overhead Tricep Extension", "sets": 3, "reps": "12-15", "rest": 45},
                ]
            },
            {
                "name": "Pull Day", 
                "focus": ["back", "biceps", "rear delts"],
                "exercises": [
                    {"name": "Deadlift", "sets": 4, "reps": "5-6", "rest": 120},
                    {"name": "Bent Over Row", "sets": 4, "reps": "8-10", "rest": 90},
                    {"name": "Lat Pulldown", "sets": 3, "reps": "10-12", "rest": 60},
                    {"name": "Face Pulls", "sets": 3, "reps": "15-20", "rest": 45},
                    {"name": "Barbell Curl", "sets": 3, "reps": "10-12", "rest": 45},
                    {"name": "Hammer Curl", "sets": 3, "reps": "12-15", "rest": 45},
                ]
            },
            {
                "name": "Legs Day",
                "focus": ["quads", "hamstrings", "glutes", "calves"],
                "exercises": [
                    {"name": "Squat", "sets": 4, "reps": "6-8", "rest": 120},
                    {"name": "Romanian Deadlift", "sets": 3, "reps": "10-12", "rest": 90},
                    {"name": "Leg Press", "sets": 3, "reps": "12-15", "rest": 60},
                    {"name": "Leg Curl", "sets": 3, "reps": "12-15", "rest": 45},
                    {"name": "Leg Extension", "sets": 3, "reps": "12-15", "rest": 45},
                    {"name": "Calf Raises", "sets": 4, "reps": "15-20", "rest": 45},
                ]
            }
        ]
    },
    "upper_lower": {
        "name": "Upper/Lower Split",
        "description": "4-day split alternating upper and lower body",
        "frequency": "4 days/week",
        "level": "intermediate",
        "days": [
            {
                "name": "Upper A (Strength)",
                "focus": ["chest", "back", "shoulders", "arms"],
                "exercises": [
                    {"name": "Bench Press", "sets": 4, "reps": "5-6", "rest": 120},
                    {"name": "Bent Over Row", "sets": 4, "reps": "5-6", "rest": 120},
                    {"name": "Overhead Press", "sets": 3, "reps": "6-8", "rest": 90},
                    {"name": "Pull-Ups", "sets": 3, "reps": "6-10", "rest": 90},
                    {"name": "Barbell Curl", "sets": 2, "reps": "10-12", "rest": 60},
                    {"name": "Tricep Dips", "sets": 2, "reps": "10-12", "rest": 60},
                ]
            },
            {
                "name": "Lower A (Strength)",
                "focus": ["quads", "hamstrings", "glutes"],
                "exercises": [
                    {"name": "Squat", "sets": 4, "reps": "5-6", "rest": 120},
                    {"name": "Romanian Deadlift", "sets": 4, "reps": "6-8", "rest": 120},
                    {"name": "Leg Press", "sets": 3, "reps": "8-10", "rest": 90},
                    {"name": "Leg Curl", "sets": 3, "reps": "10-12", "rest": 60},
                    {"name": "Calf Raises", "sets": 4, "reps": "12-15", "rest": 45},
                ]
            },
            {
                "name": "Upper B (Hypertrophy)",
                "focus": ["chest", "back", "shoulders", "arms"],
                "exercises": [
                    {"name": "Dumbbell Press", "sets": 4, "reps": "10-12", "rest": 60},
                    {"name": "Seated Cable Row", "sets": 4, "reps": "10-12", "rest": 60},
                    {"name": "Dumbbell Shoulder Press", "sets": 3, "reps": "10-12", "rest": 60},
                    {"name": "Lat Pulldown", "sets": 3, "reps": "10-12", "rest": 60},
                    {"name": "Lateral Raises", "sets": 3, "reps": "15-20", "rest": 45},
                    {"name": "Dumbbell Curl", "sets": 3, "reps": "12-15", "rest": 45},
                    {"name": "Tricep Pushdown", "sets": 3, "reps": "12-15", "rest": 45},
                ]
            },
            {
                "name": "Lower B (Hypertrophy)",
                "focus": ["quads", "hamstrings", "glutes"],
                "exercises": [
                    {"name": "Leg Press", "sets": 4, "reps": "12-15", "rest": 60},
                    {"name": "Lunges", "sets": 3, "reps": "12 each", "rest": 60},
                    {"name": "Leg Extension", "sets": 3, "reps": "15-20", "rest": 45},
                    {"name": "Leg Curl", "sets": 3, "reps": "15-20", "rest": 45},
                    {"name": "Hip Thrust", "sets": 3, "reps": "12-15", "rest": 60},
                    {"name": "Calf Raises", "sets": 4, "reps": "15-20", "rest": 45},
                ]
            }
        ]
    },
    "full_body": {
        "name": "Full Body",
        "description": "3-day full body workout for beginners",
        "frequency": "3 days/week",
        "level": "beginner",
        "days": [
            {
                "name": "Workout A",
                "focus": ["full body"],
                "exercises": [
                    {"name": "Squat", "sets": 3, "reps": "8-10", "rest": 90},
                    {"name": "Bench Press", "sets": 3, "reps": "8-10", "rest": 90},
                    {"name": "Bent Over Row", "sets": 3, "reps": "8-10", "rest": 90},
                    {"name": "Overhead Press", "sets": 3, "reps": "10-12", "rest": 60},
                    {"name": "Plank", "sets": 3, "reps": "30-60s", "rest": 45},
                ]
            },
            {
                "name": "Workout B",
                "focus": ["full body"],
                "exercises": [
                    {"name": "Deadlift", "sets": 3, "reps": "6-8", "rest": 120},
                    {"name": "Dumbbell Press", "sets": 3, "reps": "10-12", "rest": 60},
                    {"name": "Lat Pulldown", "sets": 3, "reps": "10-12", "rest": 60},
                    {"name": "Lunges", "sets": 3, "reps": "10 each", "rest": 60},
                    {"name": "Dumbbell Curl", "sets": 2, "reps": "12-15", "rest": 45},
                    {"name": "Tricep Pushdown", "sets": 2, "reps": "12-15", "rest": 45},
                ]
            },
            {
                "name": "Workout C",
                "focus": ["full body"],
                "exercises": [
                    {"name": "Leg Press", "sets": 3, "reps": "10-12", "rest": 90},
                    {"name": "Incline Dumbbell Press", "sets": 3, "reps": "10-12", "rest": 60},
                    {"name": "Seated Cable Row", "sets": 3, "reps": "10-12", "rest": 60},
                    {"name": "Romanian Deadlift", "sets": 3, "reps": "10-12", "rest": 90},
                    {"name": "Lateral Raises", "sets": 3, "reps": "15-20", "rest": 45},
                    {"name": "Cable Crunch", "sets": 3, "reps": "15-20", "rest": 45},
                ]
            }
        ]
    }
}

# Weight Training Models
class WeightSet(BaseModel):
    set_number: int
    weight: float  # in lbs
    reps: int
    rpe: Optional[int] = None  # Rate of Perceived Exertion (1-10)

class WeightExerciseLog(BaseModel):
    exercise_name: str
    sets: List[WeightSet]
    notes: Optional[str] = None

class WeightWorkoutLog(BaseModel):
    workout_id: str
    user_id: str
    workout_name: str
    exercises: List[WeightExerciseLog]
    duration_minutes: int
    notes: Optional[str] = None
    timestamp: Optional[str] = None

class PersonalRecord(BaseModel):
    exercise_name: str
    weight: float
    reps: int
    date: str

@api_router.get("/weight-training/exercises")
async def get_weight_exercises(muscle_group: str = None):
    """Get weight training exercises, optionally filtered by muscle group"""
    if muscle_group and muscle_group in WEIGHT_EXERCISES:
        return {"muscle_group": muscle_group, "exercises": WEIGHT_EXERCISES[muscle_group]}
    return {"exercises": WEIGHT_EXERCISES}

@api_router.get("/weight-training/programs")
async def get_weight_programs():
    """Get all weight training programs"""
    return {"programs": WEIGHT_TRAINING_PROGRAMS}

@api_router.get("/weight-training/programs/{program_id}")
async def get_weight_program(program_id: str):
    """Get a specific weight training program"""
    if program_id not in WEIGHT_TRAINING_PROGRAMS:
        raise HTTPException(status_code=404, detail="Program not found")
    return {"program": WEIGHT_TRAINING_PROGRAMS[program_id]}

@api_router.post("/weight-training/log")
async def log_weight_workout(workout: WeightWorkoutLog):
    """Log a completed weight training workout"""
    try:
        workout_dict = workout.dict()
        workout_dict["timestamp"] = workout.timestamp or datetime.utcnow().isoformat()
        workout_dict["log_id"] = f"wt_{workout.user_id}_{int(datetime.utcnow().timestamp())}"
        
        await db.weight_training_logs.insert_one(workout_dict)
        
        # Check for new PRs
        new_prs = []
        for exercise in workout.exercises:
            for s in exercise.sets:
                # Calculate estimated 1RM using Epley formula
                estimated_1rm = s.weight * (1 + s.reps / 30)
                
                # Check if this is a PR
                existing_pr = await db.personal_records.find_one({
                    "user_id": workout.user_id,
                    "exercise_name": exercise.exercise_name
                })
                
                if not existing_pr or estimated_1rm > existing_pr.get("estimated_1rm", 0):
                    pr_data = {
                        "user_id": workout.user_id,
                        "exercise_name": exercise.exercise_name,
                        "weight": s.weight,
                        "reps": s.reps,
                        "estimated_1rm": estimated_1rm,
                        "date": workout_dict["timestamp"]
                    }
                    
                    await db.personal_records.update_one(
                        {"user_id": workout.user_id, "exercise_name": exercise.exercise_name},
                        {"$set": pr_data},
                        upsert=True
                    )
                    new_prs.append({
                        "exercise": exercise.exercise_name,
                        "weight": s.weight,
                        "reps": s.reps,
                        "estimated_1rm": round(estimated_1rm, 1)
                    })
        
        # Calculate total volume
        total_volume = sum(
            sum(s.weight * s.reps for s in ex.sets)
            for ex in workout.exercises
        )
        
        return {
            "message": "Workout logged successfully",
            "log_id": workout_dict["log_id"],
            "total_volume": round(total_volume, 1),
            "new_prs": new_prs
        }
    except Exception as e:
        logger.error(f"Error logging weight workout: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/weight-training/history/{user_id}")
async def get_weight_history(user_id: str, days: int = 30):
    """Get user's weight training history"""
    try:
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        workouts = await db.weight_training_logs.find({
            "user_id": user_id,
            "timestamp": {"$gte": cutoff.isoformat()}
        }).sort("timestamp", -1).to_list(100)
        
        for w in workouts:
            w.pop("_id", None)
        
        return {"workouts": workouts}
    except Exception as e:
        logger.error(f"Error getting weight history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/weight-training/prs/{user_id}")
async def get_personal_records(user_id: str):
    """Get user's personal records"""
    try:
        prs = await db.personal_records.find({"user_id": user_id}).to_list(100)
        
        for pr in prs:
            pr.pop("_id", None)
        
        return {"personal_records": prs}
    except Exception as e:
        logger.error(f"Error getting PRs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/weight-training/exercise-progress/{user_id}/{exercise_name}")
async def get_exercise_progress(user_id: str, exercise_name: str, days: int = 90):
    """Get progress for a specific exercise over time"""
    try:
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        # Get all workout logs containing this exercise
        workouts = await db.weight_training_logs.find({
            "user_id": user_id,
            "timestamp": {"$gte": cutoff.isoformat()},
            "exercises.exercise_name": exercise_name
        }).sort("timestamp", 1).to_list(100)
        
        progress_data = []
        for w in workouts:
            for ex in w.get("exercises", []):
                if ex.get("exercise_name") == exercise_name:
                    # Get best set (highest estimated 1RM)
                    best_set = max(
                        ex.get("sets", []),
                        key=lambda s: s.get("weight", 0) * (1 + s.get("reps", 0) / 30),
                        default=None
                    )
                    if best_set:
                        progress_data.append({
                            "date": w.get("timestamp"),
                            "weight": best_set.get("weight"),
                            "reps": best_set.get("reps"),
                            "estimated_1rm": round(best_set.get("weight", 0) * (1 + best_set.get("reps", 0) / 30), 1),
                            "total_volume": sum(s.get("weight", 0) * s.get("reps", 0) for s in ex.get("sets", []))
                        })
        
        return {
            "exercise_name": exercise_name,
            "progress": progress_data
        }
    except Exception as e:
        logger.error(f"Error getting exercise progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/weight-training/stats/{user_id}")
async def get_weight_training_stats(user_id: str):
    """Get overall weight training statistics"""
    try:
        # Get all workouts
        workouts = await db.weight_training_logs.find({"user_id": user_id}).to_list(1000)
        
        if not workouts:
            return {
                "total_workouts": 0,
                "total_volume": 0,
                "total_sets": 0,
                "favorite_exercises": [],
                "streak": 0
            }
        
        # Calculate stats
        total_volume = 0
        total_sets = 0
        exercise_counts = {}
        
        for w in workouts:
            for ex in w.get("exercises", []):
                ex_name = ex.get("exercise_name")
                exercise_counts[ex_name] = exercise_counts.get(ex_name, 0) + 1
                for s in ex.get("sets", []):
                    total_sets += 1
                    total_volume += s.get("weight", 0) * s.get("reps", 0)
        
        # Top exercises
        top_exercises = sorted(exercise_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Get PR count
        prs = await db.personal_records.count_documents({"user_id": user_id})
        
        return {
            "total_workouts": len(workouts),
            "total_volume": round(total_volume, 1),
            "total_sets": total_sets,
            "total_prs": prs,
            "favorite_exercises": [{"name": name, "count": count} for name, count in top_exercises]
        }
    except Exception as e:
        logger.error(f"Error getting weight training stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# ADVANCED PROGRESS & ANALYTICS
# ============================================================================

class BodyMeasurement(BaseModel):
    user_id: str
    weight: Optional[float] = None  # lbs
    body_fat: Optional[float] = None  # percentage
    chest: Optional[float] = None  # inches
    waist: Optional[float] = None  # inches
    hips: Optional[float] = None  # inches
    biceps: Optional[float] = None  # inches
    thighs: Optional[float] = None  # inches
    notes: Optional[str] = None

@api_router.post("/progress/body-measurements")
async def log_body_measurement(measurement: BodyMeasurement):
    """Log body measurements"""
    try:
        measurement_dict = measurement.dict()
        measurement_dict["measurement_id"] = f"bm_{measurement.user_id}_{int(datetime.utcnow().timestamp())}"
        measurement_dict["timestamp"] = datetime.utcnow().isoformat()
        
        await db.body_measurements.insert_one(measurement_dict)
        
        return {"message": "Measurement logged", "measurement_id": measurement_dict["measurement_id"]}
    except Exception as e:
        logger.error(f"Error logging measurement: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/progress/body-measurements/{user_id}")
async def get_body_measurements(user_id: str, days: int = 90):
    """Get body measurement history"""
    try:
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        measurements = await db.body_measurements.find({
            "user_id": user_id,
            "timestamp": {"$gte": cutoff.isoformat()}
        }).sort("timestamp", 1).to_list(100)
        
        for m in measurements:
            m.pop("_id", None)
        
        return {"measurements": measurements}
    except Exception as e:
        logger.error(f"Error getting measurements: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/progress/comprehensive/{user_id}")
async def get_comprehensive_progress(user_id: str, days: int = 30):
    """Get comprehensive progress data for charts and analytics"""
    try:
        cutoff = datetime.utcnow() - timedelta(days=days)
        cutoff_iso = cutoff.isoformat()
        
        # Get all workout data
        workouts = await db.workouts.find({
            "user_id": user_id,
            "timestamp": {"$gte": cutoff_iso}
        }).sort("timestamp", 1).to_list(1000)
        
        # Get weight training data
        weight_workouts = await db.weight_training_logs.find({
            "user_id": user_id,
            "timestamp": {"$gte": cutoff_iso}
        }).sort("timestamp", 1).to_list(100)
        
        # Get runs
        runs = await db.runs.find({
            "user_id": user_id,
            "timestamp": {"$gte": cutoff_iso}
        }).sort("timestamp", 1).to_list(100)
        
        # Get meals
        meals = await db.meals.find({
            "user_id": user_id,
            "timestamp": {"$gte": cutoff_iso}
        }).sort("timestamp", 1).to_list(500)
        
        # Get water intake
        water = await db.water_intake.find({
            "user_id": user_id,
            "timestamp": {"$gte": cutoff_iso}
        }).sort("timestamp", 1).to_list(500)
        
        # Get body measurements
        body_measurements = await db.body_measurements.find({
            "user_id": user_id
        }).sort("timestamp", -1).limit(30).to_list(30)
        
        # Aggregate daily stats
        daily_stats = {}
        
        # Process workouts
        for w in workouts:
            date = w.get("timestamp", "")[:10]
            if date not in daily_stats:
                daily_stats[date] = {
                    "date": date,
                    "calories_burned": 0,
                    "workout_minutes": 0,
                    "workouts_count": 0,
                    "calories_consumed": 0,
                    "protein": 0,
                    "carbs": 0,
                    "fat": 0,
                    "water_oz": 0,
                    "weight_volume": 0,
                    "run_distance": 0
                }
            daily_stats[date]["calories_burned"] += w.get("calories_burned", 0)
            daily_stats[date]["workout_minutes"] += w.get("duration", 0)
            daily_stats[date]["workouts_count"] += 1
        
        # Process weight training
        for wt in weight_workouts:
            date = wt.get("timestamp", "")[:10]
            if date not in daily_stats:
                daily_stats[date] = {
                    "date": date,
                    "calories_burned": 0,
                    "workout_minutes": 0,
                    "workouts_count": 0,
                    "calories_consumed": 0,
                    "protein": 0,
                    "carbs": 0,
                    "fat": 0,
                    "water_oz": 0,
                    "weight_volume": 0,
                    "run_distance": 0
                }
            
            # Calculate volume
            volume = 0
            for ex in wt.get("exercises", []):
                for s in ex.get("sets", []):
                    volume += s.get("weight", 0) * s.get("reps", 0)
            
            daily_stats[date]["weight_volume"] += volume
            daily_stats[date]["workout_minutes"] += wt.get("duration_minutes", 0)
            daily_stats[date]["workouts_count"] += 1
        
        # Process runs
        for r in runs:
            date = r.get("timestamp", "")[:10]
            if date not in daily_stats:
                daily_stats[date] = {
                    "date": date,
                    "calories_burned": 0,
                    "workout_minutes": 0,
                    "workouts_count": 0,
                    "calories_consumed": 0,
                    "protein": 0,
                    "carbs": 0,
                    "fat": 0,
                    "water_oz": 0,
                    "weight_volume": 0,
                    "run_distance": 0
                }
            daily_stats[date]["calories_burned"] += r.get("calories_burned", 0)
            daily_stats[date]["run_distance"] += r.get("distance", 0)
            daily_stats[date]["workout_minutes"] += r.get("duration", 0) // 60
        
        # Process meals
        for m in meals:
            date = m.get("timestamp", "")[:10]
            if date not in daily_stats:
                daily_stats[date] = {
                    "date": date,
                    "calories_burned": 0,
                    "workout_minutes": 0,
                    "workouts_count": 0,
                    "calories_consumed": 0,
                    "protein": 0,
                    "carbs": 0,
                    "fat": 0,
                    "water_oz": 0,
                    "weight_volume": 0,
                    "run_distance": 0
                }
            nutrition = m.get("nutrition", {})
            daily_stats[date]["calories_consumed"] += nutrition.get("calories", 0)
            daily_stats[date]["protein"] += nutrition.get("protein", 0)
            daily_stats[date]["carbs"] += nutrition.get("carbs", 0)
            daily_stats[date]["fat"] += nutrition.get("fat", 0)
        
        # Process water
        for w in water:
            date = w.get("timestamp", "")[:10]
            if date not in daily_stats:
                daily_stats[date] = {
                    "date": date,
                    "calories_burned": 0,
                    "workout_minutes": 0,
                    "workouts_count": 0,
                    "calories_consumed": 0,
                    "protein": 0,
                    "carbs": 0,
                    "fat": 0,
                    "water_oz": 0,
                    "weight_volume": 0,
                    "run_distance": 0
                }
            daily_stats[date]["water_oz"] += w.get("amount", 0)
        
        # Convert to sorted list
        daily_data = sorted(daily_stats.values(), key=lambda x: x["date"])
        
        # Calculate totals and averages
        total_calories_burned = sum(d["calories_burned"] for d in daily_data)
        total_workout_minutes = sum(d["workout_minutes"] for d in daily_data)
        total_workouts = sum(d["workouts_count"] for d in daily_data)
        total_distance = sum(d["run_distance"] for d in daily_data)
        total_volume = sum(d["weight_volume"] for d in daily_data)
        
        days_with_data = len([d for d in daily_data if d["workouts_count"] > 0])
        
        # Calculate streak
        streak = 0
        today = datetime.utcnow().date()
        for i in range(days):
            check_date = (today - timedelta(days=i)).isoformat()
            if check_date in daily_stats and daily_stats[check_date]["workouts_count"] > 0:
                streak += 1
            else:
                break
        
        # Get PRs
        prs = await db.personal_records.find({"user_id": user_id}).to_list(50)
        for pr in prs:
            pr.pop("_id", None)
        
        # Body measurements for chart
        for bm in body_measurements:
            bm.pop("_id", None)
        
        return {
            "period_days": days,
            "daily_data": daily_data,
            "summary": {
                "total_calories_burned": round(total_calories_burned),
                "total_workout_minutes": round(total_workout_minutes),
                "total_workouts": total_workouts,
                "total_run_distance": round(total_distance, 2),
                "total_weight_volume": round(total_volume),
                "avg_daily_calories_burned": round(total_calories_burned / max(days_with_data, 1)),
                "avg_workout_duration": round(total_workout_minutes / max(total_workouts, 1)),
                "current_streak": streak,
                "active_days": days_with_data
            },
            "personal_records": prs,
            "body_measurements": list(reversed(body_measurements))
        }
    except Exception as e:
        logger.error(f"Error getting comprehensive progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/progress/workout-breakdown/{user_id}")
async def get_workout_breakdown(user_id: str, days: int = 30):
    """Get breakdown of workout types"""
    try:
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        # Get all workouts
        workouts = await db.workouts.find({
            "user_id": user_id,
            "timestamp": {"$gte": cutoff.isoformat()}
        }).to_list(500)
        
        weight_workouts = await db.weight_training_logs.find({
            "user_id": user_id,
            "timestamp": {"$gte": cutoff.isoformat()}
        }).to_list(100)
        
        runs = await db.runs.find({
            "user_id": user_id,
            "timestamp": {"$gte": cutoff.isoformat()}
        }).to_list(100)
        
        ai_workouts = await db.ai_workouts.find({
            "user_id": user_id,
            "last_completed": {"$exists": True}
        }).to_list(100)
        
        # Count by type
        breakdown = {
            "weight_training": len(weight_workouts),
            "running": len(runs),
            "ai_workouts": len([w for w in ai_workouts if w.get("completion_count", 0) > 0]),
            "other": len(workouts)
        }
        
        # Muscle group breakdown from weight training
        muscle_groups = {}
        for wt in weight_workouts:
            for ex in wt.get("exercises", []):
                # Try to determine muscle group from exercise name
                ex_name = ex.get("exercise_name", "").lower()
                if any(w in ex_name for w in ["bench", "chest", "fly", "push"]):
                    muscle_groups["chest"] = muscle_groups.get("chest", 0) + 1
                elif any(w in ex_name for w in ["row", "pull", "lat", "deadlift", "back"]):
                    muscle_groups["back"] = muscle_groups.get("back", 0) + 1
                elif any(w in ex_name for w in ["squat", "leg", "lunge", "calf", "hip"]):
                    muscle_groups["legs"] = muscle_groups.get("legs", 0) + 1
                elif any(w in ex_name for w in ["shoulder", "press", "lateral", "raise"]):
                    muscle_groups["shoulders"] = muscle_groups.get("shoulders", 0) + 1
                elif any(w in ex_name for w in ["curl", "tricep", "bicep", "arm"]):
                    muscle_groups["arms"] = muscle_groups.get("arms", 0) + 1
                elif any(w in ex_name for w in ["plank", "crunch", "ab", "core"]):
                    muscle_groups["core"] = muscle_groups.get("core", 0) + 1
        
        return {
            "workout_types": breakdown,
            "muscle_groups": muscle_groups,
            "total_workouts": sum(breakdown.values())
        }
    except Exception as e:
        logger.error(f"Error getting workout breakdown: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/progress/goals/{user_id}")
async def get_goals_progress(user_id: str):
    """Get progress towards fitness goals"""
    try:
        # Get user profile for goals
        profile = await db.user_profiles.find_one({"user_id": user_id})
        
        if not profile:
            return {"message": "No profile found", "goals": []}
        
        goals = []
        
        # Weight goal
        if profile.get("goal_weight") and profile.get("weight"):
            current = profile.get("weight")
            target = profile.get("goal_weight")
            start = profile.get("starting_weight", current)
            
            if target < start:  # Weight loss
                progress = max(0, min(100, ((start - current) / (start - target)) * 100))
                goals.append({
                    "name": "Weight Loss Goal",
                    "current": current,
                    "target": target,
                    "start": start,
                    "progress": round(progress),
                    "remaining": round(current - target, 1),
                    "unit": "lbs"
                })
            else:  # Weight gain
                progress = max(0, min(100, ((current - start) / (target - start)) * 100))
                goals.append({
                    "name": "Weight Gain Goal",
                    "current": current,
                    "target": target,
                    "start": start,
                    "progress": round(progress),
                    "remaining": round(target - current, 1),
                    "unit": "lbs"
                })
        
        # Weekly workout goal (default: 4 workouts)
        weekly_goal = profile.get("weekly_workout_goal", 4)
        this_week_start = datetime.utcnow() - timedelta(days=datetime.utcnow().weekday())
        
        weekly_workouts = await db.workouts.count_documents({
            "user_id": user_id,
            "timestamp": {"$gte": this_week_start.isoformat()}
        })
        weekly_wt = await db.weight_training_logs.count_documents({
            "user_id": user_id,
            "timestamp": {"$gte": this_week_start.isoformat()}
        })
        weekly_runs = await db.runs.count_documents({
            "user_id": user_id,
            "timestamp": {"$gte": this_week_start.isoformat()}
        })
        
        total_weekly = weekly_workouts + weekly_wt + weekly_runs
        
        goals.append({
            "name": "Weekly Workouts",
            "current": total_weekly,
            "target": weekly_goal,
            "progress": min(100, round((total_weekly / weekly_goal) * 100)),
            "remaining": max(0, weekly_goal - total_weekly),
            "unit": "workouts"
        })
        
        # Daily calorie goal
        calorie_goal = profile.get("calorie_goal")
        if calorie_goal:
            today = datetime.utcnow().date().isoformat()
            today_meals = await db.meals.find({
                "user_id": user_id,
                "timestamp": {"$regex": f"^{today}"}
            }).to_list(50)
            
            today_calories = sum(m.get("nutrition", {}).get("calories", 0) for m in today_meals)
            
            goals.append({
                "name": "Daily Calories",
                "current": round(today_calories),
                "target": calorie_goal,
                "progress": min(100, round((today_calories / calorie_goal) * 100)),
                "remaining": max(0, calorie_goal - today_calories),
                "unit": "cal"
            })
        
        # Water goal (default: 64 oz)
        water_goal = profile.get("daily_water_goal", 64)
        today = datetime.utcnow().date().isoformat()
        today_water = await db.water_intake.find({
            "user_id": user_id,
            "timestamp": {"$regex": f"^{today}"}
        }).to_list(50)
        
        total_water = sum(w.get("amount", 0) for w in today_water)
        
        goals.append({
            "name": "Daily Water",
            "current": round(total_water),
            "target": water_goal,
            "progress": min(100, round((total_water / water_goal) * 100)),
            "remaining": max(0, water_goal - total_water),
            "unit": "oz"
        })
        
        return {"goals": goals}
    except Exception as e:
        logger.error(f"Error getting goals progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# GAMIFICATION ENDPOINTS
# ============================================================================

# Badge definitions
BADGES = [
    # Getting Started
    {"id": "first_workout", "name": "First Step", "description": "Complete your first workout", "icon": "🏃", "points": 10, "category": "starter"},
    {"id": "first_meal", "name": "Nutrition Novice", "description": "Log your first meal", "icon": "🍎", "points": 10, "category": "starter"},
    {"id": "first_run", "name": "Running Start", "description": "Complete your first run", "icon": "👟", "points": 10, "category": "starter"},
    {"id": "profile_complete", "name": "All Set Up", "description": "Complete your profile", "icon": "✅", "points": 15, "category": "starter"},
    
    # Streaks
    {"id": "week_streak", "name": "Week Warrior", "description": "7-day workout streak", "icon": "🔥", "points": 50, "category": "streak"},
    {"id": "two_week_streak", "name": "Unstoppable", "description": "14-day workout streak", "icon": "⚡", "points": 100, "category": "streak"},
    {"id": "month_streak", "name": "Monthly Champion", "description": "30-day workout streak", "icon": "🏆", "points": 200, "category": "streak"},
    {"id": "hydration_streak", "name": "Hydration Hero", "description": "Log water for 7 consecutive days", "icon": "💧", "points": 30, "category": "streak"},
    
    # Running Achievements
    {"id": "run_5k", "name": "5K Runner", "description": "Complete a 5K (3.1 mi) run", "icon": "🏅", "points": 50, "category": "running"},
    {"id": "run_10k", "name": "10K Champion", "description": "Complete a 10K (6.2 mi) run", "icon": "🥇", "points": 100, "category": "running"},
    {"id": "run_half_marathon", "name": "Half Marathon Hero", "description": "Complete a half marathon (13.1 mi)", "icon": "🎖️", "points": 250, "category": "running"},
    {"id": "run_marathon", "name": "Marathon Master", "description": "Complete a marathon (26.2 mi)", "icon": "👑", "points": 500, "category": "running"},
    {"id": "run_50_miles", "name": "50 Mile Club", "description": "Run 50 miles total", "icon": "🚀", "points": 75, "category": "running"},
    {"id": "run_100_miles", "name": "Century Runner", "description": "Run 100 miles total", "icon": "💯", "points": 150, "category": "running"},
    
    # Workout Achievements
    {"id": "calorie_crusher", "name": "Calorie Crusher", "description": "Burn 10,000 calories total", "icon": "💪", "points": 100, "category": "fitness"},
    {"id": "calorie_inferno", "name": "Calorie Inferno", "description": "Burn 50,000 calories total", "icon": "🔥", "points": 300, "category": "fitness"},
    {"id": "workout_10", "name": "Getting Serious", "description": "Complete 10 workouts", "icon": "💪", "points": 25, "category": "fitness"},
    {"id": "workout_50", "name": "Dedicated", "description": "Complete 50 workouts", "icon": "🎯", "points": 75, "category": "fitness"},
    {"id": "workout_100", "name": "Centurion", "description": "Complete 100 workouts", "icon": "⭐", "points": 150, "category": "fitness"},
    
    # Nutrition Achievements
    {"id": "meal_master", "name": "Meal Master", "description": "Log 50 meals", "icon": "🍽️", "points": 75, "category": "nutrition"},
    {"id": "meal_expert", "name": "Nutrition Expert", "description": "Log 200 meals", "icon": "🥗", "points": 150, "category": "nutrition"},
    {"id": "protein_pro", "name": "Protein Pro", "description": "Hit protein goal 7 days in a row", "icon": "🥩", "points": 50, "category": "nutrition"},
    
    # Weight Training
    {"id": "first_lift", "name": "Iron Rookie", "description": "Log your first weight training session", "icon": "🏋️", "points": 10, "category": "weights"},
    {"id": "lift_10_sessions", "name": "Gym Regular", "description": "Complete 10 weight training sessions", "icon": "💪", "points": 40, "category": "weights"},
    {"id": "pr_breaker", "name": "PR Breaker", "description": "Set 5 personal records", "icon": "📈", "points": 50, "category": "weights"},
    {"id": "volume_king", "name": "Volume King", "description": "Lift 100,000 lbs total volume", "icon": "👑", "points": 100, "category": "weights"},
    
    # Time-based
    {"id": "early_bird", "name": "Early Bird", "description": "Complete 10 workouts before 7am", "icon": "🌅", "points": 40, "category": "special"},
    {"id": "night_owl", "name": "Night Owl", "description": "Complete 10 workouts after 8pm", "icon": "🦉", "points": 40, "category": "special"},
    {"id": "weekend_warrior", "name": "Weekend Warrior", "description": "Complete 20 weekend workouts", "icon": "📅", "points": 60, "category": "special"},
]

# Daily Challenges (rotate daily)
DAILY_CHALLENGES = [
    {"id": "daily_steps_5000", "name": "Step It Up", "description": "Walk 5,000 steps today", "target": 5000, "type": "steps", "points": 15},
    {"id": "daily_steps_10000", "name": "Step Master", "description": "Walk 10,000 steps today", "target": 10000, "type": "steps", "points": 25},
    {"id": "daily_water_8", "name": "Hydrate", "description": "Drink 8 glasses of water", "target": 64, "type": "water", "points": 10},
    {"id": "daily_workout", "name": "Move It", "description": "Complete any workout today", "target": 1, "type": "workout", "points": 20},
    {"id": "daily_run_1mi", "name": "Quick Run", "description": "Run at least 1 mile", "target": 1, "type": "run_distance", "points": 15},
    {"id": "daily_run_2mi", "name": "Solid Run", "description": "Run at least 2 miles", "target": 2, "type": "run_distance", "points": 25},
    {"id": "daily_calories_300", "name": "Burn Baby Burn", "description": "Burn 300 calories", "target": 300, "type": "calories", "points": 20},
    {"id": "daily_calories_500", "name": "Calorie Torch", "description": "Burn 500 calories", "target": 500, "type": "calories", "points": 35},
    {"id": "daily_log_meals", "name": "Track Your Fuel", "description": "Log all 3 meals today", "target": 3, "type": "meals", "points": 15},
    {"id": "daily_strength", "name": "Lift Heavy", "description": "Complete a strength workout", "target": 1, "type": "strength", "points": 20},
]

# Weekly Challenges
WEEKLY_CHALLENGES = [
    {"id": "weekly_workouts_5", "name": "Five for Five", "description": "Complete 5 workouts this week", "target": 5, "type": "workouts", "points": 50},
    {"id": "weekly_run_10mi", "name": "10 Mile Week", "description": "Run 10 miles this week", "target": 10, "type": "run_distance", "points": 75},
    {"id": "weekly_run_20mi", "name": "20 Mile Week", "description": "Run 20 miles this week", "target": 20, "type": "run_distance", "points": 125},
    {"id": "weekly_calories_3000", "name": "Burn 3K", "description": "Burn 3,000 calories this week", "target": 3000, "type": "calories", "points": 60},
    {"id": "weekly_strength_3", "name": "Strength Week", "description": "Complete 3 strength sessions", "target": 3, "type": "strength", "points": 45},
    {"id": "weekly_perfect_hydration", "name": "Hydration Week", "description": "Hit water goal every day", "target": 7, "type": "water_days", "points": 40},
    {"id": "weekly_meal_tracking", "name": "Nutrition Week", "description": "Log meals every day this week", "target": 7, "type": "meal_days", "points": 50},
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
        weight_sessions = await db.weight_logs.find({"user_id": user_id}).to_list(500)
        profile = await db.user_profiles.find_one({"user_id": user_id})
        
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
                    existing_ids.append(badge_id)
        
        # ===== STARTER BADGES =====
        if len(workouts) >= 1:
            await award_badge("first_workout")
        
        if len(meals) >= 1:
            await award_badge("first_meal")
            
        if len(runs) >= 1:
            await award_badge("first_run")
            
        if profile and profile.get("name") and profile.get("weight"):
            await award_badge("profile_complete")
        
        # ===== WORKOUT BADGES =====
        if len(workouts) >= 10:
            await award_badge("workout_10")
        if len(workouts) >= 50:
            await award_badge("workout_50")
        if len(workouts) >= 100:
            await award_badge("workout_100")
        
        # ===== NUTRITION BADGES =====
        if len(meals) >= 50:
            await award_badge("meal_master")
        if len(meals) >= 200:
            await award_badge("meal_expert")
        
        # ===== RUNNING BADGES =====
        total_run_distance = sum(r.get("distance", 0) for r in runs)
        
        for run in runs:
            distance = run.get("distance", 0)
            # Distance is in miles
            if distance >= 3.1:  # 5K
                await award_badge("run_5k")
            if distance >= 6.2:  # 10K
                await award_badge("run_10k")
            if distance >= 13.1:  # Half marathon
                await award_badge("run_half_marathon")
            if distance >= 26.2:  # Marathon
                await award_badge("run_marathon")
        
        if total_run_distance >= 50:
            await award_badge("run_50_miles")
        if total_run_distance >= 100:
            await award_badge("run_100_miles")
        
        # ===== CALORIE BADGES =====
        total_calories = sum(w.get("calories_burned", 0) for w in workouts)
        total_calories += sum(r.get("calories_burned", 0) for r in runs)
        
        if total_calories >= 10000:
            await award_badge("calorie_crusher")
        if total_calories >= 50000:
            await award_badge("calorie_inferno")
        
        # ===== WEIGHT TRAINING BADGES =====
        if len(weight_sessions) >= 1:
            await award_badge("first_lift")
        if len(weight_sessions) >= 10:
            await award_badge("lift_10_sessions")
        
        # Calculate total volume
        total_volume = 0
        for session in weight_sessions:
            for exercise in session.get("exercises", []):
                for set_data in exercise.get("sets", []):
                    total_volume += set_data.get("weight", 0) * set_data.get("reps", 0)
        
        if total_volume >= 100000:
            await award_badge("volume_king")
        
        # Count PRs
        pr_count = await db.personal_records.count_documents({"user_id": user_id})
        if pr_count >= 5:
            await award_badge("pr_breaker")
        
        # ===== TIME-BASED BADGES =====
        early_workouts = [w for w in workouts if w.get("timestamp") and 
                         datetime.fromisoformat(w["timestamp"].replace('Z', '+00:00')).hour < 7]
        if len(early_workouts) >= 10:
            await award_badge("early_bird")
        
        late_workouts = [w for w in workouts if w.get("timestamp") and 
                        datetime.fromisoformat(w["timestamp"].replace('Z', '+00:00')).hour >= 20]
        if len(late_workouts) >= 10:
            await award_badge("night_owl")
        
        weekend_workouts = [w for w in workouts if w.get("timestamp") and 
                           datetime.fromisoformat(w["timestamp"].replace('Z', '+00:00')).weekday() >= 5]
        if len(weekend_workouts) >= 20:
            await award_badge("weekend_warrior")
        
        return {
            "user_id": user_id,
            "new_badges_awarded": awarded,
            "total_badges": len(existing_ids)
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
# CHALLENGES ENDPOINTS
# ============================================================================

def get_daily_challenges_for_date(date: datetime):
    """Get the daily challenges for a specific date (rotates based on day of year)"""
    import random
    day_of_year = date.timetuple().tm_yday
    random.seed(day_of_year)
    # Pick 3 random challenges for the day
    challenges = random.sample(DAILY_CHALLENGES, min(3, len(DAILY_CHALLENGES)))
    return challenges

def get_weekly_challenges_for_week(date: datetime):
    """Get the weekly challenges for a specific week"""
    import random
    week_number = date.isocalendar()[1]
    random.seed(week_number * 100)
    # Pick 2 random weekly challenges
    challenges = random.sample(WEEKLY_CHALLENGES, min(2, len(WEEKLY_CHALLENGES)))
    return challenges

@api_router.get("/challenges/daily/{user_id}")
async def get_daily_challenges(user_id: str):
    """Get today's daily challenges with user progress"""
    try:
        today = datetime.utcnow()
        today_str = today.date().isoformat()
        challenges = get_daily_challenges_for_date(today)
        
        # Get user's progress on these challenges
        user_challenges = await db.user_challenges.find({
            "user_id": user_id,
            "date": today_str,
            "type": "daily"
        }).to_list(100)
        
        completed_ids = {c["challenge_id"] for c in user_challenges if c.get("completed")}
        progress_map = {c["challenge_id"]: c.get("progress", 0) for c in user_challenges}
        
        # Calculate actual progress from user data
        for challenge in challenges:
            challenge["progress"] = progress_map.get(challenge["id"], 0)
            challenge["completed"] = challenge["id"] in completed_ids
            challenge["date"] = today_str
        
        return {
            "date": today_str,
            "challenges": challenges,
            "completed_count": len(completed_ids),
            "total_count": len(challenges)
        }
    except Exception as e:
        logger.error(f"Error getting daily challenges: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/challenges/weekly/{user_id}")
async def get_weekly_challenges(user_id: str):
    """Get this week's challenges with user progress"""
    try:
        today = datetime.utcnow()
        week_start = (today - timedelta(days=today.weekday())).date().isoformat()
        challenges = get_weekly_challenges_for_week(today)
        
        # Get user's progress
        user_challenges = await db.user_challenges.find({
            "user_id": user_id,
            "week_start": week_start,
            "type": "weekly"
        }).to_list(100)
        
        completed_ids = {c["challenge_id"] for c in user_challenges if c.get("completed")}
        progress_map = {c["challenge_id"]: c.get("progress", 0) for c in user_challenges}
        
        for challenge in challenges:
            challenge["progress"] = progress_map.get(challenge["id"], 0)
            challenge["completed"] = challenge["id"] in completed_ids
            challenge["week_start"] = week_start
        
        return {
            "week_start": week_start,
            "challenges": challenges,
            "completed_count": len(completed_ids),
            "total_count": len(challenges)
        }
    except Exception as e:
        logger.error(f"Error getting weekly challenges: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class ChallengeProgressUpdate(BaseModel):
    challenge_id: str
    progress: float
    challenge_type: str  # "daily" or "weekly"

@api_router.post("/challenges/update-progress/{user_id}")
async def update_challenge_progress(user_id: str, data: ChallengeProgressUpdate):
    """Update progress on a challenge"""
    try:
        today = datetime.utcnow()
        
        if data.challenge_type == "daily":
            date_key = today.date().isoformat()
            challenge_list = DAILY_CHALLENGES
            filter_key = "date"
        else:
            date_key = (today - timedelta(days=today.weekday())).date().isoformat()
            challenge_list = WEEKLY_CHALLENGES
            filter_key = "week_start"
        
        # Find the challenge
        challenge = next((c for c in challenge_list if c["id"] == data.challenge_id), None)
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        
        completed = data.progress >= challenge["target"]
        
        # Update or insert progress
        await db.user_challenges.update_one(
            {
                "user_id": user_id,
                "challenge_id": data.challenge_id,
                filter_key: date_key
            },
            {
                "$set": {
                    "user_id": user_id,
                    "challenge_id": data.challenge_id,
                    "type": data.challenge_type,
                    filter_key: date_key,
                    "progress": data.progress,
                    "completed": completed,
                    "updated_at": datetime.utcnow().isoformat()
                }
            },
            upsert=True
        )
        
        # Award points if just completed
        points_awarded = 0
        if completed:
            existing = await db.challenge_completions.find_one({
                "user_id": user_id,
                "challenge_id": data.challenge_id,
                filter_key: date_key
            })
            
            if not existing:
                await db.challenge_completions.insert_one({
                    "user_id": user_id,
                    "challenge_id": data.challenge_id,
                    "type": data.challenge_type,
                    filter_key: date_key,
                    "points": challenge["points"],
                    "completed_at": datetime.utcnow().isoformat()
                })
                points_awarded = challenge["points"]
        
        return {
            "success": True,
            "completed": completed,
            "points_awarded": points_awarded,
            "progress": data.progress,
            "target": challenge["target"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating challenge progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/challenges/stats/{user_id}")
async def get_challenge_stats(user_id: str):
    """Get user's challenge completion stats"""
    try:
        # Count completed challenges
        daily_completed = await db.challenge_completions.count_documents({
            "user_id": user_id,
            "type": "daily"
        })
        
        weekly_completed = await db.challenge_completions.count_documents({
            "user_id": user_id,
            "type": "weekly"
        })
        
        # Calculate total points from challenges
        challenge_points = await db.challenge_completions.aggregate([
            {"$match": {"user_id": user_id}},
            {"$group": {"_id": None, "total": {"$sum": "$points"}}}
        ]).to_list(1)
        
        total_challenge_points = challenge_points[0]["total"] if challenge_points else 0
        
        # Get current streak (consecutive days with at least one challenge completed)
        today = datetime.utcnow().date()
        streak = 0
        check_date = today
        
        while True:
            date_str = check_date.isoformat()
            completed = await db.challenge_completions.find_one({
                "user_id": user_id,
                "type": "daily",
                "date": date_str
            })
            if completed:
                streak += 1
                check_date -= timedelta(days=1)
            else:
                break
        
        return {
            "daily_challenges_completed": daily_completed,
            "weekly_challenges_completed": weekly_completed,
            "total_challenge_points": total_challenge_points,
            "current_streak": streak
        }
    except Exception as e:
        logger.error(f"Error getting challenge stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/gamification/summary/{user_id}")
async def get_gamification_summary(user_id: str):
    """Get complete gamification summary for user"""
    try:
        # Get badges
        user_badges = await db.user_badges.find({"user_id": user_id}).to_list(100)
        earned_badge_ids = [b["badge_id"] for b in user_badges]
        badge_points = sum(b["points"] for b in BADGES if b["id"] in earned_badge_ids)
        
        # Get challenge stats
        challenge_points_result = await db.challenge_completions.aggregate([
            {"$match": {"user_id": user_id}},
            {"$group": {"_id": None, "total": {"$sum": "$points"}}}
        ]).to_list(1)
        challenge_points = challenge_points_result[0]["total"] if challenge_points_result else 0
        
        # Calculate level based on total points
        total_points = badge_points + challenge_points
        level = 1
        points_for_next = 100
        
        if total_points >= 2000:
            level = 10
            points_for_next = 0
        elif total_points >= 1500:
            level = 9
            points_for_next = 2000
        elif total_points >= 1100:
            level = 8
            points_for_next = 1500
        elif total_points >= 800:
            level = 7
            points_for_next = 1100
        elif total_points >= 550:
            level = 6
            points_for_next = 800
        elif total_points >= 350:
            level = 5
            points_for_next = 550
        elif total_points >= 200:
            level = 4
            points_for_next = 350
        elif total_points >= 100:
            level = 3
            points_for_next = 200
        elif total_points >= 50:
            level = 2
            points_for_next = 100
        
        level_names = {
            1: "Beginner",
            2: "Novice", 
            3: "Active",
            4: "Dedicated",
            5: "Committed",
            6: "Strong",
            7: "Elite",
            8: "Champion",
            9: "Master",
            10: "Legend"
        }
        
        return {
            "user_id": user_id,
            "total_points": total_points,
            "badge_points": badge_points,
            "challenge_points": challenge_points,
            "badges_earned": len(earned_badge_ids),
            "badges_total": len(BADGES),
            "level": level,
            "level_name": level_names.get(level, "Unknown"),
            "points_for_next_level": points_for_next,
            "progress_to_next": min(100, (total_points / points_for_next * 100)) if points_for_next > 0 else 100
        }
    except Exception as e:
        logger.error(f"Error getting gamification summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# HEALTH SYNC ENDPOINTS (Apple Health / Google Health Connect)
# ============================================================================

class HealthHeartRate(BaseModel):
    current: int
    min: int
    max: int
    avg: int

class HealthSleep(BaseModel):
    totalMinutes: int
    deepMinutes: int
    lightMinutes: int
    remMinutes: int
    awakeMinutes: int

class HealthWorkout(BaseModel):
    type: str
    duration: float  # minutes
    calories: float
    distance: Optional[float] = None
    startTime: str
    endTime: str

class HealthSyncData(BaseModel):
    user_id: str
    steps: int
    distance: float  # miles
    activeCalories: int
    totalCalories: Optional[int] = 0
    heartRate: Optional[HealthHeartRate] = None
    sleep: Optional[HealthSleep] = None
    workouts: List[HealthWorkout] = []
    lastSyncTime: str

@api_router.post("/health/sync")
async def sync_health_data(data: HealthSyncData):
    """Sync health data from wearables (Apple Health / Google Health Connect)"""
    try:
        # Store in health_sync collection
        sync_record = {
            "user_id": data.user_id,
            "steps": data.steps,
            "distance": data.distance,
            "active_calories": data.activeCalories,
            "total_calories": data.totalCalories,
            "heart_rate": data.heartRate.dict() if data.heartRate else None,
            "sleep": data.sleep.dict() if data.sleep else None,
            "workouts": [w.dict() for w in data.workouts],
            "sync_time": data.lastSyncTime,
            "sync_date": datetime.fromisoformat(data.lastSyncTime.replace('Z', '+00:00')).date().isoformat(),
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Upsert based on user_id and sync_date
        await db.health_sync.update_one(
            {"user_id": data.user_id, "sync_date": sync_record["sync_date"]},
            {"$set": sync_record},
            upsert=True
        )
        
        # Update user's daily stats in the water/workout tracking
        # This allows health data to be reflected in other parts of the app
        
        return {
            "success": True,
            "message": "Health data synced successfully",
            "sync_time": data.lastSyncTime
        }
    except Exception as e:
        logger.error(f"Error syncing health data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/health/summary/{user_id}")
async def get_health_summary(user_id: str, days: int = 7):
    """Get health data summary for a user"""
    try:
        cutoff_date = (datetime.utcnow() - timedelta(days=days)).date().isoformat()
        
        records = await db.health_sync.find({
            "user_id": user_id,
            "sync_date": {"$gte": cutoff_date}
        }).sort("sync_date", -1).to_list(length=days)
        
        if not records:
            return {
                "has_data": False,
                "days": [],
                "totals": {
                    "steps": 0,
                    "distance": 0,
                    "active_calories": 0,
                    "workouts": 0
                },
                "averages": {
                    "steps": 0,
                    "distance": 0,
                    "active_calories": 0,
                    "sleep_minutes": 0,
                    "heart_rate": 0
                }
            }
        
        # Calculate totals and averages
        total_steps = sum(r.get("steps", 0) for r in records)
        total_distance = sum(r.get("distance", 0) for r in records)
        total_active_calories = sum(r.get("active_calories", 0) for r in records)
        total_workouts = sum(len(r.get("workouts", [])) for r in records)
        
        sleep_records = [r for r in records if r.get("sleep") and r["sleep"].get("totalMinutes", 0) > 0]
        total_sleep = sum(r["sleep"]["totalMinutes"] for r in sleep_records) if sleep_records else 0
        
        heart_rate_records = [r for r in records if r.get("heart_rate") and r["heart_rate"].get("avg", 0) > 0]
        avg_heart_rate = sum(r["heart_rate"]["avg"] for r in heart_rate_records) / len(heart_rate_records) if heart_rate_records else 0
        
        num_days = len(records)
        
        return {
            "has_data": True,
            "days": [{
                "date": r["sync_date"],
                "steps": r.get("steps", 0),
                "distance": r.get("distance", 0),
                "active_calories": r.get("active_calories", 0),
                "sleep_minutes": r["sleep"]["totalMinutes"] if r.get("sleep") else 0,
                "workouts": len(r.get("workouts", []))
            } for r in records],
            "totals": {
                "steps": total_steps,
                "distance": round(total_distance, 2),
                "active_calories": total_active_calories,
                "workouts": total_workouts
            },
            "averages": {
                "steps": round(total_steps / num_days) if num_days > 0 else 0,
                "distance": round(total_distance / num_days, 2) if num_days > 0 else 0,
                "active_calories": round(total_active_calories / num_days) if num_days > 0 else 0,
                "sleep_minutes": round(total_sleep / len(sleep_records)) if sleep_records else 0,
                "heart_rate": round(avg_heart_rate) if avg_heart_rate > 0 else 0
            }
        }
    except Exception as e:
        logger.error(f"Error getting health summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/health/connection-status/{user_id}")
async def get_health_connection_status(user_id: str):
    """Get the last health sync status for a user"""
    try:
        latest_sync = await db.health_sync.find_one(
            {"user_id": user_id},
            sort=[("sync_time", -1)]
        )
        
        if not latest_sync:
            return {
                "connected": False,
                "last_sync": None,
                "days_since_sync": None
            }
        
        last_sync_time = datetime.fromisoformat(latest_sync["sync_time"].replace('Z', '+00:00'))
        days_since = (datetime.utcnow() - last_sync_time.replace(tzinfo=None)).days
        
        return {
            "connected": days_since < 7,  # Consider connected if synced within 7 days
            "last_sync": latest_sync["sync_time"],
            "days_since_sync": days_since,
            "last_data": {
                "steps": latest_sync.get("steps", 0),
                "distance": latest_sync.get("distance", 0),
                "active_calories": latest_sync.get("active_calories", 0)
            }
        }
    except Exception as e:
        logger.error(f"Error getting health connection status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# PEPTIDE CALCULATOR
# ============================================================================

# Comprehensive Peptide Database
PEPTIDE_DATABASE = {
    # Recovery Peptides
    "bpc-157": {
        "name": "BPC-157",
        "category": "recovery",
        "description": "Body Protection Compound-157, a gastric pentadecapeptide known for healing properties",
        "common_doses": [250, 500, 750],
        "dose_unit": "mcg",
        "frequency": "1-2x daily",
        "typical_duration": "4-8 weeks",
        "half_life": "4 hours",
        "storage": "Refrigerate after reconstitution",
        "common_uses": ["Injury recovery", "Gut healing", "Tendon repair", "Joint health"],
        "notes": "Can be injected subcutaneously near injury site or systemically"
    },
    "tb-500": {
        "name": "TB-500",
        "category": "recovery",
        "description": "Thymosin Beta-4, promotes healing, reduces inflammation, and improves flexibility",
        "common_doses": [2000, 2500, 5000],
        "dose_unit": "mcg",
        "frequency": "2x weekly (loading), 1x weekly (maintenance)",
        "typical_duration": "4-6 weeks loading, then maintenance",
        "half_life": "Unknown, effects last days",
        "storage": "Refrigerate after reconstitution",
        "common_uses": ["Muscle repair", "Wound healing", "Flexibility", "Hair growth"],
        "notes": "Often stacked with BPC-157 for synergistic effects"
    },
    "ghk-cu": {
        "name": "GHK-Cu",
        "category": "recovery",
        "description": "Copper peptide with regenerative and anti-aging properties",
        "common_doses": [1000, 2000, 3000],
        "dose_unit": "mcg",
        "frequency": "Daily",
        "typical_duration": "8-12 weeks",
        "half_life": "Unknown",
        "storage": "Refrigerate after reconstitution",
        "common_uses": ["Skin healing", "Collagen production", "Hair growth", "Anti-aging"],
        "notes": "Also available in topical form for skin application"
    },
    
    # GLP-1 Agonists
    "semaglutide": {
        "name": "Semaglutide",
        "category": "glp1",
        "description": "GLP-1 receptor agonist for weight management and blood sugar control",
        "common_doses": [250, 500, 1000, 1700, 2400],
        "dose_unit": "mcg",
        "frequency": "Once weekly",
        "typical_duration": "Ongoing",
        "half_life": "7 days",
        "storage": "Refrigerate",
        "common_uses": ["Weight loss", "Appetite suppression", "Blood sugar control"],
        "notes": "Start low and titrate up slowly over weeks. Dose in mcg (1000mcg = 1mg)"
    },
    "tirzepatide": {
        "name": "Tirzepatide",
        "category": "glp1",
        "description": "Dual GIP/GLP-1 receptor agonist for enhanced weight loss",
        "common_doses": [2500, 5000, 7500, 10000, 12500, 15000],
        "dose_unit": "mcg",
        "frequency": "Once weekly",
        "typical_duration": "Ongoing",
        "half_life": "5 days",
        "storage": "Refrigerate",
        "common_uses": ["Weight loss", "Blood sugar control", "Appetite control"],
        "notes": "More potent than semaglutide. Titrate slowly."
    },
    
    # Growth Hormone Peptides
    "ipamorelin": {
        "name": "Ipamorelin",
        "category": "gh_secretagogue",
        "description": "Selective growth hormone secretagogue with minimal side effects",
        "common_doses": [100, 200, 300],
        "dose_unit": "mcg",
        "frequency": "2-3x daily",
        "typical_duration": "8-12 weeks",
        "half_life": "2 hours",
        "storage": "Refrigerate after reconstitution",
        "common_uses": ["Muscle growth", "Fat loss", "Recovery", "Sleep quality", "Anti-aging"],
        "notes": "Often combined with CJC-1295 for synergistic effects"
    },
    "cjc-1295": {
        "name": "CJC-1295 (with DAC)",
        "category": "gh_secretagogue",
        "description": "Growth hormone releasing hormone analog with extended half-life",
        "common_doses": [1000, 2000],
        "dose_unit": "mcg",
        "frequency": "2x weekly",
        "typical_duration": "8-12 weeks",
        "half_life": "6-8 days",
        "storage": "Refrigerate after reconstitution",
        "common_uses": ["Sustained GH release", "Muscle growth", "Fat loss", "Recovery"],
        "notes": "DAC version has longer half-life. No-DAC version dosed 2-3x daily"
    },
    "cjc-1295-no-dac": {
        "name": "CJC-1295 (no DAC) / Mod GRF 1-29",
        "category": "gh_secretagogue",
        "description": "Short-acting GHRH analog, mimics natural GH pulsatile release",
        "common_doses": [100, 200],
        "dose_unit": "mcg",
        "frequency": "2-3x daily",
        "typical_duration": "8-12 weeks",
        "half_life": "30 minutes",
        "storage": "Refrigerate after reconstitution",
        "common_uses": ["Natural GH pulse", "Muscle growth", "Fat loss", "Recovery"],
        "notes": "Best combined with Ipamorelin. Inject on empty stomach."
    },
    "tesamorelin": {
        "name": "Tesamorelin",
        "category": "gh_secretagogue",
        "description": "GHRH analog FDA-approved for reducing visceral fat",
        "common_doses": [1000, 2000],
        "dose_unit": "mcg",
        "frequency": "Daily",
        "typical_duration": "12-26 weeks",
        "half_life": "26-38 minutes",
        "storage": "Refrigerate after reconstitution",
        "common_uses": ["Visceral fat reduction", "Body composition", "Cognitive function"],
        "notes": "FDA-approved for lipodystrophy. Strong evidence for fat reduction."
    },
    
    # IGF
    "igf-lr3": {
        "name": "IGF-1 LR3",
        "category": "igf",
        "description": "Long-acting Insulin-like Growth Factor 1 variant",
        "common_doses": [20, 40, 60, 80, 100],
        "dose_unit": "mcg",
        "frequency": "Daily (cycle on/off)",
        "typical_duration": "4 weeks on, 4 weeks off",
        "half_life": "20-30 hours",
        "storage": "Refrigerate, use within 1 month",
        "common_uses": ["Muscle growth", "Hyperplasia", "Fat loss", "Recovery"],
        "notes": "Very potent. Can cause hypoglycemia. Best post-workout."
    },
    
    # Mitochondrial / Longevity
    "mots-c": {
        "name": "MOTS-c",
        "category": "longevity",
        "description": "Mitochondrial-derived peptide that regulates metabolism",
        "common_doses": [5000, 10000],
        "dose_unit": "mcg",
        "frequency": "3-5x weekly",
        "typical_duration": "8-12 weeks",
        "half_life": "Unknown",
        "storage": "Refrigerate after reconstitution",
        "common_uses": ["Metabolic health", "Exercise performance", "Insulin sensitivity", "Longevity"],
        "notes": "Mimics effects of exercise on metabolism"
    },
    "ss-31": {
        "name": "SS-31 (Elamipretide)",
        "category": "longevity",
        "description": "Mitochondria-targeted peptide that improves cellular energy",
        "common_doses": [5000, 10000, 20000],
        "dose_unit": "mcg",
        "frequency": "Daily",
        "typical_duration": "4-8 weeks",
        "half_life": "Unknown",
        "storage": "Refrigerate after reconstitution",
        "common_uses": ["Mitochondrial function", "Energy", "Aging", "Cardiac health"],
        "notes": "Targets cardiolipin in mitochondrial membrane"
    },
    "nad": {
        "name": "NAD+ (Injection)",
        "category": "longevity",
        "description": "Nicotinamide Adenine Dinucleotide, essential coenzyme for cellular energy",
        "common_doses": [50000, 100000, 200000, 500000],
        "dose_unit": "mcg",
        "frequency": "2-3x weekly or as loading protocol",
        "typical_duration": "Ongoing or periodic loading",
        "half_life": "2-4 hours",
        "storage": "Refrigerate",
        "common_uses": ["Energy", "Anti-aging", "Cognitive function", "DNA repair", "Addiction recovery"],
        "notes": "Can cause flushing. Start low. Often given as IV but SubQ works. Doses in mcg (100000mcg = 100mg)"
    },
    
    # Sexual Health
    "pt-141": {
        "name": "PT-141 (Bremelanotide)",
        "category": "sexual_health",
        "description": "Melanocortin receptor agonist for sexual dysfunction",
        "common_doses": [500, 1000, 1750, 2000],
        "dose_unit": "mcg",
        "frequency": "As needed (45 min before activity)",
        "typical_duration": "As needed",
        "half_life": "2.7 hours",
        "storage": "Refrigerate after reconstitution",
        "common_uses": ["Sexual dysfunction", "Libido enhancement", "Erectile function"],
        "notes": "May cause nausea. Do not use more than 8 times per month."
    },
    "kisspeptin": {
        "name": "Kisspeptin-10",
        "category": "sexual_health",
        "description": "Hormone that stimulates GnRH release, affects reproductive hormones",
        "common_doses": [100, 200, 500],
        "dose_unit": "mcg",
        "frequency": "Daily or as needed",
        "typical_duration": "Variable",
        "half_life": "28 minutes",
        "storage": "Refrigerate after reconstitution",
        "common_uses": ["Testosterone support", "Libido", "Reproductive health", "LH/FSH release"],
        "notes": "Stimulates natural hormone production through hypothalamus"
    },
}

# Pydantic Models for Peptide Calculator
class PeptideReconstitution(BaseModel):
    peptide_amount_mg: float
    water_amount_ml: float
    desired_dose_mcg: float
    syringe_units: int = 100  # Standard insulin syringe

class InjectionLog(BaseModel):
    user_id: str
    peptide_id: str
    peptide_name: str
    dose_mcg: float
    injection_site: str
    injection_time: str
    notes: Optional[str] = ""
    side_effects: Optional[str] = ""

class PeptideProtocol(BaseModel):
    user_id: str
    protocol_name: str
    peptide_id: str
    peptide_name: str
    dose_mcg: float
    frequency: str  # "daily", "twice_daily", "weekly", "twice_weekly", etc.
    start_date: str
    end_date: Optional[str] = None
    injection_times: List[str] = []  # e.g., ["08:00", "20:00"]
    notes: Optional[str] = ""
    active: bool = True

class PeptideProgressEntry(BaseModel):
    user_id: str
    date: str
    weight: Optional[float] = None
    body_fat_percentage: Optional[float] = None
    measurements: Optional[dict] = None  # waist, arms, etc.
    energy_level: Optional[int] = None  # 1-10
    sleep_quality: Optional[int] = None  # 1-10
    mood: Optional[int] = None  # 1-10
    notes: Optional[str] = ""
    photos: Optional[List[str]] = []  # base64 encoded

class PeptideAIQuery(BaseModel):
    user_id: str
    question: str
    context: Optional[str] = ""  # Current peptides being used

# Reconstitution Calculator
@api_router.post("/peptides/calculate-reconstitution")
async def calculate_reconstitution(data: PeptideReconstitution):
    """Calculate reconstitution and dosing for peptides"""
    try:
        # Convert mg to mcg
        total_mcg = data.peptide_amount_mg * 1000
        
        # Concentration per mL
        concentration_per_ml = total_mcg / data.water_amount_ml
        
        # Units per mL on insulin syringe
        units_per_ml = data.syringe_units
        
        # mcg per unit
        mcg_per_unit = concentration_per_ml / units_per_ml
        
        # Units needed for desired dose
        units_for_dose = data.desired_dose_mcg / mcg_per_unit
        
        # Number of doses per vial
        doses_per_vial = total_mcg / data.desired_dose_mcg
        
        return {
            "total_peptide_mcg": total_mcg,
            "concentration_mcg_per_ml": round(concentration_per_ml, 2),
            "mcg_per_unit": round(mcg_per_unit, 4),
            "units_for_dose": round(units_for_dose, 1),
            "ml_for_dose": round(units_for_dose / units_per_ml, 3),
            "doses_per_vial": round(doses_per_vial, 1),
            "syringe_marking": f"{round(units_for_dose)} units on {data.syringe_units}U syringe"
        }
    except Exception as e:
        logger.error(f"Error calculating reconstitution: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Get all peptides in database
@api_router.get("/peptides/database")
async def get_peptide_database():
    """Get the complete peptide database"""
    return {
        "peptides": PEPTIDE_DATABASE,
        "categories": {
            "recovery": "Recovery & Healing",
            "glp1": "GLP-1 Agonists (Weight Management)",
            "gh_secretagogue": "Growth Hormone Secretagogues",
            "igf": "IGF Peptides",
            "longevity": "Longevity & Mitochondrial",
            "sexual_health": "Sexual Health"
        }
    }

# Get specific peptide info
@api_router.get("/peptides/info/{peptide_id}")
async def get_peptide_info(peptide_id: str):
    """Get detailed info about a specific peptide"""
    peptide = PEPTIDE_DATABASE.get(peptide_id.lower())
    if not peptide:
        raise HTTPException(status_code=404, detail="Peptide not found")
    return {"peptide_id": peptide_id, **peptide}

# Log an injection
@api_router.post("/peptides/log-injection")
async def log_injection(data: InjectionLog):
    """Log a peptide injection"""
    try:
        log_entry = {
            "user_id": data.user_id,
            "peptide_id": data.peptide_id,
            "peptide_name": data.peptide_name,
            "dose_mcg": data.dose_mcg,
            "injection_site": data.injection_site,
            "injection_time": data.injection_time,
            "notes": data.notes,
            "side_effects": data.side_effects,
            "created_at": datetime.utcnow().isoformat()
        }
        
        result = await db.peptide_injections.insert_one(log_entry)
        
        return {
            "success": True,
            "injection_id": str(result.inserted_id),
            "message": "Injection logged successfully"
        }
    except Exception as e:
        logger.error(f"Error logging injection: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Get injection history
@api_router.get("/peptides/injections/{user_id}")
async def get_injection_history(user_id: str, limit: int = 50, peptide_id: Optional[str] = None):
    """Get user's injection history"""
    try:
        query = {"user_id": user_id}
        if peptide_id:
            query["peptide_id"] = peptide_id
            
        injections = await db.peptide_injections.find(query).sort("injection_time", -1).to_list(limit)
        
        # Convert ObjectId to string
        for inj in injections:
            inj["_id"] = str(inj["_id"])
            
        return {"injections": injections, "count": len(injections)}
    except Exception as e:
        logger.error(f"Error getting injection history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Create/Update protocol
@api_router.post("/peptides/protocol")
async def create_protocol(data: PeptideProtocol):
    """Create or update a peptide protocol"""
    try:
        protocol = {
            "user_id": data.user_id,
            "protocol_name": data.protocol_name,
            "peptide_id": data.peptide_id,
            "peptide_name": data.peptide_name,
            "dose_mcg": data.dose_mcg,
            "frequency": data.frequency,
            "start_date": data.start_date,
            "end_date": data.end_date,
            "injection_times": data.injection_times,
            "notes": data.notes,
            "active": data.active,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        result = await db.peptide_protocols.insert_one(protocol)
        
        return {
            "success": True,
            "protocol_id": str(result.inserted_id),
            "message": "Protocol created successfully"
        }
    except Exception as e:
        logger.error(f"Error creating protocol: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Get user protocols
@api_router.get("/peptides/protocols/{user_id}")
async def get_user_protocols(user_id: str, active_only: bool = True):
    """Get user's peptide protocols"""
    try:
        query = {"user_id": user_id}
        if active_only:
            query["active"] = True
            
        protocols = await db.peptide_protocols.find(query).to_list(100)
        
        for protocol in protocols:
            protocol["_id"] = str(protocol["_id"])
            
        return {"protocols": protocols}
    except Exception as e:
        logger.error(f"Error getting protocols: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Check for missed doses
@api_router.get("/peptides/missed-doses/{user_id}")
async def check_missed_doses(user_id: str):
    """Check for missed doses based on active protocols"""
    try:
        # Get active protocols
        protocols = await db.peptide_protocols.find({
            "user_id": user_id,
            "active": True
        }).to_list(100)
        
        missed_doses = []
        today = datetime.utcnow().date()
        
        for protocol in protocols:
            protocol_start = datetime.fromisoformat(protocol["start_date"]).date()
            
            # Calculate expected doses based on frequency
            frequency = protocol.get("frequency", "daily")
            
            # Get actual injections for this protocol
            injections = await db.peptide_injections.find({
                "user_id": user_id,
                "peptide_id": protocol["peptide_id"],
                "injection_time": {"$gte": protocol["start_date"]}
            }).to_list(1000)
            
            injection_dates = set()
            for inj in injections:
                try:
                    inj_date = datetime.fromisoformat(inj["injection_time"].replace('Z', '+00:00')).date()
                    injection_dates.add(inj_date)
                except:
                    pass
            
            # Check last 7 days for missed doses
            for i in range(7):
                check_date = today - timedelta(days=i)
                if check_date < protocol_start:
                    continue
                    
                should_have_dose = False
                
                if frequency == "daily":
                    should_have_dose = True
                elif frequency == "twice_daily":
                    should_have_dose = True
                elif frequency == "weekly":
                    # Check if this is the scheduled day
                    days_since_start = (check_date - protocol_start).days
                    should_have_dose = days_since_start % 7 == 0
                elif frequency == "twice_weekly":
                    days_since_start = (check_date - protocol_start).days
                    should_have_dose = days_since_start % 3 in [0, 3]
                elif frequency == "three_weekly":
                    days_since_start = (check_date - protocol_start).days
                    should_have_dose = days_since_start % 2 == 0
                
                if should_have_dose and check_date not in injection_dates and check_date < today:
                    missed_doses.append({
                        "protocol_name": protocol["protocol_name"],
                        "peptide_name": protocol["peptide_name"],
                        "missed_date": check_date.isoformat(),
                        "scheduled_dose_mcg": protocol["dose_mcg"],
                        "recommendation": get_missed_dose_recommendation(frequency, (today - check_date).days)
                    })
        
        return {
            "missed_doses": missed_doses,
            "has_missed_doses": len(missed_doses) > 0
        }
    except Exception as e:
        logger.error(f"Error checking missed doses: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def get_missed_dose_recommendation(frequency: str, days_missed: int) -> str:
    """Get recommendation for missed dose"""
    if days_missed == 1:
        if frequency in ["daily", "twice_daily"]:
            return "Take your regular dose as soon as possible, then continue your normal schedule."
        else:
            return "Take your dose today if you remember, otherwise skip and continue with next scheduled dose."
    elif days_missed <= 3:
        return "Do not double up. Resume your regular schedule with your next planned dose."
    else:
        return "Multiple doses missed. Resume normal schedule. Do not try to make up missed doses."

# Log progress entry
@api_router.post("/peptides/progress")
async def log_progress(data: PeptideProgressEntry):
    """Log progress/measurements for peptide tracking"""
    try:
        entry = {
            "user_id": data.user_id,
            "date": data.date,
            "weight": data.weight,
            "body_fat_percentage": data.body_fat_percentage,
            "measurements": data.measurements,
            "energy_level": data.energy_level,
            "sleep_quality": data.sleep_quality,
            "mood": data.mood,
            "notes": data.notes,
            "photos": data.photos,
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Upsert based on user_id and date
        await db.peptide_progress.update_one(
            {"user_id": data.user_id, "date": data.date},
            {"$set": entry},
            upsert=True
        )
        
        return {"success": True, "message": "Progress logged successfully"}
    except Exception as e:
        logger.error(f"Error logging progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Get progress history
@api_router.get("/peptides/progress/{user_id}")
async def get_progress_history(user_id: str, days: int = 30):
    """Get user's progress history"""
    try:
        cutoff_date = (datetime.utcnow() - timedelta(days=days)).date().isoformat()
        
        entries = await db.peptide_progress.find({
            "user_id": user_id,
            "date": {"$gte": cutoff_date}
        }).sort("date", 1).to_list(100)
        
        for entry in entries:
            entry["_id"] = str(entry["_id"])
            # Don't send photos in list view to save bandwidth
            if "photos" in entry:
                entry["has_photos"] = len(entry.get("photos", [])) > 0
                del entry["photos"]
                
        return {"progress": entries, "count": len(entries)}
    except Exception as e:
        logger.error(f"Error getting progress history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# AI Research Insights
@api_router.post("/peptides/ai-insights")
async def get_ai_peptide_insights(data: PeptideAIQuery):
    """Get AI-powered insights about peptides"""
    try:
        emergent_key = os.getenv("EMERGENT_API_KEY") or os.getenv("EMERGENT_LLM_KEY")
        if not emergent_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        # Build context about the peptide database
        peptide_info = ""
        if data.context:
            # Get info about peptides user is asking about
            for pid in data.context.split(","):
                pid = pid.strip().lower()
                if pid in PEPTIDE_DATABASE:
                    p = PEPTIDE_DATABASE[pid]
                    peptide_info += f"\n{p['name']}: {p['description']}. Common doses: {p['common_doses']} {p['dose_unit']}. Frequency: {p['frequency']}. Uses: {', '.join(p['common_uses'])}."
        
        system_prompt = """You are a knowledgeable peptide research assistant for a fitness tracking app. 
You provide research-based, educational information about peptides including BPC-157, TB-500, Semaglutide, Tirzepatide, 
Ipamorelin, CJC-1295, IGF-1 LR3, MOTS-c, SS-31, NAD+, PT-141, Kisspeptin, and others.

Important guidelines:
1. Always emphasize that peptides should only be used under medical supervision
2. Provide research-based information with appropriate caveats
3. Never recommend specific dosing without mentioning to consult healthcare providers
4. Discuss potential side effects and contraindications when relevant
5. Be helpful but responsible - this is educational information only
6. If asked about stacking or combinations, discuss what research suggests but emphasize individual variation
7. Keep responses concise but informative

Current context about user's peptides:""" + peptide_info
        
        chat = LlmChat(
            api_key=emergent_key,
            model="gpt-4o",
            system_message=system_prompt
        )
        
        response = await chat.send_message_async(
            UserMessage(text=data.question)
        )
        
        return {
            "question": data.question,
            "response": response.text,
            "disclaimer": "This information is for educational purposes only. Always consult with a healthcare provider before using any peptides."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting AI insights: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Get injection site rotation suggestions
@api_router.get("/peptides/site-rotation/{user_id}")
async def get_site_rotation(user_id: str):
    """Get injection site rotation recommendations based on history"""
    try:
        # Get last 14 days of injections
        cutoff = (datetime.utcnow() - timedelta(days=14)).isoformat()
        
        injections = await db.peptide_injections.find({
            "user_id": user_id,
            "injection_time": {"$gte": cutoff}
        }).to_list(100)
        
        # Count by site
        site_counts = {}
        for inj in injections:
            site = inj.get("injection_site", "unknown")
            site_counts[site] = site_counts.get(site, 0) + 1
        
        # All possible sites
        all_sites = [
            {"id": "abdomen_left", "name": "Abdomen (Left)", "description": "Left side of belly button"},
            {"id": "abdomen_right", "name": "Abdomen (Right)", "description": "Right side of belly button"},
            {"id": "thigh_left", "name": "Thigh (Left)", "description": "Front of left thigh"},
            {"id": "thigh_right", "name": "Thigh (Right)", "description": "Front of right thigh"},
            {"id": "arm_left", "name": "Upper Arm (Left)", "description": "Back of left upper arm"},
            {"id": "arm_right", "name": "Upper Arm (Right)", "description": "Back of right upper arm"},
            {"id": "glute_left", "name": "Glute (Left)", "description": "Upper outer left glute"},
            {"id": "glute_right", "name": "Glute (Right)", "description": "Upper outer right glute"},
        ]
        
        # Add counts and recommendations
        for site in all_sites:
            site["recent_count"] = site_counts.get(site["id"], 0)
        
        # Sort by least used
        all_sites.sort(key=lambda x: x["recent_count"])
        
        recommended = all_sites[0]["id"] if all_sites else "abdomen_left"
        
        return {
            "sites": all_sites,
            "recommended_next": recommended,
            "tip": "Rotate injection sites to prevent lipodystrophy and ensure consistent absorption."
        }
    except Exception as e:
        logger.error(f"Error getting site rotation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Get peptide stats/summary
@api_router.get("/peptides/stats/{user_id}")
async def get_peptide_stats(user_id: str):
    """Get summary statistics for user's peptide usage"""
    try:
        # Total injections
        total_injections = await db.peptide_injections.count_documents({"user_id": user_id})
        
        # Injections by peptide
        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$group": {
                "_id": "$peptide_id",
                "name": {"$first": "$peptide_name"},
                "count": {"$sum": 1},
                "total_dose_mcg": {"$sum": "$dose_mcg"}
            }},
            {"$sort": {"count": -1}}
        ]
        by_peptide = await db.peptide_injections.aggregate(pipeline).to_list(20)
        
        # Active protocols
        active_protocols = await db.peptide_protocols.count_documents({
            "user_id": user_id,
            "active": True
        })
        
        # This week's injections
        week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()
        this_week = await db.peptide_injections.count_documents({
            "user_id": user_id,
            "injection_time": {"$gte": week_ago}
        })
        
        # Streak (consecutive days with injections)
        today = datetime.utcnow().date()
        streak = 0
        check_date = today
        
        while True:
            date_str = check_date.isoformat()
            next_date_str = (check_date + timedelta(days=1)).isoformat()
            
            has_injection = await db.peptide_injections.find_one({
                "user_id": user_id,
                "injection_time": {"$gte": date_str, "$lt": next_date_str}
            })
            
            if has_injection:
                streak += 1
                check_date -= timedelta(days=1)
            else:
                break
        
        return {
            "total_injections": total_injections,
            "active_protocols": active_protocols,
            "this_week_injections": this_week,
            "current_streak": streak,
            "by_peptide": by_peptide
        }
    except Exception as e:
        logger.error(f"Error getting peptide stats: {str(e)}")
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
