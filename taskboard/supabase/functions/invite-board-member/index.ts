import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// GitHub Pages URL the invite email's link sends the person back to, so
// they land in the app already signed in (Supabase's invite flow appends
// the session to the URL fragment, which supabase-js picks up on load).
const APP_URL = "https://hedonistbar.github.io/Hedonist/taskboard/";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Invites a person to a board by email, whether or not they already have
// an account — replaces share_board_by_email, which hard-failed for an
// email with no account and told the person to sign up first.
//
// If the email already has an account: added to board_members right away
// (same outcome share_board_by_email used to have).
// If not: records a pending board_invites row and asks Supabase Auth to
// send its own invite/signup email (service role only — the client can't
// call the Admin API directly). accept_pending_board_invites(), called on
// sign-in (see useAuth.ts), turns that pending row into real membership
// once they finish signing up via the link in that email.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "missing Authorization" }, 401);
  }

  let board_id: string | undefined;
  let email: string | undefined;
  try {
    ({ board_id, email } = await req.json());
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  if (!board_id || !email?.trim()) {
    return json({ error: "board_id and email are required" }, 400);
  }
  const normalizedEmail = email.trim().toLowerCase();

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return json({ error: "unauthorized" }, 401);
  }

  const { data: myMembership } = await userClient
    .from("board_members")
    .select("role")
    .eq("board_id", board_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (myMembership?.role !== "owner") {
    return json({ error: "only the board owner can invite" }, 403);
  }

  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: targetUserId, error: lookupError } = await serviceClient.rpc("find_user_id_by_email", {
    p_email: normalizedEmail,
  });
  if (lookupError) {
    return json({ error: lookupError.message }, 500);
  }

  if (targetUserId) {
    const { data: existing } = await serviceClient
      .from("board_members")
      .select("id")
      .eq("board_id", board_id)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (existing) {
      return json({ error: `${normalizedEmail} is already on this board` }, 409);
    }

    const { error: insertError } = await serviceClient
      .from("board_members")
      .insert({ board_id, user_id: targetUserId, role: "member", display_name: normalizedEmail });
    if (insertError) {
      return json({ error: insertError.message }, 500);
    }
    await serviceClient.from("board_invites").delete().eq("board_id", board_id).eq("email", normalizedEmail);
    return json({ status: "added" }, 200);
  }

  const { error: upsertError } = await serviceClient
    .from("board_invites")
    .upsert(
      { board_id, email: normalizedEmail, invited_by: user.id },
      { onConflict: "board_id,email" },
    );
  if (upsertError) {
    return json({ error: upsertError.message }, 500);
  }

  const { error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(normalizedEmail, {
    redirectTo: APP_URL,
  });
  if (inviteError) {
    return json({ error: inviteError.message }, 500);
  }

  return json({ status: "invited" }, 200);
});
