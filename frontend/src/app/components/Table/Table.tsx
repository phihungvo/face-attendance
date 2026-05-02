import type { ReactNode } from "react";
import styles from "./Table.module.scss";

export default function Table({ children }: { children: ReactNode }) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>{children}</table>
    </div>
  );
}

