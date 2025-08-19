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
import PlaidLinkModal from "../components/common/PlaidLinkModal";
import {
  plaidIntegrationService,
  PlaidAccount,
} from "../services/plaidIntegration";
import HoldingsList from "../components/portfolio/HoldingsList";

interface ConnectedAccount {
  id: string;
  institutionName: string;
  accountName: string;
  accountType: string;
  balance: number;
  lastSync: string;
  accounts: PlaidAccount[];
}

export default function BrokerageAccountsScreen({ navigation }: any) {
  const [connectedAccounts, setConnectedAccounts] = useState<
    ConnectedAccount[]
  >([]);
  const [showPlaidModal, setShowPlaidModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<any[]>([]);

  useEffect(() => {
    loadConnectedAccounts();
  }, []);

  const loadConnectedAccounts = async () => {
    setLoading(true);
    try {
      const tokens = plaidIntegrationService.getStoredTokens();
      const accounts: ConnectedAccount[] = [];

      for (const token of tokens) {
        try {
          const plaidAccounts = await plaidIntegrationService.getAccounts(
            token
          );
          const investmentAccounts = plaidAccounts.filter(
            (acc) => acc.type === "investment"
          );

          if (investmentAccounts.length > 0) {
            // Get institution name from first account
            const institutionName =
              investmentAccounts[0].official_name?.split(" ")[0] ||
              "Investment Account";

            accounts.push({
              id: token,
              institutionName,
              accountName: `${institutionName} Investment`,
              accountType: "investment",
              balance: investmentAccounts.reduce(
                (sum, acc) => sum + (acc.balances.current || 0),
                0
              ),
              lastSync: new Date().toISOString(),
              accounts: investmentAccounts,
            });
          }
        } catch (error) {
          console.error("Failed to load account data:", error);
        }
      }

      setConnectedAccounts(accounts);

      // Load portfolio positions
      await loadPortfolioPositions();
    } catch (error) {
      console.error("Failed to load connected accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPortfolioPositions = async () => {
    try {
      const tokens = plaidIntegrationService.getStoredTokens();
      const allPositions: any[] = [];

      for (const token of tokens) {
        try {
          const { holdings, securities } =
            await plaidIntegrationService.getHoldings(token);
          const positions = plaidIntegrationService.convertToPortfolioPositions(
            holdings,
            securities
          );
          allPositions.push(...positions);
        } catch (error) {
          console.error("Failed to load positions for token:", error);
        }
      }

      setPositions(allPositions);
    } catch (error) {
      console.error("Failed to load portfolio positions:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConnectedAccounts();
    setRefreshing(false);
  };

  const handlePlaidSuccess = async (publicToken: string, metadata: any) => {
    try {
      setShowPlaidModal(false);
      setLoading(true);

      // Exchange public token for access token
      await plaidIntegrationService.exchangePublicToken(publicToken);

      Alert.alert(
        "Account Connected!",
        `Successfully connected your ${metadata.institution.name} account.`,
        [{ text: "OK" }]
      );

      // Reload accounts
      await loadConnectedAccounts();
    } catch (error) {
      console.error("Failed to connect account:", error);
      Alert.alert(
        "Connection Failed",
        "Failed to connect your account. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectAccount = (
    accountId: string,
    institutionName: string
  ) => {
    Alert.alert(
      "Disconnect Account",
      `Are you sure you want to disconnect your ${institutionName} account?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            // Remove the access token
            // Note: In a real app, you'd also call Plaid's /item/remove endpoint
            await loadConnectedAccounts();
          },
        },
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const renderConnectedAccount = (account: ConnectedAccount) => (
    <View key={account.id} style={styles.accountCard}>
      <View style={styles.accountHeader}>
        <View style={styles.accountInfo}>
          <View style={styles.institutionIcon}>
            <Ionicons name="business" size={24} color="#00D4AA" />
          </View>
          <View style={styles.accountDetails}>
            <Text style={styles.institutionName}>
              {account.institutionName}
            </Text>
            <Text style={styles.accountType}>{account.accountType}</Text>
            <Text style={styles.lastSync}>
              Last synced: {new Date(account.lastSync).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <View style={styles.balanceContainer}>
          <Text style={styles.balance}>{formatCurrency(account.balance)}</Text>
          <View style={styles.statusDot} />
        </View>
      </View>

      <View style={styles.accountActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => loadConnectedAccounts()}
        >
          <Ionicons name="refresh" size={16} color="#666" />
          <Text style={styles.actionText}>Sync</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.disconnectButton]}
          onPress={() =>
            handleDisconnectAccount(account.id, account.institutionName)
          }
        >
          <Ionicons name="unlink" size={16} color="#dc2626" />
          <Text style={[styles.actionText, { color: "#dc2626" }]}>
            Disconnect
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && connectedAccounts.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D4AA" />
          <Text style={styles.loadingText}>Loading your accounts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Connected Accounts</Text>
          <Text style={styles.subtitle}>Securely connected via Plaid</Text>
        </View>

        {connectedAccounts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="link" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Accounts Connected</Text>
            <Text style={styles.emptySubtitle}>
              Connect your brokerage accounts to view your portfolio
            </Text>
          </View>
        ) : (
          <View style={styles.accountsList}>
            {connectedAccounts.map(renderConnectedAccount)}
          </View>
        )}

        <TouchableOpacity
          style={styles.connectButton}
          onPress={() => setShowPlaidModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.connectButtonText}>Connect New Account</Text>
        </TouchableOpacity>

        {positions.length > 0 && (
          <View style={styles.holdingsSection}>
            <Text style={styles.sectionTitle}>Your Holdings</Text>
            <HoldingsList positions={positions} scrollEnabled={false} />
          </View>
        )}
      </ScrollView>

      <PlaidLinkModal
        visible={showPlaidModal}
        onSuccess={handlePlaidSuccess}
        onCancel={() => setShowPlaidModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#999",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  accountsList: {
    padding: 20,
  },
  accountCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  accountHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  accountInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  institutionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#00D4AA20",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  accountDetails: {
    flex: 1,
  },
  institutionName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 2,
  },
  accountType: {
    fontSize: 14,
    color: "#999",
    marginBottom: 2,
    textTransform: "capitalize",
  },
  lastSync: {
    fontSize: 12,
    color: "#666",
  },
  balanceContainer: {
    alignItems: "flex-end",
  },
  balance: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00D4AA",
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00D4AA",
  },
  accountActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
    gap: 6,
  },
  disconnectButton: {
    backgroundColor: "#dc262620",
  },
  actionText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  connectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00D4AA",
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  holdingsSection: {
    padding: 20,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 16,
  },
});
