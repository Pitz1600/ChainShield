import { useLayoutEffect, useRef, useState } from 'react';

const format = value => {
  const [integer, decimal] = String(value ?? '').split('.');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (decimal === undefined ? '' : `.${decimal}`);
};

// Display grouping without passing commas to form state or calculations.
export default function NumberInput({ value, onChange, min, max, step, ref, ...props }) {
  const inputRef = useRef(null);
  const caret = useRef(null);
  const [draft, setDraft] = useState(String(value ?? ''));
  const [previousValue, setPreviousValue] = useState(value);
  if (value !== previousValue) {
    setPreviousValue(value);
    if (Number(value) !== Number(draft)) setDraft(String(value ?? ''));
  }
  const displayed = format(draft);
  useLayoutEffect(() => {
    const input = inputRef.current;
    const number = Number(draft);
    input.setCustomValidity(draft && !/^\d+(\.\d+)?$/.test(draft)
      ? 'Enter a valid number.'
      : draft && min !== undefined && number < Number(min)
        ? `Enter a number greater than or equal to ${min}.`
        : draft && max !== undefined && number > Number(max)
          ? `Enter a number less than or equal to ${max}.`
          : draft && step && step !== 'any' && Math.abs((number - Number(min || 0)) / Number(step) - Math.round((number - Number(min || 0)) / Number(step))) > 1e-7
            ? `Enter a value in increments of ${step}.` : '');
    if (caret.current !== null) {
      let position = 0, digits = 0;
      while (position < displayed.length && digits < caret.current) {
        if (displayed[position] !== ',') digits++;
        position++;
      }
      input.setSelectionRange(position, position);
      caret.current = null;
    }
  });
  return <input {...props} ref={node => {
    inputRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }} type="text" inputMode="decimal" value={displayed} onChange={event => {
    const raw = event.target.value.replaceAll(',', '');
    if (!/^\d*(\.\d*)?$/.test(raw)) return;
    caret.current = event.target.value.slice(0, event.target.selectionStart).replaceAll(',', '').length;
    setDraft(raw);
    onChange?.({ ...event, target: { ...event.target, name: event.target.name, value: raw }, currentTarget: { ...event.currentTarget, value: raw } });
  }} />;
}
