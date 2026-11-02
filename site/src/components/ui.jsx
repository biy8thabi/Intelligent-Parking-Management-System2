// Small building blocks shared by every page, so all pages look and behave the same.

// Page title with an optional subtitle and action buttons on the right.
export function PageHead({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="actions no-print">{children}</div>}
    </div>
  );
}

// A white box with an optional heading row.
export function Card({ title, subtitle, actions, children }) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="actions no-print">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// One big number with a label. tone: "good" | "warn" | "brand" (optional).
export function Stat({ label, value, note, tone }) {
  return (
    <div className="stat">
      <p className="stat-label">{label}</p>
      <h2 className={"stat-value" + (tone ? " tone-" + tone : "")}>{value}</h2>
      {note && <p className="stat-note">{note}</p>}
    </div>
  );
}

// A message box. kind: "error" | "success" | undefined (plain).
export function Notice({ kind, children }) {
  return (
    <p className={"notice" + (kind ? " " + kind : "")} role={kind === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}

// "Last refreshed 14:02:11" line shown under live pages.
export function Updated({ time }) {
  if (!time) return null;
  return <p className="muted small">Last refreshed: {time.toLocaleTimeString("en-ZA")}</p>;
}

// A small coloured label, e.g. a status. tone: "good" | "warn" | "bad" | undefined (grey).
export function Badge({ tone, children }) {
  return <span className={"badge" + (tone ? " badge-" + tone : "")}>{children}</span>;
}

// A "Show more" button for long tables: shows `shown` of `total` rows.
export function ShowMore({ shown, total, onMore }) {
  if (shown >= total) return null;
  return (
    <p style={{ marginTop: 12 }}>
      <button className="btn btn-small" type="button" onClick={onMore}>
        Show more ({total - shown} left)
      </button>
    </p>
  );
}
