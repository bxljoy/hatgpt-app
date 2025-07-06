import { Tool } from '../AIAgentService';

export class DateTimeTool implements Tool {
  name = 'DateTime';
  description = 'Provide current date, time, and time-related calculations';

  shouldActivate(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    
    const timeKeywords = [
      'time', 'date', 'today', 'tomorrow', 'yesterday',
      'when', 'schedule', 'calendar', 'now', 'current time',
      'what day', 'what month', 'what year', 'timezone',
      'how long', 'duration', 'days until', 'weeks until',
      'days ago', 'weeks ago', 'months ago', 'years ago',
      'birthday', 'anniversary', 'deadline'
    ];

    return timeKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  async execute(query: string): Promise<string> {
    try {
      console.log('📅 Executing date/time query for:', query);

      const lowerQuery = query.toLowerCase();
      const now = new Date();

      // Determine what kind of date/time information is needed
      if (lowerQuery.includes('current time') || lowerQuery.includes('what time')) {
        return this.getCurrentTime(now);
      } else if (lowerQuery.includes('today') || lowerQuery.includes('current date') || lowerQuery.includes('what date')) {
        return this.getCurrentDate(now);
      } else if (lowerQuery.includes('tomorrow')) {
        return this.getTomorrowDate(now);
      } else if (lowerQuery.includes('yesterday')) {
        return this.getYesterdayDate(now);
      } else if (lowerQuery.includes('day of week') || lowerQuery.includes('what day')) {
        return this.getDayOfWeek(now);
      } else if (lowerQuery.includes('timezone')) {
        return this.getTimezoneInfo(now);
      } else if (lowerQuery.includes('days until') || lowerQuery.includes('weeks until')) {
        return this.calculateTimeUntil(query, now);
      } else if (lowerQuery.includes('days ago') || lowerQuery.includes('weeks ago') || lowerQuery.includes('months ago')) {
        return this.calculateTimeAgo(query, now);
      } else {
        return this.getFullDateTime(now);
      }

    } catch (error) {
      console.error('DateTime tool error:', error);
      return `Unable to process date/time query. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Get current time formatted nicely
   */
  private getCurrentTime(now: Date): string {
    const timeString = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return `Current Time: ${timeString}\nTimezone: ${timezone}`;
  }

  /**
   * Get current date formatted nicely
   */
  private getCurrentDate(now: Date): string {
    const dateString = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `Today's Date: ${dateString}`;
  }

  /**
   * Get tomorrow's date
   */
  private getTomorrowDate(now: Date): string {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateString = tomorrow.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `Tomorrow: ${dateString}`;
  }

  /**
   * Get yesterday's date
   */
  private getYesterdayDate(now: Date): string {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateString = yesterday.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `Yesterday: ${dateString}`;
  }

  /**
   * Get day of the week
   */
  private getDayOfWeek(now: Date): string {
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    return `Today is ${dayName}`;
  }

  /**
   * Get timezone information
   */
  private getTimezoneInfo(now: Date): string {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -now.getTimezoneOffset() / 60;
    const offsetString = offset >= 0 ? `+${offset}` : `${offset}`;

    return `Timezone: ${timezone}\nUTC Offset: ${offsetString} hours`;
  }

  /**
   * Get full date and time information
   */
  private getFullDateTime(now: Date): string {
    const fullDateTime = now.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return `Current Date & Time: ${fullDateTime}\nTimezone: ${timezone}`;
  }

  /**
   * Calculate time until a future event
   */
  private calculateTimeUntil(query: string, now: Date): string {
    // Try to extract date from query
    const dateMatch = this.extractDateFromQuery(query);
    
    if (dateMatch) {
      const targetDate = new Date(dateMatch);
      if (!isNaN(targetDate.getTime())) {
        const timeDiff = targetDate.getTime() - now.getTime();
        const days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        
        if (days > 0) {
          return `Days until ${dateMatch}: ${days} days`;
        } else if (days === 0) {
          return `${dateMatch} is today!`;
        } else {
          return `${dateMatch} was ${Math.abs(days)} days ago`;
        }
      }
    }

    // If no specific date found, provide general guidance
    return 'To calculate days until an event, please specify the target date (e.g., "days until December 25, 2024")';
  }

  /**
   * Calculate time since a past event
   */
  private calculateTimeAgo(query: string, now: Date): string {
    const dateMatch = this.extractDateFromQuery(query);
    
    if (dateMatch) {
      const pastDate = new Date(dateMatch);
      if (!isNaN(pastDate.getTime())) {
        const timeDiff = now.getTime() - pastDate.getTime();
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        
        if (days > 0) {
          const years = Math.floor(days / 365);
          const months = Math.floor((days % 365) / 30);
          const remainingDays = days % 30;

          let result = `Time since ${dateMatch}: `;
          if (years > 0) result += `${years} year${years > 1 ? 's' : ''}, `;
          if (months > 0) result += `${months} month${months > 1 ? 's' : ''}, `;
          result += `${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;

          return result;
        } else {
          return `${dateMatch} is in the future`;
        }
      }
    }

    return 'To calculate time since an event, please specify the past date (e.g., "days ago from January 1, 2024")';
  }

  /**
   * Extract date from natural language query
   */
  private extractDateFromQuery(query: string): string | null {
    // Look for common date patterns
    const datePatterns = [
      // MM/DD/YYYY or MM-DD-YYYY
      /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/,
      // Month DD, YYYY
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i,
      // DD Month YYYY
      /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i,
      // YYYY-MM-DD
      /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/,
    ];

    for (const pattern of datePatterns) {
      const match = query.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  /**
   * Get week number of the year
   */
  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Check if a year is a leap year
   */
  private isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }
}