import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  brokerageAuthService,
  BrokerageProvider,
  AuthResult,
} from "../services/brokerageAuth";
import { brokerageApiService } from "../services/brokerageApiService";
import BrokerageAuthWebView from "../components/common/BrokerageAuthWebView";

export default function BrokerageAccountsScreen({ navigation }: any) {
  const [activeSessions, setActiveSessions] = useState<BrokerageProvider[]>([]);
  const [showAuthModal, setShowAuthModal] = useState<BrokerageProvider | null>(
    null
  );
  const [connectionStatus, setConnectionStatus] = useState<
    Record<BrokerageProvider, boolean>
  >({
    robinhood: false,
    webull: false,
  });
  const [checking, setChecking] = useState<Record<BrokerageProvider, boolean>>({
    robinhood: false,
    webull: false,
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadActiveSessions();
  }, []);

  const loadActiveSessions = async () => {
    const sessions = brokerageAuthService.getActiveSessions();
    setActiveSessions(sessions);

    // Test connections for active sessions
    for (const provider of sessions) {
      await testConnection(provider, false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActiveSessions();
    setRefreshing(false);
  };

  const handleConnect = (provider: BrokerageProvider) => {
    setShowAuthModal(provider);
  };

  const handleAuthSuccess = async (result: AuthResult) => {
    setShowAuthModal(null);

    if (result.success && result.session) {
      await loadActiveSessions();
      Alert.alert(
        "Success!",
        `Successfully connected to ${
          result.session.provider.charAt(0).toUpperCase() +
          result.session.provider.slice(1)
        }`,
        [{ text: "OK" }]
      );
    }
  };

  const handleDisconnect = (provider: BrokerageProvider) => {
    Alert.alert(
      "Disconnect Account",
      `Are you sure you want to disconnect from ${
        provider.charAt(0).toUpperCase() + provider.slice(1)
      }?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            await brokerageAuthService.clearSession(provider);
            await loadActiveSessions();
          },
        },
      ]
    );
  };

  const testConnection = async (
    provider: BrokerageProvider,
    showAlert = true
  ) => {
    setChecking((prev) => ({ ...prev, [provider]: true }));

    try {
      const isConnected = await brokerageApiService.checkConnection(provider);
      setConnectionStatus((prev) => ({ ...prev, [provider]: isConnected }));

      if (showAlert) {
        Alert.alert(
          "Connection Test",
          isConnected
            ? "Connection is working properly!"
            : "Connection failed. You may need to re-authenticate.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      setConnectionStatus((prev) => ({ ...prev, [provider]: false }));
      if (showAlert) {
        Alert.alert(
          "Connection Test Failed",
          "Unable to connect. Please try re-authenticating.",
          [{ text: "OK" }]
        );
      }
    } finally {
      setChecking((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const getProviderInfo = (provider: BrokerageProvider) => {
    switch (provider) {
      case "robinhood":
        return {
          name: "Robinhood",
          icon: "trending-up" as keyof typeof Ionicons.glyphMap,
          color: "#00C851",
          description: "Commission-free stock trading",
          features: [
            "Real-time quotes",
            "Portfolio tracking",
            "Position data",
            "Watchlist sync",
          ],
        };
      case "webull":
        return {
          name: "Webull",
          icon: "bar-chart" as keyof typeof Ionicons.glyphMap,
          color: "#FFD700",
          description: "Advanced trading platform",
          features: [
            "Advanced charts",
            "Level 2 data",
            "Options trading",
            "Portfolio analytics",
          ],
        };
    }
  };

  const renderProviderCard = (provider: BrokerageProvider) => {
    const info = getProviderInfo(provider);
    const isConnected = activeSessions.includes(provider);
    const isHealthy = connectionStatus[provider];
    const isChecking = checking[provider];

    return (
      <View key={provider} style={styles.providerCard}>
        {/* Header */}
        <View style={styles.providerHeader}>
          <View style={styles.providerInfo}>
            <View
              style={[
                styles.providerIcon,
                { backgroundColor: info.color + "20" },
              ]}
            >
              <Ionicons name={info.icon} size={28} color={info.color} />
            </View>
            <View style={styles.providerDetails}>
              <Text style={styles.providerName}>{info.name}</Text>
              <Text style={styles.providerDescription}>{info.description}</Text>
            </View>
          </View>

          <View style={styles.statusContainer}>
            {isChecking ? (
              <ActivityIndicator size="small" color={info.color} />
            ) : (
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: isConnected
                      ? isHealthy
                        ? "#00C851"
                        : "#FF9500"
                      : "#D1D5DB",
                  },
                ]}
              />
            )}
          </View>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Features:</Text>
          <View style={styles.featuresList}>
            {info.features.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={info.color}
                />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.providerActions}>
          <Text
            style={[
              styles.statusText,
              {
                color: isConnected
                  ? isHealthy
                    ? "#00C851"
                    : "#FF9500"
                  : "#6B7280",
              },
            ]}
          >
            {isConnected
              ? isHealthy
                ? "Connected & Healthy"
                : "Connected (Issues Detected)"
              : "Not Connected"}
          </Text>

          <View style={styles.actionButtons}>
            {isConnected ? (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.testButton]}
                  onPress={() => testConnection(provider)}
                  disabled={isChecking}
                >
                  <Text style={styles.testButtonText}>Test</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.disconnectButton]}
                  onPress={() => handleDisconnect(provider)}
                >
                  <Text style={styles.disconnectButtonText}>Disconnect</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.connectButton, { backgroundColor: info.color }]}
                onPress={() => handleConnect(provider)}
              >
                <Text style={styles.connectButtonText}>Connect</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderStats = () => {
    const connectedCount = activeSessions.length;
    const healthyCount = activeSessions.filter(
      (provider) => connectionStatus[provider]
    ).length;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Ionicons name="link" size={24} color="#6366f1" />
          </View>
          <Text style={styles.statNumber}>{connectedCount}</Text>
          <Text style={styles.statLabel}>Connected</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Ionicons name="shield-checkmark" size={24} color="#10b981" />
          </View>
          <Text style={styles.statNumber}>{healthyCount}</Text>
          <Text style={styles.statLabel}>Healthy</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Ionicons name="apps" size={24} color="#f59e0b" />
          </View>
          <Text style={styles.statNumber}>2</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
      </View>
    );
  };

  const renderInfoSection = () => (
    <View style={styles.infoSection}>
      <Text style={styles.infoTitle}>How It Works</Text>

      <View style={styles.infoCard}>
        <Ionicons name="log-in" size={20} color="#6366f1" />
        <View style={styles.infoContent}>
          <Text style={styles.infoCardTitle}>Secure Login</Text>
          <Text style={styles.infoText}>
            Login using the official brokerage websites in a secure WebView
          </Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="shield-checkmark" size={20} color="#10b981" />
        <View style={styles.infoContent}>
          <Text style={styles.infoCardTitle}>Encrypted Storage</Text>
          <Text style={styles.infoText}>
            Your session data is encrypted and stored securely on your device
          </Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="time" size={20} color="#f59e0b" />
        <View style={styles.infoContent}>
          <Text style={styles.infoCardTitle}>Rate Limited</Text>
          <Text style={styles.infoText}>
            Data refreshes every 10-15 minutes to respect platform limits
          </Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="warning" size={20} color="#ef4444" />
        <View style={styles.infoContent}>
          <Text style={styles.infoCardTitle}>Personal Use Only</Text>
          <Text style={styles.infoText}>
            This feature is for personal portfolio tracking only
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Brokerage Accounts</Text>
        <TouchableOpacity onPress={onRefresh} disabled={refreshing}>
          <Ionicons
            name={refreshing ? "hourglass" : "refresh"}
            size={24}
            color="#6366f1"
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats */}
        {renderStats()}

        {/* Provider Cards */}
        <View style={styles.providersContainer}>
          <Text style={styles.sectionTitle}>Available Providers</Text>
          {(["robinhood", "webull"] as BrokerageProvider[]).map(
            renderProviderCard
          )}
        </View>

        {/* Info Section */}
        {renderInfoSection()}
      </ScrollView>

      {/* Auth Modal */}
      {showAuthModal && (
        <BrokerageAuthWebView
          provider={showAuthModal}
          onAuthSuccess={handleAuthSuccess}
          onCancel={() => setShowAuthModal(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  providersContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 16,
  },
  providerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  providerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  providerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  providerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  providerDetails: {
    flex: 1,
  },
  providerName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  providerDescription: {
    fontSize: 16,
    color: "#6b7280",
  },
  statusContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  featuresList: {
    gap: 8,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: "#6b7280",
  },
  providerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  testButton: {
    borderColor: "#6366f1",
    backgroundColor: "#f8fafc",
  },
  testButtonText: {
    color: "#6366f1",
    fontSize: 14,
    fontWeight: "600",
  },
  disconnectButton: {
    borderColor: "#ef4444",
    backgroundColor: "#fef2f2",
  },
  disconnectButtonText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "600",
  },
  connectButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  connectButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  infoSection: {
    padding: 20,
    paddingTop: 0,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 16,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
});
