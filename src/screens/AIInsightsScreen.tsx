import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Dimensions,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import { generateInsights } from "../services/ai";
import { analyzeNewsSentiment } from "../services/sentiment";
import { fetchNews } from "../services/marketProviders";

const { width: screenWidth } = Dimensions.get("window");

interface MarketInsight {
  title: string;
  description: string;
  confidence: number;
  type: "bullish" | "bearish" | "neutral";
  timeframe: string;
  stocks: string[];
}

interface SentimentData {
  label: string;
  score: number;
  trend: "up" | "down" | "stable";
  description: string;
}

interface Recommendation {
  action: "buy" | "sell" | "hold";
  symbol: string;
  reason: string;
  confidence: number;
  targetPrice?: number;
  stopLoss?: number;
}

const mockInsights: MarketInsight[] = [
  {
    title: "Tech Sector Momentum",
    description:
      "Strong earnings reports from major tech companies are driving sector-wide optimism. Cloud computing and AI investments continue to show robust growth.",
    confidence: 85,
    type: "bullish",
    timeframe: "1-3 months",
    stocks: ["AAPL", "GOOGL", "MSFT", "NVDA"],
  },
  {
    title: "Energy Sector Volatility",
    description:
      "Oil prices showing increased volatility due to geopolitical tensions. Consider defensive positioning in energy stocks.",
    confidence: 72,
    type: "bearish",
    timeframe: "2-4 weeks",
    stocks: ["XOM", "CVX", "BP"],
  },
  {
    title: "Healthcare Innovation",
    description:
      "Breakthrough drug approvals and medical device innovations are creating opportunities in the healthcare sector.",
    confidence: 78,
    type: "bullish",
    timeframe: "3-6 months",
    stocks: ["JNJ", "PFE", "UNH"],
  },
];

const mockRecommendations: Recommendation[] = [
  {
    action: "buy",
    symbol: "AAPL",
    reason:
      "Strong iPhone sales and services growth. Trading below fair value.",
    confidence: 82,
    targetPrice: 200,
    stopLoss: 165,
  },
  {
    action: "hold",
    symbol: "GOOGL",
    reason:
      "Solid fundamentals but facing regulatory headwinds. Maintain position.",
    confidence: 75,
  },
  {
    action: "sell",
    symbol: "NFLX",
    reason:
      "Increasing competition and subscriber growth slowdown. Consider taking profits.",
    confidence: 68,
    targetPrice: 380,
  },
];

export default function AIInsightsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "insights" | "sentiment" | "recommendations"
  >("insights");
  const [insights, setInsights] = useState<MarketInsight[]>(mockInsights);
  const [sentiment, setSentiment] = useState<SentimentData>({
    label: "Moderately Bullish",
    score: 0.65,
    trend: "up",
    description:
      "Market sentiment has improved over the past week with strong earnings reports offsetting inflation concerns.",
  });
  const [recommendations, setRecommendations] =
    useState<Recommendation[]>(mockRecommendations);
  const [selectedTimeframe, setSelectedTimeframe] = useState<
    "1D" | "1W" | "1M" | "3M"
  >("1W");

  const timeframes = [
    { key: "1D", label: "1 Day" },
    { key: "1W", label: "1 Week" },
    { key: "1M", label: "1 Month" },
    { key: "3M", label: "3 Months" },
  ];

  useEffect(() => {
    loadData();
  }, [selectedTimeframe]);

  const loadData = async () => {
    try {
      // In a real app, these would be actual API calls
      const news = await fetchNews("market");
      const sentimentAnalysis = await analyzeNewsSentiment(news);

      setSentiment({
        label: sentimentAnalysis.label,
        score: sentimentAnalysis.overallScore,
        trend:
          sentimentAnalysis.overallScore > 0.6
            ? "up"
            : sentimentAnalysis.overallScore < 0.4
            ? "down"
            : "stable",
        description: `Market sentiment based on analysis of ${news.length} recent news articles and market indicators.`,
      });
    } catch (error) {
      console.error("Error loading AI insights data:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getSentimentColor = (score: number) => {
    if (score >= 0.6) return "text-green-600 dark:text-green-400";
    if (score <= 0.4) return "text-red-600 dark:text-red-400";
    return "text-yellow-600 dark:text-yellow-400";
  };

  const getSentimentIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return "trending-up";
      case "down":
        return "trending-down";
      default:
        return "remove";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80)
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (confidence >= 60)
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "buy":
        return "text-green-600 dark:text-green-400";
      case "sell":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-blue-600 dark:text-blue-400";
    }
  };

  const renderInsight = (insight: MarketInsight, index: number) => (
    <Card key={index} variant="elevated" className="mb-4">
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <View className="flex-row items-center mb-2">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white">
              {insight.title}
            </Text>
            <View
              className={`ml-2 px-2 py-1 rounded-full ${
                insight.type === "bullish"
                  ? "bg-green-100 dark:bg-green-900/30"
                  : insight.type === "bearish"
                  ? "bg-red-100 dark:bg-red-900/30"
                  : "bg-gray-100 dark:bg-gray-700"
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  insight.type === "bullish"
                    ? "text-green-700 dark:text-green-400"
                    : insight.type === "bearish"
                    ? "text-red-700 dark:text-red-400"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {insight.type.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
            {insight.description}
          </Text>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Ionicons name="time-outline" size={14} color="#6b7280" />
              <Text className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                {insight.timeframe}
              </Text>
            </View>
            <View
              className={`px-2 py-1 rounded-lg ${getConfidenceColor(
                insight.confidence
              )}`}
            >
              <Text className="text-xs font-medium">
                {insight.confidence}% confidence
              </Text>
            </View>
          </View>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-1 mt-2">
        {insight.stocks.map((stock) => (
          <View
            key={stock}
            className="bg-indigo-100 dark:bg-indigo-900/30 px-2 py-1 rounded"
          >
            <Text className="text-xs font-medium text-indigo-700 dark:text-indigo-400">
              {stock}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );

  const renderRecommendation = (rec: Recommendation, index: number) => (
    <Card key={index} variant="elevated" className="mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View
            className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
              rec.action === "buy"
                ? "bg-green-100 dark:bg-green-900/30"
                : rec.action === "sell"
                ? "bg-red-100 dark:bg-red-900/30"
                : "bg-blue-100 dark:bg-blue-900/30"
            }`}
          >
            <Ionicons
              name={
                rec.action === "buy"
                  ? "arrow-up"
                  : rec.action === "sell"
                  ? "arrow-down"
                  : "remove"
              }
              size={16}
              color={
                rec.action === "buy"
                  ? "#16a34a"
                  : rec.action === "sell"
                  ? "#dc2626"
                  : "#3b82f6"
              }
            />
          </View>
          <View>
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              {rec.symbol}
            </Text>
            <Text
              className={`text-sm font-medium uppercase ${getActionColor(
                rec.action
              )}`}
            >
              {rec.action}
            </Text>
          </View>
        </View>
        <View
          className={`px-2 py-1 rounded-lg ${getConfidenceColor(
            rec.confidence
          )}`}
        >
          <Text className="text-xs font-medium">{rec.confidence}%</Text>
        </View>
      </View>

      <Text className="text-gray-700 dark:text-gray-300 mb-3">
        {rec.reason}
      </Text>

      {(rec.targetPrice || rec.stopLoss) && (
        <View className="flex-row justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
          {rec.targetPrice && (
            <View>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                Target
              </Text>
              <Text className="font-semibold text-gray-900 dark:text-white">
                ${rec.targetPrice}
              </Text>
            </View>
          )}
          {rec.stopLoss && (
            <View>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                Stop Loss
              </Text>
              <Text className="font-semibold text-gray-900 dark:text-white">
                ${rec.stopLoss}
              </Text>
            </View>
          )}
        </View>
      )}
    </Card>
  );

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
          AI Market Insights
        </Text>
        <Text className="text-white/80">
          Powered by advanced machine learning
        </Text>
      </LinearGradient>

      {/* Tab Navigation */}
      <View className="px-4 -mt-4">
        <Card variant="elevated">
          <View className="flex-row bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {[
              { key: "insights", label: "Insights" },
              { key: "sentiment", label: "Sentiment" },
              { key: "recommendations", label: "Picks" },
            ].map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key as any)}
                className={`flex-1 py-2 rounded-md ${
                  activeTab === tab.key ? "bg-white dark:bg-gray-600" : ""
                }`}
              >
                <Text
                  className={`text-center font-medium ${
                    activeTab === tab.key
                      ? "text-gray-900 dark:text-white"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      </View>

      {/* Timeframe Selector */}
      <View className="px-4 mt-4">
        <Card variant="elevated">
          <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
            Analysis Timeframe
          </Text>
          <View className="flex-row space-x-2">
            {timeframes.map((timeframe) => (
              <Pressable
                key={timeframe.key}
                onPress={() => setSelectedTimeframe(timeframe.key as any)}
                className={`px-3 py-2 rounded-lg ${
                  selectedTimeframe === timeframe.key
                    ? "bg-indigo-600"
                    : "bg-gray-100 dark:bg-gray-700"
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    selectedTimeframe === timeframe.key
                      ? "text-white"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {timeframe.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-4 mt-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "insights" && (
          <View>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                Market Insights
              </Text>
              <Button
                title="Generate New"
                size="sm"
                icon="sparkles"
                onPress={() =>
                  Alert.alert("AI Analysis", "Generating fresh insights...")
                }
              />
            </View>
            {insights.map(renderInsight)}
          </View>
        )}

        {activeTab === "sentiment" && (
          <View>
            <Card variant="elevated" className="mb-4" icon="pulse">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Market Sentiment Analysis
              </Text>

              <View className="items-center mb-6">
                <View className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full items-center justify-center mb-4">
                  <Ionicons
                    name={getSentimentIcon(sentiment.trend)}
                    size={32}
                    color="white"
                  />
                </View>
                <Text
                  className={`text-2xl font-bold ${getSentimentColor(
                    sentiment.score
                  )}`}
                >
                  {sentiment.label}
                </Text>
                <Text className="text-gray-500 dark:text-gray-400 text-center mt-2">
                  Sentiment Score: {(sentiment.score * 100).toFixed(0)}/100
                </Text>
              </View>

              <View className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <Text className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {sentiment.description}
                </Text>
              </View>
            </Card>

            <Card variant="elevated" className="mb-4" icon="bar-chart">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Sentiment Breakdown
              </Text>

              <View className="space-y-3">
                {[
                  {
                    label: "Fear & Greed Index",
                    value: 62,
                    color: "bg-green-500",
                  },
                  {
                    label: "News Sentiment",
                    value: sentiment.score * 100,
                    color: "bg-blue-500",
                  },
                  {
                    label: "Social Media Buzz",
                    value: 45,
                    color: "bg-purple-500",
                  },
                  {
                    label: "Institutional Flow",
                    value: 78,
                    color: "bg-orange-500",
                  },
                ].map((item, index) => (
                  <View key={index}>
                    <View className="flex-row justify-between mb-1">
                      <Text className="text-sm text-gray-700 dark:text-gray-300">
                        {item.label}
                      </Text>
                      <Text className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.value.toFixed(0)}%
                      </Text>
                    </View>
                    <View className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <View
                        className={`h-2 rounded-full ${item.color}`}
                        style={{ width: `${item.value}%` }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        )}

        {activeTab === "recommendations" && (
          <View>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                AI Stock Picks
              </Text>
              <Button
                title="Refresh"
                size="sm"
                icon="refresh"
                onPress={() =>
                  Alert.alert("AI Picks", "Updating recommendations...")
                }
              />
            </View>

            <Card variant="elevated" className="mb-4">
              <Text className="text-center text-sm text-gray-500 dark:text-gray-400 mb-2">
                ⚠️ Disclaimer
              </Text>
              <Text className="text-center text-xs text-gray-400 dark:text-gray-500">
                These are AI-generated suggestions for educational purposes
                only. Not financial advice. Always do your own research.
              </Text>
            </Card>

            {recommendations.map(renderRecommendation)}
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
