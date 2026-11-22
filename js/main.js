import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createScreens } from './screens.js';
import { buildScene } from './scene.js';

const $ = (s) => document.querySelector(s);
const loaderText = $('#loader-text');
const loaderProgress = $('#loader-progress');
const setLoad = (pct, txt) => {
  loaderProgress.style.width = pct + '%';
  if (txt) loaderText.textContent = txt;
};

/* ---------- Polices (nécessaires avant de dessiner les écrans) ---------- */
setLoad(10, 'chargement des polices');
const fonts = [
  '700 54px "Space Grotesk"',
  '600 26px "Inter"',
  '400 26px "JetBrains Mono"',
  '600 26px "JetBrains Mono"',
  '700 76px "Josefin Sans"',
  '600 21px "Josefin Sans"',
];
await Promise.race([
  Promise.all(fonts.map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 2500)),
]);

/* ---------- Renderer ---------- */
setLoad(35, 'montage du bureau');
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#04050b');
scene.fog = new THREE.Fog('#04050b', 6, 12);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.02, 30);

const screens = createScreens();
const world = buildScene(scene, screens);
setLoad(70, 'allumage des écrans');

/* ---------- Post-traitement (bloom) ---------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.6, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ---------- Caméra : position d'accueil ---------- */
function homePose() {
  // Recul automatique sur écran étroit pour garder les 3 moniteurs visibles
  const aspect = window.innerWidth / window.innerHeight;
  camera.fov = aspect < 1 ? 45 + (1 - aspect) * 30 : 45;
  camera.updateProjectionMatrix();
  const back = aspect < 1 ? 2.2 + (1 - aspect) * 1.6 : aspect < 1.4 ? 2.1 : 1.95;
  return {
    pos: new THREE.Vector3(0.3, 2.2, back),
    target: new THREE.Vector3(0, 1.02, -0.75),
  };
}
let home = homePose();
const camPos = new THREE.Vector3(1.6, 2.3, 4.2); // départ de l'intro
const camTarget = new THREE.Vector3(0, 1.1, -0.7);
camera.position.copy(camPos);
camera.lookAt(camTarget);

/* ---------- État ---------- */
const state = {
  mode: 'intro', // intro | home | zooming | inside | leaving
  active: null,
  hovered: null,
  pointer: new THREE.Vector2(),
  parallax: new THREE.Vector2(),
  tween: null,
};

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function tweenCamera(toPos, toTarget, duration, done) {
  state.tween = {
    fromPos: camPos.clone(),
    fromTarget: camTarget.clone(),
    toPos,
    toTarget,
    start: performance.now(),
    duration,
    done,
  };
}

/* ---------- Entrer dans un écran ---------- */
const monitorsByKey = Object.fromEntries(world.monitors.map((m) => [m.key, m]));
const screenMeshes = world.monitors.map((m) => m.screen);

function poseForScreen(m) {
  m.screen.updateMatrixWorld();
  const center = new THREE.Vector3();
  m.screen.getWorldPosition(center);
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(m.screen.getWorldQuaternion(new THREE.Quaternion()));
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const aspect = camera.aspect;
  const dH = (m.height / 2) / Math.tan(vfov / 2);
  const dW = (m.width / 2) / (Math.tan(vfov / 2) * aspect);
  const dist = Math.max(dH, dW) * 0.92;
  return { pos: center.clone().addScaledVector(normal, dist), target: center };
}

function enterScreen(key) {
  if (state.mode !== 'home') return;
  const m = monitorsByKey[key];
  state.mode = 'zooming';
  state.active = key;
  setHover(null);
  document.body.classList.add('zoomed');
  const pose = poseForScreen(m);
  tweenCamera(pose.pos, pose.target, 1300, () => {
    state.mode = 'inside';
    const panel = $(`#panel-${key}`);
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    panel.querySelector('.window-body').scrollTop = 0;
    panel.querySelector('[data-close]').focus({ preventScroll: true });
  });
}

function leaveScreen() {
  if (state.mode !== 'inside') return;
  const panel = $(`#panel-${state.active}`);
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  state.mode = 'leaving';
  home = homePose();
  setTimeout(() => {
    tweenCamera(home.pos.clone(), home.target.clone(), 1200, () => {
      state.mode = 'home';
      state.active = null;
      document.body.classList.remove('zoomed');
    });
  }, 250);
}

document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', leaveScreen));
document.querySelectorAll('.hud-nav button').forEach((b) =>
  b.addEventListener('click', () => enterScreen(b.dataset.screen))
);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') leaveScreen();
});

/* ---------- Survol / clic ---------- */
const raycaster = new THREE.Raycaster();
const tooltip = $('#tooltip');

function setHover(key) {
  if (state.hovered === key) return;
  state.hovered = key;
  world.monitors.forEach((m) => {
    m.screen.material.color.setScalar(m.key === key ? 1.35 : 0.92);
    m.light.intensity = m.key === key ? 2.6 : 1.6;
  });
  canvas.style.cursor = key ? 'pointer' : 'default';
  if (key) {
    tooltip.textContent = `▶ Entrer : ${monitorsByKey[key].label}`;
    tooltip.style.color = monitorsByKey[key].color;
    tooltip.classList.add('show');
  } else {
    tooltip.classList.remove('show');
  }
}

function pick(clientX, clientY) {
  state.pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(state.pointer, camera);
  const hit = raycaster.intersectObjects(screenMeshes, false)[0];
  return hit ? hit.object.userData.key : null;
}

canvas.addEventListener('pointermove', (e) => {
  state.parallax.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  tooltip.style.left = e.clientX + 'px';
  tooltip.style.top = e.clientY + 'px';
  if (state.mode === 'home' && e.pointerType === 'mouse') setHover(pick(e.clientX, e.clientY));
});
canvas.addEventListener('pointerleave', () => setHover(null));
canvas.addEventListener('click', (e) => {
  if (state.mode !== 'home') return;
  const key = pick(e.clientX, e.clientY);
  if (key) enterScreen(key);
});

/* ---------- Redimensionnement ---------- */
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  home = homePose();
  if (state.mode === 'inside') {
    const p = poseForScreen(monitorsByKey[state.active]);
    camPos.copy(p.pos);
    camTarget.copy(p.target);
  }
});

/* ---------- Boucle ---------- */
const clock = new THREE.Clock();
const smoothParallax = new THREE.Vector2();

function frame() {
  const t = clock.getElapsedTime();
  world.update(t);
  Object.values(screens).forEach((s) => s.update(t));

  if (state.tween) {
    const tw = state.tween;
    const k = Math.min(1, (performance.now() - tw.start) / tw.duration);
    const e = ease(k);
    camPos.lerpVectors(tw.fromPos, tw.toPos, e);
    camTarget.lerpVectors(tw.fromTarget, tw.toTarget, e);
    if (k >= 1) {
      state.tween = null;
      tw.done && tw.done();
    }
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
  } else if (state.mode === 'home') {
    // léger parallaxe à la souris
    smoothParallax.lerp(state.parallax, 0.05);
    camPos.copy(home.pos).add(new THREE.Vector3(smoothParallax.x * 0.22, -smoothParallax.y * 0.1, 0));
    camTarget.copy(home.target).add(new THREE.Vector3(smoothParallax.x * 0.06, -smoothParallax.y * 0.03, 0));
    camera.position.lerp(camPos, 0.08);
    camera.lookAt(camTarget);
  } else {
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
  }

  composer.render();
  requestAnimationFrame(frame);
}

// Outil de mise au point : ?debug expose la caméra dans la console
if (new URLSearchParams(location.search).has('debug')) window.__dbg = { camera, camPos, camTarget, state };

setLoad(100, 'ready');
requestAnimationFrame(frame);
setTimeout(() => {
  $('#loader').classList.add('done');
  tweenCamera(home.pos.clone(), home.target.clone(), 2600, () => {
    state.mode = 'home';
  });
}, 500);
