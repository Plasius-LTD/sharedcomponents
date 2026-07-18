import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import styles from "./ActionMenu.module.css";

const phoneSheetMediaQuery = "(max-width: 40rem)";
const viewportPadding = 12;
const anchorGap = 8;

/** Visual emphasis available to an action item. */
export type ActionMenuTone = "default" | "danger";
/** Popover alignment relative to the trigger. */
export type ActionMenuAlign = "start" | "end";

export interface ActionMenuItem {
  /** Stable key for this action. */
  id: string;
  /** Visible action text. */
  label: string;
  /** Optional supporting text rendered below the label. */
  description?: string;
  /** Prevents pointer and keyboard activation. */
  disabled?: boolean;
  /** Applies non-authoritative visual emphasis only. */
  tone?: ActionMenuTone;
  /** Runs after the caller selects the action. */
  onSelect: () => void;
}

export interface ActionMenuProps {
  /** Whether the controlled menu surface is open. */
  open: boolean;
  /** Accessible name for the menu surface. */
  label: string;
  /** Accessible name for the trigger button. */
  triggerLabel: string;
  /** Visual trigger content, such as an overflow icon. */
  trigger: ReactNode;
  /** Ordered actions shown in the menu. */
  items: readonly ActionMenuItem[];
  /** Receives requested controlled-state changes. */
  onOpenChange: (open: boolean) => void;
  /** Horizontal alignment relative to the trigger in popover mode. */
  align?: ActionMenuAlign;
  /** Disables the trigger without changing controlled state. */
  disabled?: boolean;
  /** Optional stable menu id for host relationships and tests. */
  id?: string;
  /** Optional class applied to the inline trigger wrapper. */
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function ActionMenu({
  open,
  label,
  triggerLabel,
  trigger,
  items,
  onOpenChange,
  align = "end",
  disabled = false,
  id,
  className,
}: ActionMenuProps) {
  const generatedId = useId();
  const menuId = id ?? `action-menu-${generatedId}`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const focusLastOnOpenRef = useRef(false);
  const isPhoneSheet = usePhoneSheet();

  const enabledIndexes = useMemo(
    () =>
      items.reduce<number[]>((indexes, item, index) => {
        if (!item.disabled) {
          indexes.push(index);
        }
        return indexes;
      }, []),
    [items],
  );

  const restoreTriggerFocus = useCallback(() => {
    triggerRef.current?.focus();
  }, []);

  const requestClose = useCallback(
    (restoreFocus: boolean) => {
      onOpenChange(false);
      if (restoreFocus) {
        restoreTriggerFocus();
      }
    },
    [onOpenChange, restoreTriggerFocus],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    if (menuRef.current?.contains(document.activeElement)) {
      return;
    }

    const targetIndex = focusLastOnOpenRef.current
      ? enabledIndexes[enabledIndexes.length - 1]
      : enabledIndexes[0];
    focusLastOnOpenRef.current = false;

    if (targetIndex === undefined) {
      menuRef.current?.focus();
      return;
    }

    itemRefs.current[targetIndex]?.focus();
  }, [enabledIndexes, open]);

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

  useLayoutEffect(() => {
    if (!open || isPhoneSheet) {
      return;
    }

    const triggerElement = triggerRef.current;
    const menuElement = menuRef.current;
    if (!triggerElement || !menuElement) {
      return;
    }

    const applyPosition = () => {
      const triggerRect = triggerElement.getBoundingClientRect();
      const menuWidth = menuElement.offsetWidth;
      const menuHeight = menuElement.offsetHeight;
      const maximumX = Math.max(
        viewportPadding,
        window.innerWidth - menuWidth - viewportPadding,
      );
      const maximumY = Math.max(
        viewportPadding,
        window.innerHeight - menuHeight - viewportPadding,
      );
      const preferredX =
        align === "start" ? triggerRect.left : triggerRect.right - menuWidth;
      const belowY = triggerRect.bottom + anchorGap;
      const preferredY =
        belowY + menuHeight + viewportPadding <= window.innerHeight
          ? belowY
          : triggerRect.top - menuHeight - anchorGap;

      menuElement.style.left = `${clamp(
        preferredX,
        viewportPadding,
        maximumX,
      )}px`;
      menuElement.style.top = `${clamp(
        preferredY,
        viewportPadding,
        maximumY,
      )}px`;
    };

    applyPosition();
    window.addEventListener("resize", applyPosition);
    window.addEventListener("scroll", applyPosition, true);

    return () => {
      window.removeEventListener("resize", applyPosition);
      window.removeEventListener("scroll", applyPosition, true);
    };
  }, [align, isPhoneSheet, items, open]);

  const focusEnabledItem = useCallback(
    (currentIndex: number, direction: 1 | -1) => {
      if (enabledIndexes.length === 0) {
        return;
      }

      const enabledPosition = enabledIndexes.indexOf(currentIndex);
      const nextPosition =
        enabledPosition < 0
          ? direction === 1
            ? 0
            : enabledIndexes.length - 1
          : (enabledPosition + direction + enabledIndexes.length) %
            enabledIndexes.length;
      const nextIndex = enabledIndexes[nextPosition];
      itemRefs.current[nextIndex]?.focus();
    },
    [enabledIndexes],
  );

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const currentIndex = itemRefs.current.findIndex(
      (element) => element === document.activeElement,
    );

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusEnabledItem(currentIndex, 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusEnabledItem(currentIndex, -1);
        break;
      case "Home": {
        event.preventDefault();
        const firstIndex = enabledIndexes[0];
        if (firstIndex !== undefined) {
          itemRefs.current[firstIndex]?.focus();
        }
        break;
      }
      case "End": {
        event.preventDefault();
        const lastIndex = enabledIndexes[enabledIndexes.length - 1];
        if (lastIndex !== undefined) {
          itemRefs.current[lastIndex]?.focus();
        }
        break;
      }
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        requestClose(true);
        break;
      case "Tab":
        requestClose(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className={`${styles.root} ${className ?? ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => {
          onOpenChange(!open);
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
            return;
          }
          event.preventDefault();
          focusLastOnOpenRef.current = event.key === "ArrowUp";
          onOpenChange(true);
        }}
      >
        {trigger}
      </button>

      {open ? (
        <div
          className={styles.overlay}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              event.preventDefault();
              requestClose(true);
            }
          }}
        >
          <div
            ref={menuRef}
            id={menuId}
            className={styles.menu}
            role="menu"
            aria-label={label}
            tabIndex={-1}
            data-presentation={isPhoneSheet ? "sheet" : "popover"}
            onKeyDown={handleMenuKeyDown}
          >
            {items.map((item, index) => (
              <button
                key={item.id}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                type="button"
                role="menuitem"
                className={`${styles.menuItem} ${
                  item.tone === "danger" ? styles.dangerItem : ""
                }`}
                disabled={item.disabled}
                onClick={() => {
                  try {
                    item.onSelect();
                  } finally {
                    requestClose(true);
                  }
                }}
              >
                <span className={styles.itemLabel}>{item.label}</span>
                {item.description ? (
                  <span className={styles.itemDescription}>
                    {item.description}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ActionMenu;
