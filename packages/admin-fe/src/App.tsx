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

const TOKEN_KEY = "arena_admin_token";

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
  if (res.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY);
    window.location.reload();
  }
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

// ── Components ──────────────────────────────────────────

interface ContainerStatus {
  name: string;
  lastStatus: string;
  healthStatus: string | null;
}

interface ServiceStatus {
  status: string;
  runningCount: number | null;
  desiredCount: number | null;
  lastEvent: string | null;
  containers: ContainerStatus[];
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

const btnStyle = (bg: string, disabled: boolean): React.CSSProperties => ({
  padding: "8px 20px",
  fontSize: 14,
  cursor: disabled ? "wait" : "pointer",
  background: bg,
  color: "white",
  border: "none",
  borderRadius: 6,
});

function Dashboard({ token }: { token: string }) {
  const [service, setService] = useState<ServiceStatus | null>(null);
  const [live, setLive] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [serviceLoading, setServiceLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        gql<{ serviceStatus: ServiceStatus }>(
          token,
          "{ serviceStatus { status runningCount desiredCount lastEvent containers { name lastStatus healthStatus } } }",
        ),
        gql<{ live: boolean }>(token, "{ live }"),
      ]);
      setService(s.serviceStatus);
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

  const setServiceState = async (start: boolean) => {
    const mutation = start ? "startService" : "stopService";
    if (!start && !confirm("Stop the Fargate service?")) return;
    setServiceLoading(true);
    try {
      await gql<Record<string, boolean>>(token, `mutation { ${mutation} }`);
      await refresh();
    } catch (err) {
      console.error(`Failed to ${mutation}:`, err);
    }
    setServiceLoading(false);
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

  const running = (service?.runningCount ?? 0) > 0;

  return (
    <div style={{ fontFamily: "system-ui", padding: 32, maxWidth: 480 }}>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>Arena Admin</h1>

      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Fargate Service</h2>
      {service ? (
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8 }}>
            <StatusDot ok={running} />
            {running ? "Running" : "Stopped"} — {service.runningCount ?? 0}/
            {service.desiredCount ?? 0} tasks
          </div>
          {running && service.containers.length > 0 && (
            <div style={{ marginBottom: 12, paddingLeft: 20 }}>
              {service.containers.map((c) => (
                <div key={c.name} style={{ marginBottom: 4 }}>
                  <StatusDot ok={c.healthStatus === "HEALTHY"} />
                  <strong>{c.name}</strong> — {c.lastStatus}
                  {c.healthStatus && ` (${c.healthStatus.toLowerCase()})`}
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setServiceState(!running)}
            disabled={serviceLoading}
            style={btnStyle(running ? "#ef4444" : "#22c55e", serviceLoading)}
          >
            {serviceLoading
              ? "Updating..."
              : running
                ? "Stop Service"
                : "Start Service"}
          </button>
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
          type="button"
          onClick={toggle}
          disabled={toggling}
          style={btnStyle(live ? "#ef4444" : "#22c55e", toggling)}
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
          style={btnStyle("#ef4444", resetting)}
        >
          {resetting ? "Resetting..." : "Reset Database"}
        </button>
      </div>
    </div>
  );
}

// ── App ─────────────────────────────────────────────────

export function App() {
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem(TOKEN_KEY),
  );
  const authDisabled = !COGNITO_DOMAIN;

  useEffect(() => {
    const t = extractTokenFromHash();
    if (t) {
      sessionStorage.setItem(TOKEN_KEY, t);
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
