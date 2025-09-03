import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { IndicatorConfig } from "../components/charts/SimpleKLineChart";
import LineStyleModal from "./ChartFullScreen/LineStyleModal";

type RouteParams = {
  indicatorName: string;
  getCurrentIndicator: () => IndicatorConfig | null;
  newParamValue: number;
  onAddParam: (name: string, value: number) => void;
  onRemoveParam: (name: string, value: number) => void;
  onUpdateIndicatorLine: (
    name: string,
    lineIndex: number,
    updates: Partial<{ color: string; size: number; style: string }>
  ) => void;
};

export default function IndicatorConfigScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as RouteParams;

  const {
    indicatorName,
    getCurrentIndicator,
    newParamValue: initialParamValue,
    onAddParam,
    onRemoveParam,
    onUpdateIndicatorLine,
  } = params;

  const [indicator, setIndicator] = useState<IndicatorConfig | null>(
    getCurrentIndicator()
  );
  const [newParamValue, setNewParamValue] = useState(initialParamValue);
  const [showLineStyleModal, setShowLineStyleModal] = useState(false);
  const [lineStyleEditIndex, setLineStyleEditIndex] = useState(0);
  const rowRefs = useRef<Record<number, any>>({});

  // Update indicator state when the screen regains focus (no polling to avoid freezes)
  useEffect(() => {
    const updateIndicator = () => {
      const currentIndicator = getCurrentIndicator();
      setIndicator(currentIndicator);
    };
    const unsubscribe = navigation.addListener("focus", updateIndicator);
    return () => {
      unsubscribe();
    };
  }, [getCurrentIndicator, navigation]);

  const openLineStyleEditor = (index: number) => {
    setLineStyleEditIndex(index);
    setShowLineStyleModal(true);
  };

  const closeLineStyleEditor = () => {
    setShowLineStyleModal(false);
  };

  const handleUpdateColor = (hex: string) => {
    onUpdateIndicatorLine(indicatorName, lineStyleEditIndex, { color: hex });
    // Immediate local UI sync
    setIndicator((prev) => {
      if (!prev) return prev;
      const lines = Array.isArray((prev.styles as any)?.lines)
        ? ((prev.styles as any).lines as any[]).slice()
        : [];
      const current = lines[lineStyleEditIndex] || {
        color: "#00D4AA",
        size: 1,
        style: "solid",
      };
      lines[lineStyleEditIndex] = { ...current, color: hex };
      return { ...prev, styles: { ...(prev.styles as any), lines } } as any;
    });
  };

  const handleUpdateThickness = (size: number) => {
    onUpdateIndicatorLine(indicatorName, lineStyleEditIndex, { size });
    setIndicator((prev) => {
      if (!prev) return prev;
      const lines = Array.isArray((prev.styles as any)?.lines)
        ? ((prev.styles as any).lines as any[]).slice()
        : [];
      const current = lines[lineStyleEditIndex] || {
        color: "#00D4AA",
        size: 1,
        style: "solid",
      };
      lines[lineStyleEditIndex] = { ...current, size };
      return { ...prev, styles: { ...(prev.styles as any), lines } } as any;
    });
  };

  const handleUpdateStyle = (style: string) => {
    onUpdateIndicatorLine(indicatorName, lineStyleEditIndex, { style });
    setIndicator((prev) => {
      if (!prev) return prev;
      const lines = Array.isArray((prev.styles as any)?.lines)
        ? ((prev.styles as any).lines as any[]).slice()
        : [];
      const current = lines[lineStyleEditIndex] || {
        color: "#00D4AA",
        size: 1,
        style: "solid",
      };
      lines[lineStyleEditIndex] = { ...current, style };
      return { ...prev, styles: { ...(prev.styles as any), lines } } as any;
    });
  };

  // Local helpers for immediate add/remove UI updates
  function addLocalParam(value: number) {
    setIndicator((prev) => {
      if (!prev) return prev;
      const params = Array.isArray(prev.calcParams)
        ? (prev.calcParams as number[]).slice()
        : [];
      if (!Number.isFinite(value) || value <= 0 || params.includes(value))
        return prev;
      params.push(Math.floor(value));
      params.sort((a, b) => a - b);
      const count = params.length;
      const lines = Array.isArray((prev.styles as any)?.lines)
        ? ((prev.styles as any).lines as any[]).slice()
        : [];
      while (lines.length < count)
        lines.push({ color: "#00D4AA", size: 1, style: "solid" });
      return {
        ...prev,
        calcParams: params,
        styles: { ...(prev.styles as any), lines },
      } as any;
    });
  }

  function removeLocalParam(value: number) {
    setIndicator((prev) => {
      if (!prev) return prev;
      const params = Array.isArray(prev.calcParams)
        ? (prev.calcParams as number[]).slice()
        : [];
      const idx = params.indexOf(value);
      if (idx === -1) return prev;
      params.splice(idx, 1);
      const lines = Array.isArray((prev.styles as any)?.lines)
        ? ((prev.styles as any).lines as any[]).slice()
        : [];
      if (idx >= 0 && idx < lines.length) lines.splice(idx, 1);
      return {
        ...prev,
        calcParams: params,
        styles: { ...(prev.styles as any), lines },
      } as any;
    });
  }

  if (!indicator) {
    navigation.goBack();
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0a0a0a" }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: "#2a2a2a",
            }}
          >
            <Pressable
              onPress={() => navigation.goBack()}
              style={{ padding: 4 }}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <Text
              style={{
                color: "#fff",
                fontSize: 18,
                fontWeight: "700",
                flex: 1,
                textAlign: "center",
                marginHorizontal: 16,
              }}
            >
              {indicatorName} Settings
            </Text>
            <View style={{ width: 32 }} />
          </View>

          {/* Content */}
          <ScrollView
            style={{ flex: 1, paddingHorizontal: 20 }}
            contentContainerStyle={{ paddingVertical: 20 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {Array.isArray(indicator.calcParams) ? (
              indicator.calcParams.map((period: any, idx: number) => {
                const lines = (indicator.styles as any)?.lines || [];
                const current = lines[idx] || {
                  color: "#00D4AA",
                  size: 1,
                  style: "solid",
                };
                const lineTitle = `${Number(period)}`;
                const renderRightActions = () => (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Pressable
                      onPress={() => {
                        const val = Number(period);
                        removeLocalParam(val);
                        onRemoveParam(indicatorName, val);
                        const ref = rowRefs.current[idx];
                        if (ref && typeof ref.close === "function") ref.close();
                      }}
                      style={{
                        width: 80,
                        height: "100%",
                        backgroundColor: "#8B0000" + "20",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color="#ff4d4f"
                      />
                    </Pressable>
                  </View>
                );
                return (
                  <Swipeable
                    ref={(r: any) => {
                      if (r) rowRefs.current[idx] = r;
                    }}
                    key={`line-${idx}`}
                    renderRightActions={renderRightActions}
                    rightThreshold={40}
                  >
                    <Pressable
                      onPress={() => openLineStyleEditor(idx)}
                      style={{
                        borderWidth: 1,
                        borderColor: "#333",
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: "#1a1a1a",
                      }}
                    >
                      <View>
                        <Text
                          style={{
                            color: "#fff",
                            fontWeight: "700",
                            fontSize: 16,
                            marginBottom: 4,
                          }}
                        >
                          {lineTitle}
                        </Text>
                        <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
                          Tap to edit color, thickness, style
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                        }}
                      >
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 20,
                            backgroundColor: current.color,
                            marginRight: 12,
                            borderWidth: 1,
                            borderColor: "#333",
                          }}
                        />
                        <View
                          style={{
                            width: 40,
                            borderBottomWidth: current.size,
                            borderBottomColor: current.color,
                            borderStyle: current.style as any,
                            marginRight: 8,
                          }}
                        />
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color="#888"
                        />
                      </View>
                    </Pressable>
                  </Swipeable>
                );
              })
            ) : (
              <Pressable
                onPress={() => openLineStyleEditor(0)}
                style={{
                  borderWidth: 1,
                  borderColor: "#333",
                  borderRadius: 12,
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: "#1a1a1a",
                }}
              >
                <View>
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "700",
                      fontSize: 16,
                      marginBottom: 4,
                    }}
                  >
                    Line
                  </Text>
                  <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
                    Tap to edit color, thickness, style
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 20,
                      backgroundColor:
                        (indicator.styles as any)?.lines?.[0]?.color ||
                        "#00D4AA",
                      marginRight: 12,
                      borderWidth: 1,
                      borderColor: "#333",
                    }}
                  />
                  <View
                    style={{
                      width: 40,
                      borderBottomWidth:
                        (indicator.styles as any)?.lines?.[0]?.size || 1,
                      borderBottomColor:
                        (indicator.styles as any)?.lines?.[0]?.color ||
                        "#00D4AA",
                      borderStyle: (((indicator.styles as any)?.lines?.[0]
                        ?.style as any) || "solid") as any,
                      marginRight: 8,
                    }}
                  />
                  <Ionicons name="chevron-forward" size={18} color="#888" />
                </View>
              </Pressable>
            )}

            {/* Add Parameter Section */}
            {Array.isArray(indicator.calcParams) && (
              <View
                style={{
                  marginTop: 24,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: "#333",
                  borderRadius: 12,
                  backgroundColor: "#1a1a1a",
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: "700",
                    marginBottom: 12,
                  }}
                >
                  Add Period
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <TextInput
                      value={String(newParamValue)}
                      onChangeText={(t) => {
                        const n = Number(t.replace(/[^0-9]/g, ""));
                        if (Number.isFinite(n)) setNewParamValue(n);
                      }}
                      placeholder="Enter period (e.g., 9)"
                      placeholderTextColor="#666"
                      keyboardType="number-pad"
                      onSubmitEditing={() => {
                        addLocalParam(newParamValue);
                        onAddParam(indicatorName, newParamValue);
                      }}
                      style={{
                        color: "#fff",
                        backgroundColor: "#0f0f0f",
                        borderWidth: 1,
                        borderColor: "#333",
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        fontSize: 16,
                      }}
                    />
                  </View>
                  <Pressable
                    onPress={() => {
                      addLocalParam(newParamValue);
                      onAddParam(indicatorName, newParamValue);
                    }}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      backgroundColor: "#00D4AA",
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ color: "#000", fontWeight: "700" }}>
                      Add
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Line Style Modal */}
        <LineStyleModal
          visible={showLineStyleModal}
          onClose={closeLineStyleEditor}
          title={`${indicatorName}${
            Array.isArray(indicator?.calcParams)
              ? String(indicator?.calcParams?.[lineStyleEditIndex] ?? "")
              : ""
          }`}
          onUpdateColor={handleUpdateColor}
          onUpdateThickness={handleUpdateThickness}
          onUpdateStyle={handleUpdateStyle}
          currentColor={
            Array.isArray((indicator?.styles as any)?.lines)
              ? ((indicator?.styles as any).lines as any[])[lineStyleEditIndex]
                  ?.color || "#00D4AA"
              : (indicator?.styles as any)?.lines?.[0]?.color || "#00D4AA"
          }
          currentThickness={
            Array.isArray((indicator?.styles as any)?.lines)
              ? ((indicator?.styles as any).lines as any[])[lineStyleEditIndex]
                  ?.size || 1
              : (indicator?.styles as any)?.lines?.[0]?.size || 1
          }
          currentStyle={
            Array.isArray((indicator?.styles as any)?.lines)
              ? ((indicator?.styles as any).lines as any[])[lineStyleEditIndex]
                  ?.style || "solid"
              : (indicator?.styles as any)?.lines?.[0]?.style || "solid"
          }
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
