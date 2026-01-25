# Setup Instructions

This guide will walk you through setting up all the tools and services needed to build the workout tracking application.

## Prerequisites

- Node.js 18+ installed ([Download](https://nodejs.org/))
- Git installed ([Download](https://git-scm.com/))
- A GitHub account
- A code editor (VS Code recommended)

---

## Step 1: GitHub Repository Setup

### 1.1 Create a New Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click the "+" icon in the top right → "New repository"
3. Name it `workout-app` (or your preferred name)
4. Set it to **Private** (recommended) or Public
5. **Do NOT** initialize with README, .gitignore, or license (we'll add these)
6. Click "Create repository"

### 1.2 Connect Local Repository to GitHub

```bash
cd /Volumes/Dev/Projects/workout-app
git remote add origin https://github.com/YOUR_USERNAME/workout-app.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 2: Supabase Setup

### 2.1 Create Supabase Project

1. Go to [Supabase](https://supabase.com) and sign in (or create account)
2. Click "New Project"
3. Fill in:
   - **Name:** `workout-app` (or your preferred name)
   - **Database Password:** Create a strong password (save it securely!)
   - **Region:** Choose closest to you
   - **Pricing Plan:** Select **Free** tier
4. Click "Create new project"
5. Wait 2-3 minutes for project to initialize

### 2.2 Get Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. You'll see:
   - **Project URL** (copy this)
   - **anon/public key** (copy this)
   - **service_role key** (click "Reveal" and copy - keep this secret!)

### 2.3 Enable Required Extensions

1. In Supabase dashboard, go to **Database** → **Extensions**
2. Enable these extensions:
   - `pgvector` (for vector search - optional for MVP)
   - `uuid-ossp` (should be enabled by default)

### 2.4 Set Up Local Environment Variables

Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_DB_PASSWORD=your_database_password_here
```

**Note:** The migration script will automatically construct the database URL from `SUPABASE_DB_PASSWORD` and `NEXT_PUBLIC_SUPABASE_URL`. Alternatively, you can set `SUPABASE_DB_URL` directly:

```env
SUPABASE_DB_URL=postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
```

**⚠️ Important:** 
- Never commit `.env.local` to Git (it's in .gitignore)
- The `service_role` key bypasses RLS - keep it secret!

---

## Step 3: OpenAI Setup

### 3.1 Create OpenAI Account

1. Go to [OpenAI Platform](https://platform.openai.com)
2. Sign up or sign in
3. Add a payment method (required even for free tier usage)
4. You'll get $5 free credit to start

### 3.2 Create API Key

1. Go to [API Keys](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. Name it: `workout-app`
4. Copy the key immediately (you won't see it again!)
5. Save it securely

### 3.3 Add to Environment Variables

Add to your `.env.local`:

```env
OPENAI_API_KEY=sk-your-api-key-here
```

**Cost Notes:**
- GPT-3.5-turbo: ~$0.50 per 1M input tokens, $1.50 per 1M output tokens
- TTS API: $15 per 1M characters
- Free tier: $5 credit to start
- Monitor usage at: https://platform.openai.com/usage

---

## Step 4: Vercel Setup

### 4.1 Create Vercel Account

1. Go to [Vercel](https://vercel.com)
2. Sign up with GitHub (recommended for easy integration)
3. Complete onboarding

### 4.2 Create New Project

1. In Vercel dashboard, click "Add New..." → "Project"
2. Import your GitHub repository (`workout-app`)
3. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** `./` (default)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm install` (default)
4. **Do NOT** deploy yet - we'll add environment variables first

### 4.3 Add Environment Variables in Vercel

1. In your Vercel project settings, go to **Settings** → **Environment Variables**
2. Add these variables for **Production**, **Preview**, and **Development**:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
OPENAI_API_KEY=sk-your-api-key-here
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
```

3. Click "Save" for each variable

### 4.4 Get Vercel Credentials (for GitHub Actions)

You'll need these for the CI/CD pipeline:

1. **Vercel Token:**
   - Go to [Vercel Settings](https://vercel.com/account/tokens)
   - Click "Create Token"
   - Name: `workout-app-deploy`
   - Scope: Full Account
   - Copy the token

2. **Vercel Org ID:**
   - Go to your [Vercel Team Settings](https://vercel.com/account)
   - The Org ID is in the URL or under Team Settings
   - Copy it

3. **Vercel Project ID:**
   - Go to your project settings in Vercel
   - The Project ID is visible in the project settings page
   - Copy it

---

## Step 5: GitHub Secrets Setup (for CI/CD)

### 5.1 Add Repository Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click "New repository secret"
4. Add each secret:

| Secret Name | Value | Where to Get It |
|------------|-------|----------------|
| `SUPABASE_URL` | Your Supabase project URL | Supabase Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key | Supabase Settings → API |
| `SUPABASE_ANON_KEY` | Your anon key | Supabase Settings → API |
| `SUPABASE_DB_URL` | Database connection string | Format: `postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres` |
| `OPENAI_API_KEY` | Your OpenAI API key | OpenAI Platform → API Keys |
| `VERCEL_TOKEN` | Your Vercel token | Vercel Account → Tokens |
| `VERCEL_ORG_ID` | Your Vercel org ID | Vercel Team Settings |
| `VERCEL_PROJECT_ID` | Your Vercel project ID | Vercel Project Settings |

**To get SUPABASE_DB_URL:**
- Format: `postgresql://postgres:YOUR_DB_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres`
- Replace `YOUR_DB_PASSWORD` with your database password (set when creating project)
- Replace `YOUR_PROJECT_REF` with your project reference (found in Supabase URL)

5. Click "Add secret" for each one

---

## Step 6: Local Development Setup

### 6.1 Install Dependencies

```bash
cd /Volumes/Dev/Projects/workout-app
npm install
# or
pnpm install
```

### 6.2 Verify Environment Variables

Make sure your `.env.local` file exists and has all required variables:

```bash
cat .env.local
```

You should see:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `NODE_ENV`
- `NEXT_PUBLIC_APP_URL`

### 6.3 Run Database Migrations

Before starting the app, you need to run database migrations:

1. **Install PostgreSQL client** (if not already installed):
   ```bash
   # macOS
   brew install postgresql@17
   # Or install the version matching your Supabase project
   ```

2. **Run migrations**:
   ```bash
   npm run migrate
   ```

   This will:
   - Detect your PostgreSQL server version
   - Apply any pending migrations
   - Track applied migrations in the database

3. **Seed exercises database** (optional):
   ```bash
   tsx scripts/seed-exercises.ts
   ```

### 6.4 Test Local Connection

Verify your setup:

```bash
# Check environment variables are loaded
npm run migrate:check

# Start development server
npm run dev
```

---

## Step 7: Verify Everything is Set Up

### Checklist

- [ ] GitHub repository created and connected
- [ ] Supabase project created
- [ ] Supabase credentials added to `.env.local`
- [ ] OpenAI account created with API key
- [ ] OpenAI API key added to `.env.local`
- [ ] Vercel project created (not deployed yet)
- [ ] Vercel environment variables configured
- [ ] Vercel credentials (token, org ID, project ID) obtained
- [ ] GitHub secrets added (all 7 secrets)
- [ ] Local `.env.local` file complete
- [ ] Dependencies installed locally

---

## Step 8: Next Steps

Once everything is set up:

1. **Confirm Setup:** Let me know when you've completed all steps
2. **Initial Build:** We'll create the Next.js project structure
3. **Database Migrations:** We'll set up the migration system
4. **First Features:** We'll start building the core functionality

---

## Troubleshooting

### Supabase Connection Issues
- Verify your project URL is correct (should end with `.supabase.co`)
- Check that your API keys are copied correctly (no extra spaces)
- Ensure your Supabase project is fully initialized (can take a few minutes)

### OpenAI API Issues
- Verify your API key starts with `sk-`
- Check your OpenAI account has credits/usage limits
- Ensure payment method is added (required even for free tier)

### Vercel Deployment Issues
- Verify all environment variables are set in Vercel
- Check that your GitHub repository is connected
- Ensure Vercel has access to your GitHub repository

### GitHub Actions Issues
- Verify all secrets are added correctly
- Check secret names match exactly (case-sensitive)
- Ensure repository has Actions enabled (Settings → Actions → General)

---

## Security Best Practices

1. **Never commit `.env.local`** - It's in `.gitignore`
2. **Never share API keys** - Especially service_role keys
3. **Use environment variables** - Never hardcode secrets
4. **Rotate keys regularly** - Especially if exposed
5. **Monitor usage** - Check OpenAI and Supabase dashboards regularly
6. **Use RLS policies** - Always enable Row Level Security in Supabase

---

## Cost Estimates

### Free Tier Limits

**Supabase (Free Tier):**
- 500 MB database
- 2 GB bandwidth
- 50,000 monthly active users
- Unlimited API requests

**Vercel (Free Tier):**
- Unlimited personal projects
- 100 GB bandwidth
- Automatic SSL
- Preview deployments

**OpenAI:**
- $5 free credit to start
- Pay-as-you-go after
- Estimated: $1-6 per active user/month for this app

### Monitoring

- **Supabase:** Dashboard → Settings → Usage
- **Vercel:** Dashboard → Usage
- **OpenAI:** Platform → Usage

---

## Support Resources

- **Supabase Docs:** https://supabase.com/docs
- **Vercel Docs:** https://vercel.com/docs
- **OpenAI Docs:** https://platform.openai.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **GitHub Actions Docs:** https://docs.github.com/en/actions

---

*Once you've completed all steps, confirm and we'll proceed with the build!*
