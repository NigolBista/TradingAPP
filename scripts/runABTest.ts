/**
 * Automated A/B performance testing script
 * Compares original vs optimized WebSocket implementation
 */

import { runBaselineTest } from '../src/utils/performanceTest';
import { performanceTestHarness } from '../src/utils/performanceTest';
import { enableOptimizedWebSocket, disableOptimizedWebSocket } from '../src/config/performanceConfig';

interface ABTestResults {
  timestamp: string;
  originalResults: any[];
  optimizedResults: any[];
  comparison: {
    improvements: string[];
    regressions: string[];
    summary: string;
  };
  performanceGains: {
    overallScoreImprovement: number;
    latencyImprovement: number;
    renderTimeImprovement: number;
    droppedUpdatesReduction: number;
  };
  recommendation: 'IMPLEMENT' | 'DO_NOT_IMPLEMENT' | 'NEEDS_MORE_TESTING';
}

async function runABPerformanceTest(): Promise<ABTestResults> {
  console.log('🧪 Starting A/B Performance Test');
  console.log('================================\n');

  // Step 1: Test original implementation
  console.log('📊 Testing Original Implementation...');
  disableOptimizedWebSocket();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for config to take effect

  const originalResults = await runBaselineTest();

  console.log('\n✅ Original implementation test completed');
  console.log(`   Average Score: ${(originalResults.reduce((sum, r) => sum + r.overallScore, 0) / originalResults.length).toFixed(2)}/100`);

  // Step 2: Test optimized implementation
  console.log('\n🚀 Testing Optimized Implementation...');
  enableOptimizedWebSocket();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for config to take effect

  const optimizedResults = await runBaselineTest();

  console.log('\n✅ Optimized implementation test completed');
  console.log(`   Average Score: ${(optimizedResults.reduce((sum, r) => sum + r.overallScore, 0) / optimizedResults.length).toFixed(2)}/100`);

  // Step 3: Compare results
  console.log('\n📈 Comparing Results...');
  const comparison = performanceTestHarness.compareResults(originalResults, optimizedResults);

  // Step 4: Calculate performance gains
  const originalAvgScore = originalResults.reduce((sum, r) => sum + r.overallScore, 0) / originalResults.length;
  const optimizedAvgScore = optimizedResults.reduce((sum, r) => sum + r.overallScore, 0) / optimizedResults.length;

  const originalAvgLatency = originalResults.reduce((sum, r) => sum + r.websocketPerformance.averageLatency, 0) / originalResults.length;
  const optimizedAvgLatency = optimizedResults.reduce((sum, r) => sum + r.websocketPerformance.averageLatency, 0) / optimizedResults.length;

  const originalAvgRenderTime = originalResults.reduce((sum, r) => sum + r.renderingPerformance.averageRenderTime, 0) / originalResults.length;
  const optimizedAvgRenderTime = optimizedResults.reduce((sum, r) => sum + r.renderingPerformance.averageRenderTime, 0) / optimizedResults.length;

  const originalTotalDrops = originalResults.reduce((sum, r) => sum + r.websocketPerformance.droppedUpdates, 0);
  const optimizedTotalDrops = optimizedResults.reduce((sum, r) => sum + r.websocketPerformance.droppedUpdates, 0);

  const performanceGains = {
    overallScoreImprovement: optimizedAvgScore - originalAvgScore,
    latencyImprovement: originalAvgLatency - optimizedAvgLatency, // Positive = improvement
    renderTimeImprovement: originalAvgRenderTime - optimizedAvgRenderTime, // Positive = improvement
    droppedUpdatesReduction: originalTotalDrops - optimizedTotalDrops, // Positive = improvement
  };

  // Step 5: Make recommendation
  let recommendation: ABTestResults['recommendation'] = 'NEEDS_MORE_TESTING';

  const significantImprovement = performanceGains.overallScoreImprovement > 5;
  const noMajorRegressions = comparison.regressions.length <= 1;
  const hasImprovements = comparison.improvements.length > 0;

  if (significantImprovement && noMajorRegressions && hasImprovements) {
    recommendation = 'IMPLEMENT';
  } else if (performanceGains.overallScoreImprovement < -2 || comparison.regressions.length > 3) {
    recommendation = 'DO_NOT_IMPLEMENT';
  }

  const results: ABTestResults = {
    timestamp: new Date().toISOString(),
    originalResults,
    optimizedResults,
    comparison,
    performanceGains,
    recommendation,
  };

  // Display results
  displayABTestResults(results);

  return results;
}

function displayABTestResults(results: ABTestResults) {
  console.log('\n🎯 A/B Test Results Summary');
  console.log('===========================');

  console.log('\n📊 Performance Comparison:');
  console.log(`  Overall Score:     ${results.performanceGains.overallScoreImprovement >= 0 ? '+' : ''}${results.performanceGains.overallScoreImprovement.toFixed(2)} points`);
  console.log(`  WebSocket Latency: ${results.performanceGains.latencyImprovement >= 0 ? '-' : '+'}${Math.abs(results.performanceGains.latencyImprovement).toFixed(2)}ms`);
  console.log(`  Render Time:       ${results.performanceGains.renderTimeImprovement >= 0 ? '-' : '+'}${Math.abs(results.performanceGains.renderTimeImprovement).toFixed(2)}ms`);
  console.log(`  Dropped Updates:   ${results.performanceGains.droppedUpdatesReduction >= 0 ? '-' : '+'}${Math.abs(results.performanceGains.droppedUpdatesReduction)} updates`);

  console.log(`\n📈 ${results.comparison.summary}`);

  if (results.comparison.improvements.length > 0) {
    console.log('\n✅ Key Improvements:');
    results.comparison.improvements.slice(0, 3).forEach(improvement => {
      console.log(`  • ${improvement}`);
    });
  }

  if (results.comparison.regressions.length > 0) {
    console.log('\n⚠️  Key Regressions:');
    results.comparison.regressions.slice(0, 3).forEach(regression => {
      console.log(`  • ${regression}`);
    });
  }

  console.log(`\n🎯 Recommendation: ${results.recommendation}`);

  switch (results.recommendation) {
    case 'IMPLEMENT':
      console.log('✅ The optimized WebSocket manager shows significant improvements.');
      console.log('   Proceed with implementation in production.');
      break;
    case 'DO_NOT_IMPLEMENT':
      console.log('❌ The optimized implementation shows regressions or minimal gains.');
      console.log('   Do not implement - stick with the original approach.');
      break;
    case 'NEEDS_MORE_TESTING':
      console.log('🔍 Results are mixed. Consider:');
      console.log('   - Testing with different network conditions');
      console.log('   - Profiling specific use cases');
      console.log('   - Gathering user feedback on perceived performance');
      break;
  }

  console.log('\n💾 Full results exported for detailed analysis');
}

async function main() {
  try {
    const results = await runABPerformanceTest();

    // Export results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ab_test_results_${timestamp}.json`;

    console.log(`\n📁 Results would be saved to: ${filename}`);
    console.log('\n📋 Raw JSON Results:');
    console.log(JSON.stringify(results, null, 2));

    // Reset to original implementation after testing
    disableOptimizedWebSocket();
    console.log('\n🔄 Reset to original implementation');

  } catch (error) {
    console.error('❌ A/B test failed:', error);
    disableOptimizedWebSocket(); // Ensure we reset on error
    process.exit(1);
  }
}

// Usage examples
console.log('\n📝 A/B Test Usage:');
console.log('==================');
console.log('Run full A/B test:           npm run ab-test');
console.log('Enable optimized manually:   global.enableOptimizedWebSocket()');
console.log('Disable optimized manually:  global.disableOptimizedWebSocket()');
console.log('Check current config:        global.getPerformanceConfig()');

if (require.main === module) {
  main().catch(console.error);
}

export { runABPerformanceTest };