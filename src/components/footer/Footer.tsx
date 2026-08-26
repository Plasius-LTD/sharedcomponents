import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
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

/** A new, explicitly discriminated footer navigation link. */
export interface FooterLinkItem extends FooterNavItem {
  kind: "link";
  /** Stable caller-owned identity; the reserved feedback ID is never tracked. */
  id: string;
}

/** Stable host-owned identity for the feedback action. */
export const FOOTER_FEEDBACK_ACTION_ID = "feedback" as const;

/** A footer command which invokes host-owned behavior and never navigates. */
export interface FooterActionItem {
  kind: "action";
  /** Stable caller-owned identity. Footer actions emit no package telemetry. */
  id: string;
  /** Accessible action name, also shown in the mobile menu. */
  name: string;
  /** Decorative desktop icon. The accessible name comes from `name`. */
  icon: ReactNode;
  /** Prevents desktop and mobile invocation. */
  disabled?: boolean;
  /** Runs after an eligible pointer or mobile-menu selection. */
  onSelect: (event?: MouseEvent<HTMLButtonElement>) => void;
}

/** Discriminated item model for new footer integrations. */
export type FooterItem = FooterLinkItem | FooterActionItem;

export type FooterAppearance = "default" | "polishedMetal";

export interface FooterProps {
  /**
   * Ordered footer items. Legacy link objects remain accepted so existing
   * callers can migrate to the discriminated `FooterItem` API incrementally.
   */
  items: readonly (FooterItem | FooterNavItem)[];
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

function isFooterAction(
  item: FooterItem | FooterNavItem,
): item is FooterActionItem {
  return "kind" in item && item.kind === "action";
}

function isFooterFeedbackItem(item: { id: string }): boolean {
  return item.id === FOOTER_FEEDBACK_ACTION_ID;
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
  const [menuState, setMenuState] = useState<{
    position: { x: number; y: number };
    feedbackEnabledAtOpen: boolean;
  } | null>(null);
  const menuPosition = menuState?.position ?? null;
  const menuOpen = menuState !== null;

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

  const resolvedItems = useMemo(
    () =>
      items.map((item, index) =>
        isFooterAction(item)
          ? item
          : {
              ...item,
              kind: "link" as const,
              id:
                "id" in item && typeof item.id === "string"
                  ? item.id
                  : `legacy-link-${index}`,
              href: resolveHref(item),
              source: item,
            },
      ),
    [items]
  );
  const hasEnabledFeedbackItem = resolvedItems.some(
    (item) =>
      isFooterFeedbackItem(item) &&
      (item.kind !== "action" || !item.disabled),
  );
  const feedbackBecameEnabledWhileOpen =
    menuState !== null &&
    !menuState.feedbackEnabledAtOpen &&
    hasEnabledFeedbackItem;
  const footerClasses = [
    styles.footer,
    appearance === "polishedMetal" ? styles.polishedMetal : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const closeMenu = () => setMenuState(null);
  const closeMenuAndRestoreFocus = () => {
    setMenuState(null);
    menuToggleRef.current?.focus();
  };

  const toggleMobileMenu = () => {
    if (!menuToggleRef.current) {
      return;
    }
    const rect = menuToggleRef.current.getBoundingClientRect();
    setMenuState((previous) => {
      const feedbackEnabledForTransition =
        previous?.feedbackEnabledAtOpen ?? hasEnabledFeedbackItem;
      const next = previous
        ? null
        : {
            position: { x: rect.left, y: rect.top - 4 },
            feedbackEnabledAtOpen: hasEnabledFeedbackItem,
          };
      if (!feedbackEnabledForTransition) {
        trackInteraction("mobile_menu_toggle", {
          variant: next ? "open" : "close",
        });
      }
      return next;
    });
  };

  useEffect(() => {
    if (!feedbackBecameEnabledWhileOpen) {
      return;
    }

    setMenuState(null);
    menuToggleRef.current?.focus();
  }, [feedbackBecameEnabledWhileOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleResize = () => closeMenu();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenuAndRestoreFocus();
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
          {resolvedItems.map((item) =>
            item.kind === "action" ? (
              <button
                key={item.id}
                type="button"
                className={styles.footerActionButton}
                data-footer-item-kind="action"
                aria-label={item.name}
                title={item.name}
                disabled={item.disabled}
                onClick={(event) => {
                  item.onSelect(event);
                }}
              >
                <span className={styles.footerActionIcon} aria-hidden="true">
                  {item.icon}
                </span>
              </button>
            ) : (
              <a
                key={item.id}
                href={item.href}
                className={[
                  styles.footerButton,
                  activeHref === item.href
                    ? styles.activeFooterButton
                    : undefined,
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={activeHref === item.href ? "page" : undefined}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                data-footer-item-kind="link"
                onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                  if (!isFooterFeedbackItem(item)) {
                    trackInteraction("nav_click", {
                      label: item.name,
                      href: item.href,
                      variant: "desktop",
                      context: { external: !!item.external },
                    });
                  }
                  onNavigate?.(item.source, item.href, event);
                }}
              >
                {item.name}
              </a>
            ),
          )}
        </div>
      </div>

      <div className={styles.footerRight}>
        <button
          ref={menuToggleRef}
          type="button"
          className={styles.menuToggle}
          onMouseDown={(event) => {
            if (menuOpen) {
              event.stopPropagation();
            }
          }}
          onClick={toggleMobileMenu}
          aria-label={toggleFooterMenuLabel}
          aria-haspopup="menu"
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
            label={toggleFooterMenuLabel}
            position={menuPosition}
            onClose={closeMenu}
            onEscape={closeMenuAndRestoreFocus}
            commands={resolvedItems.map((item) => ({
              name: item.name,
              disabled:
                (isFooterFeedbackItem(item) &&
                  feedbackBecameEnabledWhileOpen) ||
                (item.kind === "action" ? item.disabled : false),
              action: () => {
                if (
                  isFooterFeedbackItem(item) &&
                  feedbackBecameEnabledWhileOpen
                ) {
                  return;
                }
                if (item.kind === "action") {
                  item.onSelect();
                  return;
                }
                if (!isFooterFeedbackItem(item)) {
                  trackInteraction("nav_click", {
                    label: item.name,
                    href: item.href,
                    variant: "mobile",
                    context: { external: !!item.external },
                  });
                }
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
