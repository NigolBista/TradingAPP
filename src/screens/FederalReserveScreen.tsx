import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getFederalReserveData,
  type FedEvent,
  type EconomicIndicator,
  type FedRelease,
} from "../services/federalReserve";

interface Props {
  navigation: any;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0F1C",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#1F2937",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    color: "#9CA3AF",
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    padding: 16,
    alignItems: "center",
  },
  errorText: {
    color: "#EF4444",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#4F46E5",
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  content: {
    padding: 16,
  },

  // Filter tabs
  filterContainer: {
    flexDirection: "row",
    backgroundColor: "#1F2937",
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  filterButtonActive: {
    backgroundColor: "#DC2626",
  },
  filterButtonInactive: {
    backgroundColor: "transparent",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#ffffff",
  },
  filterTextInactive: {
    color: "#9CA3AF",
  },

  // Section styles
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 16,
    lineHeight: 20,
  },

  // Fed Events styles
  eventItem: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  eventHighImpact: {
    borderLeftColor: "#DC2626",
  },
  eventMediumImpact: {
    borderLeftColor: "#F59E0B",
  },
  eventLowImpact: {
    borderLeftColor: "#10B981",
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    flex: 1,
    marginRight: 12,
  },
  eventBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  eventBadgeHigh: {
    backgroundColor: "#DC2626",
  },
  eventBadgeMedium: {
    backgroundColor: "#F59E0B",
  },
  eventBadgeLow: {
    backgroundColor: "#10B981",
  },
  eventBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
    marginLeft: 4,
  },
  eventDescription: {
    fontSize: 14,
    color: "#D1D5DB",
    lineHeight: 20,
    marginBottom: 8,
  },
  eventMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eventDate: {
    fontSize: 12,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  eventType: {
    fontSize: 12,
    color: "#6B7280",
    textTransform: "capitalize",
  },

  // Economic Indicators styles
  indicatorsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  indicatorCard: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    minWidth: "48%",
    flex: 1,
    borderWidth: 1,
    borderColor: "#374151",
  },
  indicatorTitle: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 8,
    fontWeight: "500",
  },
  indicatorValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  indicatorValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  indicatorUnit: {
    fontSize: 14,
    color: "#9CA3AF",
    marginLeft: 2,
  },
  indicatorChange: {
    fontSize: 13,
    fontWeight: "600",
    flexDirection: "row",
    alignItems: "center",
  },
  indicatorPositive: {
    color: "#10B981",
  },
  indicatorNegative: {
    color: "#EF4444",
  },
  indicatorDate: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
  },

  // Releases styles
  releaseItem: {
    backgroundColor: "#1F2937",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  releaseInfo: {
    flex: 1,
  },
  releaseTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 4,
  },
  releaseDate: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  releaseLink: {
    padding: 8,
  },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    color: "#9CA3AF",
    fontSize: 16,
    textAlign: "center",
    marginTop: 12,
  },

  lastUpdated: {
    textAlign: "center",
    fontSize: 11,
    color: "#6B7280",
    marginTop: 24,
    fontStyle: "italic",
  },
});

type FilterType = "all" | "events" | "indicators" | "releases";

export default function FederalReserveScreen({ navigation }: Props) {
  const [data, setData] = useState<{
    events: FedEvent[];
    indicators: EconomicIndicator[];
    releases: FedRelease[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");

  const loadFederalReserveData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const fedData = await getFederalReserveData();
      setData(fedData);
    } catch (err) {
      console.error("Federal Reserve Data Error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load Federal Reserve data"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFederalReserveData();
  }, []);

  const handleRefresh = () => {
    loadFederalReserveData(true);
  };

  const handleRetry = () => {
    setError(null);
    loadFederalReserveData();
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case "high":
        return "alert-circle";
      case "medium":
        return "warning";
      case "low":
        return "information-circle";
      default:
        return "help-circle";
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "#DC2626";
      case "medium":
        return "#F59E0B";
      case "low":
        return "#10B981";
      default:
        return "#6B7280";
    }
  };

  const filteredEvents =
    data?.events.filter((event) => {
      if (filter === "all") return true;
      if (filter === "events") return true;
      return false;
    }) || [];

  const filteredIndicators = data?.indicators || [];
  const filteredReleases = data?.releases || [];

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </Pressable>
            <View>
              <Text style={styles.headerTitle}>Federal Reserve</Text>
              <Text style={styles.headerSubtitle}>Economic Policy & Data</Text>
            </View>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.loadingText}>
            Loading Federal Reserve data...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </Pressable>
            <View>
              <Text style={styles.headerTitle}>Federal Reserve</Text>
              <Text style={styles.headerSubtitle}>Economic Policy & Data</Text>
            </View>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Federal Reserve</Text>
            <Text style={styles.headerSubtitle}>Economic Policy & Data</Text>
          </View>
        </View>
        <Pressable style={styles.refreshButton} onPress={handleRefresh}>
          <Ionicons
            name={refreshing ? "hourglass" : "refresh"}
            size={20}
            color="#9CA3AF"
          />
        </Pressable>
      </View>

      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#DC2626"
            colors={["#DC2626"]}
          />
        }
      >
        <View style={styles.content}>
          {/* Filter Tabs */}
          <View style={styles.filterContainer}>
            {[
              { key: "all", label: "All" },
              { key: "events", label: "Events" },
              { key: "indicators", label: "Data" },
              { key: "releases", label: "Releases" },
            ].map((tab) => (
              <Pressable
                key={tab.key}
                style={[
                  styles.filterButton,
                  filter === tab.key
                    ? styles.filterButtonActive
                    : styles.filterButtonInactive,
                ]}
                onPress={() => setFilter(tab.key as FilterType)}
              >
                <Text
                  style={[
                    styles.filterText,
                    filter === tab.key
                      ? styles.filterTextActive
                      : styles.filterTextInactive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Federal Reserve Events */}
          {(filter === "all" || filter === "events") && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>
                <Ionicons
                  name="calendar"
                  size={20}
                  color="#DC2626"
                  style={styles.sectionIcon}
                />
                Upcoming Events & Meetings
              </Text>
              <Text style={styles.sectionSubtitle}>
                Federal Reserve meetings, policy announcements, and key economic
                releases
              </Text>

              {filteredEvents.length > 0 ? (
                filteredEvents
                  .filter(
                    (event) =>
                      event.impact === "high" || event.impact === "medium"
                  )
                  .map((event, index) => (
                    <View
                      key={index}
                      style={[
                        styles.eventItem,
                        event.impact === "high"
                          ? styles.eventHighImpact
                          : event.impact === "medium"
                          ? styles.eventMediumImpact
                          : styles.eventLowImpact,
                      ]}
                    >
                      <View style={styles.eventHeader}>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        <View
                          style={[
                            styles.eventBadge,
                            event.impact === "high"
                              ? styles.eventBadgeHigh
                              : event.impact === "medium"
                              ? styles.eventBadgeMedium
                              : styles.eventBadgeLow,
                          ]}
                        >
                          <Ionicons
                            name={getImpactIcon(event.impact)}
                            size={12}
                            color="#ffffff"
                          />
                          <Text style={styles.eventBadgeText}>
                            {event.impact.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.eventDescription}>
                        {event.description}
                      </Text>
                      <View style={styles.eventMeta}>
                        <Text style={styles.eventDate}>
                          {new Date(event.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </Text>
                        <Text style={styles.eventType}>
                          {event.type} • {event.category.replace("_", " ")}
                        </Text>
                      </View>
                    </View>
                  ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="calendar-outline" size={48} color="#6B7280" />
                  <Text style={styles.emptyText}>
                    No upcoming Federal Reserve events
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Economic Indicators */}
          {(filter === "all" || filter === "indicators") && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>
                <Ionicons
                  name="analytics"
                  size={20}
                  color="#F59E0B"
                  style={styles.sectionIcon}
                />
                Key Economic Indicators
              </Text>
              <Text style={styles.sectionSubtitle}>
                Latest economic data from the Federal Reserve Economic Database
                (FRED)
              </Text>

              {filteredIndicators.length > 0 ? (
                <View style={styles.indicatorsGrid}>
                  {filteredIndicators.map((indicator, index) => (
                    <View key={index} style={styles.indicatorCard}>
                      <Text style={styles.indicatorTitle}>
                        {indicator.title}
                      </Text>
                      <View style={styles.indicatorValueRow}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "baseline",
                          }}
                        >
                          <Text style={styles.indicatorValue}>
                            {typeof indicator.value === "number"
                              ? indicator.value.toFixed(
                                  indicator.unit === "%" ? 2 : 1
                                )
                              : indicator.value}
                          </Text>
                          <Text style={styles.indicatorUnit}>
                            {indicator.unit}
                          </Text>
                        </View>
                        {indicator.changePercent !== null &&
                          indicator.changePercent !== undefined && (
                            <View
                              style={[
                                styles.indicatorChange,
                                indicator.changePercent > 0
                                  ? styles.indicatorPositive
                                  : styles.indicatorNegative,
                              ]}
                            >
                              <Ionicons
                                name={
                                  indicator.changePercent > 0
                                    ? "trending-up"
                                    : "trending-down"
                                }
                                size={12}
                                color={
                                  indicator.changePercent > 0
                                    ? "#10B981"
                                    : "#EF4444"
                                }
                              />
                              <Text
                                style={[
                                  styles.indicatorChange,
                                  indicator.changePercent > 0
                                    ? styles.indicatorPositive
                                    : styles.indicatorNegative,
                                ]}
                              >
                                {indicator.changePercent > 0 ? "+" : ""}
                                {indicator.changePercent.toFixed(1)}%
                              </Text>
                            </View>
                          )}
                      </View>
                      <Text style={styles.indicatorDate}>
                        Updated: {new Date(indicator.date).toLocaleDateString()}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons
                    name="analytics-outline"
                    size={48}
                    color="#6B7280"
                  />
                  <Text style={styles.emptyText}>
                    No economic indicators available
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Federal Reserve Releases */}
          {(filter === "all" || filter === "releases") && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>
                <Ionicons
                  name="document-text"
                  size={20}
                  color="#10B981"
                  style={styles.sectionIcon}
                />
                Recent Releases
              </Text>
              <Text style={styles.sectionSubtitle}>
                Official Federal Reserve publications and data releases
              </Text>

              {filteredReleases.length > 0 ? (
                filteredReleases.slice(0, 10).map((release, index) => (
                  <View key={index} style={styles.releaseItem}>
                    <View style={styles.releaseInfo}>
                      <Text style={styles.releaseTitle}>{release.name}</Text>
                      <Text style={styles.releaseDate}>
                        Released:{" "}
                        {new Date(release.releaseDate).toLocaleDateString()}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.releaseLink}
                      onPress={() => {
                        // TODO: Open release link
                        Alert.alert(
                          "Release Link",
                          `Would open: ${release.link}`
                        );
                      }}
                    >
                      <Ionicons name="open-outline" size={20} color="#4F46E5" />
                    </Pressable>
                  </View>
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="document-outline" size={48} color="#6B7280" />
                  <Text style={styles.emptyText}>
                    No recent releases available
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Last Updated */}
          <Text style={styles.lastUpdated}>
            Last updated: {new Date().toLocaleString()}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
