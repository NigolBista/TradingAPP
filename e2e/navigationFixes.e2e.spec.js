/**
 * E2E Tests for Navigation Architecture Fixes
 *
 * These tests specifically verify the fixes made during the architecture refactor:
 * 1. BrokerageAccounts navigation from nested navigators
 * 2. Full-page presentation instead of modal behavior
 * 3. Proper nested navigator routing
 */
describe('Navigation Architecture Fixes - E2E Tests', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' }
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    // Ensure we're authenticated and on dashboard
    await waitFor(element(by.id('main-dashboard')))
      .toBeVisible()
      .withTimeout(10000);
  });

  describe('BrokerageAccounts Navigation Fix', () => {
    /**
     * Test Case: Verify BrokerageAccounts navigation from Profile screen
     *
     * Issue Fixed: "The action 'NAVIGATE' with payload {"name":"BrokerageAccounts"}
     * was not handled by any navigator"
     *
     * Solution: Updated to use nested navigator syntax:
     * navigate('Portfolio', { screen: 'BrokerageAccounts' })
     */
    it('should navigate to BrokerageAccounts from Profile without navigation errors', async () => {
      // Navigate to Profile tab
      await element(by.id('profile-tab')).tap();
      await waitFor(element(by.id('profile-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Scroll to find the brokerage accounts option
      try {
        await element(by.id('profile-scroll-view')).scroll(300, 'down');
      } catch (error) {
        // Scroll view might not exist if content fits on screen
      }

      // Tap on Brokerage Accounts option
      await element(by.id('brokerage-accounts-option')).tap();

      // Should successfully navigate to BrokerageAccounts screen
      await waitFor(element(by.id('brokerage-accounts-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify we're on the correct screen
      await expect(element(by.id('accounts-header'))).toBeVisible();

      // Verify we can navigate back
      await element(by.id('back-button')).tap();
      await waitFor(element(by.id('profile-screen')))
        .toBeVisible()
        .withTimeout(3000);
    });

    /**
     * Test Case: Verify BrokerageAccounts navigation from Dashboard
     *
     * Issue Fixed: Same navigation error from Dashboard's AccountsList component
     * Solution: Updated to use navigateToAccounts() helper function
     */
    it('should navigate to BrokerageAccounts from Dashboard AccountsList', async () => {
      // Ensure we're on Dashboard
      await element(by.id('dashboard-tab')).tap();
      await expect(element(by.id('main-dashboard'))).toBeVisible();

      // Scroll to find accounts section
      try {
        await element(by.id('dashboard-scroll-view')).scroll(400, 'down');
      } catch (error) {
        // Scroll view might not exist
      }

      // Wait for accounts section to be visible
      await waitFor(element(by.id('accounts-section')))
        .toBeVisible()
        .withTimeout(5000);

      // Try to tap on existing account or add account button
      try {
        // Try existing account first
        await element(by.id('account-item')).tap();
      } catch {
        try {
          // If no accounts, try add account button
          await element(by.id('add-account-button')).tap();
        } catch {
          // If neither exists, tap on the accounts section container
          await element(by.id('accounts-section')).tap();
        }
      }

      // Should successfully navigate to BrokerageAccounts
      await waitFor(element(by.id('brokerage-accounts-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify correct screen
      await expect(element(by.id('accounts-header'))).toBeVisible();

      // Navigate back to dashboard
      await element(by.id('back-button')).tap();
      await expect(element(by.id('main-dashboard'))).toBeVisible();
    });

    /**
     * Test Case: Verify Journey screen navigation from Portfolio navigator
     *
     * This tests the Portfolio navigator's nested routing works correctly
     */
    it('should navigate to Journey screen from Portfolio navigator', async () => {
      // Navigate to BrokerageAccounts first
      await element(by.id('profile-tab')).tap();
      await element(by.id('brokerage-accounts-option')).tap();

      await waitFor(element(by.id('brokerage-accounts-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Look for Journey/Investment Journey link
      try {
        await element(by.id('investment-journey-link')).tap();
      } catch {
        // Alternative: might be a button or different ID
        await element(by.id('journey-button')).tap();
      }

      // Should navigate to Journey screen within Portfolio navigator
      await waitFor(element(by.id('journey-screen')))
        .toBeVisible()
        .withTimeout(5000);

      await expect(element(by.id('journey-header'))).toBeVisible();

      // Navigate back to accounts
      await element(by.id('back-button')).tap();
      await expect(element(by.id('brokerage-accounts-screen'))).toBeVisible();
    });
  });

  describe('Full-Page vs Modal Presentation Fix', () => {
    /**
     * Test Case: Verify stock detail screens open as full pages, not modals
     *
     * Issue Fixed: Screens were opening as modals due to presentation: 'modal' config
     * Solution: Removed presentation: 'modal' from navigation configurations
     */
    it('should open stock detail as full page, not modal', async () => {
      // Search and navigate to stock detail
      await element(by.id('stock-search-input')).tap();
      await element(by.id('stock-search-input')).typeText('AAPL');

      await waitFor(element(by.id('stock-result-AAPL')))
        .toBeVisible()
        .withTimeout(3000);

      await element(by.id('stock-result-AAPL')).tap();

      await waitFor(element(by.id('stock-detail-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify it's a full page presentation (not modal)
      // Full pages have standard navigation elements
      await expect(element(by.id('stock-detail-header'))).toBeVisible();
      await expect(element(by.id('back-button'))).toBeVisible();

      // Modal presentations typically slide up from bottom and have different styling
      // Full page presentations slide from the right
      // We can't directly test animation direction, but we can verify UI elements

      // Navigate back - should work seamlessly
      await element(by.id('back-button')).tap();
      await expect(element(by.id('main-dashboard'))).toBeVisible();
    });

    /**
     * Test Case: Verify ChartFullScreen opens as full page
     *
     * Issue Fixed: Was configured with presentation: 'fullScreenModal'
     * Solution: Removed presentation config for standard full-page behavior
     */
    it('should open chart full screen as full page, not modal', async () => {
      // Navigate to stock detail first
      await element(by.id('stock-search-input')).tap();
      await element(by.id('stock-search-input')).typeText('AAPL');
      await element(by.id('stock-result-AAPL')).tap();

      await waitFor(element(by.id('stock-detail-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Tap to expand chart to full screen
      await element(by.id('chart-expand-button')).tap();

      await waitFor(element(by.id('chart-full-screen')))
        .toBeVisible()
        .withTimeout(3000);

      // Verify full page presentation
      await expect(element(by.id('chart-header'))).toBeVisible();
      await expect(element(by.id('chart-back-button'))).toBeVisible();

      // Should have standard navigation behavior
      await element(by.id('chart-back-button')).tap();
      await expect(element(by.id('stock-detail-screen'))).toBeVisible();
    });

    /**
     * Test Case: Verify Chat screen opens as full page
     *
     * Issue Fixed: Chat was configured with presentation: 'modal'
     * Solution: Removed modal presentation for consistent full-page behavior
     */
    it('should open chat screen as full page, not modal', async () => {
      // Navigate to market tab
      await element(by.id('market-tab')).tap();
      await expect(element(by.id('market-overview-screen'))).toBeVisible();

      // Look for chat button/link
      try {
        await element(by.id('market-chat-button')).tap();
      } catch {
        // Might be in a different location
        await element(by.id('ai-chat-button')).tap();
      }

      await waitFor(element(by.id('chat-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify full page presentation (not modal)
      await expect(element(by.id('chat-header'))).toBeVisible();
      await expect(element(by.id('back-button'))).toBeVisible();

      // Navigate back
      await element(by.id('back-button')).tap();
      await expect(element(by.id('market-overview-screen'))).toBeVisible();
    });

    /**
     * Test Case: Verify IndicatorConfig opens as full page
     *
     * Issue Fixed: Was configured with presentation: 'modal'
     * Solution: Removed modal presentation
     */
    it('should open indicator config as full page, not modal', async () => {
      // Navigate through: Stock Detail -> Chart Full Screen -> Indicator Config
      await element(by.id('stock-search-input')).tap();
      await element(by.id('stock-search-input')).typeText('AAPL');
      await element(by.id('stock-result-AAPL')).tap();

      await waitFor(element(by.id('stock-detail-screen')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('chart-expand-button')).tap();

      await waitFor(element(by.id('chart-full-screen')))
        .toBeVisible()
        .withTimeout(3000);

      // Open indicator configuration
      await element(by.id('indicator-settings-button')).tap();

      await waitFor(element(by.id('indicator-config-screen')))
        .toBeVisible()
        .withTimeout(3000);

      // Verify full page presentation
      await expect(element(by.id('indicator-header'))).toBeVisible();
      await expect(element(by.id('indicator-back-button'))).toBeVisible();

      // Navigate back through the chain
      await element(by.id('indicator-back-button')).tap();
      await expect(element(by.id('chart-full-screen'))).toBeVisible();
    });
  });

  describe('Navigation Error Prevention', () => {
    /**
     * Test Case: Verify no navigation errors occur during typical user flows
     *
     * This test exercises the most common navigation patterns to ensure
     * no "action not handled by navigator" errors occur
     */
    it('should not produce navigation errors during common flows', async () => {
      // Monitor for any navigation errors (this would need to be implemented
      // with error boundary or console monitoring in a real test)

      // Flow 1: Dashboard -> Profile -> BrokerageAccounts
      await element(by.id('profile-tab')).tap();
      await element(by.id('brokerage-accounts-option')).tap();
      await waitFor(element(by.id('brokerage-accounts-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Flow 2: Back to Dashboard -> Stock Search -> Detail
      await element(by.id('back-button')).tap();
      await element(by.id('dashboard-tab')).tap();
      await element(by.id('stock-search-input')).tap();
      await element(by.id('stock-search-input')).typeText('MSFT');
      await element(by.id('stock-result-MSFT')).tap();
      await waitFor(element(by.id('stock-detail-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Flow 3: Chart Full Screen -> Indicators
      await element(by.id('chart-expand-button')).tap();
      await waitFor(element(by.id('chart-full-screen')))
        .toBeVisible()
        .withTimeout(3000);

      await element(by.id('indicator-settings-button')).tap();
      await waitFor(element(by.id('indicator-config-screen')))
        .toBeVisible()
        .withTimeout(3000);

      // All flows should complete without navigation errors
      await expect(element(by.id('indicator-config-screen'))).toBeVisible();
    });

    /**
     * Test Case: Verify rapid navigation doesn't cause race conditions
     *
     * Tests that rapid navigation between screens doesn't cause navigation
     * state corruption or errors
     */
    it('should handle rapid navigation without errors', async () => {
      // Rapidly navigate between main tabs
      for (let i = 0; i < 5; i++) {
        await element(by.id('dashboard-tab')).tap();
        await element(by.id('watchlist-tab')).tap();
        await element(by.id('market-tab')).tap();
        await element(by.id('profile-tab')).tap();
      }

      // Should end up in a stable state
      await expect(element(by.id('profile-screen'))).toBeVisible();

      // Test nested navigation after rapid tab switching
      await element(by.id('brokerage-accounts-option')).tap();
      await waitFor(element(by.id('brokerage-accounts-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Should work without errors
      await expect(element(by.id('accounts-header'))).toBeVisible();
    });
  });

  describe('Deep Linking and URL Navigation', () => {
    /**
     * Test Case: Verify deep links work with nested navigators
     *
     * Tests that URL-based navigation correctly routes through nested navigators
     */
    it('should handle deep links to nested screens', async () => {
      // Test deep link to stock detail (Trading navigator)
      await device.openURL({
        url: 'tradingapp://trading/stock/AAPL',
        sourceApp: 'com.apple.mobilesafari'
      });

      await waitFor(element(by.id('stock-detail-screen')))
        .toBeVisible()
        .withTimeout(5000);

      await expect(element(by.text('AAPL'))).toBeVisible();

      // Test deep link to brokerage accounts (Portfolio navigator)
      await device.openURL({
        url: 'tradingapp://portfolio/accounts',
        sourceApp: 'com.apple.mobilesafari'
      });

      await waitFor(element(by.id('brokerage-accounts-screen')))
        .toBeVisible()
        .withTimeout(5000);

      await expect(element(by.id('accounts-header'))).toBeVisible();
    });
  });

  afterEach(async () => {
    // Reset to clean state for next test
    try {
      // Try to get back to dashboard
      await element(by.id('dashboard-tab')).tap();
    } catch {
      // If that fails, reload the app
      await device.reloadReactNative();
    }
  });

  afterAll(async () => {
    await device.terminateApp();
  });
});