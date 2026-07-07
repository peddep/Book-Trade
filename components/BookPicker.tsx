'use client';

import { useEffect, useState } from 'react';
import BookThumb from '@/components/BookThumb';
import { useI18n } from '@/lib/i18n';

export interface PickerBook {
  id: number;
  title: string;
  author: string;
  subject?: string;
  cover_color: string;
  cover_url?: string | null;
  available: number;
}

interface Props {
  excludeIds?: number[];
  selected: number | null;
  onSelect: (id: number) => void;
  filterFn?: (b: PickerBook) => boolean;
  emptyText?: string;
}

// Lists the user's available books as selectable rows.
export default function BookPicker({ excludeIds = [], selected, onSelect, filterFn, emptyText }: Props) {
  const { t } = useI18n();
  const [books, setBooks] = useState<PickerBook[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/books?mine=1&exclude_busy=1')
      .then(r => r.json())
      .then(d => {
        setBooks((d.books ?? []).filter((b: PickerBook) => b.available));
        setLoaded(true);
      });
  }, []);

  const choices = books.filter(b => !excludeIds.includes(b.id) && (!filterFn || filterFn(b)));

  if (loaded && choices.length === 0) {
    return <p className="text-sm text-[#6b7280]">{emptyText ?? t('hub.noFreeBooks')}</p>;
  }

  return (
    <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
      {choices.map(b => (
        <button
          key={b.id}
          type="button"
          onClick={() => onSelect(b.id)}
          className="flex items-center gap-3 p-3 rounded-xl text-left"
          style={{
            background: selected === b.id ? '#ede9fe' : '#ffffff',
            border: `1px solid ${selected === b.id ? '#8b5cf6' : '#e9d5ff'}`,
          }}
        >
          <BookThumb coverUrl={b.cover_url} coverColor={b.cover_color} />
          <div>
            <p className="text-sm font-semibold text-[#2e1065]">{b.title}</p>
            <p className="text-xs text-[#6b7280]">{b.author}</p>
          </div>
          {selected === b.id && <span className="ml-auto text-purple-400">✓</span>}
        </button>
      ))}
    </div>
  );
}
