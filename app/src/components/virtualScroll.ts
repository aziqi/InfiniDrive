// InfiniDrive — shared helpers for the windowed (virtualized) file views.
//
// VirtualGrid and VirtualList both render INSIDE the FileManager scroll container
// (which itself lives inside the outer wrapper that owns the drag & drop handlers
// and overlay). Because of that they need two things:
//   1. the scroll element instance, which only exists after React attached the
//      parent ref (hence the state round-trip in `useScrollElement`)
//   2. the pixel offset of their own sized container within that scroll container
//      (react-virtual `scrollMargin`), because content such as the subfolders
//      section is rendered above them and scrolls together with the file list.
import { useEffect, useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

/** Resolves the (parent owned) scroll element once React has attached its ref. */
export function useScrollElement(ref: RefObject<HTMLElement | null>): HTMLElement | null {
  // Lazy init: on remounts (e.g. grid <-> list switch) the parent ref is already
  // attached, so the scroll element resolves during the first render.
  const [element, setElement] = useState<HTMLElement | null>(() => ref.current ?? null);

  // No dependency array on purpose: parent host refs are attached after child
  // effects on the very first commit, so we re-check until it resolves. The
  // state setter bails out when nothing changed, so this never loops.
  useEffect(() => {
    const next = ref.current ?? null;
    setElement(prev => (prev === next ? prev : next));
  });

  return element;
}

/**
 * Distance in px between the top of the scroll container content and the top of
 * `targetRef` (the virtualizer sizer). Recomputed on mount, when `recalcKey`
 * changes, on window resize, and whenever the scroll container or anything
 * rendered above the virtualized area changes size.
 */
export function useScrollMargin(
  targetRef: RefObject<HTMLElement | null>,
  scrollElement: HTMLElement | null,
  recalcKey?: string | number
): number {
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const target = targetRef.current;
    if (!target || !scrollElement) return;

    const measure = () => {
      const el = targetRef.current;
      if (!el) return;
      const next =
        el.getBoundingClientRect().top -
        scrollElement.getBoundingClientRect().top +
        scrollElement.scrollTop;
      // Guard against feedback loops: only commit real changes.
      setScrollMargin(prev => (Math.abs(prev - next) > 0.5 ? next : prev));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(scrollElement);

    // Observe every sibling rendered above the virtualized area (subfolders
    // section, list header, ...) so the offset stays correct when they resize.
    let node: HTMLElement | null = target;
    while (node && node !== scrollElement) {
      let sibling: Element | null = node.previousElementSibling;
      while (sibling) {
        observer.observe(sibling);
        sibling = sibling.previousElementSibling;
      }
      node = node.parentElement;
    }

    window.addEventListener('resize', measure);
    const raf = requestAnimationFrame(measure);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [targetRef, scrollElement, recalcKey]);

  return scrollMargin;
}
