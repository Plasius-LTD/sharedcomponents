import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import styles from "./contextMenu.module.css";
import { resolveMenuPosition } from "./positioning.js";

export interface ContextMenuCommand {
  name: string;
  shortcut?: string;
  action: () => void;
}

export interface ContextMenuProps {
  commands: ContextMenuCommand[];
  position: { x: number; y: number };
  onClose: () => void;
  id?: string;
}

export function ContextMenu({
  commands,
  position,
  onClose,
  id,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const viewportPadding = 12;

  const commandEntries = useMemo(() => commands, [commands]);

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

  return (
    <div className={styles.overlay}>
      <div
        id={id}
        className={styles.menu}
        ref={menuRef}
        role="menu"
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
      >
        {commandEntries.map((cmd: ContextMenuCommand, idx: number) => (
          <button
            key={idx}
            type="button"
            className={styles.menuItem}
            onClick={() => {
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
