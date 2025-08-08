import React from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: "left" | "right";
  style?: any;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  // Variants
  primary: {
    backgroundColor: "#6366f1",
    borderWidth: 1,
    borderColor: "#6366f1",
  },
  secondary: {
    backgroundColor: "#6b7280",
    borderWidth: 1,
    borderColor: "#6b7280",
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#6366f1",
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "transparent",
  },
  // Sizes
  sm: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  md: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lg: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  // Text variants
  textPrimary: {
    color: "#ffffff",
    fontWeight: "600",
  },
  textSecondary: {
    color: "#ffffff",
    fontWeight: "600",
  },
  textOutline: {
    color: "#6366f1",
    fontWeight: "600",
  },
  textGhost: {
    color: "#6366f1",
    fontWeight: "600",
  },
  // Text sizes
  textSm: {
    fontSize: 14,
  },
  textMd: {
    fontSize: 16,
  },
  textLg: {
    fontSize: 18,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  iconPosition = "left",
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const getIconColor = () => {
    if (variant === "primary" || variant === "secondary") return "#ffffff";
    return "#6366f1";
  };

  const getIconSize = () => {
    switch (size) {
      case "sm":
        return 16;
      case "md":
        return 18;
      case "lg":
        return 20;
      default:
        return 18;
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        styles[variant],
        styles[size],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getIconColor()} />
      ) : (
        <View style={styles.base}>
          {icon && iconPosition === "left" && (
            <Ionicons
              name={icon}
              size={getIconSize()}
              color={getIconColor()}
              style={{ marginRight: 8 }}
            />
          )}
          <Text
            style={[
              styles[
                `text${
                  variant.charAt(0).toUpperCase() + variant.slice(1)
                }` as keyof typeof styles
              ],
              styles[
                `text${
                  size.charAt(0).toUpperCase() + size.slice(1)
                }` as keyof typeof styles
              ],
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === "right" && (
            <Ionicons
              name={icon}
              size={getIconSize()}
              color={getIconColor()}
              style={{ marginLeft: 8 }}
            />
          )}
        </View>
      )}
    </Pressable>
  );
}
