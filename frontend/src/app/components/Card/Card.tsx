import type { ReactNode } from "react";
import styles from "./Card.module.scss";

export default function Card({
  title,
  sub,
  right,
  children
}: {
  title?: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.card}>
      {title || sub || right ? (
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {title ? <div className={styles.title}>{title}</div> : null}
            {sub ? <div className={styles.sub}>{sub}</div> : null}
          </div>
          {right ? <div className={styles.headerRight}>{right}</div> : null}
        </div>
      ) : null}
      <div className={styles.body}>{children}</div>
    </div>
  );
}

