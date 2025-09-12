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
 - 'layout': one of ['title-bullets','two-column','quote','section-divider','checklist','numbers','image-left'] ensuring diversity across slides (do not repeat the same layout back-to-back)
 - 'visualStyleHint': short phrase describing a distinct visual idea for this slide (e.g., "accent stripe at top", "two columns", "quote focus")

Optional per slide (use only if it genuinely adds value):
- 'image': { dataUrl?: string (data:image/png;base64,...), url?: string, idea?: string }
- 'table': { headers: string[], rows: string[][] }  // 2-6 rows, 2-6 columns
- 'chart': { type: 'bar'|'line'|'pie', labels: string[], values: number[], title?: string } // max 6 items

Rules:
- Vary the 'layout' so slides look different from each other.
- Keep bullet points concise and non-redundant.
- Return ONLY JSON (no markdown fences, no extra commentary).

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

    // Helpers for varied slide designs
    const hexToRgb = (hex) => {
      const clean = hex.replace('#', '');
      const bigint = parseInt(clean, 16);
      return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255,
      };
    };
    const clamp = (v) => Math.max(0, Math.min(255, v));
    const lighten = (hex, pct) => {
      // pct: 0..1 (how much to lighten toward white)
      const { r, g, b } = hexToRgb(hex);
      const lr = clamp(Math.round(r + (255 - r) * pct));
      const lg = clamp(Math.round(g + (255 - g) * pct));
      const lb = clamp(Math.round(b + (255 - b) * pct));
      return [lr, lg, lb]
        .map((c) => c.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
    };

    const layouts = ['title-bullets', 'two-column', 'quote', 'section-divider', 'checklist', 'numbers', 'image-left'];
    const pickLayout = (idx, provided) => provided && layouts.includes(provided) ? provided : layouts[idx % layouts.length];

    const addAccentStripe = (slide, color) => {
      slide.addText('', { x: 0, y: 0, w: 10, h: 0.25, fill: { color }, line: { color, width: 0 } });
    };

    // Utilities for optional media
    const isDataUrl = (s) => typeof s === 'string' && s.startsWith('data:') && s.includes('base64,');
    const stripDataUrl = (s) => {
      if (!isDataUrl(s)) return null;
      return s.substring(s.indexOf('base64,') + 7);
    };

    const renderChart = (s, region, chart) => {
      if (!chart || !Array.isArray(chart.labels) || !Array.isArray(chart.values)) return false;
      const n = Math.min(chart.labels.length, chart.values.length);
      if (n === 0) return false;
      const typeMap = { bar: 'bar', line: 'line', pie: 'pie' };
      const t = (chart.type && typeMap[chart.type]) || 'bar';
      const chartTypeEnum = pptx.ChartType && pptx.ChartType[t] ? pptx.ChartType[t] : pptx.ChartType.bar;
      const data = [{ name: chart.title || 'Series', labels: chart.labels.slice(0, n), values: chart.values.slice(0, n) }];
      try {
        s.addChart(chartTypeEnum, data, { x: region.x, y: region.y, w: region.w, h: region.h });
        return true;
      } catch (e) {
        console.warn('Chart render failed, falling back to bullets:', e.message);
        return false;
      }
    };

    const renderTable = (s, region, table) => {
      if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows)) return false;
      const headers = table.headers.slice(0, 6);
      const rows = table.rows.slice(0, 6).map(r => r.slice(0, headers.length));
      const tbl = [headers, ...rows];
      try {
        s.addTable(tbl, {
          x: region.x, y: region.y, w: region.w, h: region.h,
          fontSize: 12,
          border: { type: 'solid', color: 'E5E7EB', pt: 1 },
          fill: 'FFFFFF'
        });
        return true;
      } catch (e) {
        console.warn('Table render failed, skipping:', e.message);
        return false;
      }
    };

    const renderImage = (s, region, image) => {
      if (!image) return false;
      // Prefer data URLs for reliability
      if (image.dataUrl && isDataUrl(image.dataUrl)) {
        const data = stripDataUrl(image.dataUrl);
        try {
          s.addImage({ data, x: region.x, y: region.y, w: region.w, h: region.h, sizing: { type: 'contain', w: region.w, h: region.h } });
          return true;
        } catch (e) {
          console.warn('Image render failed, drawing placeholder:', e.message);
        }
      }
      // Placeholder block with idea text
      s.addText('', { x: region.x, y: region.y, w: region.w, h: region.h, fill: { color: lighten(selectedTheme.background, 0.6) }, line: { color: selectedTheme.background, width: 1 } });
      const idea = (image.idea || 'Image placeholder');
      s.addText(idea, { x: region.x + 0.2, y: region.y + region.h - 0.5, w: region.w - 0.4, h: 0.4, fontSize: 12, color: selectedTheme.background, align: 'right' });
      return true;
    };

    const addContentSlide = (pptx, slideData, index) => {
      const layout = pickLayout(index, (slideData && slideData.layout) || undefined);
      const bgVariants = [
        'FFFFFF',
        lighten(selectedTheme.accent, 0.85),
        lighten(selectedTheme.accent, 0.92),
      ];
      const bg = bgVariants[index % bgVariants.length];
      const s = pptx.addSlide();
      s.background = { color: bg };
      addAccentStripe(s, selectedTheme.accent);

      // Common title color derived from theme background for contrast
      const titleColor = selectedTheme.background;
      const textColor = selectedTheme.text;

      const title = slideData?.slideTitle || 'Untitled Slide';
      const bullets = Array.isArray(slideData?.bulletPoints) ? slideData.bulletPoints.filter(Boolean) : [];

      switch (layout) {
        case 'two-column': {
          s.addText(title, { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 24, bold: true, color: titleColor });
          const mid = Math.ceil(bullets.length / 2) || 1;
          const left = bullets.slice(0, mid);
          const right = bullets.slice(mid);
          // Left column bullets
          s.addText(left.map((t) => `• ${t}`).join('\n') || '• Item', { x: 0.5, y: 1.5, w: 4.25, h: 4.5, fontSize: 16, color: textColor, lineSpacing: 24 });
          // Right column: prefer table or chart, otherwise bullets
          const rightRegion = { x: 5.25, y: 1.5, w: 4.25, h: 4.5 };
          if (!(renderTable(s, rightRegion, slideData.table) || renderChart(s, rightRegion, slideData.chart))) {
            s.addText(right.map((t) => `• ${t}`).join('\n') || '• Item', { x: 5.25, y: 1.5, w: 4.25, h: 4.5, fontSize: 16, color: textColor, lineSpacing: 24 });
          }
          break;
        }
        case 'quote': {
          const quote = bullets[0] || 'Insightful quote or key takeaway goes here.';
          s.addText(`“${quote}”`, { x: 0.75, y: 1.2, w: 8.5, h: 2, fontSize: 28, italic: true, color: titleColor, align: 'center' });
          s.addText(title, { x: 0.5, y: 0.4, w: 9, h: 0.7, fontSize: 20, bold: true, color: textColor });
          const rest = bullets.slice(1);
          if (rest.length) {
            s.addText(rest.map((t) => `• ${t}`).join('\n'), { x: 1, y: 3.4, w: 8, h: 3, fontSize: 14, color: textColor, lineSpacing: 22 });
          }
          // Optional extra (table/chart/image) at bottom
          const bottomRegion = { x: 0.75, y: 4.8, w: 8.5, h: 2.2 };
          renderTable(s, bottomRegion, slideData.table) || renderChart(s, bottomRegion, slideData.chart) || renderImage(s, bottomRegion, slideData.image);
          break;
        }
        case 'section-divider': {
          s.addText('', { x: 1, y: 2, w: 8, h: 3, fill: { color: selectedTheme.accent }, line: { color: selectedTheme.accent, width: 0 } });
          s.addText(title, { x: 1, y: 2.8, w: 8, h: 1, fontSize: 34, bold: true, color: 'FFFFFF', align: 'center' });
          break;
        }
        case 'checklist': {
          s.addText(title, { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 24, bold: true, color: titleColor });
          const items = (bullets.length ? bullets : ['First task', 'Second task']).map((t) => `✓ ${t}`);
          s.addText(items.join('\n'), { x: 0.5, y: 1.5, w: 9, h: 4.5, fontSize: 18, color: textColor, lineSpacing: 26 });
          const bottomRegion = { x: 0.5, y: 4.8, w: 9, h: 2.2 };
          renderChart(s, bottomRegion, slideData.chart) || renderTable(s, bottomRegion, slideData.table);
          break;
        }
        case 'numbers': {
          s.addText(title, { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 24, bold: true, color: titleColor });
          const items = (bullets.length ? bullets : ['Point one', 'Point two']).map((t, i) => `${i + 1}. ${t}`);
          s.addText(items.join('\n'), { x: 0.5, y: 1.5, w: 9, h: 4.5, fontSize: 18, color: textColor, lineSpacing: 26 });
          const bottomRegion = { x: 0.5, y: 4.8, w: 9, h: 2.2 };
          renderChart(s, bottomRegion, slideData.chart) || renderTable(s, bottomRegion, slideData.table);
          break;
        }
        case 'image-left': {
          // Image area left
          const imgRegion = { x: 0.5, y: 1.3, w: 3.5, h: 4.2 };
          if (!renderImage(s, imgRegion, slideData.image)) {
            // Fallback rectangle placeholder handled in renderImage
          }
          s.addText(title, { x: 4.25, y: 0.6, w: 5, h: 0.8, fontSize: 24, bold: true, color: titleColor });
          s.addText(bullets.map((t) => `• ${t}`).join('\n') || '• Key point', { x: 4.25, y: 1.6, w: 5, h: 4.2, fontSize: 16, color: textColor, lineSpacing: 24 });
          break;
        }
        case 'title-bullets':
        default: {
          s.addText(title, { x: 0.5, y: 0.5, w: 9, h: 1, fontSize: 24, bold: true, color: titleColor });
          const text = (bullets.length ? bullets : ['No content available']).map((t) => `• ${t}`).join('\n');
          s.addText(text, { x: 0.5, y: 1.8, w: 9, h: 5, fontSize: 16, color: textColor, lineSpacing: 24 });
          const rightRegion = { x: 6.5, y: 1.8, w: 3, h: 3 };
          renderImage(s, rightRegion, slideData.image);
          const bottomRegion = { x: 0.5, y: 4.8, w: 9, h: 2.2 };
          renderChart(s, bottomRegion, slideData.chart) || renderTable(s, bottomRegion, slideData.table);
          break;
        }
      }
    };

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
      outline.slides.forEach((slideData, idx) => {
        if (slideData && typeof slideData === 'object') {
          addContentSlide(pptx, slideData, idx);
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

