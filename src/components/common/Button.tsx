import React from "react";
import { Pressable, Text } from "react-native";

interface Props {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost";
}

export default function Button({ title, onPress, variant = "primary" }: Props) {
  const base = "px-4 py-3 rounded-xl items-center justify-center";
  const variants: Record<string, string> = {
    primary: "bg-indigo-600",
    secondary: "bg-gray-700",
    ghost: "bg-transparent border border-gray-500",
  };
  const text = variant === "ghost" ? "text-indigo-500" : "text-white";
  return (
    <Pressable className={`${base} ${variants[variant]}`} onPress={onPress}>
      <Text className={`${text} font-semibold`}>{title}</Text>
    </Pressable>
  );
}
