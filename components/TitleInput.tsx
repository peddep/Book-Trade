'use client';

import { useEffect, useRef, useState } from 'react';
import { titleSuggestions, findByTitle } from '@/lib/books-catalog';

const TITLE_SUGGESTIONS = titleSuggestions();

interface Props {
  value: string;
  onChange: (title: string) => void;
  // Called when the typed/picked title matches a suggestion that has an author.
  onAuthorFound?: (author: string) => void;
  placeholder?: string;
  listId: string; // kept for API compatibility
  required?: boolean;
}

interface Option {
  value: string;   // the (Thai-first) title inserted on pick
  label?: string;  // the English name shown as a subtitle
  author?: string; // author from remote sources
}

// Title input with a custom suggestion dropdown. Unlike a native <datalist>,
// it matches the query against BOTH the Thai title and the English label — so
// typing "harry" surfaces "แฮร์รี่ พอตเตอร์กับศิลาอาถรรพ์".
export default function TitleInput({ value, onChange, onAuthorFound, placeholder, required }: Props) {
  const [remote, setRemote] = useState<{ title: string; author: string }[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2 || findByTitle(q)) {
      setRemote([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/book-search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setRemote(data.books ?? []);
      } catch {
        // suggestions are best-effort
      }
    }, 350);
    return () => clearTimeout(id);
  }, [value]);

  // Close the dropdown when tapping outside.
  useEffect(() => {
    function onDown(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, []);

  const q = value.trim().toLowerCase();
  const options: Option[] = [];
  if (q.length >= 2) {
    const seen = new Set<string>();
    // Built-in catalog: match Thai title or English label.
    for (const s of TITLE_SUGGESTIONS) {
      if (options.length >= 8) break;
      if (!s.value.toLowerCase().includes(q) && !(s.label ?? '').toLowerCase().includes(q)) continue;
      const k = s.value.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      options.push(s);
    }
    // Live results from our DB + external APIs — Thai-script titles only, so
    // English-main titles never appear as suggestions.
    const THAI_RE = /[฀-๿]/;
    for (const b of remote) {
      if (options.length >= 8) break;
      if (!THAI_RE.test(b.title)) continue;
      const k = b.title.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      options.push({ value: b.title, label: b.author || undefined, author: b.author || undefined });
    }
  }
  const exact = options.length === 1 && options[0].value === value;
  const showList = open && options.length > 0 && !exact;

  function pick(o: Option) {
    onChange(o.value);
    if (o.author) onAuthorFound?.(o.author);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        autoComplete="off"
        required={required}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        placeholder={placeholder}
        className="w-full p-2.5 rounded-xl text-sm"
        style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
      />
      {showList && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl overflow-hidden shadow-xl"
          style={{ background: '#ffffff', border: '1px solid #e9d5ff', maxHeight: 260, overflowY: 'auto' }}>
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => pick(o)}
              className="block w-full text-left px-3 py-2 hover:bg-[#faf5ff]"
              style={{ borderBottom: '1px solid #f3e8ff' }}
            >
              <span className="block text-sm font-semibold text-[#2e1065] leading-tight">{o.value}</span>
              {o.label && <span className="block text-xs text-[#9ca3af] mt-0.5">{o.label}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
