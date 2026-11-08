import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { ContextMenu } from "../context-menu/contextMenu.js";
import styles from "./PersistentWorkspace.module.css";

/** Host-owned localized labels; no application names or routes are embedded. */
export interface WorkspaceLabels {
  navigation: string; selection: string; options: string; viewport: string;
  expandNavigation: string; collapseNavigation: string; expandOptions: string; collapseOptions: string;
  closeContext: string; openItem: (label: string) => string;
}
export interface WorkspaceNavigationItem {
  id: string; label: string; icon?: ReactNode; href?: string; onSelect: () => void;
}
export interface WorkspaceOption { id: string; label: string; icon?: ReactNode; content: ReactNode }
export interface PersistentWorkspaceProps {
  active: string; title: string; description?: string; actions?: ReactNode; navigation?: ReactNode;
  items: readonly WorkspaceNavigationItem[]; options: readonly WorkspaceOption[]; labels: WorkspaceLabels;
  children: ReactNode; className?: string;
}

function Surface({ floating, visible, label, id, trigger, onDismiss, closeLabel, children, className, scrollArea }: {
  floating: boolean; visible: boolean; label: string; id: string; closeLabel: string;
  trigger: RefObject<HTMLButtonElement | null>; onDismiss: (restoreFocus?: boolean) => void;
  children: ReactNode; className?: string; scrollArea: string;
}) {
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!floating || !visible) return;
    const element = surface.current;
    element?.focus({ preventScroll: true });
    const outside = (event: Event) => {
      if (event.target instanceof Node && !element?.contains(event.target) && !trigger.current?.contains(event.target)) onDismiss();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); };
  }, [floating, visible, trigger, onDismiss, label]);
  return <div ref={surface} id={id} data-workspace-scroll={scrollArea} className={`${className ?? ""} ${floating ? styles.flyout : ""}`}
    hidden={!visible} role={floating ? "dialog" : "group"} aria-label={label} tabIndex={floating ? -1 : 0}
    onKeyDown={event => { if (floating && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onDismiss(true); } }}>
    {floating && <button type="button" className={styles.close} aria-label={closeLabel} onClick={() => onDismiss(true)}><span aria-hidden="true">×</span></button>}
    {children}
  </div>;
}

/** Independently collapsible panels preserve the centre and hidden form identity. */
export function PersistentWorkspace({ active, title, description, actions, navigation, items, options, labels, children, className }: PersistentWorkspaceProps) {
  const id = useId();
  const [panel, setPanel] = useState(options[0]?.id);
  const [compact, setCompact] = useState(() => globalThis.matchMedia?.("(max-width: 1100px)").matches ?? false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const [optionsCollapsed, setOptionsCollapsed] = useState(false);
  const [context, setContext] = useState<"navigation" | "options" | null>(null);
  const [menu, setMenu] = useState<{ key: string; x: number; y: number } | null>(null);
  const contextTrigger = useRef<HTMLButtonElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const navigationToggle = useRef<HTMLButtonElement>(null);
  const navigationDisclosure = useRef<HTMLButtonElement>(null);
  const optionsDisclosure = useRef<HTMLButtonElement>(null);
  const dismiss = useCallback((restoreFocus = false) => { setContext(null); if (restoreFocus) contextTrigger.current?.focus(); }, []);
  useEffect(() => {
    const media = globalThis.matchMedia?.("(max-width: 1100px)");
    if (!media) return;
    const change = () => { setCompact(media.matches); setContext(null); setMenu(null); };
    change(); media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => { setContext(null); setMenu(null); }, [active]);

  const navCollapsed = !compact && navigationCollapsed;
  const optsCollapsed = !compact && optionsCollapsed;
  const selected = options.some(option => option.id === panel) ? panel : options[0]?.id;
  const selectedLabel = options.find(option => option.id === selected)?.label ?? labels.options;
  const menuItem = items.find(item => item.id === menu?.key);
  const contextSide = compact ? undefined : menuItem || context === "navigation" ? "navigation" : context === "options" ? "options" : undefined;
  const icon = (value: ReactNode, fallback: string) => <span aria-hidden="true">{value ?? fallback}</span>;

  return <div className={`${styles.workspace} ${className ?? ""}`} data-persistent-workspace data-navigation-collapsed={navCollapsed}
    data-options-collapsed={optsCollapsed} data-has-options={options.length > 0} data-context-side={contextSide}>
    <nav className={styles.navigation} aria-label={labels.navigation} onKeyDown={event => {
      if (compact && navigationOpen && event.key === "Escape") { event.preventDefault(); setNavigationOpen(false); navigationDisclosure.current?.focus(); }
    }}>
      <button ref={navigationDisclosure} hidden={!compact} className={styles.disclosure} type="button" aria-label={labels.navigation} aria-expanded={navigationOpen}
        aria-controls={`${id}-navigation`} onClick={() => setNavigationOpen(value => !value)}>{labels.navigation}</button>
      <button ref={navigationToggle} hidden={compact} className={styles.collapse} type="button" aria-label={navCollapsed ? labels.expandNavigation : labels.collapseNavigation}
        title={navCollapsed ? labels.expandNavigation : labels.collapseNavigation} aria-expanded={!navCollapsed} aria-controls={`${id}-navigation`}
        onClick={() => { dismiss(); setMenu(null); setNavigationCollapsed(value => !value); }}>
        {icon(null, navCollapsed ? "›" : "‹")}{!navCollapsed && <span>{labels.navigation}</span>}
      </button>
      {navCollapsed && <div className={styles.iconRail}>
        {items.map(item => <button key={item.id} type="button" aria-label={item.label} title={item.label} aria-haspopup="menu"
          aria-expanded={menu?.key === item.id} aria-controls={menu?.key === item.id ? `${id}-menu` : undefined} data-current={active === item.id}
          onClick={event => { dismiss(); menuTrigger.current = event.currentTarget; const bounds = event.currentTarget.getBoundingClientRect(); setMenu({ key: item.id, x: bounds.right + 8, y: bounds.top }); }}>
          {icon(item.icon, item.label.slice(0, 1))}
        </button>)}
        {navigation && <button type="button" aria-label={labels.selection} title={labels.selection} aria-haspopup="dialog" aria-expanded={context === "navigation"}
          aria-controls={`${id}-navigation`} onClick={event => { contextTrigger.current = event.currentTarget; setMenu(null); setContext(value => value === "navigation" ? null : "navigation"); }}>{icon(null, "≡")}</button>}
      </div>}
      <Surface scrollArea="navigation" id={`${id}-navigation`} className={styles.navigationContent} floating={navCollapsed}
        visible={compact ? navigationOpen : !navCollapsed || context === "navigation"} label={navCollapsed ? labels.selection : labels.navigation}
        closeLabel={labels.closeContext} trigger={contextTrigger} onDismiss={dismiss}>
        <ul hidden={navCollapsed}>{items.map(item => <li key={item.id}>
          {item.href ? <a href={item.href} aria-current={active === item.id ? "page" : undefined} onClick={event => {
            if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); item.onSelect(); }
          }}>{icon(item.icon, "•")}<span>{item.label}</span></a>
            : <button type="button" aria-current={active === item.id ? "page" : undefined} onClick={item.onSelect}>{icon(item.icon, "•")}<span>{item.label}</span></button>}
        </li>)}</ul>
        {navigation && <div className={styles.selection}>{navigation}</div>}
      </Surface>
      {menu && menuItem && <ContextMenu id={`${id}-menu`} label={menuItem.label} position={menu} onClose={() => setMenu(null)}
        onEscape={() => { setMenu(null); menuTrigger.current?.focus(); }} commands={[
          { id: "open", name: labels.openItem(menuItem.label), action: menuItem.onSelect },
          { id: "expand", name: labels.expandNavigation, action: () => { setNavigationCollapsed(false); navigationToggle.current?.focus(); } },
        ]}/>}
    </nav>
    <div className={styles.scene} data-workspace-scroll="scene" tabIndex={0} role="region" aria-label={labels.viewport}>
      <div className={styles.heading} tabIndex={0} role="region" aria-labelledby={`${id}-title`}><div><h2 id={`${id}-title`}>{title}</h2>{description && <p>{description}</p>}</div>{actions}</div>
      <div className={styles.content} data-workspace-content>{children}</div>
    </div>
    {options.length > 0 && <aside className={styles.options} aria-label={labels.options} onKeyDown={event => {
      if (compact && optionsOpen && event.key === "Escape") { event.preventDefault(); setOptionsOpen(false); optionsDisclosure.current?.focus(); }
    }}>
      <button ref={optionsDisclosure} hidden={!compact} className={styles.disclosure} type="button" aria-label={labels.options} aria-expanded={optionsOpen}
        aria-controls={`${id}-options`} onClick={() => setOptionsOpen(value => !value)}>{labels.options}</button>
      <button hidden={compact} className={styles.collapse} type="button" aria-label={optsCollapsed ? labels.expandOptions : labels.collapseOptions}
        title={optsCollapsed ? labels.expandOptions : labels.collapseOptions} aria-expanded={!optsCollapsed} aria-controls={`${id}-options`}
        onClick={() => { dismiss(); setMenu(null); setOptionsCollapsed(value => !value); }}>
        {!optsCollapsed && <span>{labels.options}</span>}{icon(null, optsCollapsed ? "‹" : "›")}
      </button>
      <div id={`${id}-options`} className={styles.optionLayout} hidden={compact && !optionsOpen}>
        <Surface scrollArea="options" id={`${id}-panels`} className={styles.panels} floating={optsCollapsed}
          visible={!optsCollapsed || context === "options"} label={selectedLabel} closeLabel={labels.closeContext} trigger={contextTrigger} onDismiss={dismiss}>
          {options.map(option => <section key={option.id} id={`${id}-${option.id}`} aria-labelledby={`${id}-${option.id}-button`} hidden={selected !== option.id}>
            <h3>{option.label}</h3>{option.content}
          </section>)}
        </Surface>
        <div className={styles.rail} role="group" aria-label={labels.options}>{options.map(option => <button key={option.id} type="button"
          id={`${id}-${option.id}-button`} aria-label={option.label} title={option.label} aria-controls={`${id}-${option.id}`}
          aria-haspopup={optsCollapsed ? "dialog" : undefined} aria-expanded={selected === option.id && (!optsCollapsed || context === "options")}
          onClick={event => { contextTrigger.current = event.currentTarget; setPanel(option.id); setMenu(null); setContext(value => optsCollapsed && !(value === "options" && selected === option.id) ? "options" : null); }}>
          {icon(option.icon, option.label.slice(0, 1))}{!optsCollapsed && <span>{option.label}</span>}
        </button>)}</div>
      </div>
    </aside>}
  </div>;
}
