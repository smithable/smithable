// Smithable app kit: a search box that reports its text shortly after typing stops.
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
    <Input
      type="search"
      aria-label={placeholder}
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      className="mb-4 max-w-sm"
    />
  );
}
