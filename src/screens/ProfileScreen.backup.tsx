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
import BrokerageConnectionManager from "../components/common/BrokerageConnectionManager";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const profile = useUserStore((state) => state.profile);
  const setProfile = useUserStore((state) => state.setProfile);
  const { theme, themeMode, setThemeMode } = useTheme();

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showBrokerageSettings, setShowBrokerageSettings] = useState(false);

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
        colors={["#667eea", "#764ba2"]}
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
              <Text style={styles.sectionTitle}>
                Profile Information
              </Text>
              <View style={styles.infoContainer}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>
                    Email:
                  </Text>
                  <Text style={styles.infoValue}>
                    {profile?.email || "Not set"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>
                    Level:
                  </Text>
                  <Text style={styles.infoValue}>
                    {profile?.skillLevel || "Not set"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>
                    Type:
                  </Text>
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
              <Ionicons name="pencil" size={20} color="#6366f1" />
            </Pressable>
          </View>
        </Card>

        {/* Quick Actions */}
        <Card variant="elevated" style={styles.card}>
          <Text style={styles.sectionTitle}>
            Quick Actions
          </Text>
          <View style={styles.actionsContainer}>
            <Pressable
              onPress={() => setShowSubscription(true)}
              className="flex-row items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700"
            >
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg items-center justify-center mr-3">
                  <Ionicons name="star" size={20} color="#8b5cf6" />
                </View>
                <View>
                  <Text className="font-medium text-gray-900 dark:text-white">
                    Subscription
                  </Text>
                  <Text className="text-sm text-gray-500 dark:text-gray-400">
                    Manage your plan and billing
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </Pressable>

            <Pressable
              onPress={() => setShowPreferences(true)}
              className="flex-row items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700"
            >
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg items-center justify-center mr-3">
                  <Ionicons name="settings" size={20} color="#3b82f6" />
                </View>
                <View>
                  <Text className="font-medium text-gray-900 dark:text-white">
                    Preferences
                  </Text>
                  <Text className="text-sm text-gray-500 dark:text-gray-400">
                    Notifications and app settings
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </Pressable>

            <Pressable
              onPress={() => setShowBrokerageSettings(true)}
              style={styles.actionItem}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIcon, { backgroundColor: '#d1fae5' }]}>
                  <Ionicons name="trending-up" size={20} color="#10b981" />
                </View>
                <View>
                  <Text style={styles.actionTitle}>
                    Brokerage Accounts
                  </Text>
                  <Text style={styles.actionSubtitle}>
                    Connect Robinhood & Webull for real-time data
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </Pressable>

            <Pressable
              onPress={() =>
                Alert.alert("Help", "Contact support at support@tradegpt.com")
              }
              className="flex-row items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700"
            >
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg items-center justify-center mr-3">
                  <Ionicons name="help-circle" size={20} color="#16a34a" />
                </View>
                <View>
                  <Text className="font-medium text-gray-900 dark:text-white">
                    Help & Support
                  </Text>
                  <Text className="text-sm text-gray-500 dark:text-gray-400">
                    Get help and contact support
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </Pressable>

            <Pressable
              onPress={() =>
                Alert.alert(
                  "Privacy",
                  "View our privacy policy at tradegpt.com/privacy"
                )
              }
              className="flex-row items-center justify-between py-3"
            >
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg items-center justify-center mr-3">
                  <Ionicons name="shield-checkmark" size={20} color="#ea580c" />
                </View>
                <View>
                  <Text className="font-medium text-gray-900 dark:text-white">
                    Privacy & Security
                  </Text>
                  <Text className="text-sm text-gray-500 dark:text-gray-400">
                    Privacy policy and data settings
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </Pressable>
          </View>
        </Card>

        {/* Current Plan Features */}
        <Card variant="elevated" className="mb-4">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Your Plan Features
          </Text>
          <View className="space-y-2">
            {getCurrentSubscriptionFeatures().map((feature, index) => (
              <View key={index} className="flex-row items-center">
                <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                <Text className="ml-2 text-gray-700 dark:text-gray-300">
                  {feature}
                </Text>
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
          style={{ marginBottom: 32, borderColor: '#ef4444' }}
        />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfile}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditProfile(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-gray-800 rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900 dark:text-white">
                Edit Profile
              </Text>
              <Pressable onPress={() => setShowEditProfile(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </Pressable>
            </View>

            <Input
              label="Email"
              value={editEmail}
              onChangeText={setEditEmail}
              keyboardType="email-address"
              className="mb-4"
            />

            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Skill Level
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {skillLevels.map((level) => (
                  <Pressable
                    key={level}
                    onPress={() => setEditSkillLevel(level)}
                    className={`px-3 py-2 rounded-lg border ${
                      editSkillLevel === level
                        ? "bg-indigo-600 border-indigo-600"
                        : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        editSkillLevel === level
                          ? "text-white"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {level}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="mb-6">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Trader Type
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {traderTypes.map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setEditTraderType(type)}
                    className={`px-3 py-2 rounded-lg border ${
                      editTraderType === type
                        ? "bg-indigo-600 border-indigo-600"
                        : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        editTraderType === type
                          ? "text-white"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {type}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Button title="Save Changes" onPress={saveProfile} />
          </View>
        </View>
      </Modal>

      {/* Preferences Modal */}
      <Modal
        visible={showPreferences}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPreferences(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-gray-800 rounded-t-3xl p-6 max-h-[80%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900 dark:text-white">
                Preferences
              </Text>
              <Pressable onPress={() => setShowPreferences(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="space-y-4">
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="font-medium text-gray-900 dark:text-white">
                      Push Notifications
                    </Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      Receive notifications on your device
                    </Text>
                  </View>
                  <Switch
                    value={pushNotifications}
                    onValueChange={async (v) => {
                      setPushNotifications(v);
                      setProfile({ notificationsEnabled: v });
                      if (v) {
                        // Schedule notifications when enabled
                        if (dailyBriefTime) {
                          const [hour, minute] = dailyBriefTime.split(":");
                          await scheduleDailyBriefing(
                            parseInt(hour),
                            parseInt(minute)
                          );
                        }
                        if (weeklyDigest) {
                          await scheduleWeeklyDigest();
                        }
                        if (educationalTips) {
                          await scheduleEducationalTip();
                        }
                      } else {
                        await cancelAllScheduledNotifications();
                      }
                    }}
                  />
                </View>

                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="font-medium text-gray-900 dark:text-white">
                      Email Notifications
                    </Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      Receive updates via email
                    </Text>
                  </View>
                  <Switch
                    value={emailNotifications}
                    onValueChange={setEmailNotifications}
                  />
                </View>

                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="font-medium text-gray-900 dark:text-white">
                      Price Alerts
                    </Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      Get notified when prices hit your targets
                    </Text>
                  </View>
                  <Switch value={priceAlerts} onValueChange={setPriceAlerts} />
                </View>

                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="font-medium text-gray-900 dark:text-white">
                      Market Open Alerts
                    </Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      Daily market opening notifications
                    </Text>
                  </View>
                  <Switch value={marketOpen} onValueChange={setMarketOpen} />
                </View>

                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="font-medium text-gray-900 dark:text-white">
                      Weekly Market Digest
                    </Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      Weekly outlook every Monday morning
                    </Text>
                  </View>
                  <Switch
                    value={weeklyDigest}
                    onValueChange={setWeeklyDigest}
                  />
                </View>

                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="font-medium text-gray-900 dark:text-white">
                      Educational Tips
                    </Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      Daily trading tips and insights
                    </Text>
                  </View>
                  <Switch
                    value={educationalTips}
                    onValueChange={setEducationalTips}
                  />
                </View>

                <View>
                  <Text className="font-medium text-gray-900 dark:text-white mb-2">
                    Daily Brief Time
                  </Text>
                  <Input
                    label="Time (HH:MM)"
                    value={dailyBriefTime}
                    onChangeText={setDailyBriefTime}
                    placeholder="8:00"
                    className="mb-3"
                  />
                </View>

                <View>
                  <Text className="font-medium text-gray-900 dark:text-white mb-3">
                    Theme
                  </Text>
                  <View className="flex-row space-x-2">
                    {(["system", "light", "dark"] as ThemeMode[]).map(
                      (mode) => (
                        <Pressable
                          key={mode}
                          onPress={() => setThemeMode(mode)}
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor:
                              themeMode === mode ? "#00D4AA" : "#333333",
                            backgroundColor:
                              themeMode === mode ? "#00D4AA20" : "transparent",
                          }}
                        >
                          <Text
                            style={{
                              textAlign: "center",
                              fontSize: 14,
                              fontWeight: "500",
                              color: themeMode === mode ? "#00D4AA" : "#ffffff",
                              textTransform: "capitalize",
                            }}
                          >
                            {mode}
                          </Text>
                        </Pressable>
                      )
                    )}
                  </View>
                  <Text className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Choose your app's appearance
                  </Text>
                </View>

                <View>
                  <Text className="font-medium text-gray-900 dark:text-white mb-2">
                    Trading Preferences
                  </Text>
                  <Input
                    label="Account Size (USD)"
                    value={accountSize}
                    keyboardType="numeric"
                    onChangeText={(t) => {
                      setAccountSize(t);
                      const n = parseFloat(t);
                      if (!Number.isNaN(n)) setProfile({ accountSize: n });
                    }}
                    className="mb-3"
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
                    className="mb-3"
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

      {/* Brokerage Settings Modal */}
      <Modal
        visible={showBrokerageSettings}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBrokerageSettings(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={[styles.modalHeader, { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 16 }]}>
              <Text style={styles.modalTitle}>
                Brokerage Accounts
              </Text>
              <Pressable onPress={() => setShowBrokerageSettings(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </Pressable>
            </View>
            <BrokerageConnectionManager
              onConnectionChange={(providers) => {
                console.log("Connected providers:", providers);
              }}
            />
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
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-gray-800 rounded-t-3xl p-6 max-h-[90%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900 dark:text-white">
                Subscription Plans
              </Text>
              <Pressable onPress={() => setShowSubscription(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
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
                    className={`border rounded-xl p-4 mb-4 ${
                      isCurrentPlan
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <View className="flex-row justify-between items-center mb-3">
                      <View>
                        <Text className="text-lg font-bold text-gray-900 dark:text-white">
                          {plan}
                        </Text>
                        <Text className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                          {price}
                        </Text>
                      </View>
                      {isCurrentPlan && (
                        <View className="bg-indigo-600 px-3 py-1 rounded-full">
                          <Text className="text-white text-sm font-medium">
                            Current
                          </Text>
                        </View>
                      )}
                    </View>

                    <View className="space-y-2 mb-4">
                      {features.map((feature, index) => (
                        <View key={index} className="flex-row items-center">
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color="#16a34a"
                          />
                          <Text className="ml-2 text-gray-700 dark:text-gray-300 text-sm">
                            {feature}
                          </Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  userSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: -16,
  },
  card: {
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileInfo: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  infoContainer: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
  },
  infoLabel: {
    color: '#6b7280',
    width: 96,
  },
  infoValue: {
    color: '#111827',
    flex: 1,
  },
  editButton: {
    padding: 8,
    backgroundColor: '#e0e7ff',
    borderRadius: 8,
  },
  actionsContainer: {
    gap: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
});
