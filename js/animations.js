/* SEVEN — motion bootstrap
   Deliberately avoids identical section-by-section reveal effects. */

(function () {
  'use strict';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  window.sevenAnimations = {
    refresh: function () {
      /* Kept as a stable public hook for existing pages/extensions. */
    }
  };
})();