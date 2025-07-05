import { Platform } from 'react-native';

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

interface MemoryInfo {
  used: number;
  total: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private memorySnapshots: MemoryInfo[] = [];
  private maxSnapshots = 50;
  private isEnabled = __DEV__;

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public startTimer(name: string, metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      metadata,
    };

    this.metrics.set(name, metric);
  }

  public endTimer(name: string): number | null {
    if (!this.isEnabled) return null;

    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Performance timer "${name}" was not started`);
      return null;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;

    console.log(`⚡ Performance: ${name} took ${metric.duration.toFixed(2)}ms`, metric.metadata);

    return metric.duration;
  }

  public measureAsync<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    if (!this.isEnabled) return fn();

    this.startTimer(name, metadata);
    return fn().finally(() => {
      this.endTimer(name);
    });
  }

  public measureSync<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    if (!this.isEnabled) return fn();

    this.startTimer(name, metadata);
    try {
      return fn();
    } finally {
      this.endTimer(name);
    }
  }

  public markEvent(name: string, metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;

    console.log(`📍 Event: ${name}`, {
      timestamp: performance.now(),
      ...metadata,
    });
  }

  public takeMemorySnapshot(): void {
    if (!this.isEnabled) return;

    try {
      // Note: React Native doesn't have direct memory APIs
      // This is a placeholder for native bridge calls
      const memoryInfo: MemoryInfo = {
        used: 0, // Would need native implementation
        total: 0, // Would need native implementation
        timestamp: Date.now(),
      };

      this.memorySnapshots.push(memoryInfo);

      // Keep only the last N snapshots
      if (this.memorySnapshots.length > this.maxSnapshots) {
        this.memorySnapshots.shift();
      }

      console.log('📊 Memory snapshot taken', memoryInfo);
    } catch (error) {
      console.error('Failed to take memory snapshot:', error);
    }
  }

  public getMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  public getCompletedMetrics(): PerformanceMetric[] {
    return this.getMetrics().filter(metric => metric.duration !== undefined);
  }

  public getAverageTime(name: string): number | null {
    const matchingMetrics = this.getCompletedMetrics().filter(metric => metric.name === name);
    
    if (matchingMetrics.length === 0) return null;

    const totalTime = matchingMetrics.reduce((sum, metric) => sum + (metric.duration || 0), 0);
    return totalTime / matchingMetrics.length;
  }

  public getSlowestMetrics(count = 5): PerformanceMetric[] {
    return this.getCompletedMetrics()
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, count);
  }

  public getMemorySnapshots(): MemoryInfo[] {
    return [...this.memorySnapshots];
  }

  public clearMetrics(): void {
    this.metrics.clear();
    this.memorySnapshots.length = 0;
  }

  public logSummary(): void {
    if (!this.isEnabled) return;

    const completed = this.getCompletedMetrics();
    const slowest = this.getSlowestMetrics(3);

    console.group('📈 Performance Summary');
    console.log(`Total metrics: ${completed.length}`);
    console.log('Slowest operations:');
    slowest.forEach(metric => {
      console.log(`  ${metric.name}: ${metric.duration?.toFixed(2)}ms`);
    });
    console.groupEnd();
  }

  // Component lifecycle tracking
  public trackComponentRender(componentName: string, renderCount?: number): void {
    this.markEvent('component_render', {
      component: componentName,
      renderCount,
      platform: Platform.OS,
    });
  }

  public trackComponentMount(componentName: string): void {
    this.markEvent('component_mount', {
      component: componentName,
      platform: Platform.OS,
    });
  }

  public trackComponentUnmount(componentName: string): void {
    this.markEvent('component_unmount', {
      component: componentName,
      platform: Platform.OS,
    });
  }

  // Navigation tracking
  public trackNavigation(from: string, to: string, params?: any): void {
    this.markEvent('navigation', {
      from,
      to,
      params: params ? Object.keys(params) : undefined,
    });
  }

  // API call tracking
  public trackAPICall(endpoint: string, method: string, duration?: number): void {
    this.markEvent('api_call', {
      endpoint,
      method,
      duration,
    });
  }

  // Audio operation tracking
  public trackAudioOperation(operation: string, duration?: number, fileSize?: number): void {
    this.markEvent('audio_operation', {
      operation,
      duration,
      fileSize,
    });
  }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

export { performanceMonitor };

// Convenience functions
export const startTimer = (name: string, metadata?: Record<string, any>) => 
  performanceMonitor.startTimer(name, metadata);

export const endTimer = (name: string) => 
  performanceMonitor.endTimer(name);

export const measureAsync = <T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>) => 
  performanceMonitor.measureAsync(name, fn, metadata);

export const measureSync = <T>(name: string, fn: () => T, metadata?: Record<string, any>) => 
  performanceMonitor.measureSync(name, fn, metadata);

export const markEvent = (name: string, metadata?: Record<string, any>) => 
  performanceMonitor.markEvent(name, metadata);

export const trackComponentRender = (componentName: string, renderCount?: number) => 
  performanceMonitor.trackComponentRender(componentName, renderCount);

export const trackNavigation = (from: string, to: string, params?: any) => 
  performanceMonitor.trackNavigation(from, to, params);

// React hook for component performance tracking
export function usePerformanceTracking(componentName: string) {
  React.useEffect(() => {
    performanceMonitor.trackComponentMount(componentName);
    
    return () => {
      performanceMonitor.trackComponentUnmount(componentName);
    };
  }, [componentName]);

  const trackRender = React.useCallback((renderCount?: number) => {
    performanceMonitor.trackComponentRender(componentName, renderCount);
  }, [componentName]);

  return { trackRender };
}

// React import (this would normally be at the top)
import React from 'react';