# AutoPPT Generator

Generate professional presentations instantly with AI.

[Live Demo](https://auto-ppt-generator-five.vercel.app)

---

## 🚀 Overview

**AutoPPT Generator** is an open-source tool that uses Google Gemini AI to generate presentation outlines and content automatically. Designed for speed and ease of use, it allows users to simply specify a topic and receive a structured presentation (PowerPoint-style), complete with slides and key points.

---

## ✨ Features

- **Lightning Fast**: Instant AI-powered slide generation
- **AI Powered**: Uses Google Gemini for intelligent content creation
- **Customizable**: Choose topic, number of slides, and options (like including a conclusion slide)
- **Input Validation** and **Sanitization**
- **Security**: CORS protection, Helmet security headers, rate limiting (10 requests per 15 minutes), error handling
- **Health Check Endpoint**
- **PM2 Support** for process management (production)
- **Monitoring & Logging**

---

## 🛠️ Tech Stack

- **Frontend**: Next.js (React, TypeScript)
- **Backend**: Node.js, Express
- **AI**: Google Gemini API

---

## 🏁 Quick Start

### Prerequisites

- Node.js 18+
- Gemini API Key (from Google)
- (Optional) PM2 for process management

### Local Setup

```bash
# Clone repo
git clone https://github.com/Basedonsearch-Dindayal/AutoPPT-generator.git
cd AutoPPT-generator

# Install dependencies
npm install

# Set up environment variables
cp .env.production .env
# Edit .env with your Gemini API key and URLs

# Build and run production server
npm run build
npm run start:production
```

### Deployment

#### Best Free Option: Vercel + Render

- **Frontend**: Deploy to [Vercel](https://vercel.com)
- **Backend**: Deploy to [Render](https://render.com) or [Railway](https://railway.app)

See [`DEPLOY.md`](DEPLOY.md) for step-by-step instructions and CLI commands.

---

## 🔑 Environment Variables

| Variable                | Purpose                              |
|-------------------------|--------------------------------------|
| `GEMINI_API_KEY`        | Your Gemini API key                  |
| `NEXT_PUBLIC_BACKEND_URL` | Backend URL for frontend           |
| `FRONTEND_URL`          | Frontend URL (for CORS)              |
| `NODE_ENV`              | Environment (production/development) |
| `PORT`                  | Backend port (default: 5000)         |

---

## 📊 Monitoring & Security

- Rate limiting per IP
- Input validation and sanitization
- CORS and security headers (Helmet)
- Health check endpoint: `GET /health`
- Logs with timestamps and performance metrics

---

## 🤝 Contributing

Contributions are welcome! Please fork the repo and submit a pull request.

---

## 📄 License

No license specified yet.

---

## 💡 Pro Tips

- Use Vercel + Railway for easy, free deployment
- Monitor usage to stay within free tier limits
- Keep your API keys secure and update CORS settings

---

## 📚 Documentation

- [DEPLOY.md](DEPLOY.md) - Free deployment guide
- [PRODUCTION.md](PRODUCTION.md) - Production setup & features

---

**Made by [Basedonsearch-Dindayal](https://github.com/Basedonsearch-Dindayal)**
