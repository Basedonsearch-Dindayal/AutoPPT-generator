export async function POST(request) {
  try {
    // Parse the request body to get the topic
    const { topic } = await request.json();

    // Validate the topic
    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return new Response(
        JSON.stringify({ error: 'Topic is required and must be a non-empty string' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Forward the request to the Python backend
    const pythonBackendUrl = 'http://localhost:5000/generate-ppt';
    
    const response = await fetch(pythonBackendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ topic: topic.trim() }),
    });

    // Check if the Python backend request was successful
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`Python backend error (${response.status}):`, errorText);
      
      return new Response(
        JSON.stringify({ 
          error: `Backend service error: ${response.status}`,
          details: 'The presentation generation service is currently unavailable'
        }),
        {
          status: response.status >= 500 ? 502 : response.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get the file data from the Python backend
    const fileBuffer = await response.arrayBuffer();

    // Generate a filename based on the topic
    const sanitizedTopic = topic.trim().replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${sanitizedTopic}_presentation.pptx`;

    // Stream the file back to the client with proper headers
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('API route error:', error);

    // Handle different types of errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return new Response(
        JSON.stringify({ 
          error: 'Connection failed',
          details: 'Unable to connect to the presentation generation service. Please ensure the Python backend is running on localhost:5000.'
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: 'An unexpected error occurred while processing your request'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}