// Re-export the new modular navigation system
export { default } from './RootNavigator';
export { navigate, goBack, resetToScreen, navigationRef } from './RootNavigator';

// Export navigation types for use in components
export type {
  RootStackParamList,
  AuthStackParamList,
  MainTabParamList,
  TradingStackParamList,
  PortfolioStackParamList,
  MarketStackParamList,
  AllStackParamList,
  ScreenNavigationProp,
  ScreenRouteProp,
  ScreenProps,
} from './types';
