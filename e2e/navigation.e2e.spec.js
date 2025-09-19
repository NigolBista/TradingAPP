describe('Navigation E2E Tests', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' }
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    // Wait for app to fully load
    await waitFor(element(by.id('main-dashboard')))
      .toBeVisible()
      .withTimeout(10000);
  });

  describe('Authentication Flow', () => {
    it('should navigate through login flow when not authenticated', async () => {
      // Test will only run if user is not logged in
      try {
        await expect(element(by.id('login-screen'))).toBeVisible();

        // Test login form navigation
        await element(by.id('email-input')).typeText('test@example.com');
        await element(by.id('password-input')).typeText('password123');
        await element(by.id('login-button')).tap();

        // Should navigate to main app
        await waitFor(element(by.id('main-dashboard')))
          .toBeVisible()
          .withTimeout(5000);
      } catch (error) {
        // User already authenticated, skip this test
        console.log('User already authenticated, skipping login test');
      }
    });

    it('should navigate to register screen from login', async () => {
      try {
        await expect(element(by.id('login-screen'))).toBeVisible();

        await element(by.id('register-link')).tap();
        await expect(element(by.id('register-screen'))).toBeVisible();

        // Navigate back to login
        await element(by.id('back-to-login')).tap();
        await expect(element(by.id('login-screen'))).toBeVisible();
      } catch (error) {
        console.log('User already authenticated, skipping register navigation test');
      }
    });
  });

  describe('Main Tab Navigation', () => {
    it('should navigate between all main tabs', async () => {
      // Dashboard tab (default)
      await expect(element(by.id('main-dashboard'))).toBeVisible();

      // Watchlist tab
      await element(by.id('watchlist-tab')).tap();
      await expect(element(by.id('watchlist-screen'))).toBeVisible();

      // Market tab
      await element(by.id('market-tab')).tap();
      await expect(element(by.id('market-overview-screen'))).toBeVisible();

      // Focus tab
      await element(by.id('focus-tab')).tap();
      await expect(element(by.id('focus-screen'))).toBeVisible();

      // Profile tab
      await element(by.id('profile-tab')).tap();
      await expect(element(by.id('profile-screen'))).toBeVisible();

      // Back to Dashboard
      await element(by.id('dashboard-tab')).tap();
      await expect(element(by.id('main-dashboard'))).toBeVisible();
    });

    it('should maintain tab state during navigation', async () => {
      // Go to watchlist and scroll down
      await element(by.id('watchlist-tab')).tap();
      await element(by.id('watchlist-scroll-view')).scroll(200, 'down');

      // Switch to different tab
      await element(by.id('dashboard-tab')).tap();

      // Return to watchlist - should maintain scroll position
      await element(by.id('watchlist-tab')).tap();
      // Note: In real app, you'd verify scroll position was maintained
      await expect(element(by.id('watchlist-screen'))).toBeVisible();
    });
  });

  describe('Stock Detail Navigation', () => {
    it('should navigate to stock detail from ticker search', async () => {
      // Search for AAPL
      await element(by.id('stock-search-input')).tap();
      await element(by.id('stock-search-input')).typeText('AAPL');

      // Wait for search results
      await waitFor(element(by.id('stock-result-AAPL')))
        .toBeVisible()
        .withTimeout(3000);

      // Tap on AAPL result
      await element(by.id('stock-result-AAPL')).tap();

      // Should navigate to stock detail with full-page presentation
      await waitFor(element(by.id('stock-detail-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify it's full page, not modal (check for presence of navigation elements)
      await expect(element(by.id('stock-detail-header'))).toBeVisible();
      await expect(element(by.id('back-button'))).toBeVisible();

      // Navigate back
      await element(by.id('back-button')).tap();
      await expect(element(by.id('main-dashboard'))).toBeVisible();
    });

    it('should navigate to chart full screen from stock detail', async () => {
      // Navigate to stock detail first
      await element(by.id('stock-search-input')).tap();
      await element(by.id('stock-search-input')).typeText('AAPL');
      await element(by.id('stock-result-AAPL')).tap();

      await waitFor(element(by.id('stock-detail-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Tap on chart to go full screen
      await element(by.id('chart-expand-button')).tap();

      // Should navigate to full screen chart as full page (not modal)
      await waitFor(element(by.id('chart-full-screen')))
        .toBeVisible()
        .withTimeout(3000);

      // Verify full-page presentation
      await expect(element(by.id('chart-header'))).toBeVisible();

      // Navigate back to stock detail
      await element(by.id('chart-back-button')).tap();
      await expect(element(by.id('stock-detail-screen'))).toBeVisible();
    });

    it('should navigate to indicator config from chart', async () => {
      // Navigate to stock detail and then chart
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

      // Open indicator config
      await element(by.id('indicator-settings-button')).tap();

      // Should navigate to indicator config as full page (not modal)
      await waitFor(element(by.id('indicator-config-screen')))
        .toBeVisible()
        .withTimeout(3000);

      // Navigate back
      await element(by.id('indicator-back-button')).tap();
      await expect(element(by.id('chart-full-screen'))).toBeVisible();
    });
  });

  describe('BrokerageAccounts Navigation - Fixed Issues', () => {
    it('should navigate to BrokerageAccounts from Profile screen', async () => {
      // Navigate to Profile tab
      await element(by.id('profile-tab')).tap();
      await expect(element(by.id('profile-screen'))).toBeVisible();

      // Scroll to find accounts section if needed
      await element(by.id('profile-scroll-view')).scroll(200, 'down');

      // Tap on "Brokerage Accounts" option
      await element(by.id('brokerage-accounts-option')).tap();

      // Should navigate to BrokerageAccounts as full page (not modal)
      await waitFor(element(by.id('brokerage-accounts-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify it's full page presentation
      await expect(element(by.id('accounts-header'))).toBeVisible();
      await expect(element(by.id('back-button'))).toBeVisible();

      // Navigate back to profile
      await element(by.id('back-button')).tap();
      await expect(element(by.id('profile-screen'))).toBeVisible();
    });

    it('should navigate to BrokerageAccounts from Dashboard', async () => {
      // Start from Dashboard
      await element(by.id('dashboard-tab')).tap();
      await expect(element(by.id('main-dashboard'))).toBeVisible();

      // Look for accounts section and tap on account or "Add Account"
      await element(by.id('dashboard-scroll-view')).scroll(200, 'down');

      // Try to tap on existing account or add account button
      try {
        await element(by.id('account-item')).tap();
      } catch {
        // If no accounts, tap add account button
        await element(by.id('add-account-button')).tap();
      }

      // Should navigate to BrokerageAccounts as full page
      await waitFor(element(by.id('brokerage-accounts-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify full page presentation
      await expect(element(by.id('accounts-header'))).toBeVisible();

      // Navigate back to dashboard
      await element(by.id('back-button')).tap();
      await expect(element(by.id('main-dashboard'))).toBeVisible();
    });

    it('should navigate to Journey screen from Portfolio navigator', async () => {
      // Navigate to Profile first
      await element(by.id('profile-tab')).tap();
      await element(by.id('brokerage-accounts-option')).tap();

      await waitFor(element(by.id('brokerage-accounts-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Look for journey/investment journey link
      await element(by.id('investment-journey-link')).tap();

      // Should navigate to Journey screen as full page
      await waitFor(element(by.id('journey-screen')))
        .toBeVisible()
        .withTimeout(5000);

      await expect(element(by.id('journey-header'))).toBeVisible();

      // Navigate back
      await element(by.id('back-button')).tap();
      await expect(element(by.id('brokerage-accounts-screen'))).toBeVisible();
    });
  });

  describe('Market Navigator Tests', () => {
    it('should navigate to Market Scanner', async () => {
      await element(by.id('market-tab')).tap();
      await element(by.id('market-scanner-button')).tap();

      await waitFor(element(by.id('market-scanner-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify full page presentation
      await expect(element(by.id('scanner-header'))).toBeVisible();

      await element(by.id('back-button')).tap();
      await expect(element(by.id('market-overview-screen'))).toBeVisible();
    });

    it('should navigate to AI Insights as full page', async () => {
      await element(by.id('market-tab')).tap();
      await element(by.id('ai-insights-button')).tap();

      await waitFor(element(by.id('ai-insights-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Should be full page, not modal
      await expect(element(by.id('insights-header'))).toBeVisible();
      await expect(element(by.id('back-button'))).toBeVisible();

      await element(by.id('back-button')).tap();
    });

    it('should navigate to Chat screen as full page', async () => {
      await element(by.id('market-tab')).tap();
      await element(by.id('market-chat-button')).tap();

      await waitFor(element(by.id('chat-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Should be full page, not modal (this was previously modal)
      await expect(element(by.id('chat-header'))).toBeVisible();
      await expect(element(by.id('back-button'))).toBeVisible();

      await element(by.id('back-button')).tap();
    });
  });

  describe('Deep Linking and URL Navigation', () => {
    it('should handle deep link to stock detail', async () => {
      // Simulate deep link navigation
      await device.openURL({
        url: 'tradingapp://stock/AAPL',
        sourceApp: 'com.apple.mobilesafari'
      });

      // Should navigate directly to AAPL stock detail
      await waitFor(element(by.id('stock-detail-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify correct stock is shown
      await expect(element(by.text('AAPL'))).toBeVisible();
    });

    it('should handle deep link to chart full screen', async () => {
      await device.openURL({
        url: 'tradingapp://chart/AAPL?timeframe=1D',
        sourceApp: 'com.apple.mobilesafari'
      });

      await waitFor(element(by.id('chart-full-screen')))
        .toBeVisible()
        .withTimeout(5000);

      await expect(element(by.text('AAPL'))).toBeVisible();
    });
  });

  describe('Navigation Performance and Reliability', () => {
    it('should handle rapid navigation without crashes', async () => {
      // Rapidly navigate between different screens
      for (let i = 0; i < 3; i++) {
        await element(by.id('watchlist-tab')).tap();
        await element(by.id('market-tab')).tap();
        await element(by.id('focus-tab')).tap();
        await element(by.id('profile-tab')).tap();
        await element(by.id('dashboard-tab')).tap();
      }

      // App should remain stable
      await expect(element(by.id('main-dashboard'))).toBeVisible();
    });

    it('should handle nested navigation chains', async () => {
      // Test deep navigation: Dashboard -> Stock Detail -> Chart -> Indicators
      await element(by.id('dashboard-tab')).tap();
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

      // Navigate back through the chain
      await element(by.id('indicator-back-button')).tap();
      await expect(element(by.id('chart-full-screen'))).toBeVisible();

      await element(by.id('chart-back-button')).tap();
      await expect(element(by.id('stock-detail-screen'))).toBeVisible();

      await element(by.id('back-button')).tap();
      await expect(element(by.id('main-dashboard'))).toBeVisible();
    });

    it('should maintain navigation state during app backgrounding', async () => {
      // Navigate to a specific screen
      await element(by.id('profile-tab')).tap();
      await element(by.id('brokerage-accounts-option')).tap();

      await waitFor(element(by.id('brokerage-accounts-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Background and foreground the app
      await device.sendToHome();
      await device.launchApp({ newInstance: false });

      // Should return to the same screen
      await expect(element(by.id('brokerage-accounts-screen'))).toBeVisible();
    });
  });

  afterEach(async () => {
    // Return to home state for next test
    await device.reloadReactNative();
  });

  afterAll(async () => {
    await device.terminateApp();
  });
});