import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import styles from "./contextMenu.module.css";
import { resolveMenuPosition } from "./positioning.js";

export interface ContextMenuCommand {
  /** Stable command identity when names may repeat or change while open. */
  id?: string;
  name: string;
  shortcut?: string;
  disabled?: boolean;
  action: () => void;
}

export interface ContextMenuProps {
  commands: ContextMenuCommand[];
  position: { x: number; y: number };
  onClose: () => void;
  onEscape?: () => void;
  /** Direct accessible name for the menu. */
  label?: string;
  /** ID of an element which provides the menu's accessible name. */
  labelledBy?: string;
  id?: string;
}

interface ContextMenuCommandEntry {
  command: ContextMenuCommand;
  key: string;
}

function createCommandEntries(
  commands: readonly ContextMenuCommand[],
): ContextMenuCommandEntry[] {
  const occurrences = new Map<string, number>();
  return commands.map((command) => {
    const baseKey =
      command.id ?? `${command.name}\u0000${command.shortcut ?? ""}`;
    const occurrence = occurrences.get(baseKey) ?? 0;
    occurrences.set(baseKey, occurrence + 1);
    return {
      command,
      key: `${baseKey}\u0000${occurrence}`,
    };
  });
}

export function ContextMenu({
  commands,
  position,
  onClose,
  onEscape,
  label,
  labelledBy,
  id,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabCloseTimerRef = useRef<number | null>(null);
  const initialFocusAppliedRef = useRef(false);
  const menuOwnedFocusRef = useRef(false);
  const focusedIndexRef = useRef<number | null>(null);
  const viewportPadding = 12;

  const commandEntries = useMemo(
    () => createCommandEntries(commands),
    [commands],
  );
  const enabledIndexes = useMemo(
    () =>
      commandEntries.reduce<number[]>((indexes, entry, index) => {
        if (!entry.command.disabled) {
          indexes.push(index);
        }
        return indexes;
      }, []),
    [commandEntries],
  );
  const focusSignature = commandEntries
    .map((entry) => `${entry.key}:${entry.command.disabled ? "0" : "1"}`)
    .join("\u0001");

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }
    const firstEnabledIndex = enabledIndexes[0];
    if (!initialFocusAppliedRef.current) {
      initialFocusAppliedRef.current = true;
      menuOwnedFocusRef.current = true;
      focusedIndexRef.current = firstEnabledIndex ?? null;
      if (firstEnabledIndex === undefined) {
        menu.focus();
        return;
      }
      itemRefs.current[firstEnabledIndex]?.focus();
      return;
    }

    const activeIndex = itemRefs.current.findIndex(
      (item) => item === document.activeElement,
    );
    if (
      activeIndex >= 0 &&
      enabledIndexes.includes(activeIndex)
    ) {
      menuOwnedFocusRef.current = true;
      focusedIndexRef.current = activeIndex;
      return;
    }
    if (!menuOwnedFocusRef.current) {
      return;
    }

    const previousIndex = focusedIndexRef.current ?? 0;
    const fallbackIndex =
      enabledIndexes.find((index) => index >= previousIndex) ??
      enabledIndexes[enabledIndexes.length - 1];
    focusedIndexRef.current = fallbackIndex ?? null;
    if (fallbackIndex === undefined) {
      menu.focus();
      return;
    }
    itemRefs.current[fallbackIndex]?.focus();
    // A stable structural signature deliberately prevents new array
    // instances from resetting focus to the first command.
  }, [focusSignature]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  useEffect(
    () => () => {
      if (tabCloseTimerRef.current !== null) {
        window.clearTimeout(tabCloseTimerRef.current);
      }
    },
    [],
  );

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }

    const applyPosition = () => {
      const availableWidth = Math.max(0, window.innerWidth - viewportPadding * 2);
      const availableHeight = Math.max(0, window.innerHeight - viewportPadding * 2);

      menu.style.maxWidth = `${availableWidth}px`;
      menu.style.maxHeight = `${availableHeight}px`;

      const { x: newX, y: newY } = resolveMenuPosition({
        position,
        menuSize: {
          width: menu.offsetWidth,
          height: menu.offsetHeight,
        },
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        viewportPadding,
      });

      menu.style.left = `${newX}px`;
      menu.style.top = `${newY}px`;
    };

    applyPosition();

    window.addEventListener("resize", applyPosition);
    window.addEventListener("scroll", applyPosition, true);

    return () => {
      window.removeEventListener("resize", applyPosition);
      window.removeEventListener("scroll", applyPosition, true);
    };
  }, [commandEntries, position]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      if (tabCloseTimerRef.current !== null) {
        window.clearTimeout(tabCloseTimerRef.current);
      }
      tabCloseTimerRef.current = window.setTimeout(() => {
        tabCloseTimerRef.current = null;
        onClose();
      }, 0);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      (onEscape ?? onClose)();
      return;
    }
    if (
      !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) ||
      enabledIndexes.length === 0
    ) {
      return;
    }

    event.preventDefault();
    const currentIndex = itemRefs.current.findIndex(
      (item) => item === event.target,
    );
    const currentEnabledPosition = enabledIndexes.indexOf(currentIndex);
    let targetPosition = 0;
    if (event.key === "End") {
      targetPosition = enabledIndexes.length - 1;
    } else if (event.key === "ArrowDown") {
      targetPosition =
        currentEnabledPosition < 0
          ? 0
          : (currentEnabledPosition + 1) % enabledIndexes.length;
    } else if (event.key === "ArrowUp") {
      targetPosition =
        currentEnabledPosition < 0
          ? enabledIndexes.length - 1
          : (currentEnabledPosition - 1 + enabledIndexes.length) %
            enabledIndexes.length;
    }
    const targetIndex = enabledIndexes[targetPosition];
    if (targetIndex !== undefined) {
      itemRefs.current[targetIndex]?.focus();
    }
  };

  return (
    <div className={styles.overlay}>
      <div
        id={id}
        className={styles.menu}
        ref={menuRef}
        role="menu"
        aria-orientation="vertical"
        aria-label={label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onFocusCapture={(event) => {
          menuOwnedFocusRef.current = true;
          const focusedTarget: EventTarget = event.target;
          focusedIndexRef.current =
            focusedTarget instanceof HTMLButtonElement
              ? itemRefs.current.findIndex((item) => item === focusedTarget)
              : -1;
          if (focusedIndexRef.current < 0) {
            focusedIndexRef.current = null;
          }
        }}
        onBlurCapture={(event) => {
          if (
            event.relatedTarget instanceof Node &&
            menuRef.current?.contains(event.relatedTarget)
          ) {
            return;
          }
          if (event.relatedTarget !== null) {
            menuOwnedFocusRef.current = false;
            focusedIndexRef.current = null;
          }
        }}
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
      >
        {commandEntries.map(({ command: cmd, key }, idx) => (
          <button
            key={key}
            ref={(node) => {
              itemRefs.current[idx] = node;
            }}
            type="button"
            className={styles.menuItem}
            disabled={cmd.disabled}
            tabIndex={-1}
            onClick={() => {
              if (cmd.disabled) {
                return;
              }
              cmd.action();
              onClose();
            }}
            role="menuitem"
          >
            <span className={styles.menuText}>{cmd.name}</span>
            {cmd.shortcut && (
              <span className={styles.shortcut}>{cmd.shortcut}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ContextMenu;
