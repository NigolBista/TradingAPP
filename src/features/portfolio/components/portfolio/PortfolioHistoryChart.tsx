import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
// Chart implementation using basic React Native components
import { Ionicons } from '@expo/vector-icons';
import {
  portfolioAggregationService,
  PortfolioHistory,
} from "../../../../shared/services/portfolioAggregationService";

const { width } = Dimensions.get('window');
const chartWidth = width - 40;
const chartHeight = 200;

interface Props {
  initialPeriod?: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';
  onPeriodChange?: (period: string) => void;
}

export default function PortfolioHistoryChart({ initialPeriod = '1M', onPeriodChange }: Props) {
  const [history, setHistory] = useState<PortfolioHistory | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'>(initialPeriod);
  const [loading, setLoading] = useState(true);

  const periods: { key: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'; label: string }[] = [
    { key: '1D', label: '1D' },
    { key: '1W', label: '1W' },
    { key: '1M', label: '1M' },
    { key: '3M', label: '3M' },
    { key: '1Y', label: '1Y' },
    { key: 'ALL', label: 'ALL' },
  ];

  useEffect(() => {
    loadHistoryData();
  }, [selectedPeriod]);

  const loadHistoryData = async () => {
    try {
      setLoading(true);
      const historyData = await portfolioAggregationService.getPortfolioHistory(selectedPeriod);
      setHistory(historyData);
    } catch (error) {
      console.error('Failed to load portfolio history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (period: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL') => {
    setSelectedPeriod(period);
    onPeriodChange?.(period);
  };

  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toFixed(0)}`;
  };

  const formatPercent = (percent: number): string => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  const getChangeColor = (change: number): string => {
    return change >= 0 ? '#10b981' : '#ef4444';
  };

  const renderPeriodSelector = () => (
    <View style={styles.periodSelector}>
      {periods.map((period) => (
        <TouchableOpacity
          key={period.key}
          style={[
            styles.periodButton,
            selectedPeriod === period.key && styles.periodButtonActive,
          ]}
          onPress={() => handlePeriodChange(period.key)}
        >
          <Text
            style={[
              styles.periodButtonText,
              selectedPeriod === period.key && styles.periodButtonTextActive,
            ]}
          >
            {period.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderPerformanceStats = () => {
    if (!history || history.data.length === 0) return null;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Start Value</Text>
          <Text style={styles.statValue}>{formatCurrency(history.startValue)}</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>End Value</Text>
          <Text style={styles.statValue}>{formatCurrency(history.endValue)}</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Return</Text>
          <Text style={[styles.statValue, { color: getChangeColor(history.totalReturn) }]}>
            {formatCurrency(history.totalReturn)}
          </Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Return %</Text>
          <Text style={[styles.statValue, { color: getChangeColor(history.totalReturn) }]}>
            {formatPercent(history.totalReturnPercent)}
          </Text>
        </View>
      </View>
    );
  };

  const renderSimpleChart = () => {
    if (!history || history.data.length < 2) {
      return (
        <View style={styles.noDataContainer}>
          <Ionicons name="trending-up" size={48} color="#9ca3af" />
          <Text style={styles.noDataText}>
            {history?.data.length === 0 ? 'No historical data available' : 'Need more data points for chart'}
          </Text>
          <Text style={styles.noDataSubtext}>
            Connect your accounts and check back later
          </Text>
        </View>
      );
    }

    // Simple chart representation using bars
    const maxValue = Math.max(...history.data.map(d => d.totalValue));
    const minValue = Math.min(...history.data.map(d => d.totalValue));
    const range = maxValue - minValue;

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartWrapper}>
          <View style={styles.yAxisLabels}>
            <Text style={styles.yAxisLabel}>{formatCurrency(maxValue)}</Text>
            <Text style={styles.yAxisLabel}>{formatCurrency((maxValue + minValue) / 2)}</Text>
            <Text style={styles.yAxisLabel}>{formatCurrency(minValue)}</Text>
          </View>
          
          <View style={styles.chartArea}>
            {history.data.map((point, index) => {
              const height = range > 0 ? ((point.totalValue - minValue) / range) * (chartHeight - 40) + 20 : chartHeight / 2;
              const isPositive = index === 0 || point.totalValue >= history.data[index - 1].totalValue;
              
              return (
                <View
                  key={index}
                  style={[
                    styles.chartBar,
                    {
                      height: 2,
                      bottom: height,
                      left: (index / (history.data.length - 1)) * (chartWidth - 80),
                      backgroundColor: isPositive ? '#10b981' : '#ef4444',
                    },
                  ]}
                />
              );
            })}
            
            {/* Simple line connecting points */}
            <View style={styles.chartLine}>
              {history.data.map((point, index) => {
                if (index === 0) return null;
                
                const prevHeight = range > 0 ? ((history.data[index - 1].totalValue - minValue) / range) * (chartHeight - 40) + 20 : chartHeight / 2;
                const currentHeight = range > 0 ? ((point.totalValue - minValue) / range) * (chartHeight - 40) + 20 : chartHeight / 2;
                
                const x1 = ((index - 1) / (history.data.length - 1)) * (chartWidth - 80);
                const x2 = (index / (history.data.length - 1)) * (chartWidth - 80);
                
                const width = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(currentHeight - prevHeight, 2));
                const angle = Math.atan2(currentHeight - prevHeight, x2 - x1) * (180 / Math.PI);
                
                return (
                  <View
                    key={index}
                    style={[
                      styles.chartSegment,
                      {
                        width,
                        left: x1,
                        bottom: prevHeight,
                        transform: [{ rotate: `${angle}deg` }],
                        backgroundColor: history.totalReturn >= 0 ? '#10b981' : '#ef4444',
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>
        </View>
        
        {/* X-axis labels */}
        <View style={styles.xAxisLabels}>
          <Text style={styles.xAxisLabel}>
            {new Date(history.data[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
          <Text style={styles.xAxisLabel}>
            {new Date(history.data[Math.floor(history.data.length / 2)].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
          <Text style={styles.xAxisLabel}>
            {new Date(history.data[history.data.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading chart data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Portfolio Performance</Text>
        {history && (
          <View style={styles.returnBadge}>
            <Text style={[styles.returnText, { color: getChangeColor(history.totalReturn) }]}>
              {formatPercent(history.totalReturnPercent)}
            </Text>
          </View>
        )}
      </View>

      {renderPeriodSelector()}
      {renderSimpleChart()}
      {renderPerformanceStats()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  returnBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  returnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  periodButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  periodButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: '#6366f1',
    fontWeight: '600',
  },
  chartContainer: {
    marginBottom: 20,
  },
  chartWrapper: {
    flexDirection: 'row',
    height: chartHeight,
  },
  yAxisLabels: {
    width: 60,
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  yAxisLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
  },
  chartArea: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  chartBar: {
    position: 'absolute',
    width: 4,
    borderRadius: 2,
  },
  chartLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  chartSegment: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingLeft: 60,
  },
  xAxisLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  noDataContainer: {
    height: chartHeight,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 20,
  },
  noDataText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
    textAlign: 'center',
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});