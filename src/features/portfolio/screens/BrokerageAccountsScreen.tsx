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
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../../providers/ThemeProvider";
import PlaidLinkModal from "../../../shared/components/common/PlaidLinkModal";
import {
  plaidIntegrationService,
  PlaidAccount,
} from "../shared/services/plaidIntegration";
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

export default function BrokerageAccountsScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
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
    <View
      key={account.id}
      style={[styles.accountCard, { backgroundColor: theme.colors.card }]}
    >
      <View style={styles.accountHeader}>
        <View style={styles.accountInfo}>
          <View
            style={[
              styles.institutionIcon,
              { backgroundColor: theme.colors.primary + "20" },
            ]}
          >
            <Ionicons name="business" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.accountDetails}>
            <Text
              style={[styles.institutionName, { color: theme.colors.text }]}
            >
              {account.institutionName}
            </Text>
            <Text
              style={[
                styles.accountType,
                { color: theme.colors.textSecondary },
              ]}
            >
              {account.accountType}
            </Text>
            <Text
              style={[styles.lastSync, { color: theme.colors.textSecondary }]}
            >
              Last synced: {new Date(account.lastSync).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <View style={styles.balanceContainer}>
          <Text style={[styles.balance, { color: theme.colors.primary }]}>
            {formatCurrency(account.balance)}
          </Text>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: theme.colors.primary },
            ]}
          />
        </View>
      </View>

      <View style={styles.accountActions}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: theme.colors.surface },
          ]}
          onPress={() => loadConnectedAccounts()}
        >
          <Ionicons
            name="refresh"
            size={16}
            color={theme.colors.textSecondary}
          />
          <Text
            style={[styles.actionText, { color: theme.colors.textSecondary }]}
          >
            Sync
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.disconnectButton]}
          onPress={() =>
            handleDisconnectAccount(account.id, account.institutionName)
          }
        >
          <Ionicons name="unlink" size={16} color={theme.colors.error} />
          <Text style={[styles.actionText, { color: theme.colors.error }]}>
            Disconnect
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && connectedAccounts.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            Loading your accounts...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Header with back button */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: theme.colors.background,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Connected Accounts
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              { color: theme.colors.textSecondary },
            ]}
          >
            Securely connected via Plaid
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          {connectedAccounts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="link"
                size={64}
                color={theme.colors.textSecondary}
              />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                No Accounts Connected
              </Text>
              <Text
                style={[
                  styles.emptySubtitle,
                  { color: theme.colors.textSecondary },
                ]}
              >
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
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Your Holdings
              </Text>
              <HoldingsList positions={positions} scrollEnabled={false} />
            </View>
          )}
        </View>
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
    fontSize: 16,
    marginTop: 16,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  content: {
    paddingTop: 20,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  accountsList: {
    padding: 20,
  },
  accountCard: {
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
    marginBottom: 2,
  },
  accountType: {
    fontSize: 14,
    marginBottom: 2,
    textTransform: "capitalize",
  },
  lastSync: {
    fontSize: 12,
  },
  balanceContainer: {
    alignItems: "flex-end",
  },
  balance: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    gap: 6,
  },
  disconnectButton: {
    backgroundColor: "rgba(220, 38, 38, 0.1)",
  },
  actionText: {
    fontSize: 14,
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
    marginBottom: 16,
  },
});
