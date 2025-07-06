import { Tool } from '../AIAgentService';

export class TavilySearchTool implements Tool {
  name = 'TavilySearch';
  description = 'Search the web for current information using Tavily AI';
  private apiKey: string;
  private baseUrl = 'https://api.tavily.com/search';

  constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_TAVILY_API_KEY || '';
    if (!this.apiKey) {
      console.warn('Tavily API key not found. Web search will be disabled.');
    }
  }

  shouldActivate(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    
    // Activate for queries that likely need current information
    const realTimeIndicators = [
      'news', 'latest', 'current', 'today', 'recent', 'now',
      'stock price', 'weather', 'breaking news', 'update',
      'what happened', 'current events', 'trending'
    ];

    const searchIndicators = [
      'what is', 'who is', 'how to', 'where is', 'when did',
      'information about', 'tell me about', 'explain',
      'research', 'find out', 'look up'
    ];

    return realTimeIndicators.some(indicator => lowerQuery.includes(indicator)) ||
           searchIndicators.some(indicator => lowerQuery.includes(indicator));
  }

  async execute(query: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Tavily API key not configured');
    }

    try {
      console.log('🔍 Executing Tavily search for:', query);

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          query: query,
          search_depth: 'basic',
          include_answer: true,
          include_images: false,
          include_raw_content: false,
          max_results: 5,
          include_domains: [],
          exclude_domains: []
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.answer) {
        // If Tavily provides a direct answer, use it
        let result = `Direct Answer: ${data.answer}\n\n`;
        
        // Add top search results for additional context
        if (data.results && data.results.length > 0) {
          result += 'Supporting Sources:\n';
          data.results.slice(0, 3).forEach((result: any, index: number) => {
            result += `${index + 1}. ${result.title}\n${result.content}\nSource: ${result.url}\n\n`;
          });
        }

        return result;
      } else if (data.results && data.results.length > 0) {
        // If no direct answer, compile search results
        let result = 'Search Results:\n\n';
        
        data.results.slice(0, 5).forEach((searchResult: any, index: number) => {
          result += `${index + 1}. ${searchResult.title}\n`;
          result += `${searchResult.content}\n`;
          result += `Source: ${searchResult.url}\n`;
          result += `Published: ${searchResult.published_date || 'Unknown'}\n\n`;
        });

        return result;
      } else {
        return 'No search results found for this query.';
      }

    } catch (error) {
      console.error('Tavily search error:', error);
      throw new Error(`Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format search results for better readability
   */
  private formatSearchResults(results: any[]): string {
    if (!results || results.length === 0) {
      return 'No search results found.';
    }

    let formatted = '';
    results.forEach((result, index) => {
      formatted += `${index + 1}. **${result.title}**\n`;
      formatted += `${result.content}\n`;
      formatted += `*Source: ${result.url}*\n`;
      if (result.published_date) {
        formatted += `*Published: ${result.published_date}*\n`;
      }
      formatted += '\n';
    });

    return formatted;
  }

  /**
   * Extract key information from search results
   */
  private extractKeyInfo(results: any[], query: string): string {
    if (!results || results.length === 0) {
      return '';
    }

    // Try to find the most relevant result based on query keywords
    const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
    
    let bestResult = results[0];
    let bestScore = 0;

    for (const result of results) {
      const content = (result.title + ' ' + result.content).toLowerCase();
      let score = 0;
      
      for (const word of queryWords) {
        if (content.includes(word)) {
          score++;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestResult = result;
      }
    }

    return `Key Information: ${bestResult.content}\nSource: ${bestResult.url}`;
  }
}