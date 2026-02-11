import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { ContextMenu } from "../context-menu/index.js";
import styles from "./Footer.module.css";

export interface FooterNavItem {
  name: string;
  url: string;
  folder?: string;
  external?: boolean;
}

export interface FooterProps {
  items: FooterNavItem[];
  companyName?: string;
  contactEmail?: string;
  className?: string;
  onNavigate?: (
    item: FooterNavItem,
    href: string,
    event: MouseEvent<HTMLAnchorElement>
  ) => void;
}

function resolveHref(item: FooterNavItem): string {
  if (item.folder) {
    return `/${item.folder}/${item.url}`;
  }
  return item.url;
}

export function Footer({
  items,
  companyName = "Plasius LTD",
  contactEmail = "web@plasius.co.uk",
  className,
  onNavigate,
}: FooterProps) {
  const menuToggleRef = useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const menuOpen = menuPosition !== null;

  const links = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        href: resolveHref(item),
      })),
    [items]
  );

  const closeMenu = () => setMenuPosition(null);

  const toggleMobileMenu = () => {
    if (!menuToggleRef.current) {
      return;
    }
    const rect = menuToggleRef.current.getBoundingClientRect();
    setMenuPosition((previous: { x: number; y: number } | null) =>
      previous ? null : { x: rect.left, y: rect.top - 4 }
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
    <footer className={[styles.footer, className].filter(Boolean).join(" ")}>
      <div className={styles.footerLeft}>
        <p className={styles.footerMeta}>
          &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
        </p>
        <a href={`mailto:${contactEmail}`} className={styles.footerMetaLink}>
          Contact us
        </a>
      </div>

      <div className={styles.footerCenter}>
        <div className={styles.footerItems}>
          {links.map((item: FooterNavItem & { href: string }, index: number) => (
            <a
              key={`${item.name}-${index}`}
              href={item.href}
              className={styles.footerButton}
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
      </div>

      <div className={styles.footerRight}>
        <button
          ref={menuToggleRef}
          type="button"
          className={styles.menuToggle}
          onClick={toggleMobileMenu}
          aria-label="Toggle footer menu"
          aria-expanded={menuOpen}
          aria-controls="footer-mobile-menu"
        >
          <span />
          <span />
          <span />
        </button>

        {menuPosition ? (
          <ContextMenu
            id="footer-mobile-menu"
            position={menuPosition}
            onClose={closeMenu}
            commands={links.map((item: FooterNavItem & { href: string }) => ({
              name: item.name,
              action: () => {
                if (item.external) {
                  window.open(item.href, "_blank", "noopener,noreferrer");
                  return;
                }
                window.location.href = item.href;
              },
            }))}
          />
        ) : null}
      </div>
    </footer>
  );
}

export default Footer;
