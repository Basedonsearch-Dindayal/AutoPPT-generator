'use client';

import { useState } from 'react';

export default function Home() {
  const [topic, setTopic] = useState('');
  const [slideCount, setSlideCount] = useState(5);
  const [presentationStyle, setPresentationStyle] = useState('professional');
  const [audienceLevel, setAudienceLevel] = useState('general');
  const [includeConclusion, setIncludeConclusion] = useState(true);
  const [colorTheme, setColorTheme] = useState('blue');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!topic.trim()) {
      setMessage('Please enter a presentation topic');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      console.log('Sending request with options:', {
        topic: topic.trim(),
        slideCount,
        presentationStyle,
        audienceLevel,
        includeConclusion,
        colorTheme
      });
      
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (!backendUrl) {
        throw new Error('Backend URL not configured. Please check your environment variables.');
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const response = await fetch(`${backendUrl}/generate-ppt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          topic: topic.trim(),
          slideCount,
          presentationStyle,
          audienceLevel,
          includeConclusion,
          colorTheme
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      // Handle file download
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        // Response is JSON (error), not a file
        const errorData = await response.json();
        throw new Error(errorData.error || 'Unknown server error');
      }
      
      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Empty file received from server');
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${topic.trim().replace(/[^a-zA-Z0-9]/g, '_')}_presentation.pptx`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setMessage('Presentation downloaded successfully!');
      setTopic('');
    } catch (error) {
      console.error('Error generating presentation:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. Please try again with a simpler topic.';
      } else if (error.message.includes('fetch')) {
        errorMessage = 'Cannot connect to server. Please check your internet connection.';
      } else {
        errorMessage = error.message;
      }
      
      setMessage(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
              Auto PPT Maker
            </h1>
            <p className="text-xl text-gray-600 font-light">
              Generate professional presentations instantly with AI
            </p>
          </div>

          {/* Main Form Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 transition-all duration-300 hover:shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label 
                  htmlFor="topic" 
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Presentation Topic
                </label>
                <input
                  type="text"
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter your presentation topic (e.g., Climate Change, AI in Healthcare)"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-gray-800 placeholder-gray-400"
                  disabled={isLoading}
                />
              </div>

              {/* Customization Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Number of Slides
                  </label>
                  <select
                    value={slideCount}
                    onChange={(e) => setSlideCount(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    disabled={isLoading}
                  >
                    <option value={3}>3 slides</option>
                    <option value={5}>5 slides</option>
                    <option value={7}>7 slides</option>
                    <option value={10}>10 slides</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Presentation Style
                  </label>
                  <select
                    value={presentationStyle}
                    onChange={(e) => setPresentationStyle(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    disabled={isLoading}
                  >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="academic">Academic</option>
                    <option value="creative">Creative</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Audience Level
                  </label>
                  <select
                    value={audienceLevel}
                    onChange={(e) => setAudienceLevel(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    disabled={isLoading}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="general">General</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Color Theme
                  </label>
                  <select
                    value={colorTheme}
                    onChange={(e) => setColorTheme(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    disabled={isLoading}
                  >
                    <option value="blue">Blue</option>
                    <option value="green">Green</option>
                    <option value="purple">Purple</option>
                    <option value="red">Red</option>
                    <option value="orange">Orange</option>
                    <option value="teal">Teal</option>
                    <option value="gray">Gray</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Options
                  </label>
                  <div className="flex items-center space-x-3 mt-3">
                    <input
                      type="checkbox"
                      id="conclusion"
                      checked={includeConclusion}
                      onChange={(e) => setIncludeConclusion(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      disabled={isLoading}
                    />
                    <label htmlFor="conclusion" className="text-sm text-gray-700">
                      Include conclusion slide
                    </label>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !topic.trim()}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:hover:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Generating...</span>
                  </div>
                ) : (
                  'Generate PPT'
                )}
              </button>
            </form>

            {/* Status Message */}
            {message && (
              <div className={`mt-6 p-4 rounded-xl text-center font-medium ${
                message.includes('Error') 
                  ? 'bg-red-50 text-red-700 border border-red-200' 
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                {message}
              </div>
            )}
          </div>

          {/* Features */}
          <div className="mt-16 grid md:grid-cols-3 gap-6">
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center border border-white/20">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Lightning Fast</h3>
              <p className="text-sm text-gray-600">Generate presentations instantly</p>
            </div>

            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center border border-white/20">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">AI Powered</h3>
              <p className="text-sm text-gray-600">Intelligent content creation</p>
            </div>

            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center border border-white/20">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Professional</h3>
              <p className="text-sm text-gray-600">Production-ready slides</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}