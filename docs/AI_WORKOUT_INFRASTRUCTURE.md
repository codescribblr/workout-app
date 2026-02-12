# AI Workout Infrastructure

This doc describes how the app is structured so AI can adjust workout targets (before or during a workout) and plan defaults for future workouts. The UI and data layer are ready; AI integration (calling APIs, generating recommendations) is not built yet.

## Concepts

- **Plan** (`workout_plan_exercises`): Default reps range and weight **per exercise** (same for every set). Used when no per-set override exists.
- **Session** (`workout_sessions`): One instance of doing a plan. Can store **per-set targets** for this workout only (`set_targets`).
- **Recorded sets** (`workout_sets`): What the user actually did (reps, weight_lbs) per set. Used for history and for AI to suggest the next set.

## Per-set targets for this workout

### Storage

- **Table**: `workout_sessions`
- **Column**: `set_targets` (JSONB, nullable)

**Shape** (keys are strings in JSON):

```ts
{
  [exerciseId: string]: {
    [setNumber: string]: {
      reps?: number;           // exact reps for this set
      reps_min?: number;
      reps_max?: number;
      weight_lbs?: number | null;
    };
  };
}
```

- If a set has `reps`, it’s an exact target; otherwise use `reps_min`/`reps_max` (or plan default if missing).
- `weight_lbs` overrides plan weight for that set when present.

### Behavior in the app

- When loading a workout, the client reads `workout_sessions.set_targets` and merges it into each exercise’s `set_targets` (see `Exercise.set_targets` and `getSetTarget()` in the workout page).
- For “Set N”, the UI and announcements use **per-set target** when present, else **plan default** (reps_min, reps_max, weight_lbs).
- Recorded data still goes only to `workout_sets` (reps, weight_lbs); `set_targets` is recommendation/target only.

### How AI can use it

1. **Before the workout**  
   When the user starts a session (or from a “preview / adjust” step), AI can:
   - Read last session’s `workout_sets` for this plan (and optionally plan + user profile).
   - Compute suggested targets per exercise/set (e.g. “10 @ 20 lbs” for set 1, “10 @ 22 lbs” for set 2).
   - **PATCH** `workout_sessions` for that session:  
     `{ set_targets: { [exerciseId]: { [setNumber]: { reps, weight_lbs } } } }`  
   - Merge with existing `set_targets` if you only want to override some sets.

2. **Mid-workout (next set)**  
   After the user logs a set (e.g. 10 reps @ 10 lbs instead of 10 @ 20):
   - AI can read the latest `workout_sets` for the current session and exercise.
   - Suggest the next set (e.g. 10 @ 15 lbs) and **PATCH** `workout_sessions.set_targets` for that exercise and `set_number`.
   - The UI will show the new target when the user reaches the next set.

3. **API surface (to be added)**  
   - **Update session set targets**: e.g. `PATCH /api/workouts/[sessionId]` with `{ set_targets: { ... } }` (or a dedicated route that merges into `set_targets`).  
   - Optionally: **Get recommendation** – e.g. `POST /api/ai/next-set-recommendation` with `{ sessionId, exerciseId, setNumber, completedSetsSoFar }` returning `{ reps, weight_lbs }`, then client or another endpoint writes that into `set_targets`.

## Adjusting the plan for future workouts

- **Table**: `workout_plan_exercises`
- **Relevant columns**: `reps_min`, `reps_max`, `weight_lbs` (single value per exercise; no weight range in schema today).

If the user says “last workout was too easy” or “make it harder next time”:

1. AI can suggest new defaults (e.g. higher reps or weight).
2. Update the plan: **PATCH** `workout_plan_exercises` for the chosen exercise(s) (`reps_min`, `reps_max`, `weight_lbs`). The existing plan edit flow already updates these; an AI-specific endpoint could do the same (e.g. `PATCH /api/plans/[planId]/exercises/[exerciseId]` or bulk update).
3. “This workout only” vs “all future”:  
   - **This workout only**: use `set_targets` on the **current** session (see above).  
   - **All future**: update `workout_plan_exercises`. New sessions will use the new defaults unless overridden again by `set_targets`.

## Data AI can read

- **Current session**: `workout_sessions` (incl. `set_targets`), `workout_sets` for that session (completed sets so far).
- **Last time on this plan**: `workout_sessions` where `workout_plan_id = X` and `completed_at IS NOT NULL`, ordered by `completed_at DESC`, then `workout_sets` for that session.
- **Plan**: `workout_plans`, `workout_plan_exercises` (reps_min, reps_max, weight_lbs, sets, etc.).
- **User**: profile, preferences, post-workout feedback (e.g. `WORKOUT_FEEDBACK.md`) for context.

## Summary

| Goal | Where | Action |
|------|--------|--------|
| Exact target for this set (this workout) | `workout_sessions.set_targets` | PATCH session with `set_targets[exerciseId][setNumber] = { reps, weight_lbs }` |
| Adjust next set mid-workout | Same | PATCH `set_targets` for next `set_number` after user logs current set |
| Change defaults for future workouts | `workout_plan_exercises` | PATCH `reps_min`, `reps_max`, `weight_lbs` for the exercise |
| Know what user did last set | `workout_sets` | Query by `workout_session_id` + `exercise_id`, order by `set_number` or `completed_at` |

The app already uses `getSetTarget(exercise, currentSet)` everywhere that displays or announces the current set’s target, so once `set_targets` is populated (by an AI flow or a future “edit targets” UI), the rest of the experience will follow automatically.
