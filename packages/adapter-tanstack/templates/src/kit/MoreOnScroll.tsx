// Smithable app kit: more of a long list as the reader nears its end (cards: a gallery, a
// catalogue). A "More" button does the same for keyboards, readers and browsers without the
// observer. See docs/design/paging.md.
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { w } from "./words";

export function MoreOnScroll({
  shown,
  total,
  onMore,
}: {
  /** How many are on the page now. */
  shown: number;
  /** How many there are in all: at that, it stops. */
  total: number;
  /** Loads the next ones. */
  onMore: () => Promise<void>;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const left = shown < total;
  const more = async () => {
    if (loading || !left) return;
    setLoading(true);
    try {
      await onMore();
    } finally {
      setLoading(false);
    }
  };
  // The latest `more`, for the observer made once.
  const latest = useRef(more);
  latest.current = more;
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !left || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void latest.current();
      },
      // A little before the end is reached, so the next ones are there as it comes into view.
      { rootMargin: "400px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [left]);
  if (!left) return null;
  return (
    <div ref={sentinel} data-part="more" className="flex justify-center py-4">
      <Button variant="outline" disabled={loading} onClick={() => void more()}>
        {loading ? w.loading : w.more}
      </Button>
    </div>
  );
}
