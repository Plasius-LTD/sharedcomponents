import { createContext, useContext } from "react";

// Fixed event names admitted by the host's semantic journey catalogue.
// A marker carries no identifier, label, href, or runtime event payload.
const markers = {
  navigation: { "data-plasius-event": "ui.navigation.select" },
  activate: { "data-plasius-event": "ui.control.activate" },
  openMenu: { "data-plasius-event": "ui.menu.open" },
  closeMenu: { "data-plasius-event": "ui.menu.close" },
  closeDialog: { "data-plasius-event": "ui.dialog.close" },
  cancel: { "data-plasius-event": "ui.action.cancel" },
} as const;

export const SemanticInteractionMarkersContext = createContext(false);

export function useInteractionMarkers() {
  return useContext(SemanticInteractionMarkersContext) ? markers : undefined;
}
