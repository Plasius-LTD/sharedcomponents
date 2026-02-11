import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { ContextMenu } from "../context-menu/index.js";
import styles from "./Header.module.css";

export interface HeaderNavItem {
  name: string;
  url: string;
  folder?: string;
  external?: boolean;
}

export interface HeaderProps {
  items: HeaderNavItem[];
  brand?: ReactNode;
  homeHref?: string;
  profileSlot?: ReactNode;
  className?: string;
  onNavigate?: (
    item: HeaderNavItem,
    href: string,
    event: MouseEvent<HTMLAnchorElement>
  ) => void;
}

function resolveHref(item: HeaderNavItem): string {
  if (item.folder) {
    return `/${item.folder}/${item.url}`;
  }
  return item.url;
}

export function Header({
  items,
  brand,
  homeHref = "/",
  profileSlot,
  className,
  onNavigate,
}: HeaderProps) {
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(
    null
  );

  const links = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        href: resolveHref(item),
      })),
    [items]
  );

  const menuOpen = menuPosition !== null;

  const closeMenu = () => setMenuPosition(null);

  const toggleMobileMenu = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuPosition((previous: { x: number; y: number } | null) =>
      previous ? null : { x: rect.left, y: rect.bottom + 4 }
    );
  };

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleResize = () => closeMenu();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("resize", handleResize);
    document.addEventListener("fullscreenchange", handleResize);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("fullscreenchange", handleResize);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  return (
    <header className={[styles.header, className].filter(Boolean).join(" ")}>
      <nav className={styles.headerBar} aria-label="Primary navigation">
        <a href={homeHref} className={styles.brandLink} aria-label="Home">
          {brand ?? <span className={styles.brandText}>Plasius</span>}
        </a>

        <div className={styles.headerItems}>
          {links.map((item: HeaderNavItem & { href: string }, index: number) => (
            <a
              key={`${item.name}-${index}`}
              href={item.href}
              className={styles.headerButton}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noopener noreferrer" : undefined}
              onClick={(event: MouseEvent<HTMLAnchorElement>) =>
                onNavigate?.(item, item.href, event)
              }
            >
              {item.name}
            </a>
          ))}
        </div>

        <div className={styles.rightRail}>
          {profileSlot}
          <button
            type="button"
            className={styles.mobileMenuToggle}
            onClick={toggleMobileMenu}
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            aria-controls="header-mobile-menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {menuPosition ? (
          <ContextMenu
            commands={links.map((item: HeaderNavItem & { href: string }) => ({
              name: item.name,
              action: () => {
                if (item.external) {
                  window.open(item.href, "_blank", "noopener,noreferrer");
                  return;
                }
                window.location.href = item.href;
              },
            }))}
            position={menuPosition}
            onClose={closeMenu}
            id="header-mobile-menu"
          />
        ) : null}
      </nav>
    </header>
  );
}

export default Header;
