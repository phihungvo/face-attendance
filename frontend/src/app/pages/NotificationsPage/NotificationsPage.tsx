import Card from "../../components/Card/Card";
import { mockNotifications } from "../../../shared/mock/mockData";
import styles from "./NotificationsPage.module.scss";

export default function NotificationsPage() {
  return (
    <div className={styles.page}>
      <Card
        title="🔔 Thông báo"
        sub="Mock data hiển thị UI theo template"
        right={
          <button className={styles.btnGhost} type="button">
            Đánh dấu đã đọc
          </button>
        }
      >
        <div className={styles.list}>
          {mockNotifications.items.map((n) => (
            <div key={n.id} className={n.unread ? `${styles.item} ${styles.unread}` : styles.item}>
              <div className={styles.icon}>{n.icon}</div>
              <div className={styles.main}>
                <div className={styles.title}>{n.title}</div>
                <div className={styles.sub}>
                  {n.sub} • {n.time}
                </div>
              </div>
              {n.unread ? <span className={styles.dot} /> : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

