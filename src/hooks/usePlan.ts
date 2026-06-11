import { useCoachIdentity } from "./useCoachIdentity";

export type Plan = "free" | "pro";

export function usePlan() {
  const { plan, fullName, identityLoading } = useCoachIdentity();

  return {
    plan,
    isPro: plan === "pro",
    isFree: plan !== "pro",
    fullName,
    planLoading: identityLoading,
  };
}
