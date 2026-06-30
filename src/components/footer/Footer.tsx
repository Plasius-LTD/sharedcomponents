import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useI18n } from "@plasius/translations";
import { ContextMenu } from "../context-menu/index.js";
import type { SharedComponentsMetadataInput } from "../../metadata/white-label.js";
import { toFooterBranding } from "../../metadata/white-label.js";
import { useSharedComponentsBrandingMetadata } from "../../metadata/provider.js";
import { trackSharedComponentsInteraction } from "../../analytics/tracker.js";
import {
  createSharedComponentTranslationResolver,
  sharedComponentTranslationKeys,
} from "../../i18n.js";
import styles from "./Footer.module.css";

export interface FooterNavItem {
  name: string;
  url: string;
  folder?: string;
  external?: boolean;
}

export type FooterAppearance = "default" | "polishedMetal";

export interface FooterProps {
  items: FooterNavItem[];
  metadata?: SharedComponentsMetadataInput;
  companyName?: string;
  contactEmail?: string;
  appearance?: FooterAppearance;
  activeHref?: string;
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
  metadata,
  companyName,
  contactEmail,
  appearance = "default",
  activeHref,
  className,
  onNavigate,
}: FooterProps) {
  const { t } = useI18n();
  const translate = createSharedComponentTranslationResolver(t);
  const resolvedMetadata = useSharedComponentsBrandingMetadata("Footer", metadata);
  const branding = toFooterBranding(resolvedMetadata);
  const resolvedCompanyName = companyName ?? branding.companyName;
  const resolvedContactEmail = contactEmail ?? branding.contactEmail;
  const currentYear = new Date().getFullYear();
  const contactLabel = translate(sharedComponentTranslationKeys.footer.contactUs);
  const toggleFooterMenuLabel = translate(
    sharedComponentTranslationKeys.footer.toggleMenu
  );
  const rightsReservedText = translate(
    sharedComponentTranslationKeys.footer.rightsReserved,
    {
      year: currentYear,
      companyName: resolvedCompanyName,
    }
  );
  const menuToggleRef = useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const menuOpen = menuPosition !== null;

  const trackInteraction = (
    action: string,
    details?: {
      label?: string;
      href?: string;
      variant?: string;
      context?: Record<string, unknown>;
    }
  ) => {
    trackSharedComponentsInteraction(resolvedMetadata, {
      component: "Footer",
      action,
      label: details?.label,
      href: details?.href,
      variant: details?.variant,
      context: details?.context,
    });
  };

  const links = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        href: resolveHref(item),
      })),
    [items]
  );
  const footerClasses = [
    styles.footer,
    appearance === "polishedMetal" ? styles.polishedMetal : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const closeMenu = () => setMenuPosition(null);

  const toggleMobileMenu = () => {
    if (!menuToggleRef.current) {
      return;
    }
    const rect = menuToggleRef.current.getBoundingClientRect();
    setMenuPosition((previous: { x: number; y: number } | null) => {
      const next = previous ? null : { x: rect.left, y: rect.top - 4 };
      trackInteraction("mobile_menu_toggle", {
        variant: next ? "open" : "close",
      });
      return next;
    });
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
    <footer className={footerClasses}>
      <div className={styles.footerLeft}>
        <p className={styles.footerMeta}>{rightsReservedText}</p>
        <a
          href={`mailto:${resolvedContactEmail}`}
          className={styles.footerMetaLink}
          onClick={() =>
            trackInteraction("contact_click", {
              label: contactLabel,
              href: `mailto:${resolvedContactEmail}`,
              variant: "desktop",
            })
          }
        >
          {contactLabel}
        </a>
      </div>

      <div className={styles.footerCenter}>
        <div className={styles.footerItems}>
          {links.map((item: FooterNavItem & { href: string }, index: number) => (
            <a
              key={`${item.name}-${index}`}
              href={item.href}
              className={[
                styles.footerButton,
                activeHref === item.href ? styles.activeFooterButton : undefined,
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={activeHref === item.href ? "page" : undefined}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noopener noreferrer" : undefined}
              onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                trackInteraction("nav_click", {
                  label: item.name,
                  href: item.href,
                  variant: "desktop",
                  context: { external: !!item.external },
                });
                onNavigate?.(item, item.href, event);
              }}
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
          aria-label={toggleFooterMenuLabel}
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
                trackInteraction("nav_click", {
                  label: item.name,
                  href: item.href,
                  variant: "mobile",
                  context: { external: !!item.external },
                });
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
