// InfiniDrive — virtualized (windowed) grid for the FileManager grid view.
//
// Only the visible ROWS are mounted. Each row renders `columns` cards produced by
// the `renderItem` callback that still lives in FileManager scope, so multi-select,
// per-file context menus, zoom, thumbnails, badges and every other behaviour keeps
// working exactly as before.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useScrollElement, useScrollMargin } from './virtualScroll';

/**
 * Zoom level (0 = compact … 4 = large) → minimum card width + grid gap.
 * Calibrated against the previous Tailwind mapping
 *   zoom 0: grid-cols-3/4/6/7/8   gap-2.5
 *   zoom 1: grid-cols-3/4/5/6/7   gap-3
 *   zoom 2: grid-cols-2/3/4/5/6   gap-3.5
 *   zoom 3: grid-cols-2/3/4/4/5   gap-4
 *   zoom 4: grid-cols-1/2/3/3/4   gap-4
 * so the same card sizes are produced, but now derived from the real container
 * width (via ResizeObserver) instead of viewport breakpoints.
 */
const MIN_CARD_WIDTH = [120, 140, 165, 200, 250];
const GRID_GAP = [10, 12, 14, 16, 16];

/** p-3 padding (24) + thumbnail mb-2.5 (10) + file name & meta block (~35). */
const CARD_CHROME = 69;

export interface VirtualGridProps<T> {
  items: T[];
  /** Current zoom level (0..4) used to derive the column count and gap. */
  zoomLevel: number;
  /** Ref of the scroll container (owned by FileManager, inside the DnD wrapper). */
  scrollElementRef: RefObject<HTMLElement | null>;
  /** Must return an element WITH a React key — identical JSX to the old grid. */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Any change forces a re-measure of the offset inside the scroll container. */
  recalcKey?: string | number;
  className?: string;
  overscan?: number;
}

export function VirtualGrid<T>({
  items,
  zoomLevel,
  scrollElementRef,
  renderItem,
  recalcKey,
  className,
  overscan = 3
}: VirtualGridProps<T>) {
  const sizerRef = useRef<HTMLDivElement>(null);
  const scrollElement = useScrollElement(scrollElementRef);
  const [width, setWidth] = useState(0);

  const zoom = Math.max(0, Math.min(MIN_CARD_WIDTH.length - 1, zoomLevel));
  const gap = GRID_GAP[zoom];
  const minCardWidth = MIN_CARD_WIDTH[zoom];

  // Track the available width so the column count follows container resizes.
  useLayoutEffect(() => {
    const el = sizerRef.current;
    if (!el) return;

    const update = () => {
      const next = el.clientWidth;
      setWidth(prev => (Math.abs(prev - next) > 0.5 ? next : prev));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const columns = useMemo(() => {
    if (width <= 0) return 1;
    return Math.max(1, Math.floor((width + gap) / (minCardWidth + gap)));
  }, [width, gap, minCardWidth]);

  const rowCount = Math.ceil(items.length / columns);

  // The thumbnail is aspect-square, so the row height scales with the card width.
  const estimatedRowHeight = useMemo(() => {
    const cardWidth = width > 0 ? (width - gap * (columns - 1)) / columns : minCardWidth;
    return Math.round(Math.max(60, cardWidth - 24) + CARD_CHROME + gap);
  }, [width, columns, gap, minCardWidth]);

  const scrollMargin = useScrollMargin(sizerRef, scrollElement, `${recalcKey ?? ''}|${columns}`);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElement,
    estimateSize: () => estimatedRowHeight,
    overscan,
    scrollMargin
  });

  // A different column count / zoom invalidates every measured row height.
  useEffect(() => {
    rowVirtualizer.measure();
  }, [columns, estimatedRowHeight, rowVirtualizer]);

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div className={className}>
      <div
        ref={sizerRef}
        style={{ position: 'relative', width: '100%', height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {virtualRows.map(virtualRow => {
          const start = virtualRow.index * columns;
          const rowItems = items.slice(start, start + columns);

          return (
            <div
              key={virtualRow.index}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                // `top` instead of `transform`: a transformed row would create its
                // own stacking context and clip the per-file context menu behind
                // the following row. With `top` the z-30 menu still overlays
                // neighbouring cards exactly like the non-virtualized grid did.
                top: `${virtualRow.start - scrollMargin}px`,
                left: 0,
                width: '100%',
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                columnGap: `${gap}px`,
                paddingBottom: `${gap}px`
              }}
            >
              {rowItems.map((item, offset) => renderItem(item, start + offset))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VirtualGrid;
