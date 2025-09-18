import React from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  onUpdateColor: (hex: string) => void;
  onUpdateThickness: (n: number) => void;
  onUpdateStyle: (s: string) => void;
  currentColor?: string;
  currentThickness?: number;
  currentStyle?: string;
};

export default function LineStyleModal({
  visible,
  onClose,
  title,
  onUpdateColor,
  onUpdateThickness,
  onUpdateStyle,
  currentColor = "#3B82F6",
  currentThickness = 1,
  currentStyle = "solid",
}: Props) {
  const colors = [
    // Row 1: Dark to medium grays and blues
    "#111827", // Dark gray
    "#1F2937", // Darker gray
    "#374151", // Medium dark gray
    "#4B5563", // Medium gray
    "#1E3A8A", // Dark blue
    "#3B82F6", // Blue
    "#2563EB", // Medium blue
    "#1D4ED8", // Darker blue

    // Row 2: Light blues and purples
    "#60A5FA", // Light blue
    "#93C5FD", // Lighter blue
    "#A78BFA", // Purple
    "#8B5CF6", // Medium purple
    "#7C3AED", // Darker purple
    "#6D28D9", // Dark purple
    "#5B21B6", // Very dark purple
    "#4C1D95", // Darkest purple

    // Row 3: Pinks, reds, and oranges
    "#F472B6", // Pink
    "#EC4899", // Medium pink
    "#F87171", // Light red
    "#EF4444", // Red
    "#DC2626", // Dark red
    "#F59E0B", // Orange
    "#D97706", // Dark orange
    "#B45309", // Darker orange

    // Row 4: Yellows and greens
    "#FBBF24", // Light orange/yellow
    "#FDE047", // Yellow
    "#FACC15", // Bright yellow
    "#EAB308", // Medium yellow
    "#34D399", // Light green
    "#22D3EE", // Cyan
    "#10B981", // Green
    "#059669", // Dark green
  ];
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "flex-end",
        }}
        onPress={onClose}
      >
        <View
          style={{
            backgroundColor: "#1a1a1a",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: 20,
            paddingBottom: 24,
            maxHeight: 600,
          }}
        >
          <Pressable>
            <View style={{ alignItems: "center", paddingBottom: 10 }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  backgroundColor: "#666",
                  borderRadius: 2,
                }}
              />
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 20,
                marginBottom: 8,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>{title}</Text>
              <Pressable onPress={onClose} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color="#fff" />
              </Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }}>
              <Text style={{ color: "#9CA3AF", marginBottom: 8 }}>Color</Text>
              <View style={{ flexDirection: "column" }}>
                {Array.from({ length: 4 }, (_, rowIndex) => (
                  <View
                    key={rowIndex}
                    style={{
                      flexDirection: "row",
                      marginBottom: 10,
                      justifyContent: "space-between",
                    }}
                  >
                    {colors
                      .slice(rowIndex * 8, (rowIndex + 1) * 8)
                      .map((sw) => {
                        const normalizedCurrentColor = (
                          currentColor || "#3B82F6"
                        )
                          .toLowerCase()
                          .trim();
                        const normalizedSw = sw.toLowerCase().trim();
                        const isSelected =
                          normalizedSw === normalizedCurrentColor;
                        return (
                          <Pressable
                            key={`style-color-${sw}`}
                            onPress={() => onUpdateColor(sw)}
                            style={{
                              flex: 1,
                              height: 28,
                              borderRadius: 14,
                              marginRight: 8,
                              borderWidth: isSelected ? 3 : 1,
                              borderColor: isSelected ? "#3B82F6" : "#111",
                              padding: isSelected ? 1 : 0,
                              backgroundColor: "#1a1a1a", // Background for the padding area
                            }}
                          >
                            <View
                              style={{
                                flex: 1,
                                borderRadius: 13,
                                backgroundColor: sw,
                              }}
                            />
                          </Pressable>
                        );
                      })}
                  </View>
                ))}
              </View>
              <Text style={{ color: "#9CA3AF", marginTop: 6, marginBottom: 8 }}>
                Thickness
              </Text>
              <View style={{ flexDirection: "row", marginBottom: 8 }}>
                {[1, 2, 3, 4].map((th) => (
                  <Pressable
                    key={`style-th-${th}`}
                    onPress={() => onUpdateThickness(th)}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      paddingHorizontal: 8,
                      borderRadius: 10,
                      marginRight: 8,
                      backgroundColor: "#111827",
                      borderWidth: th === currentThickness ? 2 : 1,
                      borderColor: th === currentThickness ? "#3B82F6" : "#333",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <View
                      style={{
                        width: "80%",
                        height: th,
                        backgroundColor: "#3B82F6",
                        borderRadius: th / 2,
                      }}
                    />
                  </Pressable>
                ))}
              </View>
              <Text style={{ color: "#9CA3AF", marginTop: 6, marginBottom: 8 }}>
                Style
              </Text>
              <View style={{ flexDirection: "row" }}>
                {[
                  { k: "solid", label: "Solid" },
                  { k: "dashed", label: "Dashed" },
                  { k: "dotted", label: "Dotted" },
                ].map((opt) => (
                  <Pressable
                    key={`style-st-${opt.k}`}
                    onPress={() => onUpdateStyle(opt.k)}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      paddingHorizontal: 8,
                      borderRadius: 10,
                      marginRight: 8,
                      backgroundColor: "#111827",
                      borderWidth: opt.k === currentStyle ? 2 : 1,
                      borderColor: opt.k === currentStyle ? "#3B82F6" : "#333",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {opt.k === "solid" ? (
                      <View
                        style={{
                          width: "80%",
                          height: 2,
                          backgroundColor: "#3B82F6",
                          borderRadius: 1,
                        }}
                      />
                    ) : opt.k === "dashed" ? (
                      <View
                        style={{
                          flexDirection: "row",
                          width: "80%",
                          justifyContent: "space-between",
                        }}
                      >
                        {Array.from({ length: 6 }, (_, i) => (
                          <View
                            key={i}
                            style={{
                              width: "12%",
                              height: 2,
                              backgroundColor: "#3B82F6",
                              borderRadius: 1,
                            }}
                          />
                        ))}
                      </View>
                    ) : (
                      <View
                        style={{
                          flexDirection: "row",
                          width: "80%",
                          justifyContent: "space-around",
                        }}
                      >
                        {Array.from({ length: 8 }, (_, i) => (
                          <View
                            key={i}
                            style={{
                              width: 2,
                              height: 2,
                              backgroundColor: "#3B82F6",
                              borderRadius: 1,
                            }}
                          />
                        ))}
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
