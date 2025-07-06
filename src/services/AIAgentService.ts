import { OpenAIService } from './OpenAIService';
import { TavilySearchTool } from './tools/TavilySearchTool';
import { CalculatorTool } from './tools/CalculatorTool';
import { DateTimeTool } from './tools/DateTimeTool';

export interface Tool {
  name: string;
  description: string;
  execute(input: string): Promise<string>;
  shouldActivate(query: string): boolean;
}

export interface AgentContext {
  originalQuery: string;
  gatheredInfo: Array<{
    source: string;
    content: string;
    relevance: number;
  }>;
  toolsUsed: string[];
  timestamp: Date;
}

export class AIAgentService {
  private openAIService: OpenAIService;
  private tools: Tool[] = [];
  private usageStats = {
    totalQueries: 0,
    webSearches: 0,
    calculations: 0,
    dateTimeQueries: 0,
    costSaved: 0, // Estimated API calls saved
  };

  constructor(openAIService: OpenAIService) {
    this.openAIService = openAIService;
    this.initializeTools();
  }

  private initializeTools() {
    // Initialize available tools
    this.tools = [
      new TavilySearchTool(),
      new CalculatorTool(),
      new DateTimeTool(),
    ];
  }

  /**
   * Main agent processing pipeline
   */
  async processQuery(
    query: string, 
    conversationId: string,
    systemPrompt?: string
  ): Promise<string> {
    console.log('🤖 AI Agent processing query:', query);
    this.usageStats.totalQueries++;

    // Step 1: Intent Analysis - Determine what tools might be needed
    const intent = await this.analyzeIntent(query);
    console.log('🧠 Intent analysis:', intent);

    // Log cost optimization decisions
    if (!intent.needsWebSearch) {
      this.usageStats.costSaved++;
      console.log('💰 Cost optimization: Skipping web search - estimated $0.003 saved');
    }

    // Step 2: Tool Selection and Execution
    const context = await this.gatherInformation(query, intent);
    console.log('🔍 Gathered context:', {
      toolsUsed: context.toolsUsed,
      infoSources: context.gatheredInfo.length,
    });

    // Step 3: Context Synthesis and Enhanced Prompt Creation
    const enhancedPrompt = await this.synthesizeContext(query, context);
    console.log('📝 Enhanced prompt created');

    // Step 4: Generate final response using enhanced context
    // Enhance the system prompt to encourage detailed, structured responses
    const isVoiceMode = systemPrompt?.includes('voice-optimized') || systemPrompt?.includes('spoken aloud');
    
    const enhancedSystemPrompt = systemPrompt ? 
      `${systemPrompt}\n\nIMPORTANT: Given that I have gathered additional context from tools${context.toolsUsed.length > 0 ? ` (${context.toolsUsed.join(', ')})` : ''}, please provide a comprehensive, well-structured response that integrates this information seamlessly. ${isVoiceMode ? 'Structure your response for clear speech delivery with natural transitions between ideas.' : 'Use clear headings, bullet points, and examples where appropriate to make the information easily digestible.'}` 
      : undefined;

    const response = await this.openAIService.sendMessageWithContext(
      enhancedPrompt,
      conversationId,
      enhancedSystemPrompt
    );

    if (response.choices[0]?.message?.content) {
      return response.choices[0].message.content;
    }

    throw new Error('Failed to generate AI response');
  }

  /**
   * Analyze user intent to determine which tools to use
   * Enhanced with cost-optimization to minimize expensive API calls
   */
  private async analyzeIntent(query: string): Promise<{
    needsWebSearch: boolean;
    needsCalculation: boolean;
    needsDateTime: boolean;
    needsRealTimeInfo: boolean;
    categories: string[];
    confidence: number;
  }> {
    // First, do a quick local analysis to filter out obvious non-web-search queries
    const localAnalysis = this.quickLocalAnalysis(query);
    
    // If local analysis is confident that no web search is needed, skip expensive AI analysis
    if (localAnalysis.confidence > 0.8 && !localAnalysis.likelyNeedsWebSearch) {
      console.log('💰 Cost optimization: Skipping AI intent analysis - local analysis sufficient');
      return {
        needsWebSearch: false,
        needsCalculation: localAnalysis.needsCalculation,
        needsDateTime: localAnalysis.needsDateTime,
        needsRealTimeInfo: false,
        categories: localAnalysis.categories,
        confidence: localAnalysis.confidence,
      };
    }

    // Only use AI analysis for ambiguous queries or those likely needing web search
    const intentPrompt = `
Analyze this query to determine if it REQUIRES current/real-time information that GPT-4o wouldn't know:

Query: "${query}"

IMPORTANT: Only set needsWebSearch=true if the query absolutely REQUIRES:
- Current news, events, or breaking news
- Live data (stock prices, weather, sports scores)
- Recent information after GPT-4o's training cutoff
- Specific current facts that change frequently

General knowledge questions, explanations, how-to guides, and most educational content should NOT need web search.

Respond with JSON only:
{
  "needsWebSearch": boolean,
  "needsCalculation": boolean,
  "needsDateTime": boolean,
  "needsRealTimeInfo": boolean,
  "categories": ["category"],
  "reasoning": "brief explanation"
}`;

    try {
      const response = await this.openAIService.sendSingleMessage(intentPrompt, {
        max_tokens: 150,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          console.log('🧠 AI Intent analysis:', result.reasoning);
          return { ...result, confidence: 0.9 };
        }
      }
    } catch (error) {
      console.error('Intent analysis failed, using fallback:', error);
    }

    // Fallback: Enhanced keyword-based analysis
    return this.enhancedFallbackAnalysis(query);
  }

  /**
   * Quick local analysis to avoid expensive API calls for obvious cases
   */
  private quickLocalAnalysis(query: string): {
    likelyNeedsWebSearch: boolean;
    needsCalculation: boolean;
    needsDateTime: boolean;
    categories: string[];
    confidence: number;
  } {
    const lowerQuery = query.toLowerCase();

    // High-confidence indicators that DON'T need web search
    const noWebSearchPatterns = [
      // Educational/explanation queries
      /^(what is|explain|how do|how does|why do|why does|define|describe)/,
      // Programming/technical help
      /(code|function|algorithm|programming|javascript|python|react|css)/,
      // Math/calculations
      /(calculate|compute|math|equation|\+|\-|\*|\/|\=)/,
      // General knowledge
      /(history of|theory|concept|principle|meaning)/,
      // How-to guides
      /(how to|tutorial|guide|steps to|instructions)/,
    ];

    // Strong indicators that DO need web search
    const webSearchRequired = [
      // Real-time data
      /(current|today|now|latest|recent|breaking)/,
      // Live information
      /(weather|temperature|stock price|news|score|result)/,
      // Time-sensitive queries
      /(happening|event|update|announcement)/,
    ];

    let confidence = 0.5;
    let likelyNeedsWebSearch = false;
    let needsCalculation = false;
    let needsDateTime = false;

    // Check for high-confidence no-web-search patterns
    if (noWebSearchPatterns.some(pattern => pattern.test(lowerQuery))) {
      confidence = 0.9;
      likelyNeedsWebSearch = false;
    }

    // Check for web search required patterns
    if (webSearchRequired.some(pattern => pattern.test(lowerQuery))) {
      confidence = 0.9;
      likelyNeedsWebSearch = true;
    }

    // Check for calculations
    const calculationIndicators = ['calculate', 'compute', 'math', '+', '-', '*', '/', '=', '%'];
    if (calculationIndicators.some(indicator => lowerQuery.includes(indicator))) {
      needsCalculation = true;
      confidence = Math.max(confidence, 0.8);
    }

    // Check for date/time queries
    const timeIndicators = ['time', 'date', 'today', 'when', 'schedule'];
    if (timeIndicators.some(indicator => lowerQuery.includes(indicator))) {
      needsDateTime = true;
      confidence = Math.max(confidence, 0.8);
    }

    return {
      likelyNeedsWebSearch,
      needsCalculation,
      needsDateTime,
      categories: this.categorizeQuery(lowerQuery),
      confidence,
    };
  }

  /**
   * Enhanced fallback analysis with better real-time detection
   */
  private enhancedFallbackAnalysis(query: string): {
    needsWebSearch: boolean;
    needsCalculation: boolean;
    needsDateTime: boolean;
    needsRealTimeInfo: boolean;
    categories: string[];
    confidence: number;
  } {
    const lowerQuery = query.toLowerCase();

    // Very specific real-time indicators (high precision)
    const realTimeKeywords = [
      'today', 'current weather', 'latest news', 'now', 'breaking news',
      'stock price', 'live score', 'current temperature', 'today\'s weather'
    ];
    
    const calculationKeywords = ['calculate', 'compute', 'math', 'add', 'subtract', 'multiply', 'divide', '+', '-', '*', '/', '='];
    const dateTimeKeywords = ['time', 'date', 'when', 'schedule', 'calendar', 'tomorrow', 'yesterday'];
    
    // Be more conservative about web search - only for clearly real-time needs
    const needsRealTimeInfo = realTimeKeywords.some(keyword => lowerQuery.includes(keyword));
    
    return {
      needsWebSearch: needsRealTimeInfo, // Only search for real-time info
      needsCalculation: calculationKeywords.some(keyword => lowerQuery.includes(keyword)),
      needsDateTime: dateTimeKeywords.some(keyword => lowerQuery.includes(keyword)),
      needsRealTimeInfo: needsRealTimeInfo,
      categories: this.categorizeQuery(lowerQuery),
      confidence: 0.7,
    };
  }

  /**
   * Categorize the query for better tool selection
   */
  private categorizeQuery(query: string): string[] {
    const categories: string[] = [];
    
    if (query.match(/\b(news|politics|election|government)\b/)) categories.push('news');
    if (query.match(/\b(stock|finance|market|price|trading)\b/)) categories.push('finance');
    if (query.match(/\b(weather|temperature|rain|snow|climate)\b/)) categories.push('weather');
    if (query.match(/\b(science|research|study|technology)\b/)) categories.push('science');
    if (query.match(/\b(sports|game|score|team|player)\b/)) categories.push('sports');
    if (query.match(/\b(entertainment|movie|music|celebrity)\b/)) categories.push('entertainment');
    
    return categories.length > 0 ? categories : ['general'];
  }

  /**
   * Gather information using selected tools
   */
  private async gatherInformation(query: string, intent: any): Promise<AgentContext> {
    const context: AgentContext = {
      originalQuery: query,
      gatheredInfo: [],
      toolsUsed: [],
      timestamp: new Date(),
    };

    // Execute tools based on intent analysis
    for (const tool of this.tools) {
      if (this.shouldUseTool(tool, intent, query)) {
        try {
          console.log(`🔧 Using tool: ${tool.name}`);
          
          // Track usage for cost monitoring
          if (tool.name === 'TavilySearch') {
            this.usageStats.webSearches++;
            console.log('💸 Tavily API call initiated - estimated cost: $0.003');
          } else if (tool.name === 'Calculator') {
            this.usageStats.calculations++;
          } else if (tool.name === 'DateTime') {
            this.usageStats.dateTimeQueries++;
          }
          
          const result = await tool.execute(query);
          
          context.gatheredInfo.push({
            source: tool.name,
            content: result,
            relevance: this.calculateRelevance(result, query),
          });
          
          context.toolsUsed.push(tool.name);
        } catch (error) {
          console.error(`Tool ${tool.name} failed:`, error);
        }
      }
    }

    return context;
  }

  /**
   * Determine if a specific tool should be used
   */
  private shouldUseTool(tool: Tool, intent: any, query: string): boolean {
    // Use the tool's own shouldActivate method first
    if (tool.shouldActivate(query)) {
      return true;
    }

    // Additional logic based on intent analysis
    switch (tool.name) {
      case 'TavilySearch':
        return intent.needsWebSearch || intent.needsRealTimeInfo;
      case 'Calculator':
        return intent.needsCalculation;
      case 'DateTime':
        return intent.needsDateTime;
      default:
        return false;
    }
  }

  /**
   * Calculate relevance score for gathered information
   */
  private calculateRelevance(content: string, query: string): number {
    const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
    const contentWords = content.toLowerCase().split(' ');
    
    let matches = 0;
    for (const queryWord of queryWords) {
      if (contentWords.some(contentWord => contentWord.includes(queryWord))) {
        matches++;
      }
    }
    
    return queryWords.length > 0 ? matches / queryWords.length : 0;
  }

  /**
   * Synthesize gathered information into an enhanced prompt
   */
  private async synthesizeContext(originalQuery: string, context: AgentContext): Promise<string> {
    if (context.gatheredInfo.length === 0) {
      // No additional information gathered, but still enhance the prompt for better responses
      return `
User Query: ${originalQuery}

Instructions: Please provide a comprehensive, well-structured, and detailed response to this query. Include:
- Clear explanations with examples where helpful
- Step-by-step guidance if applicable
- Best practices and important considerations
- Additional context that would be valuable to the user
- Proper formatting with headings and bullet points for readability`;
    }

    // Sort gathered information by relevance
    const sortedInfo = context.gatheredInfo
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5); // Take top 5 most relevant pieces

    // Create enhanced prompt with context
    const contextSections = sortedInfo.map((info, index) => 
      `### ${info.source} Information:
${info.content}
`
    ).join('\n');

    const enhancedPrompt = `
User Query: ${originalQuery}

## Additional Context Information
The following information was gathered from ${context.toolsUsed.join(', ')} to provide you with current and accurate data:

${contextSections}

## Instructions
Please provide a comprehensive, well-structured response that:
- Integrates the above context information seamlessly with your knowledge
- Uses clear headings, bullet points, and formatting for optimal readability
- Provides detailed explanations with practical examples
- Cites sources when using the gathered information
- Includes additional valuable context or recommendations
- Maintains a helpful, pedagogical tone throughout

If any gathered information seems outdated or contradictory, please note this and provide your assessment.`;

    return enhancedPrompt;
  }

  /**
   * Add a new tool to the agent
   */
  addTool(tool: Tool): void {
    this.tools.push(tool);
  }

  /**
   * Remove a tool from the agent
   */
  removeTool(toolName: string): void {
    this.tools = this.tools.filter(tool => tool.name !== toolName);
  }

  /**
   * Get list of available tools
   */
  getAvailableTools(): string[] {
    return this.tools.map(tool => tool.name);
  }

  /**
   * Get usage statistics and cost information
   */
  getUsageStats(): {
    totalQueries: number;
    webSearches: number;
    calculations: number;
    dateTimeQueries: number;
    costSaved: number;
    estimatedCostSavings: string;
    webSearchUsageRate: string;
  } {
    const webSearchRate = this.usageStats.totalQueries > 0 
      ? (this.usageStats.webSearches / this.usageStats.totalQueries * 100).toFixed(1)
      : '0';
    
    const estimatedSavings = (this.usageStats.costSaved * 0.003).toFixed(3);

    return {
      ...this.usageStats,
      estimatedCostSavings: `$${estimatedSavings}`,
      webSearchUsageRate: `${webSearchRate}%`,
    };
  }

  /**
   * Reset usage statistics
   */
  resetUsageStats(): void {
    this.usageStats = {
      totalQueries: 0,
      webSearches: 0,
      calculations: 0,
      dateTimeQueries: 0,
      costSaved: 0,
    };
  }

  /**
   * Log usage summary
   */
  logUsageSummary(): void {
    const stats = this.getUsageStats();
    console.log('📊 AI Agent Usage Summary:', {
      totalQueries: stats.totalQueries,
      webSearches: stats.webSearches,
      webSearchRate: stats.webSearchUsageRate,
      estimatedCostSavings: stats.estimatedCostSavings,
      calculations: stats.calculations,
      dateTimeQueries: stats.dateTimeQueries,
    });
  }
}