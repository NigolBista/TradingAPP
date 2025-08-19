import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Account {
  id: string;
  provider: string;
  accountName: string;
  accountType: string;
  balance: number;
  dayChange: number;
  dayChangePercent: number;
  lastSync?: Date;
  isConnected: boolean;
}

interface Props {
  accounts: Account[];
  onAccountPress?: (account: Account) => void;
  onAddAccountPress?: () => void;
}

export default function AccountsList({
  accounts,
  onAccountPress,
  onAddAccountPress,
}: Props) {
  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1e6) {
      return `$${(value / 1e6).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1e3) {
      return `$${(value / 1e3).toFixed(1)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatLastSync = (date?: Date) => {
    if (!date) return "Never synced";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case "robinhood":
        return "trending-up";
      case "schwab":
        return "business";
      case "fidelity":
        return "shield-checkmark";
      case "etrade":
        return "bar-chart";
      case "webull":
        return "pulse";
      case "td ameritrade":
        return "analytics";
      default:
        return "wallet";
    }
  };

  const isInvestmentAccount = (accountType: string) => {
    const investmentTypes = [
      "brokerage",
      "investment",
      "ira",
      "roth ira",
      "roth",
      "401k",
      "401(k)",
      "403b",
      "403(b)",
      "trading",
      "margin",
      "cash management",
      "retirement",
      "pension",
      "annuity",
      "mutual fund",
      "etf",
      "stock",
      "bond",
      "securities",
    ];

    const accountTypeLower = accountType.toLowerCase();
    const isInvestment = investmentTypes.some((type) =>
      accountTypeLower.includes(type)
    );

    // Debug log to see what account types we're getting
    console.log(
      `Account type: "${accountType}" -> Investment: ${isInvestment}`
    );

    return isInvestment;
  };

  return (
    <View style={styles.container}>
      {accounts.map((account) => (
        <Pressable
          key={account.id}
          style={styles.accountCard}
          onPress={() => onAccountPress?.(account)}
        >
          <View style={styles.accountHeader}>
            <View style={styles.providerRow}>
              <Ionicons
                name={getProviderIcon(account.provider) as any}
                size={20}
                color="#60a5fa"
                style={styles.providerIcon}
              />
              <View>
                <Text style={styles.providerName}>{account.provider}</Text>
                <Text style={styles.accountName}>{account.accountName}</Text>
              </View>
            </View>
            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusDot,
                  account.isConnected
                    ? styles.statusConnected
                    : styles.statusDisconnected,
                ]}
              />
              <Text style={styles.lastSync}>
                {formatLastSync(account.lastSync)}
              </Text>
            </View>
          </View>

          <View style={styles.accountBody}>
            <View style={styles.balanceRow}>
              <Text style={styles.balance}>
                {formatCurrency(account.balance)}
              </Text>
              {isInvestmentAccount(account.accountType) && (
                <Text
                  style={[
                    styles.dayChange,
                    account.dayChangePercent >= 0 ? styles.up : styles.down,
                  ]}
                >
                  {account.dayChangePercent >= 0 ? "▲" : "▼"}{" "}
                  {formatCurrency(Math.abs(account.dayChange))} (
                  {Math.abs(account.dayChangePercent).toFixed(2)}%)
                </Text>
              )}
            </View>
            <Text style={styles.accountType}>{account.accountType}</Text>
          </View>
        </Pressable>
      ))}

      <Pressable style={styles.addAccountCard} onPress={onAddAccountPress}>
        <View style={styles.addAccountContent}>
          <View style={styles.addIconContainer}>
            <Ionicons name="add" size={24} color="#60a5fa" />
          </View>
          <View>
            <Text style={styles.addAccountTitle}>Add New Account</Text>
            <Text style={styles.addAccountSubtitle}>
              Connect your brokerage account
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  title: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  accountCard: {
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 12,
  },
  accountHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  providerIcon: {
    marginRight: 8,
  },
  providerName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  accountName: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 2,
  },
  statusContainer: {
    alignItems: "flex-end",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  statusConnected: {
    backgroundColor: "#10B981",
  },
  statusDisconnected: {
    backgroundColor: "#EF4444",
  },
  lastSync: {
    color: "#6b7280",
    fontSize: 10,
  },
  accountBody: {
    marginTop: 4,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  balance: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  dayChange: {
    fontSize: 12,
    fontWeight: "600",
  },
  accountType: {
    color: "#9ca3af",
    fontSize: 11,
  },
  up: {
    color: "#10B981",
  },
  down: {
    color: "#EF4444",
  },
  addAccountCard: {
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#374151",
    borderStyle: "dashed",
  },
  addAccountContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  addIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1e3a8a",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  addAccountTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  addAccountSubtitle: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 2,
  },
});
