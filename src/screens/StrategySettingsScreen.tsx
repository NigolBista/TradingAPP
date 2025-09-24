import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../providers/AuthProvider";
import { useUserStore } from "../store/userStore";
import {
  createStrategyGroup,
  listMyStrategyGroups,
  listAvailableStrategyGroups,
  subscribeToGroup,
  deleteStrategyGroup,
} from "../services/strategyGroupsService";

export default function StrategySettingsScreen() {
  const { user } = useAuth();
  const profile = useUserStore((s) => s.profile);
  const setProfile = useUserStore((s) => s.setProfile);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [ownedGroups, setOwnedGroups] = useState<any[]>([]);
  const [subscribedGroups, setSubscribedGroups] = useState<any[]>([]);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [errorPublic, setErrorPublic] = useState<string | null>(null);

  const canCreate = useMemo(
    () => !!user?.id && name.trim().length > 0,
    [user?.id, name]
  );

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user?.id) return;
      try {
        await refreshMyGroups();
        await refreshAvailable();
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const refreshAvailable = async () => {
    if (!user?.id) return;
    try {
      setLoadingPublic(true);
      setErrorPublic(null);
      const list = await listAvailableStrategyGroups(user.id);
      setAvailableGroups(list || []);
    } catch (e: any) {
      setErrorPublic(e?.message || "Failed to load public groups");
    } finally {
      setLoadingPublic(false);
    }
  };

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
      setOwnedGroups((prev) => [g, ...prev]);
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
      const existingOwned = (profile.strategyGroups || []).find(
        (x: any) => x.id === groupId
      );
      const existingSubscribed = (profile.subscribedStrategyGroups || []).find(
        (x: any) => x.id === groupId
      );
      const ownedSelected = ownedGroups.find((x) => x.id === groupId);
      const subscribedSelected = subscribedGroups.find(
        (x) => x.id === groupId
      );
      const selected =
        ownedSelected || subscribedSelected || existingOwned || existingSubscribed;
      setProfile({
        selectedStrategyGroupId: groupId,
        strategyGroups: ownedSelected
          ? [
              ownedSelected,
              ...((profile.strategyGroups || []).filter(
                (x: any) => x.id !== groupId
              ) as any[]),
            ]
          : (profile.strategyGroups as any[]),
        subscribedStrategyGroups: subscribedSelected
          ? [
              subscribedSelected,
              ...((profile.subscribedStrategyGroups || []).filter(
                (x: any) => x.id !== groupId
              ) as any[]),
            ]
          : (profile.subscribedStrategyGroups as any[]),
      });
      Alert.alert("Subscribed", "You are now a member of this group");
      await refreshAvailable();
      await refreshMyGroups();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to subscribe");
    }
  }

  async function refreshMyGroups() {
    if (!user?.id) return;
    try {
      const list = await listMyStrategyGroups(user.id);
      const owned = (list || []).filter((g: any) => g.owner_user_id === user.id);
      const subscribed = (list || []).filter(
        (g: any) => g.owner_user_id !== user.id
      );
      setOwnedGroups(owned);
      setSubscribedGroups(subscribed);
      setProfile({
        strategyGroups: owned as any,
        subscribedStrategyGroups: subscribed as any,
      });
    } catch (e) {
      console.warn("Failed to refresh groups", e);
    }
  }

  async function handleDeleteGroup(groupId: string) {
    if (!user?.id) return;
    try {
      await deleteStrategyGroup({ userId: user.id, groupId });
      const nextOwned = ownedGroups.filter((g) => g.id !== groupId);
      setOwnedGroups(nextOwned);
      const nextSubscribed = subscribedGroups.filter((g) => g.id !== groupId);
      setSubscribedGroups(nextSubscribed);
      const updates: any = {
        strategyGroups: (profile.strategyGroups || []).filter(
          (g: any) => g.id !== groupId
        ),
        subscribedStrategyGroups: (profile.subscribedStrategyGroups || []).filter(
          (g: any) => g.id !== groupId
        ),
      };
      if (profile.selectedStrategyGroupId === groupId) {
        updates.selectedStrategyGroupId =
          nextOwned[0]?.id || nextSubscribed[0]?.id || undefined;
      }
      setProfile(updates);
      Alert.alert("Deleted", "Strategy group deleted successfully");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to delete group");
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
            {(ownedGroups || []).length === 0 ? (
              <Text style={{ color: "#9CA3AF" }}>
                You have not created any groups yet.
              </Text>
            ) : null}
            {(ownedGroups || []).map((g) => {
              const selected = profile.selectedStrategyGroupId === g.id;
              return (
                <View key={g.id} style={styles.groupRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupName}>{g.name}</Text>
                    {g.description ? (
                      <Text style={styles.groupDesc}>{g.description}</Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={() =>
                        selected ? undefined : setProfile({
                              selectedStrategyGroupId: g.id,
                            })
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
                        {selected ? "Default" : "Set Default"}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        Alert.alert(
                          "Delete Group",
                          "Deleting this group will remove all members. This cannot be undone.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () => handleDeleteGroup(g.id),
                            },
                          ]
                        )
                      }
                      style={[
                        styles.smallBtn,
                        {
                          backgroundColor: "#7F1D1D",
                          borderColor: "#EF4444",
                        },
                      ]}
                    >
                      <Text style={{ color: "#fff", fontWeight: "700" }}>
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Subscribed Groups</Text>
          <View style={{ gap: 8 }}>
            {(subscribedGroups || []).length === 0 ? (
              <Text style={{ color: "#9CA3AF" }}>
                You have not subscribed to any groups yet.
              </Text>
            ) : null}
            {(subscribedGroups || []).map((g) => {
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
                      selected ? undefined : setProfile({
                            selectedStrategyGroupId: g.id,
                          })
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
                      {selected ? "Default" : "Set Default"}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Text style={styles.sectionTitle}>Public Groups</Text>
            <Pressable
              onPress={refreshAvailable}
              style={[
                styles.smallBtn,
                { flexDirection: "row", alignItems: "center" },
              ]}
            >
              <Ionicons
                name="refresh"
                size={16}
                color="#fff"
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: "#fff", fontWeight: "700" }}>Refresh</Text>
            </Pressable>
          </View>

          {loadingPublic ? (
            <View style={{ paddingVertical: 16, alignItems: "center" }}>
              <ActivityIndicator color="#00D4AA" />
            </View>
          ) : errorPublic ? (
            <Text style={{ color: "#F87171" }}>{errorPublic}</Text>
          ) : (availableGroups || []).length === 0 ? (
            <Text style={{ color: "#9CA3AF" }}>
              No public groups available right now. Pull to refresh or check
              back later.
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {availableGroups.map((g) => {
                const joined = (profile.strategyGroups || []).some(
                  (x: any) => x.id === g.id
                );
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
                        joined ? undefined : handleSubscribe(g.id)
                      }
                      style={[
                        styles.smallBtn,
                        {
                          backgroundColor: joined ? "#00D4AA" : "#1f2937",
                          borderColor: joined ? "#00D4AA" : "#374151",
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: joined ? "#000" : "#fff",
                          fontWeight: "700",
                        }}
                      >
                        {joined ? "Joined" : "Subscribe"}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
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
