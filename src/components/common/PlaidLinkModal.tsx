import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  create,
  open,
  destroy,
  LinkSuccess,
  LinkExit,
} from "react-native-plaid-link-sdk";
import { plaidIntegrationService } from "../../services/plaidIntegration";

interface Props {
  visible: boolean;
  onSuccess: (publicToken: string, metadata: any) => void;
  onCancel: () => void;
}

export default function PlaidLinkModal({
  visible,
  onSuccess,
  onCancel,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  // Note: Avoid using usePlaidEmitter in Expo Go (requires native module).

  useEffect(() => {
    if (visible) {
      generateLinkToken();
    }
  }, [visible]);

  const generateLinkToken = async () => {
    setLoading(true);
    try {
      const token = await plaidIntegrationService.createLinkToken();
      setLinkToken(token);
    } catch (error) {
      console.error("Failed to create link token:", error);
      alert("Failed to initialize secure connection. Please try again.");
      onCancel();
    } finally {
      setLoading(false);
    }
  };

  const openPlaidLink = async () => {
    if (!linkToken) return;

    try {
      // Clear any previous session
      await destroy().catch(() => {});

      // Create and open Plaid Link
      create({ token: linkToken });
      open({
        onSuccess: (success: LinkSuccess) => {
          onSuccess(success.publicToken, success.metadata);
        },
        onExit: (exit: LinkExit) => {
          if (exit.error) {
            console.error("Plaid exit error:", exit.error);
            alert(exit.error.displayMessage || "Connection cancelled");
          }
          onCancel();
        },
      });
    } catch (error) {
      console.error("Failed to open Plaid:", error);
      alert("Unable to launch Plaid. Please try again.");
    }
  };

  const renderConsentStep = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        <View style={[styles.providerIcon, { backgroundColor: "#00D4AA20" }]}>
          <Ionicons name="link" size={32} color="#00D4AA" />
        </View>
        <Text style={styles.title}>Connect your brokerage account</Text>
        <Text style={styles.subtitle}>Securely via Plaid</Text>
      </View>

      <View style={styles.features}>
        <View style={styles.feature}>
          <Ionicons name="shield-checkmark" size={20} color="#10B981" />
          <Text style={styles.featureText}>
            Bank-level security with 256-bit encryption
          </Text>
        </View>
        <View style={styles.feature}>
          <Ionicons name="eye" size={20} color="#60a5fa" />
          <Text style={styles.featureText}>
            Read-only access to balances and holdings
          </Text>
        </View>
        <View style={styles.feature}>
          <Ionicons name="refresh" size={20} color="#f59e0b" />
          <Text style={styles.featureText}>
            Real-time portfolio sync and updates
          </Text>
        </View>
        <View style={styles.feature}>
          <Ionicons name="lock-closed" size={20} color="#8b5cf6" />
          <Text style={styles.featureText}>
            Official API - no password sharing required
          </Text>
        </View>
      </View>

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          By continuing, you'll be redirected to your institution's secure
          login. We never see or store your login credentials.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        {linkToken ? (
          <Pressable
            style={[styles.connectButton, { backgroundColor: "#00D4AA" }]}
            onPress={openPlaidLink}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.connectText}>Continue with Plaid</Text>
            )}
          </Pressable>
        ) : (
          <View style={[styles.connectButton, { backgroundColor: "#2a2a2a" }]}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <View style={styles.container}>{renderConsentStep()}</View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  providerIcon: {
    width: 80,
    height: 80,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: "#9ca3af",
    fontSize: 16,
    textAlign: "center",
  },
  features: {
    gap: 16,
    marginBottom: 32,
  },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureText: {
    color: "#d1d5db",
    fontSize: 16,
    flex: 1,
  },
  disclaimer: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 16,
    marginBottom: 32,
  },
  disclaimerText: {
    color: "#9ca3af",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#1f2937",
    alignItems: "center",
  },
  cancelText: {
    color: "#9ca3af",
    fontSize: 16,
    fontWeight: "600",
  },
  connectButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  connectText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  webviewContainer: {
    flex: 1,
  },
  webviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "#1a1a1a",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  backButton: {
    padding: 8,
  },
  webviewTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  webview: {
    flex: 1,
  },
  webviewLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0a0a0a",
  },
  loadingText: {
    color: "#9ca3af",
    marginTop: 16,
    fontSize: 16,
  },
  successContainer: {
    alignItems: "center",
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
  },
  successSubtitle: {
    color: "#9ca3af",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
});
