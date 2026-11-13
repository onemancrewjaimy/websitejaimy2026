/**
 * ONEMANCREW — startpunt
 * Laadt navigatie en micro-interacties direct. De zwaardere onderdelen
 * (3D-hero, portfolio-waaier, contactformulier) worden pas geladen als de
 * pagina ze heeft, en de 3D-hero pas als hij in beeld is.
 */
import { initNav } from './nav.js';
import { initMicro, motion } from './micro.js';

document.documentElement.classList.add('js');

initNav();
initMicro();

const hero = document.querySelector('[data-hero]');
if (hero && hero.querySelector('[data-hero-canvas]')) {
  const start = () => {
    if (motion.reduced) return; // statische foto bij prefers-reduced-motion
    import('./hero-3d.js')
      .then(({ initHero3D }) => initHero3D(hero))
      .catch(() => {
        /* Zonder WebGL of bij een laadfout blijft de foto staan. */
      });
  };
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1200 });
      else setTimeout(start, 200);
    },
    { rootMargin: '100px' }
  );
  observer.observe(hero);
}

if (document.querySelector('[data-home]')) {
  import('./home.js').then(({ initHome }) => initHome());
}

// Andere pagina's: de gloed in de achtergrond beweegt mee met het scrollen
const flowBg = document.querySelector('.flow .take-bg');
if (flowBg && !motion.reduced) {
  let queued = false;
  const update = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    flowBg.style.setProperty('--flow', max > 0 ? (window.scrollY / max).toFixed(4) : '0');
  };
  window.addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    },
    { passive: true }
  );
  update();
}

const fan = document.querySelector('[data-fan]');
if (fan) {
  Promise.all([import('./portfolio-3d.js'), import('./filters.js')]).then(([{ initFan }, { initFilters }]) => {
    const api = initFan(fan);
    initFilters(api);
  });
}

const form = document.querySelector('[data-contact-form]');
if (form) {
  import('./form.js').then(({ initForm }) => initForm(form));
}
