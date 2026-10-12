import { useRef } from 'react';
import useDialogFocus from '../../utils/useDialogFocus';
import useLockBodyScroll from '../../utils/useLockBodyScroll';

// Preserve each feature's markup and actions while sharing keyboard behavior.
export default function DialogSurface({ onClose, label, children, ...props }) {
  const ref = useRef(null);
  useDialogFocus(ref, true, onClose);
  useLockBodyScroll(true);
  return (
    <div {...props} ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
      {children}
    </div>
  );
}
