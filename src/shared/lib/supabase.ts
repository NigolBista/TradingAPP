import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { supabaseUrl, supabaseAnonKey } = Constants.expoConfig?.extra as any;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase env not set. Please configure SUPABASE_URL and SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: {
      getItem: (key: string) => AsyncStorage.getItem(key),
      setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
      removeItem: (key: string) => AsyncStorage.removeItem(key),
    },
    detectSessionInUrl: false,
  },
});
