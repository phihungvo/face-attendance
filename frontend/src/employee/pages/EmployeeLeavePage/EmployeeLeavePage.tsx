import { useEffect, useMemo, useState } from "react";
import styles from "./EmployeeLeavePage.module.scss";
import { useNavigate } from "react-router-dom";
import { createMyLeave, getMyLeaveBalance } from "../../../shared/api/leaves";
import { getApiErrorMessage } from "../../../shared/lib/apiClient";

const types = [
  { key: "annual", label: "Nghỉ phép", icon: "🌴", days: "12 ngày" },
  { key: "sick", label: "Nghỉ ốm", icon: "🤒", days: "8 ngày" },
  { key: "wfh", label: "Làm từ xa", icon: "🏠", days: "Không giới hạn" },
  { key: "other", label: "Khác", icon: "📝", days: "Tuỳ trường hợp" }
] as const;

export default function EmployeeLeavePage() {
  const nav = useNavigate();
  const [type, setType] = useState<(typeof types)[number]["key"]>("annual");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balanceHint, setBalanceHint] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const b = await getMyLeaveBalance();
        const annual = b.items.find((x) => x.type === "annual");
        const sick = b.items.find((x) => x.type === "sick");
        const hint = [
          annual ? `Phép năm còn: ${annual.remaining_days}/${annual.allowance_days}` : null,
          sick ? `Phép ốm còn: ${sick.remaining_days}/${sick.allowance_days}` : null
        ]
          .filter(Boolean)
          .join(" • ");
        setBalanceHint(hint || null);
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.screenHeader}>
        <button className={styles.backBtn} type="button" onClick={() => nav(-1)}>
          ‹
        </button>
        <div className={styles.screenHeaderTitle}>Xin nghỉ</div>
      </div>

      {sent ? <div className={styles.okToast}>✅ Đã gửi đơn</div> : null}
      {error ? <div className={styles.errToast}>⚠️ {error}</div> : null}

      <div className={styles.leaveForm}>
        {balanceHint ? <div className={styles.balanceHint}>ℹ️ {balanceHint}</div> : null}
        <label className={styles.formLabel}>Loại nghỉ</label>
        <div className={styles.leaveTypeGrid}>
          {types.map((t) => {
            const selected = type === t.key;
            return (
              <button
                key={t.key}
                type="button"
                className={selected ? `${styles.leaveTypeCard} ${styles.leaveTypeCardSelected}` : styles.leaveTypeCard}
                onClick={() => setType(t.key)}
              >
                <div className={styles.leaveTypeIcon}>{t.icon}</div>
                <div className={styles.leaveTypeName}>{t.label}</div>
                <div className={styles.leaveTypeDays}>{t.days}</div>
              </button>
            );
          })}
        </div>

        <label className={styles.formLabel}>Thời gian</label>
        <div className={styles.dateRow}>
          <input className={styles.formInput} value={from} type="date" onChange={(e) => setFrom(e.target.value)} />
          <input className={styles.formInput} value={to} type="date" onChange={(e) => setTo(e.target.value)} />
        </div>

        <label className={styles.formLabel}>Lý do nghỉ phép</label>
        <textarea className={styles.formTextarea} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Mô tả lý do nghỉ của bạn..." />

        <div className={styles.infoBox}>
          <span style={{ fontSize: 18 }}>ℹ️</span>
          <div>
            Đơn sẽ được gửi đến HR và quản lý trực tiếp của bạn. Thời gian phê duyệt tối đa <b>2 ngày làm việc</b>.
          </div>
        </div>

        <button
          type="button"
          className={styles.btnSubmit}
          disabled={busy}
          onClick={async () => {
            try {
              setBusy(true);
              setError(null);
              setSent(false);
              await createMyLeave({ type, start_date: from, end_date: to, reason: reason.trim() || null });
              setSent(true);
            } catch (e) {
              setError(getApiErrorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Đang gửi..." : "📤 Gửi đơn nghỉ phép"}
        </button>
      </div>
    </div>
  );
}
