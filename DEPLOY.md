# 🚀 Free Deployment Guide - AutoPPT Generator

## Best Free Option: Vercel + Railway

**Total Cost: $0/month**
- ✅ Vercel (Frontend): Free forever for personal projects
- ✅ Railway (Backend): $5 credit monthly (enough for small apps)

---

## 🎯 Step-by-Step Deployment

### Part 1: Deploy Backend to Railway

1. **Sign up at Railway**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create new project**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your AutoPPT-generator repository

3. **Set environment variables**
   ```
   GEMINI_API_KEY=your_actual_api_key
   NODE_ENV=production
   PORT=5000
   FRONTEND_URL=https://your-app.vercel.app
   ```

4. **Deploy**
   - Railway will auto-deploy
   - Note your backend URL: `https://your-app.railway.app`

### Part 2: Deploy Frontend to Vercel

1. **Sign up at Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub

2. **Import project**
   - Click "New Project" → Import your repository
   - Vercel detects Next.js automatically

3. **Set environment variables**
   ```
   NEXT_PUBLIC_BACKEND_URL=https://your-app.railway.app
   ```

4. **Deploy**
   - Click "Deploy"
   - Your app will be live at: `https://your-app.vercel.app`

---

## 🔄 Alternative Free Options

### Option 2: Netlify + Render

**Frontend: Netlify**
1. Go to [netlify.com](https://netlify.com)
2. Drag & drop your `.next` folder after `npm run build`
3. Set environment variables

**Backend: Render**
1. Go to [render.com](https://render.com)
2. Connect GitHub repository
3. Set build command: `npm install`
4. Set start command: `node server.js`

### Option 3: Vercel Functions (All-in-One)

Convert backend to Vercel serverless functions:
1. Move server logic to `/api` folder
2. Deploy everything to Vercel
3. Simpler but may have cold starts

---

## 🛠️ Quick Setup Commands

**For Vercel CLI deployment:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
vercel --prod

# Set environment variables
vercel env add NEXT_PUBLIC_BACKEND_URL
```

**For Railway CLI deployment:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway deploy
```

---

## 💡 Pro Tips

1. **Free Tier Limits:**
   - Vercel: Unlimited hobby projects
   - Railway: $5 credit/month (usually enough)
   - Render: 750 hours/month free

2. **Performance:**
   - Use Railway for backend (faster than Heroku free)
   - Vercel has excellent CDN for frontend

3. **Monitoring:**
   - Both platforms provide logs
   - Set up uptime monitoring with [UptimeRobot](https://uptimerobot.com)

4. **Custom Domain:**
   - Both support custom domains for free
   - Add your domain in dashboard settings

---

## 🚨 Important Notes

- **Railway Credit**: Monitor usage to stay within $5/month
- **Environment Variables**: Keep your API keys secure
- **CORS**: Update FRONTEND_URL when you get your Vercel URL
- **Health Check**: Both platforms support health checks

---

## 📊 Recommended: Railway + Vercel

**Why this combo?**
- ✅ Railway: Best free backend hosting
- ✅ Vercel: Perfect for Next.js, excellent performance
- ✅ Easy deployment and monitoring
- ✅ Good free tier limits
- ✅ Professional URLs

**Total setup time: ~15 minutes**
