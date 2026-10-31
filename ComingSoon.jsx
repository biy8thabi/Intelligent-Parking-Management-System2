export default function ComingSoon({ title }) {
  return (
    <div className="page">
      <p style={{ color: "#a78bfa", marginBottom: 6 }}>PARKWISE / ADMINISTRATION</p>
      <h1 style={{ margin: 0 }}>{title}</h1>

      <section className="panel" style={{ padding: 24, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Waiting for the backend</h2>
        <p>
          The admin API does not provide a {title.toLowerCase()} endpoint yet,
          so this page shows no data rather than made-up records.
        </p>
        <p style={{ opacity: 0.75 }}>
          Once the backend team adds the endpoint, this page can be connected to it.
        </p>
      </section>
    </div>
  );
}
