import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { useCoachIdentity } from "./useCoachIdentity";

export interface DashboardWidgets {
  pinned: string[];
  // Insertion index for the Quick Tools section among the 3 fixed sections
  // (Stats, Upcoming, Recent Invoices): 0 = before Stats, 1 = between Stats
  // and Upcoming, 2 = between Upcoming and Invoices, 3 = after Invoices.
  quickToolsPosition: number;
}

const DEFAULTS: DashboardWidgets = {
  pinned: [],
  quickToolsPosition: 3,
};

export function useDashboardWidgets() {
  const { coachId, identityLoading } = useCoachIdentity();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-widgets", coachId],
    queryFn: async () => {
      const { data: coachData } = await supabase
        .from("coaches")
        .select("dashboard_widgets")
        .eq("id", coachId)
        .single();
      return coachData?.dashboard_widgets ?? null;
    },
    enabled: !!coachId,
  });

  const widgets: DashboardWidgets = {
    pinned: data?.pinned ?? DEFAULTS.pinned,
    quickToolsPosition:
      typeof data?.quickToolsPosition === "number" ? data.quickToolsPosition : DEFAULTS.quickToolsPosition,
  };

  async function persist(next: DashboardWidgets) {
    await supabase
      .from("coaches")
      .update({ dashboard_widgets: next })
      .eq("id", coachId);
    queryClient.invalidateQueries({ queryKey: ["dashboard-widgets", coachId] });
  }

  async function togglePinned(slug: string) {
    const nextPinned = widgets.pinned.includes(slug)
      ? widgets.pinned.filter((s) => s !== slug)
      : [...widgets.pinned, slug];
    await persist({ ...widgets, pinned: nextPinned });
  }

  async function setQuickToolsPosition(position: number) {
    await persist({ ...widgets, quickToolsPosition: position });
  }

  return {
    pinned: widgets.pinned,
    quickToolsPosition: widgets.quickToolsPosition,
    // `isLoading` alone reports false while the query is still `enabled:
    // false` (i.e. before coachId resolves) — check for the data itself too,
    // otherwise `pinned` would render as its empty-array default before the
    // coach's actual saved selection arrives.
    widgetsLoading: identityLoading || !coachId || isLoading || data === undefined,
    togglePinned,
    setQuickToolsPosition,
  };
}
