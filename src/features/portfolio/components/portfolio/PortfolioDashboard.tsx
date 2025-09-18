import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  portfolioAggregationService,
  PortfolioSummary,
  AggregatedPosition,
  PortfolioHistory,
} from "../../../shared/services/portfolioAggregationService";

const { width } = Dimensions.get('window');

interface Props {
  onPositionPress?: (position: AggregatedPosition) => void;
  onHistoryPress?: () => void;
}

export default function PortfolioDashboard({ onPositionPress, onHistoryPress }: Props) {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<AggregatedPosition[]>([]);
  const [history, setHistory] = useState<PortfolioHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1M');

  useEffect(() => {
    loadPortfolioData();
  }, []);

  const loadPortfolioData = async () => {
    try {
      setLoading(true);
      
      const [portfolioData, positionsData, historyData] = await Promise.all([
        portfolioAggregationService.getPortfolioSummary(),
        portfolioAggregationService.getDetailedPositions(),
        portfolioAggregationService.getPortfolioHistory(selectedPeriod),
      ]);

      setPortfolio(portfolioData);
      setPositions(positionsData);
      setHistory(historyData);
    } catch (error) {
      console.error('Failed to load portfolio data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    portfolioAggregationService.clearCache();
    await loadPortfolioData();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercent = (percent: number): string => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  const getChangeColor = (change: number): string => {
    return change >= 0 ? '#10b981' : '#ef4444';
  };

  const renderPortfolioHeader = () => {
    if (!portfolio) return null;

    return (
      <LinearGradient
        colors={portfolio.totalGainLoss >= 0 ? ['#10b981', '#059669'] : ['#ef4444', '#dc2626']}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerLabel}>Total Portfolio Value</Text>
          <Text style={styles.headerValue}>{formatCurrency(portfolio.totalValue)}</Text>
          
          <View style={styles.headerStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {formatCurrency(portfolio.totalGainLoss)}
              </Text>
              <Text style={styles.statLabel}>Total Return</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {formatPercent(portfolio.totalGainLossPercent)}
              </Text>
              <Text style={styles.statLabel}>Return %</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {formatCurrency(portfolio.dayChange)}
              </Text>
              <Text style={styles.statLabel}>Today</Text>
            </View>
          </View>

          <View style={styles.providerBadges}>
            {portfolio.providersConnected.map(provider => (
              <View key={provider} style={styles.providerBadge}>
                <Ionicons 
                  name={provider === 'robinhood' ? 'trending-up' : 'bar-chart'} 
                  size={12} 
                  color="#ffffff" 
                />
                <Text style={styles.providerText}>
                  {provider.charAt(0).toUpperCase() + provider.slice(1)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>
    );
  };

  const renderQuickStats = () => {
    if (!portfolio) return null;

    return (
      <View style={styles.quickStats}>
        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <Ionicons name="pie-chart" size={20} color="#6366f1" />
            <Text style={styles.statCardTitle}>Positions</Text>
          </View>
          <Text style={styles.statCardValue}>{portfolio.positionsCount}</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <Ionicons name="trending-up" size={20} color="#10b981" />
            <Text style={styles.statCardTitle}>Cost Basis</Text>
          </View>
          <Text style={styles.statCardValue}>{formatCurrency(portfolio.totalCost)}</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <Ionicons name="calendar" size={20} color="#f59e0b" />
            <Text style={styles.statCardTitle}>Day Change</Text>
          </View>
          <Text style={[styles.statCardValue, { color: getChangeColor(portfolio.dayChange) }]}>
            {formatPercent(portfolio.dayChangePercent)}
          </Text>
        </View>
      </View>
    );
  };

  const renderTopMovers = () => {
    if (!portfolio || (!portfolio.topGainer && !portfolio.topLoser)) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Movers</Text>
        
        <View style={styles.moversContainer}>
          {portfolio.topGainer && (
            <TouchableOpacity 
              style={[styles.moverCard, styles.gainerCard]}
              onPress={() => onPositionPress?.(portfolio.topGainer!)}
            >
              <View style={styles.moverHeader}>
                <Ionicons name="trending-up" size={16} color="#10b981" />
                <Text style={styles.moverLabel}>Top Gainer</Text>
              </View>
              <Text style={styles.moverSymbol}>{portfolio.topGainer.symbol}</Text>
              <Text style={[styles.moverPercent, { color: '#10b981' }]}>
                {formatPercent(portfolio.topGainer.unrealizedPnLPercent)}
              </Text>
              <Text style={styles.moverValue}>
                {formatCurrency(portfolio.topGainer.unrealizedPnL)}
              </Text>
            </TouchableOpacity>
          )}

          {portfolio.topLoser && (
            <TouchableOpacity 
              style={[styles.moverCard, styles.loserCard]}
              onPress={() => onPositionPress?.(portfolio.topLoser!)}
            >
              <View style={styles.moverHeader}>
                <Ionicons name="trending-down" size={16} color="#ef4444" />
                <Text style={styles.moverLabel}>Top Loser</Text>
              </View>
              <Text style={styles.moverSymbol}>{portfolio.topLoser.symbol}</Text>
              <Text style={[styles.moverPercent, { color: '#ef4444' }]}>
                {formatPercent(portfolio.topLoser.unrealizedPnLPercent)}
              </Text>
              <Text style={styles.moverValue}>
                {formatCurrency(portfolio.topLoser.unrealizedPnL)}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderRecentPositions = () => {
    if (positions.length === 0) return null;

    const topPositions = positions
      .sort((a, b) => b.totalMarketValue - a.totalMarketValue)
      .slice(0, 5);

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top Holdings</Text>
          <TouchableOpacity onPress={() => onHistoryPress?.()}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {topPositions.map((position) => (
          <TouchableOpacity
            key={position.symbol}
            style={styles.positionItem}
            onPress={() => onPositionPress?.(position)}
          >
            <View style={styles.positionLeft}>
              <Text style={styles.positionSymbol}>{position.symbol}</Text>
              <Text style={styles.positionShares}>
                {position.totalQuantity.toFixed(2)} shares
              </Text>
              <View style={styles.providersRow}>
                {position.providers.map((p, index) => (
                  <View key={index} style={styles.providerChip}>
                    <Text style={styles.providerChipText}>
                      {p.provider.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.positionRight}>
              <Text style={styles.positionValue}>
                {formatCurrency(position.totalMarketValue)}
              </Text>
              <Text style={[styles.positionChange, { color: getChangeColor(position.unrealizedPnL) }]}>
                {formatCurrency(position.unrealizedPnL)}
              </Text>
              <Text style={[styles.positionPercent, { color: getChangeColor(position.unrealizedPnL) }]}>
                {formatPercent(position.unrealizedPnLPercent)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading portfolio...</Text>
      </View>
    );
  }

  if (!portfolio || portfolio.providersConnected.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="pie-chart-outline" size={64} color="#9ca3af" />
        <Text style={styles.emptyTitle}>No Connected Accounts</Text>
        <Text style={styles.emptySubtitle}>
          Connect your brokerage accounts to see your portfolio
        </Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {renderPortfolioHeader()}
      {renderQuickStats()}
      {renderTopMovers()}
      {renderRecentPositions()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f9fafb',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 32,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  headerValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 24,
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  providerBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  providerText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  quickStats: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  statCardTitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  statCardValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  seeAllText: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '500',
  },
  moversContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  moverCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gainerCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  loserCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  moverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  moverLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  moverSymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  moverPercent: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  moverValue: {
    fontSize: 14,
    color: '#6b7280',
  },
  positionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  positionLeft: {
    flex: 1,
  },
  positionSymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  positionShares: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 6,
  },
  providersRow: {
    flexDirection: 'row',
    gap: 4,
  },
  providerChip: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerChipText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
  },
  positionRight: {
    alignItems: 'flex-end',
  },
  positionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  positionChange: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  positionPercent: {
    fontSize: 12,
    fontWeight: '500',
  },
});