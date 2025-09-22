import React, { createContext, useContext, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { onOverlayMessage, offOverlayMessage } from "../services/overlayBus";

const OverlayContext = createContext({});
export const useOverlay = () => useContext(OverlayContext);

export const OverlayProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [message, setMessage] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<boolean>(false);

  useEffect(() => {
    const handler = (s: { message: string | null; waiting: boolean }) => {
      setMessage(s.message);
      setWaiting(s.waiting);
    };
    onOverlayMessage(handler);
    return () => offOverlayMessage(handler);
  }, []);

  return (
    <OverlayContext.Provider value={{}}>
      {children}
      {message ? (
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.toast}>
            <Text style={styles.text}>{message}</Text>
            {/* Buttons removed: show reasoning only */}
          </View>
        </View>
      ) : null}
    </OverlayContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    // Position near the reasoning icon area (bottom-left, above timeframe)
    justifyContent: "flex-end",
    alignItems: "flex-start",
    paddingLeft: 8,
    paddingBottom: 64,
  },
  toast: {
    marginBottom: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  text: { color: "#fff", marginRight: 8 },
  button: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#EF4444",
    borderRadius: 6,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
});
