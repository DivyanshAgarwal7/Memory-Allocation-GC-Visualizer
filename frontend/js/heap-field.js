/**
 * heap-field.js
 * Adds a subtle 3D parallax tilt to `.heap-field` elements based on
 * pointer position. Pure CSS custom-property updates - cheap, and
 * the animation still runs (just without tilt) if this never loads.
 */
(function () {
  'use strict';

  // Per-block 3D placement comes from data-* attributes (not inline `style`)
  // so it survives a strict `style-src` CSP — setting properties via the
  // CSSOM (element.style.setProperty) is not restricted by style-src,
  // unlike the HTML `style` attribute.
  const VARS = ['size', 'tx', 'ty', 'tz', 'rot', 'dur'];

  document.querySelectorAll('.mem-block').forEach((block) => {
    VARS.forEach((key) => {
      const value = block.dataset[key];
      if (value) block.style.setProperty(`--${key}`, value);
    });
    if (block.dataset.floatDelay) block.style.setProperty('--float-delay', block.dataset.floatDelay);
    if (block.dataset.cycleDelay) block.style.setProperty('--cycle-delay', block.dataset.cycleDelay);
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.querySelectorAll('.heap-field').forEach((field) => {
    const inner = field.querySelector('.heap-field__inner');
    if (!inner) return;

    field.addEventListener('mousemove', (event) => {
      const rect = field.getBoundingClientRect();
      const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const my = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      inner.style.setProperty('--mx', mx.toFixed(3));
      inner.style.setProperty('--my', my.toFixed(3));
    });

    field.addEventListener('mouseleave', () => {
      inner.style.setProperty('--mx', 0);
      inner.style.setProperty('--my', 0);
    });
  });
})();
