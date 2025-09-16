// Error handling middleware for the Express application
const errorHandler = (err, req, res, next) => {
  const startTime = req.startTime || Date.now();
  const endTime = Date.now();
  
  console.error('Request failed after:', endTime - startTime, 'ms');
  console.error('Full error details:', err);
  
  // Don't expose internal errors to client
  let errorMessage = 'Internal server error';
  let statusCode = 500;
  
  // Handle specific error types
  if (err.message.includes('API key') || err.message.includes('quota')) {
    errorMessage = 'Service temporarily unavailable';
    statusCode = 503;
  } else if (err.message.includes('parse') || err.message.includes('JSON')) {
    errorMessage = 'Failed to process AI response';
    statusCode = 502;
  } else if (err.message.includes('validation') || err.message.includes('Invalid')) {
    errorMessage = err.message;
    statusCode = 400;
  } else if (err.message.includes('timeout') || err.message.includes('TIMEOUT')) {
    errorMessage = 'Request timeout - please try again';
    statusCode = 408;
  } else if (err.message.includes('Rate limit') || err.message.includes('Too many requests')) {
    errorMessage = 'Too many requests - please try again later';
    statusCode = 429;
  }
  
  // Log additional context for debugging
  console.error('Error context:', {
    method: req.method,
    url: req.url,
    body: req.body ? Object.keys(req.body) : 'No body',
    statusCode,
    errorMessage
  });
  
  res.status(statusCode).json({ 
    error: errorMessage,
    timestamp: new Date().toISOString()
  });
};

// Middleware to add start time to requests for timing
const requestTimer = (req, res, next) => {
  req.startTime = Date.now();
  next();
};

module.exports = {
  errorHandler,
  requestTimer
};