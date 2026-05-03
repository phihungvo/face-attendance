import { useState } from "react";
import styles from "./EmployeeCheckinPage.module.scss";
import { useNavigate } from "react-router-dom";

export default function EmployeeCheckinPage() {
  const nav = useNavigate();
  const [status, setStatus] = useState<"in" | "out">("in");

  return (
    <div className={styles.page}>
      <div className={styles.screenHeader}>
        <button className={styles.backBtn} type="button" onClick={() => nav(-1)}>
          ‹
        </button>
        <div className={styles.screenHeaderTitle}>Chấm công</div>
      </div>

      <div className={styles.content}>
        <div className={styles.statusRow}>
          <div className={`${styles.statusChip} ${status === "in" ? styles.in : styles.out}`}>{status === "in" ? "Đang làm việc" : "Đã ra ca"}</div>
          <button className={styles.ghost} type="button" onClick={() => setStatus((s) => (s === "in" ? "out" : "in"))}>
            Đổi trạng thái
          </button>
        </div>

        <div className={styles.camera}>
          <div className={styles.cameraInner}>📷 Camera preview (mock)</div>
        </div>

        <div className={styles.actions}>
          <button className={styles.primary} type="button">
            ✅ Vào ca
          </button>
          <button className={styles.danger} type="button">
            ⛔ Ra ca
          </button>
        </div>
      </div>
    </div>
  );
}
