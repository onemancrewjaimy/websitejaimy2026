/**
 * Micro-interacties: REC-timecode, pauzeknop voor beweging, videospeler,
 * fotogalerij en het jaartal in de footer.
 */
import { openModal } from './modal.js';

const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

/** Gedeelde bewegingsstand: 3D-hero en timecode luisteren hiernaar. */
export const motion = {
  get reduced() {
    return reducedQuery.matches;
  },
  paused: false,
  listeners: new Set(),
  setPaused(value) {
    this.paused = value;
    this.listeners.forEach((listener) => listener(value));
  },
  onChange(listener) {
    this.listeners.add(listener);
  },
};

function initYear() {
  document.querySelectorAll('[data-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
}

/** Timecode HH:MM:SS:FF op 25 beelden per seconde, vanaf het laden van de pagina. */
function initTimecode() {
  const node = document.querySelector('[data-timecode]');
  if (!node || motion.reduced) return;

  const pad = (value) => String(value).padStart(2, '0');
  let elapsed = 0;
  let last = performance.now();
  let timer = null;

  function tick() {
    const now = performance.now();
    elapsed += now - last;
    last = now;
    const totalFrames = Math.floor(elapsed / 40);
    const frames = totalFrames % 25;
    const seconds = Math.floor(totalFrames / 25);
    node.textContent = `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}:${pad(frames)}`;
  }

  function run(active) {
    clearInterval(timer);
    timer = null;
    if (active) {
      last = performance.now();
      timer = setInterval(tick, 80);
    }
  }

  const update = () => run(!motion.paused && !document.hidden);
  motion.onChange(update);
  document.addEventListener('visibilitychange', update);
  update();
}

function initMotionToggle() {
  const button = document.querySelector('[data-motion-toggle]');
  if (!button) return;
  if (motion.reduced) {
    button.hidden = true;
    return;
  }
  button.addEventListener('click', () => {
    const paused = !motion.paused;
    motion.setPaused(paused);
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', paused ? 'Beweging hervatten' : 'Beweging pauzeren');
  });
}

/** De video laadt pas na een klik op de afspeelknop. */
function initPlayers() {
  document.querySelectorAll('[data-player]').forEach((player) => {
    const video = player.querySelector('video');
    const button = player.querySelector('[data-player-play]');
    if (!video || !button) return;
    button.addEventListener('click', () => {
      player.classList.add('is-playing');
      video.play().catch(() => {
        /* Afspelen geweigerd: de standaard bediening van de video blijft zichtbaar. */
      });
      video.focus({ preventScroll: true });
    });
  });
}

function initGallery() {
  document.querySelectorAll('[data-photo]').forEach((button) => {
    button.addEventListener('click', () => {
      openModal({
        kind: 'photo',
        src: button.dataset.photo,
        alt: button.querySelector('img')?.alt || '',
        title: button.dataset.title || 'Achter de schermen',
        trigger: button,
      });
    });
  });
}

export function initMicro() {
  initYear();
  initTimecode();
  initMotionToggle();
  initPlayers();
  initGallery();
}
