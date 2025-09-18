import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BrokerageProvider, AuthResult } from '../../services/brokerageAuth';

interface BrokerageAuthWebViewProps {
  provider: BrokerageProvider;
  authUrl?: string;
  onAuthSuccess: (result: AuthResult) => Promise<void>;
  onAuthError?: (error: string) => void;
  onCancel: () => void;
}

export default function BrokerageAuthWebView({
  provider,
  authUrl,
  onAuthSuccess,
  onAuthError,
  onCancel,
}: BrokerageAuthWebViewProps) {
  // This would be implemented with react-native-webview
  // For now, returning a placeholder component

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Brokerage Authentication</Text>
      <Text style={styles.subtitle}>Provider: {provider}</Text>
      <Text style={styles.placeholder}>
        WebView component not implemented yet.
        This would show the OAuth flow for {provider}.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  placeholder: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
  },
});