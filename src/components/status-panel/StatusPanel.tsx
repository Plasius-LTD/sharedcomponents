import { useId } from "react";
import styles from "./StatusPanel.module.css";

export type StatusPanelTone = "default" | "danger";
export type StatusPanelRole = "status" | "alert";
export type StatusPanelAnnounce = "off" | "polite" | "assertive";

export interface StatusPanelProps {
  title: string;
  description: string;
  meta?: string;
  tone?: StatusPanelTone;
  role?: StatusPanelRole;
  announce?: StatusPanelAnnounce;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  className?: string;
}

export function StatusPanel({
  title,
  description,
  meta,
  tone = "default",
  role = "status",
  announce = "off",
  actionLabel,
  onAction,
  actionDisabled = false,
  className,
}: StatusPanelProps) {
  const toneClass = tone === "danger" ? styles.danger : styles.default;
  const classes = [styles.panel, toneClass, className].filter(Boolean).join(" ");
  const ariaLive = announce === "off" ? undefined : announce;
  const showAction = typeof actionLabel === "string" && actionLabel.length > 0 && onAction;
  const titleId = useId();
  const descriptionId = useId();
  const metaId = meta ? useId() : undefined;
  const ariaDescribedBy = [descriptionId, metaId].filter(Boolean).join(" ") || undefined;

  return (
    <section
      className={classes}
      role={role}
      aria-live={ariaLive}
      aria-labelledby={titleId}
      aria-describedby={ariaDescribedBy}
    >
      <h2 id={titleId} className={styles.title}>{title}</h2>
      <p id={descriptionId} className={styles.description}>{description}</p>
      {meta ? <p id={metaId} className={styles.meta}>{meta}</p> : null}
      {showAction ? (
        <button
          type="button"
          className={styles.action}
          onClick={onAction}
          disabled={actionDisabled}
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

export default StatusPanel;
