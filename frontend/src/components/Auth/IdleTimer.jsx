import { useEffect, useRef } from 'react';

const IdleTimer = ({ timeout = 900000, onIdle }) => { // 15 minutes default (15 * 60 * 1000)
    const timerRef = useRef(null);

    useEffect(() => {
        const resetTimer = () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                console.log('User inactive, triggering logout...');
                onIdle();
            }, timeout);
        };

        // Events to listen for activity
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

        // Add listeners
        events.forEach(event => window.addEventListener(event, resetTimer));

        // Initial start
        resetTimer();

        // Cleanup
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            events.forEach(event => window.removeEventListener(event, resetTimer));
        };
    }, [timeout, onIdle]);

    return null;
};

export default IdleTimer;
