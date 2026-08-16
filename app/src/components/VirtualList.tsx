// InfiniDrive — virtualized (windowed) single-column list for the FileManager list view.
//
// Only the visible rows are mounted. Each row is produced by the `renderItem`
// callback that still lives in FileManager scope, so the 12-column list-item
// layout, selection, badges and the inline action buttons stay untouched.
import React, { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useScrollElement, useScrollMargin } from './virtualScroll';

/** space-y-1 between list rows. */
const ROW_GAP = 4;
/** py-2.5 row: 28px icon + 20px padding + 2px border, plus the row gap. */
const ROW_ESTIMATE = 50 + ROW_GAP;

export interface VirtualListProps<T> {
  items: T[];
  /** Ref of the scroll container (owned by FileManager, inside the DnD wrapper). */
  scrollElementRef: RefObject<HTMLElement | null>;
  /** Must return an element WITH a React key — identical JSX to the old list. */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Any change forces a re-measure of the offset inside the scroll container. */
  recalcKey?: string | number;
  className?: string;
  overscan?: number;
  estimateRowHeight?: number;
}

export function VirtualList<T>({
  items,
  scrollElementRef,
  renderItem,
  recalcKey,
  className,
  overscan = 10,
  estimateRowHeight = ROW_ESTIMATE
}: VirtualListProps<T>) {
  const sizerRef = useRef<HTMLDivElement>(null);
  const scrollElement = useScrollElement(scrollElementRef);
  const scrollMargin = useScrollMargin(sizerRef, scrollElement, recalcKey);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => estimateRowHeight,
    overscan,
    scrollMargin
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [estimateRowHeight, rowVirtualizer]);

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div className={className}>
      <div
        ref={sizerRef}
        style={{ position: 'relative', width: '100%', height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {virtualRows.map(virtualRow => {
          const item = items[virtualRow.index];
          if (!item) return null;

          return (
            <div
              key={virtualRow.index}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                // `top` instead of `transform` so nothing creates an extra
                // stacking context around the rows (see VirtualGrid).
                top: `${virtualRow.start - scrollMargin}px`,
                left: 0,
                width: '100%',
                paddingBottom: `${ROW_GAP}px`
              }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VirtualList;
