import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ExtendedTimeframe } from "../../components/charts/TimeframePickerModal";
import { type ChartType } from "../../components/charts/ChartSettingsModal";

type Props = {
  visible: boolean;
  onClose: () => void;
  chartType: ChartType;
  onSelectChartType: (t: ChartType) => void;
  extendedTf: ExtendedTimeframe;
  pinned: ExtendedTimeframe[];
  onTogglePin: (tf: ExtendedTimeframe) => Promise<boolean> | boolean;
  showSessions: boolean;
  onSetShowSessions: (enabled: boolean) => void;
  showReasonIcon: boolean;
  onSetShowReasonIcon: (enabled: boolean) => void;
};

export default function UnifiedBottomSheet({
  visible,
  onClose,
  chartType,
  onSelectChartType,
  extendedTf,
  pinned,
  onTogglePin,
  showSessions,
  onSetShowSessions,
  showReasonIcon,
  onSetShowReasonIcon,
}: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [visible]);

  const minutes: ExtendedTimeframe[] = [
    "1m",
    "2m",
    "3m",
    "5m",
    "10m",
    "15m",
    "30m",
  ] as any;
  const hours: ExtendedTimeframe[] = ["1h", "2h", "4h"] as any;
  const days: ExtendedTimeframe[] = [
    "1D",
    "1W",
    "1M",
    "3M",
    "6M",
    "1Y",
    "5Y",
    "ALL",
  ] as any;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [400, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable>
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>
            <ScrollView
              style={{ maxHeight: 600 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
                <Text style={styles.sectionTitle}>Chart Type</Text>
                <View style={styles.chartTypeRow}>
                  {[
                    {
                      type: "line" as ChartType,
                      label: "Line",
                      icon: "trending-up",
                    },
                    {
                      type: "candlestick" as ChartType,
                      label: "Candles",
                      icon: "bar-chart",
                    },
                    {
                      type: "area" as ChartType,
                      label: "Area",
                      icon: "analytics",
                    },
                  ].map((item) => (
                    <Pressable
                      key={item.type}
                      onPress={() => {
                        onSelectChartType(item.type);
                        onClose();
                      }}
                      style={[
                        styles.chartTypeButton,
                        chartType === item.type && styles.chartTypeButtonActive,
                      ]}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={20}
                        color={chartType === item.type ? "#000" : "#fff"}
                        style={{ marginBottom: 4 }}
                      />
                      <Text
                        style={[
                          styles.chartTypeButtonText,
                          chartType === item.type &&
                            styles.chartTypeButtonTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Trading Session + Reasoning side-by-side */}
              <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
                <View style={styles.dualRow}>
                  <View style={styles.dualCol}>
                    <Text style={styles.sectionTitle}>After Hours</Text>
                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>Extended</Text>
                      <Switch
                        value={showSessions}
                        onValueChange={onSetShowSessions}
                        trackColor={{ false: "#2a2a2a", true: "#00D4AA" }}
                        thumbColor={showSessions ? "#000" : "#888"}
                      />
                    </View>
                  </View>
                  <View style={styles.dualCol}>
                    <Text style={styles.sectionTitle}>Reasoning</Text>
                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>Overlay</Text>
                      <Switch
                        value={showReasonIcon}
                        onValueChange={onSetShowReasonIcon}
                        trackColor={{ false: "#2a2a2a", true: "#00D4AA" }}
                        thumbColor={showReasonIcon ? "#000" : "#888"}
                      />
                    </View>
                  </View>
                </View>
              </View>

              <View style={{ paddingHorizontal: 20 }}>
                <TimeframeSection
                  title="Minutes"
                  tfs={minutes}
                  extendedTf={extendedTf}
                  pinned={pinned}
                  onTogglePin={onTogglePin}
                />
                <TimeframeSection
                  title="Hours"
                  tfs={hours}
                  extendedTf={extendedTf}
                  pinned={pinned}
                  onTogglePin={onTogglePin}
                />
                <TimeframeSection
                  title="Days"
                  tfs={days}
                  extendedTf={extendedTf}
                  pinned={pinned}
                  onTogglePin={onTogglePin}
                />
              </View>
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function TimeframeSection({
  title,
  tfs,
  extendedTf,
  pinned,
  onTogglePin,
}: {
  title: string;
  tfs: ExtendedTimeframe[];
  extendedTf: ExtendedTimeframe;
  pinned: ExtendedTimeframe[];
  onTogglePin: (tf: ExtendedTimeframe) => Promise<boolean> | boolean;
}) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.timeframeGrid}>
        {tfs.map((tf) => {
          const isSelected = extendedTf === tf;
          const isPinned = pinned.includes(tf);
          return (
            <Pressable
              key={tf}
              onPress={() => onTogglePin(tf)}
              style={[
                styles.timeframeButton,
                isSelected && styles.timeframeButtonActive,
                isPinned && styles.timeframeButtonPinned,
              ]}
            >
              <Text
                style={[
                  styles.timeframeButtonText,
                  isSelected && styles.timeframeButtonTextActive,
                  isPinned && styles.timeframeButtonTextPinned,
                ]}
              >
                {tf}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: Dimensions.get("window").height * 0.8,
  },
  handleWrap: { width: "100%", alignItems: "center", marginBottom: 20 },
  handle: { width: 40, height: 4, backgroundColor: "#666", borderRadius: 2 },
  sectionTitle: {
    color: "#888",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chartTypeRow: { flexDirection: "row", gap: 12 },
  chartTypeButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
  },
  chartTypeButtonActive: { backgroundColor: "#00D4AA" },
  chartTypeButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  chartTypeButtonTextActive: { color: "#000" },
  sessionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sessionButtonActive: { backgroundColor: "#00D4AA", borderColor: "#00D4AA" },
  sessionButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  sessionButtonTextActive: { color: "#000" },
  timeframeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeframeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
    minWidth: 60,
    alignItems: "center",
  },
  timeframeButtonActive: { backgroundColor: "#00D4AA" },
  timeframeButtonPinned: {
    borderColor: "#00D4AA",
    borderWidth: 2,
    backgroundColor: "#002921",
  },
  timeframeButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  timeframeButtonTextActive: { color: "#000" },
  timeframeButtonTextPinned: { color: "#00D4AA" },
  dualRow: { flexDirection: "row", gap: 16 },
  dualCol: { flex: 1 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#2a2a2a",
  },
  switchLabel: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
