import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  brokerageAuthService,
  BrokerageProvider,
  AuthResult,
} from "../../../features/authentication/services/brokerageAuth";
import { brokerageApiService } from "../../services/brokerageApiService";
import BrokerageAuthWebView from "../../../features/authentication/components/BrokerageAuthWebView";

interface Props {
  onConnectionChange?: (providers: BrokerageProvider[]) => void;
}

export default function BrokerageConnectionManager({
  onConnectionChange,
}: Props) {
  const [activeSessions, setActiveSessions] = useState<BrokerageProvider[]>([]);
  const [showAuthModal, setShowAuthModal] = useState<BrokerageProvider | null>(
    null
  );
  const [connectionStatus, setConnectionStatus] = useState<
    Partial<Record<BrokerageProvider, boolean>>
  >({
    robinhood: false,
    webull: false,
  });
  const [checking, setChecking] = useState<Partial<Record<BrokerageProvider, boolean>>>({
    robinhood: false,
    webull: false,
  });

  useEffect(() => {
    loadActiveSessions();
  }, []);

  const loadActiveSessions = async () => {
    const sessions = await brokerageAuthService.getActiveSessions();
    const providers = sessions.map(session => session.provider as BrokerageProvider);
    setActiveSessions(providers);

    // Check connection status for each active session
    const statusPromises = providers.map(async (provider) => {
      setChecking((prev) => ({ ...prev, [provider]: true }));
      try {
        const isConnected = await brokerageApiService.checkConnection(provider);
        setConnectionStatus((prev) => ({ ...prev, [provider]: isConnected }));
      } catch (error) {
        setConnectionStatus((prev) => ({ ...prev, [provider]: false }));
      } finally {
        setChecking((prev) => ({ ...prev, [provider]: false }));
      }
    });

    await Promise.all(statusPromises);
    onConnectionChange?.(providers);
  };

  const handleConnect = (provider: BrokerageProvider) => {
    setShowAuthModal(provider);
  };

  const handleAuthSuccess = async (result: AuthResult) => {
    setShowAuthModal(null);

    if (result.success && result.session) {
      await loadActiveSessions();

      // Automatically test the connection and try to fetch initial data
      setTimeout(async () => {
        console.log(
          `Testing connection for ${result.session!.provider} after auth success`
        );
        await testConnectionAndFetchData(result.session!.provider as BrokerageProvider);
      }, 2000);

      Alert.alert(
        "Success!",
        `Successfully connected to ${
          result.session!.provider.charAt(0).toUpperCase() +
          result.session!.provider.slice(1)
        }. Fetching your data...`,
        [{ text: "OK" }]
      );
    }
  };

  const testConnectionAndFetchData = async (provider: BrokerageProvider) => {
    try {
      console.log(`Testing connection and fetching data for ${provider}`);

      // Test basic connection
      const isConnected = await brokerageApiService.checkConnection(provider);
      setConnectionStatus((prev) => ({ ...prev, [provider]: isConnected }));

      if (isConnected) {
        console.log(`Connection successful for ${provider}, fetching data...`);

        // Try to fetch some data to verify the session is working
        try {
          // Test fetching positions
          const positions = await brokerageApiService.getPositions(provider);
          console.log(`Fetched ${positions.length} positions from ${provider}`);

          // Test fetching watchlist
          const watchlist = await brokerageApiService.getWatchlist(provider);
          console.log(
            `Fetched ${watchlist.length} watchlist items from ${provider}`
          );

          console.log(`Data fetching successful for ${provider}!`);
        } catch (dataError) {
          console.warn(`Data fetching failed for ${provider}:`, dataError);
          // Connection works but data fetching failed - might need re-authentication
          setConnectionStatus((prev) => ({ ...prev, [provider]: false }));
        }
      } else {
        console.warn(`Connection test failed for ${provider}`);
      }
    } catch (error) {
      console.error(`Failed to test connection for ${provider}:`, error);
      setConnectionStatus((prev) => ({ ...prev, [provider]: false }));
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

  const handleTestConnection = async (provider: BrokerageProvider) => {
    setChecking((prev) => ({ ...prev, [provider]: true }));

    try {
      const isConnected = await brokerageApiService.checkConnection(provider);
      setConnectionStatus((prev) => ({ ...prev, [provider]: isConnected }));

      Alert.alert(
        "Connection Test",
        isConnected
          ? "Connection is working properly!"
          : "Connection failed. You may need to re-authenticate.",
        [{ text: "OK" }]
      );
    } catch (error) {
      setConnectionStatus((prev) => ({ ...prev, [provider]: false }));
      Alert.alert(
        "Connection Test Failed",
        "Unable to connect. Please try re-authenticating.",
        [{ text: "OK" }]
      );
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
        };
      case "webull":
        return {
          name: "Webull",
          icon: "bar-chart" as keyof typeof Ionicons.glyphMap,
          color: "#FFD700",
          description: "Advanced trading platform",
        };
      default:
        return {
          name: provider.charAt(0).toUpperCase() + provider.slice(1),
          icon: "business" as keyof typeof Ionicons.glyphMap,
          color: "#666666",
          description: "Financial services provider",
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
        <View style={styles.providerHeader}>
          <View style={styles.providerInfo}>
            <View
              style={[
                styles.providerIcon,
                { backgroundColor: info.color + "20" },
              ]}
            >
              <Ionicons name={info.icon} size={24} color={info.color} />
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
                    backgroundColor:
                      isConnected && isHealthy
                        ? "#00C851"
                        : isConnected
                        ? "#FF9500"
                        : "#FF3B30",
                  },
                ]}
              />
            )}
          </View>
        </View>

        <View style={styles.providerActions}>
          {isConnected ? (
            <>
              <Text
                style={[
                  styles.statusText,
                  { color: isHealthy ? "#00C851" : "#FF9500" },
                ]}
              >
                {isHealthy
                  ? "Connected & Active"
                  : "Connected (Check Required)"}
              </Text>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.testButton]}
                  onPress={() => handleTestConnection(provider)}
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
              </View>
            </>
          ) : (
            <>
              <Text style={styles.statusText}>Not Connected</Text>
              <TouchableOpacity
                style={[styles.connectButton, { backgroundColor: info.color }]}
                onPress={() => handleConnect(provider)}
              >
                <Text style={styles.connectButtonText}>Connect</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.providersContainer}>
          {(["robinhood", "webull"] as BrokerageProvider[]).map(
            renderProviderCard
          )}
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark" size={20} color="#00C851" />
            <Text style={styles.infoText}>
              Your credentials are encrypted and stored securely on your device
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Ionicons name="time" size={20} color="#007AFF" />
            <Text style={styles.infoText}>
              Data is refreshed every 10-15 minutes to stay within rate limits
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Ionicons name="warning" size={20} color="#FF9500" />
            <Text style={styles.infoText}>
              This feature is for personal use only. Respect platform terms of
              service
            </Text>
          </View>
        </View>
      </ScrollView>

      {showAuthModal && (
        <BrokerageAuthWebView
          provider={showAuthModal}
          onAuthSuccess={handleAuthSuccess}
          onCancel={() => setShowAuthModal(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    lineHeight: 22,
  },
  providersContainer: {
    padding: 20,
    paddingTop: 10,
  },
  providerCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  providerDetails: {
    flex: 1,
  },
  providerName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 2,
  },
  providerDescription: {
    fontSize: 14,
    color: "#666",
  },
  statusContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  providerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  testButton: {
    borderColor: "#007AFF",
  },
  testButtonText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "500",
  },
  disconnectButton: {
    borderColor: "#FF3B30",
  },
  disconnectButtonText: {
    color: "#FF3B30",
    fontSize: 14,
    fontWeight: "500",
  },
  connectButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  connectButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  infoSection: {
    padding: 20,
    paddingTop: 0,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 12,
    flex: 1,
    lineHeight: 18,
  },
});
