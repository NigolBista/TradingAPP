import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  DAY_TIMEFRAMES,
  SWING_TIMEFRAMES,
  buildDefaultIndicators,
  useStrategyBuilderStore,
} from "../store/strategyBuilderStore";
import { useUserStore } from "../store/userStore";
import type {
  IndicatorConfigSpec,
  StrategyConfig,
  StrategyTimeframe,
} from "../types/strategy";

function cloneStrategy(strategy: StrategyConfig): StrategyConfig {
  return {
    ...strategy,
    timeframes: strategy.timeframes.map((tf) => ({
      timeframe: tf.timeframe,
      indicators: tf.indicators.map((indicator) => ({
        ...indicator,
        params: { ...indicator.params },
      })),
    })),
  };
}

function formatTimeframeLabel(timeframe: StrategyTimeframe) {
  switch (timeframe) {
    case "5m":
      return "5 min";
    case "15m":
      return "15 min";
    case "30m":
      return "30 min";
    case "1h":
      return "1 hour";
    case "4h":
      return "4 hour";
    default:
      return timeframe;
  }
}

export default function StrategyBuilderScreen() {
  const profile = useUserStore((s) => s.profile);
  const selectedGroupId = profile.selectedStrategyGroupId;
  const selectedGroup = useMemo(() => {
    const allGroups = [
      ...(profile.strategyGroups || []),
      ...(profile.subscribedStrategyGroups || []),
    ];
    return allGroups.find((group) => group.id === selectedGroupId) || null;
  }, [
    profile.strategyGroups,
    profile.subscribedStrategyGroups,
    selectedGroupId,
  ]);

  const ensureGroupDefaults = useStrategyBuilderStore(
    (s) => s.ensureGroupDefaults
  );
  const updateStrategy = useStrategyBuilderStore((s) => s.updateStrategy);
  const addWatchlistSymbol = useStrategyBuilderStore(
    (s) => s.addWatchlistSymbol
  );
  const removeWatchlistSymbol = useStrategyBuilderStore(
    (s) => s.removeWatchlistSymbol
  );
  const renameWatchlist = useStrategyBuilderStore((s) => s.renameWatchlist);

  const groupStrategy = useStrategyBuilderStore((state) =>
    selectedGroupId ? state.strategies[selectedGroupId] : undefined
  );
  const groupWatchlist = useStrategyBuilderStore((state) =>
    selectedGroupId ? state.watchlists[selectedGroupId] : undefined
  );

  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState<StrategyConfig | null>(null);
  const [symbolEntry, setSymbolEntry] = useState("");
  const [watchlistName, setWatchlistName] = useState("");
  const seededGroupRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedGroupId) {
      setDraft(null);
      setWatchlistName("");
      seededGroupRef.current = null;
      return;
    }

    const needsSeed = !groupStrategy || !groupWatchlist;
    const notSeededYet = seededGroupRef.current !== selectedGroupId;
    if (needsSeed && notSeededYet) {
      ensureGroupDefaults(selectedGroupId, {
        tradeMode: profile.tradeMode ?? "day",
        groupName: selectedGroup?.name,
      });
      seededGroupRef.current = selectedGroupId;
    }
  }, [
    selectedGroupId,
    groupStrategy,
    groupWatchlist,
    ensureGroupDefaults,
    selectedGroup?.name,
    profile.tradeMode,
  ]);

  useEffect(() => {
    if (!selectedGroupId) {
      setDraft(null);
      return;
    }
    if (!groupStrategy) return;
    if (!draft || draft.updatedAt !== groupStrategy.updatedAt) {
      setDraft(cloneStrategy(groupStrategy));
    }
  }, [groupStrategy?.updatedAt, selectedGroupId]);

  useEffect(() => {
    if (!selectedGroupId) {
      setWatchlistName("");
      return;
    }
    if (!groupWatchlist) return;
    if (watchlistName !== groupWatchlist.name) {
      setWatchlistName(groupWatchlist.name);
    }
  }, [groupWatchlist?.name, selectedGroupId]);

  const timeframeOptions: StrategyTimeframe[] = useMemo(() => {
    if (!draft) return [];
    return draft.tradeMode === "day"
      ? [...DAY_TIMEFRAMES]
      : [...SWING_TIMEFRAMES];
  }, [draft]);

  const handleUpdateField = (key: keyof StrategyConfig, value: string) => {
    if (!draft) return;
    setDraft({ ...draft, [key]: value, updatedAt: Date.now() });
  };

  const handleToggleTimeframe = (timeframe: StrategyTimeframe) => {
    if (!draft) return;
    const exists = draft.timeframes.some((tf) => tf.timeframe === timeframe);
    const baseIndicators = buildDefaultIndicators(draft.tradeMode);

    let nextTimeframes: StrategyConfig["timeframes"];
    if (exists) {
      nextTimeframes = draft.timeframes.filter(
        (tf) => tf.timeframe !== timeframe
      );
    } else {
      nextTimeframes = [
        ...draft.timeframes,
        {
          timeframe,
          indicators: baseIndicators.map((indicator) => ({
            ...indicator,
            params: { ...indicator.params },
          })),
        },
      ];
    }

    nextTimeframes.sort(
      (a, b) =>
        timeframeOptions.indexOf(a.timeframe) -
        timeframeOptions.indexOf(b.timeframe)
    );

    setDraft({ ...draft, timeframes: nextTimeframes, updatedAt: Date.now() });
  };

  const handleIndicatorParamChange = (
    timeframe: StrategyTimeframe,
    indicatorIndex: number,
    paramKey: keyof IndicatorConfigSpec["params"],
    value: string
  ) => {
    if (!draft) return;
    setDraft((prev) => {
      if (!prev) return prev;
      const nextTimeframes = prev.timeframes.map((tf) => {
        if (tf.timeframe !== timeframe) return tf;
        const indicators = tf.indicators.map((indicator, idx) => {
          if (idx !== indicatorIndex) return indicator;
          const nextParams = { ...indicator.params };
          const numericValue = Number(value);
          nextParams[paramKey] = Number.isFinite(numericValue)
            ? numericValue
            : undefined;
          return {
            ...indicator,
            params: nextParams,
          };
        });
        return { ...tf, indicators };
      });
      return { ...prev, timeframes: nextTimeframes, updatedAt: Date.now() };
    });
  };

  const handleResetToDefaults = () => {
    if (!draft) return;
    const defaultIndicators = buildDefaultIndicators(draft.tradeMode);
    const resetTimeframes = timeframeOptions.map((tf) => ({
      timeframe: tf,
      indicators: defaultIndicators.map((indicator) => ({
        ...indicator,
        params: { ...indicator.params },
      })),
    }));
    setDraft({
      ...draft,
      timeframes: resetTimeframes,
      updatedAt: Date.now(),
    });
  };

  const handleSave = () => {
    if (!draft || !selectedGroupId) return;
    if (!draft.name.trim()) {
      Alert.alert("Name required", "Please enter a strategy name.");
      return;
    }
    updateStrategy(selectedGroupId, {
      ...draft,
      id: selectedGroupId,
      updatedAt: Date.now(),
    });
    if (watchlistName.trim() && groupWatchlist) {
      renameWatchlist(selectedGroupId, watchlistName.trim());
    }
    setEditingName(false);
    Alert.alert("Saved", "Group strategy updated.");
  };

  const handleAddSymbol = () => {
    if (!selectedGroupId || !symbolEntry.trim()) return;
    addWatchlistSymbol(selectedGroupId, symbolEntry.trim());
    setSymbolEntry("");
  };

  const handleRemoveSymbol = (symbol: string) => {
    if (!selectedGroupId) return;
    removeWatchlistSymbol(selectedGroupId, symbol);
  };

  if (!selectedGroupId) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Select a Strategy Group</Text>
        <Text style={styles.emptySubtitle}>
          Choose or create a strategy group from Strategy Settings to customize
          its strategy and watchlist.
        </Text>
      </View>
    );
  }

  if (!draft) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Loading strategy…</Text>
      </View>
    );
  }

  const displayTitle = selectedGroup?.name
    ? `${selectedGroup?.name} Strategy`
    : "Strategy Builder";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{displayTitle}</Text>
      <Text style={styles.subtitle}>
        Configure the shared strategy and watchlist used for signals in this
        group.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Strategy Details</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Name</Text>
          <TextInput
            value={draft.name}
            onChangeText={(value) => handleUpdateField("name", value)}
            placeholder="Strategy name"
            placeholderTextColor="#6B7280"
            style={styles.input}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            value={draft.description ?? ""}
            onChangeText={(value) => handleUpdateField("description", value)}
            placeholder="Describe the strategy"
            placeholderTextColor="#6B7280"
            style={[styles.input, styles.multilineInput]}
            multiline
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Timeframes</Text>
          <Pressable onPress={handleResetToDefaults} style={styles.resetButton}>
            <Ionicons
              name="refresh"
              size={16}
              color="#14b8a6"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.resetButtonText}>Reset to defaults</Text>
          </Pressable>
        </View>
        <View style={styles.timeframeRow}>
          {timeframeOptions.map((timeframe) => {
            const enabled = draft.timeframes.some(
              (tf) => tf.timeframe === timeframe
            );
            return (
              <Pressable
                key={timeframe}
                onPress={() => handleToggleTimeframe(timeframe)}
                style={[
                  styles.timeframeChip,
                  enabled && styles.timeframeChipActive,
                ]}
              >
                <Text
                  style={
                    enabled
                      ? styles.timeframeChipTextActive
                      : styles.timeframeChipText
                  }
                >
                  {formatTimeframeLabel(timeframe)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {draft.timeframes.map((tf) => (
        <View key={tf.timeframe} style={styles.section}>
          <Text style={styles.sectionTitle}>
            {formatTimeframeLabel(tf.timeframe)} Indicators
          </Text>
          <View style={styles.indicatorList}>
            {tf.indicators.map((indicator, idx) => (
              <View
                key={`${indicator.type}-${idx}`}
                style={styles.indicatorCard}
              >
                <View style={styles.indicatorHeader}>
                  <Text style={styles.indicatorName}>{indicator.label}</Text>
                  <Text style={styles.indicatorType}>
                    {indicator.type.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.paramList}>
                  {Object.entries(indicator.params).map(([key, value]) => (
                    <View key={key} style={styles.paramRow}>
                      <Text style={styles.paramLabel}>
                        {key.replace("_", " ")}
                      </Text>
                      <TextInput
                        value={value ? String(value) : ""}
                        onChangeText={(text) =>
                          handleIndicatorParamChange(
                            tf.timeframe,
                            idx,
                            key as keyof IndicatorConfigSpec["params"],
                            text
                          )
                        }
                        placeholder="--"
                        placeholderTextColor="#6B7280"
                        keyboardType="number-pad"
                        style={styles.paramInput}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Group Watchlist</Text>
        <View style={styles.inputGroup}>
          <View style={styles.watchlistHeader}>
            <Text style={styles.inputLabel}>Watchlist name</Text>
            <Pressable
              onPress={() => setEditingName((prev) => !prev)}
              style={styles.editToggle}
            >
              <Ionicons
                name={editingName ? "close" : "create-outline"}
                size={16}
                color="#38bdf8"
                style={{ marginRight: 4 }}
              />
              <Text style={{ color: "#38bdf8", fontWeight: "600" }}>
                {editingName ? "Cancel" : "Rename"}
              </Text>
            </Pressable>
          </View>
          <TextInput
            value={watchlistName}
            onChangeText={setWatchlistName}
            placeholder="Group Watchlist"
            placeholderTextColor="#6B7280"
            style={[styles.input, !editingName && { opacity: 0.6 }]}
            editable={editingName}
          />
        </View>
        <View style={styles.watchlistRow}>
          <TextInput
            value={symbolEntry}
            onChangeText={setSymbolEntry}
            placeholder="Add ticker (e.g. AAPL)"
            placeholderTextColor="#6B7280"
            style={[styles.input, { flex: 1 }]}
            autoCapitalize="characters"
          />
          <Pressable onPress={handleAddSymbol} style={styles.addSymbolButton}>
            <Text style={styles.addSymbolText}>Add</Text>
          </Pressable>
        </View>
        <View style={styles.symbolList}>
          {groupWatchlist?.symbols.length ? (
            groupWatchlist.symbols.map((sym) => (
              <View key={sym} style={styles.symbolChip}>
                <Text style={styles.symbolChipText}>{sym}</Text>
                <Pressable onPress={() => handleRemoveSymbol(sym)}>
                  <Ionicons name="close" size={16} color="#94a3b8" />
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={styles.symbolEmpty}>No symbols tracked yet.</Text>
          )}
        </View>
        <Text style={styles.symbolHint}>
          Only symbols added to this watchlist will trigger signals and
          notifications for subscribed members.
        </Text>
      </View>

      <View style={styles.section}>
        <Pressable onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save Group Strategy</Text>
        </Pressable>
        <Text style={styles.saveHint}>
          Updates apply to all members of this group and their notifications.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  content: {
    padding: 20,
    paddingBottom: 60,
    gap: 16,
  },
  title: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 15,
    marginBottom: 20,
  },
  section: {
    marginBottom: 12,
    backgroundColor: "#111c32",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#e2e8f0",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: "#cbd5f5",
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#0b1220",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
    color: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  timeframeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  timeframeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#0f172a",
  },
  timeframeChipActive: {
    borderColor: "#38bdf8",
    backgroundColor: "#13263f",
  },
  timeframeChipText: {
    color: "#94a3b8",
    fontWeight: "600",
  },
  timeframeChipTextActive: {
    color: "#e0f2fe",
    fontWeight: "700",
  },
  indicatorList: {
    gap: 12,
  },
  indicatorCard: {
    backgroundColor: "#0b1220",
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 12,
    padding: 14,
  },
  indicatorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  indicatorName: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "600",
  },
  indicatorType: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  paramList: {
    gap: 10,
  },
  paramRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
  },
  paramLabel: {
    color: "#cbd5f5",
    fontSize: 14,
    flex: 1,
  },
  paramInput: {
    width: 80,
    backgroundColor: "#111c32",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    color: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: "center",
    fontSize: 15,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#134e4a",
    backgroundColor: "#0b141a",
  },
  resetButtonText: {
    color: "#14b8a6",
    fontSize: 13,
    fontWeight: "600",
  },
  watchlistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  addSymbolButton: {
    backgroundColor: "#38bdf8",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addSymbolText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 14,
  },
  symbolList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  symbolChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0b1220",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1f2937",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  symbolChipText: {
    color: "#e2e8f0",
    fontWeight: "600",
  },
  symbolEmpty: {
    color: "#94a3b8",
    fontSize: 14,
  },
  symbolHint: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 12,
  },
  saveButton: {
    backgroundColor: "#38bdf8",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  saveHint: {
    marginTop: 12,
    color: "#94a3b8",
    fontSize: 13,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: "#0f172a",
  },
  emptyTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: "#94a3b8",
    fontSize: 15,
    textAlign: "center",
  },
  watchlistHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  editToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#38bdf8",
    backgroundColor: "#13263f",
  },
});
