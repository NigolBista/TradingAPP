import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  brokerageAuthService,
  BrokerageProvider,
} from "../../services/brokerageAuth";
import { brokerageApiService } from "../../services/brokerageApiService";

interface Props {
  visible: boolean;
  provider: BrokerageProvider | null;
  onClose: () => void;
}

export default function BrokerageDebugModal({
  visible,
  provider,
  onClose,
}: Props) {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && provider) {
      loadDebugInfo();
    }
  }, [visible, provider]);

  const loadDebugInfo = async () => {
    if (!provider) return;

    setLoading(true);
    try {
      const session = brokerageAuthService.getSession(provider);
      const debugResults = await brokerageApiService.debugDataFetching(
        provider
      );

      setDebugInfo({
        session: session
          ? {
              provider: session.provider,
              hasCookies: !!session.cookies,
              cookiesLength: session.cookies?.length || 0,
              tokenCount: Object.keys(session.tokens).length,
              tokenKeys: Object.keys(session.tokens),
              hasUserId: !!session.userId,
              hasRefreshToken: !!session.refreshToken,
              expiresAt: new Date(session.expiresAt).toISOString(),
            }
          : null,
        apiTests: debugResults,
      });
    } catch (error) {
      setDebugInfo({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (!provider) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Debug: {provider}</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>

          <ScrollView style={styles.content}>
            {loading ? (
              <Text style={styles.loading}>Loading debug info...</Text>
            ) : debugInfo ? (
              <View>
                <Text style={styles.sectionTitle}>Session Info</Text>
                {debugInfo.session ? (
                  <View style={styles.section}>
                    <Text style={styles.item}>
                      Provider: {debugInfo.session.provider}
                    </Text>
                    <Text style={styles.item}>
                      Has Cookies: {debugInfo.session.hasCookies ? "Yes" : "No"}
                    </Text>
                    <Text style={styles.item}>
                      Cookies Length: {debugInfo.session.cookiesLength}
                    </Text>
                    <Text style={styles.item}>
                      Token Count: {debugInfo.session.tokenCount}
                    </Text>
                    <Text style={styles.item}>
                      Token Keys: {debugInfo.session.tokenKeys.join(", ")}
                    </Text>
                    <Text style={styles.item}>
                      Has User ID: {debugInfo.session.hasUserId ? "Yes" : "No"}
                    </Text>
                    <Text style={styles.item}>
                      Has Refresh Token:{" "}
                      {debugInfo.session.hasRefreshToken ? "Yes" : "No"}
                    </Text>
                    <Text style={styles.item}>
                      Expires: {debugInfo.session.expiresAt}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.error}>No session found</Text>
                )}

                <Text style={styles.sectionTitle}>API Tests</Text>
                {debugInfo.apiTests && (
                  <View style={styles.section}>
                    <Text
                      style={[
                        styles.item,
                        debugInfo.apiTests.connectionTest
                          ? styles.success
                          : styles.error,
                      ]}
                    >
                      Connection:{" "}
                      {debugInfo.apiTests.connectionTest ? "SUCCESS" : "FAILED"}
                    </Text>
                    <Text
                      style={[
                        styles.item,
                        debugInfo.apiTests.positionsTest.success
                          ? styles.success
                          : styles.error,
                      ]}
                    >
                      Positions:{" "}
                      {debugInfo.apiTests.positionsTest.success
                        ? `SUCCESS (${debugInfo.apiTests.positionsTest.count})`
                        : `FAILED - ${debugInfo.apiTests.positionsTest.error}`}
                    </Text>
                    <Text
                      style={[
                        styles.item,
                        debugInfo.apiTests.watchlistTest.success
                          ? styles.success
                          : styles.error,
                      ]}
                    >
                      Watchlist:{" "}
                      {debugInfo.apiTests.watchlistTest.success
                        ? `SUCCESS (${debugInfo.apiTests.watchlistTest.count})`
                        : `FAILED - ${debugInfo.apiTests.watchlistTest.error}`}
                    </Text>
                  </View>
                )}

                {debugInfo.error && (
                  <Text style={styles.error}>Error: {debugInfo.error}</Text>
                )}
              </View>
            ) : (
              <Text style={styles.error}>No debug info available</Text>
            )}
          </ScrollView>

          <Pressable style={styles.refreshButton} onPress={loadDebugInfo}>
            <Text style={styles.refreshText}>Refresh Debug Info</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    width: "90%",
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  section: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  item: {
    color: "#d1d5db",
    fontSize: 14,
    marginBottom: 4,
  },
  success: {
    color: "#10B981",
  },
  error: {
    color: "#EF4444",
  },
  loading: {
    color: "#9ca3af",
    textAlign: "center",
    padding: 20,
  },
  refreshButton: {
    backgroundColor: "#2563eb",
    padding: 12,
    margin: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  refreshText: {
    color: "#fff",
    fontWeight: "600",
  },
});
