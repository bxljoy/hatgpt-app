import { Tool } from '../AIAgentService';

export class CalculatorTool implements Tool {
  name = 'Calculator';
  description = 'Perform mathematical calculations and solve equations';

  shouldActivate(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    
    // Look for mathematical indicators
    const mathKeywords = [
      'calculate', 'compute', 'solve', 'math', 'equation',
      'add', 'subtract', 'multiply', 'divide', 'percentage',
      'square root', 'power', 'factorial', 'sum', 'average'
    ];

    const mathSymbols = ['+', '-', '*', '/', '=', '%', '^', '√'];
    
    // Check for math keywords
    const hasKeywords = mathKeywords.some(keyword => lowerQuery.includes(keyword));
    
    // Check for math symbols
    const hasSymbols = mathSymbols.some(symbol => query.includes(symbol));
    
    // Check for number patterns (e.g., "what is 2 + 2")
    const numberPattern = /\b\d+(\.\d+)?\s*[+\-*/^%]\s*\d+(\.\d+)?\b/;
    const hasNumberPattern = numberPattern.test(query);

    return hasKeywords || hasSymbols || hasNumberPattern;
  }

  async execute(query: string): Promise<string> {
    try {
      console.log('🧮 Executing calculation for:', query);

      // Try to extract and evaluate mathematical expressions
      const result = this.evaluateExpression(query);
      
      if (result !== null) {
        return `Calculation Result: ${result}\n\nExpression evaluated from: "${query}"`;
      } else {
        // If no direct calculation possible, provide mathematical context
        return this.provideMathContext(query);
      }

    } catch (error) {
      console.error('Calculator error:', error);
      return `Unable to perform calculation. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Extract and evaluate mathematical expressions from text
   */
  private evaluateExpression(query: string): number | null {
    // Clean the query and extract numbers and operators
    const cleanQuery = query.replace(/[^\d+\-*/().\s]/g, ' ');
    
    // Look for simple mathematical expressions
    const patterns = [
      // Basic arithmetic: "2 + 3", "10 * 5", etc.
      /(\d+(?:\.\d+)?)\s*([+\-*/])\s*(\d+(?:\.\d+)?)/g,
      // Percentage: "20% of 100", "15 percent of 200"
      /(\d+(?:\.\d+)?)\s*(?:percent|%)\s*of\s*(\d+(?:\.\d+)?)/gi,
      // Power: "2 to the power of 3", "2^3"
      /(\d+(?:\.\d+)?)\s*(?:to\s+the\s+power\s+of|\^)\s*(\d+(?:\.\d+)?)/gi,
      // Square root: "square root of 16", "√16"
      /(?:square\s+root\s+of|√)\s*(\d+(?:\.\d+)?)/gi,
    ];

    for (const pattern of patterns) {
      const matches = Array.from(query.matchAll(pattern));
      if (matches.length > 0) {
        const match = matches[0];
        return this.calculateFromMatch(match, pattern);
      }
    }

    // Try to evaluate as a simple expression
    try {
      const expression = this.extractExpression(query);
      if (expression) {
        return this.safeEval(expression);
      }
    } catch (error) {
      console.error('Expression evaluation failed:', error);
    }

    return null;
  }

  /**
   * Calculate result from regex match
   */
  private calculateFromMatch(match: RegExpMatchArray, pattern: RegExp): number | null {
    const patternString = pattern.toString();

    if (patternString.includes('percent|%')) {
      // Percentage calculation
      const percentage = parseFloat(match[1]);
      const base = parseFloat(match[2]);
      return (percentage / 100) * base;
    } else if (patternString.includes('power|\\^')) {
      // Power calculation
      const base = parseFloat(match[1]);
      const exponent = parseFloat(match[2]);
      return Math.pow(base, exponent);
    } else if (patternString.includes('square\\s+root|√')) {
      // Square root calculation
      const number = parseFloat(match[1]);
      return Math.sqrt(number);
    } else if (match.length >= 4) {
      // Basic arithmetic
      const num1 = parseFloat(match[1]);
      const operator = match[2];
      const num2 = parseFloat(match[3]);

      switch (operator) {
        case '+': return num1 + num2;
        case '-': return num1 - num2;
        case '*': return num1 * num2;
        case '/': return num2 !== 0 ? num1 / num2 : null;
        default: return null;
      }
    }

    return null;
  }

  /**
   * Extract a clean mathematical expression from text
   */
  private extractExpression(query: string): string | null {
    // Remove words and keep only numbers, operators, and parentheses
    const expression = query
      .replace(/[a-zA-Z]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s/g, '');

    // Validate that it looks like a mathematical expression
    if (/^[\d+\-*/().\s]+$/.test(expression) && /\d/.test(expression)) {
      return expression;
    }

    return null;
  }

  /**
   * Safely evaluate mathematical expressions
   */
  private safeEval(expression: string): number | null {
    try {
      // Basic security: only allow numbers, operators, and parentheses
      if (!/^[\d+\-*/().\s]+$/.test(expression)) {
        return null;
      }

      // Remove any potential dangerous characters
      const cleaned = expression.replace(/[^0-9+\-*/().\s]/g, '');
      
      // Use Function constructor for safer evaluation than eval()
      const result = new Function(`"use strict"; return (${cleaned})`)();
      
      return typeof result === 'number' && !isNaN(result) ? result : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Provide mathematical context when direct calculation isn't possible
   */
  private provideMathContext(query: string): string {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('factorial')) {
      return 'For factorial calculations, use the format "factorial of n" or "n!" where n is a positive integer.';
    } else if (lowerQuery.includes('average') || lowerQuery.includes('mean')) {
      return 'To calculate an average, provide the numbers you want to average. Example: "average of 10, 20, 30"';
    } else if (lowerQuery.includes('percentage')) {
      return 'For percentage calculations, use formats like "20% of 100" or "what percentage is 25 of 100"';
    } else if (lowerQuery.includes('square root')) {
      return 'For square root calculations, use "square root of [number]" format.';
    } else {
      return 'I can help with basic arithmetic (+, -, *, /), percentages, square roots, and powers. Please provide a clear mathematical expression.';
    }
  }

  /**
   * Format calculation results nicely
   */
  private formatResult(result: number): string {
    // Round to reasonable precision
    if (Number.isInteger(result)) {
      return result.toString();
    } else {
      return parseFloat(result.toFixed(10)).toString();
    }
  }
}