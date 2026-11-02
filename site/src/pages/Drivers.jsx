import { useEffect, useState } from "react";
import { getAdminUsers } from "../services/api";
import { PageHead, Card, Notice } from "../components/ui";

// Lists the registered users returned by GET /api/admin/users (newest first).
export default function Drivers({ token, onUnauthorised }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    async function loadUsers() {
      setLoading(true);
      setError("");

      try {
        const data = await getAdminUsers(token);

        if (active) {
          const records = Array.isArray(data) ? data : data?.users;
          setUsers(Array.isArray(records) ? records : []);
        }
      } catch (err) {
        if (!active) return;

        if (err.status === 401 || err.status === 403) {
          onUnauthorised?.();
          return;
        }

        setError(err.message || "Could not load registered users.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadUsers();

    return () => {
      active = false;
    };
  }, [token, onUnauthorised]);

  const term = search.trim().toLowerCase();

  const filteredUsers = users.filter((user) =>
    [user.id, user.full_name, user.email, user.phone_number].some((value) =>
      String(value ?? "").toLowerCase().includes(term)
    )
  );

  return (
    <div className="page">
      <PageHead title="Drivers" subtitle="People who have registered with the system." />

      {error && <Notice kind="error">{error}</Notice>}

      <Card title="Registered Users" subtitle={`${users.length} users returned by the backend`}>
        <div className="toolbar">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or phone..."
            aria-label="Search registered users"
          />
        </div>

        {loading ? (
          <p className="muted">Loading registered users...</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, index) => (
                  <tr key={user.id ?? index}>
                    <td>
                      <b>{user.full_name || "—"}</b>
                    </td>
                    <td>{user.email || "—"}</td>
                    <td>{user.phone_number || "—"}</td>
                    <td>{user.created_at ? new Date(user.created_at).toLocaleDateString("en-ZA") : "—"}</td>
                  </tr>
                ))}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      {users.length > 0 ? "No users match your search." : "No registered users were returned."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
