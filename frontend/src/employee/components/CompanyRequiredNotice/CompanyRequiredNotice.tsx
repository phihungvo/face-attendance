import { Link } from "react-router-dom";
import { TeamOutlined } from "@ant-design/icons";
import styles from "./CompanyRequiredNotice.module.scss";

type CompanyRequiredNoticeProps = {
  title?: string;
  message?: string;
};

export default function CompanyRequiredNotice({
  title = "Bạn chưa tham gia công ty nào",
  message = "Các dữ liệu chấm công, nghỉ phép, lịch làm và thông báo sẽ hiển thị sau khi tài khoản được gán vào công ty."
}: CompanyRequiredNoticeProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.panel}>
        <div className={styles.icon}>
          <TeamOutlined />
        </div>
        <div className={styles.title}>{title}</div>
        <div className={styles.message}>{message}</div>
        <Link className={styles.action} to="/employee">
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
