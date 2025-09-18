import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "../shared/constants/colors";

export type ThemeMode = "system" | "light" | "dark";

interface Theme {
  mode: ThemeMode;
  colors: {
    background: string;
    surface: string;
    card: string;
    text: string;
    textSecondary: string;
    primary: string;
    success: string;
    error: string;
    border: string;
    blueTransparent: string;
  };
}

const lightTheme: Theme = {
  mode: "light",
  colors: {
    background: COLORS.LIGHT.BACKGROUND,
    surface: COLORS.LIGHT.SURFACE,
    card: COLORS.LIGHT.CARD,
    text: COLORS.LIGHT.TEXT,
    textSecondary: COLORS.LIGHT.TEXT_SECONDARY,
    primary: COLORS.PRIMARY,
    success: COLORS.SUCCESS,
    error: COLORS.ERROR_LIGHT,
    border: COLORS.LIGHT.BORDER,
    blueTransparent: COLORS.BLUE_TRANSPARENT_50,
  },
};

const darkTheme: Theme = {
  mode: "dark",
  colors: {
    background: COLORS.DARK.BACKGROUND,
    surface: COLORS.DARK.SURFACE,
    card: COLORS.DARK.CARD,
    text: COLORS.DARK.TEXT,
    textSecondary: COLORS.DARK.TEXT_SECONDARY,
    primary: COLORS.PRIMARY,
    success: COLORS.SUCCESS,
    error: COLORS.ERROR_DARK,
    border: COLORS.DARK.BORDER,
    blueTransparent: COLORS.BLUE_TRANSPARENT_50,
  },
};

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "@app_theme_mode";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");

  // Determine the actual theme based on mode
  const getEffectiveTheme = (mode: ThemeMode): Theme => {
    if (mode === "system") {
      return systemColorScheme === "dark" ? darkTheme : lightTheme;
    }
    return mode === "dark" ? darkTheme : lightTheme;
  };

  const [theme, setTheme] = useState<Theme>(getEffectiveTheme(themeMode));

  // Load saved theme preference
  useEffect(() => {
    const loadThemeMode = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode && ["system", "light", "dark"].includes(savedMode)) {
          setThemeModeState(savedMode as ThemeMode);
        }
      } catch (error) {
        console.error("Error loading theme mode:", error);
      }
    };
    loadThemeMode();
  }, []);

  // Update theme when mode or system preference changes
  useEffect(() => {
    setTheme(getEffectiveTheme(themeMode));
  }, [themeMode, systemColorScheme]);

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      console.error("Error saving theme mode:", error);
    }
  };

  const isDark =
    theme.mode === "dark" ||
    (themeMode === "system" && systemColorScheme === "dark");

  const value = {
    theme,
    themeMode,
    setThemeMode,
    isDark,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
