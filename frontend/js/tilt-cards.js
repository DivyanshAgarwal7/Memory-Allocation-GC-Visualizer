/**
 * tilt-cards.js
 * Adds a subtle 3D tilt to `.card` elements that follows the cursor.
 * Sets --rx/--ry/--ty custom properties; the actual animation comes
 * from the `transition: transform ...` already declared on `.card`
 * in site.css - this script only updates the inputs.
 */
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const MAX_TILT_DEG = 6;

  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('mousemove', (event) => {
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;  // 0..1 left -> right
      const py = (event.clientY - rect.top) / rect.height;  // 0..1 top -> bottom

      const ry = (px - 0.5) * 2 * MAX_TILT_DEG;
      const rx = (0.5 - py) * 2 * MAX_TILT_DEG;

      card.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
      card.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
    });

    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
})();
