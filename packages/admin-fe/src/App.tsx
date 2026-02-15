import { useCallback, useEffect, useState } from "react";

// ── Cognito config (runtime injection or Vite env fallback) ──

const runtimeConfig = (window as unknown as Record<string, unknown>)
  .__ARENA_CONFIG__ as
  | { cognitoDomain?: string; cognitoClientId?: string }
  | undefined;

const COGNITO_DOMAIN =
  runtimeConfig?.cognitoDomain ||
  (import.meta.env.VITE_COGNITO_DOMAIN as string);
const COGNITO_CLIENT_ID =
  runtimeConfig?.cognitoClientId ||
  (import.meta.env.VITE_COGNITO_CLIENT_ID as string);
const REDIRECT_URI =
  (import.meta.env.VITE_REDIRECT_URI as string) || window.location.origin;

function getLoginUrl(): string {
  return `https://${COGNITO_DOMAIN}/login?client_id=${COGNITO_CLIENT_ID}&response_type=token&scope=openid+email&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
}

function extractTokenFromHash(): string | null {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get("id_token");
}

// ── GraphQL client ──────────────────────────────────────

async function gql<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch("/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

// ── Components ──────────────────────────────────────────

interface HealthData {
  proctor: { status: string };
  videographer: { status: string };
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: ok ? "#22c55e" : "#ef4444",
        marginRight: 8,
      }}
    />
  );
}

function Dashboard({ token }: { token: string }) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [live, setLive] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [resetting, setResetting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [h, l] = await Promise.all([
        gql<{ health: HealthData }>(
          token,
          "{ health { proctor { status } videographer { status } } }",
        ),
        gql<{ live: boolean }>(token, "{ live }"),
      ]);
      setHealth(h.health);
      setLive(l.live);
    } catch (err) {
      console.error("Failed to fetch status:", err);
    }
  }, [token]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const toggle = async () => {
    setToggling(true);
    try {
      const res = await gql<{ setLive: boolean }>(
        token,
        "mutation($live: Boolean!) { setLive(live: $live) }",
        { live: !live },
      );
      setLive(res.setLive);
    } catch (err) {
      console.error("Failed to toggle live:", err);
    }
    setToggling(false);
  };

  const resetDb = async () => {
    if (!confirm("Reset the database? This will delete all game data.")) return;
    setResetting(true);
    try {
      await gql<{ resetDatabase: boolean }>(
        token,
        "mutation { resetDatabase }",
      );
    } catch (err) {
      console.error("Failed to reset database:", err);
    }
    setResetting(false);
  };

  return (
    <div style={{ fontFamily: "system-ui", padding: 32, maxWidth: 480 }}>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>Arena Admin</h1>

      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Health</h2>
      {health ? (
        <div style={{ marginBottom: 24 }}>
          <div>
            <StatusDot ok={health.proctor.status === "ok"} />
            Proctor: {health.proctor.status}
          </div>
          <div>
            <StatusDot ok={health.videographer.status !== "unreachable"} />
            Videographer: {health.videographer.status}
          </div>
        </div>
      ) : (
        <p>Loading...</p>
      )}

      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Stream</h2>
      <div>
        <span style={{ marginRight: 12 }}>
          Status: <strong>{live ? "LIVE" : "STOPPED"}</strong>
        </span>
        <button
          onClick={toggle}
          disabled={toggling}
          style={{
            padding: "8px 20px",
            fontSize: 14,
            cursor: toggling ? "wait" : "pointer",
            background: live ? "#ef4444" : "#22c55e",
            color: "white",
            border: "none",
            borderRadius: 6,
          }}
        >
          {live ? "Stop" : "Start"}
        </button>
      </div>

      <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 12 }}>
        Database
      </h2>
      <div>
        <button
          type="button"
          onClick={resetDb}
          disabled={resetting}
          style={{
            padding: "8px 20px",
            fontSize: 14,
            cursor: resetting ? "wait" : "pointer",
            background: "#ef4444",
            color: "white",
            border: "none",
            borderRadius: 6,
          }}
        >
          {resetting ? "Resetting..." : "Reset Database"}
        </button>
      </div>
    </div>
  );
}

// ── App ─────────────────────────────────────────────────

export function App() {
  const [token, setToken] = useState<string | null>(null);
  const authDisabled = !COGNITO_DOMAIN;

  useEffect(() => {
    const t = extractTokenFromHash();
    if (t) {
      setToken(t);
      // Clean up the hash
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  // No Cognito configured — skip login (local Docker mode)
  if (authDisabled) {
    return <Dashboard token="" />;
  }

  if (!token) {
    return (
      <div
        style={{ fontFamily: "system-ui", padding: 32, textAlign: "center" }}
      >
        <h1 style={{ fontSize: 24, marginBottom: 24 }}>Arena Admin</h1>
        <a
          href={getLoginUrl()}
          style={{
            display: "inline-block",
            padding: "12px 32px",
            fontSize: 16,
            background: "#3b82f6",
            color: "white",
            borderRadius: 8,
            textDecoration: "none",
          }}
        >
          Login with Cognito
        </a>
      </div>
    );
  }

  return <Dashboard token={token} />;
}
