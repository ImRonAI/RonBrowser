/**
 * Search Results Page
 *
 * Page component that displays search results using the SearchLayout component.
 * Demonstrates all result types with mock data.
 */

import { useState } from 'react'
import { SearchLayout } from '@/components/search-results'
import type {
  SearchResponse,
  UniversalResult,
} from '@/types/search'

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA - Complete search response with all result types
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_SEARCH_RESPONSE: SearchResponse = {
  id: 'search-123',
  query: 'artificial intelligence and machine learning',
  timestamp: Date.now(),
  isComplete: true,
  totalCount: 20,
  duration: 234,
  
  sonarReasoning: {
    reasoning: 'The search for "artificial intelligence and machine learning" returned diverse results across multiple content types. The analysis indicates strong interest in both theoretical foundations and practical applications. Key themes include neural networks, deep learning, large language models, and real-world implementations.',
    
    chainOfThought: {
      steps: [
        {
          id: 'step-1',
          label: 'Initial Query Analysis',
          description: 'Breaking down search terms and identifying key concepts',
          status: 'complete',
          timestamp: Date.now() - 5000,
          reasoning: 'Analyzing query for AI, machine learning, and related concepts.',
          searchResults: [],
        },
        {
          id: 'step-2',
          label: 'Multi-Source Search',
          description: 'Searching across video, academic, and web sources',
          status: 'complete',
          timestamp: Date.now() - 3000,
          reasoning: 'Executing parallel searches across multiple data sources.',
          tools: ['brave_web_search', 'semantic_scholar_search', 'youtube_search'],
        },
        {
          id: 'step-3',
          label: 'Result Synthesis',
          description: 'Combining and ranking results by relevance',
          status: 'complete',
          timestamp: Date.now(),
          reasoning: 'Merging results and applying relevance scoring.',
        },
      ],
    },
    
    confidence: 0.89,
    qualityScore: 0.92,
    
    sources: [
      {
        id: 'source-1',
        url: 'https://arxiv.org/abs/1706.03762',
        title: 'Attention Is All You Need',
        snippet: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.',
        relevanceScore: 0.95,
        type: 'academic',
        domain: 'arxiv.org',
        confidence: 0.97,
        credibilityScore: 0.98,
      },
      {
        id: 'source-2',
        url: 'https://youtube.com/watch?v=aircAruvnKk',
        title: 'But what is a neural network?',
        snippet: 'Deep learning is an exciting subfield of machine learning.',
        relevanceScore: 0.92,
        type: 'video',
        domain: 'youtube.com',
      },
    ],
    
    summary: 'Found comprehensive resources spanning academic papers, video tutorials, podcasts, and code examples covering AI and ML fundamentals.',
    
    relatedQueries: [
      'deep learning fundamentals',
      'neural network architecture',
      'LLM applications',
      'AI ethics',
    ],
    
    modelUsed: 'sonar-reasoning-pro-v2',
    tokensUsed: 1234,
  },
  
  results: [
    // ─── VIDEO RESULTS (2) ────────────────────────────────────────────────────
    {
      id: 'video-1',
      type: 'video',
      title: 'But what is a neural network? | Deep learning chapter 1',
      url: 'https://youtube.com/watch?v=aircAruvnKk',
      thumbnail: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&h=225&fit=crop',
      duration: 1215,
      embedUrl: 'https://youtube.com/embed/aircAruvnKk',
      embedType: 'youtube',
      platform: 'youtube',
      uploader: '3Blue1Brown',
      uploaderUrl: 'https://youtube.com/@3blue1brown',
      viewCount: 15700000,
      publishedAt: '2017-10-05T00:00:00Z',
      relevanceScore: 0.95,
    },
    {
      id: 'video-2',
      type: 'video',
      title: 'Introduction to Machine Learning | MIT 6.S191',
      url: 'https://youtube.com/watch?v=IPkBbjo9rR8',
      thumbnail: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=400&h=225&fit=crop',
      duration: 3600,
      embedUrl: 'https://youtube.com/embed/IPkBbjo9rR8',
      embedType: 'youtube',
      platform: 'youtube',
      uploader: 'MIT OpenCourseWare',
      uploaderUrl: 'https://youtube.com/@mitocw',
      viewCount: 890000,
      publishedAt: '2022-02-15T00:00:00Z',
      relevanceScore: 0.88,
    },
    
    // ─── AUDIO RESULTS (2) ──────────────────────────────────────────────────────
    {
      id: 'audio-1',
      type: 'audio',
      title: 'Neural Networks Explained',
      url: 'https://example.com/neural-networks-explained',
      audioUrl: 'https://example.com/audio/neural-networks.mp3',
      duration: 1800,
      artwork: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=200&h=200&fit=crop',
      artist: 'Tech Explained',
      album: 'AI Series',
      genre: 'Technology',
      platform: 'spotify',
      relevanceScore: 0.82,
    },
    {
      id: 'audio-2',
      type: 'audio',
      title: 'Machine Learning Fundamentals',
      url: 'https://example.com/ml-fundamentals',
      audioUrl: 'https://example.com/audio/ml-fundamentals.mp3',
      duration: 2400,
      artwork: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=200&h=200&fit=crop',
      artist: 'Data Science Weekly',
      album: 'Learning Series',
      genre: 'Education',
      platform: 'spotify',
      relevanceScore: 0.79,
    },
    
    // ─── PODCAST RESULTS (2) ────────────────────────────────────────────────────
    {
      id: 'podcast-1',
      type: 'podcast',
      title: 'The Future of AI with Andrew Ng',
      url: 'https://podcasts.example.com/episode/ai-future',
      audioUrl: 'https://podcasts.example.com/audio/episode-123.mp3',
      duration: 3240,
      artwork: 'https://images.unsplash.com/photo-1535303311164-664fc9ec6532?w=200&h=200&fit=crop',
      episodeNumber: 42,
      seasonNumber: 3,
      publishedAt: '2024-01-15T00:00:00Z',
      showTitle: 'AI Today',
      showUrl: 'https://podcasts.example.com/show/ai-today',
      host: 'Sarah Chen',
      hostUrl: 'https://twitter.com/sarahchen',
      platform: 'spotify',
      relevanceScore: 0.91,
    },
    {
      id: 'podcast-2',
      type: 'podcast',
      title: 'Building Machine Learning Systems at Scale',
      url: 'https://podcasts.example.com/episode/ml-scale',
      audioUrl: 'https://podcasts.example.com/audio/episode-124.mp3',
      duration: 2700,
      artwork: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=200&h=200&fit=crop',
      episodeNumber: 23,
      publishedAt: '2024-01-10T00:00:00Z',
      showTitle: 'Engineering Deep Dive',
      showUrl: 'https://podcasts.example.com/show/engineering',
      host: 'Mike Roberts',
      platform: 'apple-podcasts',
      relevanceScore: 0.85,
    },
    
    // ─── WEB RESULTS (2) ────────────────────────────────────────────────────────
    {
      id: 'web-1',
      type: 'web',
      title: 'Deep Learning | MIT Technology Review',
      url: 'https://www.technologyreview.com/2024/01/10/1086408/deep-learning-explained/',
      snippet: 'Deep learning is a subset of machine learning that uses neural networks with multiple layers to progressively extract higher-level features.',
      favicon: 'https://www.technologyreview.com/favicon.ico',
      domain: 'technologyreview.com',
      author: 'Will Knight',
      publishDate: '2024-01-10',
      relevanceScore: 0.94,
      credibilityScore: 0.88,
    },
    {
      id: 'web-2',
      type: 'web',
      title: 'Understanding Machine Learning: A Comprehensive Guide',
      url: 'https://towardsdatascience.com/understanding-machine-learning-a-comprehensive-guide',
      snippet: 'Machine learning is a field of artificial intelligence that uses statistical techniques to give computer systems the ability to learn from data.',
      favicon: 'https://towardsdatascience.com/favicon.ico',
      domain: 'towardsdatascience.com',
      author: 'Jason Brownlee',
      publishDate: '2023-11-20',
      relevanceScore: 0.87,
    },
    
    // ─── ARTICLE RESULTS (2) ────────────────────────────────────────────────────
    {
      id: 'article-1',
      type: 'article',
      title: 'The Rise of Generative AI: A New Era of Creativity',
      url: 'https://www.wired.com/story/generative-ai-new-era-creativity',
      snippet: 'Generative AI is reshaping industries from art to healthcare, creating new possibilities while raising important questions about copyright and ethics.',
      favicon: 'https://www.wired.com/favicon.ico',
      thumbnail: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&h=400&fit=crop',
      author: 'Charlotte Jee',
      authorUrl: 'https://www.wired.com/author/charlotte-jee',
      publishDate: '2024-01-05',
      publication: 'WIRED',
      publicationUrl: 'https://www.wired.com',
      readingTime: 8,
      wordCount: 2100,
      relevanceScore: 0.89,
    },
    {
      id: 'article-2',
      type: 'article',
      title: 'Large Language Models: Understanding the Technology Behind ChatGPT',
      url: 'https://www.theverge.com/23675672/llm-large-language-models-explained',
      snippet: 'Large language models are transforming how we interact with computers, but how do they actually work under the hood?',
      favicon: 'https://www.theverge.com/favicon.ico',
      thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&h=400&fit=crop',
      author: 'James Vincent',
      authorUrl: 'https://www.theverge.com/authors/james-vincent',
      publishDate: '2023-12-18',
      publication: 'The Verge',
      publicationUrl: 'https://www.theverge.com',
      readingTime: 6,
      relevanceScore: 0.86,
    },
    
    // ─── SOCIAL MEDIA RESULTS (2) ──────────────────────────────────────────────
    {
      id: 'social-1',
      type: 'social',
      content: 'Just published our new research on transformer architectures! The attention mechanism is truly revolutionary. #AI #MachineLearning',
      url: 'https://twitter.com/researchlab/status/174567890123456',
      thumbnail: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=400&h=300&fit=crop',
      mediaType: 'none',
      platform: 'twitter',
      handle: '@researchlab',
      author: 'AI Research Lab',
      authorUrl: 'https://twitter.com/researchlab',
      avatar: 'https://pbs.twimg.com/profile_images/1234567890/avatar.jpg',
      likes: 24500,
      shares: 8900,
      comments: 1200,
      publishedAt: '2024-01-08T10:30:00Z',
      isVerified: true,
      relevanceScore: 0.81,
    },
    {
      id: 'social-2',
      type: 'social',
      content: '🚀 Exciting to see how neural networks are being applied in healthcare! Early detection systems are saving lives.',
      url: 'https://linkedin.com/posts/ai-innovations/healthcare-ai',
      thumbnail: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=300&fit=crop',
      mediaType: 'image',
      platform: 'linkedin',
      handle: 'ai-innovations',
      author: 'Dr. Sarah Mitchell',
      authorUrl: 'https://linkedin.com/in/sarah-mitchell',
      avatar: 'https://media.licdn.com/dms/image/C5603AQHwZwZkY5kXQ/profile-displayphoto-shrink_100_100/0/1234567890',
      likes: 3400,
      comments: 280,
      publishedAt: '2024-01-07T14:20:00Z',
      isVerified: true,
      relevanceScore: 0.76,
    },
    
    // ─── TRAVEL RESULTS (2) ──────────────────────────────────────────────────────
    {
      id: 'travel-1',
      type: 'travel',
      title: 'AI Conference 2024 - San Francisco',
      url: 'https://events.example.com/ai-conference-2024',
      thumbnail: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop',
      price: 899,
      currency: 'USD',
      originalPrice: 1199,
      destination: 'San Francisco, CA',
      origin: undefined,
      dates: {
        departure: '2024-06-15',
        return: '2024-06-18',
      },
      airline: undefined,
      flightNumber: undefined,
      duration: undefined,
      bookingUrl: 'https://booking.example.com/ai-conference-2024',
      provider: 'expedia',
      propertyType: 'hotel',
      bedrooms: undefined,
      rating: 4.5,
      reviews: 234,
      images: [
        'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400',
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
      ],
      relevanceScore: 0.72,
    },
    {
      id: 'travel-2',
      type: 'travel',
      title: 'Machine Learning Summit - London',
      url: 'https://summit.example.com/ml-london',
      thumbnail: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&h=300&fit=crop',
      price: 650,
      currency: 'GBP',
      destination: 'London, UK',
      dates: {
        departure: '2024-05-20',
        return: '2024-05-22',
      },
      bookingUrl: 'https://booking.example.com/ml-summit-london',
      provider: 'generic',
      rating: 4.7,
      reviews: 189,
      relevanceScore: 0.68,
    },
    
    // ─── ACADEMIC RESULTS (2) ────────────────────────────────────────────────────
    {
      id: 'academic-1',
      type: 'academic',
      title: 'Attention Is All You Need',
      url: 'https://arxiv.org/abs/1706.03762',
      snippet: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder.',
      abstract: 'We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.',
      authors: [
        'Ashish Vaswani',
        'Noam Shazeer',
        'Niki Parmar',
        'Jakob Uszkoreit',
        'Llion Jones',
        'Aidan N. Gomez',
        'Łukasz Kaiser',
        'Illia Polosukhin',
      ],
      journal: 'Advances in Neural Information Processing Systems',
      venue: 'NeurIPS',
      publishDate: '2017-06-12',
      arxivId: '1706.03762',
      citationCount: 124500,
      year: 2017,
      pdfUrl: 'https://arxiv.org/pdf/1706.03762.pdf',
      hasOpenAccess: true,
      relevanceScore: 0.98,
    },
    {
      id: 'academic-2',
      type: 'academic',
      title: 'Deep Residual Learning for Image Recognition',
      url: 'https://arxiv.org/abs/1512.03385',
      snippet: 'Deeper neural networks are more difficult to train. We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously.',
      abstract: 'We reformulate the layers as learning residual functions with reference to the layer inputs, instead of learning unreferenced functions.',
      authors: [
        'Kaiming He',
        'Xiangyu Zhang',
        'Shaoqing Ren',
        'Jian Sun',
      ],
      journal: 'IEEE Conference on Computer Vision and Pattern Recognition',
      venue: 'CVPR',
      publishDate: '2016-12-10',
      arxivId: '1512.03385',
      citationCount: 189000,
      year: 2016,
      pdfUrl: 'https://arxiv.org/pdf/1512.03385.pdf',
      hasOpenAccess: true,
      relevanceScore: 0.94,
    },
    
    // ─── IMAGE RESULTS (2) ──────────────────────────────────────────────────────
    {
      id: 'image-1',
      type: 'image',
      title: 'Neural Network Visualization',
      url: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485',
      thumbnail: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&h=300&fit=crop',
      width: 1920,
      height: 1080,
      format: 'jpg',
      sourceUrl: 'https://unsplash.com/photos/neural-network',
      source: 'Unsplash',
      author: 'Alex Knight',
      altText: 'Abstract visualization of neural network connections',
      tags: ['neural network', 'AI', 'machine learning', 'technology'],
      colors: ['#6366f1', '#8b5cf6', '#a855f7'],
      relevanceScore: 0.85,
    },
    {
      id: 'image-2',
      type: 'image',
      title: 'Robot Hand with AI Chip',
      url: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e',
      thumbnail: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&h=300&fit=crop',
      width: 2048,
      height: 1365,
      format: 'jpg',
      sourceUrl: 'https://unsplash.com/photos/robot-ai',
      source: 'Unsplash',
      author: 'Franki Chamaki',
      altText: 'Robot hand holding an artificial intelligence chip',
      tags: ['robot', 'AI', 'technology', 'future'],
      colors: ['#0ea5e9', '#0284c7', '#0369a1'],
      relevanceScore: 0.79,
    },
    
    // ─── CODE RESULTS (2) ───────────────────────────────────────────────────────
    {
      id: 'code-1',
      type: 'code',
      title: 'tensorflow/tensorflow',
      url: 'https://github.com/tensorflow/tensorflow',
      snippet: 'An Open Source Machine Learning Framework for Everyone',
      repository: 'tensorflow/tensorflow',
      repositoryUrl: 'https://github.com/tensorflow/tensorflow',
      packageName: 'tensorflow',
      version: '2.15.0',
      author: 'TensorFlow',
      authorUrl: 'https://github.com/tensorflow',
      language: 'Python',
      languageIcon: 'python',
      stars: 182000,
      forks: 93000,
      lastUpdated: '2024-01-10T15:30:00Z',
      codePreview: 'import tensorflow as tf\n\nmodel = tf.keras.Sequential([\n  tf.keras.layers.Dense(128, activation="relu"),\n  tf.keras.layers.Dense(10, activation="softmax")\n])',
      lineCount: 150000,
      relevanceScore: 0.96,
    },
    {
      id: 'code-2',
      type: 'code',
      title: 'pytorch/pytorch',
      url: 'https://github.com/pytorch/pytorch',
      snippet: 'Tensors and Dynamic neural networks in Python with strong GPU acceleration',
      repository: 'pytorch/pytorch',
      repositoryUrl: 'https://github.com/pytorch/pytorch',
      packageName: 'torch',
      version: '2.1.0',
      author: 'PyTorch',
      authorUrl: 'https://github.com/pytorch',
      language: 'Python',
      languageIcon: 'python',
      stars: 78000,
      forks: 21000,
      lastUpdated: '2024-01-08T12:45:00Z',
      codePreview: 'import torch\nimport torch.nn as nn\n\nclass NeuralNetwork(nn.Module):\n  def __init__(self):\n    super().__init__()\n    self.flatten = nn.Flatten()',
      lineCount: 98000,
      relevanceScore: 0.93,
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function SearchResultsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [searchResponse] = useState<SearchResponse | null>(MOCK_SEARCH_RESPONSE)
  const [error] = useState<string | null>(null)
  
  const searchQuery = searchResponse?.query || 'artificial intelligence and machine learning'

  const handleRefresh = () => {
    setIsLoading(true)
    // Simulate refresh
    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }

  const handleResultClick = (result: UniversalResult) => {
    console.log('Result clicked:', result)
    // In a real app, this would open the result
  }

  const handleFilterChange = () => {
    console.log('Filters changed')
  }

  return (
    <div className="min-h-screen bg-surface-0 dark:bg-surface-900">
      {/* Page Header */}
      <div className="border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <svg 
                  className="w-6 h-6 text-accent dark:text-accent-light" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                  />
                </svg>
                <div>
                  <h1 className="text-2xl font-bold text-ink dark:text-ink-inverse">
                    Search Results
                  </h1>
                  <p className="text-sm text-ink-muted dark:text-ink-inverse-muted mt-1">
                    Query: <span className="font-medium text-ink dark:text-ink-inverse">"{searchQuery}"</span>
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${isLoading 
                    ? 'bg-surface-200 dark:bg-surface-700 text-ink-muted dark:text-ink-inverse-muted cursor-not-allowed'
                    : 'bg-surface-100 dark:bg-surface-800 text-ink dark:text-ink-inverse hover:bg-surface-200 dark:hover:bg-surface-700'
                  }
                `}
              >
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <SearchLayout
          searchResponse={searchResponse}
          searchQuery={searchQuery}
          isLoading={isLoading}
          error={error}
          onResultClick={handleResultClick}
          onFilterChange={handleFilterChange}
        />
      </div>
    </div>
  )
}

export default SearchResultsPage
