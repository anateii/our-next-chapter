import { Children, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// A list that scrolls inside its card once it's full: the cut-off edge fades
// into the card, and an arrow scrolls to the next item. Two ways to be "full":
// - `visible`: after that many items (measured, since items can wrap), plus
//   PEEK px of the next one. The fade is exactly that tall, so it never covers
//   the last full item.
// - `fill`: the list takes whatever height its card has left (the card sets a
//   fixed height), and scrolls when the items don't fit.
const PEEK = 56;

export default function ScrollFade({
  as: Tag = "div",
  visible,
  fill = false,
  label,
  className,
  children,
}: Readonly<{
  as?: "div" | "ul";
  visible?: number;
  fill?: boolean;
  label: string; // names the scroll area for keyboard and screen reader users
  className?: string;
  children: React.ReactNode;
}>) {
  const listRef = useRef<HTMLElement>(null);
  const [height, setHeight] = useState<number | null>(null); // `visible` mode
  const [overflows, setOverflows] = useState(false); // `fill` mode
  const [atEnd, setAtEnd] = useState(false);
  const count = Children.count(children);

  const updateEnd = () => {
    const el = listRef.current;
    if (el) setAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
  };

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      if (fill) {
        setOverflows(list.scrollHeight > list.clientHeight + 1);
      } else {
        const last = list.children[(visible ?? count) - 1] as HTMLElement | undefined;
        if (!visible || count <= visible || !last) setHeight(null);
        else setHeight(last.offsetTop - list.offsetTop + last.offsetHeight + PEEK);
      }
      setAtEnd(list.scrollTop + list.clientHeight >= list.scrollHeight - 4);
    };
    measure();
    // The card can change size (window resize, items wrapping), so watch it.
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [count, visible, fill]);

  const scrolls = fill ? overflows : height !== null;
  const showMore = () => {
    const list = listRef.current;
    const next = list?.children[0] as HTMLElement | undefined;
    const reduce = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list?.scrollBy({ top: next?.offsetHeight ?? 120, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className={`scroll-fade${fill ? " fill" : ""}`}>
      <Tag
        ref={listRef as React.Ref<HTMLDivElement & HTMLUListElement>}
        className={`${className ?? ""}${scrolls || fill ? " scrolls" : ""}`}
        style={!fill && scrolls ? { maxHeight: height! } : undefined}
        onScroll={updateEnd}
        // Scrollable, so keyboard users can reach it and scroll with the arrow keys.
        {...(scrolls ? { tabIndex: 0, "aria-label": `${label}, scrollable` } : {})}
      >
        {children}
      </Tag>
      {scrolls && !atEnd && (
        <div className="scroll-fade-edge" style={{ height: PEEK }}>
          <button type="button" className="scroll-fade-more" aria-label={`Show more: ${label}`} onClick={showMore}>
            <ChevronDown aria-hidden="true" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
