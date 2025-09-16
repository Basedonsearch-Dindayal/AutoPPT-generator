require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Import routes and middleware
const pptRoutes = require('./routes/ppt');
const { errorHandler, requestTimer } = require('./middleware/errorHandler');

const app = express();

// Security middleware
app.use(helmet());

// Request timing middleware
app.use(requestTimer);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://localhost:3000',
      'https://localhost:3001',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    // Allow all Vercel domains temporarily
    if (origin && (origin.includes('.vercel.app') || origin.includes('.vercel.com'))) {
      return callback(null, true);
    }
    
    // Check specific allowed origins
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      console.log('Allowed origins:', allowedOrigins);
      console.log('Environment FRONTEND_URL:', process.env.FRONTEND_URL);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});

app.use(express.json({ limit: '10mb' }));

// Environment variable checks
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY environment variable not set.');
  console.error('Please create a .env file with your Gemini API key.');
  process.exit(1);
}

// Optional: Check for Unsplash API key (warn if missing but don't exit)
if (!process.env.UNSPLASH_ACCESS_KEY) {
  console.warn('⚠️  UNSPLASH_ACCESS_KEY environment variable not set.');
  console.warn('Image generation will be disabled. Add UNSPLASH_ACCESS_KEY to enable image features.');
}

// Routes
app.use('/generate-ppt', limiter, pptRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
});