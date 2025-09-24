import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../providers/AuthProvider";
import { useUserStore } from "../store/userStore";
import {
  createStrategyGroup,
  listMyStrategyGroups,
  subscribeToGroup,
} from "../services/strategyGroupsService";

export default function StrategySettingsScreen() {
  const { user } = useAuth();
  const profile = useUserStore((s) => s.profile);
  const setProfile = useUserStore((s) => s.setProfile);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);

  const canCreate = useMemo(
    () => !!user?.id && name.trim().length > 0,
    [user?.id, name]
  );

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user?.id) return;
      try {
        const list = await listMyStrategyGroups(user.id);
        if (mounted) setGroups(list || []);
        // sync into store so other screens (like bottom sheet) can read it
        if (list && list.length > 0) {
          setProfile({ strategyGroups: list as any });
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  async function handleCreate() {
    if (!user?.id) return;
    if (!name.trim()) return;
    setLoading(true);
    try {
      const g = await createStrategyGroup({
        userId: user.id,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setGroups((prev) => [g, ...prev]);
      setName("");
      setDescription("");
      setProfile({
        selectedStrategyGroupId: g.id,
        isSignalProvider: true,
        strategyGroups: [g, ...((profile.strategyGroups as any[]) || [])],
      });
      Alert.alert("Created", "Strategy group created successfully");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to create group");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(groupId: string) {
    if (!user?.id) return;
    try {
      await subscribeToGroup({ userId: user.id, groupId });
      // ensure it's present in store list and selected
      const existing = (profile.strategyGroups || []).find(
        (x: any) => x.id === groupId
      );
      const selected = groups.find((x) => x.id === groupId) || existing;
      setProfile({
        selectedStrategyGroupId: groupId,
        strategyGroups: selected
          ? [
              selected,
              ...((profile.strategyGroups || []).filter(
                (x: any) => x.id !== groupId
              ) as any[]),
            ]
          : (profile.strategyGroups as any[]),
      });
      Alert.alert("Subscribed", "You are now a member of this group");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to subscribe");
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>Strategy Groups</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Create New Group</Text>
          <TextInput
            placeholder="Group name"
            placeholderTextColor="#6b7280"
            style={styles.input}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            placeholder="Description (optional)"
            placeholderTextColor="#6b7280"
            style={[styles.input, { height: 80, textAlignVertical: "top" }]}
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <Pressable
            disabled={!canCreate || loading}
            onPress={handleCreate}
            style={[
              styles.button,
              { opacity: !canCreate || loading ? 0.6 : 1 },
            ]}
          >
            <Ionicons
              name="add-circle"
              size={18}
              color="#000"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.buttonText}>
              {loading ? "Creating..." : "Create Group"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>My Groups</Text>
          <View style={{ gap: 8 }}>
            {(groups || []).map((g) => {
              const selected = profile.selectedStrategyGroupId === g.id;
              return (
                <View key={g.id} style={styles.groupRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupName}>{g.name}</Text>
                    {g.description ? (
                      <Text style={styles.groupDesc}>{g.description}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() =>
                      selected ? undefined : handleSubscribe(g.id)
                    }
                    style={[
                      styles.smallBtn,
                      {
                        backgroundColor: selected ? "#00D4AA" : "#1f2937",
                        borderColor: selected ? "#00D4AA" : "#374151",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: selected ? "#000" : "#fff",
                        fontWeight: "700",
                      }}
                    >
                      {selected ? "Selected" : "Join"}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 12 },
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  sectionTitle: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#1f2937",
    color: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#374151",
    marginBottom: 8,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00D4AA",
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: { color: "#000", fontWeight: "800" },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  groupName: { color: "#fff", fontWeight: "700" },
  groupDesc: { color: "#9CA3AF", fontSize: 12 },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
});
