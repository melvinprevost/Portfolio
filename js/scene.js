// Construction du bureau de nuit : pièce, bureau, 3 écrans, chaise, personnage de dos, décor.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { neonTexture, cityTexture } from './screens.js?v=34';

const DESK_TOP = 0.76; // dessus du plateau du bureau
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...opts });

function box(w, h, d, material, r = 0) {
  const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Souris ergonomique, origine au centre de sa base, avant vers -z. Le corps est une sphère
// déformée : longueur, largeur et profil de hauteur (de l'arrière vers l'avant) réglables pour
// épouser le dessous de la main du personnage. Deux boutons séparés par une rainure, molette,
// liseré lumineux à la base.
function buildMouse(group, { length = 0.12, width = 0.064, heights = [0.03, 0.037, 0.04, 0.036, 0.026] } = {}) {
  group.children.slice().forEach((c) => {
    group.remove(c);
    c.geometry.dispose();
  });
  const n = heights.length - 1;
  const H = (t) => {
    const f = THREE.MathUtils.clamp(t, 0, 1) * n;
    const i = Math.min(n - 1, Math.floor(f));
    const k = f - i;
    return heights[i] + (heights[i + 1] - heights[i]) * k * k * (3 - 2 * k);
  };
  const halfW = (t) => (width / 2) * (0.84 + 0.16 * Math.sin(Math.PI * Math.min(1, t * 1.15)));
  const BASE = 0.003;
  // dessus de la ligne médiane à l'abscisse t (0 = arrière, 1 = avant)
  const topAt = (t) => {
    const z = 1 - 2 * t;
    return BASE + H(t) * Math.pow(Math.max(0, 1 - z * z), 0.22);
  };

  const geo = new THREE.SphereGeometry(1, 56, 36);
  geo.rotateX(Math.PI / 2); // pôles sur l'axe z
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const t = (1 - z) / 2;
    const e = Math.pow(r, 0.22); // extrémités arrondies mais franches
    const sx = r > 1e-4 ? x / r : 0;
    const sy = r > 1e-4 ? y / r : 0;
    const X = sx * e * halfW(t) * (1.08 - 0.08 * (1 - Math.abs(sy)));
    const Y = sy > 0 ? BASE + Math.pow(sy, 0.75) * e * H(t) : BASE * (1 + sy);
    p.setXYZ(i, X, Y, (z * length) / 2);
  }
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, mat('#15171f', { roughness: 0.32, metalness: 0.15 }));
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // liseré lumineux : copie aplatie et légèrement élargie du corps, à la base
  const rim = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#7c5cff', toneMapped: false }));
  rim.scale.set(1.035, 0.09, 1.02);
  group.add(rim);

  // rainure entre les deux boutons, sur la moitié avant
  const groove = [];
  for (let t = 0.5; t <= 0.97; t += 0.035) groove.push(new THREE.Vector3(0, topAt(t) + 0.0004, (length / 2) * (1 - 2 * t)));
  const grooveMesh = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(groove), 24, 0.0009, 6),
    mat('#05060a', { roughness: 0.8 })
  );
  group.add(grooveMesh);

  // molette
  const tw = 0.7;
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.0065, 20), mat('#2a2d38', { roughness: 0.6 }));
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(0, topAt(tw) - 0.003, (length / 2) * (1 - 2 * tw));
  group.add(wheel);
}

// Cylindre de rayon r tendu entre deux points (membres du personnage).
const UP = new THREE.Vector3(0, 1, 0);
function makeLimb(r, material) {
  const geo = new THREE.CylinderGeometry(r, r * 0.92, 1, 14);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  return m;
}
const _dir = new THREE.Vector3();
function setLimb(mesh, a, b) {
  _dir.subVectors(b, a);
  const len = _dir.length();
  mesh.position.copy(a).addScaledVector(_dir, 0.5);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(UP, _dir.normalize());
}
function joint(r, material) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), material);
  m.castShadow = true;
  return m;
}

// Texture « molleton / jersey » générée : fines côtes verticales + grain + légères bouloches.
// Utilisée comme couleur (map) et relief (bumpMap) pour que le sweat paraisse en tissu.
function fabricTexture(kind = 'fleece') {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let v;
      if (kind === 'rib') {
        // bord-côte : côtes verticales marquées
        const rib = 0.5 + 0.5 * Math.sin((x * Math.PI * 2) / 5);
        v = 190 + rib * 40 + (Math.random() - 0.5) * 18;
      } else {
        // molleton : grain très fin et doux, sans motif tricoté
        v = 228 + (Math.random() - 0.5) * 26;
      }
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, v));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (kind !== 'rib') {
    // légères variations de teinte (tissu un peu porté)
    for (let k = 0; k < 160; k++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.035})`;
      ctx.beginPath();
      ctx.arc(Math.random() * S, Math.random() * S, 6 + Math.random() * 22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(kind === 'rib' ? 8 : 3, kind === 'rib' ? 2 : 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ============================================================ */

export function buildScene(scene, screens, { lowPower = false } = {}) {
  const updaters = [];

  /* ---------- Pièce ---------- */
  const wallMat = mat('#141a2e', { roughness: 0.95 });
  const floorMat = mat('#1a130f', { roughness: 0.6 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.4), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 1.1);
  floor.receiveShadow = true;
  scene.add(floor);
  // lattes du parquet
  for (let i = -8; i <= 8; i++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.004, 4.4), new THREE.MeshBasicMaterial({ color: '#0d0907' }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(i * 0.2, 0.001, 1.1);
    scene.add(line);
  }

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.4), mat('#0c1020'));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 2.7, 1.1);
  scene.add(ceiling);

  const back = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.7), wallMat);
  back.position.set(0, 1.35, -1.1);
  back.receiveShadow = true;
  scene.add(back);

  const right = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.7), wallMat);
  right.rotation.y = -Math.PI / 2;
  right.position.set(1.8, 1.35, 1.1);
  right.receiveShadow = true;
  scene.add(right);

  // Mur gauche percé d'une fenêtre (z -0.5 → 0.9, y 1.0 → 2.1)
  const lw = (z0, z1, y0, y1) => {
    const m = box(0.06, y1 - y0, z1 - z0, wallMat);
    m.position.set(-1.83, (y0 + y1) / 2, (z0 + z1) / 2);
    scene.add(m);
  };
  lw(-1.1, -0.5, 0, 2.7);
  lw(0.9, 3.3, 0, 2.7);
  lw(-0.5, 0.9, 0, 1.0);
  lw(-0.5, 0.9, 2.1, 2.7);

  const frameMat = mat('#0a0c14', { roughness: 0.5 });
  [[1.0], [2.1], [1.55]].forEach(([y]) => {
    const f = box(0.08, 0.04, 1.44, frameMat);
    f.position.set(-1.8, y, 0.2);
    scene.add(f);
  });
  [[-0.5], [0.9], [0.2]].forEach(([z]) => {
    const f = box(0.08, 1.14, 0.04, frameMat);
    f.position.set(-1.8, 1.55, z);
    scene.add(f);
  });
  const sill = box(0.22, 0.03, 1.5, mat('#1c2238'));
  sill.position.set(-1.74, 0.99, 0.2);
  scene.add(sill);

  const city = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.0), new THREE.MeshBasicMaterial({ map: cityTexture() }));
  city.rotation.y = Math.PI / 2;
  city.position.set(-3.4, 1.5, 0.2);
  scene.add(city);

  /* ---------- Bureau ---------- */
  const deskTopMat = mat('#2a1d15', { roughness: 0.45 });
  const metal = mat('#15171d', { roughness: 0.35, metalness: 0.7 });
  const desk = box(2.3, 0.04, 0.82, deskTopMat, 0.01);
  desk.position.set(0, 0.74, -0.66);
  scene.add(desk);
  [-1.05, 1.05].forEach((x) => {
    const leg = box(0.06, 0.72, 0.7, metal);
    leg.position.set(x, 0.36, -0.66);
    scene.add(leg);
  });

  // Clavier et tapis : un groupe centré sur le clavier, recalé sous les mains du personnage
  // (placeKeyboard) une fois l'animation mesurée. Position par défaut : (-0.06, -0.44).
  const kbGroup = new THREE.Group();
  kbGroup.position.set(-0.06, 0, -0.44);
  scene.add(kbGroup);
  const KX = 0.06; // décalages locaux : coordonnées d'origine + (KX, KZ)
  const KZ = 0.44;

  // Tapis de souris XXL
  const mat1 = box(1.0, 0.004, 0.36, mat('#0b0d14', { roughness: 0.9 }));
  mat1.position.set(0.05 + KX, 0.762, -0.42 + KZ);
  kbGroup.add(mat1);

  // Clavier
  const kb = box(0.44, 0.022, 0.14, mat('#101219', { roughness: 0.4 }), 0.006);
  kb.position.set(-0.06 + KX, 0.776, -0.44 + KZ);
  kbGroup.add(kb);
  const keyGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.12),
    new THREE.MeshBasicMaterial({ color: '#6d5dfc', transparent: true, opacity: 0.55 })
  );
  keyGlow.rotation.x = -Math.PI / 2;
  keyGlow.position.set(-0.06 + KX, 0.7878, -0.44 + KZ);
  kbGroup.add(keyGlow);
  updaters.push((t) => keyGlow.material.color.setHSL((0.7 + t * 0.03) % 1, 0.8, 0.55));

  // Touches : disposition type clavier (rangée de fonctions + 5 rangées, barre d'espace).
  // Une seule géométrie instanciée ; le rétroéclairage passe entre les touches.
  const layout = [
    { units: [1.4, ...Array(15).fill(1)], depth: 0.6 }, // Échap + F1 à F12 + 3 touches
    { units: [...Array(14).fill(1), 2] },
    { units: [1.5, ...Array(13).fill(1), 1.5] },
    { units: [1.75, ...Array(12).fill(1), 2.25] },
    { units: [2.25, ...Array(11).fill(1), 2.75] },
    { units: [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25] },
  ];
  const U = 0.0262; // pas d'une touche
  const keyCount = layout.reduce((n, r) => n + r.units.length, 0);
  const keyMat = mat('#1c1f29', { roughness: 0.55 });
  const keys = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.14), keyMat, keyCount);
  keys.castShadow = true;
  const kM = new THREE.Matrix4();
  const kQ = new THREE.Quaternion();
  const kP = new THREE.Vector3();
  const kS = new THREE.Vector3();
  const accentKey = new THREE.Color('#c4365a');
  const baseKey = new THREE.Color('#1c1f29');
  let ki = 0;
  layout.forEach((row, r) => {
    const total = row.units.reduce((a, b) => a + b, 0);
    let x = -0.06 + KX - (total * U) / 2;
    const z = -0.495 + KZ + r * 0.0212 + (r === 0 ? 0.002 : 0.005);
    row.units.forEach((u, c) => {
      kP.set(x + (u * U) / 2, 0.7925, z);
      kS.set(u * U - 0.0045, 0.0075, (row.depth || 1) * 0.0172);
      kM.compose(kP, kQ, kS);
      keys.setMatrixAt(ki, kM);
      keys.setColorAt(ki, r === 0 && c === 0 ? accentKey : baseKey); // Échap en couleur
      x += u * U;
      ki++;
    });
  });
  keys.instanceMatrix.needsUpdate = true;
  keys.instanceColor.needsUpdate = true;
  kbGroup.add(keys);

  // Souris
  const mouse = new THREE.Group();
  buildMouse(mouse);
  mouse.position.set(0.36, 0.764, -0.42);
  scene.add(mouse);

  /* ---------- Écrans ---------- */
  const SW = 0.62;
  const SH = 0.349;
  const monitorDefs = [
    { key: 'parcours', label: 'Parcours', pos: [-0.72, 0, -0.78], rotY: 0.5, color: '#38bdf8' },
    { key: 'profil', label: 'Profil', pos: [0, 0, -0.88], rotY: 0, color: '#4ade80' },
    { key: 'creavizione', label: 'CreaVizione', pos: [0.72, 0, -0.78], rotY: -0.5, color: '#c4365a' },
  ];
  const bezelMat = mat('#07080c', { roughness: 0.3, metalness: 0.4 });
  const monitors = monitorDefs.map((d) => {
    const g = new THREE.Group();
    g.position.set(...d.pos);
    g.rotation.y = d.rotY;

    const bezel = box(SW + 0.03, SH + 0.03, 0.03, bezelMat, 0.008);
    bezel.position.set(0, 1.1, 0);
    g.add(bezel);
    const backShell = box(SW * 0.7, SH * 0.7, 0.05, bezelMat, 0.02);
    backShell.position.set(0, 1.1, -0.035);
    g.add(backShell);
    const neck = box(0.05, 0.3, 0.03, metal);
    neck.position.set(0, 0.9, -0.06);
    g.add(neck);
    const foot = box(0.22, 0.012, 0.16, metal, 0.005);
    foot.position.set(0, 0.766, -0.04);
    g.add(foot);

    const screenMat = new THREE.MeshBasicMaterial({ map: screens[d.key].texture, toneMapped: false });
    screenMat.color.setScalar(0.92);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMat);
    screen.position.set(0, 1.1, 0.0161);
    screen.userData.key = d.key;
    g.add(screen);

    // Lumière diffusée par l'écran
    const light = new THREE.PointLight(d.color, 1.6, 2.6, 2);
    light.position.set(0, 1.1, 0.25);
    g.add(light);

    scene.add(g);
    return { ...d, group: g, screen, light, width: SW, height: SH };
  });

  // Bandeau LED derrière le bureau
  const led = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: '#7c5cff' }));
  led.position.set(0, 0.8, -1.09);
  scene.add(led);
  const ledLight = new THREE.PointLight('#7c5cff', 1.2, 2.2, 2);
  ledLight.position.set(0, 0.95, -1.0);
  scene.add(ledLight);
  updaters.push((t) => {
    const c = new THREE.Color().setHSL((0.72 + Math.sin(t * 0.2) * 0.06) % 1, 0.85, 0.55);
    led.material.color.copy(c);
    ledLight.color.copy(c);
  });

  // Néon « Portfolio » au mur
  const neon = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.275),
    new THREE.MeshBasicMaterial({ map: neonTexture(), transparent: true, toneMapped: false })
  );
  neon.position.set(0, 1.86, -1.085);
  neon.material.color.setScalar(0.88); // garde la teinte violette sous le bloom
  scene.add(neon);
  const neonLight = new THREE.PointLight('#8b6cff', 1.6, 2.4, 2);
  neonLight.position.set(0, 1.86, -0.85);
  scene.add(neonLight);
  updaters.push((t) => {
    // petit grésillement occasionnel du néon
    const flick = Math.sin(t * 37) > 0.97 && Math.sin(t * 1.3) > 0.6 ? 0.35 : 1;
    neon.material.opacity = flick;
    neonLight.intensity = 1.6 * flick;
  });

  /* ---------- Lampe de bureau ---------- */
  const lamp = new THREE.Group();
  lamp.position.set(-1.1, 0.76, -0.4);
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 24), metal);
  lamp.add(lampBase);
  const a1 = makeLimb(0.008, metal);
  const a2 = makeLimb(0.008, metal);
  const p0 = new THREE.Vector3(0, 0.01, 0);
  const p1 = new THREE.Vector3(-0.02, 0.34, -0.04);
  const p2 = new THREE.Vector3(0.1, 0.44, -0.12);
  setLimb(a1, p0, p1);
  setLimb(a2, p1, p2);
  lamp.add(a1, a2);
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.1, 24, 1, true),
    mat('#1b1e27', { side: THREE.DoubleSide, metalness: 0.5, roughness: 0.4 })
  );
  shade.position.copy(p2);
  shade.rotation.z = -0.5;
  lamp.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffd9a0' }));
  bulb.position.copy(p2).add(new THREE.Vector3(0.01, -0.03, 0));
  lamp.add(bulb);
  scene.add(lamp);
  const lampLight = new THREE.SpotLight('#ffbf73', 4, 2.2, 0.9, 0.6, 2);
  lampLight.position.set(-1.0, 1.17, -0.52);
  lampLight.target.position.set(-0.7, 0.76, -0.4);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.setScalar(lowPower ? 256 : 512);
  lampLight.shadow.bias = -0.0008;
  scene.add(lampLight, lampLight.target);

  /* ---------- Tasse + vapeur ---------- */
  // mug creux : profil tourné (paroi de 3 mm, rebord arrondi, intérieur), café sombre et mat
  // posé dedans, sous le bord, pour ne pas renvoyer la lampe en plein dans le bloom
  const mugProfile = [
    [0.0, 0.0], [0.031, 0.0], [0.034, 0.003], [0.037, 0.06], [0.038, 0.093],
    [0.0375, 0.095], [0.036, 0.0955], [0.0348, 0.094], [0.0342, 0.06], [0.0315, 0.009], [0.0, 0.008],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const mugMat = mat('#7a756f', { roughness: 0.45 });
  const mug = new THREE.Mesh(new THREE.LatheGeometry(mugProfile, 40), mugMat);
  mug.position.set(-0.44, 0.7625, -0.31);
  mug.castShadow = true;
  mug.receiveShadow = true;
  scene.add(mug);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0065, 10, 20, Math.PI * 1.15), mugMat);
  handle.rotation.z = -Math.PI * 0.575;
  handle.position.set(-0.4045, 0.81, -0.31);
  handle.castShadow = true;
  scene.add(handle);
  const coffee = new THREE.Mesh(
    new THREE.CircleGeometry(0.0342, 32),
    new THREE.MeshPhysicalMaterial({ color: '#2a1308', roughness: 0.85, specularIntensity: 0.04 })
  );
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.set(-0.44, 0.7625 + 0.078, -0.31);
  scene.add(coffee);
  const steamMat = new THREE.MeshBasicMaterial({ color: '#9aa3b5', transparent: true, opacity: 0.0, depthWrite: false });
  const steam = [];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), steamMat.clone());
    scene.add(s);
    steam.push({ mesh: s, offset: i / 6 });
  }
  updaters.push((t) => {
    steam.forEach(({ mesh, offset }) => {
      const k = (t * 0.25 + offset) % 1;
      mesh.position.set(-0.44 + Math.sin(k * 8 + offset * 6) * 0.015, 0.86 + k * 0.22, -0.31);
      mesh.scale.setScalar(0.4 + k * 1.2);
      mesh.material.opacity = Math.sin(k * Math.PI) * 0.035;
    });
  });

  /* ---------- Plante ---------- */
  const plant = new THREE.Group();
  plant.position.set(1.0, 0.76, -0.88);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.13, 24), mat('#c9c2b5', { roughness: 0.8 }));
  pot.position.y = 0.065;
  pot.castShadow = true;
  plant.add(pot);
  const leafMat = mat('#1f5a35', { roughness: 0.6 });
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), leafMat);
    const a = (i / 9) * Math.PI * 2;
    leaf.scale.set(0.45, 1.6, 0.2);
    leaf.position.set(Math.cos(a) * 0.04, 0.2 + (i % 3) * 0.03, Math.sin(a) * 0.04);
    leaf.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5);
    leaf.castShadow = true;
    plant.add(leaf);
  }
  scene.add(plant);

  /* ---------- PC tour sous le bureau ---------- */
  const tower = box(0.22, 0.46, 0.46, mat('#0b0c12', { roughness: 0.3, metalness: 0.3 }), 0.01);
  tower.position.set(0.82, 0.23, -0.72);
  scene.add(tower);
  const fanMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
  [0.32, 0.14].forEach((y) => {
    const fan = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.006, 8, 32), fanMat);
    fan.rotation.y = Math.PI / 2;
    fan.position.set(0.705, y, -0.62);
    scene.add(fan);
  });
  updaters.push((t) => fanMat.color.setHSL((0.55 + t * 0.05) % 1, 0.9, 0.55));

  /* ---------- Étagère + livres (mur du fond, à droite) ---------- */
  const shelf = box(0.7, 0.025, 0.2, deskTopMat);
  shelf.position.set(1.25, 1.55, -1.0);
  scene.add(shelf);
  const bookColors = ['#a0122e', '#1e3a5f', '#d9d2c3', '#2d4a3e', '#3b2f5c', '#c4365a', '#16213a'];
  let bx = 0.95;
  for (let i = 0; i < 11; i++) {
    const h = 0.16 + Math.random() * 0.08;
    const w = 0.025 + Math.random() * 0.02;
    const b = box(w, h, 0.15, mat(bookColors[i % bookColors.length], { roughness: 0.8 }));
    b.position.set(bx + w / 2, 1.5625 + h / 2, -1.0);
    if (i === 10) b.rotation.z = 0.3;
    scene.add(b);
    bx += w + 0.004;
  }
  const shelf2 = box(0.7, 0.025, 0.2, deskTopMat);
  shelf2.position.set(-1.25, 1.62, -1.0);
  scene.add(shelf2);
  // petit serveur / switch sur l'étagère gauche (clin d'œil sys/réseaux)
  const sw = box(0.34, 0.05, 0.16, mat('#1a1d26', { metalness: 0.5, roughness: 0.4 }), 0.004);
  sw.position.set(-1.3, 1.66, -1.0);
  scene.add(sw);
  const portLeds = [];
  for (let i = 0; i < 8; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.002), new THREE.MeshBasicMaterial({ color: '#4ade80' }));
    l.position.set(-1.44 + i * 0.03, 1.665, -0.919);
    scene.add(l);
    portLeds.push(l);
  }
  updaters.push((t) => {
    portLeds.forEach((l, i) => {
      l.visible = Math.sin(t * (6 + i * 1.7) + i) > -0.3;
    });
  });

  // Cadre au mur de droite
  const frame = box(0.03, 0.5, 0.7, mat('#0a0b10'));
  frame.position.set(1.78, 1.55, 0.3);
  scene.add(frame);
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.42),
    new THREE.MeshStandardMaterial({ color: '#1e2a4a', emissive: '#0d1430', roughness: 0.9 })
  );
  art.rotation.y = -Math.PI / 2;
  art.position.set(1.76, 1.55, 0.3);
  scene.add(art);

  // Tapis
  const rug = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), mat('#1a2036', { roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.003, 0.25);
  rug.receiveShadow = true;
  scene.add(rug);

  /* ---------- Chaise ---------- */
  const chair = new THREE.Group();
  chair.position.set(0, 0, 0.3);
  const chairMat = mat('#16181f', { roughness: 0.55 });
  const chairAccent = mat('#a0122e', { roughness: 0.5 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const leg = makeLimb(0.018, metal);
    setLimb(leg, new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3));
    chair.add(leg);
    const wheel = joint(0.028, chairMat);
    wheel.position.set(Math.cos(a) * 0.3, 0.028, Math.sin(a) * 0.3);
    chair.add(wheel);
  }
  const gas = makeLimb(0.025, metal);
  setLimb(gas, new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(0, 0.44, 0));
  chair.add(gas);
  const seat = box(0.5, 0.08, 0.48, chairMat, 0.03);
  seat.position.set(0, 0.48, 0);
  chair.add(seat);
  const backrest = box(0.46, 0.56, 0.07, chairMat, 0.03);
  backrest.position.set(0, 0.86, 0.22);
  backrest.rotation.x = 0.1;
  chair.add(backrest);
  const stripe = box(0.06, 0.5, 0.072, chairAccent, 0.01);
  stripe.position.set(0, 0.86, 0.2215);
  stripe.rotation.x = 0.1;
  chair.add(stripe);
  const backPost = box(0.05, 0.4, 0.03, metal);
  backPost.position.set(0, 0.6, 0.24);
  chair.add(backPost);
  [-1, 1].forEach((s) => {
    const post = box(0.03, 0.18, 0.03, metal);
    post.position.set(s * 0.27, 0.6, 0.02);
    chair.add(post);
    const pad = box(0.07, 0.03, 0.26, chairMat, 0.012);
    pad.position.set(s * 0.27, 0.7, -0.02);
    chair.add(pad);
  });
  scene.add(chair);

  /* ---------- Personnage (Melvin, de dos) ---------- */
  // D'après photos : cheveux brun foncé ondulés et volumineux sur le dessus,
  // courts/dégradés sur les côtés et la nuque, oreilles visibles, carrure fine,
  // sweat à capuche basique (capuche relevée), pantalon marine, montre noire à gauche.
  const fabric = fabricTexture('fleece');
  const ribTex = fabricTexture('rib');
  const hoodie = mat('#3d404a', { roughness: 0.97, map: fabric, bumpMap: fabric, bumpScale: 0.35 });
  const hoodieRib = mat('#33363f', { roughness: 0.97, map: ribTex, bumpMap: ribTex, bumpScale: 1.2 });
  const hoodieInner = mat('#24262d', { roughness: 1, map: fabric, side: THREE.BackSide });
  const pants = mat('#1a2133', { roughness: 0.85 });
  const skin = mat('#c99a80', { roughness: 0.9 });
  const hairDark = mat('#2e1f16', { roughness: 0.82 });
  const shoeMat = mat('#e8e8ea', { roughness: 0.6 });
  const watchMat = mat('#0c0c0e', { roughness: 0.35, metalness: 0.4 });

  const person = new THREE.Group();
  scene.add(person);

  // Torse (sweat)
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.56, 0.3);
  person.add(torsoPivot);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.3, 8, 24), hoodie);
  torso.position.set(0, 0.33, 0);
  torso.castShadow = true;
  torsoPivot.add(torso);
  torsoPivot.rotation.x = -0.12;

  // Bord-côte en bas du sweat
  const waist = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.028, 10, 32), hoodieRib);
  waist.rotation.x = Math.PI / 2;
  waist.scale.set(1.32, 0.84, 1);
  waist.position.set(0, 0.1, 0);
  torsoPivot.add(waist);

  // Encolure : la capuche relevée descend jusqu'aux épaules et enveloppe la nuque
  const drape = new THREE.Mesh(
    new THREE.CylinderGeometry(0.098, 0.15, 0.18, 32, 1, true),
    mat('#3d404a', { roughness: 0.97, map: fabric, bumpMap: fabric, bumpScale: 0.35, side: THREE.DoubleSide })
  );
  drape.position.set(0, 0.63, 0.012);
  drape.rotation.x = -0.08;
  drape.scale.set(1.12, 1, 1.05);
  drape.castShadow = true;
  torsoPivot.add(drape);

  // Cou
  const neck = makeLimb(0.056, skin);
  setLimb(neck, new THREE.Vector3(0, 0.55, 0.0), new THREE.Vector3(0, 0.69, -0.018));
  torsoPivot.add(neck);

  // Tête
  const head = new THREE.Group();
  head.position.set(0, 0.765, -0.025);
  torsoPivot.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 24), skin);
  skull.scale.set(0.92, 1.12, 1.02);
  skull.castShadow = true;
  head.add(skull);
  // mâchoire légèrement marquée
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), skin);
  jaw.scale.set(1.05, 0.8, 1.05);
  jaw.position.set(0, -0.055, -0.018);
  head.add(jaw);
  // oreilles bien visibles, un peu décollées
  [-1, 1].forEach((s) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.023, 14, 10), skin);
    ear.scale.set(0.4, 1.05, 0.72);
    ear.position.set(s * 0.094, -0.008, 0.008);
    ear.rotation.y = s * -0.35;
    ear.castShadow = true;
    head.add(ear);
  });

  // ----- Cheveux (d'après photos) -----
  // Base courte : coque légèrement plus grande que le crâne, découpée selon une ligne
  // d'implantation réaliste (front haut, tempes, contour d'oreille, nuque basse).
  const rand = (() => {
    let seed = 11;
    return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  })();
  const hairline = (d) => {
    // y minimal (sur la sphère unité) où pousse le cheveu, selon la direction
    let h = -0.55 * d.z; // devant (z<0) : haut ; derrière (z>0) : bas
    if (d.z < -0.2 && Math.abs(d.x) < 0.55) h = Math.max(h, 0.42); // front
    if (Math.abs(d.x) > 0.72 && d.z < 0.35) h = Math.max(h, 0.16); // dégagé autour de l'oreille
    return h;
  };
  function cutSphere(radius, wSeg, hSeg, keep) {
    const g = new THREE.SphereGeometry(radius, wSeg, hSeg);
    const pos = g.attributes.position;
    const idx = g.index.array;
    const out = [];
    const c = new THREE.Vector3();
    const v = new THREE.Vector3();
    for (let i = 0; i < idx.length; i += 3) {
      c.set(0, 0, 0);
      for (let k = 0; k < 3; k++) c.add(v.fromBufferAttribute(pos, idx[i + k]));
      c.normalize();
      if (keep(c)) out.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    g.setIndex(out);
    return g;
  }
  const shortHair = new THREE.Mesh(cutSphere(0.1, 160, 110, (d) => d.y > hairline(d)), hairDark);
  shortHair.scale.set(0.92 * 1.05, 1.12 * 1.04, 1.02 * 1.05);
  shortHair.castShadow = true;
  head.add(shortHair);
  // dégradé : bande plus claire et plus fine juste au-dessus de la ligne (nuque, tempes)
  const fadeBand = new THREE.Mesh(
    cutSphere(0.1, 160, 110, (d) => d.y > hairline(d) && d.y < hairline(d) + 0.2 && d.z > -0.3),
    mat('#5a4134', { roughness: 0.95, transparent: true, opacity: 0.6 })
  );
  fadeBand.scale.set(0.92 * 1.053, 1.12 * 1.043, 1.02 * 1.053);
  head.add(fadeBand);

  // Dessus : plus long, ondulé, avec du volume (déborde un peu des côtés courts).
  // Sphère déformée par un bruit « boucles » + quelques boucles en arc sur le contour.
  const TA = 0.086, TB = 0.06, TC = 0.097;
  const tOrigin = new THREE.Vector3(0, 0.072, 0.004);
  const topGeo = new THREE.SphereGeometry(1, 96, 64);
  {
    const pos = topGeo.attributes.position;
    const v = new THREE.Vector3();
    const colors = [];
    const cA = new THREE.Color('#24170f');
    const cB = new THREE.Color('#5c3c27');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      // ondulations larges (vagues) + petites boucles
      const w =
        0.6 * Math.sin(v.x * 9 + v.z * 4 + 1.3) * Math.sin(v.z * 8 + 0.4) +
        0.5 * Math.sin(v.x * 21 + v.z * 13 + 0.7) * Math.sin(v.z * 19 - v.y * 11 + 1.9) +
        0.3 * Math.sin(v.x * 37 - v.z * 29) * Math.sin(v.y * 31 + v.z * 7);
      const k = 1 + 0.1 * w * THREE.MathUtils.smoothstep(v.y, -0.1, 0.5);
      pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
      const mix = THREE.MathUtils.clamp(0.35 + w * 0.45, 0, 1);
      const col = cA.clone().lerp(cB, mix * 0.7);
      colors.push(col.r, col.g, col.b);
    }
    topGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    topGeo.computeVertexNormals();
  }
  const topHair = new THREE.Mesh(topGeo, mat('#ffffff', { roughness: 0.82, vertexColors: true }));
  topHair.scale.set(TA, TB, TC);
  topHair.position.copy(tOrigin);
  topHair.castShadow = true;
  head.add(topHair);

  // ----- Capuche relevée -----
  // Ample (elle ne colle pas au crâne), avec la silhouette d'une vraie capuche :
  // vue de dos en « goutte » (étroite en haut, évasée vers les épaules), une pointe à
  // l'arrière du sommet là où les deux pans se rejoignent, un bord avant qui avance
  // devant le visage, l'arrière qui retombe sur la nuque et quelques grands plis en bas.
  const HC = new THREE.Vector3(0, 0.035, 0.02);
  const HR = new THREE.Vector3(0.12, 0.134, 0.13);
  const faceOpen = (d) => d.z < -0.12 && (d.x / 0.62) ** 2 + ((d.y + 0.14) / 0.74) ** 2 < 1;
  const deformHood = (v) => {
    const y0 = v.y;
    const z0 = v.z;
    v.x *= 1 - 0.2 * Math.max(0, y0) + 0.32 * Math.max(0, -y0 - 0.15); // goutte
    const crown = Math.max(0, y0 + 0.1) * Math.max(0, z0 + 0.1); // pointe arrière du sommet
    v.y += 0.07 * crown;
    v.z += 0.12 * crown;
    // arête le long de la couture centrale, à l'arrière
    v.z += 0.06 * Math.max(0, z0) * Math.max(0, 1 - Math.abs(v.x) * 3) * Math.max(0, y0 + 0.3);
    if (y0 < 0) {
      // l'arrière retombe vers les épaules en s'écartant de la nuque
      const b = Math.max(0, z0 + 0.3);
      v.z += 0.22 * b * -y0;
      v.y -= 0.1 * b * -y0;
    }
    v.z -= 0.22 * Math.max(0, -z0 - 0.45); // le bord avance devant le visage
    const fold = 0.018 * Math.sin(Math.atan2(v.x, v.z) * 3 + 0.8) * Math.max(0, -y0 - 0.4); // plis souples du bas
    v.x *= 1 + fold;
    v.z *= 1 + fold;
    return v;
  };
  const hoodGeo = cutSphere(1, 120, 80, (d) => d.y > -0.95 && !faceOpen(d));
  {
    const pos = hoodGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      deformHood(v.fromBufferAttribute(pos, i));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    hoodGeo.computeVertexNormals();
  }
  const hoodOuter = new THREE.Mesh(hoodGeo, hoodie);
  hoodOuter.scale.copy(HR);
  hoodOuter.position.copy(HC);
  hoodOuter.castShadow = true;
  head.add(hoodOuter);
  const hoodIn = new THREE.Mesh(hoodGeo, hoodieInner); // doublure plus sombre, vue par l'ouverture
  hoodIn.scale.copy(HR).multiplyScalar(0.965);
  hoodIn.position.copy(HC);
  head.add(hoodIn);

  const onHood = (d, k = 1) => deformHood(d.clone()).multiply(HR).multiplyScalar(k).add(HC);
  // ourlet autour de l'ouverture du visage
  const hemPts = [];
  for (let i = 0; i <= 40; i++) {
    const phi = -Math.PI / 2 + 0.42 + (i / 40) * (2 * Math.PI - 0.84);
    const dx = 0.62 * Math.cos(phi);
    const dy = -0.14 + 0.74 * Math.sin(phi);
    const dz = -Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
    hemPts.push(onHood(new THREE.Vector3(dx, dy, dz), 0.985));
  }
  const hem = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hemPts), 80, 0.013, 10, false), hoodieRib);
  hem.castShadow = true;
  head.add(hem);
  // couture centrale, du front jusqu'à la nuque
  const seamPts = [];
  for (let i = 0; i <= 24; i++) {
    const th = -0.85 + (i / 24) * 3.5;
    seamPts.push(onHood(new THREE.Vector3(0, Math.cos(th), Math.sin(th)), 1.012));
  }
  head.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seamPts), 80, 0.0035, 6, false), mat('#2a2c33', { roughness: 1 })));
  // cordons qui pendent de part et d'autre du visage
  const cordMat = mat('#d9d6cf', { roughness: 0.8 });
  [hemPts[0], hemPts[hemPts.length - 1]].forEach((p0) => {
    const cord = makeLimb(0.004, cordMat);
    const p1 = p0.clone().add(new THREE.Vector3(0, -0.13, -0.01));
    setLimb(cord, p0, p1);
    head.add(cord);
    const aglet = joint(0.006, mat('#9a9aa0', { roughness: 0.4, metalness: 0.6 }));
    aglet.scale.set(1, 2, 1);
    aglet.position.copy(p1);
    head.add(aglet);
  });

  // Bras (recalculés à chaque frame pour l'animation)
  const upperL = makeLimb(0.052, hoodie);
  const lowerL = makeLimb(0.045, hoodie);
  const upperR = makeLimb(0.052, hoodie);
  const lowerR = makeLimb(0.045, hoodie);
  const shoulderL = joint(0.064, hoodie);
  const shoulderR = joint(0.064, hoodie);
  const elbowL = joint(0.049, hoodie);
  const elbowR = joint(0.049, hoodie);
  const handSkin = mat('#b48a74', { roughness: 0.95 });
  // Main : paume + 4 doigts à deux phalanges + pouce. Repère local : -z = vers les doigts,
  // +y = dos de la main. side = -1 (gauche) ou +1 (droite).
  function makeHand(side) {
    const g = new THREE.Group();
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.066, 0.024, 0.078, 3, 0.01), handSkin);
    palm.position.set(0, 0, -0.036);
    palm.castShadow = true;
    g.add(palm);
    const fx = [-0.0235, -0.008, 0.0075, 0.0225]; // auriculaire → index
    const flen = [0.022, 0.028, 0.031, 0.028];
    const fingers = fx.map((x, i) => {
      const base = new THREE.Group();
      base.position.set(-side * x, -0.002, -0.074);
      const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0075, flen[i], 4, 8), handSkin);
      seg1.rotation.x = -Math.PI / 2;
      seg1.position.z = -flen[i] / 2;
      seg1.castShadow = true;
      base.add(seg1);
      const tip = new THREE.Group();
      tip.position.z = -flen[i];
      base.add(tip);
      const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, flen[i] * 0.65, 4, 8), handSkin);
      seg2.rotation.x = -Math.PI / 2;
      seg2.position.z = -flen[i] * 0.33;
      tip.add(seg2);
      g.add(base);
      return { base, tip };
    });
    const thumb = new THREE.Group();
    thumb.position.set(-side * -0.032, -0.006, -0.022);
    thumb.rotation.set(-0.25, side * 0.75, side * 0.3);
    const th1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, 0.024, 4, 8), handSkin);
    th1.rotation.x = -Math.PI / 2;
    th1.position.z = -0.012;
    thumb.add(th1);
    const th2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0078, 0.018, 4, 8), handSkin);
    th2.rotation.set(-Math.PI / 2 - 0.3, 0, 0);
    th2.position.set(0, -0.003, -0.032);
    thumb.add(th2);
    g.add(thumb);
    return { group: g, fingers };
  }
  const handL = makeHand(-1);
  const handR = makeHand(1);
  // poignets côtelés + montre noire au poignet gauche
  const cuffL = makeLimb(0.044, hoodieRib);
  const cuffR = makeLimb(0.044, hoodieRib);
  const wristL = makeLimb(0.028, skin);
  const wristR = makeLimb(0.028, skin);
  const watch = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.024, 20), watchMat);
  const watchFace = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.026), new THREE.MeshBasicMaterial({ color: '#111a22' }));
  person.add(upperL, lowerL, upperR, lowerR, shoulderL, shoulderR, elbowL, elbowR, handL.group, handR.group);
  person.add(cuffL, cuffR, wristL, wristR, watch, watchFace);

  // Jambes
  [-1, 1].forEach((s) => {
    const hip = new THREE.Vector3(s * 0.1, 0.57, 0.28);
    const knee = new THREE.Vector3(s * 0.13, 0.57, -0.12);
    const ankle = new THREE.Vector3(s * 0.14, 0.1, -0.1);
    const thigh = makeLimb(0.075, pants);
    setLimb(thigh, hip, knee);
    const shin = makeLimb(0.055, pants);
    setLimb(shin, knee, ankle);
    const kneeJ = joint(0.068, pants);
    kneeJ.position.copy(knee);
    const shoe = box(0.1, 0.07, 0.24, shoeMat, 0.03);
    shoe.position.set(s * 0.14, 0.04, -0.16);
    person.add(thigh, shin, kneeJ, shoe);
  });

  const sL = new THREE.Vector3();
  const sR = new THREE.Vector3();
  const eL = new THREE.Vector3();
  const eR = new THREE.Vector3();
  const hL = new THREE.Vector3();
  const hR = new THREE.Vector3();
  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _c = new THREE.Vector3();
  const _up = new THREE.Vector3();
  function placeHand(h, elbow, hand, side) {
    h.group.position.lerpVectors(elbow, hand, 0.93);
    const fx = hand.x - elbow.x;
    const fz = hand.z - elbow.z;
    h.group.rotation.set(0, Math.atan2(-fx, -fz), side * 0.12, 'YXZ');
  }
  const shoulderLocalL = new THREE.Vector3(-0.19, 0.5, 0.0);
  const shoulderLocalR = new THREE.Vector3(0.19, 0.5, 0.0);

  let characterModel = null; // modèle Mixamo : remplace ce personnage procédural une fois chargé
  updaters.push((t) => {
    if (characterModel) return;
    // respiration + légère oscillation
    const breath = Math.sin(t * 1.6) * 0.012;
    torso.scale.set(1.34 + breath * 0.5, 1 + breath, 0.84 + breath);
    torsoPivot.rotation.x = -0.12 + Math.sin(t * 0.4) * 0.015;
    torsoPivot.rotation.y = Math.sin(t * 0.23) * 0.03;
    // la tête regarde d'un écran à l'autre de temps en temps
    const look = Math.sin(t * 0.18) * 0.9;
    head.rotation.y = THREE.MathUtils.clamp(look, -0.25, 0.25);
    head.rotation.x = 0.08 + Math.sin(t * 0.7) * 0.02;

    torsoPivot.updateMatrixWorld();
    sL.copy(shoulderLocalL).applyMatrix4(torsoPivot.matrixWorld);
    sR.copy(shoulderLocalR).applyMatrix4(torsoPivot.matrixWorld);

    // main gauche : frappe au clavier ; main droite : souris
    const typing = Math.max(0, Math.sin(t * 14)) * 0.008 * (Math.sin(t * 0.9) > -0.2 ? 1 : 0);
    hL.set(-0.15 + Math.sin(t * 3.1) * 0.01, 0.824 + typing * 0.5, -0.35);
    hR.set(0.36 + Math.sin(t * 0.8) * 0.02, 0.812, -0.34 + Math.cos(t * 0.6) * 0.015);

    eL.set(-0.27, 0.9, 0.08);
    eR.set(0.3, 0.9, 0.1);

    setLimb(upperL, sL, eL);
    // avant-bras → poignet côtelé → poignet nu → main
    _a.lerpVectors(eL, hL, 0.74);
    _b.lerpVectors(eL, hL, 0.84);
    _c.lerpVectors(eL, hL, 0.93);
    setLimb(lowerL, eL, _a);
    setLimb(cuffL, _a, _b);
    setLimb(wristL, _b, _c);
    watch.position.lerpVectors(eL, hL, 0.88);
    watch.quaternion.copy(wristL.quaternion);
    watchFace.position.copy(watch.position).add(_up.set(0, 0.014, 0));
    watchFace.quaternion.copy(wristL.quaternion);
    setLimb(upperR, sR, eR);
    _a.lerpVectors(eR, hR, 0.74);
    _b.lerpVectors(eR, hR, 0.84);
    _c.lerpVectors(eR, hR, 0.93);
    setLimb(lowerR, eR, _a);
    setLimb(cuffR, _a, _b);
    setLimb(wristR, _b, _c);
    shoulderL.position.copy(sL);
    shoulderR.position.copy(sR);
    elbowL.position.copy(eL);
    elbowR.position.copy(eR);
    // mains : posées au bout du poignet, orientées dans l'axe de l'avant-bras
    placeHand(handL, eL, hL, -1);
    placeHand(handR, eR, hR, 1);
    // gauche : frappe ; droite : doigts sur la souris, clic de l'index de temps en temps
    handL.fingers.forEach((f, i) => {
      const tap = Math.max(0, Math.sin(t * 13 + i * 1.9)) * (Math.sin(t * 0.9) > -0.2 ? 0.35 : 0);
      f.base.rotation.x = -0.32 - tap;
      f.tip.rotation.x = -0.55;
    });
    handR.fingers.forEach((f, i) => {
      const click = i === 3 && Math.sin(t * 2.3) > 0.96 ? 0.12 : 0;
      f.base.rotation.x = -0.18 - click;
      f.tip.rotation.x = -0.4;
    });
    // la souris suit la paume droite
    _a.set(0, -0.026, -0.05).applyQuaternion(handR.group.quaternion).add(handR.group.position);
    mouse.position.set(_a.x, 0.764, _a.z);
    mouse.rotation.y = handR.group.rotation.y;
  });

  /* ---------- Lumières ---------- */
  const hemi = new THREE.HemisphereLight('#3d4d8f', '#0c080a', 0.78);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight('#8ea8ff', 1.3);
  moon.position.set(-4, 3.2, 0.6);
  moon.target.position.set(0.3, 0.6, 0.1);
  moon.castShadow = true;
  moon.shadow.mapSize.setScalar(lowPower ? 512 : 1024);
  // cadrée sur le bureau et la chaise : carte d'ombre plus petite pour la même netteté
  moon.shadow.camera.left = -1.8;
  moon.shadow.camera.right = 1.8;
  moon.shadow.camera.top = 1.8;
  moon.shadow.camera.bottom = -1.8;
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.02;
  scene.add(moon, moon.target);

  // contre-jour doux pour détacher la silhouette du personnage
  const rim = new THREE.PointLight('#6a7bff', 2.3, 3.5, 2);
  rim.position.set(0.6, 1.9, 1.6);
  scene.add(rim);

  return {
    monitors,
    occluders: [person, chair], // masqués quand la caméra doit passer à travers (mobile)
    chair,
    // Remplace le personnage procédural par un modèle importé (Mixamo)
    useCharacterModel(model) {
      characterModel = model;
      person.visible = false;
      this.occluders[0] = model;
    },
    // Recale le clavier (centre des touches) et la souris sous les mains mesurées
    placeKeyboard(x, z) {
      kbGroup.position.set(x, 0, z);
    },
    // Remplace la lampe procédurale par un modèle importé (Poly Haven « Desk Lamp Arm 01 », CC0) :
    // mise à l'échelle, posée sur le bureau, tête tournée vers le plan de travail, et spot
    // recalé sous l'ampoule.
    useLampModel(model, { scale = 0.62, x = -1.08, z = -0.8 } = {}) {
      lamp.visible = false;
      model.scale.setScalar(scale);
      // pince au bord gauche du bureau, à côté de l'écran Parcours ; la tête (vers -z dans le
      // modèle) avance vers l'avant du bureau, au-dessus du plan de travail
      model.rotation.y = Math.PI;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      model.position.x += x - (box.min.x + box.max.x) / 2;
      model.position.z += z - box.min.z;
      model.position.y += DESK_TOP - box.min.y;
      let bulbMesh = null;
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        if (/light/i.test(o.material.name)) {
          bulbMesh = o;
          o.castShadow = false; // l'ampoule ne doit pas masquer son propre spot
          o.material.emissiveIntensity = 1.4;
        }
      });
      scene.add(model);
      model.updateMatrixWorld(true);
      if (bulbMesh) {
        const c = new THREE.Box3().setFromObject(bulbMesh).getCenter(new THREE.Vector3());
        lampLight.position.copy(c).add(new THREE.Vector3(0, -0.025, 0));
      }
      this.lampModel = model;
    },
    // forme de la souris (longueur, largeur, profil de hauteur arrière → avant), en mètres
    shapeMouse(shape) {
      buildMouse(mouse, shape);
    },
    placeMouse(x, z, rotY = 0) {
      mouse.position.set(x, 0.764, z);
      mouse.rotation.y = rotY;
    },
    update(t) {
      updaters.forEach((fn) => fn(t));
    },
  };
}
