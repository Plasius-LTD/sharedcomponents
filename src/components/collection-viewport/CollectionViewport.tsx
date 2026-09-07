import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import styles from "./CollectionViewport.module.css";

/** Host-localized messages for the collection's controls and live status. */
export interface CollectionViewportLabels {
  refresh: string;
  loadMore: string;
  loading: string;
  refreshing: string;
  pull: string;
  release: string;
  end: string;
  failed: string;
  refreshBlocked: string;
}

export interface CollectionViewportProps {
  children: ReactNode;
  /** Accessible name of the keyboard-scrollable region. */
  label: string;
  labels: CollectionViewportLabels;
  hasMore?: boolean;
  /** Append a batch; hosts own cursor, deduplication and stale-response checks. */
  onLoadMore?: (signal: AbortSignal) => void | Promise<unknown>;
  /** Refresh reads only. Hosts preserve existing data if the read fails. */
  onRefresh?: (signal: AbortSignal) => void | Promise<unknown>;
  loading?: boolean;
  disabled?: boolean;
  /** Prevent refresh while it could discard an unsaved host-owned draft. */
  refreshDisabled?: boolean;
  /** Changes reset the viewport and abort operations from the old query. */
  resetKey?: string;
  className?: string;
}

type Operation = "more" | "refresh";
type Gesture = { x: number; y: number; top: boolean; distance: number; used: boolean };
const pullThreshold = 72;
const endThreshold = 24;

/** Ignore nested scroll containers and editing controls without changing native input behavior. */
function ownsGesture(target: EventTarget | null, root: HTMLElement): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('input, textarea, select, [contenteditable="true"], [role="slider"]')) return false;
  for (let element = target; element !== root; element = element.parentElement!) {
    if (!element || !root.contains(element)) return false;
    if (element instanceof HTMLElement && element.scrollHeight > element.clientHeight
      && /auto|scroll/.test(window.getComputedStyle(element).overflowY)) return false;
  }
  return true;
}

/** A native scroll region with user-driven append and top-edge pull refresh. */
export function CollectionViewport({
  children, label, labels, hasMore = false, onLoadMore, onRefresh,
  loading = false, disabled = false, refreshDisabled = false, resetKey = "", className,
}: CollectionViewportProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<AbortController | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const previousTop = useRef(0);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [failed, setFailed] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const statusId = useId();

  const run = useCallback(async (kind: Operation) => {
    if (activeRef.current || loading || disabled) return;
    if (kind === "more" && (!hasMore || !onLoadMore)) return;
    if (kind === "refresh" && (!onRefresh || refreshDisabled)) return;
    const action = kind === "more" ? onLoadMore! : onRefresh!;
    const controller = new AbortController();
    activeRef.current = controller;
    setOperation(kind);
    setFailed(false);
    try {
      await action(controller.signal);
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      if (activeRef.current === controller) {
        activeRef.current = null;
        setOperation(null);
      }
    }
  }, [disabled, hasMore, loading, onLoadMore, onRefresh, refreshDisabled]);

  useEffect(() => {
    activeRef.current?.abort();
    activeRef.current = null;
    gestureRef.current = null;
    previousTop.current = 0;
    setOperation(null);
    setFailed(false);
    setPullDistance(0);
    if (rootRef.current) rootRef.current.scrollTop = 0;
    return () => {
      activeRef.current?.abort();
      activeRef.current = null;
    };
  }, [resetKey]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const atEnd = () => root.scrollHeight - Math.max(0, root.scrollTop) - root.clientHeight <= endThreshold;
    const cancel = () => { gestureRef.current = null; setPullDistance(0); };
    const start = (event: TouchEvent) => {
      cancel();
      if (event.touches.length !== 1 || !ownsGesture(event.target, root)) return;
      const point = event.touches[0];
      gestureRef.current = { x: point.clientX, y: point.clientY, top: root.scrollTop <= 0, distance: 0, used: false };
    };
    const move = (event: TouchEvent) => {
      const gesture = gestureRef.current;
      if (!gesture) return;
      if (event.touches.length !== 1) { cancel(); return; }
      const point = event.touches[0];
      const dy = point.clientY - gesture.y;
      const dx = Math.abs(point.clientX - gesture.x);
      if (dx > Math.max(12, Math.abs(dy))) { cancel(); return; }
      if (dy < -16 && atEnd() && !gesture.used) {
        gesture.used = true;
        void run("more");
      }
      if (!gesture.top || root.scrollTop > 0 || dy <= 0 || !onRefresh
        || refreshDisabled || disabled || loading || activeRef.current) {
        gesture.distance = 0;
        setPullDistance(0);
        return;
      }
      gesture.distance = Math.min(dy, pullThreshold + 24);
      if (dy > 12 && event.cancelable) event.preventDefault();
      setPullDistance(gesture.distance);
    };
    const end = () => {
      const shouldRefresh = (gestureRef.current?.distance ?? 0) >= pullThreshold;
      cancel();
      if (shouldRefresh) void run("refresh");
    };
    const wheel = (event: WheelEvent) => {
      if (event.deltaY > 0 && !event.ctrlKey && ownsGesture(event.target, root) && atEnd()) void run("more");
    };
    root.addEventListener("touchstart", start, { passive: true });
    root.addEventListener("touchmove", move, { passive: false });
    root.addEventListener("touchend", end, { passive: true });
    root.addEventListener("touchcancel", cancel, { passive: true });
    root.addEventListener("wheel", wheel, { passive: true });
    return () => {
      root.removeEventListener("touchstart", start);
      root.removeEventListener("touchmove", move);
      root.removeEventListener("touchend", end);
      root.removeEventListener("touchcancel", cancel);
      root.removeEventListener("wheel", wheel);
    };
  }, [disabled, loading, onRefresh, refreshDisabled, run]);

  const busy = loading || operation !== null;
  const status = operation === "refresh" ? labels.refreshing
    : busy ? labels.loading : failed ? labels.failed
      : pullDistance >= pullThreshold ? labels.release
        : pullDistance > 12 ? labels.pull
          : refreshDisabled && onRefresh ? labels.refreshBlocked
            : !hasMore ? labels.end : "";

  return <div className={[styles.collection, className].filter(Boolean).join(" ")}>
    <div className={styles.toolbar}>
      <span id={statusId} role={failed ? "alert" : "status"} aria-live="polite" aria-atomic="true">{status}</span>
      {onRefresh ? <button type="button" disabled={disabled || busy || refreshDisabled}
        aria-describedby={refreshDisabled ? statusId : undefined}
        onClick={() => void run("refresh")}>{labels.refresh}</button> : null}
    </div>
    <div ref={rootRef} className={styles.viewport} role="region" aria-label={label} tabIndex={0}
      aria-busy={busy} onScroll={(event) => {
        if (event.target !== event.currentTarget) return;
        const root = event.currentTarget;
        const movingDown = root.scrollTop > previousTop.current;
        previousTop.current = root.scrollTop;
        if (movingDown && root.scrollHeight - root.scrollTop - root.clientHeight <= endThreshold) void run("more");
      }}>
      <div className={styles.content}>{children}</div>
      {hasMore && onLoadMore ? <div className={styles.more}>
        <button type="button" disabled={disabled || busy} onClick={() => void run("more")}>{labels.loadMore}</button>
      </div> : null}
    </div>
  </div>;
}
