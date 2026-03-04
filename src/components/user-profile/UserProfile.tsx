import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { ContextMenu } from "../context-menu/index.js";
import type { SharedComponentsMetadataInput } from "../../metadata/white-label.js";
import { useOptionalSharedComponentsBrandingMetadata } from "../../metadata/provider.js";
import { trackSharedComponentsInteraction } from "../../analytics/tracker.js";
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

function getInitials(first: unknown, last: unknown) {
  const f =
    typeof first === "string" && first.length > 0 ? first.charAt(0) : "U";
  const l = typeof last === "string" && last.length > 0 ? last.charAt(0) : "P";
  return `${f}${l}`.toUpperCase();
}

function toProviderLabel(provider: string) {
  const normalized = provider.trim();
  if (!normalized) {
    return "Provider";
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
  const avatarRef = useRef<HTMLButtonElement | null>(null);
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

  const defaultSignedInCommands: UserProfileCommand[] = [
    {
      name: "Settings",
      action: () => {
        void onOpenSettings?.();
      },
    },
    {
      name: "Logout",
      action: () => {
        void onLogout?.();
      },
    },
  ];

  const defaultSignedOutCommands: UserProfileCommand[] = providers.map((provider) => ({
    name: `Sign in with ${toProviderLabel(provider)}`,
    action: () => {
      void onLogin?.(provider);
    },
  }));

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
        aria-label="Open user menu"
        aria-expanded={menuVisible}
      >
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="Avatar" className={styles.userProfileAvatarImage} />
        ) : (
          <span className={styles.userProfileInitials}>
            {getInitials(user?.firstName, user?.lastName)}
          </span>
        )}
      </button>

      {menuVisible && menuPosition ? (
        <ContextMenu
          position={menuPosition}
          onClose={() => setMenuVisible(false)}
          commands={trackedCommands}
        />
      ) : null}
    </div>
  );
}

export default UserProfile;
