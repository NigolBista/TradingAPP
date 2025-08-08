import React, { useState } from "react";
import { View, TextInput, Button, Text, Pressable } from "react-native";
import { useAuth } from "../providers/AuthProvider";

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    try {
      await login(email, password);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <View className="flex-1 items-center justify-center p-4 bg-white dark:bg-black">
      {error && <Text className="text-red-500 mb-2">{error}</Text>}
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        className="w-full border rounded px-3 py-2 mb-2 text-black dark:text-white"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        className="w-full border rounded px-3 py-2 mb-4 text-black dark:text-white"
      />
      <Button title="Login" onPress={handleLogin} />
      <Pressable onPress={() => navigation.navigate("Register")}
        className="mt-4">
        <Text className="text-blue-500">No account? Register</Text>
      </Pressable>
    </View>
  );
}
