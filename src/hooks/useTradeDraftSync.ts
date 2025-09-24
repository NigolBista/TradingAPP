import { useEffect, useMemo, useRef } from "react";
import type { DraftPlan } from "../store/composeDraftStore";
import { useComposeDraftStore } from "../store/composeDraftStore";
import {
  fetchUserDraftPlan,
  mapRemoteDraftPlan,
  upsertUserDraftPlan,
  deleteUserDraftPlan,
} from "../services/draftPlanService";

const UUID_REGEX = /^[0-9a-fA-F-]{36}$/;

type Params = {
  symbol: string;
  userId?: string | null;
  readOnly?: boolean;
  onHydrated?: (draft: DraftPlan | null) => void;
};

function normalizeDraftSignature(
  draft: DraftPlan | null | undefined
): string | null {
  if (!draft) return null;
  return JSON.stringify({
    entries: Array.isArray(draft.entries) ? draft.entries : [],
    exits: Array.isArray(draft.exits) ? draft.exits : [],
    tps: Array.isArray(draft.tps) ? draft.tps : [],
    updatedAt:
      typeof draft.updatedAt === "number" && Number.isFinite(draft.updatedAt)
        ? draft.updatedAt
        : 0,
  });
}

function cloneDraft(draft: DraftPlan): DraftPlan {
  return {
    entries: Array.isArray(draft.entries) ? [...draft.entries] : [],
    exits: Array.isArray(draft.exits) ? [...draft.exits] : [],
    tps: Array.isArray(draft.tps) ? [...draft.tps] : [],
    updatedAt:
      typeof draft.updatedAt === "number" && Number.isFinite(draft.updatedAt)
        ? draft.updatedAt
        : Date.now(),
  };
}

export function useTradeDraftSync({
  symbol,
  userId,
  readOnly = false,
  onHydrated,
}: Params) {
  const setDraftPlan = useComposeDraftStore((s) => s.setDraftPlan);
  const draft = useComposeDraftStore((s) => s.drafts[symbol] || null);

  const canPersistUserId = useMemo(() => {
    if (!userId) return null;
    return UUID_REGEX.test(userId) ? userId : null;
  }, [userId]);

  const persistSkipRef = useRef<boolean>(false);
  const lastPayloadRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hydrate from Supabase whenever user or symbol changes
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    persistSkipRef.current = true;
    lastPayloadRef.current = null;

    if (!canPersistUserId) {
      onHydrated?.(null);
      persistSkipRef.current = false;
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const remote = await fetchUserDraftPlan(canPersistUserId, symbol);
        if (cancelled) return;

        if (remote) {
          const mapped = mapRemoteDraftPlan(remote);
          const remoteSignature = normalizeDraftSignature(mapped);
          lastPayloadRef.current = remoteSignature;
          const current = useComposeDraftStore.getState().drafts[symbol] || null;
          const currentSignature = normalizeDraftSignature(current);
          if (remoteSignature !== currentSignature) {
            setDraftPlan(symbol, mapped);
            onHydrated?.(cloneDraft(mapped));
          } else {
            onHydrated?.(cloneDraft(mapped));
            persistSkipRef.current = false;
          }
        } else {
          lastPayloadRef.current = null;
          onHydrated?.(null);
        }
      } catch (error) {
        console.warn(
          `[useTradeDraftSync] Failed to hydrate draft for ${symbol}:`,
          error
        );
      } finally {
        if (!cancelled) {
          persistSkipRef.current = false;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canPersistUserId, symbol, setDraftPlan, onHydrated]);

  // Persist changes back to Supabase (unless read-only)
  useEffect(() => {
    if (readOnly || !canPersistUserId) {
      return;
    }

    const payloadSignature = normalizeDraftSignature(draft);

    if (persistSkipRef.current) {
      persistSkipRef.current = false;
      lastPayloadRef.current = payloadSignature;
      return;
    }

    if (payloadSignature === lastPayloadRef.current) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const draftSnapshot = draft ? cloneDraft(draft) : null;
    const delay = draftSnapshot ? 600 : 200;

    saveTimeoutRef.current = setTimeout(() => {
      (async () => {
        try {
          if (draftSnapshot) {
            await upsertUserDraftPlan({
              userId: canPersistUserId,
              symbol,
              draft: draftSnapshot,
            });
            lastPayloadRef.current = normalizeDraftSignature(draftSnapshot);
          } else {
            await deleteUserDraftPlan(canPersistUserId, symbol);
            lastPayloadRef.current = null;
          }
        } catch (error) {
          console.warn(
            `[useTradeDraftSync] Failed to persist draft for ${symbol}:`,
            error
          );
        }
      })();
    }, delay);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [draft, canPersistUserId, readOnly, symbol]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, []);
}

export default useTradeDraftSync;

