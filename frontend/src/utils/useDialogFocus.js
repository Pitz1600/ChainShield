import { useEffect, useRef } from 'react';

// Keep keyboard focus inside an open dialog and restore it to its trigger.
export default function useDialogFocus(ref, open, onClose) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const trigger = document.activeElement;
    const controls = () => [...dialog.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
      .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
    (controls()[0] || dialog).focus();
    const handleKey = event => {
      if (event.key === 'Escape' && closeRef.current) {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0] || dialog;
      const last = items.at(-1) || dialog;
      if (!items.length || (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) ||
          (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog))) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    dialog.addEventListener('keydown', handleKey);
    return () => {
      dialog.removeEventListener('keydown', handleKey);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [ref, open]);
}
