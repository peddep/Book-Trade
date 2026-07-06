'use client';

import { useEffect, useState } from 'react';
import { titleSuggestions, findByTitle } from '@/lib/books-catalog';

const TITLE_SUGGESTIONS = titleSuggestions();

interface Props {
  value: string;
  onChange: (title: string) => void;
  placeholder?: string;
  listId: string;
  required?: boolean;
}

// Title input with the same autocomplete as the Add Book form: suggestions
// from the built-in bilingual catalog plus live results from /api/book-search.
export default function TitleInput({ value, onChange, placeholder, listId, required }: Props) {
  const [remote, setRemote] = useState<{ title: string; author: string }[]>([]);

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

  const seen = new Set<string>();
  const options: { value: string; label?: string }[] = [];
  for (const s of TITLE_SUGGESTIONS) {
    const k = s.value.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    options.push(s);
  }
  for (const b of remote) {
    const k = b.title.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    options.push({ value: b.title, label: b.author || undefined });
  }

  return (
    <>
      <input
        list={listId}
        autoComplete="off"
        required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full p-2.5 rounded-xl text-sm"
        style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
      />
      <datalist id={listId}>
        {options.map(s => (
          <option key={s.value} value={s.value} label={s.label} />
        ))}
      </datalist>
    </>
  );
}
