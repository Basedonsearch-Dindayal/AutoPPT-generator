const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const PPTXGenJS = require('pptxgenjs');
const stream = require('stream');
const axios = require('axios');

const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

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

// Function to search and fetch images from Unsplash
async function fetchImageFromUnsplash(query) {
  if (!UNSPLASH_ACCESS_KEY) {
    console.warn('UNSPLASH_ACCESS_KEY not configured, skipping image fetch');
    return null;
  }

  try {
    // Clean and simplify the query - Unsplash works better with simple terms
    const cleanQuery = query
      .split(',')[0] // Take only the first part before comma
      .replace(/[^\w\s]/g, '') // Remove special characters
      .trim()
      .substring(0, 50); // Limit length

    console.log(`Searching Unsplash for: "${cleanQuery}"`);

    const searchResponse = await axios.get('https://api.unsplash.com/search/photos', {
      params: {
        query: cleanQuery,
        per_page: 1,
        orientation: 'landscape',
        content_filter: 'high' // Get higher quality results
      },
      headers: {
        'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
      },
      timeout: 5000 // 5 second timeout
    });

    if (searchResponse.data && searchResponse.data.results && searchResponse.data.results.length > 0) {
      const imageUrl = searchResponse.data.results[0].urls.regular; // Use regular size for better quality
      
      // Fetch the actual image data
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000 // 10 second timeout for image download
      });

      // Determine image type from URL or Content-Type header
      let mimeType = 'image/jpeg'; // Default to JPEG
      const contentType = imageResponse.headers['content-type'];
      if (contentType && contentType.includes('image/')) {
        mimeType = contentType;
      } else if (imageUrl.includes('.png')) {
        mimeType = 'image/png';
      } else if (imageUrl.includes('.webp')) {
        mimeType = 'image/webp';
      }

      // Convert to base64 with proper header for pptxgenjs
      const base64Image = Buffer.from(imageResponse.data).toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Image}`;
      
      console.log(`Image stored with format: ${dataUrl.substring(0, 50)}...`);
      
      return {
        data: dataUrl,
        url: imageUrl,
        attribution: {
          photographer: searchResponse.data.results[0].user.name,
          photoUrl: searchResponse.data.results[0].links.html
        }
      };
    } else {
      console.warn(`No images found for query: "${cleanQuery}"`);
    }
  } catch (error) {
    console.warn(`Failed to fetch image for query "${query}":`, error.response?.status, error.response?.statusText || error.message);
    
    // Log more details for 400 errors
    if (error.response?.status === 400) {
      console.warn('Unsplash API 400 error details:', {
        data: error.response.data,
        headers: error.response.headers,
        config: {
          url: error.config?.url,
          params: error.config?.params
        }
      });
    }
  }
  
  return null;
}

// Enhanced presentation outline function with visual hints
async function getPresentationOutline(topic, options = {}) {
  const {
    slideCount = 5,
    presentationStyle = 'professional',
    audienceLevel = 'general',
    includeConclusion = true,
    colorTheme = 'blue'
  } = options;
  
  try {
    const prompt = `Create a high-quality PowerPoint outline about '${topic}' with EXACTLY ${slideCount} slides. 

IMPORTANT: You must create exactly ${slideCount} slides, no more, no less.

Style: ${presentationStyle} 
Audience level: ${audienceLevel}
${includeConclusion ? 'Include a conclusion slide as one of the slides.' : ''}

Return a JSON object with:
- 'title': string
- 'slides': array with exactly ${slideCount} slide objects

Each slide object must have:
- 'slideTitle': string  
- 'bulletPoints': array of strings (4-6 bullet points per slide). IMPORTANT: This must be a JSON array of individual strings, like ["Point one", "Point two"]. Do NOT concatenate points into a single string with slashes, numbers, or checkmarks embedded; keep them as separate strings in the array. Do not include any bullet symbols, checkmarks (like ✓ or √), numbers, or separators in the bullet point strings; keep them plain text.
- 'layout': one of ['title-bullets','two-column','quote','section-divider','checklist','numbers','image-left'] ensuring diversity across slides (do not repeat the same layout back-to-back)
- 'visualStyleHint': short phrase describing a distinct visual idea for this slide (e.g., "accent stripe at top", "two columns", "quote focus")
- 'visualHint': 1-2 simple descriptive words for image search (e.g., "technology", "business", "education", "teamwork", "growth")

Optional per slide (include tables or charts in relevant slides to enhance data presentation, such as those discussing numbers, comparisons, statistics, trends, or structured lists):
- 'image': { dataUrl?: string (data:image/png;base64,...), url?: string, idea?: string }
- 'table': { headers: string[], rows: string[][] }  // 2-6 rows, 2-6 columns, use for tabular data
- 'chart': { type: 'bar'|'line'|'pie', labels: string[], values: number[], title?: string } // max 6 items, use for numerical data or trends

Rules:
- Vary the 'layout' so slides look different from each other.
- Provide detailed, informative bullet points with explanations or examples where appropriate. Ensure content is engaging, insightful, and comprehensive.
- Provide simple 'visualHint' words that work well with stock photo searches.
- Actively include tables or charts in slides that would benefit from visual data representation.
- Ensure all strings in the JSON are properly formed. If a string contains a double quote ("), escape it with a backslash (\"). For example, instead of "He said "hello"", use "He said \"hello\"".
- For character names with nicknames, use formats like Isabel (Belly) Conklin or Isabel 'Belly' Conklin to avoid unescaped double quotes.
- Return ONLY JSON (no markdown fences, no extra commentary).

Make the content engaging, appropriate for the specified style and audience, and cover the topic in depth. REMEMBER: Return exactly ${slideCount} slides in the slides array.`;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let attempts = 0;
    const maxAttempts = 3;
    let delay = 1000; // initial delay in ms

    while (attempts < maxAttempts) {
      try {
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
                    ],
                    visualHint: topic.split(' ').slice(0, 2).join(' ')
                  });
                }
              }
            }
            
            // Fix bulletPoints if not array or concatenated
            parsed.slides.forEach(slide => {
              if (typeof slide.bulletPoints === 'string') {
                // Split by common separators
                slide.bulletPoints = slide.bulletPoints
                  .split(/[\n•✓√\/;]+/)
                  .map(s => s.trim().replace(/^\d+\.\s*/, '')) // Remove leading numbers
                  .filter(Boolean);
              } else if (!Array.isArray(slide.bulletPoints)) {
                slide.bulletPoints = [];
              }
            });
            
            return parsed;
          } catch (err) {
            throw new Error('Failed to parse extracted JSON from Gemini response.');
          }
        }
        throw new Error('No JSON found in Gemini API response.');
      } catch (error) {
        attempts++;
        if (error.status === 503 && attempts < maxAttempts) {
          console.warn(`Gemini API overloaded, retrying in ${delay / 1000} seconds... (Attempt ${attempts}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          console.error('Error in getPresentationOutline:', error);
          throw new Error(`Failed to generate presentation outline: ${error.message}`);
        }
      }
    }
    throw new Error('Failed to generate presentation outline after maximum retries.');
  } catch (error) {
    console.error('Error in getPresentationOutline:', error);
    throw new Error(`Failed to generate presentation outline: ${error.message}`);
  }
}

// Enhanced function to add images to slides
async function enhanceSlideWithImage(slideData) {
  if (!slideData.visualHint) {
    return slideData;
  }

  try {
    const imageData = await fetchImageFromUnsplash(slideData.visualHint);
    if (imageData) {
      slideData.image = {
        data: imageData.data,
        url: imageData.url,
        attribution: imageData.attribution
      };
      console.log(`Successfully fetched image for slide: ${slideData.slideTitle}`);
    }
  } catch (error) {
    console.warn(`Failed to enhance slide "${slideData.slideTitle}" with image:`, error.message);
  }

  return slideData;
}

// PPT generation route
router.post('/', async (req, res, next) => {
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

    // Get presentation outline with visual hints
    const outline = await getPresentationOutline(topic.trim(), options);

    // Enhance slides with images from Unsplash (sequential to avoid rate limits)
    if (outline.slides && Array.isArray(outline.slides)) {
      console.log(`Fetching images for ${outline.slides.length} slides...`);
      
      for (let i = 0; i < outline.slides.length; i++) {
        try {
          outline.slides[i] = await enhanceSlideWithImage(outline.slides[i]);
          
          // Add delay between requests to respect rate limits
          if (i < outline.slides.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
          }
        } catch (error) {
          console.warn(`Failed to enhance slide ${i + 1}:`, error.message);
        }
      }
    }

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
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.3, fill: { color }, line: { pt: 0 } });
    };

    // Enhanced image rendering with fetched images
    const renderImage = (s, region, image) => {
      if (!image) return false;
      
      // Use fetched image data from Unsplash
      if (image.data) {
        try {
          // PPTXGenJS expects the full data URL with header
          let imageData = image.data;
          
          // If we don't have a data URL header, add one
          if (!image.data.startsWith('data:')) {
            imageData = `data:image/jpeg;base64,${image.data}`;
          }
          
          // Debug logging
          console.log(`Adding image with data format: ${imageData.substring(0, 50)}...`);
          
          s.addImage({ 
            data: imageData, 
            x: region.x, 
            y: region.y, 
            w: region.w, 
            h: region.h, 
            sizing: { type: 'crop', w: region.w, h: region.h },
            rounded: true
          });
          return true;
        } catch (e) {
          console.warn('Image render failed, drawing placeholder:', e.message);
          console.warn('Image data format was:', image.data ? image.data.substring(0, 50) + '...' : 'null');
        }
      }
      
      // Fallback: placeholder block with idea text
      s.addShape(pptx.ShapeType.rect, { 
        x: region.x, 
        y: region.y, 
        w: region.w, 
        h: region.h, 
        fill: { color: lighten(selectedTheme.background, 0.6) }, 
        line: { color: selectedTheme.background, pt: 1 } 
      });
      const idea = (image.idea || 'Image placeholder');
      s.addText(idea, { 
        x: region.x + 0.2, 
        y: region.y + region.h - 0.5, 
        w: region.w - 0.4, 
        h: 0.4, 
        fontSize: 12, 
        color: selectedTheme.background, 
        align: 'right' 
      });
      return true;
    };

    // Utilities for optional media (charts and tables)
    const renderChart = (s, region, chart) => {
      if (!chart || !Array.isArray(chart.labels) || !Array.isArray(chart.values)) return false;
      const n = Math.min(chart.labels.length, chart.values.length);
      if (n === 0) return false;
      const typeMap = { bar: 'bar', line: 'line', pie: 'pie' };
      const t = (chart.type && typeMap[chart.type]) || 'bar';
      const chartTypeEnum = pptx.ChartType && pptx.ChartType[t] ? pptx.ChartType[t] : pptx.ChartType.bar;
      const data = [{ name: chart.title || 'Series', labels: chart.labels.slice(0, n), values: chart.values.slice(0, n) }];
      try {
        s.addChart(chartTypeEnum, data, { x: region.x, y: region.y, w: region.w, h: region.h, barDir: 'bar' });
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

    const addContentSlide = (pptx, slideData, index) => {
      const layout = pickLayout(index, (slideData && slideData.layout) || undefined);
      const bgVariants = [
        'FFFFFF',
        lighten(selectedTheme.accent, 0.85),
        lighten(selectedTheme.accent, 0.92),
        lighten(selectedTheme.background, 0.95),
        lighten(selectedTheme.accent, 0.8)
      ];
      const bg = bgVariants[index % bgVariants.length];
      const s = pptx.addSlide();
      s.background = { color: bg };
      addAccentStripe(s, selectedTheme.accent);

      const titleColor = selectedTheme.background;
      const textColor = selectedTheme.text;

      const title = slideData?.slideTitle || 'Untitled Slide';
      const bullets = Array.isArray(slideData?.bulletPoints) ? slideData.bulletPoints.filter(Boolean) : [];

      switch (layout) {
        case 'two-column': {
          s.addText(title, { x: 0.5, y: 0.5, w: 9, h: 0.8, fontSize: 28, bold: true, color: titleColor, align: 'left', valign: 'top', shrinkText: true });
          const mid = Math.ceil(bullets.length / 2) || 1;
          const left = bullets.slice(0, mid);
          const right = bullets.slice(mid);
          const leftText = left.map(t => `• ${t}`).join('\n');
          const rightText = right.map(t => `• ${t}`).join('\n');
          s.addText(leftText, { x: 0.5, y: 1.4, w: 4.25, h: 3.8, fontSize: 16, color: textColor, lineSpacing: 24, align: 'left', valign: 'top', shrinkText: true });
          const rightRegion = { x: 5.25, y: 1.4, w: 4.25, h: 3.8 };
          if (!(renderTable(s, rightRegion, slideData.table) || renderChart(s, rightRegion, slideData.chart))) {
            s.addText(rightText, { x: 5.25, y: 1.4, w: 4.25, h: 3.8, fontSize: 16, color: textColor, lineSpacing: 24, align: 'left', valign: 'top', shrinkText: true });
          }
          break;
        }
        case 'quote': {
          const quote = bullets[0] || 'Insightful quote or key takeaway goes here.';
          s.addText(title, { x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 24, bold: true, color: textColor, align: 'left', valign: 'top', shrinkText: true });
          s.addText(`"${quote}"`, { x: 0.75, y: 1.2, w: 8.5, h: 1.8, fontSize: 28, italic: true, color: titleColor, align: 'center', valign: 'top', shrinkText: true });
          const rest = bullets.slice(1);
          const restText = rest.map(t => `• ${t}`).join('\n');
          if (rest.length) {
            s.addText(restText, { x: 1, y: 3.2, w: 8, h: 2.3, fontSize: 14, color: textColor, lineSpacing: 20, align: 'left', valign: 'top', shrinkText: true });
          }
          const bottomRegion = { x: 0.75, y: 4.0, w: 8.5, h: 1.8 };
          renderTable(s, bottomRegion, slideData.table) || renderChart(s, bottomRegion, slideData.chart) || renderImage(s, bottomRegion, slideData.image);
          break;
        }
        case 'section-divider': {
          s.addShape(pptx.ShapeType.rect, { x: 1, y: 2, w: 8, h: 3, fill: { color: selectedTheme.accent }, line: { pt: 0 } });
          s.addText(title, { x: 1, y: 2.8, w: 8, h: 1, fontSize: 36, bold: true, color: 'FFFFFF', align: 'center', shrinkText: true });
          break;
        }
        case 'checklist': {
          s.addText(title, { x: 0.5, y: 0.5, w: 9, h: 0.8, fontSize: 28, bold: true, color: titleColor, align: 'left', valign: 'top', shrinkText: true });
          const checklistText = (bullets.length ? bullets : ['First task', 'Second task']).map(t => `✓ ${t}`).join('\n');
          s.addText(checklistText, { x: 0.5, y: 1.4, w: 9, h: 3.8, fontSize: 16, color: textColor, lineSpacing: 24, align: 'left', valign: 'top', shrinkText: true });
          const bottomRegion = { x: 0.5, y: 4.0, w: 9, h: 1.8 };
          renderChart(s, bottomRegion, slideData.chart) || renderTable(s, bottomRegion, slideData.table);
          break;
        }
        case 'numbers': {
          s.addText(title, { x: 0.5, y: 0.5, w: 9, h: 0.8, fontSize: 28, bold: true, color: titleColor, align: 'left', valign: 'top', shrinkText: true });
          const numbersText = (bullets.length ? bullets : ['Point one', 'Point two']).map((t, i) => `${i + 1}. ${t}`).join('\n');
          s.addText(numbersText, { x: 0.5, y: 1.4, w: 9, h: 3.8, fontSize: 16, color: textColor, lineSpacing: 24, align: 'left', valign: 'top', shrinkText: true });
          const bottomRegion = { x: 0.5, y: 4.0, w: 9, h: 1.8 };
          renderChart(s, bottomRegion, slideData.chart) || renderTable(s, bottomRegion, slideData.table);
          break;
        }
        case 'image-left': {
          const imgRegion = { x: 0.5, y: 1.4, w: 4, h: 3.5 };
          renderImage(s, imgRegion, slideData.image);
          s.addText(title, { x: 4.75, y: 0.5, w: 4.75, h: 0.8, fontSize: 28, bold: true, color: titleColor, align: 'left', valign: 'top', shrinkText: true });
          const bulletText = bullets.map(t => `• ${t}`).join('\n');
          s.addText(bulletText, { x: 4.75, y: 1.4, w: 4.75, h: 3.5, fontSize: 16, color: textColor, lineSpacing: 24, align: 'left', valign: 'top', shrinkText: true });
          break;
        }
        case 'title-bullets':
        default: {
          s.addText(title, { x: 0.5, y: 0.5, w: 9, h: 0.8, fontSize: 28, bold: true, color: titleColor, align: 'left', valign: 'top', shrinkText: true });
          const bulletText = bullets.map(t => `• ${t}`).join('\n');
          s.addText(bulletText, { x: 0.5, y: 1.4, w: 6, h: 3.8, fontSize: 16, color: textColor, lineSpacing: 24, align: 'left', valign: 'top', shrinkText: true });
          const rightRegion = { x: 6.75, y: 1.4, w: 2.75, h: 3.5 };
          renderImage(s, rightRegion, slideData.image);
          const bottomRegion = { x: 0.5, y: 4.0, w: 9, h: 1.8 };
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
      fontSize: 36, bold: true, color: selectedTheme.title, align: 'center', shrinkText: true 
    });
    slide.addText(`Presentation on ${topic}`, { 
      x: 1, y: 4, w: 8, h: 1, 
      fontSize: 24, color: selectedTheme.title, align: 'center', shrinkText: true 
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
    // Pass error to error handling middleware
    next(err);
  }
});

module.exports = router;