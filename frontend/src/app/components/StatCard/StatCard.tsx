import styles from "./StatCard.module.scss";

export default function StatCard({
  icon,
  label,
  value,
  delta
}: {
  icon: string;
  label: string;
  value: string | number;
  delta?: { label: string; tone?: "green" | "red" | "neutral" };
}) {
  return (
    <div className={styles.stat}>
      <div className={styles.icon}>{icon}</div>
      <div className={styles.main}>
        <div className={styles.label}>{label}</div>
        <div className={styles.value}>{value}</div>
      </div>
      {delta ? (
        <div
          className={
            delta.tone === "green" ? `${styles.delta} ${styles.green}` : delta.tone === "red" ? `${styles.delta} ${styles.red}` : styles.delta
          }
        >
          {delta.label}
        </div>
      ) : null}
    </div>
  );
}

