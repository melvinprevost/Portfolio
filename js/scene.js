// Construction du bureau de nuit : pièce, bureau, 3 écrans, chaise, personnage de dos, décor.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { neonTexture, cityTexture } from './screens.js';

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...opts });

function box(w, h, d, material, r = 0) {
  const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
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

/* ============================================================ */

export function buildScene(scene, screens) {
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

  // Tapis de souris XXL
  const mat1 = box(1.0, 0.004, 0.36, mat('#0b0d14', { roughness: 0.9 }));
  mat1.position.set(0.05, 0.762, -0.42);
  scene.add(mat1);

  // Clavier
  const kb = box(0.44, 0.022, 0.14, mat('#101219', { roughness: 0.4 }), 0.006);
  kb.position.set(-0.06, 0.776, -0.44);
  scene.add(kb);
  const keyGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.12),
    new THREE.MeshBasicMaterial({ color: '#6d5dfc', transparent: true, opacity: 0.55 })
  );
  keyGlow.rotation.x = -Math.PI / 2;
  keyGlow.position.set(-0.06, 0.788, -0.44);
  scene.add(keyGlow);
  updaters.push((t) => keyGlow.material.color.setHSL((0.7 + t * 0.03) % 1, 0.8, 0.55));

  // Souris
  const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.035, 20, 14), mat('#101219', { roughness: 0.35 }));
  mouse.scale.set(0.9, 0.45, 1.4);
  mouse.position.set(0.36, 0.774, -0.42);
  mouse.castShadow = true;
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

  // Néon CreaVizione au mur
  const neon = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.275),
    new THREE.MeshBasicMaterial({ map: neonTexture(), transparent: true, toneMapped: false })
  );
  neon.position.set(0, 1.86, -1.085);
  scene.add(neon);
  const neonLight = new THREE.PointLight('#ff2a55', 1.4, 2.4, 2);
  neonLight.position.set(0, 1.86, -0.85);
  scene.add(neonLight);
  updaters.push((t) => {
    // petit grésillement occasionnel du néon
    const flick = Math.sin(t * 37) > 0.97 && Math.sin(t * 1.3) > 0.6 ? 0.35 : 1;
    neon.material.opacity = flick;
    neonLight.intensity = 1.4 * flick;
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
  lampLight.shadow.mapSize.set(1024, 1024);
  lampLight.shadow.bias = -0.0008;
  scene.add(lampLight, lampLight.target);

  /* ---------- Tasse + vapeur ---------- */
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.034, 0.095, 24), mat('#8f8a84', { roughness: 0.4 }));
  mug.position.set(-0.44, 0.81, -0.31);
  mug.castShadow = true;
  scene.add(mug);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.007, 8, 16), mug.material);
  handle.position.set(-0.40, 0.815, -0.31);
  scene.add(handle);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.034, 20), mat('#2b170c', { roughness: 0.2 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.set(-0.44, 0.85, -0.31);
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
  // sweat à capuche basique (capuche baissée), pantalon marine, montre noire à gauche.
  const hoodie = mat('#33363f', { roughness: 0.92 });
  const hoodieRib = mat('#23262d', { roughness: 0.95 });
  const hoodieInner = mat('#1b1d23', { roughness: 0.95, side: THREE.DoubleSide });
  const pants = mat('#1a2133', { roughness: 0.85 });
  const skin = mat('#c99a80', { roughness: 0.9 });
  const hairDark = mat('#24170f', { roughness: 0.9 });
  const hairWarm = mat('#3a2516', { roughness: 0.85 });
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

  // Col du sweat autour de la nuque
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.026, 12, 28), hoodie);
  collar.rotation.x = Math.PI / 2 - 0.15;
  collar.scale.set(1.1, 1, 1);
  collar.position.set(0, 0.6, 0.01);
  torsoPivot.add(collar);

  // Capuche baissée, posée à plat sur le haut du dos
  const hoodShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    hoodie
  );
  hoodShell.material = hoodie.clone();
  hoodShell.material.side = THREE.DoubleSide;
  hoodShell.rotation.x = Math.PI / 2 - 0.35;
  hoodShell.scale.set(1.12, 0.42, 1.0);
  hoodShell.position.set(0, 0.5, 0.11);
  hoodShell.castShadow = true;
  torsoPivot.add(hoodShell);
  // ourlet de la capuche (bord légèrement épais)
  const hoodRim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.014, 8, 36), hoodieRib);
  hoodRim.rotation.copy(hoodShell.rotation);
  hoodRim.rotation.x -= Math.PI / 2;
  hoodRim.scale.set(1.12, 1.0, 1);
  hoodRim.position.copy(hoodShell.position);
  torsoPivot.add(hoodRim);
  // intérieur sombre de la capuche, visible depuis la caméra en hauteur
  const hoodInside = new THREE.Mesh(new THREE.CircleGeometry(0.12, 28), hoodieInner);
  hoodInside.rotation.copy(hoodRim.rotation);
  hoodInside.scale.set(1.1, 0.95, 1);
  hoodInside.position.copy(hoodShell.position).add(new THREE.Vector3(0, 0, -0.004));
  torsoPivot.add(hoodInside);

  // Cou
  const neck = makeLimb(0.05, skin);
  setLimb(neck, new THREE.Vector3(0, 0.55, 0.0), new THREE.Vector3(0, 0.71, -0.015));
  torsoPivot.add(neck);

  // Tête
  const head = new THREE.Group();
  head.position.set(0, 0.785, -0.025);
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
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.028, 14, 10), skin);
    ear.scale.set(0.42, 1.1, 0.78);
    ear.position.set(s * 0.094, -0.008, 0.008);
    ear.rotation.y = s * -0.35;
    ear.castShadow = true;
    head.add(ear);
  });

  // Cheveux, base courte : calotte inclinée vers l'arrière (plus basse sur la nuque,
  // plus haute sur le front), légèrement plus large que le crâne.
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.56), hairDark);
  cap.scale.set(0.97, 1.14, 1.07);
  cap.rotation.x = 0.42;
  cap.position.set(0, 0.004, 0.002);
  cap.castShadow = true;
  head.add(cap);
  // dégradé : fine bande de cheveux très courts sous la calotte, à l'arrière
  const fade = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 36, 12, Math.PI * 0.2, Math.PI * 0.6, Math.PI * 0.5, Math.PI * 0.16),
    mat('#4a3528', { roughness: 0.95, transparent: true, opacity: 0.55 })
  );
  fade.scale.set(0.935, 1.13, 1.035);
  fade.rotation.y = 0;
  head.add(fade);

  // Dessus : boucles volumineuses et en désordre, qui débordent un peu vers l'avant.
  const rand = (() => {
    let seed = 7;
    return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  })();
  const N = 260;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const dir = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    // zone « dessus » : haut du crâne + frange avant, pas les côtés ni la nuque
    const top = dir.y > 0.55 || (dir.y > 0.3 && dir.z < -0.1 && Math.abs(dir.x) < 0.7);
    if (!top) continue;
    const size = 0.02 + rand() * 0.014;
    const curl = new THREE.Mesh(new THREE.SphereGeometry(size, 9, 7), rand() < 0.35 ? hairWarm : hairDark);
    const lift = 1.02 + rand() * 0.09;
    curl.position.set(dir.x * 0.098 * lift, dir.y * 0.114 * lift + 0.006, dir.z * 0.105 * lift - 0.006);
    curl.scale.set(1.15, 0.55 + rand() * 0.25, 1.15);
    curl.rotation.set(rand() * 0.8, rand() * 3, rand() * 0.8);
    curl.castShadow = true;
    head.add(curl);
  }
  // quelques mèches qui retombent sur le front
  for (let i = 0; i < 6; i++) {
    const x = -0.05 + i * 0.02 + (rand() - 0.5) * 0.01;
    const lock = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), hairDark);
    lock.scale.set(0.8, 1.3, 0.8);
    lock.position.set(x, 0.07 + rand() * 0.015, -0.088);
    lock.rotation.z = (rand() - 0.5) * 0.8;
    head.add(lock);
  }

  // Bras (recalculés à chaque frame pour l'animation)
  const upperL = makeLimb(0.052, hoodie);
  const lowerL = makeLimb(0.045, hoodie);
  const upperR = makeLimb(0.052, hoodie);
  const lowerR = makeLimb(0.045, hoodie);
  const shoulderL = joint(0.064, hoodie);
  const shoulderR = joint(0.064, hoodie);
  const elbowL = joint(0.049, hoodie);
  const elbowR = joint(0.049, hoodie);
  const handSkin = mat('#9c7563', { roughness: 1 });
  const handL = joint(0.036, handSkin);
  const handR = joint(0.036, handSkin);
  handL.scale.set(1, 0.6, 1.4);
  handR.scale.set(1, 0.6, 1.4);
  // poignets côtelés + montre noire au poignet gauche
  const cuffL = makeLimb(0.044, hoodieRib);
  const cuffR = makeLimb(0.044, hoodieRib);
  const wristL = makeLimb(0.028, skin);
  const wristR = makeLimb(0.028, skin);
  const watch = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.024, 20), watchMat);
  const watchFace = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.026), new THREE.MeshBasicMaterial({ color: '#111a22' }));
  person.add(upperL, lowerL, upperR, lowerR, shoulderL, shoulderR, elbowL, elbowR, handL, handR);
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
  const shoulderLocalL = new THREE.Vector3(-0.19, 0.5, 0.0);
  const shoulderLocalR = new THREE.Vector3(0.19, 0.5, 0.0);

  updaters.push((t) => {
    // respiration + légère oscillation
    const breath = Math.sin(t * 1.6) * 0.012;
    torso.scale.set(1.34 + breath * 0.5, 1 + breath, 0.84 + breath);
    torsoPivot.rotation.x = -0.12 + Math.sin(t * 0.4) * 0.015;
    torsoPivot.rotation.y = Math.sin(t * 0.23) * 0.03;
    // la tête regarde d'un écran à l'autre de temps en temps
    const look = Math.sin(t * 0.18) * 0.9;
    head.rotation.y = THREE.MathUtils.clamp(look, -0.38, 0.38);
    head.rotation.x = 0.08 + Math.sin(t * 0.7) * 0.02;

    torsoPivot.updateMatrixWorld();
    sL.copy(shoulderLocalL).applyMatrix4(torsoPivot.matrixWorld);
    sR.copy(shoulderLocalR).applyMatrix4(torsoPivot.matrixWorld);

    // main gauche : frappe au clavier ; main droite : souris
    const typing = Math.max(0, Math.sin(t * 14)) * 0.008 * (Math.sin(t * 0.9) > -0.2 ? 1 : 0);
    hL.set(-0.16 + Math.sin(t * 3.1) * 0.01, 0.8 + typing, -0.44);
    hR.set(0.36 + Math.sin(t * 0.8) * 0.02, 0.795, -0.4 + Math.cos(t * 0.6) * 0.015);
    mouse.position.set(hR.x, 0.774, hR.z - 0.02);

    eL.set(-0.27, 0.9, 0.08);
    eR.set(0.3, 0.9, 0.1);

    setLimb(upperL, sL, eL);
    // avant-bras → poignet côtelé → poignet nu → main
    _a.lerpVectors(eL, hL, 0.74);
    _b.lerpVectors(eL, hL, 0.84);
    _c.lerpVectors(eL, hL, 0.95);
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
    _c.lerpVectors(eR, hR, 0.95);
    setLimb(lowerR, eR, _a);
    setLimb(cuffR, _a, _b);
    setLimb(wristR, _b, _c);
    shoulderL.position.copy(sL);
    shoulderR.position.copy(sR);
    elbowL.position.copy(eL);
    elbowR.position.copy(eR);
    handL.position.copy(hL);
    handR.position.copy(hR);
  });

  /* ---------- Lumières ---------- */
  const hemi = new THREE.HemisphereLight('#3a4a8a', '#0a0608', 0.55);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight('#8ea8ff', 1.3);
  moon.position.set(-4, 3.2, 0.6);
  moon.target.position.set(0.3, 0.6, 0.1);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -2.5;
  moon.shadow.camera.right = 2.5;
  moon.shadow.camera.top = 2.5;
  moon.shadow.camera.bottom = -2.5;
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.02;
  scene.add(moon, moon.target);

  // contre-jour doux pour détacher la silhouette du personnage
  const rim = new THREE.PointLight('#5b6cff', 1.4, 3.5, 2);
  rim.position.set(0.6, 1.9, 1.6);
  scene.add(rim);

  return {
    monitors,
    update(t) {
      updaters.forEach((fn) => fn(t));
    },
  };
}
