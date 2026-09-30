// Smithable app kit: a search box that reports its text shortly after typing stops.
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "#/components/ui/input";

export function SearchBox({
  value,
  placeholder,
  onSearch,
}: {
  value: string;
  placeholder: string;
  onSearch: (text: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onSearch(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text, value, onSearch]);
  return (
    <div data-kit="search-box" className="relative mb-6 max-w-md">
      <Input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="pr-10"
      />
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
