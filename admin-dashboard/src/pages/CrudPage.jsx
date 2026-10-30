
import { useCallback, useEffect, useMemo, useState } from "react";
import { request } from "../services/api";
import "../styles.css";

const PAYMENT_ENDPOINT = "/api/admin/payments";

function formatMoney(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(amount);
}

function formatDate(value) {
  if (!value) return "—";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getStatus(payment) {
  return String(
    payment.status ??
      payment.payment_status ??
      "unknown"
  ).toLowerCase();
}

function getPaymentId(payment) {
  return (
    payment.payment_id ??
    payment.id ??
    payment.transaction_id ??
    "—"
  );
}

function getAmount(payment) {
  return Number(
    payment.amount ??
      payment.amount_paid ??
      payment.total_amount ??
      0
  );
}

function getReference(payment) {
  return (
    payment.reference ??
    payment.transaction_reference ??
    payment.payment_reference ??
    "—"
  );
}

function getMethod(payment) {
  return (
    payment.payment_method ??
    payment.method ??
    "Not provided"
  );
}

function getDate(payment) {
  return (
    payment.created_at ??
    payment.paid_at ??
    payment.payment_date ??
    null
  );
}

function StatusBadge({ status }) {
  const styles = {
    completed: "payment-status payment-status-success",
    successful: "payment-status payment-status-success",
    paid: "payment-status payment-status-success",
    pending: "payment-status payment-status-pending",
    failed: "payment-status payment-status-failed",
    cancelled: "payment-status payment-status-failed",
    refunded: "payment-status payment-status-refunded",
  };

  return (
    <span className={styles[status] ?? "payment-status"}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SummaryCard({ title, value, description }) {
  return (
    <article className="panel payment-summary-card">
      <p className="payment-summary-label">{title}</p>
      <h2 className="payment-summary-value">{value}</h2>
      <p className="payment-summary-description">
        {description}
      </p>
    </article>
  );
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = sessionStorage.getItem("pw_admin_token");

      if (!token) {
        throw new Error(
          "Your admin session has expired. Please log in again."
        );
      }

      const result = await request(PAYMENT_ENDPOINT, {
        token,
      });

      // Accept common API response shapes.
      const records = Array.isArray(result)
        ? result
        : result?.payments ??
          result?.transactions ??
          result?.data;

      if (!Array.isArray(records)) {
        throw new Error(
          "The payments endpoint did not return a payment list. Check the backend response format."
        );
      }

      setPayments(records);
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load payments from the backend."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return payments.filter((payment) => {
      const status = getStatus(payment);

      const matchesStatus =
        statusFilter === "all" ||
        status === statusFilter;

      const searchableText = [
        getPaymentId(payment),
        getReference(payment),
        getMethod(payment),
        payment.session_id,
        payment.user_id,
        payment.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        (!query || searchableText.includes(query))
      );
    });
  }, [payments, search, statusFilter]);

  const totals = useMemo(() => {
    const completed = payments.filter((payment) =>
      ["completed", "successful", "paid"].includes(
        getStatus(payment)
      )
    );

    const pending = payments.filter(
      (payment) => getStatus(payment) === "pending"
    );

    const failed = payments.filter((payment) =>
      ["failed", "cancelled"].includes(getStatus(payment))
    );

    return {
      count: payments.length,
      completedCount: completed.length,
      pendingCount: pending.length,
      failedCount: failed.length,
      received: completed.reduce(
        (sum, payment) => sum + getAmount(payment),
        0
      ),
    };
  }, [payments]);

  function exportCsv() {
    const headers = [
      "Payment ID",
      "Reference",
      "Amount (ZAR)",
      "Method",
      "Status",
      "Date",
    ];

    const rows = filteredPayments.map((payment) => [
      getPaymentId(payment),
      getReference(payment),
      getAmount(payment),
      getMethod(payment),
      getStatus(payment),
      getDate(payment) ?? "",
    ]);

    const escapeCsv = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "parkwise-payments.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <main className="payments-page">
      <header className="payments-header">
        <div>
          <p className="payments-eyebrow">
            PARKWISE ADMINISTRATION
          </p>
          <h1>Payments</h1>
          <p className="payments-subtitle">
            Monitor parking payment transactions and their
            recorded statuses.
          </p>
        </div>

        <button
          type="button"
          className="payments-button"
          onClick={loadPayments}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {error && (
        <section className="panel payments-error" role="alert">
          <h2>Payments could not be loaded</h2>
          <p>{error}</p>
          <p>
            Expected endpoint: <code>{PAYMENT_ENDPOINT}</code>.
            This path must match a real route in your backend.
          </p>
          <button
            type="button"
            className="payments-button"
            onClick={loadPayments}
          >
            Try again
          </button>
        </section>
      )}

      {!error && !loading && (
        <>
          <section className="payments-summary">
            <SummaryCard
              title="Total transactions"
              value={totals.count}
              description="Records returned by the backend"
            />

            <SummaryCard
              title="Payments received"
              value={formatMoney(totals.received)}
              description="Records marked paid or successful"
            />

            <SummaryCard
              title="Pending payments"
              value={totals.pendingCount}
              description="Awaiting a recorded final status"
            />

            <SummaryCard
              title="Failed or cancelled"
              value={totals.failedCount}
              description="Transactions not marked successful"
            />
          </section>

          <section className="panel payments-table-panel">
            <div className="payments-table-heading">
              <div>
                <h2>Transaction history</h2>
                <p>
                  Showing {filteredPayments.length} of{" "}
                  {payments.length} records
                </p>
              </div>

              <button
                type="button"
                className="payments-button payments-button-secondary"
                onClick={exportCsv}
                disabled={filteredPayments.length === 0}
              >
                Export CSV
              </button>
            </div>

            <div className="payments-filters">
              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search ID, reference, method..."
                aria-label="Search payments"
              />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                aria-label="Filter by payment status"
              >
                <option value="all">All statuses</option>
                <option value="completed">Completed</option>
                <option value="successful">Successful</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            <div className="payments-table-wrapper">
              <table className="payments-table">
                <thead>
                  <tr>
                    <th>Payment ID</th>
                    <th>Reference</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPayments.map((payment, index) => (
                    <tr
                      key={`${getPaymentId(payment)}-${index}`}
                    >
                      <td>{getPaymentId(payment)}</td>
                      <td>{getReference(payment)}</td>
                      <td>{formatMoney(getAmount(payment))}</td>
                      <td>{getMethod(payment)}</td>
                      <td>
                        <StatusBadge
                          status={getStatus(payment)}
                        />
                      </td>
                      <td>{formatDate(getDate(payment))}</td>
                    </tr>
                  ))}

                  {filteredPayments.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="payments-empty"
                      >
                        {payments.length === 0
                          ? "No payment records were returned."
                          : "No transactions match your search."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="payments-footnote">
              Totals are calculated from the records returned by
              the backend. Confirm that payment statuses are
              verified by the payment provider before relying on
              these figures as actual revenue.
            </p>
          </section>
        </>
      )}

      {loading && (
        <section className="panel payments-loading">
          Loading payment records...
        </section>
      )}

      <style>{`
        .payments-page {
          display: grid;
          gap: 24px;
          padding-bottom: 32px;
          color: var(--text, inherit);
        }

        .payments-header,
        .payments-table-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .payments-header h1 {
          margin: 4px 0 8px;
          font-size: clamp(1.8rem, 4vw, 2.5rem);
        }

        .payments-eyebrow {
          margin: 0;
          font-size: 0.75rem;
          letter-spacing: 0.14em;
          font-weight: 700;
          color: #9b78ff;
        }

        .payments-subtitle,
        .payments-table-heading p,
        .payments-summary-description,
        .payments-footnote {
          color: var(--muted, #888);
          line-height: 1.5;
        }

        .payments-button {
          border: 0;
          border-radius: 10px;
          padding: 11px 16px;
          background: #7c3aed;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }

        .payments-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .payments-button-secondary {
          background: transparent;
          border: 1px solid var(--border, #444);
          color: var(--text, inherit);
        }

        .payments-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .payment-summary-card {
          min-width: 0;
          padding: 20px;
          border: 1px solid var(--border, #333);
          border-radius: 14px;
        }

        .payment-summary-label {
          margin: 0 0 12px;
          color: var(--muted, #888);
          font-size: 0.9rem;
        }

        .payment-summary-value {
          margin: 0 0 8px;
          font-size: clamp(1.2rem, 2vw, 1.8rem);
          overflow-wrap: anywhere;
        }

        .payment-summary-description {
          margin: 0;
          font-size: 0.8rem;
        }

        .payments-table-panel {
          min-width: 0;
          padding: 20px;
          border: 1px solid var(--border, #333);
          border-radius: 14px;
        }

        .payments-table-heading h2 {
          margin: 0 0 6px;
        }

        .payments-table-heading p {
          margin: 0;
          font-size: 0.9rem;
        }

        .payments-filters {
          display: flex;
          gap: 12px;
          margin: 22px 0;
          flex-wrap: wrap;
        }

        .payments-filters input,
        .payments-filters select {
          min-width: 180px;
          max-width: 100%;
          padding: 11px 12px;
          border-radius: 9px;
          border: 1px solid var(--border, #444);
          background: var(--surface, transparent);
          color: var(--text, inherit);
        }

        .payments-filters input {
          flex: 1;
        }

        .payments-table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .payments-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .payments-table th,
        .payments-table td {
          padding: 14px 12px;
          border-bottom: 1px solid var(--border, #333);
          white-space: nowrap;
        }

        .payments-table th {
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted, #888);
        }

        .payment-status {
          display: inline-block;
          border-radius: 999px;
          padding: 5px 9px;
          background: #555;
          color: white;
          font-size: 0.78rem;
          font-weight: 600;
        }

        .payment-status-success {
          background: #166534;
        }

        .payment-status-pending {
          background: #854d0e;
        }

        .payment-status-failed {
          background: #991b1b;
        }

        .payment-status-refunded {
          background: #5b21b6;
        }

        .payments-empty {
          padding: 30px 12px !important;
          text-align: center;
          color: var(--muted, #888);
        }

        .payments-footnote {
          margin: 18px 0 0;
          font-size: 0.82rem;
        }

        .payments-error {
          padding: 20px;
          border: 1px solid #b91c1c;
          border-radius: 12px;
        }

        .payments-error code {
          overflow-wrap: anywhere;
        }

        .payments-loading {
          padding: 28px;
          text-align: center;
        }

        @media (max-width: 1000px) {
          .payments-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .payments-summary {
            grid-template-columns: 1fr;
          }

          .payments-table-panel {
            padding: 14px;
          }

          .payments-filters input,
          .payments-filters select {
            width: 100%;
            min-width: 0;
          }
        }
      `}</style>
    </main>
  );
}
