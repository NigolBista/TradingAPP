/**
 * Performance testing harness for StockDetail screen optimization
 */

import { performanceMonitor } from './performanceMonitor';

interface TestScenario {
  name: string;
  description: string;
  symbolsToTest: string[];
  testDurationMs: number;
  expectedUpdatesPerSecond: number;
}

interface TestResults {
  scenario: string;
  timestamp: string;
  websocketPerformance: {
    averageLatency: number;
    messagesPerSecond: number;
    droppedUpdates: number;
    reconnects: number;
  };
  renderingPerformance: {
    averageRenderTime: number;
    slowRenders: number;
    updatesApplied: number;
  };
  memoryUsage: {
    peakUsage?: number;
    averageUsage?: number;
  };
  userExperience: {
    timeToFirstRender: number;
    priceUpdateLatency: number;
  };
  overallScore: number;
}

class PerformanceTestHarness {
  private testResults: TestResults[] = [];

  /**
   * Standard test scenarios for StockDetail performance
   */
  private readonly testScenarios: TestScenario[] = [
    {
      name: 'single_symbol_light',
      description: 'Single symbol with light update frequency',
      symbolsToTest: ['AAPL'],
      testDurationMs: 30000, // 30 seconds
      expectedUpdatesPerSecond: 1,
    },
    {
      name: 'single_symbol_heavy',
      description: 'Single symbol with heavy update frequency',
      symbolsToTest: ['AAPL'],
      testDurationMs: 60000, // 1 minute
      expectedUpdatesPerSecond: 10,
    },
    {
      name: 'multiple_symbols',
      description: 'Multiple symbols with moderate update frequency',
      symbolsToTest: ['AAPL', 'GOOGL', 'MSFT', 'TSLA'],
      testDurationMs: 45000, // 45 seconds
      expectedUpdatesPerSecond: 5,
    },
    {
      name: 'stress_test',
      description: 'High frequency updates to stress test the system',
      symbolsToTest: ['AAPL'],
      testDurationMs: 30000,
      expectedUpdatesPerSecond: 50,
    },
  ];

  /**
   * Run a comprehensive performance test
   */
  async runTest(scenarioName?: string): Promise<TestResults[]> {
    const scenarios = scenarioName
      ? this.testScenarios.filter(s => s.name === scenarioName)
      : this.testScenarios;

    console.log(`🚀 Starting performance test with ${scenarios.length} scenarios`);

    for (const scenario of scenarios) {
      console.log(`\n📊 Running scenario: ${scenario.name}`);
      console.log(`   Description: ${scenario.description}`);
      console.log(`   Duration: ${scenario.testDurationMs / 1000}s`);
      console.log(`   Symbols: ${scenario.symbolsToTest.join(', ')}`);

      const result = await this.runScenario(scenario);
      this.testResults.push(result);

      console.log(`✅ Scenario completed with score: ${result.overallScore.toFixed(2)}/100`);
    }

    return this.testResults;
  }

  /**
   * Run a single test scenario
   */
  private async runScenario(scenario: TestScenario): Promise<TestResults> {
    // Clear previous metrics
    performanceMonitor.clear();

    // Start monitoring
    performanceMonitor.startWebSocketMonitoring();
    performanceMonitor.startRenderMonitoring();
    performanceMonitor.startTiming('time_to_first_render');

    // Simulate the test scenario
    await this.simulateScenario(scenario);

    // Collect final metrics
    const metrics = performanceMonitor.getMetrics();

    // Calculate overall performance score
    const score = this.calculatePerformanceScore(metrics, scenario);

    const result: TestResults = {
      scenario: scenario.name,
      timestamp: new Date().toISOString(),
      websocketPerformance: {
        averageLatency: metrics.websocket.averageLatency,
        messagesPerSecond: metrics.websocket.messagesPerSecond,
        droppedUpdates: metrics.websocket.droppedUpdates,
        reconnects: metrics.websocket.reconnectCount,
      },
      renderingPerformance: {
        averageRenderTime: metrics.rendering.averageRenderTime,
        slowRenders: metrics.rendering.slowRenders,
        updatesApplied: metrics.rendering.priceUpdatesApplied,
      },
      memoryUsage: {
        peakUsage: metrics.rendering.memoryUsage,
        averageUsage: metrics.rendering.memoryUsage,
      },
      userExperience: {
        timeToFirstRender: metrics.userExperience.timeToFirstRender,
        priceUpdateLatency: metrics.userExperience.priceUpdateLatency,
      },
      overallScore: score,
    };

    return result;
  }

  /**
   * Simulate a test scenario with mock data
   */
  private async simulateScenario(scenario: TestScenario): Promise<void> {
    const { testDurationMs, expectedUpdatesPerSecond, symbolsToTest } = scenario;
    const updateIntervalMs = 1000 / expectedUpdatesPerSecond;

    let updateCount = 0;
    const maxUpdates = Math.floor(testDurationMs / updateIntervalMs);

    console.log(`   Simulating ${maxUpdates} updates over ${testDurationMs / 1000}s`);

    // Simulate first render
    await new Promise(resolve => setTimeout(resolve, 100));
    performanceMonitor.endTiming('time_to_first_render');

    // Simulate updates
    const interval = setInterval(() => {
      if (updateCount >= maxUpdates) {
        clearInterval(interval);
        return;
      }

      // Simulate WebSocket message
      const latency = Math.random() * 50 + 10; // 10-60ms latency
      performanceMonitor.recordWebSocketMessage(latency);
      performanceMonitor.recordPriceUpdateReceived();

      // Simulate render time (varies based on complexity)
      const baseRenderTime = 8 + Math.random() * 12; // 8-20ms base
      const complexityMultiplier = symbolsToTest.length * 0.5; // More symbols = slower
      const renderTime = baseRenderTime + complexityMultiplier;

      performanceMonitor.recordRender(renderTime);
      performanceMonitor.recordPriceUpdateApplied();

      // Occasionally simulate dropped updates under high load
      if (expectedUpdatesPerSecond > 20 && Math.random() < 0.1) {
        performanceMonitor.recordDroppedUpdate();
      }

      // Occasionally simulate throttled updates
      if (expectedUpdatesPerSecond > 10 && Math.random() < 0.15) {
        performanceMonitor.recordThrottledUpdate();
      }

      updateCount++;
    }, updateIntervalMs);

    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, testDurationMs));

    // Clean up
    clearInterval(interval);
  }

  /**
   * Calculate performance score (0-100)
   */
  private calculatePerformanceScore(metrics: any, scenario: TestScenario): number {
    let score = 100;

    // WebSocket performance (30 points)
    const latencyPenalty = Math.min(metrics.websocket.averageLatency / 100, 1) * 15;
    const dropPenalty = (metrics.websocket.droppedUpdates / 100) * 10;
    const reconnectPenalty = metrics.websocket.reconnectCount * 5;
    score -= latencyPenalty + dropPenalty + reconnectPenalty;

    // Rendering performance (40 points)
    const renderTimePenalty = Math.min(metrics.rendering.averageRenderTime / 16, 2) * 20;
    const slowRenderPenalty = Math.min(metrics.rendering.slowRenders / 10, 2) * 20;
    score -= renderTimePenalty + slowRenderPenalty;

    // User experience (30 points)
    const firstRenderPenalty = Math.min(metrics.userExperience.timeToFirstRender / 1000, 1) * 15;
    const updateLatencyPenalty = Math.min(metrics.userExperience.priceUpdateLatency / 200, 1) * 15;
    score -= firstRenderPenalty + updateLatencyPenalty;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Compare two test results
   */
  compareResults(beforeResults: TestResults[], afterResults: TestResults[]): {
    improvements: string[];
    regressions: string[];
    summary: string;
  } {
    const improvements: string[] = [];
    const regressions: string[] = [];

    for (let i = 0; i < Math.min(beforeResults.length, afterResults.length); i++) {
      const before = beforeResults[i];
      const after = afterResults[i];

      if (before.scenario !== after.scenario) continue;

      // Compare scores
      const scoreDiff = after.overallScore - before.overallScore;
      if (scoreDiff > 2) {
        improvements.push(`${after.scenario}: Overall score improved by ${scoreDiff.toFixed(1)} points`);
      } else if (scoreDiff < -2) {
        regressions.push(`${after.scenario}: Overall score decreased by ${Math.abs(scoreDiff).toFixed(1)} points`);
      }

      // Compare specific metrics
      const latencyDiff = after.websocketPerformance.averageLatency - before.websocketPerformance.averageLatency;
      if (latencyDiff < -5) {
        improvements.push(`${after.scenario}: WebSocket latency improved by ${Math.abs(latencyDiff).toFixed(1)}ms`);
      } else if (latencyDiff > 5) {
        regressions.push(`${after.scenario}: WebSocket latency increased by ${latencyDiff.toFixed(1)}ms`);
      }

      const renderDiff = after.renderingPerformance.averageRenderTime - before.renderingPerformance.averageRenderTime;
      if (renderDiff < -2) {
        improvements.push(`${after.scenario}: Render time improved by ${Math.abs(renderDiff).toFixed(1)}ms`);
      } else if (renderDiff > 2) {
        regressions.push(`${after.scenario}: Render time increased by ${renderDiff.toFixed(1)}ms`);
      }

      const dropDiff = after.websocketPerformance.droppedUpdates - before.websocketPerformance.droppedUpdates;
      if (dropDiff < -2) {
        improvements.push(`${after.scenario}: Dropped updates reduced by ${Math.abs(dropDiff)}`);
      } else if (dropDiff > 2) {
        regressions.push(`${after.scenario}: Dropped updates increased by ${dropDiff}`);
      }
    }

    const avgScoreBefore = beforeResults.reduce((sum, r) => sum + r.overallScore, 0) / beforeResults.length;
    const avgScoreAfter = afterResults.reduce((sum, r) => sum + r.overallScore, 0) / afterResults.length;
    const overallImprovement = avgScoreAfter - avgScoreBefore;

    const summary = `Overall performance ${overallImprovement > 0 ? 'improved' : 'decreased'} by ${Math.abs(overallImprovement).toFixed(1)} points (${avgScoreBefore.toFixed(1)} → ${avgScoreAfter.toFixed(1)})`;

    return { improvements, regressions, summary };
  }

  /**
   * Export results to JSON
   */
  exportResults(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      results: this.testResults,
      metadata: {
        platform: 'React Native',
        testVersion: '1.0.0',
      }
    }, null, 2);
  }

  /**
   * Clear all test results
   */
  clearResults(): void {
    this.testResults = [];
  }

  /**
   * Get current results
   */
  getResults(): TestResults[] {
    return [...this.testResults];
  }
}

// Global instance
export const performanceTestHarness = new PerformanceTestHarness();

// Utility function to run a quick baseline test
export async function runBaselineTest(scenarioName?: string): Promise<TestResults[]> {
  console.log('🔬 Running baseline performance test...');
  const results = await performanceTestHarness.runTest(scenarioName);

  console.log('\n📋 Baseline Test Results:');
  results.forEach(result => {
    console.log(`\n${result.scenario}:`);
    console.log(`  Overall Score: ${result.overallScore.toFixed(2)}/100`);
    console.log(`  WebSocket Latency: ${result.websocketPerformance.averageLatency.toFixed(2)}ms`);
    console.log(`  Render Time: ${result.renderingPerformance.averageRenderTime.toFixed(2)}ms`);
    console.log(`  Messages/sec: ${result.websocketPerformance.messagesPerSecond.toFixed(2)}`);
    console.log(`  Dropped Updates: ${result.websocketPerformance.droppedUpdates}`);
  });

  return results;
}