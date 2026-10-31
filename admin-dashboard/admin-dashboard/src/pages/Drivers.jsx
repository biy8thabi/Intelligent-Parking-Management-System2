
import { useEffect, useState } from "react";
import { getAdminUsers } from "../services/api";

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
          setUsers(Array.isArray(data.users) ? data.users : []);
        }
      } catch (err) {
        if (!active) return;

        if (err.status === 401 || err.status === 403) {
          onUnauthorised?.();
          return;
        }

        setError(err.message || "Could not load registered users.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      active = false;
    };
  }, [token, onUnauthorised]);

  const filteredUsers = users.filter((user) => {
    const term = search.trim().toLowerCase();

    return [
      user.id,
      user.full_name,
      user.email,
      user.phone_number,
    ].some((value) =>
      String(value ?? "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <p style={{ color: "#a78bfa", marginBottom: 6 }}>
          PARKWISE / ADMINISTRATION
        </p>

        <h1 style={{ margin: 0 }}>Drivers</h1>

        <p style={{ opacity: 0.75 }}>
          View registered user accounts and their contact details.
        </p>
      </div>

      <section className="panel" style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <div>
            <h2 style={{ marginTop: 0 }}>Registered Users</h2>

            <p style={{ opacity: 0.75 }}>
              {users.length} users returned by the backend
            </p>
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email or phone..."
            aria-label="Search registered users"
            style={{
              padding: 12,
              borderRadius: 8,
              border: "1px solid #777",
              background: "transparent",
              color: "inherit",
              maxWidth: "100%",
              width: 300,
              boxSizing: "border-box",
            }}
          />
        </div>

        {loading && <p>Loading registered users...</p>}

        {!loading && error && (
          <p role="alert" style={{ color: "#ef4444" }}>
            {error}
          </p>
        )}

        {!loading && !error && (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
              }}
            >
              <thead>
                <tr>
                  {[
                    "Full Name",
                    "Email",
                    "Phone Number",
                    "Registered",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: 12,
                        borderBottom: "1px solid #777",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td style={{ padding: 12 }}>
                      {user.full_name || "—"}
                    </td>

                    <td style={{ padding: 12 }}>
                      {user.email || "—"}
                    </td>

                    <td style={{ padding: 12 }}>
                      {user.phone_number || "—"}
                    </td>

                    <td style={{ padding: 12 }}>
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString(
                            "en-ZA"
                          )
                        : "—"}
                    </td>
                  </tr>
                ))}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 18 }}>
                      {search
                        ? "No users match your search."
                        : "No registered users were returned."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

