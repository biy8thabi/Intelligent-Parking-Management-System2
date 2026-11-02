import { useCallback, useMemo, useState } from "react";
import { dismissPasswordRequest, getPasswordRequests, resetPasswordRequest } from "../services/api";
import useLoader from "../useLoader";
import { PageHead, Card, Notice, Updated, Badge } from "../components/ui";
import { formatDateTime } from "../utils";

const STATUS_TONE = { pending: "warn", done: "good", dismissed: undefined };
const STATUS_LABEL = { pending: "Waiting", done: "Reset done", dismissed: "Dismissed" };

// Drivers who forgot their password (GET /api/admin/password-requests).
// "Reset" gives a temporary password, shown once, that the admin passes on to the driver.
export default function PasswordRequests({ token, onUnauthorised }) {
  const [status, setStatus] = useState("pending");

  const fetcher = useCallback(() => getPasswordRequests(status, token), [status, token]);
  const { data, loading, error, lastUpdated, load } = useLoader(fetcher, {
    what: "Password requests",
    onUnauthorised,
  });

  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [reveal, setReveal] = useState(null); // { name, email, password }
  const [copied, setCopied] = useState(false);

  const requests = useMemo(() => (Array.isArray(data?.requests) ? data.requests : []), [data]);

  async function reset(r) {
    const who = r.users?.full_name || r.email;
    if (!window.confirm(`Reset the password for ${who}? Their old password will stop working straight away.`)) return;

    setBusyId(r.id);
    setActionError("");
    setNotice("");
    setCopied(false);

    try {
      const result = await resetPasswordRequest(r.id, token);
      setReveal({
        name: result?.user?.full_name || who,
        email: result?.user?.email || r.email,
        password: result?.temporary_password || "",
      });
      await load({ silent: true });
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onUnauthorised?.();
        return;
      }
      setActionError(err.message);
    } finally {
      setBusyId("");
    }
  }

  async function dismiss(r) {
    const who = r.users?.full_name || r.email;
    if (!window.confirm(`Dismiss the request from ${who}? Their password will not be changed.`)) return;

    setBusyId(r.id);
    setActionError("");
    setNotice("");

    try {
      await dismissPasswordRequest(r.id, token);
      setNotice("Request dismissed.");
      await load({ silent: true });
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onUnauthorised?.();
        return;
      }
      setActionError(err.message);
    } finally {
      setBusyId("");
    }
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(reveal.password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="page">
      <PageHead title="Password Requests" subtitle="Drivers who asked for help because they forgot their password.">
        <button className="btn" type="button" onClick={() => load()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </PageHead>

      <Updated time={lastUpdated} />
      {error && <Notice kind="error">{error}</Notice>}
      {actionError && <Notice kind="error">{actionError}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}

      {reveal && (
        <div className="secret-box" role="status">
          <b>Temporary password for {reveal.name}</b>
          <div>
            <code>{reveal.password}</code>
          </div>
          <p className="muted small">
            Give this to the driver ({reveal.email}) and ask them to change it after they sign in. It is shown only once,
            so copy it now.
          </p>
          <div className="actions" style={{ marginTop: 10 }}>
            <button className="btn btn-small" type="button" onClick={copyPassword}>
              {copied ? "Copied" : "Copy password"}
            </button>
            <button className="btn btn-small" type="button" onClick={() => setReveal(null)}>
              I have noted it - hide
            </button>
          </div>
        </div>
      )}

      {!error && (
        <Card
          title="Requests"
          subtitle={`${requests.length} shown`}
          actions={
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
              <option value="pending">Waiting</option>
              <option value="done">Reset done</option>
              <option value="dismissed">Dismissed</option>
              <option value="all">All</option>
            </select>
          }
        >
          {loading && !data ? (
            <p className="muted">Loading password requests…</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Requested</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <b>{r.users?.full_name || "—"}</b>
                      </td>
                      <td>{r.email || "—"}</td>
                      <td>{r.users?.phone_number || "—"}</td>
                      <td>{formatDateTime(r.created_at)}</td>
                      <td>
                        <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                      </td>
                      <td>
                        {r.status === "pending" ? (
                          <div className="row-actions">
                            <button className="btn btn-small btn-primary" type="button" disabled={Boolean(busyId)} onClick={() => reset(r)}>
                              {busyId === r.id ? "Working..." : "Reset password"}
                            </button>
                            <button className="btn btn-small" type="button" disabled={Boolean(busyId)} onClick={() => dismiss(r)}>
                              Dismiss
                            </button>
                          </div>
                        ) : (
                          <span className="muted small">{r.handled_at ? formatDateTime(r.handled_at) : "—"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted">
                        {status === "pending" ? "No drivers are waiting for a password reset." : "No requests found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
