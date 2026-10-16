import { useEffect, useState } from 'react';

export default function useFieldErrors() {
  const [errors, setErrors] = useState({});
  useEffect(() => {
    const field = Object.keys(errors)[0];
    if (!field) return;
    const frame = requestAnimationFrame(() => {
      const controls = [...document.querySelectorAll('[data-field]')];
      controls.find(control => control.dataset.field === field && control.getClientRects().length)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [errors]);
  return [errors, setErrors];
}
