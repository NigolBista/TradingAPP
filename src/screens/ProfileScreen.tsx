import React from "react";
import { View, Text, Pressable, Linking } from "react-native";
import { useUserStore } from "../store/userStore";
import { getCustomerPortalUrl } from "../services/stripe";

export default function ProfileScreen() {
  const { profile } = useUserStore();
  async function manageSubscription() {
    const url = await getCustomerPortalUrl();
    if (url) Linking.openURL(url);
  }
  return (
    <View className="flex-1 bg-white dark:bg-black p-4">
      <Text className="text-2xl font-bold text-black dark:text-white mb-1">
        Profile
      </Text>
      <Text className="text-gray-500 dark:text-gray-400 mb-6">
        {profile.email ?? "Signed in user"}
      </Text>
      <View className="space-y-2">
        <Text className="text-black dark:text-white">
          Skill level: {profile.skillLevel}
        </Text>
        <Text className="text-black dark:text-white">
          Trader type: {profile.traderType}
        </Text>
        <Text className="text-black dark:text-white">
          Subscription: {profile.subscriptionTier}
        </Text>
      </View>
      <Pressable
        onPress={manageSubscription}
        className="bg-indigo-600 rounded-xl px-4 py-3 mt-8 items-center"
      >
        <Text className="text-white font-semibold">Manage Subscription</Text>
      </Pressable>
    </View>
  );
}
