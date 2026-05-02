import Card from "../../components/Card/Card";
import styles from "./PlaceholderPage.module.scss";

export default function PlaceholderPage({ title, sub }: { title: string; sub: string }) {
  return (
    <div className={styles.page}>
      <Card title={`🧩 ${title}`} sub={sub}>
        <div className={styles.text}>
          Trang này đang ở trạng thái <b>placeholder</b> để bạn có đủ menu + layout giống `index2.html`. Khi bạn muốn làm tiếp trang nào,
          mình sẽ map UI chi tiết theo template và nối API.
        </div>
      </Card>
    </div>
  );
}

