"use client";

import { useRef } from "react";
import { addTuitionCharge, setTuitionStatus, deleteTuitionCharge } from "@/app/actions";

type Charge = {
  id: string;
  description: string;
  amount_cents: number;
  due_on: string | null;
  status: string;
  paid_on: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
};
type Option = { id: string; label: string };

export default function TuitionModal({
  charges,
  courses,
  students,
}: {
  charges: Charge[];
  courses: Option[];
  students: Option[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const outstanding = charges
    .filter((c) => c.status === "unpaid")
    .reduce((s, c) => s + c.amount_cents, 0);

  return (
    <>
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>Tuition</p>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {charges.length} charge{charges.length === 1 ? "" : "s"} ·{" "}
            ${(outstanding / 100).toFixed(2)} outstanding
          </p>
        </div>
        <button type="button" onClick={() => ref.current?.showModal()}>
          Manage tuition
        </button>
      </div>

      <dialog ref={ref} className="modal">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <h2 style={{ margin: 0 }}>Tuition</h2>
          <button type="button" className="ghost-ink" onClick={() => ref.current?.close()}>
            ✕ Close
          </button>
        </div>

        <details style={{ marginTop: 14 }}>
          <summary className="muted" style={{ cursor: "pointer" }}>
            ＋ Add charge (one student, or everyone in a course)
          </summary>
          <form action={addTuitionCharge} className="stack" style={{ marginTop: 10 }}>
            <div>
              <label>Description (e.g. “Hermeneutics — Fall 2026 Tuition”)</label>
              <input name="description" type="text" required className="text-input" />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label>Amount ($)</label>
                <input name="amount" type="number" step="0.01" min="0" required className="text-input" defaultValue="280" />
              </div>
              <div style={{ flex: 1 }}>
                <label>Due date</label>
                <input name="due_on" type="date" className="text-input" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label>Bill everyone enrolled in</label>
                <select name="course_id" className="text-input" defaultValue="">
                  <option value="">— choose course —</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label>…or just one student</label>
                <select name="student_id" className="text-input" defaultValue="">
                  <option value="">— everyone in course above —</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit">Add charge</button>
          </form>
        </details>

        <div style={{ marginTop: 14 }}>
          {charges.length === 0 ? (
            <p className="muted">No tuition charges yet.</p>
          ) : (
            charges.map((t) => (
              <div key={t.id} className="item-row">
                <div>
                  <strong>{t.profiles?.full_name || t.profiles?.email}</strong>
                  <span className="muted"> — {t.description}</span>
                  <p className="muted" style={{ margin: "2px 0 0" }}>
                    ${(t.amount_cents / 100).toFixed(2)}
                    {t.due_on ? ` · due ${t.due_on}` : ""}
                    {t.status === "paid" && t.paid_on ? ` · paid ${t.paid_on}` : ""}
                  </p>
                </div>
                <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {["unpaid", "paid", "waived"].map((st) => (
                    <form key={st} action={setTuitionStatus}>
                      <input type="hidden" name="charge_id" value={t.id} />
                      <input type="hidden" name="status" value={st} />
                      <button type="submit" className={t.status === st ? "att-btn att-active" : "att-btn"}>
                        {st}
                      </button>
                    </form>
                  ))}
                  <form action={deleteTuitionCharge}>
                    <input type="hidden" name="charge_id" value={t.id} />
                    <button type="submit" className="ghost-ink">✕</button>
                  </form>
                </span>
              </div>
            ))
          )}
        </div>
      </dialog>
    </>
  );
}
