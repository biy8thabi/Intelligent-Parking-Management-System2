import { useCallback, useEffect, useMemo, useState } from "react";
import { createVehicle, deleteVehicle, getAdminUsers, getVehicles, updateVehicle } from "../services/api";
import useLoader from "../useLoader";
import { PageHead, Card, Stat, Notice, Updated, ShowMore } from "../components/ui";
import { downloadCSV, formatDate, localDate } from "../utils";

const PAGE_SIZE = 50;
const EMPTY_FORM = { registration_number: "", make: "", model: "", color: "", user_id: "" };

// The vehicle register: list, add, edit and delete (GET/POST/PUT/DELETE /api/admin/vehicles).
export default function Vehicles({ token, onUnauthorised }) {
  const fetcher = useCallback(() => getVehicles(token), [token]);
  const { data, loading, error, lastUpdated, load } = useLoader(fetcher, {
    what: "The vehicle register",
    onUnauthorised,
  });

  const [drivers, setDrivers] = useState([]);
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null); // null = adding a new vehicle
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  // The driver list is only used for the "Owner" menu, so a failure here is not fatal.
  useEffect(() => {
    let active = true;
    getAdminUsers(token)
      .then((result) => {
        const records = Array.isArray(result) ? result : result?.users;
        if (active && Array.isArray(records)) setDrivers(records);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token]);

  const vehicles = useMemo(() => (Array.isArray(data?.vehicles) ? data.vehicles : []), [data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return vehicles;
    return vehicles.filter((v) =>
      [v.registration_number, v.make, v.model, v.color, v.users?.full_name, v.users?.email].some((x) =>
        String(x ?? "").toLowerCase().includes(term)
      )
    );
  }, [vehicles, search]);

  const withOwner = vehicles.filter((v) => v.user_id).length;

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setNotice("");
    setShowForm(true);
  }

  function openEdit(v) {
    setEditingId(v.id);
    setForm({
      registration_number: v.registration_number ?? "",
      make: v.make ?? "",
      model: v.model ?? "",
      color: v.color ?? "",
      user_id: v.user_id ?? "",
    });
    setFormError("");
    setNotice("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormError("");
  }

  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setFormError("");

    const plate = form.registration_number.replace(/\s+/g, "");
    if (!plate) return setFormError("Enter a registration number.");
    if (plate.length > 20) return setFormError("The registration number is too long (maximum 20 characters).");

    const body = {
      registration_number: form.registration_number,
      make: form.make,
      model: form.model,
      color: form.color,
      user_id: form.user_id || null,
    };

    setSaving(true);

    try {
      if (editingId) {
        await updateVehicle(editingId, body, token);
        setNotice("Vehicle updated.");
      } else {
        await createVehicle(body, token);
        setNotice("Vehicle added to the register.");
      }
      closeForm();
      await load({ silent: true });
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onUnauthorised?.();
        return;
      }
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(v) {
    if (!window.confirm(`Delete vehicle ${v.registration_number} from the register? This cannot be undone.`)) return;

    setNotice("");

    try {
      await deleteVehicle(v.id, token);
      setNotice(`Vehicle ${v.registration_number} deleted.`);
      await load({ silent: true });
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onUnauthorised?.();
        return;
      }
      setNotice("");
      setFormError(err.message);
      setShowForm(false);
    }
  }

  function exportCSV() {
    downloadCSV(`parkwise-vehicles-${localDate()}.csv`, [
      ["ParkWise Vehicle Register"],
      ["Generated", new Date().toLocaleString("en-ZA")],
      [],
      ["Registration", "Make", "Model", "Colour", "Owner", "Owner email", "Added"],
      ...filtered.map((v) => [
        v.registration_number ?? "",
        v.make ?? "",
        v.model ?? "",
        v.color ?? "",
        v.users?.full_name ?? "",
        v.users?.email ?? "",
        formatDate(v.created_at),
      ]),
    ]);
  }

  return (
    <div className="page">
      <PageHead title="Vehicles" subtitle="The register of vehicles, and which driver each one belongs to.">
        <button className="btn" type="button" onClick={() => load()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
        <button className="btn" type="button" onClick={exportCSV} disabled={!filtered.length}>
          Export CSV
        </button>
        <button className="btn btn-primary" type="button" onClick={openAdd} disabled={Boolean(error)}>
          Add vehicle
        </button>
      </PageHead>

      <Updated time={lastUpdated} />
      {error && <Notice kind="error">{error}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}
      {!showForm && formError && <Notice kind="error">{formError}</Notice>}

      {showForm && (
        <Card title={editingId ? "Edit vehicle" : "Add a vehicle"}>
          <form onSubmit={save}>
            <div className="form-grid">
              <label>
                Registration number *
                <input
                  type="text"
                  value={form.registration_number}
                  onChange={(e) => setField("registration_number", e.target.value)}
                  placeholder="CA 123-456"
                  required
                />
              </label>
              <label>
                Make
                <input type="text" value={form.make} onChange={(e) => setField("make", e.target.value)} placeholder="Toyota" />
              </label>
              <label>
                Model
                <input type="text" value={form.model} onChange={(e) => setField("model", e.target.value)} placeholder="Corolla" />
              </label>
              <label>
                Colour
                <input type="text" value={form.color} onChange={(e) => setField("color", e.target.value)} placeholder="White" />
              </label>
              <label>
                Owner (driver)
                <select value={form.user_id} onChange={(e) => setField("user_id", e.target.value)}>
                  <option value="">No owner</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name || d.email}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="hint" style={{ marginBottom: 12 }}>
              Registration numbers are saved in capitals with no spaces, so &quot;ca 123-456&quot; and &quot;CA123-456&quot; count as the same vehicle.
            </p>

            {formError && <Notice kind="error">{formError}</Notice>}

            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save changes" : "Add vehicle"}
              </button>
              <button className="btn" type="button" onClick={closeForm} disabled={saving}>
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {!error && data && (
        <>
          <div className="stats">
            <Stat label="Vehicles registered" value={vehicles.length} />
            <Stat label="With an owner" value={withOwner} tone="good" />
            <Stat label="No owner linked" value={vehicles.length - withOwner} tone="warn" />
          </div>

          <Card title="Register" subtitle={`${filtered.length} shown`}>
            <div className="toolbar">
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setVisible(PAGE_SIZE);
                }}
                placeholder="Search registration, make, model or owner..."
                aria-label="Search vehicles"
              />
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Registration</th>
                    <th>Make and model</th>
                    <th>Colour</th>
                    <th>Owner</th>
                    <th>Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, visible).map((v) => (
                    <tr key={v.id}>
                      <td>
                        <b>{v.registration_number}</b>
                      </td>
                      <td>{[v.make, v.model].filter(Boolean).join(" ") || "—"}</td>
                      <td>{v.color || "—"}</td>
                      <td>{v.users ? v.users.full_name || v.users.email : "—"}</td>
                      <td>{formatDate(v.created_at)}</td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-small" type="button" onClick={() => openEdit(v)}>
                            Edit
                          </button>
                          <button className="btn btn-small btn-danger" type="button" onClick={() => remove(v)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted">
                        {vehicles.length ? "No vehicles match your search." : "No vehicles have been registered yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <ShowMore shown={visible} total={filtered.length} onMore={() => setVisible((v) => v + PAGE_SIZE)} />
          </Card>
        </>
      )}

      {loading && !data && !error && <p className="muted">Loading the vehicle register…</p>}
    </div>
  );
}
