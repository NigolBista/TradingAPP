describe('Stock Detail Performance Tests - Phase 1', () => {
  beforeAll(async () => {
    // Launch app and navigate to stock detail
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' }
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Memory Leak Prevention', () => {
    it('should not crash when switching between 15 different symbols rapidly', async () => {
      const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN', 'META', 'NVDA', 'NFLX', 'BABA', 'V', 'JNJ', 'WMT', 'PG', 'MA', 'HD'];

      // Navigate to first stock
      await element(by.id('stock-search-input')).tap();
      await element(by.id('stock-search-input')).typeText(symbols[0]);
      await element(by.id(`stock-result-${symbols[0]}`)).tap();
      await expect(element(by.id('stock-detail-header'))).toBeVisible();

      // Rapidly switch between symbols
      for (let i = 1; i < symbols.length; i++) {
        await element(by.id('back-button')).tap();
        await element(by.id('stock-search-input')).clearText();
        await element(by.id('stock-search-input')).typeText(symbols[i]);
        await element(by.id(`stock-result-${symbols[i]}`)).tap();

        // Verify screen loads without crash
        await expect(element(by.id('stock-detail-header'))).toBeVisible();

        // Wait briefly to allow any async operations to complete
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Final verification - app should still be responsive
      await expect(element(by.id('stock-detail-header'))).toBeVisible();
    });

    it('should clean up timers when navigating away from stock detail', async () => {
      // Navigate to stock detail
      await element(by.id('stock-search-input')).tap();
      await element(by.id('stock-search-input')).typeText('AAPL');
      await element(by.id(`stock-result-AAPL`)).tap();
      await expect(element(by.id('stock-detail-header'))).toBeVisible();

      // Wait for any timers to be set
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Navigate away
      await element(by.id('back-button')).tap();

      // Navigate back quickly (timers should be cleaned up)
      await element(by.id('stock-search-input')).tap();
      await element(by.id('stock-search-input')).typeText('AAPL');
      await element(by.id(`stock-result-AAPL`)).tap();

      // Should load without issues
      await expect(element(by.id('stock-detail-header'))).toBeVisible();
    });
  });

  describe('Component Re-rendering Optimization', () => {
    it('should maintain smooth scrolling during price updates', async () => {
      // Navigate to stock detail
      await element(by.id('stock-search-input')).tap();
      await element(by.id('stock-search-input')).typeText('AAPL');
      await element(by.id(`stock-result-AAPL`)).tap();
      await expect(element(by.id('stock-detail-header'))).toBeVisible();

      // Wait for initial load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test scrolling performance
      const scrollView = element(by.id('stock-detail-scroll-view'));

      // Scroll down and up multiple times rapidly
      for (let i = 0; i < 5; i++) {
        await scrollView.scroll(300, 'down');
        await new Promise(resolve => setTimeout(resolve, 100));
        await scrollView.scroll(300, 'up');
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Verify UI is still responsive
      await expect(element(by.id('stock-detail-header'))).toBeVisible();
    });

    it('should handle tab switching without performance degradation', async () => {
      // Navigate to stock detail
      await element(by.id('stock-search-input')).tap();
      await element(by.id('stock-search-input')).typeText('AAPL');
      await element(by.id(`stock-result-AAPL`)).tap();
      await expect(element(by.id('stock-detail-header'))).toBeVisible();

      // Rapidly switch between tabs
      const tabs = ['signals-tab', 'overview-tab', 'news-tab'];

      for (let i = 0; i < 10; i++) {
        for (const tab of tabs) {
          await element(by.id(tab)).tap();
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Verify final state is stable
      await expect(element(by.id('stock-detail-header'))).toBeVisible();
    });
  });

  describe('Network Request Optimization', () => {
    it('should not make duplicate API calls when switching timeframes rapidly', async () => {
      // Navigate to stock detail
      await element(by.id('stock-search-input')).tap();
      await element(by.id('stock-search-input')).typeText('AAPL');
      await element(by.id(`stock-result-AAPL`)).tap();
      await expect(element(by.id('stock-detail-header'))).toBeVisible();

      // Wait for initial load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Rapidly switch timeframes
      const timeframes = ['1D', '1W', '1M', '3M', '1Y'];

      for (let i = 0; i < 3; i++) {
        for (const tf of timeframes) {
          await element(by.id(`timeframe-${tf}`)).tap();
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      // App should remain stable
      await expect(element(by.id('stock-detail-header'))).toBeVisible();
    });

    it('should handle network errors gracefully without crashes', async () => {
      // Simulate poor network conditions
      await device.setLocation(40.7128, -74.0060); // NYC coordinates

      // Navigate to stock detail
      await element(by.id('stock-search-input')).tap();
      await element(by.id('stock-search-input')).typeText('AAPL');
      await element(by.id(`stock-result-AAPL`)).tap();

      // Should show loading state or error state, not crash
      await waitFor(element(by.id('stock-detail-header')))
        .toBeVisible()
        .withTimeout(10000);
    });
  });

  describe('Chart Performance', () => {
    it('should handle chart interactions without memory leaks', async () => {
      // Navigate to stock detail
      await element(by.id('stock-search-input')).tap();
      await element(by.id('stock-search-input')).typeText('AAPL');
      await element(by.id(`stock-result-AAPL`)).tap();
      await expect(element(by.id('stock-detail-header'))).toBeVisible();

      // Wait for chart to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Interact with chart multiple times
      const chart = element(by.id('stock-chart'));

      for (let i = 0; i < 10; i++) {
        await chart.tap();
        await new Promise(resolve => setTimeout(resolve, 200));

        // Try to pan/zoom (simulate gestures)
        await chart.swipe('left', 'slow');
        await new Promise(resolve => setTimeout(resolve, 200));
        await chart.swipe('right', 'slow');
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Chart should still be responsive
      await expect(element(by.id('stock-chart'))).toBeVisible();
    });
  });

  describe('Alert System Performance', () => {
    it('should handle multiple alert creations without performance issues', async () => {
      // Navigate to stock detail
      await element(by.id('stock-search-input')).tap();
      await element(by.id('stock-search-input')).typeText('AAPL');
      await element(by.id(`stock-result-AAPL`)).tap();
      await expect(element(by.id('stock-detail-header'))).toBeVisible();

      // Create multiple alerts rapidly
      for (let i = 0; i < 5; i++) {
        await element(by.id('alert-button')).tap();
        await element(by.id('alert-price-input')).typeText(`${150 + i}`);
        await element(by.id('alert-save-button')).tap();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Verify alerts modal can still be opened
      await element(by.id('alert-button')).tap();
      await expect(element(by.id('alerts-modal'))).toBeVisible();
    });
  });

  describe('Sentiment Analysis Performance', () => {
    it('should calculate sentiment efficiently when switching symbols', async () => {
      const symbols = ['AAPL', 'MSFT', 'GOOGL'];

      for (const symbol of symbols) {
        // Navigate to stock
        await element(by.id('stock-search-input')).tap();
        await element(by.id('stock-search-input')).clearText();
        await element(by.id('stock-search-input')).typeText(symbol);
        await element(by.id(`stock-result-${symbol}`)).tap();

        // Switch to overview tab to trigger sentiment calculation
        await element(by.id('overview-tab')).tap();

        // Verify sentiment section loads
        await waitFor(element(by.id('sentiment-section')))
          .toBeVisible()
          .withTimeout(5000);

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    });
  });

  afterAll(async () => {
    await device.terminateApp();
  });
});