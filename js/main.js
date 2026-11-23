import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createScreens, SCREEN_PX } from './screens.js?v=33';
import { buildScene } from './scene.js?v=33';

const $ = (s) => document.querySelector(s);
const loaderText = $('#loader-text');
const loaderProgress = $('#loader-progress');
const setLoad = (pct, txt) => {
  loaderProgress.style.width = pct + '%';
  if (txt) loaderText.textContent = txt;
};

/* ---------- Modèles 3D : téléchargés dès le départ, en parallèle des polices ---------- */
const gltfLoader = new GLTFLoader();
const characterReq = gltfLoader.loadAsync('assets/leonard-typing.glb?v=2');
const lampReq = gltfLoader.loadAsync('assets/desk-lamp.glb?v=2');
characterReq.catch(() => {}); // erreurs traitées plus bas
lampReq.catch(() => {});

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
// Pas d'antialiasing natif : le rendu passe par le post-traitement, qui l'ignorerait (voir le
// composer). Pas de GPU « haute performance » forcé : le navigateur choisit le plus sobre.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
// Résolution plafonnée à 1,5× (au-delà, le gain est invisible sous le bloom et coûte cher) ;
// abaissée automatiquement si l'appareil ne suit pas (voir la boucle).
const MAX_PR = 1.5;
let pixelRatio = Math.min(window.devicePixelRatio, MAX_PR);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // ombres recalculées une image sur deux (voir la boucle)

const scene = new THREE.Scene();
scene.background = new THREE.Color('#04050b');
scene.fog = new THREE.Fog('#04050b', 6, 12);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.02, 30);

const screens = createScreens();
const world = buildScene(scene, screens, { lowPower });

/* ---------- Personnage (modèle Mixamo « Leonard », animation Typing) ---------- */
// Chargé avant d'afficher la scène ; en cas d'échec, le personnage procédural reste en place.
setLoad(50, 'installation du personnage');
let mixer = null;
let armFix = null; // correction de l'avant-bras droit (voir fitCharacter)
let mouseTrack = null; // trajectoire de la souris (voir fitCharacter et updateMouse)
const DESK_Y = 0.764; // dessus du tapis de souris
// À chaque image : la souris suit la trajectoire précalculée sur l'animation (collée à la
// paume droite quand la main est dessus, immobile quand elle tape), avec un léger lissage.
function updateMouse(dt) {
  const m = mouseTrack;
  if (!m || !dt) return;
  const f = ((mixer._actions[0].time % m.dur) / m.dur) * m.n;
  const i0 = Math.floor(f) % m.n;
  const i1 = (i0 + 1) % m.n;
  const a = f - Math.floor(f);
  const at = (k) => m.path[i0 * 3 + k] + (m.path[i1 * 3 + k] - m.path[i0 * 3 + k]) * a;
  const k = 1 - Math.exp(-dt * 18);
  m.x += (at(0) - m.x) * k;
  m.z += (at(1) - m.z) * k;
  m.rot += (at(2) - m.rot) * k;
  world.placeMouse(m.x, m.z, m.rot);
}
const _pq = new THREE.Quaternion();
const _lq = new THREE.Quaternion();
const _mq = new THREE.Quaternion();
const _wq = new THREE.Quaternion();
try {
  const gltf = await characterReq;
  const model = gltf.scene;
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false; // la boîte englobante ne suit pas l'animation
    }
  });
  model.rotation.y = Math.PI; // Mixamo regarde vers +z, le bureau est vers -z
  scene.add(model);
  mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(gltf.animations[0]).play();
  fitCharacter(model);
  world.useCharacterModel(model);
} catch (err) {
  console.warn('Modèle 3D indisponible, personnage de secours utilisé', err);
}

// Cale le modèle et le bureau sur l'animation : on mesure où tombent réellement les doigts
// pendant la frappe, puis on place le bassin sur la chaise, la frappe sur le dessus des touches,
// le clavier centré sous les deux mains et la souris sous la paume droite.
// L'animation garde la main droite plus haute que la gauche : une petite rotation constante
// de l'avant-bras droit autour du coude (armFix, appliquée après chaque mise à jour du mixer)
// la rabaisse sans changer sa portée.
function applyArmFix() {
  if (!armFix) return;
  const b = armFix.bone;
  // le mixer ne réécrit l'os que si la valeur animée change : sinon on repart de la pose
  // animée mémorisée, pour ne pas cumuler la correction image après image
  if (armFix.applied && b.quaternion.equals(armFix.applied)) b.quaternion.copy(armFix.base);
  armFix.base.copy(b.quaternion);
  // pendant les phases souris, la main descend un peu plus (poids lissé selon le temps du clip)
  let q = armFix.q;
  if (armFix.wts) {
    const n = armFix.wts.length;
    const f = ((mixer._actions[0].time % armFix.dur) / armFix.dur) * n;
    const i0 = Math.floor(f) % n;
    const w = armFix.wts[i0] + (armFix.wts[(i0 + 1) % n] - armFix.wts[i0]) * (f - Math.floor(f));
    if (w > 0) q = _wq.copy(_mq.identity().slerp(armFix.qMouse, w)).multiply(armFix.q);
  }
  // rotation monde autour de l'articulation : local' = P⁻¹ · Q · P · local
  b.parent.getWorldQuaternion(_pq);
  _lq.copy(_pq).invert().multiply(q).multiply(_pq);
  b.quaternion.premultiply(_lq);
  (armFix.applied ||= new THREE.Quaternion()).copy(b.quaternion);
}

function fitCharacter(model) {
  const bones = {};
  model.traverse((o) => {
    if (!o.isBone) return;
    const k = o.name.toLowerCase().replace(/^mixamorig\d*:?/, '');
    if (!bones[k]) bones[k] = o;
  });
  const fingers = ['index', 'middle', 'ring', 'pinky'];
  const need = ['hips', 'rightforearm', 'lefthand', 'righthand'];
  ['left', 'right'].forEach((s) => fingers.forEach((f) => need.push(s + 'hand' + f + '1', s + 'hand' + f + '4')));
  if (need.some((k) => !bones[k])) return;

  const V = () => new THREE.Vector3();
  const tmp = V();
  const pos = (k, out = V()) => bones[k].getWorldPosition(out);
  // bout des doigts qui frappent (index + majeur)
  const tipOf = (side, out) => pos(side + 'handindex4', out).add(pos(side + 'handmiddle4', tmp)).multiplyScalar(0.5);
  const N = 240;
  const clip = mixer._actions[0].getClip();
  const L = V();
  const R = V();
  // parcourt l'animation ; typing = la main droite tape (sinon elle est sur la souris)
  const sample = (fn) => {
    for (let i = 0; i < N; i++) {
      mixer.setTime((i / N) * clip.duration);
      model.updateMatrixWorld(true);
      applyArmFix();
      model.updateMatrixWorld(true);
      tipOf('left', L);
      tipOf('right', R);
      fn(R.x - L.x < 0.33);
    }
    mixer.setTime(0);
  };
  const pct = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length * p)];

  // 1) hauteur de frappe de chaque main, et direction coude → doigts droits
  const yL = [];
  const yR = [];
  const armVec = V();
  sample((typing) => {
    yL.push(L.y);
    if (typing) {
      yR.push(R.y);
      armVec.add(R.clone().sub(pos('rightforearm', tmp)));
    }
  });
  const dropR = pct(yR, 0.15) - pct(yL, 0.15); // de combien la main droite frappe plus haut
  armFix = { bone: bones.rightforearm, q: new THREE.Quaternion(), base: new THREE.Quaternion(), applied: null, wts: null };
  if (dropR > 0.005 && yR.length) {
    const from = armVec.clone().normalize();
    const to = armVec.clone().divideScalar(yR.length).add(new THREE.Vector3(0, -dropR, 0)).normalize();
    armFix.q.setFromUnitVectors(from, to);
  }

  // 2) mesures avec la correction : bassin, frappe, étendue des mains, paume sur la souris
  const hip = V();
  const typeZ = [];
  const yAll = [];
  let spanL = 0;
  let spanR = 0;
  let nL = 0;
  let nR = 0;
  const knuckles = (side, out) => {
    out.set(0, 0, 0);
    fingers.forEach((f) => out.add(pos(side + 'hand' + f + '1', tmp)));
    return out.divideScalar(4);
  };
  const K = V();
  const W = V();
  const track = [];
  sample((typing) => {
    hip.add(pos('hips', tmp));
    yAll.push(L.y);
    typeZ.push(L.z);
    spanL += pos('lefthandpinky4', tmp).x; // bord extérieur de la main gauche
    nL++;
    if (typing) {
      yAll.push(R.y);
      typeZ.push(R.z);
      spanR += pos('righthandpinky4', tmp).x;
      nR++;
    }
    // centre de la paume droite : entre le poignet et les jointures, côté jointures.
    // Main sur la souris = paume bien à droite de la main gauche (pas un simple écart).
    knuckles('right', K);
    pos('righthand', W);
    const p = W.clone().lerp(K, 0.75);
    const on = p.x - L.x > 0.4;
    track.push({ on, x: p.x, z: p.z, rot: 0, ev: p.clone().sub(pos('rightforearm', tmp)) });
  });
  hip.divideScalar(N);
  const strikeY = pct(yAll, 0.15);
  const handsX = (spanL / nL + (nR ? spanR / nR : spanL / nL + 0.3)) / 2;
  const handsZ = typeZ.reduce((a, b) => a + b, 0) / typeZ.length;

  // décalage : bassin centré et un peu reculé, doigts qui effleurent le dessus des touches (≈ 0.797)
  const HIP_Z = 0.1;
  const KEY_TOP = 0.805;
  const offset = new THREE.Vector3(-hip.x, KEY_TOP - strikeY, HIP_Z - hip.z);
  model.position.add(offset);
  model.updateMatrixWorld(true);

  // doigts entre la rangée QWERTY et la rangée de repos (≈ 1 cm devant le centre des touches)
  const kbX = handsX + offset.x;
  const kbZ = THREE.MathUtils.clamp(handsZ + offset.z + 0.008, -0.62, -0.4);
  world.placeKeyboard(kbX, kbZ);
  // 3) souris. Instants « main posée dessus » : paume bien à droite et presque immobile
  // (la main qui arrive ou repart va vite).
  const dtS = clip.duration / N;
  track.forEach((t, i) => {
    const a = track[(i + N - 1) % N];
    const c = track[(i + 1) % N];
    t.on = t.on && Math.hypot(c.x - a.x, c.z - a.z) / (2 * dtS) < 0.25;
  });
  let shape = null;
  if (track.some((t) => t.on)) {
    // a) sur ces instants, la main descend encore un peu (poids lissé sur ±0,3 s)
    const MOUSE_DROP = 0.016;
    const wts = new Float32Array(N);
    const ev = V();
    track.forEach((t, i) => {
      let w = 0;
      for (let k = -4; k <= 4; k++) w += track[(i + k + N) % N].on ? 1 : 0;
      wts[i] = w / 9;
      if (t.on) ev.add(t.ev);
    });
    armFix.qMouse = new THREE.Quaternion().setFromUnitVectors(
      ev.clone().normalize(),
      ev.clone().normalize().multiplyScalar(ev.length() / track.filter((t) => t.on).length).add(new THREE.Vector3(0, -MOUSE_DROP, 0)).normalize()
    );
    armFix.wts = wts;
    armFix.dur = clip.duration;

    // b) nouvelle mesure, main rabaissée : centre et axe de la paume, et dessous de la main
    // (sommets de la peau liés à la main droite), dans le repère de la paume
    const skin = [];
    model.traverse((o) => {
      if (!o.isSkinnedMesh || skin.length) return;
      const handBones = new Set();
      o.skeleton.bones.forEach((bn, i) => /righthand/i.test(bn.name) && handBones.add(i));
      const si = o.geometry.attributes.skinIndex;
      const sw = o.geometry.attributes.skinWeight;
      const idx = [];
      for (let i = 0; i < si.count; i++) {
        let w = 0;
        for (let k = 0; k < 4; k++) if (handBones.has(si.getComponent(i, k))) w += sw.getComponent(i, k);
        if (w > 0.5) idx.push(i);
      }
      if (idx.length > 100) skin.push(o, idx);
    });
    const under = {}; // tranche (cm le long de la paume) → hauteurs minimales sous la main
    const F = V();
    const S = V();
    const vtx = V();
    let i = 0;
    sample(() => {
      const t = track[i];
      knuckles('right', K);
      pos('righthand', W);
      const p = W.clone().lerp(K, 0.75);
      t.x = p.x;
      t.z = p.z;
      t.rot = Math.atan2(-(K.x - W.x), -(K.z - W.z));
      if (t.on && skin.length && i % 3 === 0) {
        const [mesh, idx] = skin;
        F.set(K.x - W.x, 0, K.z - W.z).normalize();
        S.set(-F.z, 0, F.x);
        const low = {};
        idx.forEach((j) => {
          mesh.getVertexPosition(j, vtx).applyMatrix4(mesh.matrixWorld);
          const dx = vtx.x - p.x;
          const dz = vtx.z - p.z;
          if (Math.abs(dx * S.x + dz * S.z) > 0.025) return; // bande centrale de la main
          const b = Math.round((dx * F.x + dz * F.z) * 100);
          low[b] = Math.min(low[b] ?? 9, vtx.y - DESK_Y);
        });
        Object.entries(low).forEach(([b, y]) => (under[b] ||= []).push(y));
      }
      i++;
    });

    // c) profil de la souris : sous la main, 3 mm de jeu, de l'arrière de la paume jusqu'à
    // l'endroit où les doigts replient vers le bureau
    const prof = (b) => (under[b] ? pct(under[b], 0.2) : null);
    const ref = prof(0) ?? 0.045;
    let front = 6;
    for (let b = 2; b <= 7; b++) {
      const y = prof(b);
      if (y !== null && y < 0.72 * ref) {
        front = b - 0.5;
        break;
      }
    }
    const uF = THREE.MathUtils.clamp(front / 100, 0.035, 0.065);
    const uR = Math.max(-0.075, uF - 0.13);
    const length = uF - uR;
    const heights = [0, 0.25, 0.5, 0.75, 1].map((k) => {
      const b = Math.round((uR + k * length) * 100);
      const ys = [b - 1, b, b + 1].map(prof).filter((y) => y !== null);
      return THREE.MathUtils.clamp((ys.length ? Math.min(...ys) : ref) - 0.003, 0.018, 0.05);
    });
    shape = { length, width: 0.066, heights };
    world.shapeMouse(shape);

    // d) trajectoire : centre de la souris sous la paume quand la main est dessus, sinon la
    // dernière position lâchée (deux tours pour que le début de boucle reprenne la fin)
    const uc = (uR + uF) / 2;
    const path = new Float32Array(N * 3);
    let last = null;
    for (let pass = 0; pass < 2; pass++) {
      track.forEach((t, k) => {
        if (t.on) last = t;
        if (pass && last) path.set([last.x - Math.sin(last.rot) * uc, last.z - Math.cos(last.rot) * uc, last.rot], k * 3);
      });
    }
    mouseTrack = { path, n: N, dur: clip.duration, x: path[0], z: path[1], rot: path[2] };
    world.placeMouse(path[0], path[1], path[2]);
  }

  const hipAfter = hip.clone().add(offset);
  if (new URLSearchParams(location.search).has('debug')) {
    window.__fit = { dropR, strikeY, hipAfter: hipAfter.toArray(), kb: [kbX, kbZ], shape, track: mouseTrack, model, mixer };
  }
  // l'assise de la chaise suit la hauteur du bassin (dessus de l'assise ≈ 0.52 m par défaut)
  const seatTop = 0.52;
  world.chair.position.y = THREE.MathUtils.clamp(hipAfter.y - 0.09 - seatTop, -0.12, 0.12);
  world.chair.position.z = 0.3 + THREE.MathUtils.clamp(hipAfter.z - 0.3, -0.15, 0.15);
}
// Lampe de bureau : modèle Poly Haven (CC0), chargé sans bloquer l'affichage ; la lampe
// procédurale reste en place s'il ne se charge pas.
lampReq
  .then((g) => world.useLampModel(g.scene))
  .catch((err) => console.warn('Lampe 3D indisponible, lampe de secours utilisée', err));
setLoad(70, 'allumage des écrans');

/* ---------- Post-traitement (bloom) ---------- */
// Écrans non Retina : antialiasing MSAA dans le rendu intermédiaire (inutile au-delà de 1,5×)
const composer = new EffectComposer(
  renderer,
  new THREE.WebGLRenderTarget(window.innerWidth * pixelRatio, window.innerHeight * pixelRatio, {
    type: THREE.HalfFloatType,
    samples: pixelRatio < 1.5 ? 4 : 0,
  })
);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.6, 0.82);
// bloom calculé en demi-résolution : flou par nature, la différence ne se voit pas
const bloomSetSize = bloom.setSize.bind(bloom);
bloom.setSize = (w, h) => bloomSetSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
bloom.setSize(window.innerWidth * pixelRatio, window.innerHeight * pixelRatio);
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

let lastT = 0;
let frameNo = 0;
function frame() {
  const t = clock.getElapsedTime();
  const deltaT = Math.min(0.1, t - lastT);
  lastT = t;
  world.update(t);
  if (mixer) {
    mixer.update(deltaT);
    applyArmFix();
    updateMouse(deltaT);
  }
  Object.values(screens).forEach((s) => s.update(t));
  renderer.shadowMap.needsUpdate = frameNo++ % 2 === 0;

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
  // fenêtres HTML dans les moniteurs : seulement quand l'une d'elles peut être affichée
  if (state.inScreen && state.mode !== 'home') cssRenderer.render(cssScene, camera);
}

/* ---------- Cadence : rendu à la demande ---------- */
// 60 i/s quand quelque chose bouge (caméra, souris, tactile, défilement des cartes),
// 30 i/s au repos, 20 si la fenêtre n'a pas le focus, 10 derrière le panneau téléphone.
// Jamais plus de 60 (écrans 120 Hz), et rien quand l'onglet est caché (rAF s'arrête).
let lastInput = -1e9;
const poke = () => (lastInput = performance.now());
['pointermove', 'pointerdown', 'wheel', 'touchstart', 'touchmove', 'keydown'].forEach((ev) =>
  window.addEventListener(ev, poke, { passive: true })
);
cards.addEventListener('scroll', poke, { passive: true });
let focused = document.hasFocus();
window.addEventListener('focus', () => (focused = true));
window.addEventListener('blur', () => (focused = false));
function targetFps(now) {
  if (state.tween) return 60;
  if (phone && state.mode === 'inside') return 10;
  if (now - lastInput < 2000) return 60;
  return focused ? 30 : 20;
}

// Résolution adaptative : si, en visant 60 i/s, la moyenne reste nettement en dessous,
// on baisse la résolution par paliers (jusqu'à 1×).
let lastFrame = 0;
let slowSum = 0;
let slowN = 0;
function adaptResolution(interval, fps) {
  if (fps !== 60 || interval > 250 || document.hidden || !focused) return;
  slowSum += interval;
  if (++slowN < 45) return;
  const avg = slowSum / slowN;
  slowSum = slowN = 0;
  if (avg > 1000 / 42 && pixelRatio > 1) {
    pixelRatio = Math.max(1, pixelRatio - 0.25);
    renderer.setPixelRatio(pixelRatio);
    composer.setPixelRatio(pixelRatio);
  }
}
function loop(now) {
  requestAnimationFrame(loop);
  const fps = targetFps(now);
  const interval = now - lastFrame;
  if (interval < 1000 / fps - 3) return;
  lastFrame = now;
  adaptResolution(interval, fps);
  frame();
}

// Outil de mise au point : ?debug expose la caméra dans la console
if (new URLSearchParams(location.search).has('debug')) window.__dbg = { camera, camPos, camTarget, state, renderer, get pixelRatio() { return pixelRatio; }, get frames() { return frameNo; } };

selectPhone('profil', false);
// place la carte « Profil » au centre dès le départ, sans animation
{
  const el = cardEls.find((c) => c.dataset.screen === 'profil');
  cards.scrollLeft = el.offsetLeft - (cards.clientWidth - el.clientWidth) / 2;
}
setLoad(100, 'ready');
requestAnimationFrame(loop);
setTimeout(() => {
  $('#loader').classList.add('done');
  tweenCamera(home.pos.clone(), home.target.clone(), 2600, () => {
    state.mode = 'home';
  });
}, 500);
