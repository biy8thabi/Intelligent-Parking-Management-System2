import { PageHead, Card } from "../components/ui";

// Read-only details about the signed-in admin, as returned by the server.
export default function AdminProfile({ admin }) {
  const rows = [
    ["Name", admin?.full_name ?? admin?.name],
    ["Email", admin?.email],
    ["Role", admin?.role],
    ["Admin ID", admin?.id],
    ["Account created", admin?.created_at ? new Date(admin.created_at).toLocaleDateString("en-ZA") : undefined],
  ];

  return (
    <div className="page">
      <PageHead
        title="Admin Profile"
        subtitle="Read-only details returned by the server for your signed-in account."
      />

      <Card>
        {admin ? (
          <dl className="profile-list">
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: "contents" }}>
                <dt>{label}</dt>
                <dd>{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="muted">Profile details are not available.</p>
        )}
      </Card>
    </div>
  );
}
