import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./contextMenu.module.css";

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
  const [resolvedPosition, setResolvedPosition] = useState(position);

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

  useEffect(() => {
    const menu = menuRef.current;
    if (menu) {
      const { innerWidth, innerHeight } = window;
      const rect = menu.getBoundingClientRect();
      const overflowX = position.x + rect.width > innerWidth;
      const overflowY = position.y + rect.height > innerHeight;

      const newX = overflowX
        ? Math.max(position.x - rect.width, 0)
        : position.x;
      const newY = overflowY
        ? Math.max(position.y - rect.height, 0)
        : position.y;

      setResolvedPosition({ x: newX, y: newY });
    }
  }, [position]);

  useEffect(() => {
    setResolvedPosition(position);
  }, [position]);

  return (
    <div className={styles.overlay}>
      <div
        id={id}
        className={styles.menu}
        ref={menuRef}
        role="menu"
        style={{ left: `${resolvedPosition.x}px`, top: `${resolvedPosition.y}px` }}
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
