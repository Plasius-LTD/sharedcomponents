import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import styles from "./ReviewSheet.module.css";

const phoneSheetMediaQuery = "(max-width: 40rem)";
const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** The interaction which requested that a controlled sheet close. */
export type ReviewSheetCloseReason = "close-button" | "escape" | "outside";

export interface ReviewSheetProps {
  /** Whether the controlled review surface is open. */
  open: boolean;
  /** Visible and accessible dialog title. */
  title: ReactNode;
  /** Optional supporting description associated with the dialog. */
  description?: ReactNode;
  /** Caller-owned review content. */
  children?: ReactNode;
  /** Optional caller-owned action area pinned below scrollable content. */
  footer?: ReactNode;
  /** Accessible name for the close button. */
  closeLabel: string;
  /** Receives a close request and its interaction reason. */
  onClose: (reason: ReviewSheetCloseReason) => void;
  /** Prevents dismiss interactions while a caller-owned commit is pending. */
  busy?: boolean;
  /** Allows Escape to request close. */
  dismissOnEscape?: boolean;
  /** Allows pointer input outside the side sheet to request close. */
  dismissOnOutside?: boolean;
  /** Optional caller-selected initial focus target inside the sheet. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Optional focus target used after close instead of the opener. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Optional stable dialog id. */
  id?: string;
  /** Optional class applied to the sheet surface. */
  className?: string;
}

function usePhoneSheet(): boolean {
  const [isPhoneSheet, setIsPhoneSheet] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(phoneSheetMediaQuery).matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(phoneSheetMediaQuery);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsPhoneSheet(event.matches);
    };

    setIsPhoneSheet(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return isPhoneSheet;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
}

export function ReviewSheet({
  open,
  title,
  description,
  children,
  footer,
  closeLabel,
  onClose,
  busy = false,
  dismissOnEscape = true,
  dismissOnOutside = true,
  initialFocusRef,
  returnFocusRef,
  id,
  className,
}: ReviewSheetProps) {
  const generatedId = useId();
  const dialogId = id ?? `review-sheet-${generatedId}`;
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;
  const sheetRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const restoreFocusAfterCloseRef = useRef(false);
  const wasOpenRef = useRef(false);
  const isPhoneSheet = usePhoneSheet();

  const requestClose = useCallback(
    (reason: ReviewSheetCloseReason, restoreFocus: boolean) => {
      if (busy) {
        return;
      }
      restoreFocusAfterCloseRef.current = restoreFocus;
      onClose(reason);
    },
    [busy, onClose],
  );

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      previouslyFocusedRef.current =
        returnFocusRef?.current ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null);
      restoreFocusAfterCloseRef.current = false;
      wasOpenRef.current = true;

      const closeButton =
        closeButtonRef.current && !closeButtonRef.current.disabled
          ? closeButtonRef.current
          : null;
      const initialFocus =
        initialFocusRef?.current ??
        closeButton ??
        (sheetRef.current
          ? getFocusableElements(sheetRef.current)[0] ?? sheetRef.current
          : null);
      initialFocus?.focus();
      return;
    }

    if (!open && wasOpenRef.current) {
      wasOpenRef.current = false;
      if (restoreFocusAfterCloseRef.current) {
        previouslyFocusedRef.current?.focus();
      }
      restoreFocusAfterCloseRef.current = false;
    }
  }, [initialFocusRef, open, returnFocusRef]);

  useEffect(() => {
    if (!open || !isPhoneSheet) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isPhoneSheet, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        !dismissOnEscape ||
        busy
      ) {
        return;
      }

      event.preventDefault();
      requestClose("escape", true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [busy, dismissOnEscape, open, requestClose]);

  useEffect(() => {
    if (!open || !dismissOnOutside || busy) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const sheet = sheetRef.current;
      if (!sheet || sheet.contains(event.target as Node)) {
        return;
      }

      if (isPhoneSheet) {
        event.preventDefault();
      }
      requestClose("outside", false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [busy, dismissOnOutside, isPhoneSheet, open, requestClose]);

  const handleDialogKeyDown = (
    event: ReactKeyboardEvent<HTMLElement>,
  ) => {
    if (!isPhoneSheet || event.key !== "Tab") {
      return;
    }

    const sheet = sheetRef.current;
    if (!sheet) {
      return;
    }

    const focusableElements = getFocusableElements(sheet);
    if (focusableElements.length === 0) {
      event.preventDefault();
      sheet.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === firstElement ||
        document.activeElement === sheet)
    ) {
      event.preventDefault();
      lastElement?.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement?.focus();
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      data-presentation={isPhoneSheet ? "phone" : "side"}
    >
      <section
        ref={sheetRef}
        id={dialogId}
        className={`${styles.sheet} ${className ?? ""}`}
        role="dialog"
        aria-modal={isPhoneSheet ? true : undefined}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        data-presentation={isPhoneSheet ? "phone" : "side"}
        onKeyDown={handleDialogKeyDown}
      >
        <header className={styles.header}>
          <div className={styles.heading}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {description ? (
              <div id={descriptionId} className={styles.description}>
                {description}
              </div>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            disabled={busy}
            onClick={() => requestClose("close-button", true)}
          >
            <span aria-hidden="true">×</span>
            <span className={styles.visuallyHidden}>{closeLabel}</span>
          </button>
        </header>

        <div className={styles.content}>{children}</div>

        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </section>
    </div>
  );
}

export default ReviewSheet;
