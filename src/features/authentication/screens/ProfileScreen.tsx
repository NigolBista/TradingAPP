import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Switch,
  Modal,
  Image,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../providers/AuthProvider";
import { useUserStore } from "../store/userStore";
import { useTheme, type ThemeMode } from "../providers/ThemeProvider";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import {
  scheduleDailyBriefing,
  scheduleWeeklyDigest,
  scheduleEducationalTip,
  cancelAllScheduledNotifications,
} from "../services/notifications";

export default function ProfileScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const profile = useUserStore((state) => state.profile);
  const setProfile = useUserStore((state) => state.setProfile);
  const { theme, themeMode, setThemeMode, isDark } = useTheme();
  const styles = createStyles(theme);

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);

  // Settings state
  const [pushNotifications, setPushNotifications] = useState<boolean>(
    profile?.notificationsEnabled ?? true
  );
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [marketOpen, setMarketOpen] = useState(true);

  const [accountSize, setAccountSize] = useState<string>(
    String(profile?.accountSize ?? 10000)
  );
  const [riskPct, setRiskPct] = useState<string>(
    String(profile?.riskPerTradePct ?? 1)
  );
  const [confThreshold, setConfThreshold] = useState<string>(
    String(profile?.signalConfidenceThreshold ?? 70)
  );
  const [dailyBriefTime, setDailyBriefTime] = useState("8:00");
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [educationalTips, setEducationalTips] = useState(true);

  // Edit profile state
  const [editEmail, setEditEmail] = useState(profile?.email || "");
  const [editSkillLevel, setEditSkillLevel] = useState<string>(
    profile?.skillLevel || "Beginner"
  );
  const [editTraderType, setEditTraderType] = useState<string>(
    profile?.traderType || "Long-term holder"
  );

  const skillLevels = ["Beginner", "Intermediate", "Advanced", "Expert"];
  const traderTypes = [
    "Day trader",
    "Swing trader",
    "Long-term holder",
    "Options trader",
  ];

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } catch (error) {
            Alert.alert("Error", "Failed to logout. Please try again.");
          }
        },
      },
    ]);
  };

  const saveProfile = () => {
    setProfile({
      email: editEmail,
      skillLevel: editSkillLevel as any,
      traderType: editTraderType as any,
      subscriptionTier: profile?.subscriptionTier || "Free",
    });
    setShowEditProfile(false);
    Alert.alert("Success", "Profile updated successfully!");
  };

  const subscriptionFeatures = {
    Free: [
      "Basic charts and indicators",
      "Limited watchlist (10 stocks)",
      "Basic AI insights",
      "Community access",
    ],
    Pro: [
      "Advanced charting tools",
      "Unlimited watchlist",
      "Premium AI insights",
      "Real-time alerts",
      "Portfolio analytics",
      "Priority support",
    ],
    Premium: [
      "Everything in Pro",
      "Advanced market scanner",
      "Custom indicators",
      "Backtesting tools",
      "API access",
      "White-label support",
    ],
  };

  const getCurrentSubscriptionFeatures = () => {
    return (
      subscriptionFeatures[
        profile?.subscriptionTier as keyof typeof subscriptionFeatures
      ] || subscriptionFeatures.Free
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#1a1a1a", "#2a2a2a"] : ["#667eea", "#764ba2"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.email?.charAt(0).toUpperCase() || "U"}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {profile?.email?.split("@")[0] || "User"}
            </Text>
            <Text style={styles.userSubtitle}>
              {profile?.subscriptionTier || "Free"} Plan •{" "}
              {profile?.skillLevel || "Beginner"}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Info */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.profileInfo}>
              <Text style={styles.sectionTitle}>Profile Information</Text>
              <View style={styles.infoContainer}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email:</Text>
                  <Text style={styles.infoValue}>
                    {profile?.email || "Not set"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Level:</Text>
                  <Text style={styles.infoValue}>
                    {profile?.skillLevel || "Not set"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Type:</Text>
                  <Text style={styles.infoValue}>
                    {profile?.traderType || "Not set"}
                  </Text>
                </View>
              </View>
            </View>
            <Pressable
              onPress={() => setShowEditProfile(true)}
              style={styles.editButton}
            >
              <Ionicons name="pencil" size={20} color={theme.colors.primary} />
            </Pressable>
          </View>
        </Card>

        {/* Quick Actions */}
        <Card variant="elevated" style={styles.card}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsContainer}>
            <Pressable
              onPress={() => setShowSubscription(true)}
              style={styles.actionItem}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIcon, styles.subscriptionIcon]}>
                  <Ionicons
                    name="star"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Subscription</Text>
                  <Text style={styles.actionSubtitle}>
                    Manage your plan and billing
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.textSecondary}
              />
            </Pressable>

            <Pressable
              onPress={() => setShowPreferences(true)}
              style={styles.actionItem}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIcon, styles.preferencesIcon]}>
                  <Ionicons
                    name="settings"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Preferences</Text>
                  <Text style={styles.actionSubtitle}>
                    Notifications and app settings
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.textSecondary}
              />
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate("BrokerageAccounts")}
              style={styles.actionItem}
            >
              <View style={styles.actionLeft}>
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: theme.colors.surface },
                  ]}
                >
                  <Ionicons
                    name="trending-up"
                    size={20}
                    color={theme.colors.success}
                  />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Brokerage Accounts</Text>
                  <Text style={styles.actionSubtitle}>
                    Connect your brokerage accounts
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.textSecondary}
              />
            </Pressable>

            <Pressable
              onPress={() =>
                Alert.alert("Help", "Contact support at support@tradegpt.com")
              }
              style={styles.actionItem}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIcon, styles.helpIcon]}>
                  <Ionicons
                    name="help-circle"
                    size={20}
                    color={theme.colors.success}
                  />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Help & Support</Text>
                  <Text style={styles.actionSubtitle}>
                    Get help and contact support
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.textSecondary}
              />
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate("StockNewsApiDemo")}
              style={styles.actionItem}
            >
              <View style={styles.actionLeft}>
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: theme.colors.surface },
                  ]}
                >
                  <Ionicons
                    name="newspaper"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Stock News API Demo</Text>
                  <Text style={styles.actionSubtitle}>
                    Explore Stock News API features
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.textSecondary}
              />
            </Pressable>

            <Pressable
              onPress={() =>
                Alert.alert(
                  "Privacy",
                  "View our privacy policy at tradegpt.com/privacy"
                )
              }
              style={[styles.actionItem, { borderBottomWidth: 0 }]}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIcon, styles.privacyIcon]}>
                  <Ionicons
                    name="shield-checkmark"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Privacy & Security</Text>
                  <Text style={styles.actionSubtitle}>
                    Privacy policy and data settings
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.textSecondary}
              />
            </Pressable>
          </View>
        </Card>

        {/* Current Plan Features */}
        <Card variant="elevated" style={styles.card}>
          <Text style={styles.sectionTitle}>Your Plan Features</Text>
          <View style={styles.planContainer}>
            {getCurrentSubscriptionFeatures().map((feature, index) => (
              <View key={index} style={styles.planItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={theme.colors.success}
                />
                <Text style={styles.planText}>{feature}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Logout Button */}
        <Button
          title="Logout"
          variant="outline"
          icon="log-out"
          onPress={handleLogout}
          style={{ marginBottom: 32, borderColor: theme.colors.error }}
        />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfile}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditProfile(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { justifyContent: "center", alignItems: "center" },
          ]}
        >
          <View style={[styles.modalContent, styles.centerModalCard]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <Pressable onPress={() => setShowEditProfile(false)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.textSecondary}
                />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Input
                label="Email"
                value={editEmail}
                onChangeText={setEditEmail}
                keyboardType="email-address"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.groupLabel}>Skill Level</Text>
              <View style={styles.segmentList}>
                {skillLevels.map((level) => {
                  const active = editSkillLevel === level;
                  return (
                    <Pressable
                      key={level}
                      onPress={() => setEditSkillLevel(level)}
                      style={[
                        styles.segmentItem,
                        active && styles.segmentItemActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          active && styles.segmentTextActive,
                        ]}
                      >
                        {level}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.groupLabel}>Trader Type</Text>
              <View style={styles.segmentList}>
                {traderTypes.map((type) => {
                  const active = editTraderType === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => setEditTraderType(type)}
                      style={[
                        styles.segmentItem,
                        active && styles.segmentItemActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          active && styles.segmentTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Button
              title="Save Changes"
              onPress={saveProfile}
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </Modal>

      {/* Preferences Modal */}
      <Modal
        visible={showPreferences}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPreferences(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { justifyContent: "center", alignItems: "center" },
          ]}
        >
          <View
            style={[
              styles.modalContent,
              styles.centerModalCard,
              styles.modalScrollView,
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Preferences</Text>
              <Pressable onPress={() => setShowPreferences(false)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.textSecondary}
                />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 16 }}>
                {/* Notifications Group */}
                <View style={styles.settingsCard}>
                  <Text style={styles.groupLabel}>Notifications</Text>
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Text style={styles.settingTitle}>
                        Push Notifications
                      </Text>
                      <Text style={styles.settingSubtitle}>
                        Receive notifications on your device
                      </Text>
                    </View>
                    <Switch
                      value={pushNotifications}
                      onValueChange={async (v) => {
                        setPushNotifications(v);
                        setProfile({ notificationsEnabled: v });
                        if (v) {
                          if (dailyBriefTime) {
                            const [hour, minute] = dailyBriefTime.split(":");
                            await scheduleDailyBriefing(
                              parseInt(hour),
                              parseInt(minute)
                            );
                          }
                          if (weeklyDigest) await scheduleWeeklyDigest();
                          if (educationalTips) await scheduleEducationalTip();
                        } else {
                          await cancelAllScheduledNotifications();
                        }
                      }}
                    />
                  </View>
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Text style={styles.settingTitle}>
                        Email Notifications
                      </Text>
                      <Text style={styles.settingSubtitle}>
                        Receive updates via email
                      </Text>
                    </View>
                    <Switch
                      value={emailNotifications}
                      onValueChange={setEmailNotifications}
                    />
                  </View>
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Text style={styles.settingTitle}>Price Alerts</Text>
                      <Text style={styles.settingSubtitle}>
                        Notify when prices hit your targets
                      </Text>
                    </View>
                    <Switch
                      value={priceAlerts}
                      onValueChange={setPriceAlerts}
                    />
                  </View>
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Text style={styles.settingTitle}>
                        Market Open Alerts
                      </Text>
                      <Text style={styles.settingSubtitle}>
                        Daily market opening notifications
                      </Text>
                    </View>
                    <Switch value={marketOpen} onValueChange={setMarketOpen} />
                  </View>
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Text style={styles.settingTitle}>
                        Weekly Market Digest
                      </Text>
                      <Text style={styles.settingSubtitle}>
                        Weekly outlook every Monday morning
                      </Text>
                    </View>
                    <Switch
                      value={weeklyDigest}
                      onValueChange={setWeeklyDigest}
                    />
                  </View>
                  <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
                    <View style={styles.settingLeft}>
                      <Text style={styles.settingTitle}>Educational Tips</Text>
                      <Text style={styles.settingSubtitle}>
                        Daily trading tips and insights
                      </Text>
                    </View>
                    <Switch
                      value={educationalTips}
                      onValueChange={setEducationalTips}
                    />
                  </View>
                </View>

                {/* Schedule Group */}
                <View style={styles.settingsCard}>
                  <Text style={styles.groupLabel}>Schedule</Text>
                  <Input
                    label="Daily Brief Time (HH:MM)"
                    value={dailyBriefTime}
                    onChangeText={setDailyBriefTime}
                    placeholder="8:00"
                  />
                </View>

                {/* Appearance Group */}
                <View style={styles.settingsCard}>
                  <Text style={styles.groupLabel}>Appearance</Text>
                  <View style={styles.segmentList}>
                    {(["system", "light", "dark"] as ThemeMode[]).map(
                      (mode) => {
                        const active = themeMode === mode;
                        return (
                          <Pressable
                            key={mode}
                            onPress={() => setThemeMode(mode)}
                            style={[
                              styles.segmentItem,
                              active && styles.segmentItemActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.segmentText,
                                active && styles.segmentTextActive,
                              ]}
                            >
                              {mode}
                            </Text>
                          </Pressable>
                        );
                      }
                    )}
                  </View>
                  <Text style={styles.settingSubtitle}>
                    Choose your app's appearance
                  </Text>
                </View>

                {/* Trading Preferences */}
                <View style={styles.settingsCard}>
                  <Text style={styles.groupLabel}>Trading Preferences</Text>
                  <Input
                    label="Account Size (USD)"
                    value={accountSize}
                    keyboardType="numeric"
                    onChangeText={(t) => {
                      setAccountSize(t);
                      const n = parseFloat(t);
                      if (!Number.isNaN(n)) setProfile({ accountSize: n });
                    }}
                  />
                  <Input
                    label="Risk per trade (%)"
                    value={riskPct}
                    keyboardType="numeric"
                    onChangeText={(t) => {
                      setRiskPct(t);
                      const n = parseFloat(t);
                      if (!Number.isNaN(n)) setProfile({ riskPerTradePct: n });
                    }}
                  />
                  <Input
                    label="Signal confidence threshold (%)"
                    value={confThreshold}
                    keyboardType="numeric"
                    onChangeText={(t) => {
                      setConfThreshold(t);
                      const n = parseFloat(t);
                      if (!Number.isNaN(n))
                        setProfile({ signalConfidenceThreshold: n });
                    }}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Subscription Modal */}
      <Modal
        visible={showSubscription}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubscription(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: "90%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Subscription Plans</Text>
              <Pressable onPress={() => setShowSubscription(false)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.textSecondary}
                />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {Object.entries(subscriptionFeatures).map(([plan, features]) => {
                const isCurrentPlan = profile?.subscriptionTier === plan;
                const price =
                  plan === "Free"
                    ? "Free"
                    : plan === "Pro"
                    ? "$9.99/mo"
                    : "$19.99/mo";

                return (
                  <View
                    key={plan}
                    style={[
                      styles.subscriptionCard,
                      {
                        borderColor: isCurrentPlan
                          ? theme.colors.primary
                          : theme.colors.border,
                        backgroundColor: isCurrentPlan
                          ? theme.colors.surface
                          : theme.colors.card,
                      },
                    ]}
                  >
                    <View style={styles.subscriptionHeader}>
                      <View>
                        <Text style={styles.subscriptionTitle}>{plan}</Text>
                        <Text style={styles.subscriptionPrice}>{price}</Text>
                      </View>
                      {isCurrentPlan && (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>Current</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.featuresList}>
                      {features.map((feature, index) => (
                        <View key={index} style={styles.featureItem}>
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color={theme.colors.success}
                          />
                          <Text style={styles.featureText}>{feature}</Text>
                        </View>
                      ))}
                    </View>

                    {!isCurrentPlan && (
                      <Button
                        title={`Upgrade to ${plan}`}
                        size="sm"
                        onPress={() =>
                          Alert.alert("Upgrade", `Upgrade to ${plan} plan`)
                        }
                      />
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 48,
      paddingBottom: 24,
    },
    headerContent: {
      flexDirection: "row",
      alignItems: "center",
    },
    avatar: {
      width: 64,
      height: 64,
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 16,
    },
    avatarText: {
      fontSize: 24,
      fontWeight: "bold",
      color: "#ffffff",
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 24,
      fontWeight: "bold",
      color: "#ffffff",
    },
    userSubtitle: {
      color: "rgba(255, 255, 255, 0.8)",
    },
    scrollView: {
      flex: 1,
      paddingHorizontal: 16,
      marginTop: -16,
      backgroundColor: theme.colors.background,
    },
    card: {
      marginBottom: 16,
    },
    profileRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    profileInfo: {
      flex: 1,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 8,
    },
    infoContainer: {
      gap: 8,
    },
    infoRow: {
      flexDirection: "row",
    },
    infoLabel: {
      color: theme.colors.textSecondary,
      width: 96,
    },
    infoValue: {
      color: theme.colors.text,
      flex: 1,
    },
    editButton: {
      padding: 8,
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
    },
    actionsContainer: {
      gap: 12,
    },
    actionItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    actionLeft: {
      flexDirection: "row",
      alignItems: "center",
    },
    actionIcon: {
      width: 40,
      height: 40,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    subscriptionIcon: {
      backgroundColor: theme.colors.surface,
    },
    preferencesIcon: {
      backgroundColor: theme.colors.surface,
    },
    helpIcon: {
      backgroundColor: theme.colors.surface,
    },
    privacyIcon: {
      backgroundColor: theme.colors.surface,
    },
    planContainer: {
      gap: 8,
    },
    planItem: {
      flexDirection: "row",
      alignItems: "center",
    },
    planText: {
      marginLeft: 8,
      color: theme.colors.text,
    },
    modalScrollView: {
      maxHeight: "80%",
    },
    settingsCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    settingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    settingLeft: { flex: 1, paddingRight: 12 },
    settingTitle: { fontSize: 15, fontWeight: "500", color: theme.colors.text },
    settingSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    preferencesContainer: {
      gap: 16,
    },
    preferenceItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    preferenceLeft: {
      flex: 1,
    },
    preferenceTitle: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.text,
    },
    preferenceSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    inputContainer: {
      marginBottom: 12,
    },
    themeContainer: {
      flexDirection: "row",
      gap: 8,
    },
    subscriptionCard: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    subscriptionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    subscriptionTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    subscriptionPrice: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.colors.primary,
    },
    currentBadge: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 16,
    },
    currentBadgeText: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "500",
    },
    featuresList: {
      gap: 8,
      marginBottom: 16,
    },
    featureItem: {
      flexDirection: "row",
      alignItems: "center",
    },
    featureText: {
      marginLeft: 8,
      fontSize: 14,
      color: theme.colors.text,
    },
    actionTitle: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.text,
    },
    actionSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 20,
    },
    centerModalCard: {
      width: "90%",
      maxWidth: 420,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 24,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    formGroup: { marginBottom: 12 },
    groupLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 8,
    },
    segmentList: { gap: 8 },
    segmentItem: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    segmentItemActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    segmentText: { fontSize: 14, color: theme.colors.text },
    segmentTextActive: { color: "#ffffff", fontWeight: "600" },
  });
