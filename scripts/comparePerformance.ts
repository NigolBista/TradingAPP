/**
 * Script to compare performance before/after optimization
 */

import { runBaselineTest } from '../src/utils/performanceTest';
import { performanceTestHarness } from '../src/utils/performanceTest';

interface ComparisonReport {
  timestamp: string;
  beforeResults: any[];
  afterResults: any[];
  comparison: {
    improvements: string[];
    regressions: string[];
    summary: string;
  };
  recommendation: string;
}

async function comparePerformance(
  beforeResultsFile?: string,
  runAfterTest: boolean = true
): Promise<ComparisonReport> {
  console.log('🔄 Running Performance Comparison');
  console.log('=================================\n');

  // Load before results (in real app, this would load from file)
  let beforeResults: any[];
  if (beforeResultsFile) {
    // In real implementation: beforeResults = JSON.parse(fs.readFileSync(beforeResultsFile, 'utf8')).results;
    console.log(`📂 Loading baseline results from: ${beforeResultsFile}`);
    beforeResults = []; // Placeholder
  } else {
    console.log('📊 Running baseline test (current implementation)...');
    beforeResults = await runBaselineTest();
  }

  // Run after test with optimized implementation
  let afterResults: any[];
  if (runAfterTest) {
    console.log('\n🚀 Running optimized test...');
    afterResults = await runBaselineTest();
  } else {
    console.log('⏭️ Skipping after test (using provided results)');
    afterResults = [];
  }

  // Compare results
  const comparison = performanceTestHarness.compareResults(beforeResults, afterResults);

  const report: ComparisonReport = {
    timestamp: new Date().toISOString(),
    beforeResults,
    afterResults,
    comparison,
    recommendation: generateRecommendation(comparison),
  };

  // Display results
  displayComparisonReport(report);

  return report;
}

function generateRecommendation(comparison: any): string {
  const { improvements, regressions, summary } = comparison;

  if (improvements.length > regressions.length) {
    return 'RECOMMENDED: The optimization shows significant improvements. Proceed with implementation.';
  } else if (regressions.length > improvements.length) {
    return 'NOT RECOMMENDED: The optimization introduces more regressions than improvements. Review implementation.';
  } else {
    return 'NEUTRAL: Mixed results. Consider profiling specific use cases before proceeding.';
  }
}

function displayComparisonReport(report: ComparisonReport) {
  console.log('\n📈 Performance Comparison Report');
  console.log('================================');

  console.log(`\n📊 ${report.comparison.summary}`);

  if (report.comparison.improvements.length > 0) {
    console.log('\n✅ Improvements:');
    report.comparison.improvements.forEach(improvement => {
      console.log(`  + ${improvement}`);
    });
  }

  if (report.comparison.regressions.length > 0) {
    console.log('\n⚠️  Regressions:');
    report.comparison.regressions.forEach(regression => {
      console.log(`  - ${regression}`);
    });
  }

  console.log(`\n🎯 Recommendation:`);
  console.log(`   ${report.recommendation}`);

  // Detailed metrics comparison
  if (report.beforeResults.length > 0 && report.afterResults.length > 0) {
    console.log('\n📋 Detailed Metrics:');
    console.log('====================');

    const scenarios = ['single_symbol_light', 'single_symbol_heavy', 'multiple_symbols', 'stress_test'];

    scenarios.forEach(scenario => {
      const before = report.beforeResults.find(r => r.scenario === scenario);
      const after = report.afterResults.find(r => r.scenario === scenario);

      if (before && after) {
        console.log(`\n${scenario.toUpperCase()}:`);
        console.log(`  Overall Score:    ${before.overallScore.toFixed(2)} → ${after.overallScore.toFixed(2)} (${(after.overallScore - before.overallScore).toFixed(2)})`);
        console.log(`  WebSocket Latency: ${before.websocketPerformance.averageLatency.toFixed(2)}ms → ${after.websocketPerformance.averageLatency.toFixed(2)}ms`);
        console.log(`  Render Time:      ${before.renderingPerformance.averageRenderTime.toFixed(2)}ms → ${after.renderingPerformance.averageRenderTime.toFixed(2)}ms`);
        console.log(`  Dropped Updates:  ${before.websocketPerformance.droppedUpdates} → ${after.websocketPerformance.droppedUpdates}`);
      }
    });
  }

  console.log('\n💾 Export this report to make implementation decisions');
}

// Create a simple CLI interface
async function main() {
  const args = process.argv.slice(2);
  const beforeFile = args.find(arg => arg.startsWith('--before='))?.split('=')[1];
  const skipAfter = args.includes('--skip-after');

  try {
    const report = await comparePerformance(beforeFile, !skipAfter);

    // Export report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `performance_comparison_${timestamp}.json`;
    console.log(`\n💾 Report exported to: ${filename}`);

    // In real implementation, would write to file system
    // fs.writeFileSync(filename, JSON.stringify(report, null, 2));

  } catch (error) {
    console.error('❌ Comparison failed:', error);
    process.exit(1);
  }
}

// Example usage:
// npm run compare-performance
// npm run compare-performance --before=baseline_results.json
// npm run compare-performance --skip-after

if (require.main === module) {
  main().catch(console.error);
}

export { comparePerformance };