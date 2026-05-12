import type { CSSProperties, ReactNode } from "react";
import styles from "./Modal.module.scss";

export default function Modal({
  open,
  title,
  children,
  footer,
  onClose,
  modalClassName,
  modalStyle
}: {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose(): void;
  modalClassName?: string;
  modalStyle?: CSSProperties;
}) {
  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={[styles.modal, modalClassName].filter(Boolean).join(" ")} style={modalStyle}>
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>
          <button className={styles.close} type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  );
}
