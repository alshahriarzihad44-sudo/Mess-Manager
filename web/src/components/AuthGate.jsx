
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import App from "../App";

export default function AuthGate() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [groupLoading, setGroupLoading] = useState(false);
  const [group, setGroup] = useState(null);
  const [error, setError] = useState("");

  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  // Check login session
  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) setError(error.message);
      setSession(data?.session ?? null);
      setLoading(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);

      if (event === "SIGNED_OUT") {
        setGroup(null);
        setError("");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Load active mess
  useEffect(() => {
    let cancelled = false;

    async function loadGroup() {
      if (!session) {
        setGroup(null);
        setGroupLoading(false);
        return;
      }

      setGroupLoading(true);
      setError("");

      const { data: membership, error: memberError } = await supabase
        .from("group_members")
        .select("id, group_id, role")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .maybeSingle();

      if (cancelled) return;

      if (memberError) {
        setError(memberError.message);
        setGroupLoading(false);
        return;
      }

      if (!membership) {
        setGroup(null);
        setGroupLoading(false);
        return;
      }

      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .select("id, name")
        .eq("id", membership.group_id)
        .single();

      if (cancelled) return;

      if (groupError) {
        setError(groupError.message);
        setGroup(null);
      } else {
        setGroup({
          ...groupData,
          membershipId: membership.id,
          role: membership.role,
        });
      }

      setGroupLoading(false);
    }

    loadGroup();

    return () => {
      cancelled = true;
    };
  }, [session]);

  // Google Login
  async function handleGoogleLogin() {
    setError("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) setError(error.message);
  }

  // Create Mess
  async function handleCreateGroup(e) {
    e.preventDefault();
    setError("");

    if (!groupName.trim()) {
      setError("Please enter a mess name.");
      return;
    }

    setGroupLoading(true);

    const { error } = await supabase.rpc("create_mess_group", {
      p_name: groupName.trim(),
    });

    if (error) {
      setError(error.message);
      setGroupLoading(false);
      return;
    }

    window.location.reload();
  }

  // Join Mess
  async function handleJoinGroup(e) {
    e.preventDefault();
    setError("");

    const code = inviteCode.trim().toLowerCase();

    if (code.length !== 10) {
      setError("Invite code must contain 10 characters.");
      return;
    }

    setGroupLoading(true);

    const { error } = await supabase.rpc("join_mess_group", {
      p_code: code,
    });

    if (error) {
      setError(error.message);
      setGroupLoading(false);
      return;
    }

    window.location.reload();
  }

  // Leave current Mess
  async function handleLeaveMess() {
    if (!group?.id) return false;

    const confirmed = window.confirm(
      "Are you sure you want to leave this mess? Your previous records will be preserved."
    );

    if (!confirmed) return false;

    setError("");
    setGroupLoading(true);

    const { error } = await supabase.rpc("leave_mess_group", {
      p_group_id: group.id,
    });

    if (error) {
      setError(error.message);
      setGroupLoading(false);
      return false;
    }

    setGroup(null);
    setGroupLoading(false);
    return true;
  }

  // Logout
  async function handleLogout() {
    setError("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(error.message);
    } else {
      setSession(null);
      setGroup(null);
    }
  }

  if (loading || (session && groupLoading)) {
    return (
      <div className="min-h-screen bg-[#101512] text-white flex items-center justify-center">
        Checking your account...
      </div>
    );
  }

  // Login screen
  if (!session) {
    return (
      <main className="min-h-screen bg-[#101512] text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#191e1b] p-7 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-2xl font-bold text-emerald-400">
            M
          </div>

          <h1 className="text-2xl font-bold">MessManager</h1>

          <p className="mt-2 mb-7 text-sm text-gray-400">
            Manage your mess, simply and securely.
          </p>

          {error && (
            <p className="mb-5 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            onClick={handleGoogleLogin}
            className="w-full rounded-lg bg-white py-3 font-semibold text-gray-800 hover:bg-gray-200"
          >
            Continue with Google
          </button>

          <p className="mt-6 text-xs leading-6 text-gray-500">
            Sign in securely using your Google account.
            <br />
            No separate MessManager password required.
          </p>
        </div>
      </main>
    );
  }

  // Dashboard
  if (group) {
    return (
      <App
        group={group}
        user={session.user}
        onLogout={handleLogout}
        onLeaveMess={handleLeaveMess}
      />
    );
  }

  // Create or Join Mess
  return (
    <main className="min-h-screen bg-[#101512] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#191e1b] p-7 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-2xl font-bold text-emerald-400">
            M
          </div>

          <h1 className="text-2xl font-bold">Welcome to MessManager</h1>

          <p className="mt-2 text-sm text-gray-400">
            Create a new mess or join an existing one.
          </p>
        </div>

        {error && (
          <p className="mb-5 rounded-lg bg-red-500/10 p-3 text-sm text-red-300 break-words">
            {error}
          </p>
        )}

        <form onSubmit={handleCreateGroup}>
          <h2 className="mb-3 text-lg font-semibold text-emerald-400">
            Create a New Mess
          </h2>

          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Enter your mess name"
            className="mb-3 w-full rounded-lg border border-white/10 bg-[#101512] px-4 py-3 text-white outline-none focus:border-emerald-500"
          />

          <button
            type="submit"
            disabled={groupLoading}
            className="w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {groupLoading ? "Please wait..." : "Create Mess"}
          </button>
        </form>

        <div className="my-7 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-gray-500">OR</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleJoinGroup}>
          <h2 className="mb-3 text-lg font-semibold text-blue-400">
            Join Existing Mess
          </h2>

          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Enter 10-character invite code"
            maxLength={10}
            className="mb-3 w-full rounded-lg border border-white/10 bg-[#101512] px-4 py-3 text-white outline-none focus:border-blue-500"
          />

          <button
            type="submit"
            disabled={groupLoading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {groupLoading ? "Please wait..." : "Join Mess"}
          </button>
        </form>

        <button
          onClick={handleLogout}
          className="mt-6 w-full rounded-lg border border-white/10 py-3 text-sm text-gray-400 hover:bg-white/5"
        >
          Logout
        </button>
      </div>
    </main>
  );
}
