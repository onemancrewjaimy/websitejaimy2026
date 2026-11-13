/**
 * Homepage "Eén doorlopende take"
 * - Showreel in de hero: laadt pas na de eerste paint, niet bij
 *   prefers-reduced-motion of databesparing. Zonder bestand blijft de foto staan.
 * - Videokaarten bij de diensten: spelen af bij hover (muis) of tik (touch).
 *   De video laadt pas bij de eerste hover of tik.
 */
import { motion } from './micro.js';
import { initTake } from './take.js';

const saveData = navigator.connection?.saveData === true;
const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function initShowreel() {
  const video = document.querySelector('[data-hero-video]');
  if (!video) return;
  const src = video.dataset.src;
  if (!src || motion.reduced || saveData) {
    video.removeAttribute('autoplay');
    // Zonder showreel valt er niets te pauzeren
    document.querySelectorAll('[data-motion-toggle]').forEach((button) => (button.hidden = true));
    return;
  }

  const start = () => {
    video.src = src;
    video.addEventListener(
      'playing',
      () => {
        video.classList.add('is-on');
        video.closest('[data-hero]')?.classList.add('has-reel'); // foto maakt plaats voor de video
      },
      { once: true }
    );
    video.play().catch(() => {
      /* Autoplay geweigerd: de foto blijft staan. */
    });
  };
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1500 });
  else setTimeout(start, 300);

  // Pauzeknop in de HUD, en niet doorspelen buiten beeld of in een verborgen tabblad
  let visible = true;
  const sync = () => {
    if (!video.src) return;
    if (motion.paused || !visible || document.hidden) video.pause();
    else video.play().catch(() => {});
  };
  motion.onChange(sync);
  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    sync();
  }).observe(video);
}

function initReels() {
  const reels = [...document.querySelectorAll('[data-reel]')];
  if (!reels.length) return;

  const stop = (reel) => {
    const video = reel.querySelector('video');
    reel.classList.remove('is-active', 'is-playing');
    reel.querySelector('[data-reel-toggle]')?.setAttribute('aria-pressed', 'false');
    if (video && !video.paused) video.pause();
  };

  const play = (reel) => {
    reels.forEach((other) => other !== reel && stop(other));
    const video = reel.querySelector('video');
    reel.classList.add('is-active');
    reel.querySelector('[data-reel-toggle]')?.setAttribute('aria-pressed', 'true');
    if (!video || !video.dataset.src || motion.reduced) return; // placeholder: alleen de poster
    if (!video.src) video.src = video.dataset.src;
    video
      .play()
      .then(() => reel.classList.add('is-playing'))
      .catch(() => {});
  };

  reels.forEach((reel) => {
    const toggle = reel.querySelector('[data-reel-toggle]');
    if (canHover) {
      reel.addEventListener('pointerenter', () => play(reel));
      reel.addEventListener('pointerleave', () => stop(reel));
    }
    toggle?.addEventListener('click', () => {
      if (canHover) return play(reel); // toetsenbord op desktop: Enter start
      reel.classList.contains('is-active') ? stop(reel) : play(reel);
    });
    toggle?.addEventListener('blur', () => canHover && !reel.matches(':hover') && stop(reel));
  });

  // Buiten beeld stopt alles
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => !entry.isIntersecting && stop(entry.target));
  });
  reels.forEach((reel) => observer.observe(reel));
}

/**
 * 3D-panelen bij "Laatste werk": pas laden als de sectie bijna in beeld komt,
 * en niet op zwakke apparaten, bij databesparing of prefers-reduced-motion.
 * Dan blijft de statische versie (gewone afbeeldingen) staan.
 */
function initWorkPanels() {
  const root = document.querySelector('[data-float]');
  if (!root || motion.reduced || saveData) return;
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
  if (weak) return;
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      import('./work-3d.js')
        .then(({ initWork3D }) => initWork3D(root))
        .catch(() => {
          /* Zonder WebGL of bij een laadfout blijft de statische versie staan. */
        });
    },
    { rootMargin: '100% 0px' }
  );
  observer.observe(root);
}

export function initHome() {
  initShowreel();
  initReels();
  initTake();
  initWorkPanels();
}
