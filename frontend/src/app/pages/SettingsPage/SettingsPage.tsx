import { useState } from "react";
import Card from "../../components/Card/Card";
import { mockSettings } from "../../../shared/mock/mockData";
import styles from "./SettingsPage.module.scss";

export default function SettingsPage() {
  const [values, setValues] = useState(() => mockSettings.values);

  return (
    <div className={styles.page}>
      <div className={styles.grid2}>
        <Card title="⚙️ Cài đặt hệ thống" sub="Mock data – UI mẫu">
          <div className={styles.form}>
            <div className={styles.row}>
              <div className={styles.label}>Tên công ty</div>
              <input className={styles.input} value={values.company} onChange={(e) => setValues({ ...values, company: e.target.value })} />
            </div>
            <div className={styles.row}>
              <div className={styles.label}>Múi giờ</div>
              <select className={styles.input} value={values.timezone} onChange={(e) => setValues({ ...values, timezone: e.target.value })}>
                {mockSettings.timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.row}>
              <div className={styles.label}>Ngưỡng tin cậy</div>
              <input
                className={styles.input}
                type="number"
                step="0.01"
                value={values.confidence}
                onChange={(e) => setValues({ ...values, confidence: e.target.value })}
              />
            </div>
            <div className={styles.row}>
              <div className={styles.label}>Ghi log</div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={values.audit}
                  onChange={(e) => setValues({ ...values, audit: e.target.checked })}
                />
                <span className={styles.slider} />
              </label>
            </div>

            <div className={styles.actions}>
              <button className={styles.btnPrimary} type="button">
                Lưu
              </button>
              <button className={styles.btnGhost} type="button">
                Khôi phục
              </button>
            </div>
          </div>
        </Card>

        <Card title="🧪 Trạng thái dịch vụ" sub="Mock status">
          <div className={styles.statusList}>
            {mockSettings.services.map((s) => (
              <div key={s.name} className={styles.statusItem}>
                <div className={styles.statusName}>{s.name}</div>
                <div className={s.tone === "ok" ? `${styles.statusTag} ${styles.ok}` : `${styles.statusTag} ${styles.warn}`}>{s.status}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

