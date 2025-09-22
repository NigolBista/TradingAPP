import React, { createContext, useContext, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  onOverlayMessage,
  offOverlayMessage,
  requestCancelOverlayFlow,
  requestContinueOverlayFlow,
} from "../services/overlayBus";

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
            <TouchableOpacity
              onPress={requestCancelOverlayFlow}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Stop</Text>
            </TouchableOpacity>
            {waiting ? (
              <TouchableOpacity
                onPress={requestContinueOverlayFlow}
                style={[
                  styles.button,
                  { backgroundColor: "#10B981", marginLeft: 6 },
                ]}
              >
                <Text style={styles.buttonText}>Continue</Text>
              </TouchableOpacity>
            ) : null}
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
    justifyContent: "flex-start",
    alignItems: "center",
  },
  toast: {
    marginTop: 12,
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
