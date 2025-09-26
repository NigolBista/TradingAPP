import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AccountsList from "../components/insights/AccountsList";
import { useAppDataStore } from "../store/appDataStore";
import { useTheme, type Theme } from "../providers/ThemeProvider";

export default function AccountsOverviewScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const refresh = useAppDataStore((state) => state.refresh);
  const isRefreshing = useAppDataStore((state) => state.isRefreshing);
  const accounts = useAppDataStore((state) => state.accounts);

  const [selectedAccountTab, setSelectedAccountTab] = useState<string>("All");

  const accountTabs = useMemo(() => {
    const categories = ["All", ...new Set(accounts.map((a) => a.category))];
    return categories;
  }, [accounts]);
  const filteredAccounts = useMemo(() => {
    if (selectedAccountTab === "All") return accounts;
    return accounts.filter((a) => a.category === selectedAccountTab);
  }, [accounts, selectedAccountTab]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { borderColor: theme.colors.border }]}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Accounts</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View style={[styles.section, styles.accountsSection]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Accounts Overview</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Review balances across all accounts.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.accountTabsContainer}
            contentContainerStyle={styles.accountTabsContent}
          >
            {accountTabs.map((tab) => (
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
            accounts={filteredAccounts}
            onAccountPress={() => navigation.navigate("BrokerageAccounts")}
            onAddAccountPress={() => navigation.navigate("BrokerageAccounts")}
          />

          {filteredAccounts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="radio"
                size={48}
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
                Connect your brokerage accounts to view balances and holdings.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(255,255,255,0.04)"
          : "rgba(15,23,42,0.04)",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 32,
    },
    section: {
      backgroundColor: "transparent",
      marginTop: 16,
    },
    accountsSection: {
      backgroundColor: "transparent",
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
    },
    sectionDescription: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    accountTabsContainer: {
      marginBottom: 16,
      backgroundColor: "transparent",
      borderRadius: 0,
      padding: 0,
    },
    accountTabsContent: {
      paddingHorizontal: 0,
    },
    accountTab: {
      paddingVertical: 8,
      paddingHorizontal: 20,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: "transparent",
    },
    accountTabActive: {
      borderColor: theme.colors.primary,
      backgroundColor:
        theme.mode === "dark"
          ? theme.colors.primary + "33"
          : theme.colors.primary + "14",
    },
    accountTabText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    accountTabTextActive: {
      color: theme.colors.primary,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: 32,
      gap: 12,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600",
    },
    emptySubtitle: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      paddingHorizontal: 24,
    },
  });
