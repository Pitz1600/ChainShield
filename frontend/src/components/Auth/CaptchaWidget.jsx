import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import '../../styles/Captcha.css';

const enabled = import.meta.env.VITE_CAPTCHA_ENABLED === 'true';
const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
let scriptPromise;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      const fail = () => { clearTimeout(timeout); script.remove(); reject(new Error('Unavailable')); };
      const timeout = setTimeout(fail, 15000);
      script.onload = () => { clearTimeout(timeout); if (window.turnstile) resolve(window.turnstile); else fail(); };
      script.onerror = fail;
      document.head.appendChild(script);
    }).catch(error => { scriptPromise = undefined; throw error; });
  }
  return scriptPromise;
}

const CaptchaWidget = forwardRef(function CaptchaWidget({ action, onToken }, ref) {
  const container = useRef(null);
  const widget = useRef(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useImperativeHandle(ref, () => ({ reset() {
    onToken('');
    if (widget.current !== null) window.turnstile?.reset(widget.current);
  } }), [onToken]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timeout;
    onToken('');
    if (!siteKey) return;
    timeout = setTimeout(() => {
      if (!cancelled) setError('Security check is taking longer than expected. Please retry.');
    }, 15000);
    loadTurnstile().then(turnstile => {
      if (cancelled) return;
      widget.current = turnstile.render(container.current, {
        sitekey: siteKey, action, appearance: 'interaction-only', size: 'flexible',
        'response-field': false,
        callback: token => { clearTimeout(timeout); setError(''); onToken(token); },
        'expired-callback': () => onToken(''),
        'timeout-callback': () => { onToken(''); setError('Security check expired. Please retry.'); },
        'error-callback': () => { clearTimeout(timeout); onToken(''); setError('Security check unavailable. Check your connection or content blocker and retry.'); }
      });
    }).catch(() => {
      if (!cancelled) { clearTimeout(timeout); setError('Security check could not load. Check your connection or content blocker and retry.'); }
    });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (widget.current !== null) window.turnstile?.remove(widget.current);
      widget.current = null;
      onToken('');
    };
  }, [action, onToken, attempt]);

  if (!enabled) return null;
  return <div className="captcha-container">
    <div ref={container} />
    {!siteKey && <p role="alert">Security check is not configured. Please contact support.</p>}
    {error && <div role="alert"><p>{error}</p><button type="button" className="link-button" onClick={() => { setError(''); setAttempt(value => value + 1); }}>Retry security check</button></div>}
  </div>;
});

export default CaptchaWidget;
