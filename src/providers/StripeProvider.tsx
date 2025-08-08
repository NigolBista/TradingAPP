import React from "react";
import { StripeProvider as RNStripeProvider } from "@stripe/stripe-react-native";
import Constants from "expo-constants";

interface Props {
  children: React.ReactNode;
}

export const StripeProvider: React.FC<Props> = ({ children }) => {
  const { stripePublishableKey } = (Constants.expoConfig?.extra || {}) as any;

  return (
    <RNStripeProvider
      publishableKey={stripePublishableKey || "pk_test_123"}
      urlScheme="gpt5"
      merchantIdentifier={
        (Constants.expoConfig?.ios as any)?.bundleIdentifier ||
        "merchant.com.example.gpt5"
      }
    >
      <>{children}</>
    </RNStripeProvider>
  );
};
