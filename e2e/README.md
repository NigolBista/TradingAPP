# E2E Navigation Tests

This directory contains comprehensive end-to-end tests for the TradingApp navigation system, specifically covering the architecture refactor fixes.

## Test Files

### `navigation.e2e.spec.js`
Comprehensive navigation flow tests covering:
- Authentication flows
- Main tab navigation
- Stock detail navigation flows
- Deep linking and URL navigation
- Navigation performance and reliability

### `navigationFixes.e2e.spec.js`
Specific tests for the navigation architecture fixes:
- **BrokerageAccounts Navigation Fix**: Tests the resolution of "action not handled by navigator" errors
- **Full-Page vs Modal Presentation**: Verifies screens open as full pages instead of modals
- **Navigation Error Prevention**: Ensures no navigation errors during common flows
- **Deep Linking**: Tests nested navigator routing

### `navigationPerformance.e2e.spec.js`
Performance and user experience tests:
- Navigation animation performance
- Memory and resource management
- User experience improvements
- Navigation state management

### Existing Tests
- `stockDetail.smoke.spec.js`: Basic smoke test for stock detail functionality
- `stockDetailPerformance.spec.js`: Performance tests for stock detail screens

## Running the Tests

### Prerequisites
1. Ensure iOS Simulator is installed and available
2. Build the app for testing: `npm run detox:build`
3. Ensure the app is properly configured for Detox testing

### Run All Navigation Tests
```bash
npm run detox:test
```

### Run Specific Test Files
```bash
# Run navigation fixes tests only
npx detox test e2e/navigationFixes.e2e.spec.js -c ios.sim.debug

# Run performance tests only
npx detox test e2e/navigationPerformance.e2e.spec.js -c ios.sim.debug

# Run general navigation tests
npx detox test e2e/navigation.e2e.spec.js -c ios.sim.debug
```

### Run Tests with Specific Device
```bash
npx detox test -c ios.sim.debug --device-name="iPhone 14 Pro"
```

## Test Structure

### Test Organization
Each test file follows this structure:
- **Setup**: `beforeAll()` and `beforeEach()` hooks for app initialization
- **Test Suites**: Grouped by functionality (e.g., "BrokerageAccounts Navigation Fix")
- **Individual Tests**: Specific scenarios with clear descriptions
- **Cleanup**: `afterEach()` and `afterAll()` hooks for proper cleanup

### Element Identification
Tests use consistent element IDs:
- `by.id('element-id')`: Primary identification method
- `by.text('text-content')`: For text-based elements
- `waitFor().toBeVisible().withTimeout()`: For asynchronous operations

### Error Handling
- Tests include fallback strategies for optional elements
- Try-catch blocks handle variations in UI state
- Graceful degradation when certain features aren't available

## Issues Tested and Fixed

### 1. BrokerageAccounts Navigation Error
**Problem**: `The action 'NAVIGATE' with payload {"name":"BrokerageAccounts"} was not handled by any navigator`

**Root Cause**: Direct navigation to nested screen without specifying parent navigator

**Solution**: Updated to use nested navigator syntax:
```javascript
// Before (broken)
navigation.navigate("BrokerageAccounts")

// After (fixed)
navigateToAccounts() // which calls safeNavigate('Portfolio', { screen: 'BrokerageAccounts' })
```

**Tests**: `navigationFixes.e2e.spec.js` - "BrokerageAccounts Navigation Fix" suite

### 2. Modal vs Full-Page Presentation
**Problem**: Screens opening as modals instead of full pages

**Root Cause**: `presentation: 'modal'` configuration in navigation options

**Solution**: Removed modal presentation configs for consistent full-page behavior

**Tests**: `navigationFixes.e2e.spec.js` - "Full-Page vs Modal Presentation Fix" suite

### 3. Navigation Performance
**Problem**: Inconsistent navigation performance and memory usage

**Solution**: Optimized navigation configuration and proper resource cleanup

**Tests**: `navigationPerformance.e2e.spec.js` - All test suites

## Test Element IDs

### Required Element IDs for Tests
Your app components should include these `testID` props for the tests to work:

#### Main Navigation
- `main-dashboard`: Dashboard screen
- `watchlist-tab`, `market-tab`, `focus-tab`, `profile-tab`, `dashboard-tab`: Tab bar buttons
- `watchlist-screen`, `market-overview-screen`, `focus-screen`, `profile-screen`: Screen containers

#### Stock Navigation
- `stock-search-input`: Stock search input field
- `stock-result-{SYMBOL}`: Stock search result items (e.g., `stock-result-AAPL`)
- `stock-detail-screen`: Stock detail screen container
- `stock-detail-header`: Stock detail header
- `back-button`: Generic back navigation button

#### Chart Navigation
- `chart-expand-button`: Button to expand chart to full screen
- `chart-full-screen`: Full screen chart container
- `chart-header`: Chart screen header
- `chart-back-button`: Chart screen back button
- `indicator-settings-button`: Indicator configuration button
- `indicator-config-screen`: Indicator config screen

#### Accounts Navigation
- `brokerage-accounts-option`: Profile screen option for accounts
- `brokerage-accounts-screen`: Brokerage accounts screen
- `accounts-header`: Accounts screen header
- `accounts-section`: Dashboard accounts section
- `add-account-button`: Add account button
- `account-item`: Individual account item

#### Performance Test Elements
- `profile-scroll-view`, `dashboard-scroll-view`, `watchlist-scroll-view`: Scrollable containers
- Various screen-specific elements for interaction testing

## Debugging Tests

### Common Issues
1. **Timeout Errors**: Increase timeout values in `waitFor()` calls
2. **Element Not Found**: Verify element IDs match between tests and app
3. **Navigation Timing**: Add delays between rapid navigation actions
4. **App State**: Ensure app is in expected state before test execution

### Debug Commands
```bash
# Run with verbose logging
npx detox test --loglevel verbose

# Run single test with debugging
npx detox test e2e/navigationFixes.e2e.spec.js --loglevel trace

# Take screenshots on failure
npx detox test --take-screenshots all
```

### Test Artifacts
- Screenshots: Saved in `artifacts/` directory on test failures
- Logs: Available in console output and artifacts
- Video: Can be enabled for complex debugging scenarios

## Contributing

When adding new navigation features:
1. Add corresponding E2E tests to verify functionality
2. Include both positive and negative test cases
3. Test error handling and edge cases
4. Verify performance impact with appropriate tests
5. Update this README with new test scenarios

## Continuous Integration

These tests are designed to run in CI environments:
- Tests are isolated and don't depend on external services
- Proper cleanup ensures no test pollution
- Timeouts are set appropriately for CI performance
- Tests include fallback strategies for flaky scenarios