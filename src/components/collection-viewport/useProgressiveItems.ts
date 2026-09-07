import { useCallback, useMemo, useState } from "react";

/** Progressive rendering for an already sorted/filtered complete collection. */
export function useProgressiveItems<T>(items: readonly T[], options: {
  resetKey: string;
  batchSize?: number;
  /** Keep an expanded/selected record mounted even after a sort change. */
  keepVisibleIndex?: number;
}) {
  const { resetKey, keepVisibleIndex = -1 } = options;
  const batchSize = Number.isFinite(options.batchSize)
    ? Math.max(1, Math.floor(options.batchSize!)) : 50;
  const [page, setPage] = useState({ key: resetKey, count: batchSize });
  const count = Math.max(page.key === resetKey ? page.count : batchSize, keepVisibleIndex + 1);
  const visibleItems = useMemo(() => items.slice(0, count), [count, items]);
  const loadMore = useCallback(() => {
    setPage((current) => ({ key: resetKey, count: Math.min(items.length,
      Math.max(current.key === resetKey ? current.count : batchSize, keepVisibleIndex + 1) + batchSize) }));
  }, [batchSize, items.length, keepVisibleIndex, resetKey]);
  return { items: visibleItems, hasMore: count < items.length, loadMore };
}
