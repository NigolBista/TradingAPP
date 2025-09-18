import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../providers/ThemeProvider";

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  onPress?: () => void;
  style?: any;
  headerAction?: React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: "default" | "elevated" | "outlined";
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    base: {
      borderRadius: 12,
      padding: 16,
    },
    default: {
      backgroundColor: theme.colors.card,
    },
    elevated: {
      backgroundColor: theme.colors.card,
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    outlined: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    iconContainer: {
      width: 40,
      height: 40,
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    headerContent: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    headerAction: {
      marginLeft: 12,
    },
  });

export default function Card({
  children,
  title,
  subtitle,
  onPress,
  style,
  headerAction,
  icon,
  variant = "default",
}: CardProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const CardWrapper = onPress ? Pressable : View;

  return (
    <CardWrapper
      onPress={onPress}
      style={[styles.base, styles[variant], style]}
    >
      {(title || subtitle || icon || headerAction) && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {icon && (
              <View style={styles.iconContainer}>
                <Ionicons name={icon} size={20} color={theme.colors.primary} />
              </View>
            )}
            <View style={styles.headerContent}>
              {title && <Text style={styles.title}>{title}</Text>}
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
          </View>
          {headerAction && (
            <View style={styles.headerAction}>{headerAction}</View>
          )}
        </View>
      )}
      {children}
    </CardWrapper>
  );
}
