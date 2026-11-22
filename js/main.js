import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { createScreens, SCREEN_PX } from './screens.js?v=8';
import { buildScene } from './scene.js?v=8';

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
  '400 150px "Tilt Neon"',
];
await Promise.race([
  Promise.all(fonts.map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 2500)),
]);

/* ---------- Téléphone ? ---------- */
// Version dédiée : écran étroit, ou écran tactile de petite taille (portrait comme paysage)
const isPhone = () =>
  window.innerWidth < 760 ||
  (window.matchMedia('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 500);
let phone = isPhone();
document.body.classList.toggle('phone', phone);
const lowPower = phone;

/* ---------- Renderer ---------- */
setLoad(35, 'montage du bureau');
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#04050b');
scene.fog = new THREE.Fog('#04050b', 6, 12);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.02, 30);

const screens = createScreens();
const world = buildScene(scene, screens, { lowPower });
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
// Téléphone en portrait : la caméra cadre un moniteur à la fois (celui de la carte affichée),
// en hauteur derrière l'épaule, l'écran placé dans le haut de l'image au-dessus des cartes.
const portrait = () => window.innerWidth / window.innerHeight < 1;
function phonePose(key) {
  camera.fov = 40; // focale plus longue : la tête au premier plan paraît moins grosse
  camera.updateProjectionMatrix();
  const m = monitorsByKeyEarly[key];
  m.screen.updateMatrixWorld();
  const center = m.screen.getWorldPosition(new THREE.Vector3());
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(m.screen.getWorldQuaternion(new THREE.Quaternion()));
  const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  const dist = (m.width / 2 / 0.86) / halfTan; // le moniteur occupe ~86 % de la largeur
  return {
    pos: center.clone().addScaledVector(normal, dist).add(new THREE.Vector3(0, 0.95, 0)),
    target: center.clone().add(new THREE.Vector3(0, -0.5, 0)),
  };
}
const monitorsByKeyEarly = Object.fromEntries(world.monitors.map((m) => [m.key, m]));
const restPose = () => (phone && portrait() ? phonePose(state.phoneSel) : homePose());
let home;
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
  inScreen: false,
  phoneSel: 'profil', // carte affichée sur téléphone
};
home = restPose();

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function tweenCamera(toPos, toTarget, duration, done, midway) {
  state.tween = {
    midway, // { at: 0..1, fn } : action déclenchée en cours de trajet
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

// Sur grand écran, la fenêtre s'affiche DANS le moniteur 3D (CSS3D, interactive).
// Sur téléphone / écran étroit, elle s'ouvre en plein écran pour rester lisible.
const inScreenMode = () => !phone && window.innerWidth >= 760 && window.innerWidth / window.innerHeight >= 1;
const FILL = 1.12; // l'écran occupe ~1/FILL de la vue : on garde le cadre du moniteur visible

const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(window.innerWidth, window.innerHeight);
cssRenderer.domElement.id = 'css3d';
document.body.appendChild(cssRenderer.domElement);
const cssScene = new THREE.Scene();
scene.updateMatrixWorld(true);
const screenUI = {};
world.monitors.forEach((m) => {
  const wrapper = document.createElement('div');
  wrapper.className = `screen-ui panel-${m.key}`; // reprend le thème du panneau
  wrapper.style.setProperty('--accent', m.color);
  const obj = new CSS3DObject(wrapper);
  m.screen.getWorldPosition(obj.position);
  m.screen.getWorldQuaternion(obj.quaternion);
  cssScene.add(obj);
  screenUI[m.key] = { wrapper, obj };
});

function sizeScreenUI(key) {
  const m = monitorsByKey[key];
  const aspect = m.width / m.height;
  const pxW = Math.round(Math.min(window.innerWidth, window.innerHeight * aspect) / FILL);
  const pxH = Math.round(pxW / aspect);
  const { wrapper, obj } = screenUI[key];
  wrapper.style.width = pxW + 'px';
  wrapper.style.height = pxH + 'px';
  obj.scale.setScalar(m.width / pxW);
}

function poseForScreen(m, fill) {
  m.screen.updateMatrixWorld();
  const center = new THREE.Vector3();
  m.screen.getWorldPosition(center);
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(m.screen.getWorldQuaternion(new THREE.Quaternion()));
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const aspect = camera.aspect;
  const dH = (m.height / 2) / Math.tan(vfov / 2);
  const dW = (m.width / 2) / (Math.tan(vfov / 2) * aspect);
  const dist = Math.max(dH, dW) * fill;
  return { pos: center.clone().addScaledVector(normal, dist), target: center };
}

// Références fixes : la fenêtre change de parent (moniteur 3D ou panneau plein écran)
const windows = Object.fromEntries(world.monitors.map((m) => [m.key, $(`#panel-${m.key} .window`)]));

function openWindow(key) {
  const panel = $(`#panel-${key}`);
  const win = windows[key];
  if (state.inScreen) {
    const { wrapper } = screenUI[key];
    sizeScreenUI(key);
    wrapper.appendChild(win);
    requestAnimationFrame(() => wrapper.classList.add('on'));
  } else {
    panel.appendChild(win);
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
  }
  win.querySelector('.window-body').scrollTop = 0;
  win.querySelector('[data-close]').focus({ preventScroll: true });
}

function closeWindow(key) {
  screenUI[key].wrapper.classList.remove('on');
  const panel = $(`#panel-${key}`);
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
}

function enterScreen(key) {
  if (state.mode !== 'home') return;
  const m = monitorsByKey[key];
  state.mode = 'zooming';
  state.active = key;
  state.inScreen = inScreenMode();
  setHover(null);
  document.body.classList.add('zoomed');
  const pose = poseForScreen(m, FILL);
  // Écran étroit : la caméra recule davantage et traverserait le personnage → on le masque
  state.hideOccluders = pose.pos.distanceTo(pose.target) > 0.8;
  const hide = () => world.occluders.forEach((o) => (o.visible = false));
  tweenCamera(
    pose.pos,
    pose.target,
    1300,
    () => {
      state.mode = 'focus';
      document.body.classList.add('focus');
    },
    state.hideOccluders ? { at: 0.3, fn: hide } : undefined
  );
}

// Ouvre la fenêtre (depuis le bouton « Cliquer pour… » de l'avant-goût)
function openFromTeaser() {
  if (state.mode !== 'focus') return;
  screens[state.active].setHover(false);
  canvas.style.cursor = 'default';
  document.body.classList.remove('focus');
  state.mode = 'inside';
  state.inScreen = inScreenMode();
  openWindow(state.active);
}

function leaveScreen(fromHistory = false) {
  if (state.mode !== 'inside' && state.mode !== 'focus') return;
  // Le panneau téléphone a ajouté une entrée d'historique : on la consomme (geste retour)
  if (!fromHistory && history.state && history.state.sheet) {
    history.back();
    return;
  }
  closeWindow(state.active);
  screens[state.active].setHover(false);
  canvas.style.cursor = 'default';
  document.body.classList.remove('focus');
  state.mode = 'leaving';
  home = restPose();
  setTimeout(() => {
    const show = () => world.occluders.forEach((o) => (o.visible = true));
    tweenCamera(
      home.pos.clone(),
      home.target.clone(),
      1200,
      () => {
        show();
        state.mode = 'home';
        state.active = null;
        document.body.classList.remove('zoomed');
      },
      state.hideOccluders ? { at: 0.7, fn: show } : undefined
    );
  }, 280);
}

document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => leaveScreen()));
document.querySelectorAll('.hud-nav button').forEach((b) =>
  b.addEventListener('click', () => enterScreen(b.dataset.screen))
);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') leaveScreen();
});
window.addEventListener('popstate', () => leaveScreen(true));

// Sur écran tactile : « Touchez » plutôt que « Cliquez / Échap »
if (window.matchMedia('(hover: none)').matches) {
  $('#hint').textContent = 'Touchez un écran pour y entrer';
  $('.back-hint').textContent = "Touchez à côté de l'écran pour revenir au bureau";
}

/* ---------- Version téléphone ---------- */
const cards = $('#cards');
const cardEls = [...cards.querySelectorAll('.card')];
const dots = [...document.querySelectorAll('.card-dots i')];

function selectPhone(key, animate = true) {
  if (!key) return;
  const changed = key !== state.phoneSel;
  state.phoneSel = key;
  dots.forEach((d, i) => d.classList.toggle('on', cardEls[i].dataset.screen === key));
  if (!phone) return;
  setHover(key); // l'écran correspondant s'illumine
  if (state.mode === 'home' && changed) {
    home = restPose();
    if (animate) tweenCamera(home.pos.clone(), home.target.clone(), 750);
  }
}
function scrollToCard(key) {
  const el = cardEls.find((c) => c.dataset.screen === key);
  if (el) cards.scrollTo({ left: el.offsetLeft - (cards.clientWidth - el.clientWidth) / 2, behavior: 'smooth' });
  selectPhone(key);
}
let scrollRaf = 0;
cards.addEventListener('scroll', () => {
  cancelAnimationFrame(scrollRaf);
  scrollRaf = requestAnimationFrame(() => {
    const mid = cards.scrollLeft + cards.clientWidth / 2;
    let best = cardEls[0];
    cardEls.forEach((c) => {
      if (Math.abs(c.offsetLeft + c.clientWidth / 2 - mid) < Math.abs(best.offsetLeft + best.clientWidth / 2 - mid)) best = c;
    });
    selectPhone(best.dataset.screen);
  });
});
// paysage : toucher une carte la sélectionne
cardEls.forEach((c) => c.addEventListener('click', (e) => {
  if (!e.target.closest('.card-open')) selectPhone(c.dataset.screen);
}));

// Ouvrir : la caméra plonge vers l'écran, le panneau monte depuis le bas
function openPhone(key) {
  if (state.mode !== 'home') return;
  selectPhone(key, false);
  const m = monitorsByKey[key];
  state.mode = 'zooming';
  state.active = key;
  state.inScreen = false;
  state.hideOccluders = true;
  setHover(null);
  document.body.classList.add('zoomed');
  const pose = poseForScreen(m, 0.95);
  tweenCamera(pose.pos, pose.target, 1000, null, {
    at: 0.25,
    fn: () => world.occluders.forEach((o) => (o.visible = false)),
  });
  setTimeout(() => {
    if (state.active !== key) return;
    state.mode = 'inside';
    history.pushState({ sheet: key }, '');
    openWindow(key);
  }, 380);
}
document.querySelectorAll('.card-open').forEach((b) => b.addEventListener('click', () => openPhone(b.dataset.open)));

// Glisser la barre du panneau vers le bas pour le fermer
Object.values(windows).forEach((win) => {
  const bar = win.querySelector('.titlebar');
  let y0 = null;
  let dy = 0;
  bar.addEventListener('touchstart', (e) => {
    if (!phone || e.target.closest('[data-close]')) return;
    y0 = e.touches[0].clientY;
    dy = 0;
    win.style.transition = 'none';
  }, { passive: true });
  bar.addEventListener('touchmove', (e) => {
    if (y0 === null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    win.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  bar.addEventListener('touchend', () => {
    if (y0 === null) return;
    y0 = null;
    win.style.transition = '';
    win.style.transform = '';
    if (dy > 110) leaveScreen();
  });
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

function raycastScreens(clientX, clientY) {
  state.pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(state.pointer, camera);
  return raycaster.intersectObjects(screenMeshes, false)[0] || null;
}
function pick(clientX, clientY) {
  const hit = raycastScreens(clientX, clientY);
  return hit ? hit.object.userData.key : null;
}
// En mode focus : le pointeur est-il sur l'écran actif, et sur son bouton ?
function focusHit(clientX, clientY) {
  const hit = raycastScreens(clientX, clientY);
  if (!hit || hit.object.userData.key !== state.active) return { onScreen: false, onCTA: false };
  const r = screens[state.active].cta;
  const x = hit.uv.x * SCREEN_PX.W;
  const y = (1 - hit.uv.y) * SCREEN_PX.H;
  const pad = 18; // marge pour viser facilement, surtout au doigt
  const onCTA = !!r && x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
  return { onScreen: true, onCTA };
}

canvas.addEventListener('pointermove', (e) => {
  state.parallax.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  tooltip.style.left = e.clientX + 'px';
  tooltip.style.top = e.clientY + 'px';
  if (state.mode === 'home' && e.pointerType === 'mouse') setHover(pick(e.clientX, e.clientY));
  if (state.mode === 'focus') {
    const { onCTA } = focusHit(e.clientX, e.clientY);
    screens[state.active].setHover(onCTA);
    canvas.style.cursor = onCTA ? 'pointer' : 'default';
  }
});
canvas.addEventListener('pointerleave', () => setHover(null));
canvas.addEventListener('click', (e) => {
  if (state.mode === 'inside' && state.inScreen) return leaveScreen(); // clic hors de l'écran
  if (state.mode === 'focus') {
    const { onScreen, onCTA } = focusHit(e.clientX, e.clientY);
    if (onCTA) openFromTeaser();
    else if (!onScreen) leaveScreen();
    return;
  }
  if (state.mode !== 'home') return;
  const key = pick(e.clientX, e.clientY);
  if (!key) return;
  if (phone) {
    // téléphone : 1er toucher = afficher sa carte ; toucher l'écran déjà affiché = l'ouvrir
    if (key === state.phoneSel) openPhone(key);
    else scrollToCard(key);
    return;
  }
  enterScreen(key);
});

/* ---------- Redimensionnement ---------- */
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  cssRenderer.setSize(w, h);
  phone = isPhone();
  document.body.classList.toggle('phone', phone);
  home = restPose();
  if (state.mode === 'inside' || state.mode === 'focus') {
    const p = poseForScreen(monitorsByKey[state.active], FILL);
    if (state.mode === 'inside' && state.inScreen) sizeScreenUI(state.active);
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
    if (tw.midway && !tw.midway.done && k >= tw.midway.at) {
      tw.midway.done = true;
      tw.midway.fn();
    }
    if (k >= 1) {
      state.tween = null;
      tw.done && tw.done();
    }
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
  } else if (state.mode === 'home') {
    // léger parallaxe à la souris
    if (phone) state.parallax.set(Math.sin(t * 0.35) * 0.35, Math.sin(t * 0.27) * 0.25);
    smoothParallax.lerp(state.parallax, 0.05);
    const amp = phone ? 0.25 : 1;
    camPos.copy(home.pos).add(new THREE.Vector3(smoothParallax.x * 0.22 * amp, -smoothParallax.y * 0.1 * amp, 0));
    camTarget.copy(home.target).add(new THREE.Vector3(smoothParallax.x * 0.06, -smoothParallax.y * 0.03, 0));
    camera.position.lerp(camPos, 0.08);
    camera.lookAt(camTarget);
  } else {
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
  }

  composer.render();
  cssRenderer.render(cssScene, camera);
  requestAnimationFrame(frame);
}

// Outil de mise au point : ?debug expose la caméra dans la console
if (new URLSearchParams(location.search).has('debug')) window.__dbg = { camera, camPos, camTarget, state };

selectPhone('profil', false);
// place la carte « Profil » au centre dès le départ, sans animation
{
  const el = cardEls.find((c) => c.dataset.screen === 'profil');
  cards.scrollLeft = el.offsetLeft - (cards.clientWidth - el.clientWidth) / 2;
}
setLoad(100, 'ready');
requestAnimationFrame(frame);
setTimeout(() => {
  $('#loader').classList.add('done');
  tweenCamera(home.pos.clone(), home.target.clone(), 2600, () => {
    state.mode = 'home';
  });
}, 500);
