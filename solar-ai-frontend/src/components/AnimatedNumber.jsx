import React, { useEffect, useState, useRef } from 'react';

/**
 * AnimatedNumber smoothly interpolates between values using requestAnimationFrame.
 * Respects prefers-reduced-motion.
 */
export default function AnimatedNumber({ value, decimals = 1, suffix = '', duration = 500 }) {
  const [displayValue, setDisplayValue] = useState(value);
  const startValRef = useRef(value);
  const startTimeRef = useRef(null);

  useEffect(() => {
    // Respect prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(value);
      return;
    }

    const startVal = startValRef.current ?? 0;
    const targetVal = typeof value === 'number' ? value : parseFloat(value) || 0;
    if (startVal === targetVal) {
      setDisplayValue(targetVal);
      return;
    }

    let animationFrameId;

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (targetVal - startVal) * easeOut;

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetVal);
        startValRef.current = targetVal;
        startTimeRef.current = null;
      }
    };

    startTimeRef.current = null;
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [value, duration]);

  const num = typeof displayValue === 'number' ? displayValue : parseFloat(displayValue) || 0;
  return (
    <span>
      {num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
