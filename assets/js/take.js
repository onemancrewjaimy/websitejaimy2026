/**
 * "Eén doorlopende take": HUD, soepel scrollen en overgangen tussen scènes.
 *
 * - De HUD (timecode op scrollpositie + scènelabel) werkt altijd, ook zonder
 *   GSAP en bij prefers-reduced-motion.
 * - GSAP, ScrollTrigger en Lenis (lokaal in assets/vendor) laden pas na de
 *   eerste paint, en helemaal niet bij prefers-reduced-motion.
 * - Desktop: hero blijft staan en trekt uit focus terwijl de volgende scène
 *   eroverheen schuift; daarna per scène een focus-pull, maskerwipe of fade.
 * - Telefoon: lichtere variant, alleen fade en een korte verschuiving.
 * - Zonder JavaScript of bij een laadfout staat alle inhoud gewoon zichtbaar.
 */
import { motion } from './micro.js';

const VENDOR = ['gsap.min.js', 'ScrollTrigger.min.js', 'lenis.min.js'];
const PX_PER_FRAME = 4; // 4 px scrollen = 1 beeld op 25 beelden per seconde

function loadScript(file) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(`../vendor/${file}`, import.meta.url).href;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
}

/** Timecode en scènelabel volgen de scrollpositie. */
function initHud() {
  const timecode = document.querySelector('[data-take-timecode]');
  const label = document.querySelector('[data-take-scene]');
  const scenes = [...document.querySelectorAll('[data-scene]')];
  if (!timecode || !label || !scenes.length) return;

  const pad = (value) => String(value).padStart(2, '0');
  let queued = false;

  function update() {
    queued = false;
    const frames = Math.max(0, Math.round(window.scrollY / PX_PER_FRAME));
    const seconds = Math.floor(frames / 25);
    timecode.textContent = `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}:${pad(frames % 25)}`;

    const line = window.innerHeight * 0.5;
    let index = 0;
    scenes.forEach((scene, i) => {
      if (scene.getBoundingClientRect().top <= line) index = i;
    });
    const text = `${pad(index + 1)} / ${scenes[index].dataset.scene.toUpperCase()}`;
    if (label.textContent !== text) label.textContent = text;
  }

  const request = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
}

function buildDesktop(gsap, ScrollTrigger) {
  const hero = document.querySelector('[data-hero]');
  const round = getComputedStyle(document.documentElement).getPropertyValue('--r-lg').trim() || '28px';

  // 01 Hero blijft staan; de volgende scène schuift eroverheen terwijl het beeld uit focus trekt
  if (hero) {
    ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom top', pin: true, pinSpacing: false });
    gsap
      .timeline({ defaults: { ease: 'none' }, scrollTrigger: { start: 0, end: () => hero.offsetHeight, scrub: true, invalidateOnRefresh: true } })
      .to(hero.querySelector('.hero__media'), { filter: 'blur(16px)', scale: 1.06, duration: 1 }, 0)
      .to(hero.querySelector('.take-hero__inner'), { yPercent: -18, opacity: 0, duration: 0.5 }, 0)
      .to(hero, { autoAlpha: 0, duration: 0.5 }, 0.45);
  }

  const enter = (trigger, targets, from, to = {}, range = ['top 88%', 'top 38%']) => {
    if (!trigger || !targets || targets.length === 0) return;
    gsap.fromTo(targets, from, {
      ...to,
      ease: 'none',
      scrollTrigger: { trigger, start: range[0], end: range[1], scrub: 0.4 },
    });
  };
  const fadeRise = [{ opacity: 0, y: 40 }, { opacity: 1, y: 0 }];
  const focusPull = [{ opacity: 0, filter: 'blur(14px)' }, { opacity: 1, filter: 'blur(0px)' }];
  const q = (selector) => gsap.utils.toArray(selector);

  // 02 Diensten: kaarten vegen van onder naar boven open (maskerwipe)
  enter('#aanbod', q('#aanbod .scene__head'), ...fadeRise);
  enter(
    '#aanbod',
    q('#aanbod .reel'),
    { clipPath: `inset(100% 0% 0% 0% round ${round})` },
    { clipPath: `inset(0% 0% 0% 0% round ${round})`, stagger: 0.12 },
    ['top 80%', 'top 22%']
  );

  // 03 Resultaat: cijfers trekken scherp (focus-pull)
  enter('#resultaat', q('#resultaat .scene__head'), ...focusPull);
  enter('#resultaat', q('#resultaat .figure'), focusPull[0], { ...focusPull[1], stagger: 0.1 }, ['top 75%', 'top 25%']);
  enter('#resultaat', q('#resultaat .more'), { opacity: 0 }, { opacity: 1 }, ['top 45%', 'top 25%']);

  // 04 Werk: het beeld opent als een diafragma
  enter('#werk', q('#werk .scene__head'), ...fadeRise);
  enter(
    '#werk',
    q('#werk .player'),
    { clipPath: `inset(22% 26% 22% 26% round ${round})`, opacity: 0.3 },
    { clipPath: `inset(0% 0% 0% 0% round ${round})`, opacity: 1 },
    ['top 80%', 'top 22%']
  );

  // 05 Werkwijze: regel voor regel
  enter('#werkwijze', q('#werkwijze .scene__head'), ...fadeRise);
  enter('#werkwijze', q('#werkwijze .shots > li'), { opacity: 0, x: -32 }, { opacity: 1, x: 0, stagger: 0.14 }, ['top 72%', 'top 20%']);

  // 06 Afsluiting: focus-pull, footer komt rustig mee
  enter('#afsluiting', q('#afsluiting .closing__cta'), ...focusPull, ['top 85%', 'top 45%']);
  enter('.closing__grid', q('.closing__grid, .closing__legal'), { opacity: 0 }, { opacity: 1 }, ['top 98%', 'top 78%']);

  // Uitgaande scène vervaagt terwijl de volgende eroverheen schuift
  q('.scene').forEach((scene) => {
    gsap.fromTo(
      scene.querySelector('.wrap'),
      { opacity: 1 },
      {
        opacity: 0,
        ease: 'none',
        immediateRender: false,
        scrollTrigger: { trigger: scene, start: 'bottom 46%', end: 'bottom 8%', scrub: true },
      }
    );
  });
}

function buildMobile(gsap) {
  // Lichte variant: geen blur, geen vastgezette hero, alleen fade en een korte verschuiving
  gsap.utils.toArray('.scene, #afsluiting').forEach((scene) => {
    const parts = scene.querySelectorAll('.scene__head, .reel, .figures, .more, .work-stage, .shots > li, .closing__cta');
    parts.forEach((part) => {
      gsap.fromTo(
        part,
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, ease: 'none', scrollTrigger: { trigger: part, start: 'top 96%', end: 'top 72%', scrub: 0.3 } }
      );
    });
  });
}

/** De gloed beweegt over de hele pagina mee, over sectiegrenzen heen. */
function buildGlow(gsap) {
  const warm = document.querySelector('.take-bg__warm');
  const cool = document.querySelector('.take-bg__cool');
  if (!warm || !cool) return;
  const scrollTrigger = { start: 0, end: 'max', scrub: 1.2 };
  gsap.to(warm, {
    keyframes: [
      { xPercent: -62, yPercent: 46 },
      { xPercent: -8, yPercent: 78 },
      { xPercent: -70, yPercent: 30 },
      { xPercent: -30, yPercent: 70 },
    ],
    ease: 'none',
    scrollTrigger,
  });
  gsap.to(cool, {
    keyframes: [
      { xPercent: 78, yPercent: -50 },
      { xPercent: 20, yPercent: -84 },
      { xPercent: 96, yPercent: -34 },
      { xPercent: 40, yPercent: -74 },
    ],
    ease: 'none',
    scrollTrigger,
  });
}

async function initMotion() {
  await new Promise((resolve) => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve, { once: true });
  });
  await Promise.all(VENDOR.map(loadScript));
  const { gsap, ScrollTrigger, Lenis } = window;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  // Soepel scrollen alleen met muis of trackpad; touch houdt het eigen scrollgedrag
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const lenis = new Lenis({ anchors: true, lerp: 0.11 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
  }

  document.documentElement.classList.add('take-on');

  const mm = gsap.matchMedia();
  mm.add('(min-width: 900px)', () => buildDesktop(gsap, ScrollTrigger));
  mm.add('(max-width: 899px)', () => buildMobile(gsap));
  buildGlow(gsap);

  // De uitklap verandert de paginahoogte
  document.querySelectorAll('details').forEach((details) => {
    details.addEventListener('toggle', () => ScrollTrigger.refresh());
  });
  ScrollTrigger.refresh();
}

export function initTake() {
  initHud();
  if (motion.reduced) return;
  initMotion().catch(() => {
    /* Laadfout: de pagina blijft staan zonder overgangen. */
    document.documentElement.classList.remove('take-on');
  });
}
