import type { ReactNode } from "react";
import styles from "./StatCard.module.scss";

export default function StatCard({
  icon,
  label,
  value,
  delta,
  foot,
  variant
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  delta?: { label: string; tone?: "green" | "red" | "neutral" };
  foot?: string;
  variant?: "blue" | "green" | "orange" | "red" | "violet" | "slate";
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
            : variant === "violet"
              ? styles.violet
              : variant === "slate"
                ? styles.slate
                : undefined;

  const footClass =
    delta?.tone === "green"
      ? `${styles.foot} ${styles.up}`
      : delta?.tone === "red"
        ? `${styles.foot} ${styles.down}`
        : styles.foot;

  const footText = foot ?? delta?.label;

  return (
    <article className={variantClass ? `${styles.card} ${variantClass}` : styles.card}>
      <div className={styles.top}>
        <div className={styles.label}>{label}</div>
        <div className={styles.icon}>{icon}</div>
      </div>
      <div className={styles.value}>{value}</div>
      {footText ? <div className={footClass}>{footText}</div> : null}
    </article>
  );
}
