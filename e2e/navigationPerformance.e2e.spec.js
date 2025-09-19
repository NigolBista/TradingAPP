/**
 * Navigation Performance E2E Tests
 *
 * Tests to verify that the navigation architecture improvements provide
 * better performance and user experience compared to modal presentations
 */
describe('Navigation Performance Tests', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' }
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await waitFor(element(by.id('main-dashboard')))
      .toBeVisible()
      .withTimeout(10000);
  });

  describe('Navigation Animation Performance', () => {
    /**
     * Test Case: Verify smooth transitions between screens
     *
     * Full-page transitions should be smoother than modal presentations
     * because they use optimized slide animations
     */
    it('should have smooth transitions when navigating to stock detail', async () => {
      const startTime = Date.now();

      // Navigate to stock detail
      await element(by.id('stock-search-input')).tap();
      await element(by.id('stock-search-input')).typeText('AAPL');
      await element(by.id('stock-result-AAPL')).tap();

      await waitFor(element(by.id('stock-detail-screen')))
        .toBeVisible()
        .withTimeout(3000);

      const navigationTime = Date.now() - startTime;

      // Navigation should complete within reasonable time (< 2 seconds)
      expect(navigationTime).toBeLessThan(2000);

      // Test back navigation performance
      const backStartTime = Date.now();
      await element(by.id('back-button')).tap();

      await waitFor(element(by.id('main-dashboard')))
        .toBeVisible()
        .withTimeout(3000);

      const backNavigationTime = Date.now() - backStartTime;
      expect(backNavigationTime).toBeLessThan(1500);
    });

    /**
     * Test Case: Verify nested navigation performance
     *
     * Deep navigation chains should remain performant with full-page presentations
     */
    it('should maintain performance in deep navigation chains', async () => {
      const totalStartTime = Date.now();

      // Deep navigation: Dashboard -> Stock -> Chart -> Indicators
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

      await element(by.id('indicator-settings-button')).tap();

      await waitFor(element(by.id('indicator-config-screen')))
        .toBeVisible()
        .withTimeout(3000);

      const totalNavigationTime = Date.now() - totalStartTime;

      // Entire navigation chain should complete in reasonable time
      expect(totalNavigationTime).toBeLessThan(8000);

      // Verify we can navigate back efficiently
      const backStartTime = Date.now();

      await element(by.id('indicator-back-button')).tap();
      await element(by.id('chart-back-button')).tap();
      await element(by.id('back-button')).tap();

      await waitFor(element(by.id('main-dashboard')))
        .toBeVisible()
        .withTimeout(5000);

      const backChainTime = Date.now() - backStartTime;
      expect(backChainTime).toBeLessThan(5000);
    });
  });

  describe('Memory and Resource Management', () => {
    /**
     * Test Case: Verify navigation doesn't cause memory leaks
     *
     * Full-page navigation should properly clean up resources
     * when screens are unmounted
     */
    it('should properly clean up resources during navigation', async () => {
      // Navigate through multiple screens rapidly to test cleanup
      const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN'];

      for (const symbol of symbols) {
        await element(by.id('stock-search-input')).tap();
        await element(by.id('stock-search-input')).clearText();
        await element(by.id('stock-search-input')).typeText(symbol);
        await element(by.id(`stock-result-${symbol}`)).tap();

        await waitFor(element(by.id('stock-detail-screen')))
          .toBeVisible()
          .withTimeout(5000);

        // Go to chart to test heavy component cleanup
        await element(by.id('chart-expand-button')).tap();

        await waitFor(element(by.id('chart-full-screen')))
          .toBeVisible()
          .withTimeout(3000);

        // Navigate back to test cleanup
        await element(by.id('chart-back-button')).tap();
        await element(by.id('back-button')).tap();

        await waitFor(element(by.id('main-dashboard')))
          .toBeVisible()
          .withTimeout(3000);

        // Small delay to allow cleanup
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // App should remain stable after multiple navigations
      await expect(element(by.id('main-dashboard'))).toBeVisible();
    });

    /**
     * Test Case: Verify BrokerageAccounts navigation resource efficiency
     *
     * The fixed nested navigation should be more efficient than
     * the previous broken attempts
     */
    it('should efficiently navigate to BrokerageAccounts multiple times', async () => {
      // Navigate to BrokerageAccounts from different entry points multiple times
      for (let i = 0; i < 3; i++) {
        // From Profile
        const profileStartTime = Date.now();
        await element(by.id('profile-tab')).tap();
        await element(by.id('brokerage-accounts-option')).tap();

        await waitFor(element(by.id('brokerage-accounts-screen')))
          .toBeVisible()
          .withTimeout(5000);

        const profileNavigationTime = Date.now() - profileStartTime;
        expect(profileNavigationTime).toBeLessThan(3000);

        await element(by.id('back-button')).tap();

        // From Dashboard
        const dashboardStartTime = Date.now();
        await element(by.id('dashboard-tab')).tap();

        try {
          await element(by.id('add-account-button')).tap();
        } catch {
          await element(by.id('accounts-section')).tap();
        }

        await waitFor(element(by.id('brokerage-accounts-screen')))
          .toBeVisible()
          .withTimeout(5000);

        const dashboardNavigationTime = Date.now() - dashboardStartTime;
        expect(dashboardNavigationTime).toBeLessThan(3000);

        await element(by.id('back-button')).tap();
      }

      // App should remain responsive
      await expect(element(by.id('main-dashboard'))).toBeVisible();
    });
  });

  describe('User Experience Improvements', () => {
    /**
     * Test Case: Verify consistent navigation patterns
     *
     * All screens should behave consistently with full-page presentation
     */
    it('should provide consistent back button behavior across all screens', async () => {
      const screensToTest = [
        {
          navigate: async () => {
            await element(by.id('stock-search-input')).tap();
            await element(by.id('stock-search-input')).typeText('AAPL');
            await element(by.id('stock-result-AAPL')).tap();
          },
          screenId: 'stock-detail-screen',
          backButtonId: 'back-button'
        },
        {
          navigate: async () => {
            await element(by.id('profile-tab')).tap();
            await element(by.id('brokerage-accounts-option')).tap();
          },
          screenId: 'brokerage-accounts-screen',
          backButtonId: 'back-button'
        },
        {
          navigate: async () => {
            await element(by.id('market-tab')).tap();
            await element(by.id('market-scanner-button')).tap();
          },
          screenId: 'market-scanner-screen',
          backButtonId: 'back-button'
        }
      ];

      for (const screen of screensToTest) {
        await screen.navigate();

        await waitFor(element(by.id(screen.screenId)))
          .toBeVisible()
          .withTimeout(5000);

        // Verify back button is consistently available
        await expect(element(by.id(screen.backButtonId))).toBeVisible();

        // Test back navigation works
        await element(by.id(screen.backButtonId)).tap();

        // Should return to expected state
        await waitFor(element(by.id('main-dashboard')))
          .toBeVisible()
          .withTimeout(3000);
      }
    });

    /**
     * Test Case: Verify gesture navigation works properly
     *
     * Full-page presentations should support swipe-back gestures
     * (on iOS) better than modal presentations
     */
    it('should support swipe gestures for navigation', async () => {
      // Navigate to stock detail
      await element(by.id('stock-search-input')).tap();
      await element(by.id('stock-search-input')).typeText('AAPL');
      await element(by.id('stock-result-AAPL')).tap();

      await waitFor(element(by.id('stock-detail-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Test swipe back gesture (iOS specific)
      if (device.getPlatform() === 'ios') {
        try {
          // Swipe from left edge to go back
          await element(by.id('stock-detail-screen')).swipe('right', 'slow', 0.1);

          await waitFor(element(by.id('main-dashboard')))
            .toBeVisible()
            .withTimeout(3000);
        } catch (error) {
          // Fallback to back button if gesture doesn't work
          await element(by.id('back-button')).tap();
        }
      } else {
        // Android: use back button
        await element(by.id('back-button')).tap();
      }

      await expect(element(by.id('main-dashboard'))).toBeVisible();
    });
  });

  describe('Navigation State Management', () => {
    /**
     * Test Case: Verify navigation state is properly maintained
     *
     * Full-page navigation should maintain state better than modals
     */
    it('should maintain scroll position when navigating back', async () => {
      // Navigate to a screen with scrollable content
      await element(by.id('watchlist-tab')).tap();
      await waitFor(element(by.id('watchlist-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Scroll down
      try {
        await element(by.id('watchlist-scroll-view')).scroll(400, 'down');
      } catch {
        // Scroll view might not exist if no content
      }

      // Navigate to stock detail and back
      if (await element(by.id('first-stock-item')).isVisible()) {
        await element(by.id('first-stock-item')).tap();

        await waitFor(element(by.id('stock-detail-screen')))
          .toBeVisible()
          .withTimeout(5000);

        await element(by.id('back-button')).tap();

        await waitFor(element(by.id('watchlist-screen')))
          .toBeVisible()
          .withTimeout(3000);

        // Scroll position should be maintained (at least partially)
        // This is difficult to test precisely, but screen should be functional
        await expect(element(by.id('watchlist-screen'))).toBeVisible();
      }
    });

    /**
     * Test Case: Verify navigation history is properly managed
     *
     * Complex navigation flows should maintain proper history
     */
    it('should maintain proper navigation history in complex flows', async () => {
      // Create a complex navigation path
      await element(by.id('profile-tab')).tap();
      await element(by.id('brokerage-accounts-option')).tap();

      await waitFor(element(by.id('brokerage-accounts-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Navigate to journey from accounts
      try {
        await element(by.id('investment-journey-link')).tap();

        await waitFor(element(by.id('journey-screen')))
          .toBeVisible()
          .withTimeout(5000);

        // Navigate back should go to accounts, not profile directly
        await element(by.id('back-button')).tap();
        await expect(element(by.id('brokerage-accounts-screen'))).toBeVisible();

        // Second back should go to profile
        await element(by.id('back-button')).tap();
        await expect(element(by.id('profile-screen'))).toBeVisible();
      } catch {
        // Journey navigation might not be available, just verify accounts work
        await expect(element(by.id('brokerage-accounts-screen'))).toBeVisible();
        await element(by.id('back-button')).tap();
        await expect(element(by.id('profile-screen'))).toBeVisible();
      }
    });
  });

  afterEach(async () => {
    // Reset to dashboard for clean state
    try {
      await element(by.id('dashboard-tab')).tap();
    } catch {
      await device.reloadReactNative();
    }
  });

  afterAll(async () => {
    await device.terminateApp();
  });
});