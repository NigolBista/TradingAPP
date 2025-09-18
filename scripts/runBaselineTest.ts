/**
 * Script to run baseline performance tests for StockDetail screen
 * Run this before implementing the optimized WebSocket manager
 */

import { runBaselineTest } from '../src/utils/performanceTest';

async function main() {
  console.log('🎯 Running Baseline Performance Test');
  console.log('=====================================\n');

  try {
    // Run all test scenarios
    const results = await runBaselineTest();

    // Export results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `baseline_performance_${timestamp}.json`;

    console.log(`\n💾 Exporting results to: ${filename}`);

    // In a real implementation, you'd write to file system
    console.log('\n📊 Raw Results:');
    console.log(JSON.stringify(results, null, 2));

    // Summary
    console.log('\n📋 Performance Summary:');
    const avgScore = results.reduce((sum, r) => sum + r.overallScore, 0) / results.length;
    console.log(`Average Performance Score: ${avgScore.toFixed(2)}/100`);

    // Key metrics
    const avgLatency = results.reduce((sum, r) => sum + r.websocketPerformance.averageLatency, 0) / results.length;
    const avgRenderTime = results.reduce((sum, r) => sum + r.renderingPerformance.averageRenderTime, 0) / results.length;
    const totalDroppedUpdates = results.reduce((sum, r) => sum + r.websocketPerformance.droppedUpdates, 0);

    console.log(`Average WebSocket Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`Average Render Time: ${avgRenderTime.toFixed(2)}ms`);
    console.log(`Total Dropped Updates: ${totalDroppedUpdates}`);

    // Recommendations
    console.log('\n💡 Optimization Opportunities:');
    if (avgLatency > 100) {
      console.log('- High WebSocket latency detected - optimize connection management');
    }
    if (avgRenderTime > 16) {
      console.log('- Slow renders detected - optimize component rendering');
    }
    if (totalDroppedUpdates > 10) {
      console.log('- High dropped updates - implement better throttling');
    }

    console.log('\n✅ Baseline test completed successfully!');
    console.log('Next: Implement optimized WebSocket manager and run comparison test');

  } catch (error) {
    console.error('❌ Baseline test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { main as runBaselineTest };