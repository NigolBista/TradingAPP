import React from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import MarketOverview from "../components/insights/MarketOverview";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0F1C",
  },
});

export default function MarketOverviewScreen() {
  const navigation = useNavigation();

  const handleNewsPress = () => {
    // Navigate to news insights screen
    navigation.navigate("NewsInsights" as never);
  };

  return (
    <SafeAreaView style={styles.container}>
      <MarketOverview
        onNewsPress={handleNewsPress}
        navigation={navigation}
        fullWidth={true}
        compact={false}
      />
    </SafeAreaView>
  );
}
