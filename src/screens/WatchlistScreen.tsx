import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Input from "../components/common/Input";

const { width: screenWidth } = Dimensions.get("window");

interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap?: string;
  volume?: number;
  alertPrice?: number;
  notes?: string;
}

interface Portfolio {
  symbol: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
}

const popularStocks = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "GOOGL", name: "Alphabet Inc." },
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "TSLA", name: "Tesla, Inc." },
  { symbol: "AMZN", name: "Amazon.com Inc." },
  { symbol: "NVDA", name: "NVIDIA Corporation" },
  { symbol: "META", name: "Meta Platforms Inc." },
  { symbol: "NFLX", name: "Netflix Inc." },
  { symbol: "AMD", name: "Advanced Micro Devices" },
  { symbol: "CRM", name: "Salesforce Inc." },
];

// Generate mock data for demonstration
const generateMockPrice = (symbol: string): WatchlistItem => {
  const basePrice = Math.random() * 300 + 50;
  const change = (Math.random() - 0.5) * 20;
  const changePercent = (change / basePrice) * 100;

  return {
    symbol,
    name:
      popularStocks.find((s) => s.symbol === symbol)?.name || `${symbol} Corp.`,
    price: basePrice,
    change,
    changePercent,
    marketCap: `${(Math.random() * 2000 + 100).toFixed(0)}B`,
    volume: Math.floor(Math.random() * 50000000) + 1000000,
  };
};

export default function WatchlistScreen() {
  const [activeTab, setActiveTab] = useState<"watchlist" | "portfolio">(
    "watchlist"
  );
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([
    generateMockPrice("AAPL"),
    generateMockPrice("GOOGL"),
    generateMockPrice("MSFT"),
    generateMockPrice("TSLA"),
  ]);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([
    {
      symbol: "AAPL",
      shares: 10,
      avgPrice: 150,
      currentPrice: generateMockPrice("AAPL").price,
    },
    {
      symbol: "GOOGL",
      shares: 5,
      avgPrice: 2800,
      currentPrice: generateMockPrice("GOOGL").price,
    },
  ]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [newShares, setNewShares] = useState("");
  const [newAvgPrice, setNewAvgPrice] = useState("");

  const filteredStocks = popularStocks.filter(
    (stock) =>
      stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPortfolioValue = portfolio.reduce(
    (sum, item) => sum + item.shares * item.currentPrice,
    0
  );
  const totalPortfolioCost = portfolio.reduce(
    (sum, item) => sum + item.shares * item.avgPrice,
    0
  );
  const totalGainLoss = totalPortfolioValue - totalPortfolioCost;
  const totalGainLossPercent =
    totalPortfolioCost > 0 ? (totalGainLoss / totalPortfolioCost) * 100 : 0;

  useEffect(() => {
    // Update portfolio current prices
    const updatedPortfolio = portfolio.map((item) => ({
      ...item,
      currentPrice: generateMockPrice(item.symbol).price,
    }));
    setPortfolio(updatedPortfolio);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate data refresh
    setTimeout(() => {
      setWatchlist((prev) =>
        prev.map((item) => generateMockPrice(item.symbol))
      );
      setRefreshing(false);
    }, 1000);
  };

  const addToWatchlist = (symbol: string) => {
    if (watchlist.find((item) => item.symbol === symbol)) {
      Alert.alert("Already Added", `${symbol} is already in your watchlist.`);
      return;
    }
    const newItem = generateMockPrice(symbol);
    setWatchlist((prev) => [...prev, newItem]);
    setShowAddModal(false);
    setSearchQuery("");
  };

  const removeFromWatchlist = (symbol: string) => {
    Alert.alert("Remove Stock", `Remove ${symbol} from your watchlist?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          setWatchlist((prev) => prev.filter((item) => item.symbol !== symbol)),
      },
    ]);
  };

  const addToPortfolio = () => {
    if (!newSymbol || !newShares || !newAvgPrice) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    const shares = parseFloat(newShares);
    const avgPrice = parseFloat(newAvgPrice);

    if (shares <= 0 || avgPrice <= 0) {
      Alert.alert(
        "Error",
        "Shares and average price must be positive numbers."
      );
      return;
    }

    const newItem: Portfolio = {
      symbol: newSymbol.toUpperCase(),
      shares,
      avgPrice,
      currentPrice: generateMockPrice(newSymbol.toUpperCase()).price,
    };

    setPortfolio((prev) => [...prev, newItem]);
    setShowPortfolioModal(false);
    setNewSymbol("");
    setNewShares("");
    setNewAvgPrice("");
  };

  const removeFromPortfolio = (symbol: string) => {
    Alert.alert("Remove Position", `Remove ${symbol} from your portfolio?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          setPortfolio((prev) => prev.filter((item) => item.symbol !== symbol)),
      },
    ]);
  };

  const renderWatchlistItem = (item: WatchlistItem) => {
    const isPositive = item.change >= 0;

    return (
      <Card key={item.symbol} variant="elevated" className="mb-3">
        <View className="flex-row justify-between items-center">
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                {item.symbol}
              </Text>
              <View
                className={`ml-2 px-2 py-1 rounded-full ${
                  isPositive
                    ? "bg-green-100 dark:bg-green-900/30"
                    : "bg-red-100 dark:bg-red-900/30"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    isPositive
                      ? "text-green-700 dark:text-green-400"
                      : "text-red-700 dark:text-red-400"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {item.changePercent.toFixed(2)}%
                </Text>
              </View>
            </View>
            <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {item.name}
            </Text>
            <Text className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Vol:{" "}
              {item.volume ? (item.volume / 1000000).toFixed(1) + "M" : "N/A"} •
              Cap: {item.marketCap}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-xl font-bold text-gray-900 dark:text-white">
              ${item.price.toFixed(2)}
            </Text>
            <Text
              className={`text-sm font-medium ${
                isPositive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {isPositive ? "+" : ""}${item.change.toFixed(2)}
            </Text>
            <Pressable
              onPress={() => removeFromWatchlist(item.symbol)}
              className="mt-2 p-1"
            >
              <Ionicons name="close-circle" size={20} color="#ef4444" />
            </Pressable>
          </View>
        </View>
      </Card>
    );
  };

  const renderPortfolioItem = (item: Portfolio) => {
    const currentValue = item.shares * item.currentPrice;
    const costBasis = item.shares * item.avgPrice;
    const gainLoss = currentValue - costBasis;
    const gainLossPercent = (gainLoss / costBasis) * 100;
    const isPositive = gainLoss >= 0;

    return (
      <Card key={item.symbol} variant="elevated" className="mb-3">
        <View className="flex-row justify-between items-center">
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              {item.symbol}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {item.shares} shares @ ${item.avgPrice.toFixed(2)}
            </Text>
            <Text className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Cost basis: ${costBasis.toFixed(2)}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              ${currentValue.toFixed(2)}
            </Text>
            <Text
              className={`text-sm font-medium ${
                isPositive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {isPositive ? "+" : ""}${gainLoss.toFixed(2)}
            </Text>
            <Text
              className={`text-xs ${
                isPositive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              ({isPositive ? "+" : ""}
              {gainLossPercent.toFixed(2)}%)
            </Text>
            <Pressable
              onPress={() => removeFromPortfolio(item.symbol)}
              className="mt-1 p-1"
            >
              <Ionicons name="close-circle" size={18} color="#ef4444" />
            </Pressable>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <LinearGradient
        colors={["#667eea", "#764ba2"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="px-4 pt-12 pb-6"
      >
        <Text className="text-2xl font-bold text-white mb-2">
          My Investments
        </Text>
        <Text className="text-white/80">
          Track your portfolio and watchlist
        </Text>
      </LinearGradient>

      {/* Tab Navigation */}
      <View className="px-4 -mt-4">
        <Card variant="elevated">
          <View className="flex-row bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <Pressable
              onPress={() => setActiveTab("watchlist")}
              className={`flex-1 py-2 rounded-md ${
                activeTab === "watchlist" ? "bg-white dark:bg-gray-600" : ""
              }`}
            >
              <Text
                className={`text-center font-medium ${
                  activeTab === "watchlist"
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                Watchlist ({watchlist.length})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("portfolio")}
              className={`flex-1 py-2 rounded-md ${
                activeTab === "portfolio" ? "bg-white dark:bg-gray-600" : ""
              }`}
            >
              <Text
                className={`text-center font-medium ${
                  activeTab === "portfolio"
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                Portfolio ({portfolio.length})
              </Text>
            </Pressable>
          </View>
        </Card>
      </View>

      {/* Portfolio Summary */}
      {activeTab === "portfolio" && (
        <View className="px-4 mt-4">
          <Card variant="elevated" icon="trending-up">
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                  Total Portfolio Value
                </Text>
                <Text className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  ${totalPortfolioValue.toFixed(2)}
                </Text>
              </View>
              <View className="items-end">
                <Text
                  className={`text-lg font-bold ${
                    totalGainLoss >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {totalGainLoss >= 0 ? "+" : ""}${totalGainLoss.toFixed(2)}
                </Text>
                <Text
                  className={`text-sm ${
                    totalGainLoss >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  ({totalGainLoss >= 0 ? "+" : ""}
                  {totalGainLossPercent.toFixed(2)}%)
                </Text>
              </View>
            </View>
          </Card>
        </View>
      )}

      {/* Content */}
      <ScrollView
        className="flex-1 px-4 mt-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "watchlist" ? (
          <View>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                Your Watchlist
              </Text>
              <Button
                title="Add Stock"
                size="sm"
                icon="add"
                onPress={() => setShowAddModal(true)}
              />
            </View>
            {watchlist.map(renderWatchlistItem)}
          </View>
        ) : (
          <View>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                Your Holdings
              </Text>
              <Button
                title="Add Position"
                size="sm"
                icon="add"
                onPress={() => setShowPortfolioModal(true)}
              />
            </View>
            {portfolio.map(renderPortfolioItem)}
          </View>
        )}
        <View className="h-8" />
      </ScrollView>

      {/* Add to Watchlist Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-gray-800 rounded-t-3xl p-6 max-h-[80%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900 dark:text-white">
                Add to Watchlist
              </Text>
              <Pressable onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </Pressable>
            </View>

            <Input
              placeholder="Search stocks..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              leftIcon="search"
              className="mb-4"
            />

            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredStocks.map((stock) => (
                <Pressable
                  key={stock.symbol}
                  onPress={() => addToWatchlist(stock.symbol)}
                  className="py-3 border-b border-gray-200 dark:border-gray-700"
                >
                  <Text className="text-lg font-medium text-gray-900 dark:text-white">
                    {stock.symbol}
                  </Text>
                  <Text className="text-sm text-gray-500 dark:text-gray-400">
                    {stock.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add to Portfolio Modal */}
      <Modal
        visible={showPortfolioModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPortfolioModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-gray-800 rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900 dark:text-white">
                Add Position
              </Text>
              <Pressable onPress={() => setShowPortfolioModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </Pressable>
            </View>

            <Input
              label="Stock Symbol"
              placeholder="e.g., AAPL"
              value={newSymbol}
              onChangeText={setNewSymbol}
              autoCapitalize="characters"
              className="mb-4"
            />

            <Input
              label="Number of Shares"
              placeholder="e.g., 10"
              value={newShares}
              onChangeText={setNewShares}
              keyboardType="numeric"
              className="mb-4"
            />

            <Input
              label="Average Price per Share"
              placeholder="e.g., 150.00"
              value={newAvgPrice}
              onChangeText={setNewAvgPrice}
              keyboardType="numeric"
              className="mb-6"
            />

            <Button
              title="Add to Portfolio"
              onPress={addToPortfolio}
              className="mb-4"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
