/**
 * Portfolio: gebogen 3D-waaier van kaarten.
 *
 * De kaarten zijn gewone knoppen in de HTML (portfolio.html); dit script zet
 * ze met CSS 3D-transformaties in een waaier: de middelste kaart groot en
 * scherp, de kaarten ernaast gedraaid, kleiner en donkerder. Er is geen
 * WebGL nodig, dus de waaier werkt ook waar WebGL ontbreekt.
 *
 * Bediening: pijlknoppen, pijltjestoetsen, Home/End, swipe, en een klik op
 * een kaart ernaast. Een klik (of Enter) op de middelste kaart opent het
 * project. Alleen de middelste kaart zit in de tabvolgorde.
 *
 * Lichtere variant op telefoons: één kaart per kant, kleinere hoeken, geen
 * muisbeweging. Bij prefers-reduced-motion staan de overgangen uit (base.css).
 */
import { openModal } from './modal.js';

const LAYOUTS = {
  wide: { reach: 2, x: [0, 0.8, 1.38], z: [0, -150, -300], ry: [0, 34, 44], s: [1, 0.86, 0.76], dim: [0, 0.34, 0.58] },
  compact: { reach: 1, x: [0, 0.74], z: [0, -130], ry: [0, 28], s: [1, 0.84], dim: [0, 0.45] },
};

export function initFan(root) {
  const track = root.querySelector('.fan__track');
  const items = [...track.querySelectorAll('.fan__item')];
  const empty = root.querySelector('[data-fan-empty]');
  const bar = document.querySelector('[data-fan-bar]');
  const prev = bar?.querySelector('[data-fan-prev]');
  const next = bar?.querySelector('[data-fan-next]');
  const count = bar?.querySelector('[data-fan-count]');
  const title = bar?.querySelector('[data-fan-title]');

  const compact = window.matchMedia('(max-width: 767px)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let visible = items;
  let active = 0;

  root.classList.add('is-3d');
  track.scrollLeft = 0;

  function cardWidth() {
    return items[0] ? items[0].offsetWidth : 300;
  }

  function layout() {
    const config = compact.matches ? LAYOUTS.compact : LAYOUTS.wide;
    const width = cardWidth();

    items.forEach((item) => {
      const index = visible.indexOf(item);
      const button = item.querySelector('.fan-card');
      if (index === -1) {
        item.hidden = true;
        return;
      }
      item.hidden = false;
      const offset = index - active;
      const distance = Math.abs(offset);
      const step = Math.min(distance, config.reach);
      const side = Math.sign(offset);
      const out = distance > config.reach;

      item.style.setProperty('--x', `${side * config.x[step] * width}px`);
      item.style.setProperty('--z', `${config.z[step] - (out ? 120 : 0)}px`);
      item.style.setProperty('--ry', `${-side * config.ry[step]}deg`);
      item.style.setProperty('--s', String(config.s[step]));
      item.style.setProperty('--dim', String(config.dim[step]));
      item.style.setProperty('--o', out ? '0' : '1');
      item.style.setProperty('--zi', String(20 - distance));
      item.classList.toggle('is-out', out);
      item.classList.toggle('is-active', offset === 0);

      button.tabIndex = offset === 0 ? 0 : -1;
      if (offset === 0) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });

    const hasItems = visible.length > 0;
    if (empty) empty.hidden = hasItems;
    track.hidden = !hasItems;
    if (bar) bar.hidden = !hasItems;
    if (!hasItems) return;

    const current = visible[active];
    if (count) count.textContent = `${active + 1} / ${visible.length}`;
    if (title) title.textContent = current.dataset.title || '';
    if (prev) prev.disabled = active === 0;
    if (next) next.disabled = active === visible.length - 1;
  }

  function setActive(index, { focus = false } = {}) {
    if (!visible.length) return;
    active = Math.min(Math.max(index, 0), visible.length - 1);
    layout();
    if (focus) visible[active].querySelector('.fan-card').focus({ preventScroll: true });
  }

  function open(item) {
    const button = item.querySelector('.fan-card');
    const data = item.dataset;
    if (data.video) {
      openModal({
        kind: 'video',
        src: data.video,
        poster: data.poster,
        label: data.label,
        title: data.title,
        summary: data.summary,
        trigger: button,
      });
    } else {
      openModal({
        kind: 'photo',
        src: data.full,
        alt: button.querySelector('img')?.alt || '',
        label: data.label,
        title: data.title,
        trigger: button,
      });
    }
  }

  /** Toont alleen de kaarten van één categorie; 'alles' toont alles. */
  function setFilter(category) {
    visible = category === 'alles' ? items : items.filter((item) => item.dataset.category === category);
    const start = visible.findIndex((item) => item.hasAttribute('data-start'));
    active = start !== -1 ? start : Math.floor((visible.length - 1) / 2);
    layout();
    return visible.length;
  }

  /** Zet een project in het midden (voor ankers zoals #project-05) en opent het eventueel. */
  function show(id, { openIt = false } = {}) {
    const item = items.find((entry) => entry.id === id);
    if (!item) return false;
    if (!visible.includes(item)) setFilter('alles');
    setActive(visible.indexOf(item));
    if (openIt) open(item);
    return true;
  }

  // --- Klik: kaart ernaast komt naar het midden, de middelste opent ---
  let swiped = false;
  track.addEventListener('click', (event) => {
    const button = event.target.closest('.fan-card');
    if (!button) return;
    if (swiped) {
      swiped = false;
      return;
    }
    const item = button.closest('.fan__item');
    const index = visible.indexOf(item);
    if (index === active) open(item);
    else setActive(index, { focus: true });
  });

  // --- Toetsenbord ---
  root.addEventListener('keydown', (event) => {
    const keys = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: visible.length - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    setActive(keys[event.key], { focus: true });
  });

  prev?.addEventListener('click', () => setActive(active - 1));
  next?.addEventListener('click', () => setActive(active + 1));

  // --- Swipe ---
  let startX = null;
  let startY = 0;
  root.addEventListener('pointerdown', (event) => {
    startX = event.clientX;
    startY = event.clientY;
    swiped = false;
  });
  root.addEventListener('pointerup', (event) => {
    if (startX === null) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    startX = null;
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swiped = true;
      setActive(active + (dx < 0 ? 1 : -1));
      setTimeout(() => {
        swiped = false;
      }, 60);
    }
  });
  root.addEventListener('pointercancel', () => {
    startX = null;
  });
  // Afbeeldingen niet laten verslepen tijdens een swipe met de muis
  track.addEventListener('dragstart', (event) => event.preventDefault());

  // --- De waaier kantelt licht mee met de muis ---
  if (finePointer.matches && !reduced.matches) {
    root.addEventListener('pointermove', (event) => {
      const rect = root.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      track.style.setProperty('--tilt-y', `${(px * 7).toFixed(2)}deg`);
      track.style.setProperty('--tilt-x', `${(-py * 4).toFixed(2)}deg`);
    });
    root.addEventListener('pointerleave', () => {
      track.style.setProperty('--tilt-y', '0deg');
      track.style.setProperty('--tilt-x', '0deg');
    });
  }

  compact.addEventListener('change', layout);
  window.addEventListener('resize', layout);

  setFilter('alles');

  return { setFilter, setActive, show };
}
