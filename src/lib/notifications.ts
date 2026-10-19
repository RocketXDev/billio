import { supabase } from "./supabaseClient";

// Data side of the notification bell, shared by the mobile panel
// (Dashboard.tsx) and the desktop dropdown (DesktopLayout.tsx). What a click
// *does* differs per layout and stays in each component; the reads/writes
// and their side effects live here so the two can't drift apart.
//
// Both writes ask for the affected rows back: when Row Level Security doesn't
// allow a write, Supabase returns no error — it just changes nothing. Without
// this check the bell removed the item on screen and it came back on reload.

type NotificationRef = { id: string; type?: string | null };

/**
 * Where tapping a notification should go, from its optional `link` column
 * (announcements created with billio_admin.announce — see
 * supabase/sql/announcements.sql). Only in-app paths are followed, so a
 * notification can never send a coach to another site.
 */
export function notificationLink(notification: { link?: string | null }): string | null {
  const link = notification.link?.trim();
  // "//host" and "/\host" are protocol-relative URLs to another site.
  return link && link.startsWith("/") && !/^\/[/\\]/.test(link) ? link : null;
}

const blockedBy = (action: string) => ({
  message: `The server didn't ${action} this notification — your account may not have permission to (check the notifications table's RLS policies).`,
});

/** Returns the error, if any, so the caller decides how to report it. */
export async function markNotificationRead(notification: NotificationRef): Promise<unknown | null> {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notification.id)
    .select("id");
  if (error) return error;
  return data && data.length > 0 ? null : blockedBy("update");
}

/** Returns the error, if any, so the caller decides how to report it. */
export async function deleteNotification(notification: NotificationRef): Promise<unknown | null> {
  // The Dashboard re-creates the "complete tutorials again" notification
  // unless this flag says the coach deleted it — on either layout.
  if (notification.type === "tutorial_reset") {
    localStorage.setItem("billio_tutorial_reset_notification_deleted", "1");
  }
  const { data, error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notification.id)
    .select("id");
  if (error) return error;
  return data && data.length > 0 ? null : blockedBy("delete");
}
