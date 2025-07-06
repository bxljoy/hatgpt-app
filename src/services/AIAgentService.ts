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

    // Step 1: Intent Analysis - Determine what tools might be needed
    const intent = await this.analyzeIntent(query);
    console.log('🧠 Intent analysis:', intent);

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
    const response = await this.openAIService.sendMessageWithContext(
      enhancedPrompt,
      conversationId,
      systemPrompt
    );

    if (response.choices[0]?.message?.content) {
      return response.choices[0].message.content;
    }

    throw new Error('Failed to generate AI response');
  }

  /**
   * Analyze user intent to determine which tools to use
   */
  private async analyzeIntent(query: string): Promise<{
    needsWebSearch: boolean;
    needsCalculation: boolean;
    needsDateTime: boolean;
    needsRealTimeInfo: boolean;
    categories: string[];
  }> {
    const intentPrompt = `
Analyze this user query and determine what tools might be needed to answer it comprehensively:

Query: "${query}"

Consider:
1. Does it need current/real-time information? (news, stocks, weather, recent events)
2. Does it need web search for factual information?
3. Does it need mathematical calculations?
4. Does it need current date/time information?
5. What categories does this query fall into?

Respond with a JSON object only:
{
  "needsWebSearch": boolean,
  "needsCalculation": boolean,
  "needsDateTime": boolean,
  "needsRealTimeInfo": boolean,
  "categories": ["category1", "category2"]
}`;

    try {
      const response = await this.openAIService.sendSingleMessage(intentPrompt, {
        max_tokens: 200,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (error) {
      console.error('Intent analysis failed:', error);
    }

    // Fallback: Simple keyword-based analysis
    return this.fallbackIntentAnalysis(query);
  }

  /**
   * Fallback intent analysis using keyword matching
   */
  private fallbackIntentAnalysis(query: string): {
    needsWebSearch: boolean;
    needsCalculation: boolean;
    needsDateTime: boolean;
    needsRealTimeInfo: boolean;
    categories: string[];
  } {
    const lowerQuery = query.toLowerCase();

    const realTimeKeywords = ['today', 'current', 'latest', 'now', 'recent', 'news', 'stock', 'weather', 'price'];
    const calculationKeywords = ['calculate', 'compute', 'math', 'add', 'subtract', 'multiply', 'divide', '+', '-', '*', '/', '='];
    const dateTimeKeywords = ['time', 'date', 'when', 'schedule', 'calendar', 'tomorrow', 'yesterday'];
    const searchKeywords = ['what is', 'who is', 'how to', 'explain', 'define', 'information about'];

    return {
      needsWebSearch: searchKeywords.some(keyword => lowerQuery.includes(keyword)) || 
                     realTimeKeywords.some(keyword => lowerQuery.includes(keyword)),
      needsCalculation: calculationKeywords.some(keyword => lowerQuery.includes(keyword)),
      needsDateTime: dateTimeKeywords.some(keyword => lowerQuery.includes(keyword)),
      needsRealTimeInfo: realTimeKeywords.some(keyword => lowerQuery.includes(keyword)),
      categories: this.categorizeQuery(lowerQuery),
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
      // No additional information gathered, return original query
      return originalQuery;
    }

    // Sort gathered information by relevance
    const sortedInfo = context.gatheredInfo
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5); // Take top 5 most relevant pieces

    // Create enhanced prompt with context
    const contextSections = sortedInfo.map(info => 
      `[${info.source}]: ${info.content}`
    ).join('\n\n');

    const enhancedPrompt = `
User Query: ${originalQuery}

Additional Context (gathered from ${context.toolsUsed.join(', ')}):
${contextSections}

Please provide a comprehensive answer to the user's query using the above context information. Prioritize accuracy and cite sources when relevant. If the context information is not directly related to the query, you may use your general knowledge while noting what information comes from external sources.`;

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
}