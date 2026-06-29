#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# EduAgent — Secure Deployment to Render + Supabase + Vercel
# ─────────────────────────────────────────────────────────────
# Free tier, no credit card needed for any service.
#
# Prerequisites:
#   - GitHub account (push the repo)
#   - Render account (deploy backend)
#   - Supabase account (managed PostgreSQL)
#   - Vercel account (deploy frontend)
#
# All 3 are free and support sign-in with GitHub/Google.
# ─────────────────────────────────────────────────────────────

set -euo pipefail

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              EduAgent Deployment Assistant                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# ── STEP 1: Push to GitHub ─────────────────────────────────────
# Create a repo at https://github.com/new, then:
#   git remote add origin https://github.com/YOUR_USER/eduagent.git
#   git push -u origin main

echo ""
echo "=== STEP 1: Push code to GitHub ==="
echo "1. Go to https://github.com/new"
echo "2. Create a repo named 'eduagent' (public or private — your choice)"
echo "3. Run these commands:"
echo ""
echo "   git remote add origin https://github.com/YOUR_USER/eduagent.git"
echo "   git push -u origin main"
echo ""

read -p "Done pushing to GitHub? (y/N): " github_done

# ── STEP 2: Supabase Database ──────────────────────────────────
echo ""
echo "=== STEP 2: Create Supabase PostgreSQL Database ==="
echo "1. Go to https://supabase.com — sign in with GitHub (free, no CC)"
echo "2. Click 'New Project'"
echo "3. Fill in:"
echo "   - Name: eduagent"
echo "   - Database Password: GENERATE A STRONG ONE and save it"
echo "   - Region: closest to you (e.g., Frankfurt)"
echo "4. Wait ~2 minutes for the project to spin up"
echo ""
echo "5. After creation, go to Project Settings → Database → Connection string"
echo "   Copy the 'URI' connection string (it looks like:"
echo "   postgresql://postgres:YOUR_PASSWORD@db.xxx.supabase.co:5432/postgres)"
echo ""

read -p "Have the Supabase connection string ready? (y/N): " supabase_done

# ── STEP 3: Render Backend Deployment ──────────────────────────
echo ""
echo "=== STEP 3: Deploy Backend to Render ==="
echo "1. Go to https://dashboard.render.com — sign in with GitHub"
echo "2. Click 'New +' → 'Blueprint' → Connect your eduagent repo"
echo "3. Render will read render.yaml automatically"
echo ""
echo "4. When prompted, set these environment variables:"
echo ""
echo "   DATABASE_URL = postgresql://postgres:YOUR_PASS@db.xxx.supabase.co:5432/postgres"
echo "   JWT_SECRET = $(openssl rand -hex 32)"
echo "   GROQ_API_KEY = gsk_your_groq_key"
echo "   DEEPGRAM_API_KEY = your_deepgram_key"
echo "   ELEVENLABS_API_KEY = your_elevenlabs_key"
echo "   CORS_ORIGINS = https://your-frontend.vercel.app"
echo "   SENTRY_DSN = (leave blank unless you have Sentry)"
echo ""
echo "   ⚠ DON'T set SQLITE_PATH — Supabase is the database"
echo ""
echo "5. Click 'Apply' — Render builds and deploys (~3-5 min)"
echo ""

read -p "Backend deployed? Get the URL and paste it here: " BACKEND_URL

# ── STEP 4: Vercel Frontend Deployment ─────────────────────────
echo ""
echo "=== STEP 4: Deploy Frontend to Vercel ==="
echo "1. Go to https://vercel.com — sign in with GitHub"
echo "2. Click 'Add New...' → 'Project' → Import eduagent repo"
echo "3. Set Root Directory: frontend"
echo "4. Add Environment Variable:"
echo ""
echo "   NEXT_PUBLIC_API_URL = $BACKEND_URL"
echo ""
echo "5. Click 'Deploy' (~1 minute)"
echo ""

read -p "Frontend deployed? Get the URL and paste it here: " FRONTEND_URL

# ── STEP 5: Lock Down CORS ─────────────────────────────────────
echo ""
echo "=== STEP 5: Lock Down CORS ==="
echo "Go to Render Dashboard → eduagent-backend → Environment"
echo "Update CORS_ORIGINS to:"
echo "   $FRONTEND_URL"
echo "Then click 'Manual Deploy' → 'Deploy latest commit'"
echo ""

# ── DONE ───────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅ DEPLOYMENT COMPLETE                       ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                          ║"
echo "║  Frontend:  $FRONTEND_URL              ║"
echo "║  Backend:   $BACKEND_URL               ║"
echo "║  Database:  Supabase PostgreSQL (persistent)             ║"
echo "║                                                          ║"
echo "║  SECURITY:                                               ║"
echo "║  • All secrets in Render env vars (not in code)          ║"
echo "║  • JWT secret = 64 char random hex                       ║"
echo "║  • Database password = strong (set by you)               ║"
echo "║  • CORS locked to your frontend                          ║"
echo "║  • HTTPS via Render + Vercel                             ║"
echo "║  • .env in .gitignore (never committed)                  ║"
echo "║                                                          ║"
echo "║  Default admin: admin@devnestacademy.com / admin123      ║"
echo "║  ⚠ CHANGE PASSWORD after first login!                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
