require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const PPTXGenJS = require('pptxgenjs');
const stream = require('stream');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
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
app.use('/generate-ppt', limiter);

app.use(express.json({ limit: '10mb' }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY environment variable not set.');
  console.error('Please create a .env file with your Gemini API key.');
  process.exit(1);
}

// Input validation function
function validateInput(topic, slideCount, presentationStyle, audienceLevel, colorTheme) {
  const errors = [];
  
  if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
    errors.push('Topic must be at least 3 characters long');
  }
  
  if (topic && topic.length > 200) {
    errors.push('Topic must be less than 200 characters');
  }
  
  const validSlideCount = [3, 5, 7, 10];
  if (slideCount && !validSlideCount.includes(slideCount)) {
    errors.push('Slide count must be 3, 5, 7, or 10');
  }
  
  const validStyles = ['professional', 'casual', 'academic', 'creative'];
  if (presentationStyle && !validStyles.includes(presentationStyle)) {
    errors.push('Invalid presentation style');
  }
  
  const validLevels = ['beginner', 'general', 'expert'];
  if (audienceLevel && !validLevels.includes(audienceLevel)) {
    errors.push('Invalid audience level');
  }
  
  const validThemes = ['blue', 'green', 'purple', 'red', 'orange', 'teal', 'gray'];
  if (colorTheme && !validThemes.includes(colorTheme)) {
    errors.push('Invalid color theme');
  }
  
  return errors;
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function getPresentationOutline(topic, options = {}) {
  const {
    slideCount = 5,
    presentationStyle = 'professional',
    audienceLevel = 'general',
    includeConclusion = true,
    colorTheme = 'blue'
  } = options;
  
  try {
    const prompt = `Create a PowerPoint outline about '${topic}' with EXACTLY ${slideCount} slides. 

IMPORTANT: You must create exactly ${slideCount} slides, no more, no less.

Style: ${presentationStyle} 
Audience level: ${audienceLevel}
${includeConclusion ? 'Include a conclusion slide as one of the slides.' : ''}

Return a JSON object with:
- 'title': string
- 'slides': array with exactly ${slideCount} slide objects

Each slide object must have:
- 'slideTitle': string  
- 'bulletPoints': array of strings (3-5 bullet points per slide)

Make the content engaging and appropriate for the specified style and audience. REMEMBER: Return exactly ${slideCount} slides in the slides array.`;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    console.log('Gemini raw response:', raw);
    
    // Try to extract JSON from the response, even if it's embedded in text
    let jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate and fix slide count
        if (parsed.slides && parsed.slides.length !== slideCount) {
          console.log(`Warning: AI returned ${parsed.slides.length} slides, requested ${slideCount}. Adjusting...`);
          
          if (parsed.slides.length > slideCount) {
            // Trim excess slides
            parsed.slides = parsed.slides.slice(0, slideCount);
          } else {
            // Add generic slides if too few
            while (parsed.slides.length < slideCount) {
              parsed.slides.push({
                slideTitle: `Additional Content ${parsed.slides.length + 1}`,
                bulletPoints: [
                  `Key point about ${topic}`,
                  `Important information to consider`,
                  `Relevant details for this topic`
                ]
              });
            }
          }
        }
        
        return parsed;
      } catch (err) {
        throw new Error('Failed to parse extracted JSON from Gemini response.');
      }
    }
    throw new Error('No JSON found in Gemini API response.');
  } catch (error) {
    console.error('Error in getPresentationOutline:', error);
    throw new Error(`Failed to generate presentation outline: ${error.message}`);
  }
}

app.post('/generate-ppt', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('Request received at:', new Date().toISOString());
    
    const { topic, slideCount, presentationStyle, audienceLevel, includeConclusion, colorTheme } = req.body;
    
    // Validate input
    const validationErrors = validateInput(topic, slideCount, presentationStyle, audienceLevel, colorTheme);
    if (validationErrors.length > 0) {
      console.log('Validation errors:', validationErrors);
      return res.status(400).json({ error: validationErrors.join(', ') });
    }

    const options = {
      slideCount: slideCount || 5,
      presentationStyle: presentationStyle || 'professional',
      audienceLevel: audienceLevel || 'general',
      includeConclusion: includeConclusion !== false,
      colorTheme: colorTheme || 'blue'
    };

    console.log('Processing request with options:', options);

    const outline = await getPresentationOutline(topic.trim(), options);

    // Define color themes
    const colorThemes = {
      blue: { background: '1E3A8A', title: 'FFFFFF', text: '1F2937', accent: '3B82F6' },
      green: { background: '166534', title: 'FFFFFF', text: '1F2937', accent: '22C55E' },
      purple: { background: '7C3AED', title: 'FFFFFF', text: '1F2937', accent: 'A855F7' },
      red: { background: 'DC2626', title: 'FFFFFF', text: '1F2937', accent: 'EF4444' },
      orange: { background: 'EA580C', title: 'FFFFFF', text: '1F2937', accent: 'F97316' },
      teal: { background: '0F766E', title: 'FFFFFF', text: '1F2937', accent: '14B8A6' },
      gray: { background: '4B5563', title: 'FFFFFF', text: '1F2937', accent: '6B7280' }
    };

    const selectedTheme = colorThemes[options.colorTheme] || colorThemes.blue;

    const pptx = new PPTXGenJS();

    // Title slide
    let slide = pptx.addSlide();
    slide.background = { color: selectedTheme.background };
    slide.addText(outline.title || topic, { 
      x: 1, y: 2, w: 8, h: 1.5, 
      fontSize: 32, bold: true, color: selectedTheme.title, align: 'center' 
    });
    slide.addText(`Presentation on ${topic}`, { 
      x: 1, y: 4, w: 8, h: 1, 
      fontSize: 20, color: selectedTheme.title, align: 'center' 
    });

    // Content slides
    if (outline.slides && Array.isArray(outline.slides)) {
      outline.slides.forEach(slideData => {
        if (slideData && typeof slideData === 'object') {
          let slide = pptx.addSlide();
          slide.background = { color: 'FFFFFF' }; // White background for content slides
          
          slide.addText(slideData.slideTitle || 'Untitled Slide', { 
            x: 0.5, y: 0.5, w: 9, h: 1, 
            fontSize: 24, bold: true, color: selectedTheme.background 
          });
          
          // Add bullet points with validation
          const bulletPoints = slideData.bulletPoints || [];
          if (Array.isArray(bulletPoints) && bulletPoints.length > 0) {
            slide.addText(
              bulletPoints.map(pt => `• ${pt || 'No content'}`).join('\n'),
              { 
                x: 0.5, y: 1.8, w: 9, h: 5, 
                fontSize: 16, color: selectedTheme.text, lineSpacing: 24 
              }
            );
          } else {
            slide.addText('• No content available for this slide', {
              x: 0.5, y: 1.8, w: 9, h: 5, 
              fontSize: 16, color: selectedTheme.text, lineSpacing: 24 
            });
          }
        }
      });
    } else {
      // Add a fallback slide if no slides data
      let slide = pptx.addSlide();
      slide.background = { color: 'FFFFFF' };
      slide.addText('Error: No content generated', { 
        x: 0.5, y: 0.5, w: 9, h: 1, 
        fontSize: 24, bold: true, color: 'FF0000' 
      });
    }

    // Generate PPTX as buffer
    const pptxBuffer = await pptx.write('nodebuffer');
    const readStream = new stream.PassThrough();
    readStream.end(pptxBuffer);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="${topic.replace(/ /g, '_')}.pptx"`
    });
    readStream.pipe(res);
    
    const endTime = Date.now();
    console.log(`Request completed successfully in ${endTime - startTime}ms`);
    
  } catch (err) {
    const endTime = Date.now();
    console.error('Request failed after:', endTime - startTime, 'ms');
    console.error('Full error details:', err);
    
    // Don't expose internal errors to client
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    
    if (err.message.includes('API key') || err.message.includes('quota')) {
      errorMessage = 'Service temporarily unavailable';
      statusCode = 503;
    } else if (err.message.includes('parse') || err.message.includes('JSON')) {
      errorMessage = 'Failed to process AI response';
      statusCode = 502;
    }
    
    res.status(statusCode).json({ error: errorMessage });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

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

// Install dependencies:
// npm install express cors dotenv @google/generative-ai pptxgenjs
