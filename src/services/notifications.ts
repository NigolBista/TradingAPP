import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Ensure notifications show while app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<
  string | undefined
> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  const token = tokenData.data;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }
  return token;
}

export async function sendLocalNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
}

export async function scheduleDailyBriefing(
  hour: number = 8,
  minute: number = 0
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Daily Market Brief",
      body: "Your AI-powered market analysis is ready. Check today's signals and opportunities.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function scheduleWeeklyDigest() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Weekly Market Outlook",
      body: "Your weekly market summary and upcoming events analysis is ready.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // Monday
      hour: 7,
      minute: 0,
    },
  });
}

export async function scheduleEducationalTip() {
  const tips = [
    "Remember the 1% rule: Never risk more than 1% of your capital on a single trade.",
    "Support and resistance levels often act as psychological barriers for price movement.",
    "Volume confirms price movement - high volume validates breakouts and reversals.",
    "Risk management is more important than being right on every trade.",
    "Trending markets tend to continue trending until proven otherwise.",
  ];

  const randomTip = tips[Math.floor(Math.random() * tips.length)];

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Trading Tip",
      body: randomTip,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60 * 60 * 24, // 24 hours from now
    },
  });
}

export async function cancelAllScheduledNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleSignalAlert(
  symbol: string,
  action: string,
  confidence: number,
  entry: number
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${symbol} Signal Alert`,
      body: `${action.toUpperCase()} signal (${confidence}% confidence) at $${entry.toFixed(
        2
      )}`,
      data: { symbol, action, confidence, entry },
    },
    trigger: null,
  });
}

export async function sendSignalPushNotification(payload: {
  symbol: string;
  groupId: string;
  entries: number[];
  exits: number[];
  tps: number[];
  timeframe: string;
  groupName?: string;
  ownerName?: string;
}) {
  const title = `${payload.groupName || "Strategy"} shared ${payload.symbol}`;
  const body = `New strategy update (${payload.timeframe}). Tap to view levels.`;
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        screen: "ChartFullScreen",
        symbol: payload.symbol,
        timeframe: payload.timeframe,
        entries: payload.entries,
        exits: payload.exits,
        tps: payload.tps,
        groupId: payload.groupId,
      },
    },
    trigger: null,
  });
}
