// @ts-nocheck
import { StateCreator } from 'zustand';
import { AppState, StoreActions, PortfolioState } from '../types';
import { PortfolioRepository } from "../../shared/services/repositories/PortfolioRepository";

// Initial portfolio state
const initialPortfolioState: PortfolioState = {
  accounts: {},
  positions: {},
  summary: null,
  history: {},
  transactions: {},
  performance: {},
  _meta: {
    lastUpdated: 0,
    isLoading: false,
    error: null,
  },
};

// Portfolio slice creator
export const createPortfolioSlice: StateCreator<
  AppState & StoreActions,
  [],
  [],
  PortfolioState & Pick<StoreActions, 'refreshSummary' | 'syncAccount' | 'updatePortfolioHistory'>
> = (set, get) => ({
  ...initialPortfolioState,

  // Portfolio actions
  refreshSummary: async () => {
    const portfolioRepo = new PortfolioRepository(get().apiClient);

      set((state) => ({
        portfolio: {
          ...state.portfolio,
          _meta: { ...state.portfolio._meta, isLoading: true, error: null },
        },
      }));

      try {
        const response = await portfolioRepo.getPortfolioSummary();
        const summary = response.data;

        set((state) => ({
          portfolio: {
            ...state.portfolio,
            summary,
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: null,
            },
          },
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        set((state) => ({
          portfolio: {
            ...state.portfolio,
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: errorMessage,
            },
          },
        }));
        throw error;
      }
    },

    // Sync specific account
    syncAccount: async (accountId) => {
      const portfolioRepo = new PortfolioRepository(get().apiClient);

      try {
        // Fetch account details
        const accountResponse = await portfolioRepo.getAccount(accountId);
        const account = accountResponse.data;

        // Fetch positions for this account
        const positionsResponse = await portfolioRepo.getPositions(accountId);
        const positions = positionsResponse.data;

        // Fetch recent transactions
        const transactionsResponse = await portfolioRepo.getTransactions(accountId);
        const transactions = transactionsResponse.data;

        set((state) => {
          const updatedPositions = { ...state.portfolio.positions };
          const updatedTransactions = { ...state.portfolio.transactions };

          // Update positions
          positions.forEach((position) => {
            const key = `${accountId}:${position.symbol}`;
            updatedPositions[key] = position;
          });

          // Update transactions
          transactions.forEach((transaction) => {
            updatedTransactions[transaction.id] = transaction;
          });

          return {
            portfolio: {
              ...state.portfolio,
              accounts: {
                ...state.portfolio.accounts,
                [accountId]: account,
              },
              positions: updatedPositions,
              transactions: updatedTransactions,
              _meta: {
                lastUpdated: Date.now(),
                isLoading: false,
                error: null,
              },
            },
          };
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        set((state) => ({
          portfolio: {
            ...state.portfolio,
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: errorMessage,
            },
          },
        }));
        throw error;
      }
    },

    // Update portfolio history for a specific period
    updatePortfolioHistory: async (period) => {
      const portfolioRepo = new PortfolioRepository(get().apiClient);

      try {
        const response = await portfolioRepo.getPortfolioHistory(period);
        const history = response.data;

        set((state) => ({
          portfolio: {
            ...state.portfolio,
            history: {
              ...state.portfolio.history,
              [period]: history,
            },
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: null,
            },
          },
        }));
      } catch (error) {
        console.error(`Failed to update portfolio history for ${period}:`, error);
      }
    },
});

// Portfolio-related selectors
export const portfolioSelectors = {
  // Summary
  summary: (state: AppState) => state.portfolio.summary,
  totalValue: (state: AppState) => state.portfolio.summary?.totalValue || 0,
  totalGainLoss: (state: AppState) => state.portfolio.summary?.totalGainLoss || 0,
  totalGainLossPercent: (state: AppState) => state.portfolio.summary?.totalGainLossPercent || 0,

  // Accounts
  allAccounts: (state: AppState) => Object.values(state.portfolio.accounts),
  accountById: (accountId: string) => (state: AppState) => state.portfolio.accounts[accountId],
  connectedAccounts: (state: AppState) =>
    Object.values(state.portfolio.accounts).filter(account => account.isActive),

  // Positions
  allPositions: (state: AppState) => Object.values(state.portfolio.positions),
  positionsByAccount: (accountId: string) => (state: AppState) =>
    Object.values(state.portfolio.positions).filter(
      (position) => position.accountId === accountId
    ),
  positionBySymbol: (symbol: string) => (state: AppState) =>
    Object.values(state.portfolio.positions).find(
      (position) => position.symbol === symbol
    ),

  // Transactions
  recentTransactions: (state: AppState) => {
    const transactions = Object.values(state.portfolio.transactions);
    return transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50); // Last 50 transactions
  },
  transactionsByAccount: (accountId: string) => (state: AppState) =>
    Object.values(state.portfolio.transactions).filter(
      (transaction) => transaction.accountId === accountId
    ),

  // Performance
  performanceForPeriod: (period: string) => (state: AppState) =>
    state.portfolio.performance[period],
  historyForPeriod: (period: string) => (state: AppState) =>
    state.portfolio.history[period],

  // Diversification
  sectorAllocation: (state: AppState) => {
    const positions = Object.values(state.portfolio.positions);
    const allocation: Record<string, number> = {};
    let totalValue = 0;

    positions.forEach((position) => {
      const value = position.marketValue;
      totalValue += value;

      // This would need to be enhanced with actual sector data
      const sector = 'Unknown'; // position.sector || 'Unknown';
      allocation[sector] = (allocation[sector] || 0) + value;
    });

    // Convert to percentages
    Object.keys(allocation).forEach((sector) => {
      allocation[sector] = (allocation[sector] / totalValue) * 100;
    });

    return allocation;
  },

  // Loading states
  isLoading: (state: AppState) => state.portfolio._meta.isLoading,
  error: (state: AppState) => state.portfolio._meta.error,
  lastUpdated: (state: AppState) => state.portfolio._meta.lastUpdated,
};
