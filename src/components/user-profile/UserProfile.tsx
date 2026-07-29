import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useId,
  useMemo,
} from "react";
import { useI18n } from "@plasius/translations";
import { ContextMenu } from "../context-menu/index.js";
import type { SharedComponentsMetadataInput } from "../../metadata/white-label.js";
import { useOptionalSharedComponentsBrandingMetadata } from "../../metadata/provider.js";
import { trackSharedComponentsInteraction } from "../../analytics/tracker.js";
import {
  createSharedComponentTranslationResolver,
  sharedComponentTranslationKeys,
  type SharedComponentTranslationResolver,
} from "../../i18n.js";
import styles from "./UserProfile.module.css";

export interface UserProfileIdentity {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface UserProfileCommand {
  name: string;
  action: () => void;
  shortcut?: string;
}

export interface UserProfileProps {
  user?: UserProfileIdentity | null;
  metadata?: SharedComponentsMetadataInput;
  className?: string;
  providers?: string[];
  onLogin?: (provider: string) => void | Promise<void>;
  onLogout?: () => void | Promise<void>;
  onOpenSettings?: () => void | Promise<void>;
  signedInCommands?: UserProfileCommand[];
  signedOutCommands?: UserProfileCommand[];
}

function getInitials(
  first: unknown,
  last: unknown,
  translate: SharedComponentTranslationResolver
) {
  const f =
    typeof first === "string" && first.length > 0
      ? first.charAt(0)
      : translate(sharedComponentTranslationKeys.userProfile.fallbackFirstInitial);
  const l =
    typeof last === "string" && last.length > 0
      ? last.charAt(0)
      : translate(sharedComponentTranslationKeys.userProfile.fallbackLastInitial);
  return `${f}${l}`.toUpperCase();
}

function toProviderLabel(
  provider: string,
  translate: SharedComponentTranslationResolver
) {
  const normalized = provider.trim();
  if (!normalized) {
    return translate(sharedComponentTranslationKeys.userProfile.fallbackProvider);
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

export function UserProfile({
  user = null,
  metadata,
  className,
  providers = ["apple", "google", "microsoft"],
  onLogin,
  onLogout,
  onOpenSettings,
  signedInCommands,
  signedOutCommands,
}: UserProfileProps) {
  const { t } = useI18n();
  const generatedMenuId = useId();
  const translate = useMemo(() => createSharedComponentTranslationResolver(t), [t]);
  const avatarRef = useRef<HTMLButtonElement | null>(null);
  const menuId = `user-profile-menu-${generatedMenuId}`;
  const menuLabel = translate(
    sharedComponentTranslationKeys.userProfile.openMenu,
  );
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const resolvedMetadata = useOptionalSharedComponentsBrandingMetadata(metadata);

  const trackInteraction = useCallback(
    (
      action: string,
      details?: {
        label?: string;
        variant?: string;
        context?: Record<string, unknown>;
      }
    ) => {
      if (!resolvedMetadata) {
        return;
      }

      trackSharedComponentsInteraction(resolvedMetadata, {
        component: "UserProfile",
        action,
        label: details?.label,
        variant: details?.variant,
        context: details?.context,
      });
    },
    [resolvedMetadata]
  );

  useEffect(() => {
    if (!menuVisible || !avatarRef.current) {
      return;
    }
    const rect = avatarRef.current.getBoundingClientRect();
    setMenuPosition({ x: rect.left + rect.width, y: rect.top + rect.height + 4 });
  }, [menuVisible]);

  const defaultSignedInCommands = useMemo<UserProfileCommand[]>(
    () => [
      {
        name: translate(sharedComponentTranslationKeys.userProfile.settings),
        action: () => {
          void onOpenSettings?.();
        },
      },
      {
        name: translate(sharedComponentTranslationKeys.userProfile.logout),
        action: () => {
          void onLogout?.();
        },
      },
    ],
    [onLogout, onOpenSettings, translate]
  );

  const defaultSignedOutCommands = useMemo<UserProfileCommand[]>(
    () =>
      providers.map((provider) => ({
        name: translate(
          sharedComponentTranslationKeys.userProfile.signInWithProvider,
          {
            provider: toProviderLabel(provider, translate),
          }
        ),
        action: () => {
          void onLogin?.(provider);
        },
      })),
    [onLogin, providers, translate]
  );

  const commands = user
    ? signedInCommands ?? defaultSignedInCommands
    : signedOutCommands ?? defaultSignedOutCommands;

  const trackedCommands = useMemo(
    () =>
      commands.map((command) => ({
        ...command,
        action: () => {
          trackInteraction("menu_command", {
            label: command.name,
            context: {
              signedIn: !!user,
            },
          });
          command.action();
        },
      })),
    [commands, trackInteraction, user]
  );
  const closeMenuAndRestoreFocus = () => {
    setMenuVisible(false);
    avatarRef.current?.focus();
  };

  return (
    <div className={[styles.userProfileContainer, className].filter(Boolean).join(" ")}>
      <button
        ref={avatarRef}
        type="button"
        onClick={() =>
          setMenuVisible((visible: boolean) => {
            const nextVisible = !visible;
            trackInteraction("avatar_toggle", {
              variant: nextVisible ? "open" : "close",
            });
            return nextVisible;
          })
        }
        className={`${styles.userProfileAvatar} ${
          user?.avatarUrl ? styles.hasAvatar : styles.noAvatar
        }`}
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={menuVisible}
        aria-controls={menuId}
      >
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={translate(sharedComponentTranslationKeys.userProfile.avatarAlt)}
            className={styles.userProfileAvatarImage}
          />
        ) : (
          <span className={styles.userProfileInitials}>
            {getInitials(user?.firstName, user?.lastName, translate)}
          </span>
        )}
      </button>

      {menuVisible && menuPosition ? (
        <ContextMenu
          id={menuId}
          label={menuLabel}
          position={menuPosition}
          onClose={() => setMenuVisible(false)}
          onEscape={closeMenuAndRestoreFocus}
          commands={trackedCommands}
        />
      ) : null}
    </div>
  );
}

export default UserProfile;
