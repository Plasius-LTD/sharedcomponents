import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import styles from "./ConfirmationDialog.module.css";

export type ConfirmationDialogTone = "default" | "danger";

type ConfirmationStep = "review" | "challenge";

export interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description?: string;
  summaryTitle?: string;
  summaryItems?: string[];
  challengeLabel?: string;
  challengeValue?: string;
  challengePlaceholder?: string;
  confirmLabel: string;
  confirmBusyLabel?: string;
  cancelLabel?: string;
  continueLabel?: string;
  busy?: boolean;
  tone?: ConfirmationDialogTone;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmationDialog({
  open,
  title,
  description,
  summaryTitle = "Summary",
  summaryItems = [],
  challengeLabel = "Type the confirmation value to continue",
  challengeValue,
  challengePlaceholder = "Type confirmation value",
  confirmLabel,
  confirmBusyLabel = "Submitting...",
  cancelLabel = "Cancel",
  continueLabel = "Continue",
  busy = false,
  tone = "default",
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  const [step, setStep] = useState<ConfirmationStep>("review");
  const [typedValue, setTypedValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const shouldChallenge = typeof challengeValue === "string" && challengeValue.length > 0;
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setStep("review");
    setTypedValue("");
    setSubmitting(false);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    cancelButtonRef.current?.focus();
  }, [open, step]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (submitting || busy) {
        return;
      }

      onCancel();
    };

    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [busy, onCancel, open, submitting]);

  const confirmDisabled = useMemo(() => {
    if (submitting || busy) {
      return true;
    }
    if (!shouldChallenge) {
      return false;
    }
    return typedValue !== challengeValue;
  }, [busy, challengeValue, shouldChallenge, submitting, typedValue]);

  const handleConfirm = useCallback(async () => {
    if (confirmDisabled) {
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  }, [confirmDisabled, onConfirm]);

  if (!open) {
    return null;
  }

  const isDanger = tone === "danger";

  return (
    <div className={styles.overlay}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>

        {description ? (
          <p id={descriptionId} className={styles.description}>
            {description}
          </p>
        ) : null}

        {step === "review" ? (
          <section className={styles.summary} aria-label={summaryTitle}>
            <h3 className={styles.summaryTitle}>{summaryTitle}</h3>
            {summaryItems.length > 0 ? (
              <ul className={styles.summaryList}>
                {summaryItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.summaryEmpty}>Review this action before continuing.</p>
            )}
          </section>
        ) : (
          <section className={styles.challenge} aria-label="Confirmation challenge">
            <label className={styles.challengeLabel}>
              {challengeLabel}
              <input
                className={styles.challengeInput}
                type="text"
                value={typedValue}
                onChange={(event) => setTypedValue(event.target.value)}
                placeholder={challengePlaceholder}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            {shouldChallenge ? (
              <p className={styles.challengeHint}>
                Enter exactly: <code>{challengeValue}</code>
              </p>
            ) : null}
          </section>
        )}

        <div className={styles.actions}>
          <button
            ref={cancelButtonRef}
            type="button"
            className={styles.button}
            onClick={onCancel}
            disabled={submitting || busy}
          >
            {cancelLabel}
          </button>

          {step === "review" && shouldChallenge ? (
            <button
              type="button"
              className={`${styles.button} ${styles.primaryButton}`}
              onClick={() => setStep("challenge")}
              disabled={submitting || busy}
            >
              {continueLabel}
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.button} ${isDanger ? styles.dangerButton : styles.primaryButton}`}
              onClick={() => {
                void handleConfirm();
              }}
              disabled={confirmDisabled}
            >
              {submitting || busy ? confirmBusyLabel : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConfirmationDialog;
