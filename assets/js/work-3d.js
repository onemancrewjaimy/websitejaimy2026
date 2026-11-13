/**
 * Zwevende videopanelen bij "Laatste werk" (Three.js, lokaal uit assets/vendor)
 *
 * De panelen staan als gewone afbeeldingen in de HTML (.float). Dat is meteen
 * de statische fallback. Deze module leest hun plek en maat uit de CSS en zet
 * er 3D-vlakken voor in de plaats, elk op een eigen diepte. De groep kantelt
 * licht mee met de muis (desktop) of met de beweging van de telefoon (mobiel)
 * en de panelen verschuiven ten opzichte van elkaar tijdens het scrollen.
 *
 * - Een paneel met data-video speelt die video af als textuur (muted, loop).
 * - Tekent alleen als de sectie in beeld is en het tabblad zichtbaar is.
 * - Telefoon: lagere pixelratio, geen antialiasing.
 * - Bij verlies van de WebGL-context komt de statische versie terug.
 */
import * as THREE from '../vendor/three.module.min.js';

const FOV = 40;

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Beeld vullend in het vlak (zoals object-fit: cover), afgeronde hoeken,
// dieper = donkerder, en een dunne lichte rand zoals de glazen kaarten.
const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform vec2 uSize;
  uniform float uMediaAspect;
  uniform float uRadius;
  uniform float uDim;
  uniform float uOpacity;
  uniform vec2 uFocus;
  varying vec2 vUv;

  float roundedBox(vec2 p, vec2 halfSize, float r) {
    vec2 q = abs(p) - halfSize + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    float planeAspect = uSize.x / uSize.y;
    vec2 scale = planeAspect > uMediaAspect
      ? vec2(1.0, uMediaAspect / planeAspect)
      : vec2(planeAspect / uMediaAspect, 1.0);
    vec2 uv = (vUv - 0.5) * scale + mix(vec2(0.5), uFocus, 1.0 - scale);
    vec3 color = texture2D(uMap, uv).rgb;

    vec2 p = (vUv - 0.5) * uSize;
    float d = roundedBox(p, uSize * 0.5, uRadius);
    float aa = fwidth(d) + 0.5;
    float alpha = 1.0 - smoothstep(-aa, aa, d);
    float edge = smoothstep(-2.5, -1.0, d) * 0.22;

    color = mix(color, vec3(0.125), uDim);
    color += edge;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function initWork3D(root) {
  const items = [...root.querySelectorAll('[data-float-item]')];
  if (!items.length) return;

  const touch = !window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'float__canvas';
  canvas.setAttribute('aria-hidden', 'true');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !touch,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: true, // geen 3D op softwarematige WebGL
    });
  } catch {
    return; // statische fallback blijft staan
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  root.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 6000);
  const group = new THREE.Group();
  scene.add(group);

  const geometry = new THREE.PlaneGeometry(1, 1);
  const loader = new THREE.TextureLoader();
  const videos = [];
  let pending = items.length;
  let ready = false;

  const panels = items.map((item, index) => {
    const img = item.querySelector('img');
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uMap: { value: null },
        uSize: { value: new THREE.Vector2(1, 1) },
        uMediaAspect: { value: 1 },
        uRadius: { value: 20 },
        uDim: { value: 0 },
        uOpacity: { value: 0 },
        uFocus: { value: new THREE.Vector2(0.5, 0.5) },
      },
    });
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    const done = () => {
      pending -= 1;
      if (pending === 0) {
        ready = true;
        root.classList.add('is-3d');
        requestFrame();
      }
    };
    const useTexture = (texture, aspect) => {
      texture.colorSpace = THREE.NoColorSpace; // kleuren ongewijzigd, zoals de <img>
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      material.uniforms.uMap.value = texture;
      material.uniforms.uMediaAspect.value = aspect;
    };

    loader.load(
      img.currentSrc || img.src,
      (texture) => {
        useTexture(texture, texture.image.width / texture.image.height);
        done();
      },
      undefined,
      () => {
        mesh.visible = false;
        done();
      }
    );

    // Optionele video: neemt de plek van de foto over zodra hij speelt
    const src = item.dataset.video;
    if (src) {
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'none';
      video.src = src;
      video.addEventListener(
        'playing',
        () => useTexture(new THREE.VideoTexture(video), video.videoWidth / video.videoHeight),
        { once: true }
      );
      videos.push(video);
    }

    return {
      item,
      mesh,
      material,
      depth: Number(item.dataset.depth) || -200,
      turn: Number(item.dataset.turn) || 0,
      phase: index * 1.7,
      rest: new THREE.Vector3(),
    };
  });

  let width = 0;
  let height = 0;
  let camZ = 1000;

  function layout() {
    // Het canvas is hoger dan het vak met de afbeeldingen, zodat panelen tijdens
    // het scrollen en kantelen niet tegen de rand worden afgesneden.
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return;
    const boxHeight = root.clientHeight;
    renderer.setSize(width, height, false);
    camZ = height / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    camera.aspect = width / height;
    camera.position.set(0, 0, camZ);
    camera.updateProjectionMatrix();

    const depthScale = touch ? 0.5 : 1;
    panels.forEach((panel) => {
      const { item, mesh, material } = panel;
      const z = panel.depth * depthScale;
      const k = (camZ - z) / camZ; // compenseert de verkleining door de diepte
      const w = item.offsetWidth * k;
      const h = item.offsetHeight * k;
      const cx = item.offsetLeft + item.offsetWidth / 2 - width / 2;
      const cy = boxHeight / 2 - (item.offsetTop + item.offsetHeight / 2);
      panel.rest.set(cx * k, cy * k, z);
      mesh.scale.set(w, h, 1);
      material.uniforms.uSize.value.set(w, h);
      material.uniforms.uRadius.value = parseFloat(getComputedStyle(item).borderRadius) * k || 16;
      material.uniforms.uDim.value = clamp(-z / 1400, 0, 0.45);
      const [fx, fy] = (item.dataset.focus || '50 50').split(' ').map((value) => Number(value) / 100);
      material.uniforms.uFocus.value.set(fx, 1 - fy);
      mesh.renderOrder = z;
    });
  }

  // Muis of telefoonbeweging stuurt de kanteling
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!touch) {
    window.addEventListener(
      'pointermove',
      (event) => {
        pointer.tx = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.ty = (event.clientY / window.innerHeight) * 2 - 1;
      },
      { passive: true }
    );
  } else if ('DeviceOrientationEvent' in window) {
    let base = null;
    const onTilt = (event) => {
      if (event.gamma == null || event.beta == null) return;
      if (base === null) base = event.beta;
      pointer.tx = clamp(event.gamma / 28, -1, 1);
      pointer.ty = clamp((event.beta - base) / 28, -1, 1);
    };
    const listen = () => window.addEventListener('deviceorientation', onTilt, { passive: true });
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS vraagt toestemming, en alleen na een tik
      const ask = () => {
        DeviceOrientationEvent.requestPermission()
          .then((state) => state === 'granted' && listen())
          .catch(() => {});
      };
      root.closest('section')?.addEventListener('click', ask, { once: true });
    } else {
      listen();
    }
  }

  let visible = false;
  let frame = 0;
  let lost = false;
  const clock = new THREE.Clock();

  function render() {
    frame = 0;
    if (!visible || document.hidden || lost || !ready) return;
    const time = clock.getElapsedTime();
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;

    // Plek van de sectie in beeld: -1 (komt van onder) … 0 (midden) … 1 (verdwijnt boven)
    const rect = root.getBoundingClientRect();
    const travel = clamp((window.innerHeight / 2 - (rect.top + rect.height / 2)) / window.innerHeight, -1.2, 1.2);
    const presence = 1 - smooth(0.42, 0.95, Math.abs(travel));

    group.rotation.y = pointer.x * 0.1;
    group.rotation.x = pointer.y * 0.07;
    camera.position.x = -pointer.x * 36;
    camera.position.y = pointer.y * 24;
    camera.lookAt(0, 0, 0);

    panels.forEach((panel) => {
      const { mesh, rest, phase, material } = panel;
      const far = clamp(-rest.z / 520, 0, 1);
      mesh.position.x = rest.x + Math.sin(time * 0.35 + phase) * 6;
      mesh.position.y = rest.y + Math.sin(time * 0.5 + phase) * 9 - travel * (60 + far * 200);
      mesh.position.z = rest.z - (1 - presence) * 320;
      mesh.rotation.y = THREE.MathUtils.degToRad(panel.turn) + Math.sin(time * 0.3 + phase) * 0.04;
      mesh.rotation.x = Math.cos(time * 0.27 + phase) * 0.03;
      material.uniforms.uOpacity.value = presence;
    });

    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  }

  function requestFrame() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      videos.forEach((video) => (visible ? video.play().catch(() => {}) : video.pause()));
      if (visible) requestFrame();
    },
    { rootMargin: '20% 0px' }
  ).observe(root);
  document.addEventListener('visibilitychange', () => !document.hidden && requestFrame());

  new ResizeObserver(() => {
    layout();
    requestFrame();
  }).observe(root);

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lost = true;
    root.classList.remove('is-3d');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    root.classList.add('is-3d');
    requestFrame();
  });

  layout();
}
