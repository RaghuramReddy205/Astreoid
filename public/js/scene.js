// Three.js scene: starfield, drifting asteroids, a hero asteroid (login), and the
// interactive task belt (Orbit page). Day/night changes light, sky and stars.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const CAT = { academics: 0x8b7bff, coding: 0x2dd4bf, project: 0xf59e0b, personal: 0xfb7185, habit: 0x84cc16 };
const mul = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash = (n) => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); };
const lerp = THREE.MathUtils.lerp;
function vnoise(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const f = (t) => t * t * (3 - 2 * t), h = (a, b, c) => hash(a * 57.1 + b * 113.7 + c * 251.3 + seed * 17.9);
  const u = f(xf), v = f(yf), w = f(zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w);
}
// Lumpy, cratered rock with baked vertex-colour shading (flat shaded facets).
function rockGeometry(seed, detail) {
  const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position, rnd = mul(seed * 9973 + 7);
  const craters = Array.from({ length: 7 }, () => ({ d: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), r: 0.22 + rnd() * 0.3, depth: 0.07 + rnd() * 0.12 }));
  const sx = 1 + rnd() * 0.35, sy = 0.75 + rnd() * 0.3, sz = 0.85 + rnd() * 0.3;
  const colors = new Float32Array(p.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let d = 1 + (vnoise(v.x * 1.5 + 9, v.y * 1.5, v.z * 1.5, seed) - 0.5) * 0.55 + (vnoise(v.x * 4, v.y * 4, v.z * 4, seed + 3) - 0.5) * 0.2 + (vnoise(v.x * 11, v.y * 11, v.z * 11, seed + 5) - 0.5) * 0.06;
    let shade = 0.62 + (vnoise(v.x * 6, v.y * 6, v.z * 6, seed + 11) - 0.5) * 0.5;
    for (const c of craters) {
      const a = Math.acos(Math.min(1, v.dot(c.d)));
      if (a < c.r) { const t = a / c.r; d -= c.depth * (1 - t * t); shade -= 0.18 * (1 - t); }
      else if (a < c.r * 1.25) { d += c.depth * 0.18 * (1 - (a - c.r) / (c.r * 0.25)); shade += 0.08; }
    }
    p.setXYZ(i, v.x * d * sx, v.y * d * sy, v.z * d * sz);
    colors[i * 3] = shade * 1.04; colors[i * 3 + 1] = shade; colors[i * 3 + 2] = shade * 0.94;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.computeVertexNormals();
  return g;
}
function glowTexture(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createScene(canvas) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, speed = reduce ? 0.2 : 1;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x05070f, 40, 150);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500); camera.position.set(0, 0, 17);

  const hemi = new THREE.HemisphereLight(0xaab4ff, 0x1a1008, 0.5), groundN = new THREE.Color(0x1a1008), groundD = new THREE.Color(0xa9bdd6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dd, 2.4); sun.position.set(7, 9, 6); scene.add(sun);
  const rim = new THREE.PointLight(0x7c6cff, 120, 80, 2); rim.position.set(-9, -4, 4); scene.add(rim);

  // stars + nebula + sun glow (backdrop)
  const sp = new Float32Array(2400 * 3), sr = mul(42);
  for (let i = 0; i < 2400; i++) { const r = 90 + sr() * 90, th = sr() * 6.2832, ph = Math.acos(2 * sr() - 1); sp.set([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph)], i * 3); }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.9, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat); scene.add(stars);
  const nebulae = [[0x6d4cff, -60, 25, -90, 120], [0x16c2a3, 70, -20, -100, 110], [0xf0457a, 0, -45, -110, 100]].map(([c, x, y, z, s]) => {
    const m = new THREE.SpriteMaterial({ map: glowTexture([[0, '#fff'], [0.4, '#fff6'], [1, '#fff0']]), color: c, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const sp2 = new THREE.Sprite(m); sp2.position.set(x, y, z); sp2.scale.set(s, s, 1); scene.add(sp2); return sp2;
  });
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, '#fffbe6'], [0.18, '#ffe9a8ee'], [0.5, '#ffd27a44'], [1, '#ffd27a00']]), transparent: true, opacity: 0, depthWrite: false, fog: false }));
  sunGlow.position.set(-45, 32, -80); sunGlow.scale.set(95, 95, 1); scene.add(sunGlow);

  // shared rock geometries + materials
  const geos = [0, 1, 2, 3, 4, 5].map((s) => rockGeometry(s + 1, 3));
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0.04, color: 0xc9b9a8 });
  const catMats = Object.fromEntries(Object.entries(CAT).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.75, metalness: 0.12, color: c, emissive: c, emissiveIntensity: 0.1 })]));

  // ambient drifting field
  const field = new THREE.Group(); scene.add(field); const drift = [], fr = mul(1337);
  for (let i = 0; i < 38; i++) {
    const m = new THREE.Mesh(geos[i % geos.length], rockMat), r = 7 + fr() * 24, th = fr() * 6.28, ph = Math.acos(2 * fr() - 1);
    m.position.set(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.7, r * Math.sin(ph) * Math.sin(th) - 8);
    if (Math.abs(m.position.x) < 4 && Math.abs(m.position.y) < 3 && m.position.z > -4) m.position.x += 8 * (m.position.x < 0 ? -1 : 1);
    m.scale.setScalar(0.25 + fr() * fr() * 1.7); m.rotation.set(fr() * 6, fr() * 6, fr() * 6);
    drift.push({ m, rx: (fr() - 0.5) * 0.3, ry: (fr() - 0.5) * 0.3, vy: (fr() - 0.5) * 0.12 }); field.add(m);
  }
  // hero asteroid (login screen, high detail)
  const hero = new THREE.Mesh(rockGeometry(21, 5), rockMat); hero.scale.setScalar(2.9); scene.add(hero);
  // task belt
  const belt = new THREE.Group(); scene.add(belt); belt.visible = false;
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), new THREE.MeshBasicMaterial({ color: 0xffd98a })); core.scale.setScalar(0.9); belt.add(core);
  const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, '#fff8d8'], [0.3, '#ffcf6acc'], [1, '#ff9a3c00']]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); coreGlow.scale.set(9, 9, 1); belt.add(coreGlow);
  const RINGS = [3.4, 5, 6.6, 8.2, 10];
  RINGS.forEach((r) => { const pts = []; for (let i = 0; i <= 96; i++) pts.push(new THREE.Vector3(Math.cos(i / 96 * 6.2832) * r, 0, Math.sin(i / 96 * 6.2832) * r)); belt.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8c9bff, transparent: true, opacity: 0.16 }))); });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, '#ffffffcc'], [0.4, '#ffffff44'], [1, '#ffffff00']]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); belt.add(halo); halo.visible = false;
  const bodies = new Map(); let selected = null, haloOn = 0;


  // controls
  const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.dampingFactor = 0.07; controls.enablePan = false; controls.enabled = false; controls.rotateSpeed = 0.7;

  let mode = 'ambient', themeT = 1, themeGoal = 1, tween = null, w = 1, h = 1, px = 0, py = 0, running = true;
  const heroT = new THREE.Vector3(), clock = new THREE.Clock(), ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let pickCb = () => {}, hoverCb = () => {};

  function resize() {
    w = window.innerWidth; h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();
  window.addEventListener('pointermove', (e) => { px = (e.clientX / w - 0.5) * 2; py = (e.clientY / h - 0.5) * 2; });
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) clock.getDelta(); });

  function camTarget(m) { return m === 'auth' ? new THREE.Vector3(0, 0, 12) : m === 'orbit' ? new THREE.Vector3(0, 9.5, 17.5) : new THREE.Vector3(0, 0, 17); }
  function setMode(m) {
    if (m === mode) return; mode = m; controls.enabled = false;
    controls.minDistance = m === 'orbit' ? 7 : 6; controls.maxDistance = m === 'orbit' ? 38 : 22;
    controls.maxPolarAngle = m === 'orbit' ? Math.PI * 0.62 : Math.PI;
    belt.visible = m === 'orbit';
    tween = { t: 0, from: camera.position.clone(), to: camTarget(m) };
  }
  function setTheme(t) { themeGoal = t === 'night' ? 1 : 0; }
  function setTasks(tasks) {
    const now = Date.now(), live = new Set();
    tasks.filter((t) => ['pending', 'in_progress', 'blocked'].includes(t.status)).slice(0, 70).forEach((t) => {
      live.add(t.id);
      const due = t.dueAt ? Date.parse(t.dueAt) : NaN, hrs = (due - now) / 36e5;
      const ring = isNaN(due) ? 4 : hrs < 0 ? 0 : hrs <= 24 ? 1 : hrs <= 72 ? 2 : hrs <= 168 ? 3 : 4;
      let b = bodies.get(t.id);
      const rnd = mul([...t.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
      if (!b) {
        const mesh = new THREE.Mesh(geos[Math.floor(rnd() * geos.length)], catMats[t.category] || catMats.personal);
        mesh.userData.taskId = t.id; mesh.scale.setScalar(0.01); belt.add(mesh);
        b = { mesh, ang: rnd() * 6.28, tilt: (rnd() - 0.5) * 0.5, spin: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5), r: RINGS[ring], rGoal: RINGS[ring], size: 0, dying: false, off: (rnd() - 0.5) * 0.9 };
        bodies.set(t.id, b);
      }
      b.mesh.material = catMats[t.category] || catMats.personal; b.dying = false;
      b.rGoal = RINGS[ring] + b.off; b.size = ({ high: 0.62, medium: 0.46, low: 0.33 }[t.priority] || 0.45) * (t.status === 'in_progress' ? 1.15 : 1);
      b.omega = (0.5 / Math.sqrt(b.rGoal)) * (0.8 + rnd() * 0.4);
    });
    bodies.forEach((b, id) => { if (!live.has(id)) b.dying = true; });
    if (selected && !live.has(selected)) selected = null;
  }
  const meshes = () => [...bodies.values()].filter((b) => !b.dying).map((b) => b.mesh);
  function pickAt(cx, cy) {
    mouse.set((cx / w) * 2 - 1, -(cy / h) * 2 + 1); ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(meshes(), false)[0]; return hit ? hit.object.userData.taskId : null;
  }
  let down = null, hoverQueued = false, lastHover = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (mode !== 'orbit' || !down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved < 6) { const id = pickAt(e.clientX, e.clientY); selected = id; pickCb(id); }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (mode !== 'orbit' || hoverQueued) return; hoverQueued = true;
    requestAnimationFrame(() => { hoverQueued = false; const id = pickAt(e.clientX, e.clientY); canvas.style.cursor = id ? 'pointer' : (mode === 'ambient' ? '' : 'grab'); if (id !== lastHover || id) { lastHover = id; hoverCb(id, e.clientX, e.clientY); } });
  });
  canvas.addEventListener('pointerleave', () => { if (lastHover) { lastHover = null; hoverCb(null); } });

  const night = { bg: new THREE.Color(0x05070f), hemi: 0.45, sun: 2.2, rim: 120, sunCol: new THREE.Color(0xdfe6ff), hemiSky: new THREE.Color(0x9aa8ff), exp: 1.05 };
  const day = { bg: new THREE.Color(0xb6dcff), hemi: 1.15, sun: 3.4, rim: 0, sunCol: new THREE.Color(0xfff0d2), hemiSky: new THREE.Color(0xbfe2ff), exp: 1.0 };
  const tmp = new THREE.Color();

  function frame() {
    requestAnimationFrame(frame);
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
    themeT += Math.sign(themeGoal - themeT) * Math.min(Math.abs(themeGoal - themeT), dt * 2.2);
    const n = themeT; // 1 = night
    hemi.intensity = lerp(day.hemi, night.hemi, n); sun.intensity = lerp(day.sun, night.sun, n); rim.intensity = lerp(day.rim, night.rim, n);
    sun.color.copy(day.sunCol).lerp(night.sunCol, n); hemi.color.copy(day.hemiSky).lerp(night.hemiSky, n); hemi.groundColor.copy(groundD).lerp(groundN, n);
    scene.fog.color.copy(day.bg).lerp(night.bg, n); starMat.opacity = n * 0.95; stars.visible = n > 0.01;
    nebulae.forEach((s) => (s.material.opacity = 0.32 * n)); sunGlow.material.opacity = (1 - n) * 0.95; renderer.toneMappingExposure = lerp(day.exp, night.exp, n);
    stars.rotation.y += dt * 0.004 * speed;

    drift.forEach((d) => { d.m.rotation.x += d.rx * dt * speed; d.m.rotation.y += d.ry * dt * speed; d.m.position.y += Math.sin(time * 0.3 + d.m.id) * d.vy * dt * speed; });
    field.rotation.y += dt * 0.006 * speed;

    // hero placement per mode
    const wide = camera.aspect > 1.15;
    if (mode === 'auth') { heroT.set(wide ? 4.4 : 0, wide ? 0.2 : 2.7, 0); hero.scale.setScalar(lerp(hero.scale.x, wide ? 2.9 : 2.1, 0.06)); }
    else if (mode === 'orbit') { heroT.set(-30, 18, -40); } else heroT.set(wide ? 15 : 8, wide ? 5 : 8, -16);
    hero.position.lerp(heroT, 0.06); hero.rotation.y += dt * 0.12 * speed; hero.rotation.x += dt * 0.03 * speed;
    hero.visible = mode !== 'orbit' || hero.position.distanceTo(heroT) > 0.5;

    // task belt
    if (belt.visible) {
      core.scale.setScalar(0.9 + Math.sin(time * 1.6) * 0.04); coreGlow.scale.setScalar(9 + Math.sin(time * 1.6) * 0.5);
      haloOn = 0;
      bodies.forEach((b, id) => {
        b.r = lerp(b.r, b.rGoal, 0.05); b.ang += b.omega * dt * speed;
        const x = Math.cos(b.ang) * b.r, z = Math.sin(b.ang) * b.r;
        b.mesh.position.set(x, Math.sin(b.ang * 2 + b.tilt * 9) * b.tilt * 1.4, z);
        b.mesh.rotation.x += b.spin.x * dt; b.mesh.rotation.y += b.spin.y * dt;
        let goal = b.dying ? 0 : b.size * (id === selected ? 1.35 + Math.sin(time * 5) * 0.06 : 1);
        const s = lerp(b.mesh.scale.x, goal, b.dying ? 0.12 : 0.09); b.mesh.scale.setScalar(Math.max(s, 0.0001));
        if (id === selected || id === lastHover) halo.position.copy(b.mesh.position), haloOn = Math.max(haloOn, 1), halo.scale.setScalar(b.mesh.scale.x * 4.2 + Math.sin(time * 5) * 0.2);
        if (b.dying && s < 0.02) { belt.remove(b.mesh); bodies.delete(id); }
      });
    }

    halo.visible = belt.visible && haloOn > 0;

    // camera
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / 1.2); const e = 1 - Math.pow(1 - tween.t, 3);
      camera.position.lerpVectors(tween.from, tween.to, e); controls.target.set(0, 0, 0); camera.lookAt(0, 0, 0);
      if (tween.t >= 1) { tween = null; controls.enabled = mode !== 'ambient'; controls.update(); }
    } else if (mode === 'ambient') {
      camera.position.x = lerp(camera.position.x, px * 1.3, 0.04); camera.position.y = lerp(camera.position.y, -py * 0.9, 0.04); camera.lookAt(0, 0, 0);
    } else { controls.update(); }
    renderer.render(scene, camera);
  }
  frame();
  return { camera, controls, setMode, setTheme, setTasks, select: (id) => (selected = id), onPick: (f) => (pickCb = f), onHover: (f) => (hoverCb = f), get mode() { return mode; } };
}
