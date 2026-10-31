export default function AdminProfile({ admin }) {
  const rows = [
    ["Name", admin?.full_name ?? admin?.name],
    ["Email", admin?.email],
    ["Role", admin?.role],
    ["Admin ID", admin?.id],
  ];

  return (
    <div className="page">
      <p style={{ color: "#a78bfa", marginBottom: 6 }}>PARKWISE / ADMINISTRATION</p>
      <h1 style={{ margin: 0 }}>Admin Profile</h1>
      <p style={{ opacity: 0.75 }}>
        Read-only details returned by the server for your signed-in account.
      </p>

      <section className="panel" style={{ padding: 24 }}>
        {admin ? (
          <dl style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "12px 16px", margin: 0 }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: "contents" }}>
                <dt style={{ opacity: 0.7 }}>{label}</dt>
                <dd style={{ margin: 0 }}>{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>Profile details are not available.</p>
        )}
      </section>
    </div>
  );
}
