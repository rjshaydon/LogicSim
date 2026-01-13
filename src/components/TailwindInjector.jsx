import React, { useEffect } from 'react';

// --- Tailwind Injector ---
const TailwindInjector = () => {
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }

    // Inject global styles to block browser navigation gestures
    // UPDATED: Added overscroll-behavior-x: none to * class to catch all internal scrollers
    if (!document.getElementById('global-styles')) {
      const style = document.createElement('style');
      style.id = 'global-styles';
      style.innerHTML = `
            html, body { 
                overscroll-behavior: none; 
                overflow: hidden; 
                touch-action: none; /* Disable browser handling of gestures globally */
            }
            /* Critical: Prevent internal scroll containers from leaking swipes */
            .no-swipe-nav {
                overscroll-behavior-x: none;
            }
        `;
      document.head.appendChild(style);
    }
  }, []);
  return null;
};

export default TailwindInjector;
