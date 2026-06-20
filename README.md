# FinPulse India 🇮🇳

AI-curated Indian finance news — Sensex, Nifty, RBI, Indian economy, startups & policy.

Built with Next.js + Claude AI (Anthropic API) + Web Search.

---

## Deploy to Vercel (5 minutes)

### Step 1 — Get your Anthropic API key

1. Go to https://console.anthropic.com/
2. Sign up / log in
3. Go to **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-...`)
5. Add some credits ($5 is enough to start)

### Step 2 — Push to GitHub

```bash
cd finpulse-india
git init
git add .
git commit -m "Initial commit"
```

Create a new repo on https://github.com/new (name it `finpulse-india`), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/finpulse-india.git
git branch -M main
git push -u origin main
```

### Step 3 — Deploy on Vercel

1. Go to https://vercel.com and sign in with GitHub
2. Click **"Add New Project"**
3. Import your `finpulse-india` repository
4. Before clicking Deploy, expand **"Environment Variables"**
5. Add:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-...` (your key from Step 1)
6. Click **Deploy**

Your site will be live at `https://finpulse-india.vercel.app` in ~60 seconds.

### Step 4 (Optional) — Add a custom domain

1. In Vercel dashboard → your project → **Settings → Domains**
2. Add your domain (e.g. `finpulse.in`)
3. Update your DNS records as shown by Vercel

---

## How it works

- Hit **Refresh** on the site to fetch latest Indian finance news
- The AI agent searches the web, finds relevant stories, and summarizes them
- Articles are categorized into Markets, Economy, Banking, Startups, Policy
- Toggle **Auto: ON** for hourly automatic refresh
- Your API key stays secure on the server (never exposed to browsers)

---

## Local development

```bash
npm install
cp .env.example .env.local    # then paste your API key
npm run dev                     # open http://localhost:3000
```

---

## Cost estimate

~₹1,500–3,000/month with hourly refresh on Sonnet 4.6. Switch to Haiku 4.5 in the API route for ~₹1,000/month.
