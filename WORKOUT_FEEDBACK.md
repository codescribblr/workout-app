# Post-Workout Feedback System

## Overview

The post-workout feedback system captures user sentiment and experience data after each workout to enable AI-powered coaching improvements. The system stores both raw user input and structured/parsed data for analysis.

## Data Points Captured

### 1. Overall Sentiment (Required)
- **Field**: `overall_sentiment`
- **Type**: Integer (1-10 scale)
- **Purpose**: Quick assessment of how the user felt after the workout
- **Scale**: 
  - 1-3: Terrible/Poor experience
  - 4-6: Neutral/Average experience
  - 7-10: Good/Excellent experience

### 2. Effort Level (Required)
- **Field**: `effort_level`
- **Type**: Enum (`too_easy`, `just_right`, `too_hard`, `varied`)
- **Purpose**: Indicates if the workout difficulty was appropriate
- **Use Cases**:
  - `too_easy`: AI can suggest increasing weight/reps or adding difficulty
  - `just_right`: Maintain current progression
  - `too_hard`: AI can suggest reducing weight/reps or modifying exercises
  - `varied`: AI can analyze which exercises were problematic

### 3. Problematic Exercises (Optional)
- **Field**: `problematic_exercise_ids`
- **Type**: Array of UUIDs (exercise IDs)
- **Purpose**: Identifies specific exercises that caused issues
- **Use Cases**:
  - Track exercises that consistently cause problems
  - Suggest alternatives for problematic exercises
  - Adjust form cues or reduce difficulty for specific exercises
  - Identify patterns across multiple workouts

### 4. Injury Concerns (Optional)
- **Fields**: 
  - `has_injury_concern` (boolean)
  - `affected_muscle_groups` (array of strings)
  - `injury_description` (text)
- **Purpose**: Capture injury or pain concerns during workout
- **Muscle Groups Tracked**:
  - Upper body: neck, shoulder, upper_back, lower_back, chest, bicep, tricep, forearm, wrist
  - Core: core
  - Lower body: hip, quadricep, hamstring, calf, ankle, knee
- **Use Cases**:
  - Alert user to rest affected muscle groups
  - Modify future workouts to avoid aggravating injuries
  - Suggest rehabilitation exercises
  - Track injury patterns over time

### 5. Raw Feedback (Optional)
- **Field**: `raw_feedback`
- **Type**: Text (free-form)
- **Purpose**: Capture unstructured user feedback that may contain valuable insights
- **Use Cases**:
  - Natural language processing for sentiment analysis
  - Extract additional context not captured in structured fields
  - Identify emerging patterns or concerns

### 6. Parsed Data (JSONB)
- **Field**: `parsed_data`
- **Type**: JSONB object
- **Purpose**: Store structured data extracted from raw feedback and form inputs
- **Structure**:
```json
{
  "overall_sentiment": 7,
  "effort_level": "just_right",
  "problematic_exercise_ids": ["uuid1", "uuid2"],
  "has_injury_concern": false,
  "affected_muscle_groups": [],
  "injury_description": null,
  "sentiment_breakdown": {
    "energy": 5,
    "satisfaction": 5,
    "motivation": 5
  },
  "exercise_feedback": [
    {
      "exercise_id": "uuid1",
      "exercise_name": "Bench Press",
      "issue_type": "too_heavy",
      "notes": "Couldn't complete all sets"
    }
  ],
  "submitted_at": "2026-02-04T12:00:00Z"
}
```

## Database Schema

The `workout_feedback` table stores all feedback data:

```sql
CREATE TABLE workout_feedback (
  id UUID PRIMARY KEY,
  workout_session_id UUID REFERENCES workout_sessions(id),
  user_id UUID REFERENCES auth.users(id),
  raw_feedback TEXT,
  parsed_data JSONB,
  overall_sentiment INTEGER,
  effort_level VARCHAR(20),
  problematic_exercise_ids UUID[],
  has_injury_concern BOOLEAN,
  affected_muscle_groups TEXT[],
  injury_description TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## AI Coaching Use Cases

### 1. Dynamic Weight/Rep Adjustments
- **Input**: `effort_level` = "too_hard" + `problematic_exercise_ids`
- **Action**: Reduce weight by 5-10% or reduce reps by 1-2 for next set/workout
- **Example**: User reports bench press was too hard → AI suggests reducing weight from 185lbs to 175lbs

### 2. Exercise Substitutions
- **Input**: `problematic_exercise_ids` consistently flagged across workouts
- **Action**: Suggest alternative exercises targeting same muscle groups
- **Example**: User consistently has issues with barbell squats → AI suggests goblet squats or leg press

### 3. Injury Prevention
- **Input**: `has_injury_concern` = true + `affected_muscle_groups`
- **Action**: 
  - Skip exercises targeting affected muscles in next workout
  - Suggest rest days
  - Recommend rehabilitation exercises
- **Example**: User reports shoulder pain → AI removes all shoulder exercises from next workout and suggests rest

### 4. Motivation & Encouragement
- **Input**: `overall_sentiment` < 5
- **Action**: Provide encouraging messages, acknowledge effort, suggest easier workout next time
- **Example**: User rates workout 3/10 → AI says "Great job pushing through! Let's try a lighter workout next time."

### 5. Progression Tracking
- **Input**: `effort_level` = "too_easy" consistently
- **Action**: Gradually increase difficulty (weight/reps/sets)
- **Example**: User reports workouts are consistently too easy → AI increases weight by 5% and adds one set

### 6. Workout Adaptation
- **Input**: Combination of sentiment, effort level, and problematic exercises
- **Action**: Modify workout plan in real-time or for next session
- **Example**: User reports varied difficulty with specific exercises too hard → AI adjusts those exercises while keeping others the same

## Implementation Flow

1. **Workout Completion**: User completes workout → `completeWorkout()` is called
2. **Feedback Form Display**: `PostWorkoutFeedback` component is shown
3. **Data Collection**: User fills out feedback form (can skip)
4. **Data Storage**: Feedback is saved to `workout_feedback` table with both raw and parsed data
5. **AI Analysis**: Future AI systems can query feedback to:
   - Analyze patterns across workouts
   - Adjust workout plans
   - Provide personalized recommendations
   - Detect injury risks early

## Future Enhancements

1. **Sentiment Breakdown**: Add sub-metrics for energy, satisfaction, motivation
2. **Exercise-Specific Feedback**: Allow users to rate each exercise individually
3. **Voice Input**: Support voice input for feedback (especially useful during/after workout)
4. **Predictive Analytics**: Use historical feedback to predict optimal workout parameters
5. **Real-time Adjustments**: Use feedback during workout to adjust remaining exercises
6. **Feedback Trends**: Show users their feedback trends over time
