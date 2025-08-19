import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Dimensions,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  portfolioAggregationService,
  type PortfolioSummary,
} from "../services/portfolioAggregationService";
import { plaidPortfolioService } from "../services/portfolioAggregationService_NEW";
import { plaidIntegrationService } from "../services/plaidIntegration";
import { useNavigation } from "@react-navigation/native";
import SimpleLineChart from "../components/charts/SimpleLineChart";
import MarketOverview from "../components/insights/MarketOverview";
import type { NewsItem } from "../services/newsProviders";
import { useMarketOverviewStore } from "../store/marketOverviewStore";
import DecalpXMini from "../components/insights/DecalpXMini";
import PerformanceCard from "../components/insights/PerformanceCard";
import TopGainersCard from "../components/insights/TopGainersCard";
import AccountsList from "../components/insights/AccountsList";
import { useTheme } from "../providers/ThemeProvider";

const { width } = Dimensions.get("window");

interface DashboardState {
  portfolio: PortfolioSummary | null;
  watchlist: any[]; // Using any for now - will be replaced with Plaid watchlist
  loading: boolean;
  refreshing: boolean;
}

interface DashboardData {
  cachedNews: NewsItem[];
}

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const ensureOverview = useMarketOverviewStore((s) => s.ensureOverview);
  const overviewByTf = useMarketOverviewStore((s) => s.overviewByTf);
  const rawNews = useMarketOverviewStore((s) => s.rawNews);

  const sentimentSummary = useMemo(() => {
    const ov = overviewByTf["1D"] || overviewByTf["1W"] || overviewByTf["1M"];
    if (!ov && !rawNews?.length) return null;
    if ((ov as any)?.marketSentiment) return (ov as any).marketSentiment;
    const news = rawNews || [];
    let positive = 0,
      negative = 0,
      neutral = 0;
    for (const n of news) {
      const snt = (n.sentiment || "").toLowerCase();
      if (snt === "positive") positive++;
      else if (snt === "negative") negative++;
      else neutral++;
    }
    const total = positive + negative + neutral;
    if (total === 0) return null;
    const pos = positive / total;
    const neg = negative / total;
    let overall: "bullish" | "bearish" | "neutral";
    let confidence: number;
    if (pos > 0.6) {
      overall = "bullish";
      confidence = Math.round(pos * 100);
    } else if (neg > 0.6) {
      overall = "bearish";
      confidence = Math.round(neg * 100);
    } else {
      overall = "neutral";
      confidence = Math.round(Math.max(pos, neg) * 100);
    }
    return { overall, confidence };
  }, [overviewByTf, rawNews]);
  const [state, setState] = useState<DashboardState>({
    portfolio: null,
    watchlist: [],
    loading: true,
    refreshing: false,
  });

  const [dashboardData, setDashboardData] = useState<DashboardData>({
    cachedNews: [],
  });

  const [perfPeriod, setPerfPeriod] = useState<
    "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL"
  >("1M");
  const [portfolioHistory, setPortfolioHistory] = useState<any>(null);
  const [portfolioPositions, setPortfolioPositions] = useState<any[]>([]);
  const [plaidAccounts, setPlaidAccounts] = useState<any[]>([]);
  const [selectedAccountTab, setSelectedAccountTab] = useState<string>("All");

  // Callback to receive news data from MarketOverview component
  const handleNewsDataFetched = (news: NewsItem[]) => {
    console.log(
      "📰 Dashboard received cached news data:",
      news.length,
      "items"
    );
    setDashboardData((prev) => ({ ...prev, cachedNews: news }));
  };

  const [dummySeries, setDummySeries] = useState<
    { time: number; close: number }[]
  >([]);
  const [benchmarkSeries, setBenchmarkSeries] = useState<
    { time: number; close: number }[]
  >([]);

  function generateDummySeries(
    points: number = 240,
    base: number = 1_200_000
  ): { time: number; close: number }[] {
    const now = Date.now();
    const series: { time: number; close: number }[] = [];
    let price = base;
    // GBM-style params
    let mu = 0.00015; // drift per step
    let vol = 0.004; // volatility per step
    const clamp = (n: number, min: number, max: number) =>
      Math.max(min, Math.min(max, n));
    const gauss = () => {
      // Box-Muller transform
      let u = 0,
        v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };
    for (let i = points - 1; i >= 0; i--) {
      const t = now - i * 60_000; // 1-minute steps
      // occasional regime changes in drift/vol
      if (Math.random() < 0.03) mu += (Math.random() - 0.5) * 0.001;
      if (Math.random() < 0.06)
        vol = clamp(vol + (Math.random() - 0.5) * 0.003, 0.0015, 0.012);
      // GBM increment
      const z = gauss();
      const ret = mu + vol * z; // simple additive log-return per step
      price = Math.max(500, price * (1 + ret));
      // occasional jump up/down
      if (Math.random() < 0.02) {
        const jump =
          (Math.random() * 0.05 + 0.01) * (Math.random() < 0.5 ? -1 : 1);
        price = Math.max(500, price * (1 + jump));
      }
      // small mean reversion to base to avoid runaway
      const mr = (base - price) * 0.0000015;
      price = price + mr;
      series.push({ time: t, close: Math.round(price * 100) / 100 });
    }
    // Ensure uptrend for demo so header and chart are consistent visually
    const first = series[0]?.close ?? 0;
    const last = series[series.length - 1]?.close ?? 0;
    if (last <= first && first > 0) {
      const tilt = (first - last) * 1.15 + first * 0.005;
      const n = series.length - 1;
      return series.map((d, i) => ({
        time: d.time,
        close: Math.round((d.close + (tilt * i) / Math.max(1, n)) * 100) / 100,
      }));
    }
    return series;
  }

  const getAccountCategory = (type: string, subtype?: string) => {
    const accountType = (subtype || type).toLowerCase();

    // Investment accounts
    if (
      [
        "investment",
        "brokerage",
        "ira",
        "401k",
        "403b",
        "457b",
        "529",
        "roth",
        "rollover",
        "sep",
        "simple",
        "sarsep",
        "profit sharing plan",
        "stock plan",
        "pension",
        "defined benefit",
        "defined contribution",
      ].includes(accountType)
    ) {
      return "Investment";
    }

    // Banking accounts
    if (
      [
        "depository",
        "checking",
        "savings",
        "money market",
        "cd",
        "treasury",
        "sweep",
      ].includes(accountType)
    ) {
      return "Banking";
    }

    // Credit accounts
    if (["credit", "credit card", "paypal"].includes(accountType)) {
      return "Credit";
    }

    // Loan accounts
    if (
      [
        "loan",
        "mortgage",
        "home equity",
        "line of credit",
        "auto",
        "business",
        "commercial",
        "construction",
        "consumer",
        "home equity line of credit",
        "overdraft",
        "student",
      ].includes(accountType)
    ) {
      return "Loans";
    }

    return "Other";
  };

  const formatAccountType = (type: string, subtype?: string) => {
    // Map Plaid account types to user-friendly names
    const typeMap: { [key: string]: string } = {
      // Investment accounts
      investment: "Investment Account",
      brokerage: "Brokerage Account",
      ira: "IRA",
      "401k": "401(k)",
      "403b": "403(b)",
      "457b": "457(b)",
      "529": "529 Education",
      roth: "Roth IRA",
      rollover: "Rollover IRA",
      sep: "SEP IRA",
      simple: "SIMPLE IRA",
      sarsep: "SARSEP",
      "profit sharing plan": "Profit Sharing",
      "stock plan": "Stock Plan",
      pension: "Pension",
      "defined benefit": "Defined Benefit",
      "defined contribution": "Defined Contribution",

      // Banking accounts
      depository: "Bank Account",
      checking: "Checking Account",
      savings: "Savings Account",
      "money market": "Money Market",
      cd: "Certificate of Deposit",
      treasury: "Treasury Account",
      sweep: "Sweep Account",

      // Credit accounts
      credit: "Credit Card",
      "credit card": "Credit Card",
      paypal: "PayPal",

      // Loan accounts
      loan: "Loan",
      mortgage: "Mortgage",
      "home equity": "Home Equity",
      "line of credit": "Line of Credit",
      auto: "Auto Loan",
      business: "Business Loan",
      commercial: "Commercial Loan",
      construction: "Construction Loan",
      consumer: "Consumer Loan",
      "home equity line of credit": "HELOC",
      overdraft: "Overdraft",
      student: "Student Loan",
    };

    // First try subtype, then type, then fallback
    const accountType = subtype || type;
    return (
      typeMap[accountType.toLowerCase()] ||
      typeMap[type.toLowerCase()] ||
      accountType.charAt(0).toUpperCase() + accountType.slice(1)
    );
  };

  const getAccountTabs = () => {
    const categories = ["All"];
    const accountCategories = plaidAccounts.map((account) => account.category);
    const uniqueCategories = [...new Set(accountCategories)];
    return [...categories, ...uniqueCategories.sort()];
  };

  const getFilteredAccounts = () => {
    if (selectedAccountTab === "All") {
      return plaidAccounts;
    }
    return plaidAccounts.filter(
      (account) => account.category === selectedAccountTab
    );
  };

  const loadData = async (isRefresh = false) => {
    const fetchPlaidAccounts = async () => {
      try {
        const tokens = plaidIntegrationService.getStoredTokens();
        const accountsPromises = tokens.map(async (token) => {
          const accounts = await plaidIntegrationService.getAccounts(token);
          return accounts.map((account) => ({
            id: account.account_id,
            provider: "Plaid",
            accountName: account.name,
            accountType: formatAccountType(account.type, account.subtype),
            category: getAccountCategory(account.type, account.subtype),
            balance: account.balances.current || 0,
            dayChange: 0, // Plaid doesn't provide daily change directly
            dayChangePercent: 0,
            lastSync: new Date(),
            isConnected: true,
          }));
        });
        const allAccounts = await Promise.all(accountsPromises);
        return allAccounts.flat();
      } catch (error) {
        console.error("Failed to fetch Plaid accounts:", error);
        return [];
      }
    };
    if (isRefresh) {
      setState((prev) => ({ ...prev, refreshing: true }));
    } else {
      setState((prev) => ({ ...prev, loading: true }));
    }

    try {
      // Prime market overview store early so navigating to View Full reuses data
      ensureOverview("1D").catch(() => {});
      const [portfolioData, watchlistData, history, positions, accounts] =
        await Promise.all([
          plaidPortfolioService.getPortfolioSummary(),
          Promise.resolve([]), // Watchlist will be implemented with Plaid later
          plaidPortfolioService.getPortfolioHistory(perfPeriod),
          plaidPortfolioService.getAllPositions(),
          fetchPlaidAccounts(),
        ]);

      setState((prev) => ({
        ...prev,
        portfolio: {
          ...portfolioData,
          positionsCount: portfolioData.positionCount || 0,
          providersConnected: Array(portfolioData.connectedAccounts || 0).fill(
            "Plaid"
          ),
        } as any,
        watchlist: watchlistData,
        loading: false,
        refreshing: false,
      }));
      setPortfolioHistory(history);
      setPortfolioPositions(positions);
      setPlaidAccounts(accounts);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      setState((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
      }));
    }
  };

  useEffect(() => {
    loadData();
    const main = generateDummySeries();
    setDummySeries(main);
    const bench = main.map((d, i) => ({
      time: d.time,
      close: d.close * (0.985 + 0.00025 * i),
    }));
    setBenchmarkSeries(bench);
  }, [perfPeriod]);

  const handleAddToWatchlist = async (symbol: string) => {
    try {
      const result = await portfolioAggregationService.addToAllWatchlists(
        symbol
      );
      if (result.success) {
        Alert.alert("Success", `${symbol} added to watchlist`);
        loadData(true);
      } else {
        Alert.alert("Partial Success", `${symbol} added to some accounts`);
      }
    } catch (error) {
      Alert.alert("Error", `Failed to add ${symbol} to watchlist`);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  const renderPortfolioHeader = () => {
    const hasReal = !!state.portfolio && (state.portfolio!.totalValue || 0) > 0;
    // Derive fallback values from dummy series so direction matches the chart
    const first = dummySeries[0]?.close ?? 0;
    const last = dummySeries[dummySeries.length - 1]?.close ?? 0;
    const fallbackValue = last || 1205340.12;
    const fallbackChange = first > 0 ? last - first : 0;
    const fallbackPct = first > 0 ? (fallbackChange / first) * 100 : 0;

    const totalValue = hasReal ? state.portfolio!.totalValue : fallbackValue;
    const totalGainLoss = hasReal
      ? state.portfolio!.totalGainLoss
      : fallbackChange;
    const totalGainLossPercent = hasReal
      ? state.portfolio!.totalGainLossPercent
      : fallbackPct;
    const accounts = hasReal
      ? state.portfolio!.providersConnected?.length || 0
      : 0;
    const isPositive = totalGainLoss >= 0;

    return (
      <View style={styles.portfolioHeader}>
        <Text style={styles.portfolioValue}>{formatCurrency(totalValue)}</Text>
        <View style={styles.portfolioChange}>
          <Text
            style={[
              styles.changeText,
              isPositive ? styles.positive : styles.negative,
            ]}
          >
            {formatCurrency(totalGainLoss)} (
            {formatPercent(totalGainLossPercent)})
          </Text>
        </View>
        <Text style={styles.portfolioSubtext}>
          {accounts} account(s) connected
        </Text>
      </View>
    );
  };

  const renderMarketBrief = () => {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Market Overview</Text>
          <Pressable
            onPress={() => navigation.navigate("MarketOverview" as never)}
            style={styles.viewAllButton}
          >
            <Text style={styles.viewAllText}>View Full</Text>
            <Ionicons name="chevron-forward" size={16} color="#00D4AA" />
          </Pressable>
        </View>
        {/* Sentiment strip (bullish/bearish/neutral) below portfolio */}
        <View style={styles.sentimentStrip}>
          <View
            style={[
              styles.sentimentPill,
              sentimentSummary?.overall === "bullish"
                ? styles.pillBull
                : sentimentSummary?.overall === "bearish"
                ? styles.pillBear
                : styles.pillNeutral,
            ]}
          >
            <Ionicons
              name={
                sentimentSummary?.overall === "bullish"
                  ? "trending-up"
                  : sentimentSummary?.overall === "bearish"
                  ? "trending-down"
                  : "remove"
              }
              size={14}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.pillText}>
              {(sentimentSummary?.overall || "neutral").toUpperCase()} •{" "}
              {sentimentSummary
                ? `${Math.round(sentimentSummary.confidence)}%`
                : "--%"}
            </Text>
          </View>
        </View>
        <MarketOverview
          compact={true}
          onNewsPress={() => navigation.navigate("News" as never)}
          onNewsDataFetched={handleNewsDataFetched}
          navigation={navigation}
          fullWidth={false}
        />
      </View>
    );
  };

  const renderWatchlist = () => {
    if (state.watchlist.length === 0) {
      return (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Watchlist</Text>
            <Pressable
              onPress={() => {
                /* Navigate to search */
              }}
            >
              <Ionicons name="add" size={24} color="#00D4AA" />
            </Pressable>
          </View>
          <Text style={styles.emptyText}>No stocks in watchlist</Text>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Watchlist</Text>
          <Pressable
            onPress={() => {
              /* Navigate to search */
            }}
          >
            <Ionicons name="add" size={24} color="#00D4AA" />
          </Pressable>
        </View>
        {state.watchlist.map((item, index) => (
          <View key={index} style={styles.watchlistItem}>
            <View style={styles.watchlistLeft}>
              <Text style={styles.watchlistSymbol}>{item.symbol}</Text>
              <Text style={styles.watchlistName}>{item.name}</Text>
            </View>
            <View style={styles.watchlistRight}>
              <Text style={styles.watchlistPrice}>
                {formatCurrency(item.price)}
              </Text>
              <Text
                style={[
                  styles.watchlistChange,
                  item.changePercent >= 0 ? styles.positive : styles.negative,
                ]}
              >
                {formatPercent(item.changePercent)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  // Avoid whole-screen loading: show content skeletons/partials instead

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={() => loadData(true)}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View style={{ marginHorizontal: 16, marginTop: 12 }}>
          <PerformanceCard
            history={portfolioHistory}
            totalNetWorth={state.portfolio?.totalValue || 0}
            netWorthChange={state.portfolio?.dayChange || 0}
            netWorthChangePercent={state.portfolio?.dayChangePercent || 0}
            selected={perfPeriod}
            onChange={(p) => setPerfPeriod(p)}
          />
        </View>
        {/* Top Gainers from Portfolio */}
        {portfolioPositions && portfolioPositions.length > 0 && (
          <View style={{ marginHorizontal: 16, marginTop: 12 }}>
            <TopGainersCard
              positions={portfolioPositions.map((pos) => ({
                symbol: pos.symbol,
                name: pos.symbol,
                quantity: pos.totalQuantity,
                currentPrice: pos.averagePrice,
                costBasis: pos.totalCost,
                marketValue: pos.totalMarketValue,
                unrealizedPnL: pos.unrealizedPnL,
                unrealizedPnLPercent: pos.unrealizedPnLPercent,
                provider: pos.providers?.[0]?.provider || "Unknown",
              }))}
              onPositionPress={(position) => {
                (navigation as any).navigate("StockDetail", {
                  symbol: position.symbol,
                });
              }}
            />
          </View>
        )}

        {/* Accounts */}
        <View style={styles.accountsSection}>
          <Text style={styles.sectionTitle}>Accounts</Text>

          {/* Account Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.accountTabsContainer}
            contentContainerStyle={styles.accountTabsContent}
          >
            {getAccountTabs().map((tab) => (
              <Pressable
                key={tab}
                style={[
                  styles.accountTab,
                  selectedAccountTab === tab && styles.accountTabActive,
                ]}
                onPress={() => setSelectedAccountTab(tab)}
              >
                <Text
                  style={[
                    styles.accountTabText,
                    selectedAccountTab === tab && styles.accountTabTextActive,
                  ]}
                >
                  {tab}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <AccountsList
            accounts={getFilteredAccounts()}
            onAccountPress={(account) => {
              (navigation as any).navigate("BrokerageAccounts");
            }}
            onAddAccountPress={() => {
              (navigation as any).navigate("BrokerageAccounts");
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    content: { flex: 1 },
    centered: { justifyContent: "center", alignItems: "center" },
    loadingText: { color: "#888888", marginTop: 16, fontSize: 16 },

    // Portfolio Header
    portfolioHeader: {
      backgroundColor: "#1a1a1a",
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 24,
      alignItems: "center",
    },
    portfolioValue: {
      fontSize: 36,
      fontWeight: "bold",
      color: "#ffffff",
      marginBottom: 8,
    },
    portfolioChange: {
      flexDirection: "row",
      alignItems: "center",
    },
    changeText: {
      fontSize: 18,
      fontWeight: "600",
    },
    positive: { color: "#00D4AA" },
    negative: { color: "#FF5722" },
    portfolioSubtext: {
      color: "#888888",
      fontSize: 14,
      marginTop: 8,
    },

    // Chart
    chartContainer: {
      backgroundColor: "#1a1a1a",
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 12,
      padding: 20,
    },
    chartPlaceholder: {
      alignItems: "center",
      paddingVertical: 40,
    },
    chartText: {
      color: "#ffffff",
      fontSize: 18,
      fontWeight: "600",
      marginTop: 12,
    },
    chartSubtext: {
      color: "#888888",
      fontSize: 14,
      marginTop: 4,
    },

    // Sections
    section: {
      backgroundColor: "#1a1a1a",
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 12,
      padding: 16,
    },
    sentimentStrip: {
      marginBottom: 12,
      width: "100%",
      alignItems: "flex-start",
    },
    sentimentPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    pillBull: { backgroundColor: "#16a34a" },
    pillBear: { backgroundColor: "#dc2626" },
    pillNeutral: { backgroundColor: "#6b7280" },
    pillText: { color: "#ffffff", fontWeight: "700", letterSpacing: 0.3 },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: "#ffffff",
      marginBottom: 12,
    },
    viewAllButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    viewAllText: {
      color: "#00D4AA",
      fontSize: 14,
      fontWeight: "600",
      marginRight: 4,
    },

    // Market Brief
    briefText: {
      color: "#cccccc",
      fontSize: 16,
      lineHeight: 22,
      marginBottom: 16,
    },
    marketStats: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    statItem: {
      alignItems: "center",
    },
    statLabel: {
      color: "#888888",
      fontSize: 12,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 16,
      fontWeight: "600",
    },

    // Watchlist
    emptyText: {
      color: "#888888",
      fontSize: 16,
      textAlign: "center",
      paddingVertical: 20,
    },
    watchlistItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: "#2a2a2a",
    },
    watchlistLeft: {
      flex: 1,
    },
    watchlistSymbol: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "600",
    },
    watchlistName: {
      color: "#888888",
      fontSize: 14,
      marginTop: 2,
    },
    watchlistRight: {
      alignItems: "flex-end",
    },
    watchlistPrice: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "600",
    },
    watchlistChange: {
      fontSize: 14,
      fontWeight: "500",
      marginTop: 2,
    },
    marketOverviewButton: {
      backgroundColor: "#1a1a1a",
      borderRadius: 12,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    marketOverviewContent: {
      flexDirection: "row",
      alignItems: "center",
    },
    marketOverviewTitle: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "600",
    },
    marketOverviewSubtitle: {
      color: "#9ca3af",
      fontSize: 12,
      marginTop: 2,
    },

    // Account Tabs
    accountsSection: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 16,
      marginTop: 12,
    },
    accountTabsContainer: {
      marginBottom: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 4,
    },
    accountTabsContent: {
      paddingHorizontal: 0,
    },
    accountTab: {
      paddingVertical: 8,
      paddingHorizontal: 20,
      borderRadius: 6,
      alignItems: "center",
      marginRight: 8,
      minWidth: 100,
    },
    accountTabActive: {
      backgroundColor: theme.colors.primary,
    },
    accountTabText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      fontWeight: "500",
    },
    accountTabTextActive: {
      color: "#ffffff",
      fontWeight: "600",
    },
  });
