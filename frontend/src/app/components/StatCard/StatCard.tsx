import styles from "./StatCard.module.scss";

export default function StatCard({
  icon,
  label,
  value,
  delta,
  variant
}: {
  icon: string;
  label: string;
  value: string | number;
  delta?: { label: string; tone?: "green" | "red" | "neutral" };
  variant?: "blue" | "green" | "orange" | "red";
}) {
  const variantClass =
    variant === "blue"
      ? styles.blue
      : variant === "green"
        ? styles.green
        : variant === "orange"
          ? styles.orange
          : variant === "red"
            ? styles.red
            : undefined;

  const deltaClass =
    delta?.tone === "green"
      ? `${styles.change} ${styles.up}`
      : delta?.tone === "red"
        ? `${styles.change} ${styles.down}`
        : styles.change;

  return (
    <div className={variantClass ? `${styles.card} ${variantClass}` : styles.card}>
      <div className={variantClass ? `${styles.icon} ${variantClass}` : styles.icon}>{icon}</div>
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
      {delta ? <div className={deltaClass}>{delta.label}</div> : null}
    </div>
  );
}
