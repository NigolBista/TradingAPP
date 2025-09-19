describe('Stock Detail Smoke', () => {
  it('shows the stock detail header after launch', async () => {
    await expect(element(by.id('stock-detail-header'))).toBeVisible();
  });
});
