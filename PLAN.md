# Workout Tracking Application - Complete Plan

## Executive Summary

A voice-first workout tracking web application that eliminates the need to look at your phone during workouts. The app uses AI to generate workout plans, track progress, and provide real-time audio guidance. Built with Supabase (database/auth), Vercel (hosting), and AI integration for intelligent workout planning and recommendations.

## Problem Statement

**Current Pain Points:**
- Need to look at phone to see workout plan and next exercise
- Manual tracking of sets, reps, weight during workouts
- Manual rest timer management
- Manual data entry into ChatGPT for recommendations
- No persistent workout history and progress tracking
- Disconnected planning and execution workflow

**Solution:**
- Voice/audio guidance for hands-free operation
- Automatic tracking of all workout metrics
- AI-powered workout planning and progression recommendations
- Persistent database of workout history
- Seamless integration between planning and execution

---

## Architecture Overview

### Tech Stack

**Frontend:**
- **Framework:** Next.js 14+ (App Router) with TypeScript
- **Styling:** Tailwind CSS with responsive design (mobile-first)
- **Audio/Voice:** 
  - Web Speech API (Speech Recognition for voice input)
  - Media Session API (headphone button controls)
  - Web Audio API (audio playback control)
- **Text-to-Speech:** 
  - **Primary:** OpenAI TTS API (tts-1 model - free tier eligible)
  - **Fallback:** Web Speech Synthesis API (browser-native, free)
- **State Management:** React Context + Zustand (for workout state)
- **UI Components:** shadcn/ui or Radix UI primitives
- **PWA:** Service Worker for offline capability

**Backend:**
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **API:** Next.js API Routes + Supabase RPC functions
- **Storage:** Supabase Storage (for workout images/videos if needed)

**AI Integration:**
- **Text Generation:**
  - **Primary:** OpenAI GPT-3.5-turbo (free tier: $5 credit, then pay-as-you-go)
  - **Complex Planning:** GPT-4-turbo (when needed, more expensive)
  - **Alternative:** Anthropic Claude Haiku (free tier available, cost-effective)
- **Text-to-Speech:**
  - **Primary:** OpenAI TTS API (`tts-1` model - $15 per 1M characters, very affordable)
  - **Fallback:** Browser Web Speech Synthesis API (free, lower quality)
- **Voice Recognition:** Web Speech API (free, browser-native)
- **Secondary:** Supabase Edge Functions for AI processing
- **Vector Search:** Supabase pgvector extension (for semantic search of workout history)

**Deployment:**
- **Hosting:** Vercel (Next.js deployment)
- **CI/CD:** GitHub Actions
- **Database Migrations:** Custom migration system with tracking table

**Development Tools:**
- **Package Manager:** npm or pnpm
- **Linting:** ESLint + Prettier
- **Type Safety:** TypeScript strict mode
- **Testing:** Jest + React Testing Library (optional, for MVP)

---

## Database Schema

### Core Tables

#### 1. `migrations` (Migration Tracking)
```sql
CREATE TABLE migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  checksum VARCHAR(64) NOT NULL
);
```

#### 2. `users` (Extended User Profile)
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(100),
  age INTEGER,
  weight_kg DECIMAL(5,2),
  height_cm INTEGER,
  fitness_level VARCHAR(20), -- beginner, intermediate, advanced
  goals TEXT[], -- array of goal strings
  preferences JSONB, -- audio settings, units, headphone config, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Preferences JSONB Structure:**
```json
{
  "audio": {
    "tts_provider": "openai", // "openai" | "browser"
    "voice_id": "alloy", // OpenAI voice: alloy, echo, fable, onyx, nova, shimmer
    "speech_rate": 1.0, // 0.5 to 2.0
    "volume": 0.8 // 0.0 to 1.0
  },
  "units": {
    "weight": "kg", // "kg" | "lbs"
    "distance": "m" // "m" | "ft"
  },
  "headphones": {
    "model": "airpods-pro", // user's headphone model
    "has_single_button": true,
    "has_double_button": false, // volume up/down
    "has_triple_button": false, // play/pause, next, previous
    "button_mappings": {
      "single_press": "pause_resume",
      "double_press": "next_set",
      "long_press": "voice_input",
      "volume_up": null, // if available
      "volume_down": null // if available
    }
  }
}
```

#### 3. `exercises` (Exercise Library)
```sql
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50), -- strength, cardio, flexibility, etc.
  muscle_groups TEXT[], -- chest, back, legs, etc.
  equipment_needed TEXT[], -- barbell, dumbbell, bodyweight, etc.
  description TEXT,
  instructions TEXT[],
  ai_metadata JSONB, -- for AI context
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name)
);
```

#### 4. `workout_plans` (Workout Plans/Templates)
```sql
CREATE TABLE workout_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_template BOOLEAN DEFAULT false,
  is_ai_generated BOOLEAN DEFAULT false,
  ai_prompt TEXT, -- original prompt used to generate
  frequency_per_week INTEGER,
  estimated_duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 5. `workout_plan_exercises` (Exercises in a Plan)
```sql
CREATE TABLE workout_plan_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_plan_id UUID REFERENCES workout_plans(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  sets INTEGER NOT NULL,
  reps_min INTEGER,
  reps_max INTEGER,
  weight_kg DECIMAL(6,2),
  rest_seconds INTEGER DEFAULT 60,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 6. `workout_sessions` (Actual Workout Sessions)
```sql
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_plan_id UUID REFERENCES workout_plans(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  notes TEXT,
  ai_summary TEXT, -- AI-generated summary/insights
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 7. `workout_sets` (Individual Sets Performed)
```sql
CREATE TABLE workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_session_id UUID REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps INTEGER,
  weight_kg DECIMAL(6,2),
  rest_seconds INTEGER,
  rpe INTEGER, -- Rate of Perceived Exertion (1-10)
  notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 8. `goals` (User Goals)
```sql
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  target_date DATE,
  target_value DECIMAL(10,2),
  current_value DECIMAL(10,2),
  unit VARCHAR(20), -- kg, reps, minutes, etc.
  status VARCHAR(20) DEFAULT 'active', -- active, completed, paused
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 9. `ai_recommendations` (AI-Generated Recommendations)
```sql
CREATE TABLE ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_type VARCHAR(50), -- next_workout, progression, form_tip, etc.
  content TEXT NOT NULL,
  context_data JSONB, -- workout history, goals, etc. used to generate
  is_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Indexes

```sql
-- Performance indexes
CREATE INDEX idx_workout_sessions_user_id ON workout_sessions(user_id, started_at DESC);
CREATE INDEX idx_workout_sets_session_id ON workout_sets(workout_session_id, set_number);
CREATE INDEX idx_workout_plan_exercises_plan_id ON workout_plan_exercises(workout_plan_id, order_index);
CREATE INDEX idx_goals_user_status ON goals(user_id, status);
CREATE INDEX idx_ai_recommendations_user ON ai_recommendations(user_id, created_at DESC);
```

### Row Level Security (RLS)

Enable RLS on all tables and create policies:
- Users can only access their own data
- Exercises table is public read, admin write
- Templates can be shared (optional feature)

---

## Features Breakdown

### Phase 1: Core MVP (Weeks 1-4)

#### 1.1 Authentication & User Setup
- [ ] Supabase Auth integration
- [ ] User profile creation/editing
- [ ] Onboarding flow (fitness level, goals, preferences)
- [ ] Headphone settings configuration:
  - Detect headphone model (if possible)
  - Map available buttons
  - Configure button actions
  - Test button functionality

#### 1.2 Exercise Library
- [ ] Pre-populated exercise database (100+ common exercises)
- [ ] Exercise search and filtering
- [ ] Exercise detail view (instructions, muscle groups)

#### 1.3 Workout Plan Creation
- [ ] Manual workout plan builder
- [ ] Add/remove exercises from plan
- [ ] Set reps, sets, weight, rest time
- [ ] Save plans as templates

#### 1.4 Workout Execution (Voice-First)
- [ ] Start workout session from plan
- [ ] AI voice announcements (TTS):
  - Current exercise name
  - Target sets/reps/weight
  - Rest timer countdown
  - Next exercise preview
  - Set completion confirmations
- [ ] Headphone button controls:
  - Single press: Pause/Resume workout
  - Double press: Complete current set / Move to next set
  - Long press: Trigger voice input for set data (reps, weight)
  - Volume buttons: Adjust TTS volume (if supported)
- [ ] Voice input (when triggered):
  - Listen for reps, weight, RPE
  - Natural language parsing ("I did 10 reps at 50 kilos")
  - Confirmation via TTS
- [ ] Manual tracking fallback (if voice/buttons fail)
- [ ] Real-time set tracking UI (minimal, glanceable)
- [ ] Headphone button detection and mapping

#### 1.5 Workout History
- [ ] View past workout sessions
- [ ] Session details (exercises, sets, reps, weight)
- [ ] Basic progress charts (weight lifted over time)

### Phase 2: AI Integration (Weeks 5-8)

#### 2.1 AI Workout Plan Generation
- [ ] AI prompt interface for generating plans
- [ ] Context-aware plan generation (user goals, history, preferences)
- [ ] Plan review and editing before saving
- [ ] Save AI-generated plans

#### 2.2 AI Workout Recommendations
- [ ] Post-workout analysis and suggestions
- [ ] Progression recommendations (weight/reps increases)
- [ ] Form tips based on performance patterns
- [ ] Next workout suggestions

#### 2.3 AI Chat Interface
- [ ] Chat with AI about workouts
- [ ] Context includes user's workout history
- [ ] Ask questions: "What should I do next?", "How did I do?"
- [ ] Get personalized advice

### Phase 3: Advanced Features (Weeks 9-12)

#### 3.1 Goals & Progress Tracking
- [ ] Create and manage goals
- [ ] Progress visualization
- [ ] Goal achievement tracking
- [ ] AI suggestions for goal adjustments

#### 3.2 Advanced Analytics
- [ ] Volume tracking (total weight lifted)
- [ ] Strength progression charts
- [ ] Workout frequency heatmap
- [ ] Personal records (PRs) tracking

#### 3.3 Enhanced Voice Features
- [ ] Customizable voice settings (voice selection, speed, volume)
- [ ] Background music integration
- [ ] Voice feedback on form/pace
- [ ] Multi-language support
- [ ] Advanced headphone button customization
- [ ] Button action presets (quick configurations)

#### 3.4 Social & Sharing
- [ ] Share workout plans
- [ ] Export workout data
- [ ] Workout templates marketplace (optional)

---

## Headphone Button Integration

### Media Session API

The app uses the **Media Session API** to capture headphone button presses. This API allows web apps to respond to media control buttons on connected devices.

**Supported Button Actions:**
- **Play/Pause:** Single press on most headphones
- **Next Track:** Double press (can be mapped to "next set")
- **Previous Track:** Triple press (can be mapped to "previous set")
- **Seek Forward/Backward:** Long press (can be mapped to voice input)

**Implementation Approach:**

1. **Media Session Setup:**
   ```typescript
   if ('mediaSession' in navigator) {
     navigator.mediaSession.setActionHandler('play', handlePlay);
     navigator.mediaSession.setActionHandler('pause', handlePause);
     navigator.mediaSession.setActionHandler('previoustrack', handlePrevious);
     navigator.mediaSession.setActionHandler('nexttrack', handleNext);
   }
   ```

2. **Button Mapping:**
   - User configures available buttons in settings
   - Map Media Session actions to workout actions
   - Store mappings in user preferences JSONB

3. **Button Detection:**
   - Attempt to detect headphone model (limited browser support)
   - Provide manual selection if auto-detection fails
   - Test buttons during setup to verify functionality

4. **Fallback Handling:**
   - If Media Session API not available, use manual UI controls
   - Provide visual feedback for button presses
   - Log button events for debugging

**Supported Headphone Types:**
- AirPods / AirPods Pro
- Bluetooth headphones with media controls
- Wired headphones with inline controls
- Most modern headphones with play/pause buttons

**Limitations:**
- Browser support varies (Chrome/Edge best, Safari limited)
- Some button combinations may not be detectable
- Volume buttons typically not accessible via Media Session API

---

## AI Integration Strategy

### AI Workflow Architecture

**Text Generation:**
```
User Input → Supabase Edge Function → OpenAI GPT-3.5-turbo → Process Response → Store in DB → Return to User
```

**Text-to-Speech:**
```
Text → OpenAI TTS API (or Browser TTS) → Audio Buffer → Web Audio API → Playback
```

### Key AI Use Cases

#### 1. Workout Plan Generation
**Prompt Template:**
```
You are a fitness coach. Based on the following information:
- User goals: {goals}
- Fitness level: {level}
- Available equipment: {equipment}
- Workout frequency: {frequency}
- Past workout history: {history}

Generate a {duration}-minute workout plan with {focus_area} focus.
Include exercises, sets, reps, and rest periods.
```

**Storage:** Save generated plan to `workout_plans` with `is_ai_generated=true` and `ai_prompt` field.

#### 2. Post-Workout Analysis
**Input:** Completed workout session data
**Output:** 
- Performance summary
- Progression recommendations
- Form tips
- Next workout suggestions

**Storage:** Save to `ai_recommendations` table.

#### 3. Real-Time Workout Guidance
**Context:** Current workout session, user's historical performance
**Output:** 
- Weight suggestions for next set
- Rest time recommendations
- Form reminders

#### 4. Conversational AI
**Context:** Full workout history, goals, preferences
**Capabilities:**
- Answer questions about progress
- Suggest workout modifications
- Provide motivation and tips
- Explain exercise form

#### 5. Text-to-Speech (TTS) for Audio Announcements
**Provider:** OpenAI TTS API (`tts-1` model)
**Use Cases:**
- Exercise announcements
- Set completion confirmations
- Rest timer countdown
- Workout guidance and tips
- Error messages and confirmations

**Voice Options (OpenAI):**
- `alloy` - Neutral, balanced
- `echo` - Clear, confident
- `fable` - Warm, friendly
- `onyx` - Deep, authoritative
- `nova` - Bright, energetic
- `shimmer` - Soft, gentle

**Implementation:**
- Pre-generate common phrases for faster playback
- Stream longer announcements
- Cache frequently used audio
- Fallback to browser TTS for offline mode

### AI Implementation Details

**Supabase Edge Functions:**
- `generate-workout-plan`: Creates new workout plans (GPT-3.5-turbo or GPT-4)
- `analyze-workout`: Post-workout analysis (GPT-3.5-turbo)
- `get-recommendations`: Fetch AI recommendations (GPT-3.5-turbo)
- `chat-workout`: Conversational interface (GPT-3.5-turbo)
- `generate-tts`: Text-to-speech generation (OpenAI TTS API)

**Vector Search (Future Enhancement):**
- Use pgvector to store workout session embeddings
- Semantic search for similar workouts
- Pattern recognition for progression

**Cost Optimization:**

**AI Model Selection:**
- **Text Generation:** 
  - Use GPT-3.5-turbo for 90% of requests (very cost-effective)
  - Only use GPT-4-turbo for complex workout plan generation
  - Consider Claude Haiku for simple Q&A (often cheaper)
- **Text-to-Speech:**
  - Use OpenAI TTS (`tts-1` model) - extremely affordable ($15 per 1M characters)
  - Average workout announcement: ~500 characters = $0.0000075 per announcement
  - Fallback to browser TTS for offline/low-cost scenarios
- **General:**
  - Cache common AI responses (workout templates, common questions)
  - Batch requests when possible
  - Stream responses to reduce perceived latency
  - Use shorter prompts where possible
  - Implement rate limiting to prevent abuse

**Estimated Monthly Costs (per active user):**
- TTS: ~$0.10-0.50 (depending on usage)
- Text Generation: ~$1-5 (GPT-3.5-turbo, depends on chat usage)
- Database: Free tier (Supabase)
- Hosting: Free tier (Vercel)
- **Total: ~$1-6 per active user/month** (very affordable)

---

## Headphone Button Controls & Settings

### Overview

The app uses headphone action buttons as the primary interaction method during workouts, eliminating the need for wake words or looking at the phone. Users can configure button mappings based on their specific headphone model and preferences.

### Available Button Actions

**Core Actions:**
- **Pause/Resume Workout:** Toggle workout pause state
- **Complete Set / Next Set:** Mark current set complete and move to next
- **Voice Input:** Trigger voice recognition to input set data (reps, weight, RPE)
- **Previous Set:** Go back to previous set (if needed)
- **Skip Exercise:** Skip current exercise and move to next
- **Repeat Announcement:** Replay current exercise instructions

### Button Mapping Configuration

**Settings UI Flow:**
1. **Headphone Detection:**
   - Attempt automatic detection (limited browser support)
   - Provide manual selection dropdown
   - Common models: AirPods, AirPods Pro, Generic Bluetooth, Wired

2. **Button Availability:**
   - User selects which buttons their headphones have:
     - Single button (play/pause)
     - Double button (volume up/down)
     - Triple button (play/pause, next, previous)
     - Long press support

3. **Action Mapping:**
   - Map each available button press to a workout action
   - Visual button diagram showing current mappings
   - Test buttons during setup to verify functionality
   - Save preferences to user profile

4. **Presets:**
   - Quick setup presets for common configurations:
     - "Minimal" (single button only)
     - "Standard" (play/pause + next)
     - "Full Control" (all buttons mapped)

### Technical Implementation

**Media Session API Usage:**
```typescript
// Setup media session handlers
navigator.mediaSession.setActionHandler('play', () => {
  const action = getUserMappedAction('play');
  executeWorkoutAction(action);
});

navigator.mediaSession.setActionHandler('pause', () => {
  const action = getUserMappedAction('pause');
  executeWorkoutAction(action);
});

navigator.mediaSession.setActionHandler('nexttrack', () => {
  const action = getUserMappedAction('nexttrack');
  executeWorkoutAction(action);
});

navigator.mediaSession.setActionHandler('previoustrack', () => {
  const action = getUserMappedAction('previoustrack');
  executeWorkoutAction(action);
});
```

**Button Press Detection:**
- Listen for Media Session events
- Debounce rapid presses (prevent double-triggers)
- Provide audio/TTS confirmation for each action
- Log button events for debugging and analytics

**Voice Input Trigger:**
- When long press or designated button is pressed:
  1. Play audio prompt: "Listening for set data..."
  2. Activate Web Speech Recognition
  3. Parse natural language input
  4. Confirm parsed data via TTS
  5. Save to workout session

### User Experience Flow

**During Workout:**
1. User presses headphone button
2. App receives Media Session event
3. App looks up mapped action from user preferences
4. Executes action (pause, next set, etc.)
5. Provides TTS confirmation: "Set 2 complete. Rest for 60 seconds."
6. Continues workout flow

**Voice Input Example:**
1. User completes set, presses long-press button
2. TTS: "Please tell me your reps and weight"
3. User: "I did 10 reps at 50 kilos"
4. App parses: reps=10, weight=50kg
5. TTS: "Recorded: 10 reps at 50 kilograms. Rest for 90 seconds."
6. App saves set data and starts rest timer

### Fallback Handling

**If Media Session API Not Available:**
- Show on-screen button controls
- Provide manual input options
- Guide user to use browser that supports Media Session API

**If Buttons Don't Work:**
- Provide troubleshooting guide
- Allow manual button testing
- Offer alternative input methods (voice commands, screen taps)

### Storage

Button mappings stored in `user_profiles.preferences.headphones` JSONB field:
```json
{
  "headphones": {
    "model": "airpods-pro",
    "has_single_button": true,
    "has_double_button": false,
    "has_triple_button": false,
    "button_mappings": {
      "single_press": "pause_resume",
      "double_press": "next_set",
      "long_press": "voice_input"
    },
    "last_tested": "2026-01-25T10:30:00Z"
  }
}
```

---

## Migration System

### Migration Structure

```
/migrations
  /001_initial_schema.sql
  /002_add_ai_recommendations.sql
  /003_add_vector_extension.sql
  ...
```

### Migration Tracking Table

Already defined in schema above. Each migration file should:
1. Be idempotent (safe to run multiple times)
2. Include checksum for verification
3. Have rollback capability (optional, for MVP)

### Migration Script (`scripts/migrate.ts`)

```typescript
// Pseudo-code structure
async function migrate() {
  const appliedMigrations = await getAppliedMigrations();
  const migrationFiles = await getMigrationFiles();
  
  for (const file of migrationFiles) {
    if (!appliedMigrations.includes(file.name)) {
      await executeMigration(file);
      await recordMigration(file);
    }
  }
}
```

### Migration Execution Flow

1. **Local Development:** Run migrations manually via script
2. **CI/CD:** GitHub Actions runs migrations before deployment
3. **Production:** Migrations run automatically on deploy

---

## GitHub Actions CI/CD Pipeline

### Workflow File: `.github/workflows/deploy.yml`

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      # - run: npm test (if tests exist)

  migrate:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - name: Run migrations
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: npm run migrate:prod

  deploy:
    runs-on: ubuntu-latest
    needs: migrate
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### Environment Variables

**Required Secrets:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (for migrations)
- `SUPABASE_ANON_KEY` (for client)
- `OPENAI_API_KEY` (used for both GPT models and TTS API)
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

**Note:** OpenAI API key is used for both text generation (GPT-3.5-turbo/GPT-4) and text-to-speech (TTS API). Both services bill from the same account.

---

## Project Structure

```
workout-app/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_add_ai_recommendations.sql
│   └── ...
├── scripts/
│   ├── migrate.ts
│   └── seed-exercises.ts
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── (dashboard)/
│   │   │   ├── plans/
│   │   │   ├── workouts/
│   │   │   ├── history/
│   │   │   └── goals/
│   │   ├── api/
│   │   │   ├── workouts/
│   │   │   ├── plans/
│   │   │   └── ai/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── workout/
│   │   │   ├── WorkoutPlayer.tsx
│   │   │   ├── SetTracker.tsx
│   │   │   ├── RestTimer.tsx
│   │   │   └── HeadphoneControls.tsx
│   │   ├── settings/
│   │   │   ├── HeadphoneSettings.tsx
│   │   │   ├── VoiceSettings.tsx
│   │   │   └── ButtonMapper.tsx
│   │   ├── plans/
│   │   ├── exercises/
│   │   └── ui/                 # shadcn components
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   ├── ai/
│   │   │   ├── openai.ts
│   │   │   ├── tts.ts
│   │   │   └── prompts.ts
│   │   ├── audio/
│   │   │   ├── mediaSession.ts
│   │   │   └── audioPlayer.ts
│   │   ├── migrations/
│   │   │   └── runner.ts
│   │   └── utils/
│   ├── hooks/
│   │   ├── useWorkout.ts
│   │   ├── useVoice.ts
│   │   ├── useHeadphoneButtons.ts
│   │   ├── useTTS.ts
│   │   └── useAI.ts
│   ├── types/
│   │   └── database.ts         # Generated from Supabase
│   └── stores/
│       └── workoutStore.ts     # Zustand store
├── supabase/
│   ├── functions/              # Edge Functions
│   │   ├── generate-workout-plan/
│   │   ├── analyze-workout/
│   │   ├── chat-workout/
│   │   └── generate-tts/
│   └── config.toml
├── public/
│   └── icons/                  # PWA icons
├── .env.local.example
├── .gitignore
├── next.config.js
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── PLAN.md
```

---

## Development Phases & Timeline

### Phase 1: Foundation (Week 1-2)
- [ ] Project setup (Next.js, TypeScript, Tailwind)
- [ ] Supabase project creation
- [ ] Database schema implementation (migrations)
- [ ] Authentication setup
- [ ] Basic UI layout and navigation

### Phase 2: Core Features (Week 3-4)
- [ ] Exercise library
- [ ] Workout plan builder
- [ ] Workout execution UI
- [ ] Basic workout history

### Phase 3: Voice Integration (Week 5-6)
- [ ] Media Session API integration for headphone buttons
- [ ] Headphone button event handling
- [ ] Button mapping configuration UI
- [ ] OpenAI TTS API integration (with browser fallback)
- [ ] Audio announcements with AI voice
- [ ] Voice input recognition (Web Speech API)
- [ ] Rest timer with audio countdown
- [ ] Testing with various headphone models

### Phase 4: AI Integration (Week 7-8)
- [ ] Supabase Edge Functions setup
- [ ] OpenAI API integration
- [ ] Workout plan generation
- [ ] Post-workout analysis
- [ ] AI chat interface

### Phase 5: Polish & Testing (Week 9-10)
- [ ] Mobile optimization
- [ ] PWA setup
- [ ] Error handling
- [ ] Performance optimization
- [ ] User testing

### Phase 6: Advanced Features (Week 11-12)
- [ ] Goals tracking
- [ ] Advanced analytics
- [ ] Enhanced voice features
- [ ] Additional AI capabilities

---

## Technical Considerations

### Performance
- **Database Queries:** Use indexes, limit result sets, implement pagination
- **AI Calls:** Cache responses, batch requests, use streaming for chat
- **Audio:** 
  - Pre-generate common TTS phrases
  - Cache TTS audio responses
  - Use Web Audio API efficiently
  - Stream longer audio announcements
- **Headphone Buttons:** Debounce button presses to prevent double-triggers
- **Mobile:** Optimize bundle size, lazy load components, use Next.js Image

### Security
- **RLS Policies:** Strict row-level security on all tables
- **API Keys:** Store in environment variables, never expose client-side
- **Input Validation:** Validate all user inputs, sanitize AI prompts
- **Rate Limiting:** Implement on AI endpoints to prevent abuse

### Accessibility
- **Voice Fallback:** Always provide manual input option
- **Button Fallback:** UI controls available if headphone buttons don't work
- **Screen Reader:** Proper ARIA labels
- **Keyboard Navigation:** Full keyboard support
- **Visual Feedback:** Clear visual indicators for audio states and button presses
- **Audio Feedback:** Confirm all button actions with audio/TTS

### Offline Support
- **Service Worker:** Cache workout plans and exercise library
- **Local Storage:** Store workout in progress locally
- **Sync:** Sync when connection restored

---

## Success Metrics

### User Experience
- Workout completion rate
- Average workout duration
- User retention (daily/weekly active users)
- Voice command accuracy

### Technical
- Page load time < 2s
- API response time < 500ms
- 99.9% uptime
- Zero data loss

### Business (Future)
- User engagement
- Feature adoption rates
- AI recommendation acceptance rate

---

## Future Enhancements (Post-MVP)

1. **Social Features:** Share workouts, follow friends, challenges
2. **Wearable Integration:** Apple Watch, Fitbit, etc.
3. **Video Analysis:** Form check via camera
4. **Nutrition Tracking:** Meal planning and macros
5. **Coaching Marketplace:** Connect with personal trainers
6. **Gym Integration:** Check-in, equipment availability
7. **Advanced AI:** Personalized periodization, injury prevention

---

## Getting Started Checklist

### Initial Setup
- [ ] Create Supabase project
- [ ] Create Vercel project
- [ ] Set up GitHub repository
- [ ] Configure environment variables
- [ ] Run initial migration
- [ ] Seed exercise database

### Development Environment
- [ ] Install dependencies
- [ ] Set up local Supabase (optional, for local dev)
- [ ] Configure TypeScript
- [ ] Set up ESLint/Prettier
- [ ] Create development database

### First Features
- [ ] Authentication flow
- [ ] User profile page
- [ ] Exercise library view
- [ ] Basic workout plan creation

---

## Resources & References

- **Next.js Docs:** https://nextjs.org/docs
- **Supabase Docs:** https://supabase.com/docs
- **Vercel Docs:** https://vercel.com/docs
- **Web Speech API:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- **Media Session API:** https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API
- **OpenAI API:** https://platform.openai.com/docs
- **OpenAI TTS:** https://platform.openai.com/docs/guides/text-to-speech
- **shadcn/ui:** https://ui.shadcn.com

---

## Notes

- Start with MVP features, iterate based on usage
- Prioritize voice/audio features for core value proposition
- **Headphone buttons are primary interaction method** - no wake word needed
- AI integration should enhance, not replace, manual control
- Mobile-first design is critical
- Test extensively with various headphone models and button configurations
- Consider battery life impact of continuous audio/voice recognition
- **Cost-conscious approach:** Use free/low-cost tiers wherever possible
- OpenAI TTS is very affordable - don't hesitate to use it liberally
- GPT-3.5-turbo is sufficient for most use cases - reserve GPT-4 for complex planning
- Always provide fallbacks (browser TTS, manual controls) for reliability

---

*This plan is a living document and should be updated as the project evolves.*
