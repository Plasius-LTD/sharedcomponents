import { createContext, useContext, type ReactNode } from "react";
import { SemanticInteractionMarkersContext } from "../analytics/interaction-markers.js";
import {
  resolveSharedComponentsMetadata,
  type SharedComponentsMetadata,
  type SharedComponentsMetadataInput,
} from "./white-label.js";

const BrandingMetadataContext = createContext<SharedComponentsMetadata | null>(null);

export interface SharedComponentsBrandingProviderProps {
  metadata: SharedComponentsMetadataInput;
  children: ReactNode;
  /** Opt in to passive catalogue markers using the host rollout and consent decision. */
  semanticInteractionMarkers?: boolean;
}

export function SharedComponentsBrandingProvider({
  metadata,
  children,
  semanticInteractionMarkers,
}: SharedComponentsBrandingProviderProps) {
  const inheritedMarkers = useContext(SemanticInteractionMarkersContext);
  const resolvedMetadata = resolveSharedComponentsMetadata(metadata);

  return (
    <BrandingMetadataContext.Provider value={resolvedMetadata}>
      <SemanticInteractionMarkersContext.Provider
        value={semanticInteractionMarkers === undefined ? inheritedMarkers : semanticInteractionMarkers === true}
      >
        {children}
      </SemanticInteractionMarkersContext.Provider>
    </BrandingMetadataContext.Provider>
  );
}

export function useOptionalSharedComponentsBrandingMetadata(
  metadata?: SharedComponentsMetadataInput
): SharedComponentsMetadata | null {
  const contextValue = useContext(BrandingMetadataContext);

  if (contextValue && metadata) {
    return resolveSharedComponentsMetadata({
      ...contextValue,
      ...metadata,
      contactAddressLines: metadata.contactAddressLines ?? contextValue.contactAddressLines,
      analytics: {
        ...contextValue.analytics,
        ...(metadata.analytics ?? {}),
        headers: {
          ...(contextValue.analytics.headers ?? {}),
          ...(metadata.analytics?.headers ?? {}),
        },
        context: {
          ...(contextValue.analytics.context ?? {}),
          ...(metadata.analytics?.context ?? {}),
        },
      },
    });
  }

  if (metadata) {
    return resolveSharedComponentsMetadata(metadata);
  }

  if (contextValue) {
    return contextValue;
  }

  return null;
}

export function useSharedComponentsBrandingMetadata(
  componentName: string,
  metadata?: SharedComponentsMetadataInput
): SharedComponentsMetadata {
  const resolved = useOptionalSharedComponentsBrandingMetadata(metadata);

  if (resolved) {
    return resolved;
  }

  throw new Error(
    `${componentName} requires branding metadata. Provide the "metadata" prop ` +
      "or wrap your UI tree with <SharedComponentsBrandingProvider metadata={...}>."
  );
}
