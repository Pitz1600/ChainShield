import { useId, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import './YearPicker.css';

// Native date inputs require month/day. This calendar selects and emits only a year.
export default function YearPicker({ value, onChange, disabled = false, label = 'Fiscal year', placeholder = 'Select fiscal year', clearable = false, years, min = 2000, max = 2200 }) {
  const id = useId(), dialog = useRef(null), trigger = useRef(null);
  const [start, setStart] = useState(2020);
  const allowed = years ? new Set(years.map(Number)) : null;
  const first = allowed?.size ? Math.min(...allowed) : min;
  const last = allowed?.size ? Math.max(...allowed) : max;
  function open() {
    const current = Number(value) || Math.max(first, Math.min(last, new Date().getFullYear()));
    setStart(Math.floor(current / 12) * 12);
    dialog.current.showModal();
  }
  function select(year) {
    onChange(year === '' ? '' : String(year));
    dialog.current.close();
    trigger.current.focus();
  }
  return <div className="year-picker">
    <label htmlFor={id}>{label}</label>
    <button ref={trigger} id={id} className="year-picker-trigger" type="button" disabled={disabled} aria-haspopup="dialog" onClick={open}>
      <span>{value || placeholder}</span><CalendarDays size={18} aria-hidden="true" />
    </button>
    <dialog ref={dialog} className="year-picker-dialog" aria-labelledby={`${id}-title`} onClick={e => { if (e.target === dialog.current) dialog.current.close(); }}>
      <div className="year-picker-content">
        <h2 id={`${id}-title`}>Choose fiscal year</h2>
        <div className="year-picker-navigation">
          <button type="button" aria-label="Previous years" disabled={start <= first} onClick={() => setStart(start - 12)}><ChevronLeft size={18} /></button>
          <span aria-live="polite">{start} – {start + 11}</span>
          <button type="button" aria-label="Next years" disabled={start + 11 >= last} onClick={() => setStart(start + 12)}><ChevronRight size={18} /></button>
        </div>
        <div className="year-picker-grid">
          {Array.from({ length: 12 }, (_, i) => start + i).map(year => <button type="button" key={year} aria-pressed={Number(value) === year} disabled={year < min || year > max || (allowed && !allowed.has(year))} onClick={() => select(year)}>{year}</button>)}
        </div>
        <div className="year-picker-actions">
          {clearable && <button type="button" onClick={() => select('')}>All years</button>}
          <button type="button" onClick={() => dialog.current.close()}>Close</button>
        </div>
      </div>
    </dialog>
  </div>;
}
