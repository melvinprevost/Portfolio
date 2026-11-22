// Textures dessinées sur <canvas> pour les 3 moniteurs.
// Chaque écran expose { texture, update(time) } ; update redessine si besoin.
import * as THREE from 'three';

const W = 1280;
const H = 720;

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return c;
}

function makeTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function titleBar(ctx, label, bg = '#0d1220') {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, 44);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(26 + i * 22, 22, 7, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#8b93a7';
  ctx.font = '500 18px "JetBrains Mono"';
  ctx.textAlign = 'center';
  ctx.fillText(label, W / 2, 28);
  ctx.textAlign = 'left';
}

function scanlines(ctx, alpha = 0.06) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
}

/* Bouton « avant-goût » commun : invite à cliquer pour entrer dans l'écran */
function teaserCTA(ctx, t, label, color, y = 610) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.6);
  ctx.font = '600 24px "JetBrains Mono"';
  const w = ctx.measureText(label).width + 70;
  const x = (W - w) / 2;
  ctx.save();
  ctx.globalAlpha = 0.25 + pulse * 0.25;
  ctx.fillStyle = color;
  roundRect(ctx, x, y - 38, w, 58, 29);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  roundRect(ctx, x, y - 38, w, 58, 29);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(label, W / 2, y);
  ctx.textAlign = 'left';
}

// Lignes floues « contenu à découvrir »
function ghostLines(ctx, x, y, widths, color) {
  ctx.save();
  ctx.filter = 'blur(3px)';
  widths.forEach((w, i) => {
    ctx.globalAlpha = 0.35 - i * 0.05;
    ctx.fillStyle = color;
    roundRect(ctx, x, y + i * 26, w, 12, 6);
    ctx.fill();
  });
  ctx.restore();
}

/* ---------------- Écran gauche : Parcours (avant-goût) ---------------- */
function parcoursScreen() {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  const texture = makeTexture(canvas);
  const chips = [
    ['CRAM', 'CDI · depuis oct. 2026'],
    ['CreaVizione', 'Fondateur · 2026'],
    ['EPSI Rennes', 'MSc Bac +5 · obtenu'],
  ];

  function draw(t) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#061522');
    g.addColorStop(1, '#030810');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    titleBar(ctx, '~/parcours', '#071827');

    ctx.textAlign = 'center';
    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 22px "JetBrains Mono"';
    ctx.fillText('// PARCOURS', W / 2, 120);
    ctx.fillStyle = '#e8ecf5';
    ctx.font = '700 64px "Space Grotesk"';
    ctx.fillText("3 ans d'alternance,", W / 2, 200);
    ctx.fillText('puis un CDI.', W / 2, 272);
    ctx.textAlign = 'left';

    // trois « puces » qui s'allument tour à tour
    const active = Math.floor(t / 1.4) % chips.length;
    const cw = 330;
    const gap = 24;
    const x0 = (W - (cw * 3 + gap * 2)) / 2;
    chips.forEach(([a, b], i) => {
      const x = x0 + i * (cw + gap);
      const on = i === active;
      ctx.fillStyle = on ? 'rgba(56,189,248,0.14)' : 'rgba(255,255,255,0.03)';
      roundRect(ctx, x, 320, cw, 104, 14);
      ctx.fill();
      ctx.strokeStyle = on ? '#38bdf8' : 'rgba(56,189,248,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#e8ecf5';
      ctx.font = '600 28px "Inter"';
      ctx.fillText(a, x + 24, 362);
      ctx.fillStyle = '#8b93a7';
      ctx.font = '400 21px "Inter"';
      ctx.fillText(b, x + 24, 398);
    });
    ghostLines(ctx, x0, 462, [640, 520, 580], '#38bdf8');
    teaserCTA(ctx, t, '▶  Cliquer pour voir le parcours', '#38bdf8');
    scanlines(ctx, 0.05);
    texture.needsUpdate = true;
  }

  let last = -1;
  return {
    texture,
    update(t) {
      const k = Math.floor(t * 8);
      if (k !== last) { last = k; draw(t); }
    },
  };
}

/* ---------------- Écran central : terminal (avant-goût) ---------------- */
function profilScreen() {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  const texture = makeTexture(canvas);

  const P = 'melvin@bureau:~$ ';
  const script = [
    { p: true, s: 'whoami' },
    { s: 'Melvin Prévost', c: '#e8ecf5', b: true },
    { s: 'Chargé de projets & admin systèmes et réseaux', c: '#a7b0c2' },
    { p: true, s: 'ls competences/' },
    { s: 'reseaux/  systemes/  virtualisation/  ...', c: '#38bdf8' },
    { p: true, s: './profil.sh --details' },
  ];
  const total = script.reduce((a, l) => a + l.s.length, 0);
  const CPS = 30;
  const LOOP = total / CPS + 7;

  function draw(t) {
    ctx.fillStyle = '#040806';
    ctx.fillRect(0, 0, W, H);
    const rg = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7);
    rg.addColorStop(0, 'rgba(74,222,128,0.07)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
    titleBar(ctx, 'melvin@bureau: ~', '#08120c');

    let budget = Math.floor((t % LOOP) * CPS);
    const lh = 52;
    let y = 116;
    const x = 60;
    let cursorX = x;
    let cursorY = y;
    for (const line of script) {
      if (budget <= 0) break;
      let px = x;
      if (line.p) {
        ctx.fillStyle = '#4ade80';
        ctx.font = '600 30px "JetBrains Mono"';
        ctx.fillText(P, px, y);
        px += ctx.measureText(P).width;
        ctx.fillStyle = '#e8ecf5';
        ctx.font = '400 30px "JetBrains Mono"';
      } else {
        ctx.fillStyle = line.c;
        ctx.font = `${line.b ? '700 36px' : '400 30px'} "JetBrains Mono"`;
      }
      const shown = line.s.slice(0, budget);
      ctx.fillText(shown, px, y);
      cursorX = px + ctx.measureText(shown).width;
      cursorY = y;
      budget -= line.s.length;
      if (budget > 0) y += lh;
    }
    if (Math.floor(t * 2) % 2 === 0) {
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(cursorX + 6, cursorY - 26, 15, 32);
    }
    teaserCTA(ctx, t, '▶  Cliquer pour ouvrir le profil', '#4ade80');
    scanlines(ctx, 0.07);
    texture.needsUpdate = true;
  }

  let last = -1;
  return {
    texture,
    update(t) {
      const k = Math.floor(t * 20);
      if (k !== last) { last = k; draw(t); }
    },
  };
}

/* ---------------- Écran droit : CreaVizione ---------------- */
function creavizioneScreen() {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  const texture = makeTexture(canvas);

  function draw(t) {
    ctx.fillStyle = '#0a0507';
    ctx.fillRect(0, 0, W, H);
    const glowX = W * (0.5 + 0.12 * Math.sin(t * 0.5));
    const rg = ctx.createRadialGradient(glowX, 330, 20, glowX, 330, 620);
    rg.addColorStop(0, 'rgba(196,54,90,0.30)');
    rg.addColorStop(0.5, 'rgba(160,18,46,0.10)');
    rg.addColorStop(1, 'rgba(10,5,7,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
    titleBar(ctx, 'creavizione', '#120a0d');

    ctx.textAlign = 'center';
    ctx.font = '600 20px "Josefin Sans"';
    ctx.fillStyle = '#c4365a';
    ctx.fillText('MON ACTIVITÉ FREELANCE', W / 2, 190);

    // logo
    ctx.font = '700 120px "Josefin Sans"';
    const wCrea = ctx.measureText('Crea').width;
    const wFull = ctx.measureText('CreaVizione').width;
    ctx.textAlign = 'left';
    const lx = (W - wFull) / 2;
    ctx.fillStyle = '#f7f2f3';
    ctx.fillText('Crea', lx, 320);
    ctx.fillStyle = '#c4365a';
    ctx.fillText('Vizione', lx + wCrea, 320);
    ctx.textAlign = 'center';

    ctx.font = '400 28px "Inter"';
    ctx.fillStyle = '#b7a4a9';
    ctx.fillText('Agence digitale · Le Havre · depuis avril 2026', W / 2, 390);
    ctx.fillText('Sites internet & applications web sur mesure', W / 2, 432);

    teaserCTA(ctx, t, "▶  Cliquer pour découvrir l'entreprise", '#c4365a', 560);
    ctx.textAlign = 'left';
    scanlines(ctx, 0.04);
    texture.needsUpdate = true;
  }

  let last = -1;
  return {
    texture,
    update(t) {
      const k = Math.floor(t * 8);
      if (k !== last) { last = k; draw(t); }
    },
  };
}

/* ---------------- Néon mural « CreaVizione » ---------------- */
export function neonTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.font = '700 120px "Josefin Sans"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ff2a55';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ff6b88';
  ctx.fillText('CreaVizione', 512, 128);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd6de';
  ctx.fillText('CreaVizione', 512, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------------- Ville de nuit (fenêtre) ---------------- */
export function cityTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 768;
  const ctx = c.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, c.height);
  sky.addColorStop(0, '#02030a');
  sky.addColorStop(0.6, '#0b1030');
  sky.addColorStop(1, '#1b1840');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, c.width, c.height);
  // étoiles
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.8 + 0.1})`;
    const s = Math.random() * 1.8;
    ctx.fillRect(Math.random() * c.width, Math.random() * c.height * 0.6, s, s);
  }
  // lune
  const mx = 760, my = 150;
  const mg = ctx.createRadialGradient(mx, my, 10, mx, my, 160);
  mg.addColorStop(0, 'rgba(200,215,255,0.35)');
  mg.addColorStop(1, 'rgba(200,215,255,0)');
  ctx.fillStyle = mg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#e9eeff';
  ctx.beginPath();
  ctx.arc(mx, my, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,170,200,0.35)';
  ctx.beginPath(); ctx.arc(mx - 12, my - 8, 9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + 14, my + 14, 6, 0, Math.PI * 2); ctx.fill();

  // immeubles (2 plans)
  const layers = [
    { base: 0.62, maxH: 0.3, col: '#0a0d1f', win: 0.18 },
    { base: 0.72, maxH: 0.36, col: '#05060f', win: 0.3 },
  ];
  for (const L of layers) {
    let x = -10;
    while (x < c.width) {
      const bw = 40 + Math.random() * 90;
      const bh = c.height * (0.08 + Math.random() * L.maxH);
      const by = c.height * L.base - bh + c.height * 0.25;
      ctx.fillStyle = L.col;
      ctx.fillRect(x, by, bw, c.height - by);
      for (let wy = by + 10; wy < c.height - 10; wy += 16) {
        for (let wx = x + 8; wx < x + bw - 10; wx += 14) {
          if (Math.random() < L.win) {
            const warm = Math.random() < 0.75;
            ctx.fillStyle = warm ? `rgba(255,200,120,${0.4 + Math.random() * 0.5})` : `rgba(140,200,255,${0.4 + Math.random() * 0.4})`;
            ctx.fillRect(wx, wy, 6, 8);
          }
        }
      }
      x += bw + 2;
    }
  }
  // un phare (clin d'œil au Havre)
  ctx.fillStyle = '#0a0d1f';
  ctx.fillRect(120, 470, 18, 120);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(118, 462, 22, 10);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createScreens() {
  return {
    parcours: parcoursScreen(),
    profil: profilScreen(),
    creavizione: creavizioneScreen(),
  };
}

export const SCREEN_ASPECT = W / H;
