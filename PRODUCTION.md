# AutoPPT Generator - Production Deployment

## 🚀 Production Features

- ✅ Input validation and sanitization
- ✅ Rate limiting (10 requests per 15 minutes)
- ✅ Security headers (Helmet)
- ✅ CORS protection
- ✅ Error handling and logging
- ✅ Health check endpoint
- ✅ PM2 support for process management
- ✅ Graceful shutdown

## 📋 Prerequisites

- Node.js 18+
- Valid Gemini API key
- PM2 for production process management (optional)

## 🛠️ Local Production Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.production .env
   # Edit .env with your production values
   ```

3. **Build and start:**
   ```bash
   npm run build
   npm run start:production
   ```

## � Production Deployment Options

### Option 1: Simple VPS/Server Deployment

1. **Clone repository:**
   ```bash
   git clone https://github.com/your-username/AutoPPT-generator
   cd AutoPPT-generator
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set environment variables:**
   ```bash
   nano .env.production
   # Add your production values
   ```

4. **Build and start:**
   ```bash
   npm run build
   npm run start:production
   ```

### Option 2: PM2 Process Manager (Recommended)

1. **Install PM2 globally:**
   ```bash
   npm install -g pm2
   ```

2. **Create PM2 ecosystem file:**
   ```bash
   # ecosystem.config.js is already created
   ```

3. **Start with PM2:**
   ```bash
   pm2 start ecosystem.config.js --env production
   ```

4. **Monitor processes:**
   ```bash
   pm2 status
   pm2 logs
   pm2 monit
   ```

### Option 3: Vercel (Frontend) + Railway/Render (Backend)

**Deploy Frontend to Vercel:**
```bash
npm install -g vercel
vercel --prod
```

**Deploy Backend to Railway:**
1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically

### Option 4: Netlify (Frontend) + Heroku (Backend)

**Frontend to Netlify:**
1. Connect GitHub repository
2. Build command: `npm run build`
3. Publish directory: `.next`

**Backend to Heroku:**
```bash
heroku create your-app-name
heroku config:set GEMINI_API_KEY=your_key
git push heroku main
```

## 🌐 Environment Variables

### Required
- `GEMINI_API_KEY` - Your Google Gemini API key
- `NEXT_PUBLIC_BACKEND_URL` - Backend URL for frontend
- `FRONTEND_URL` - Frontend URL for CORS

### Optional
- `NODE_ENV` - Environment (production/development)
- `PORT` - Backend port (default: 5000)

## 📊 Monitoring

- Health check: `GET /health`
- Logs with timestamps and performance metrics
- PM2 monitoring dashboard

## 🔒 Security Features

- Rate limiting per IP (10 requests/15 minutes)
- Input validation and sanitization
- CORS configuration
- Security headers via Helmet
- Error message sanitization

## �️ Process Management with PM2

**Start processes:**
```bash
pm2 start ecosystem.config.js --env production
```

**Monitor:**
```bash
pm2 status          # Process status
pm2 logs            # View logs
pm2 restart all     # Restart all processes
pm2 stop all        # Stop all processes
```

**Auto-restart on server reboot:**
```bash
pm2 startup
pm2 save
```

## 📈 Performance Tips

- Use PM2 for production process management
- Enable PM2 clustering for better performance
- Monitor memory usage and restart if needed
- Use reverse proxy (nginx) for better performance

## 🛠️ Maintenance

- Monitor logs for errors: `pm2 logs`
- Check health endpoint: `curl http://localhost:5000/health`
- Update dependencies monthly
- Rotate API keys as needed
- Monitor rate limit usage
