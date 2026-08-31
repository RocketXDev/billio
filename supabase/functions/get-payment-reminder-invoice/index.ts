// supabase/functions/get-payment-reminder-invoice/index.ts
// Validates token and returns invoice details WITHOUT marking paid
// Used by the confirmation page to show invoice info before coach confirms
//
// Combined-invoice support: if the anchor invoice (the one the token was
// issued for) belongs to a group (invoice_group_id, stamped by
// send-combined-invoice), also return its sibling invoices as `group` +
// `grandTotal` so the confirm page can show the full per-student breakdown
// instead of just one invoice. Additive only — existing single-invoice
// callers see `group`/`grandTotal` as null and are unaffected.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tokenRow, error: tokenError } = await supabase
      .from("payment_reminder_tokens")
      .select("id, invoice_id, expires_at, used")
      .eq("token", token)
      .single();

    if (tokenError || !tokenRow) {
      return new Response(JSON.stringify({ error: "Invalid or expired link." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "This link has expired. Please open the Billio app." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, invoice_number, total, status, invoice_group_id, students(student_name)")
      .eq("id", tokenRow.invoice_id)
      .single();

    if (!invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let group: { student_name: string; total: number }[] | null = null;
    let grandTotal: number | null = null;

    if (invoice.invoice_group_id) {
      const { data: siblings } = await supabase
        .from("invoices")
        .select("id, total, students(student_name)")
        .eq("invoice_group_id", invoice.invoice_group_id);

      if (siblings && siblings.length > 1) {
        group = siblings.map((s: any) => ({
          student_name: (Array.isArray(s.students) ? s.students[0] : s.students)?.student_name || "Student",
          total: Number(s.total || 0),
        }));
        grandTotal = group.reduce((sum, s) => sum + s.total, 0);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      already_paid: invoice.status === "paid" || tokenRow.used,
      invoice,
      group,
      grandTotal,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
