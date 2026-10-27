import NumberInput from './NumberInput';
import { useId, useState } from 'react';
import { fieldLimit } from '../../utils/fieldValidation';
import '../../styles/FormFields.css';

// Keeps the native input API, including refs used by OTP and focus management.
export default function TextField({ as = 'input', field, error, onEdit, onInvalid, onChange, onBlur, maxLength, ref, ...props }) {
  const generatedId = useId();
  const [nativeError, setNativeError] = useState('');
  const Component = as === 'input' && props.type === 'number' ? NumberInput : as;
  const type = as === 'input' ? (props.type || 'text') : as;
  const message = error || nativeError;
  const errorId = `${props.id || generatedId}-error`;
  return <>
    <Component {...props} ref={ref} data-field={field || props.name}
      aria-label={props['aria-label'] || (!props.id ? (field || props.name || '').replace(/([a-z])([A-Z])/g, '$1 $2') : undefined)}
      maxLength={maxLength ?? fieldLimit(field || props.name || props.id || '', type)}
      aria-invalid={message ? true : props['aria-invalid']}
      aria-describedby={[props['aria-describedby'], message ? errorId : null].filter(Boolean).join(' ') || undefined}
      onInvalid={event => { setNativeError(event.currentTarget.validationMessage); onInvalid?.(event); }}
      onBlur={event => { if (nativeError) setNativeError(event.currentTarget.validationMessage); onBlur?.(event); }}
      onChange={event => { setNativeError(''); onEdit?.(event); onChange?.(event); }} />
    {message && <span id={errorId} className="field-error" role="alert">{message}</span>}
  </>;
}
