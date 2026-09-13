import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { useCoachIdentity } from "./useCoachIdentity";
import { REFERRALS_PER_REWARD } from "../lib/referral";

export interface ReferralSummary {
  code: string;
  referralsPerReward: number;
  invited: number;
  pending: number;
  qualified: number;
  /** Qualified referrals counted toward the *next* free month (0…per-1). */
  progress: number;
  remaining: number;
  rewardsTotal: number;
  rewardsApplied: number;
  rewardsPending: number;
}

export interface ReferralActivityItem {
  id: string;
  name: string;
  status: "pending" | "qualified" | "void";
  created_at: string;
  qualified_at: string | null;
}

const EMPTY: ReferralSummary = {
  code: "",
  referralsPerReward: REFERRALS_PER_REWARD,
  invited: 0,
  pending: 0,
  qualified: 0,
  progress: 0,
  remaining: REFERRALS_PER_REWARD,
  rewardsTotal: 0,
  rewardsApplied: 0,
  rewardsPending: 0,
};

export function useReferrals() {
  const { coachId, identityLoading } = useCoachIdentity();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["referrals", coachId],
    enabled: !!coachId,
    queryFn: async () => {
      const [summaryRes, activityRes] = await Promise.all([
        supabase.rpc("get_referral_summary"),
        supabase.rpc("get_referral_activity"),
      ]);

      const raw = summaryRes.data as Record<string, any> | null;
      const summary: ReferralSummary = raw?.ok
        ? {
            code: raw.code ?? "",
            referralsPerReward: raw.referrals_per_reward ?? REFERRALS_PER_REWARD,
            invited: raw.invited ?? 0,
            pending: raw.pending ?? 0,
            qualified: raw.qualified ?? 0,
            progress: raw.progress ?? 0,
            remaining: raw.remaining ?? REFERRALS_PER_REWARD,
            rewardsTotal: raw.rewards_total ?? 0,
            rewardsApplied: raw.rewards_applied ?? 0,
            rewardsPending: raw.rewards_pending ?? 0,
          }
        : EMPTY;

      return {
        summary,
        activity: (activityRes.data ?? []) as ReferralActivityItem[],
      };
    },
  });

  return {
    summary: data?.summary ?? EMPTY,
    activity: data?.activity ?? [],
    referralsLoading: identityLoading || !coachId || isLoading || data === undefined,
    refetchReferrals: refetch,
  };
}

/**
 * Cashes in any free months the coach has earned but not yet received.
 * Idempotent on the server (each reward carries a Stripe idempotency key), so
 * pages can fire this on load without coordinating.
 */
export async function applyReferralRewards() {
  const { data, error } = await supabase.functions.invoke("apply-referral-rewards");
  if (error) return { applied: 0 };
  return (data ?? { applied: 0 }) as { applied: number; pending?: number; reason?: string };
}
