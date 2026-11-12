/**
 * 3D-hero (Three.js, lokaal uit assets/vendor)
 *
 * Een rustige scène met diepte: de hero-foto staat als vlak achterin, ervoor
 * zweeft amberkleurig lichtstof op verschillende afstanden. De camera
 * beweegt licht mee met de muis en schuift bij scrollen iets naar voren,
 * waardoor foto en stof ten opzichte van elkaar verschuiven.
 *
 * - De gewone <img> blijft eronder staan: zonder WebGL, bij een fout of bij
 *   verlies van de context zie je gewoon de foto.
 * - Op telefoons een lichtere variant: minder deeltjes, pixelratio 1,
 *   30 beelden per seconde en geen muisbeweging.
 * - Tekent alleen als de hero in beeld is, het tabblad zichtbaar is en de
 *   bezoeker de beweging niet heeft gepauzeerd.
 */
import * as THREE from '../vendor/three.module.min.js';
import { motion } from './micro.js';

const PHOTO_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PHOTO_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform float uPlaneAspect;
  uniform float uImageAspect;
  uniform vec2 uFocus;
  uniform float uTime;
  uniform float uDim;
  varying vec2 vUv;

  // Zelfde uitsnede als object-fit: cover met een focuspunt
  vec2 coverUv(vec2 uv) {
    vec2 scale = vec2(1.0);
    if (uPlaneAspect > uImageAspect) {
      scale.y = uImageAspect / uPlaneAspect;
    } else {
      scale.x = uPlaneAspect / uImageAspect;
    }
    return (uv - 0.5) * scale + 0.5 + (uFocus - 0.5) * (1.0 - scale);
  }

  void main() {
    vec3 color = texture2D(uMap, coverUv(vUv)).rgb;

    // Warme avondkleur en een zachte vignet
    color *= vec3(1.05, 0.97, 0.88);
    float vignette = smoothstep(1.0, 0.25, length((vUv - 0.5) * vec2(1.0, 1.2)));
    color *= mix(0.5, 1.0, vignette);

    // Amber licht rechtsboven dat heel langzaam ademt
    float lamp = smoothstep(0.75, 0.0, distance(vUv, vec2(0.8, 0.86)));
    color += vec3(1.0, 0.56, 0.22) * lamp * (0.1 + 0.035 * sin(uTime * 0.45));

    // Teal alleen als zachte gloed linksonder
    float cool = smoothstep(0.7, 0.0, distance(vUv, vec2(0.08, 0.2)));
    color += vec3(0.05, 0.3, 0.3) * cool * 0.12;

    gl_FragColor = vec4(color * uDim, 1.0);
  }
`;

const DUST_VERTEX = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime;
  uniform float uScale;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    vec3 p = position;
    // Stof stijgt langzaam en zwenkt een beetje
    p.y = mod(p.y + 4.5 + uTime * (0.035 + 0.05 * aSeed), 9.0) - 4.5;
    p.x += sin(uTime * 0.11 + aSeed * 31.0) * 0.35;
    p.z += cos(uTime * 0.09 + aSeed * 17.0) * 0.25;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale / -mv.z;

    float twinkle = 0.6 + 0.4 * sin(uTime * (0.35 + aSeed) + aSeed * 40.0);
    float edge = smoothstep(-4.5, -3.2, p.y) * smoothstep(4.5, 3.2, p.y);
    // Grote, dichtbije vlekken zijn zachter (onscherpte)
    float soft = mix(1.0, 0.22, smoothstep(2.5, 9.0, aSize));
    vAlpha = twinkle * edge * soft;
    vSeed = aSeed;
  }
`;

const DUST_FRAGMENT = /* glsl */ `
  precision highp float;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float disc = pow(smoothstep(0.5, 0.0, d), 1.7);
    vec3 amber = vec3(1.0, 0.64, 0.32);
    vec3 teal = vec3(0.25, 0.72, 0.7);
    vec3 color = mix(amber, teal, step(0.9, vSeed));
    gl_FragColor = vec4(color, disc * vAlpha * 0.75);
  }
`;

export function initHero3D(hero) {
  const canvas = hero.querySelector('[data-hero-canvas]');
  if (!canvas) return null;

  const light = window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;

  // Eerst stil controleren of WebGL er is, zodat een ontbrekende context
  // geen foutmelding in de console geeft.
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (error) {
    return null; // geen WebGL: de foto blijft staan
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, light ? 1 : 1.5));
  renderer.setClearColor(0x161514, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  const CAMERA_Z = 6;
  const PHOTO_Z = -5;
  const OVERSCAN = 1.16; // ruimte rond de foto voor de camerabeweging
  camera.position.set(0, 0, CAMERA_Z);

  // --- Foto achterin ---
  // Het focuspunt komt uit de object-position van de <img>, zodat foto en canvas dezelfde uitsnede tonen
  const image = hero.querySelector('.hero__img');
  const focus = new THREE.Vector2(0.5, 0.7);
  function readFocus() {
    const parts = image ? getComputedStyle(image).objectPosition.split(' ').map(parseFloat) : [];
    if (parts.length === 2 && parts.every(Number.isFinite)) focus.set(parts[0] / 100, 1 - parts[1] / 100);
  }
  readFocus();
  const photoMaterial = new THREE.ShaderMaterial({
    vertexShader: PHOTO_VERTEX,
    fragmentShader: PHOTO_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uMap: { value: null },
      uPlaneAspect: { value: 1 },
      uImageAspect: { value: 4 / 3 },
      uFocus: { value: focus },
      uTime: { value: 0 },
      uDim: { value: 1 },
    },
  });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), photoMaterial);
  photo.position.z = PHOTO_Z;
  photo.renderOrder = 0;
  scene.add(photo);

  // --- Lichtstof op verschillende diepten ---
  const count = light ? 60 : 170;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 15;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 9;
    positions[i * 3 + 2] = -4 + Math.random() * 7.5;
    seeds[i] = Math.random();
    // De meeste deeltjes zijn klein; een enkele is een grote onscherpe vlek
    sizes[i] = Math.random() < 0.12 ? 5 + Math.random() * 6 : 0.6 + Math.random() * 1.8;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  dustGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  dustGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const dustMaterial = new THREE.ShaderMaterial({
    vertexShader: DUST_VERTEX,
    fragmentShader: DUST_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 60 } },
  });
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  dust.frustumCulled = false;
  dust.renderOrder = 1;
  scene.add(dust);

  // --- Maat ---
  function resize() {
    const width = hero.clientWidth;
    const height = hero.clientHeight;
    if (!width || !height) return;
    readFocus();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const distance = CAMERA_Z - PHOTO_Z;
    const planeHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * OVERSCAN;
    const planeWidth = planeHeight * camera.aspect;
    photo.scale.set(planeWidth, planeHeight, 1);
    photoMaterial.uniforms.uPlaneAspect.value = planeWidth / planeHeight;
    dustMaterial.uniforms.uScale.value = renderer.domElement.height * 0.065;
    needsFrame = true;
  }

  // --- Invoer ---
  const pointer = { x: 0, y: 0 };
  let scroll = 0;
  let needsFrame = true;

  function onPointer(event) {
    const rect = hero.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  }

  function onScroll() {
    scroll = Math.min(Math.max(window.scrollY / Math.max(hero.clientHeight, 1), 0), 1);
  }

  if (!light) window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // --- Tekenlus ---
  let visible = true;
  let ready = false;
  let frameId = 0;
  let time = 0;
  let last = performance.now();
  let skip = false;
  const current = { x: 0, y: 0, z: CAMERA_Z };

  function shouldRun() {
    return ready && visible && !document.hidden && !motion.paused;
  }

  function frame(now) {
    frameId = 0;
    if (!shouldRun()) return;
    frameId = requestAnimationFrame(frame);

    if (light) {
      skip = !skip; // 30 beelden per seconde op telefoons
      if (skip) return;
    }

    const delta = Math.min((now - last) / 1000, 0.1);
    last = now;
    time += delta;

    const targetX = pointer.x * 0.42 + Math.sin(time * 0.17) * 0.07;
    const targetY = -pointer.y * 0.24 + Math.cos(time * 0.13) * 0.05;
    const targetZ = CAMERA_Z - scroll * 1.3;
    const ease = 1 - Math.pow(0.001, delta); // onafhankelijk van de beeldsnelheid
    current.x += (targetX - current.x) * ease * 0.6;
    current.y += (targetY - current.y) * ease * 0.6;
    current.z += (targetZ - current.z) * ease;

    camera.position.set(current.x, current.y, current.z);
    camera.lookAt(current.x * 0.25, current.y * 0.25, PHOTO_Z);

    photoMaterial.uniforms.uTime.value = time;
    photoMaterial.uniforms.uDim.value = 1 - scroll * 0.45;
    dustMaterial.uniforms.uTime.value = time;

    renderer.render(scene, camera);
  }

  function update() {
    if (shouldRun() && !frameId) {
      last = performance.now();
      frameId = requestAnimationFrame(frame);
    }
  }

  const visibility = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    update();
  });
  visibility.observe(hero);
  document.addEventListener('visibilitychange', update);
  motion.onChange(update);
  new ResizeObserver(resize).observe(hero);

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    ready = false;
    canvas.classList.remove('is-on'); // terug naar de foto
  });

  // --- Foto laden, daarna pas tonen ---
  const source = light ? canvas.dataset.srcSm || canvas.dataset.src : canvas.dataset.src;
  new THREE.TextureLoader().load(
    source,
    (texture) => {
      texture.colorSpace = THREE.NoColorSpace; // kleuren ongewijzigd doorgeven, zoals de <img>
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      photoMaterial.uniforms.uMap.value = texture;
      photoMaterial.uniforms.uImageAspect.value = texture.image.width / texture.image.height;
      resize();
      ready = true;
      renderer.render(scene, camera);
      canvas.classList.add('is-on');
      update();
    },
    undefined,
    () => {
      /* Foto niet geladen: canvas blijft onzichtbaar, de <img> blijft staan. */
    }
  );

  return { renderer };
}
