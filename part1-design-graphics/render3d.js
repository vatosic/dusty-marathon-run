/* Часть 1 · Дизайн и графика — 3D-рендер забега (Three.js / WebGL) */
(function (G) {
  'use strict';
  const D = G.DUSTY;
  if (!G.THREE) { D.Render3D = { supported: () => false }; return; }
  const R = (D.Render3D = {});
  const PI = Math.PI;
  const PINK = '#ff2e93', VIOLET = '#6c2bd9', LIME = '#c8ff1a', INK = '#1e0b2e';
  const Z = (z) => -z;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  let renderer, scene, camera, overlay, octx, W = 1, H = 1, dpr = 1, reduced = false, time = 0, pitch = 0.2;
  let hemi, sun, world = null, crowd = null, player = null, curGame = null;
  const camState = { x: 0, y: 3.4, back: 6.9 };
  const pools = {};
  const speedLines = [];
  const v3 = new THREE.Vector3();

  R.supported = function () {
    try {
      if (!G.THREE) return false;
      const c = document.createElement('canvas');
      return !!(G.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  };

  R.init = function (canvas, overlayCanvas) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    overlay = overlayCanvas; octx = overlay.getContext('2d');
    reduced = !!(G.matchMedia && G.matchMedia('(prefers-reduced-motion: reduce)').matches);
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#dcecf4', 140, 330);
    camera = new THREE.PerspectiveCamera(65, 1, 0.3, 600);
    camera.rotation.order = 'YXZ';
    hemi = new THREE.HemisphereLight('#e4f1ff', '#7a6f62', 0.58); scene.add(hemi);
    const fill = new THREE.DirectionalLight('#ffe6f2', 0.25); fill.position.set(-4, 3, 6); scene.add(fill);
    sun = new THREE.DirectionalLight('#fff3dc', 0.9);
    sun.castShadow = true;
    const coarse = G.matchMedia && G.matchMedia('(pointer: coarse)').matches;
    sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
    const sc = sun.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 140;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);
    crowd = new D.Chars.Crowd(scene, 130);
    player = D.Chars.buildRig({ skin: '#d49a72', hair: '#2e211a', shirt: PINK, shorts: '#121216', shoes: '#f4f4f4', cap: PINK, stripe: '#2a2a30' }, { shirtTex: D.Tex.shirt() });
    scene.add(player.root);
    buildFx();
    R.resize();
  };
  R.setReduced = (v) => { reduced = v; };

  R.resize = function () {
    if (!renderer) return;
    const coarse = G.matchMedia && G.matchMedia('(pointer: coarse)').matches;
    dpr = Math.min(G.devicePixelRatio || 1, coarse ? 1.75 : 2);
    W = G.innerWidth; H = G.innerHeight;
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    overlay.width = Math.round(W * dpr); overlay.height = Math.round(H * dpr);
    const f = Math.min(H * 0.78, W * 1.6);
    camera.fov = 2 * Math.atan((H / 2) / f) * 180 / PI;
    camera.aspect = W / H; camera.updateProjectionMatrix();
    const horFrac = W < H ? (H < 700 ? 0.43 : 0.37) : 0.4;
    pitch = Math.atan(((0.5 - horFrac) * H) / f);
  };

  /* ---------- пулы предметов и препятствий ---------- */
  function std(color, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6 }, extra || {})); }
  // Модели ништяков по видам: гели четырёх марок, три напитка, три вида еды, три бустера
  const label = (text, bg, fg, w, h) => new THREE.MeshStandardMaterial({ map: D.Tex.text(text, { bg, fg, w: w || 128, h: h || 192 }), roughness: 0.4 });
  const MODEL = {
    gel(v) {
      const g = new THREE.Group();
      const look = { sis: ['SiS', '#1f4fd1', '#ffffff'], gel4u: ['GEL4U', '#ff7a1a', '#1e0b2e'], gu: ['GU', '#e8365a', '#ffffff'], maurten: ['MAURTEN', '#f1f1ec', '#15151a'] }[v] || ['GEL', PINK, '#fff'];
      const face = label(look[0], look[1], look[2]), side = std(look[1], { roughness: 0.4 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.07), [side, side, side, side, face, face]); g.add(body);
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 0.1, 8), std(v === 'maurten' ? '#15151a' : INK)); tip.position.y = 0.26; g.add(tip);
      return g;
    },
    drink(v) {
      const g = new THREE.Group();
      if (v === 'cola') {
        const face = label('COLA', '#c8102e', '#ffffff', 256, 128), metal = std('#d9d9de', { metalness: 0.7, roughness: 0.3 });
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.34, 18), [face, metal, metal]));
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.03, 18), metal); top.position.y = 0.185; g.add(top);
      } else if (v === 'iso') {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.36, 16), std('#ffb21a', { roughness: 0.25, transparent: true, opacity: 0.92 })); g.add(b);
        const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.103, 0.103, 0.13, 16), [label('ISO', '#1e0b2e', '#ffb21a', 256, 128), std('#1e0b2e'), std('#1e0b2e')]); g.add(lab);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.1, 12), std('#1e0b2e')); cap.position.y = 0.23; g.add(cap);
      } else {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.4, 16), std('#9fdcff', { roughness: 0.1, transparent: true, opacity: 0.75 })); g.add(b);
        const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.12, 16), std('#ffffff')); lab.position.y = -0.02; g.add(lab);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 12), std('#1b6fd1')); cap.position.y = 0.24; g.add(cap);
      }
      return g;
    },
    food(v) {
      const g = new THREE.Group();
      if (v === 'orange') {
        const o = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 2), std('#ff8c1a', { roughness: 0.75 })); g.add(o);
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6).scale(1, 0.3, 0.55), std('#3f8a3a')); leaf.position.set(0.04, 0.17, 0); leaf.rotation.z = -0.5; g.add(leaf);
      } else if (v === 'burger') {
        const bun = std('#d9913a', { roughness: 0.6 });
        const top = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 10, 0, PI * 2, 0, PI / 2).scale(1, 0.62, 1), bun); top.position.y = 0.06; g.add(top);
        const layer = (r, h, y, col) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 18), std(col)); m.position.y = y; g.add(m); };
        layer(0.21, 0.035, 0.045, '#5fbf3a'); layer(0.2, 0.05, 0.005, '#5a2e1a'); layer(0.215, 0.015, 0.04, '#ffcf3a'); layer(0.19, 0.06, -0.06, '#d9913a');
        const seeds = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 4, 3).scale(1, 0.5, 1.6), std('#fff3d6'), 9);
        const mt = new THREE.Matrix4();
        for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = 0.06 + (i % 3) * 0.035; mt.makeTranslation(Math.cos(a) * rr, 0.06 + Math.sqrt(Math.max(0, 0.0256 - rr * rr)) * 0.62 + 0.04, Math.sin(a) * rr); seeds.setMatrixAt(i, mt); }
        g.add(seeds);
      } else {
        const b = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.06, 10, 20, 2.3), std('#ffd23f', { roughness: 0.5 }));
        b.rotation.z = 0.4; b.position.y = -0.12; g.add(b);
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.08, 6), std('#6b4a2b')); st.position.set(0.21, 0.1, 0); st.rotation.z = 0.6; g.add(st);
      }
      return g;
    },
    boost(v) {
      const g = new THREE.Group();
      if (v === 'magnesium') {
        const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.14, 6, 12).rotateZ(PI / 2), std('#39e27a', { roughness: 0.3 })); a.position.x = -0.07; g.add(a);
        const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.14, 6, 12).rotateZ(PI / 2), std('#ffffff', { roughness: 0.3 })); b.position.x = 0.09; g.add(b);
      } else if (v === 'puer') {
        // пиала пуэра на блюдце
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.1, 0.16, 18, 1, true), std('#a04a26', { side: THREE.DoubleSide, roughness: 0.5 })); g.add(cup);
        const tea = new THREE.Mesh(new THREE.CircleGeometry(0.14, 18).rotateX(-PI / 2), std('#4a1c0c', { roughness: 0.15 })); tea.position.y = 0.05; g.add(tea);
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.025, 20), std('#e9dcc6')); plate.position.y = -0.09; g.add(plate);
      } else {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.34, 16), std('#8a4f22')); g.add(cup);
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 16), std('#ffffff')); lid.position.y = 0.19; g.add(lid);
        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.13, 0.12, 16), std(LIME, { emissive: '#4a6a00', emissiveIntensity: 0.3 })); g.add(sleeve);
      }
      return g;
    },
    pacer() {
      const g = new THREE.Group();
      const face = new THREE.MeshStandardMaterial({ map: D.Tex.text('PACE', { bg: VIOLET, fg: '#ffffff', w: 256, h: 256 }) });
      const side = std(VIOLET);
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.07, 6).rotateX(PI / 2), [side, face, face]); g.add(s);
      return g;
    }
  };
  function makeItem(type, variant) {
    const grp = new THREE.Group();
    const col = D.ITEMS[type].color;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 3.4, 12, 1, true).translate(0, 1.7, 0),
      new THREE.MeshBasicMaterial({ map: D.Tex.glow(col), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    grp.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.5, 24).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, depthWrite: false }));
    ring.position.y = 0.08; grp.add(ring);
    if (MODEL[type]) {
      const m = MODEL[type](variant); m.position.y = 0.9; m.traverse((c) => { if (c.isMesh) c.castShadow = true; });
      grp.add(m); grp.userData.model = m;
    }
    if (type === 'highfive') {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: D.Tex.text('5', { bg: LIME, fg: INK, w: 128, h: 128 }) }));
      sp.scale.set(0.5, 0.5, 1); sp.position.set(-0.75, 2.5, 0); grp.add(sp);
      beam.position.x = -0.8;
      ring.position.x = -0.8;
    }
    grp.userData.ring = ring;
    return grp;
  }
  function makeObstacle(type) {
    const grp = new THREE.Group();
    if (type === 'puddle') {
      const p = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-PI / 2), new THREE.MeshPhongMaterial({ color: '#3c6f96', shininess: 120, specular: '#ffffff', transparent: true, opacity: 0.85 }));
      p.scale.set(0.7, 1, 0.24); p.position.y = 0.015; p.receiveShadow = true; grp.add(p);
      const r = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 28).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false }));
      r.position.y = 0.02; grp.add(r); grp.userData.ripple = r;
    } else if (type === 'fanbarrier') {
      // металлический фан-барьер с баннером клуба
      const metal = std('#aab2bb', { metalness: 0.6, roughness: 0.35 });
      const tube = (len, x, y, rotZ) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 8), metal); m.position.set(x, y, 0); m.rotation.z = rotZ || 0; grp.add(m); };
      for (const sx of [-0.63, 0.63]) { tube(0.66, sx, 0.33); const foot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.55).translate(0, 0.015, 0), metal); foot.position.x = sx; grp.add(foot); }
      tube(1.26, 0, 0.64, PI / 2); tube(1.26, 0, 0.1, PI / 2);
      for (let i = 1; i < 9; i++) tube(0.5, -0.63 + i * 0.14, 0.37);
      const face = new THREE.MeshStandardMaterial({ map: D.Tex.text('DUSTY', { bg: PINK, fg: '#ffffff', stripe: LIME, w: 512, h: 128 }), roughness: 0.6 });
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.02), [metal, metal, metal, metal, face, face]); panel.position.y = 0.42; grp.add(panel);
    } else if (type === 'scooter') {
      // электросамокат: дека, руль, колёса (ездок — из толпы)
      const dark = std('#1d1f26', { roughness: 0.4 }), acc = std(LIME, { roughness: 0.4 });
      const deck = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 0.78).translate(0, 0.12, 0), dark); grp.add(deck);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.02, 8), dark); stem.position.set(0, 0.62, -0.36); stem.rotation.x = -0.12; grp.add(stem);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8).rotateZ(PI / 2), dark); bar.position.set(0, 1.12, -0.42); grp.add(bar);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.04), new THREE.MeshBasicMaterial({ color: '#fff7cf' })); lamp.position.set(0, 0.95, -0.44); grp.add(lamp);
      for (const z of [-0.34, 0.33]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.05, 16).rotateZ(PI / 2), dark); w.position.set(0, 0.095, z); grp.add(w); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.055, 10).rotateZ(PI / 2), acc); hub.position.copy(w.position); grp.add(hub); }
    } else if (type === 'cup') {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.034, 0.1, 12), std('#ffffff')); grp.add(c);
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12).rotateX(-PI / 2), std('#7fd0ff', { roughness: 0.1 })); w.position.y = 0.045; grp.add(w);
    } else if (type === 'dog') {
      const d = D.Chars.buildDog(); grp.add(d.root); grp.userData.dog = d;
    } else if (type === 'camera') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.11), std('#1b1b1f', { roughness: 0.3 })); grp.add(body);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.14, 14).rotateX(PI / 2), std('#2d2d34', { roughness: 0.2 })); lens.position.z = -0.12; grp.add(lens);
      const fl = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.05), new THREE.MeshBasicMaterial({ color: '#ffffff' })); fl.position.set(0.06, 0.1, 0); grp.add(fl);
    } else if (type === 'sign') {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.45), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })); plane.position.y = 0.32; grp.add(plane);
      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.6, 0.03).translate(0, 0, 0), std('#6b5a4a')); grp.add(stick);
      grp.userData.plane = plane;
    } else if (type === 'flag') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.2).translate(0, 1.1, 0), std('#dddddd')); grp.add(pole);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55, 6, 1).translate(0.45, 0, 0), new THREE.MeshLambertMaterial({ map: D.Tex.text('DUSTY', { bg: PINK, fg: '#ffffff', stripe: LIME, w: 256, h: 128 }), side: THREE.DoubleSide }));
      fl.position.y = 1.95; grp.add(fl); grp.userData.cloth = fl;
    } else if (type === 'pflag') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.5).translate(0, 0.75, 0), std('#dddddd')); grp.add(pole);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4).translate(0.35, 0, 0), new THREE.MeshLambertMaterial({ map: D.Tex.text('ПЕЙС', { bg: VIOLET, fg: '#ffffff', w: 256, h: 128 }), side: THREE.DoubleSide }));
      fl.position.y = 1.3; grp.add(fl);
    }
    grp.traverse((c) => { if (c.isMesh && type !== 'puddle') c.castShadow = true; });
    return grp;
  }
  function take(kind, make) {
    let p = pools[kind];
    if (!p) p = pools[kind] = { list: [], used: 0 };
    if (p.used >= p.list.length) { const o = make(); scene.add(o); p.list.push(o); }
    const o = p.list[p.used++]; o.visible = true; return o;
  }
  function poolsBegin() { for (const k in pools) pools[k].used = 0; }
  function poolsEnd() { for (const k in pools) { const p = pools[k]; for (let i = p.used; i < p.list.length; i++) p.list[i].visible = false; } }

  /* ---------- эффекты вокруг героя ---------- */
  const BOOST_COL = { caffeine: '#ff2e93', magnesium: '#39e27a', puer: '#ff9b2e' };
  let fx = {};
  function buildFx() {
    fx.shield = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: '#8b5cff', transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }));
    fx.shield.scale.set(0.7, 1.1, 0.7); scene.add(fx.shield);
    fx.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: D.Tex.radial('rgba(255,255,255,0.7)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    fx.aura.scale.set(2.4, 2.8, 1); scene.add(fx.aura);
    fx.rings = [];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 8, 32).rotateX(PI / 2), new THREE.MeshBasicMaterial({ color: '#39e27a', transparent: true, depthWrite: false }));
      scene.add(r); fx.rings.push(r);
    }
    fx.ghosts = [];
  }

  /* ---------- мир ---------- */
  R.prepare = function (g) {
    if (curGame === g) return;
    if (world) D.World3D.dispose(world, scene);
    world = D.World3D.build(scene, g);
    curGame = g;
    camState.x = 0; camState.y = 3.4; camState.back = 6.9;
  };

  /* ---------- кадр ---------- */
  const LOOK_PLAYER = { skin: '#e2ab84' };
  // адаптивное качество: если кадр стабильно дольше 26 мс — снижаем разрешение, затем отключаем тени
  let ftAvg = 16, qLevel = 0, qTimer = 0, lastNow = 0;
  function adapt() {
    const now = performance.now();
    if (lastNow) ftAvg += (Math.min(100, now - lastNow) - ftAvg) * 0.05;
    lastNow = now; qTimer++;
    if (qTimer > 120 && ftAvg > 26 && qLevel < 2) {
      qLevel++; qTimer = 0;
      if (qLevel === 1) { dpr = 1; renderer.setPixelRatio(1); renderer.setSize(W, H, false); }
      if (qLevel === 2) { renderer.shadowMap.enabled = false; sun.castShadow = false; scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); }); }
    }
  }
  R.quality = () => ({ level: qLevel, ft: ftAvg });
  R.render = function (g, dt, state) {
    R.prepare(g);
    adapt();
    time += dt;
    const km = D.zToKm(g.pz);
    // камера
    const boost = g.boostT > 0 ? 1 : 0;
    const back = 6.9 + (reduced ? 0 : boost * 0.6 + clamp((g.speed - 16) / 10, 0, 0.6) * 0.6);
    camState.back += (back - camState.back) * Math.min(1, dt * 2.5);
    camState.x += (g.px * 0.55 - camState.x) * Math.min(1, dt * 5);
    camState.y += (3.4 + g.y * 0.35 - camState.y) * Math.min(1, dt * 6);
    camera.position.set(camState.x, camState.y, Z(g.pz - camState.back));
    camera.rotation.set(-pitch, 0, 0);
    const fovBoost = reduced ? 0 : boost * 4;
    const baseFov = 2 * Math.atan((H / 2) / Math.min(H * 0.78, W * 1.6)) * 180 / PI;
    camera.fov += (baseFov + fovBoost - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();

    D.World3D.update(world, g, camera, time, km);
    // свет и туман
    const late = clamp((km - 26) / 16, 0, 1);
    scene.fog.color.set('#dcecf4').lerp(new THREE.Color('#ffe1b8'), late);
    sun.color.set('#fff3dc').lerp(new THREE.Color('#ffc98a'), late);
    const sd = world.sunDir || v3.set(0.45, 0.42, -1).normalize();
    sun.position.set(g.px + sd.x * 60, sd.y * 60 + 6, Z(g.pz) + sd.z * 60);
    sun.target.position.set(g.px, 0, Z(g.pz + 8));
    sun.target.updateMatrixWorld();

    poolsBegin();
    crowd.begin();
    const labels = [];

    // герой
    player.root.position.set(g.px, g.y, Z(g.pz));
    player.root.rotation.set(0, 0, clamp(g.vx * 0.022, -0.2, 0.2) * (reduced ? 0.5 : 1));
    if (g.y > 0.05) D.Chars.poseJump(player);
    else D.Chars.poseRun(player, g.state === 'idle' ? 0 : g.phase, g.speed > 0.5 ? clamp(0.75 + g.speed / 40, 0.75, 1.25) : 0.05, g.hitT > 0 ? 0.32 : 0.13);
    const blink = g.invulnT > 0 && g.pacerT <= 0 && !reduced && Math.floor(g.invulnT * 12) % 2;
    const bk = g.boostT > 0 ? g.boostKind : '';
    player.mats.shirtTex.emissive.set(bk ? BOOST_COL[bk] : '#000000');
    player.mats.shirtTex.emissiveIntensity = bk ? 0.25 + 0.1 * Math.sin(time * 10) : blink ? 0.2 : 0;

    // эффекты героя
    fx.shield.visible = g.pacerT > 0;
    if (fx.shield.visible) { fx.shield.position.set(g.px, g.y + 0.95, Z(g.pz)); fx.shield.material.opacity = g.pacerT < 2 ? 0.08 + 0.08 * Math.abs(Math.sin(time * 8)) : 0.16; }
    fx.aura.visible = !!bk;
    if (fx.aura.visible) { fx.aura.position.set(g.px, g.y + 1.0, Z(g.pz) + 0.3); fx.aura.material.color.set(BOOST_COL[bk]); }
    fx.rings.forEach((r, i) => {
      r.visible = bk === 'magnesium';
      if (!r.visible) return;
      const q = (time * 0.8 + i / 3) % 1;
      r.position.set(g.px, g.y + q * 2, Z(g.pz)); r.material.opacity = (1 - q) * 0.8; r.scale.setScalar(1 + q * 0.3);
    });
    if (g.pacerT > 0) {
      const pz = g.pz + 2.6, px = g.px + 0.55;
      crowd.add({ x: px, z: Z(pz) }, { skin: '#d9a07a', hair: '#2b1d16', shirt: VIOLET, shorts: '#111', shoes: LIME }, (J) => D.Chars.poseRun(J, g.phase + 1, 1, 0.12));
      const f = take('pflag', () => makeObstacle('pflag')); f.position.set(px + 0.25, 0.9, Z(pz)); f.rotation.y = 0;
    }

    // соперники
    const vis = [];
    for (const rv of g.rivals) { const dz = rv.z - g.pz; if (dz > -2.2 && dz < 170) vis.push(rv); }
    vis.sort((a, b) => Math.abs(a.z - g.pz) - Math.abs(b.z - g.pz));
    for (let i = 0; i < Math.min(16, vis.length); i++) {
      const rv = vis[i];
      crowd.add({ x: rv.x, z: Z(rv.z) }, rv.look, (J) => D.Chars.poseRun(J, rv.phase, 0.8 + rv.v / 60, 0.12));
      const dz = rv.z - g.pz;
      if (dz > -0.5 && dz < 70) labels.push({ x: rv.x, y: 2.1, z: rv.z, name: rv.star ? '★ ' + rv.name : rv.name, star: rv.star, dz });
    }

    // болельщики, гуляющие, диджей
    const sc = g.scenery;
    const zFrom = g.pz - camState.back + 1, zTo = g.pz + 150;
    let lo = 0, hi = sc.fans.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (sc.fans[m].z < zFrom) lo = m + 1; else hi = m; }
    for (let i = lo; i < sc.fans.length && sc.fans[i].z < zTo && !crowd.full(); i++) {
      const f = sc.fans[i];
      const pose = f.sign ? 'sign' : f.pose;
      const ry = 2.5 + (f.phase - 3) * 0.08;
      crowd.add({ x: f.x, z: Z(f.z), ry }, f.look, (J) => D.Chars.posePerson(J, pose, time, f.phase));
      if (f.sign && f.z < g.pz + 110) {
        const s = take('sign', () => makeObstacle('sign'));
        const tex = D.Tex.text(f.sign, { bg: (f.phase * 10 | 0) % 3 === 0 ? PINK : (f.phase * 10 | 0) % 3 === 1 ? LIME : '#ffffff', fg: (f.phase * 10 | 0) % 3 === 0 ? '#ffffff' : INK, w: 512, h: 184 });
        if (s.userData.plane.material.map !== tex) { s.userData.plane.material.map = tex; s.userData.plane.material.needsUpdate = true; }
        s.position.set(f.x - 0.05, 2.05 + (f.pose === 'jump' ? 0 : 0), Z(f.z) + 0.05); s.rotation.y = -0.64;
      } else if (f.flag && f.z < g.pz + 110) {
        const fl = take('flag', () => makeObstacle('flag'));
        fl.position.set(f.x + 0.3, 0, Z(f.z)); fl.rotation.y = -0.6;
        if (!reduced) fl.userData.cloth.rotation.y = Math.sin(time * 3 + f.phase) * 0.25;
      }
    }
    for (const w of sc.walkers) {
      let z = w.z0 + w.v * g.t, dir = Math.sign(w.v);
      if (w.range) { const p = ((w.v * g.t) % (w.range * 2) + w.range * 2) % (w.range * 2); z = w.z0 + (p < w.range ? p : w.range * 2 - p); dir = p < w.range ? Math.sign(w.v) : -Math.sign(w.v); }
      if (z < zFrom || z > zTo || crowd.full()) continue;
      const ry = dir > 0 ? 0 : PI;
      if (w.kind === 'jogger') crowd.add({ x: w.x, z: Z(z), ry }, w.look, (J) => D.Chars.poseRun(J, time * 6 + w.phase, 0.7, 0.1));
      else crowd.add({ x: w.x, z: Z(z), ry }, Object.assign({ female: true }, w.look), (J) => D.Chars.posePerson(J, w.chat && Math.sin(time * 0.7 + w.phase) > 0 ? 'chat' : 'walk', time, w.phase));
    }
    if (sc.dj.z > zFrom && sc.dj.z < g.pz + 200) {
      const lx = sc.dj.x + Math.sin(-1.05) * -0.1, lz = Z(sc.dj.z) + Math.cos(-1.05) * -0.1;
      crowd.add({ x: lx, y: 0.06, z: lz, ry: 2.09 }, { skin: '#d9a07a', hair: '#1c1c1c', shirt: VIOLET, shorts: '#111', shoes: '#fff', cap: PINK, glasses: true }, (J) => D.Chars.posePerson(J, 'dj', time, 1));
      const dzj = sc.dj.z - g.pz;
      if (dzj > -0.5 && dzj < 70) labels.push({ x: sc.dj.x, y: 2.5, z: sc.dj.z, name: '★ DJ KIM', star: true, dz: dzj });
    }
    const lvl = state.musicLevel || 0;
    if (world.speakers) world.speakers.forEach((s) => s.scale.setScalar(1 + (reduced ? 0 : lvl * 0.12 * Math.max(0, Math.sin(time * 13)))));

    // предметы и препятствия
    const objs = g.plan.objs;
    for (let i = Math.max(0, g.objIdx - 2); i < objs.length; i++) {
      const o = objs[i]; if (o.z > g.pz + 260) break;
      if (o.taken || o.z < g.pz - 1.2) continue;
      if (o.kind === 'item') {
        if (o.type === 'highfive') {
          crowd.add({ x: o.x, z: Z(o.z), ry: PI * 0.92 }, { skin: '#f1c9a5', hair: '#5a3a22', shirt: PINK, shorts: '#1e1e28', shoes: '#fff', cap: LIME }, (J) => D.Chars.posePerson(J, 'highfive', time, o.z));
        }
        const it = take('item_' + o.type + (o.variant || ''), () => makeItem(o.type, o.variant));
        it.position.set(o.x, 0, Z(o.z));
        const m = it.userData.model;
        if (m) { m.position.y = 0.9 + (reduced ? 0 : Math.sin(time * 3 + o.z) * 0.07); m.rotation.y = reduced ? 0.4 : time * 1.6 + o.z; }
        it.userData.ring.material.opacity = 0.4 + 0.3 * Math.sin(time * 4 + o.z);
      } else if (!o.hit || o.z > g.pz - 1.2) {
        if (o.type === 'photographer') {
          const ry = o.walking ? PI / 2 + 0.3 : PI * 0.92;
          crowd.add({ x: o.x, z: Z(o.z), ry }, { skin: '#e0ac85', hair: '#2b1d16', shirt: '#ffd23f', shorts: '#2f3a55', shoes: '#222', cap: '#1e1e28' },
            (J) => D.Chars.posePerson(J, o.walking ? 'walk' : 'camera', time, o.z));
          const cam = take('camera', () => makeObstacle('camera'));
          if (o.walking) { cam.position.set(o.x + 0.3, 1.0, Z(o.z)); cam.rotation.set(0, ry, 0); }
          else { cam.position.set(o.x - 0.02, 1.62, Z(o.z) + 0.22); cam.rotation.set(0, ry, 0); }
        } else if (o.type === 'scooter') {
          // едет поперёк трассы справа налево; ездок стоит на деке
          const ry = PI / 2;
          crowd.add({ x: o.x, y: 0.15, z: Z(o.z), ry }, { skin: '#d9a07a', hair: '#1c1c1c', shirt: '#3a7bff', shorts: '#2f3a55', shoes: '#ffffff', cap: '#1e1e28' },
            (J) => D.Chars.posePerson(J, 'scooter', time, o.z));
          const sc2 = take('scooter', () => makeObstacle('scooter')); sc2.position.set(o.x, 0, Z(o.z)); sc2.rotation.y = ry;
        } else if (o.type === 'volunteer') {
          // волонтёр в оранжевом жилете протягивает стакан
          crowd.add({ x: o.x, z: Z(o.z), ry: PI }, { skin: '#e3b18c', hair: '#5a3a22', longHair: (o.z | 0) % 2 === 0, female: (o.z | 0) % 2 === 0, shirt: '#ff7a1a', shorts: '#2f3a55', shoes: '#222', cap: '#ffffff' },
            (J) => D.Chars.posePerson(J, 'offer', time, o.z));
          const cup = take('cup', () => makeObstacle('cup')); cup.position.set(o.x - 0.2, 1.22, Z(o.z) + 0.5);
        } else if (o.type === 'dog') {
          const d = take('dog', () => makeObstacle('dog'));
          d.position.set(o.x, 0, Z(o.z)); d.rotation.y = o.dir > 0 ? -PI / 2 : PI / 2;
          d.userData.dog.animate(time);
        } else {
          const ob = take('obs_' + o.type, () => makeObstacle(o.type));
          ob.position.set(o.x, 0, Z(o.z));
          if (o.type === 'puddle') { const q = reduced ? 0.4 : (time * 0.8 + o.z) % 1; ob.userData.ripple.scale.set(0.2 + q * 0.5, 1, 0.08 + q * 0.16); ob.userData.ripple.material.opacity = 0.5 * (1 - q); }
        }
      }
    }
    poolsEnd();
    crowd.end();

    renderer.render(scene, camera);
    drawOverlay(g, dt, labels);
  };

  /* ---------- 2D-слой: имена и экранные эффекты ---------- */
  function project(x, y, z) {
    v3.set(x, y, Z(z)).project(camera);
    if (v3.z > 1) return null;
    return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H };
  }
  function drawOverlay(g, dt, labels) {
    const c = octx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    // имена: без плашек, лёгкая волна, ближние приоритетнее
    c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
    labels.sort((a, b) => a.dz - b.dz);
    const boxes = [];
    for (const lb of labels) {
      const p = project(lb.x, lb.y, lb.z); if (!p) continue;
      const dist = lb.z - (g.pz - camState.back);
      const size = clamp(H * 0.62 / dist * 0.55, 10, 17);
      c.font = '700 ' + size + 'px "Golos Text", system-ui, sans-serif';
      const w = c.measureText(lb.name).width;
      const box = { x0: p.x - w / 2 - 2, x1: p.x + w / 2 + 2, y0: p.y - size - 2, y1: p.y + 4 };
      if (boxes.some((b) => b.x0 < box.x1 && b.x1 > box.x0 && b.y0 < box.y1 && b.y1 > box.y0)) continue;
      boxes.push(box);
      c.globalAlpha = clamp((70 - lb.dz) / 20, 0, 1);
      c.lineWidth = Math.max(2.5, size * 0.24); c.strokeStyle = 'rgba(30,11,46,0.85)'; c.fillStyle = lb.star ? '#ffd23f' : '#ffffff'; // звёзды бега — золотом
      let x = p.x - w / 2, i = 0;
      const amp = reduced ? 0 : size * 0.12;
      for (const ch of lb.name) {
        const cw = c.measureText(ch).width, y = p.y + Math.sin(time * 4 + i * 0.55) * amp;
        c.strokeText(ch, x, y); c.fillText(ch, x, y); x += cw; i++;
      }
    }
    c.globalAlpha = 1;
    const ps = project(g.px, g.y + 1.2, g.pz);
    R.playerScreen = ps;
    // линии скорости
    const f = D.speedFactors(g);
    const fast = !reduced && (g.boostT > 0 || f.cadF > 1.15);
    if (fast && speedLines.length < 26 && Math.random() < 0.8) {
      const side = Math.random() < 0.5 ? -1 : 1;
      speedLines.push({ x: W / 2 + side * W * (0.3 + Math.random() * 0.2), y: H * (0.35 + Math.random() * 0.55), v: 0, side, life: 0.35, c: g.boostT > 0 ? (Math.random() < 0.5 ? PINK : LIME) : '#ffffff' });
    }
    c.lineCap = 'round';
    const hor = H * 0.4;
    for (let i = speedLines.length - 1; i >= 0; i--) {
      const l = speedLines[i]; l.life -= dt; l.v += dt * 2600;
      if (l.life <= 0) { speedLines.splice(i, 1); continue; }
      const dx = l.side * l.v * dt * 6, dy = (l.y - hor) * 0.12;
      c.strokeStyle = l.c; c.globalAlpha = l.life * 1.6; c.lineWidth = 2;
      c.beginPath(); c.moveTo(l.x, l.y); c.lineTo(l.x + dx, l.y + dy * l.life); c.stroke();
      l.x += l.side * l.v * dt * 0.6; l.y += (l.y - hor) * dt * 1.5;
    }
    c.globalAlpha = 1;
    if (g.pickT > 0 && ps) {
      const p = 1 - g.pickT / 0.5, s = H * 0.09;
      c.strokeStyle = g.pickColor; c.globalAlpha = (1 - p) * 0.9; c.lineWidth = 3;
      c.beginPath(); c.arc(ps.x, ps.y, s * (0.4 + p * 0.9), 0, 7); c.stroke();
      c.fillStyle = g.pickColor;
      for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; c.beginPath(); c.arc(ps.x + Math.cos(a) * s * (0.3 + p), ps.y + Math.sin(a) * s * (0.3 + p) - p * s * 0.4, 3, 0, 7); c.fill(); }
      c.globalAlpha = 1;
    }
    if (g.flashT > 0) { c.fillStyle = 'rgba(255,255,255,' + (g.flashT / 0.4) * (reduced ? 0.25 : 0.55) + ')'; c.fillRect(0, 0, W, H); }
    if (g.hitT > 0) {
      const col = '255,122,26', a = g.hitT / 0.45 * 0.3;
      const vg = c.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.3, W / 2, H * 0.55, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(' + col + ',0)'); vg.addColorStop(1, 'rgba(' + col + ',' + a + ')');
      c.fillStyle = vg; c.fillRect(0, 0, W, H);
    }
  }

  /* ---------- герой на стартовом экране ---------- */
  let hero = null;
  R.drawHero = function (canvas, t) {
    if (!hero) {
      const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      const s = new THREE.Scene();
      s.add(new THREE.HemisphereLight('#fff0fa', '#5a2a6a', 0.55));
      const dl = new THREE.DirectionalLight('#ffffff', 0.85); dl.position.set(4, 4, 3); s.add(dl);
      const rim = new THREE.DirectionalLight('#c8ff1a', 0.5); rim.position.set(-3, 2, -2); s.add(rim);
      const rig = D.Chars.buildRig({ skin: '#d49a72', hair: '#2e211a', shirt: PINK, shorts: '#121216', shoes: '#f4f4f4', cap: PINK, stripe: '#2a2a30' }, { shirtTex: D.Tex.shirt() });
      s.add(rig.root);
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: '#1e0b2e', transparent: true, opacity: 0.3 }));
      shadow.position.y = 0.005; s.add(shadow);
      const c = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      hero = { r, s, rig, c };
    }
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const pr = Math.min(G.devicePixelRatio || 1, 2);
    if (hero.w !== w || hero.h !== h) { hero.r.setPixelRatio(pr); hero.r.setSize(w, h, false); hero.c.aspect = w / h; hero.c.updateProjectionMatrix(); hero.w = w; hero.h = h; }
    D.Chars.poseRun(hero.rig, reduced ? 0.8 : t * 5.4, 1, 0.13);
    hero.rig.root.rotation.y = reduced ? 0.35 : 0.35 * Math.sin(t * 0.4);
    hero.c.position.set(0, 1.35, 4.6); hero.c.lookAt(0, 0.95, 0);
    hero.r.render(hero.s, hero.c);
  };
  R.disposeHero = function () { if (hero) { hero.r.dispose(); hero = null; } };
  R.refreshShirt = function () { D.Tex.redrawShirt(); };
})(typeof globalThis !== 'undefined' ? globalThis : window);
