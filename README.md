# Workout Tracker

A voice-first workout tracking web application with AI assistance, designed for hands-free operation using headphone controls.

## Features

- 🎧 **Headphone Button Controls** - Control workouts without looking at your phone
- 🗣️ **AI Voice Guidance** - Text-to-speech announcements for exercises and rest periods
- 🤖 **AI Workout Planning** - Generate personalized workout plans using AI
- 📊 **Progress Tracking** - Track sets, reps, weight, and workout history
- 🎯 **Goal Management** - Set and track fitness goals
- 📱 **Mobile-First Design** - Optimized for phone use during workouts

## Tech Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth)
- **AI:** OpenAI GPT-3.5-turbo, OpenAI TTS API
- **Deployment:** Vercel
- **CI/CD:** GitHub Actions

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account
- OpenAI API key
- Vercel account (for deployment)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your credentials in `.env.local`

4. Run database migrations:
   - Go to Supabase SQL Editor
   - Run the SQL files in `migrations/` directory in order

5. Seed exercises database:
   ```bash
   npm run migrate
   tsx scripts/seed-exercises.ts
   ```

6. Run development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

## Database Setup

1. Create a Supabase project
2. Run migrations in order:
   - `migrations/001_initial_schema.sql`
3. Seed exercises:
   ```bash
   tsx scripts/seed-exercises.ts
   ```

## Deployment

The app is configured for automatic deployment via GitHub Actions:

1. Push to `main` branch
2. GitHub Actions runs tests and migrations
3. Deploys to Vercel

Make sure to set up environment variables in:
- Vercel dashboard (for production)
- GitHub Secrets (for CI/CD)

## Project Structure

```
workout-app/
├── app/                    # Next.js App Router pages
├── components/             # React components
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities and helpers
├── migrations/            # Database migrations
├── scripts/               # Utility scripts
└── .github/workflows/     # CI/CD configuration
```

## Environment Variables

See `.env.example` for required variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_APP_URL`

## License

MIT
