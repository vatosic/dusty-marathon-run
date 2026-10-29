/* Часть 1 · Дизайн и графика — 3D-набережная: дорога, река, город, мосты, ориентиры */
(function (G) {
  'use strict';
  const D = G.DUSTY;
  const W3 = (D.World3D = {});
  const PI = Math.PI;
  const PINK = '#ff2e93', VIOLET = '#6c2bd9', LIME = '#c8ff1a', INK = '#1e0b2e';

  const Z = (z) => -z; // мировая координата → Three.js (вперёд = −z)

  function std(color, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0 }, extra || {})); }
  function lambert(color, extra) { return new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {})); }

  function boxAt(geo, mat, x0, x1, y0, y1, z0, z1) {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(x1 - x0, y1 - y0, z1 - z0);
    m.position.set((x0 + x1) / 2, y0, -(z0 + z1) / 2);
    return m;
  }

  W3.build = function (scene, g) {
    const root = new THREE.Group(); root.name = 'world';
    scene.add(root);
    const sc = g.scenery, L = D.WORLD_LEN;
    const z0 = -80, z1 = L + 320, len = z1 - z0;
    const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const T = D.Tex;
    const state = { root, landmarks: [], boats: [], dynamic: [], kremlinFrom: D.kmToZ(39.3) };

    /* ---- земля по районам ---- */
    {
      const segs = Math.ceil(len / 20);
      const geo = new THREE.PlaneGeometry(300, len, 1, segs).rotateX(-PI / 2).translate(-150 - 7.5, 0, -(z0 + len / 2));
      const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const wz = -pos.getZ(i);
        const di = D.findDistrict(Math.max(0, Math.min(42.19, D.zToKm(wz))));
        c.set(D.DISTRICTS[di].ground);
        colors.set([c.r, c.g, c.b], i * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const m = new THREE.Mesh(geo, lambert('#ffffff', { vertexColors: true }));
      m.receiveShadow = true; root.add(m);
    }
    const strip = (x0, x1, y, mat, rep) => {
      const geo = new THREE.PlaneGeometry(x1 - x0, len).rotateX(-PI / 2).translate((x0 + x1) / 2, y, -(z0 + len / 2));
      if (rep) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rep[0], uv.getY(i) * rep[1]); }
      const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; root.add(m); return m;
    };
    // тестовый режим: слева от трёх полос игрока — отдельная дорожка соперников, тротуар уже
    const RL = !!g.rivalLane, roadL = RL ? D.RIVAL_LANE.left : -2.45;
    strip(-7.5, roadL - 0.3, 0.06, lambert('#ffffff', { map: T.tiles('#c3bbae', 'rgba(90,80,70,0.35)') }), [(roadL - 0.3 + 7.5) / 1.6, len / 1.6]);
    strip(2.75, 6.2, 0.06, lambert('#ffffff', { map: T.tiles('#b2a69c', 'rgba(70,60,55,0.35)') }), [2, len / 1.6]);
    // дорога: асфальт до Лужников и после, между ними — беговое покрытие (куски встык, без наложения)
    {
      const ta = D.kmToZ(D.TRACK_KM[0]), tb = D.kmToZ(D.TRACK_KM[1]);
      // кусок покрытия: x0…x1 по ширине, u0…u1 — какой участок текстуры (у дорожки соперников — без разметки полос)
      const road = (za, zb, mat, repY, x0, x1, u0, u1) => {
        const geo = new THREE.PlaneGeometry(x1 - x0, zb - za).rotateX(-PI / 2).translate((x0 + x1) / 2, 0, -(za + zb) / 2);
        const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), uv.getY(i) * repY);
        const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; root.add(m);
      };
      const asph = lambert('#ffffff', { map: T.asphalt() }), tart = lambert('#ffffff', { map: T.tartan() });
      const lanes = (x0, x1, u0, u1) => {
        road(z0, ta, asph, (ta - z0) / 8, x0, x1, u0, u1); road(tb, z1, asph, (z1 - tb) / 8, x0, x1, u0, u1);
        road(ta, tb, tart, (tb - ta) / 6, x0, x1, u0, u1);
      };
      lanes(-2.45, 2.45, 0, 1);
      if (RL) lanes(roadL, -2.45, 0.4, 0.6);
      const lineM = new THREE.MeshBasicMaterial({ color: '#ffffff' });
      for (const zz of [ta, tb]) root.add(boxAt(unitBox, lineM, roadL, 2.45, 0, 0.015, zz - 0.17, zz + 0.17));
    }
    const curbMat = lambert('#dcd5c8');
    for (const [a, b] of [[roadL - 0.3, roadL], [2.45, 2.75]]) { const m = boxAt(unitBox, curbMat, a, b, 0, 0.12, z0, z1); m.receiveShadow = true; root.add(m); }
    if (RL) {
      // разделитель: сплошная белая линия и конусы каждые 6 м
      root.add(boxAt(unitBox, new THREE.MeshBasicMaterial({ color: '#ffffff' }), -2.52, -2.38, 0, 0.012, z0, z1));
      const n = Math.floor((z1 - z0) / 6), mt = new THREE.Matrix4();
      const cone = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.5, 12).translate(0, 0.25, 0), lambert('#ff7a1a'), n);
      const band = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.105, 0.125, 0.09, 12).translate(0, 0.27, 0), lambert('#ffffff'), n);
      for (let i = 0; i < n; i++) { mt.makeTranslation(-2.45, 0, Z(z0 + i * 6 + 3)); cone.setMatrixAt(i, mt); band.setMatrixAt(i, mt); }
      for (const im of [cone, band]) { im.frustumCulled = false; root.add(im); }
      cone.castShadow = true;
    }
    // гранитный парапет
    {
      const gt = T.granite().clone(); gt.needsUpdate = true; gt.repeat.set(len / 4, 1);
      const m = boxAt(unitBox, lambert('#ffffff', { map: gt }), 6.2, 6.9, 0, 1.0, z0, z1); m.castShadow = true; m.receiveShadow = true; root.add(m);
      const top = boxAt(unitBox, lambert('#c6bbb1'), 6.15, 6.95, 1.0, 1.08, z0, z1); root.add(top);
      const posts = new THREE.InstancedMesh(unitBox, lambert('#9b8f86'), sc.posts.length);
      const mt = new THREE.Matrix4();
      sc.posts.forEach((p, i) => { mt.compose(new THREE.Vector3(6.55, 0, Z(p.z)), new THREE.Quaternion(), new THREE.Vector3(0.42, 1.32, 0.42)); posts.setMatrixAt(i, mt); });
      posts.frustumCulled = false; posts.castShadow = true; root.add(posts);
    }
    // река
    {
      const wt = T.water().clone(); wt.needsUpdate = true; wt.repeat.set(10, len / 26);
      const geo = new THREE.PlaneGeometry(260, len).rotateX(-PI / 2).translate(6.9 + 130, -2.3, -(z0 + len / 2));
      const mat = new THREE.MeshPhongMaterial({ color: '#4a8fb0', map: wt, shininess: 80, specular: '#b8e2f5' });
      root.add(new THREE.Mesh(geo, mat));
      state.water = wt;
      const wall = boxAt(unitBox, lambert('#8d8079'), 6.9, 7.1, -2.3, 1.0, z0, z1); root.add(wall);
    }

    /* ---- здания: стили по районам, две линии застройки; том берег ---- */
    D.Arch3D.buildCity(root, sc);
    {
      const r = D.rng(g.seed ^ 77);
      const farLm = D.LANDMARKS_FAR.map((l) => D.kmToZ(l.km));
      const far = new D.Arch3D.Batch(unitBox, D.Arch3D.facade('#2c3e57'));
      const farStyles = [['stalin', 0.35], ['merchant', 0.25], ['modern', 0.2], ['panel', 0.2]];
      for (let z = -60; z < L + 300; z += 14 + r() * 16) {
        const len = 12 + r() * 14, k = D.zToKm(z);
        if ((k > 22.5 && k < 28.5) || farLm.some((fz) => Math.abs(fz - z) < 45)) continue; // Воробьёвы горы и ориентиры
        let x = r(), style = farStyles[0][0];
        for (const [st, w] of farStyles) { x -= w; if (x <= 0) { style = st; break; } }
        const S = D.STYLES[style];
        far.add(84, -2.3, Z(z + len / 2), 14, D.lerp(S.h[0], S.h[1], r()) * 1.1, len, S.pal[Math.floor(r() * S.pal.length)], 0, { panel: 0, stalin: 1, merchant: 2, modern: 4 }[style]);
      }
      far.build(root, true);
      // Воробьёвы горы напротив Лужников
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, PI * 2, 0, PI / 2), lambert('#6e9a63'));
      hill.scale.set(60, 26, 380); hill.position.set(110, -2.3, Z(D.kmToZ(25.2))); root.add(hill);
      const bank = boxAt(unitBox, lambert('#8a9a7a'), 74, 300, -2.3, -1.4, z0, z1); root.add(bank);
    }
    // Кремлёвская стена
    {
      const kb = sc.buildings.filter((b) => b.kremlin);
      const red = lambert('#b23a2c');
      const im = new THREE.InstancedMesh(unitBox, red, kb.length);
      const mt = new THREE.Matrix4(), q = new THREE.Quaternion();
      kb.forEach((b, i) => { mt.compose(new THREE.Vector3(b.xf - 3, 0, Z(b.z + b.len / 2)), q, new THREE.Vector3(6, 7, b.len + 0.05)); im.setMatrixAt(i, mt); });
      im.frustumCulled = false; im.receiveShadow = true; root.add(im);
      if (kb.length) {
        const from = kb[0].z, to = kb[kb.length - 1].z + 30;
        const n = Math.floor((to - from) / 1.7);
        const mer = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 1.0, 0.85).translate(0, 0.5, 0), red, n);
        for (let i = 0; i < n; i++) { mt.compose(new THREE.Vector3(-9.2, 7, Z(from + i * 1.7)), q, new THREE.Vector3(1, 1, 1)); mer.setMatrixAt(i, mt); }
        mer.frustumCulled = false; root.add(mer);
      }
      const towerBody = new THREE.BoxGeometry(5.2, 1, 5.2).translate(0, 0.5, 0);
      const roof = new THREE.ConeGeometry(3.3, 9, 4).rotateY(PI / 4).translate(0, 4.5, 0);
      const star = new THREE.OctahedronGeometry(0.9);
      const green = lambert('#2f6a46'), starM = new THREE.MeshBasicMaterial({ color: '#ff3b2e' }), white = lambert('#f2ece2');
      for (const t of sc.towers) {
        const h = t.tall ? 20 : 14;
        const grp = new THREE.Group(); grp.position.set(t.x - 2, 0, Z(t.z));
        const body = new THREE.Mesh(towerBody, red); body.scale.y = h; grp.add(body);
        const band = new THREE.Mesh(towerBody, white); band.scale.set(1.03, 0.5, 1.03); band.position.y = h * 0.62; grp.add(band);
        const top = new THREE.Mesh(towerBody, red); top.scale.set(0.72, 4, 0.72); top.position.y = h; grp.add(top);
        const r2 = new THREE.Mesh(roof, green); r2.position.y = h + 4; grp.add(r2);
        const s2 = new THREE.Mesh(star, starM); s2.position.y = h + 14; grp.add(s2);
        root.add(grp);
      }
    }

    /* ---- деревья и фонари ---- */
    {
      const n = sc.trees.length;
      const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, 1, 6).translate(0, 0.5, 0), lambert('#5a4030'), n);
      const crownGeo = new THREE.IcosahedronGeometry(1, 1);
      const crownMat = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
      const crownA = new THREE.InstancedMesh(crownGeo, crownMat, n), crownB = new THREE.InstancedMesh(crownGeo, crownMat, n);
      const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), v = new THREE.Vector3(), s = new THREE.Vector3();
      sc.trees.forEach((t, i) => {
        const h = t.h;
        mt.compose(v.set(t.x, 0, Z(t.z)), q, s.set(1, h * 0.5, 1)); trunk.setMatrixAt(i, mt);
        const pop = t.kind === 'poplar';
        mt.compose(v.set(t.x, h * (pop ? 0.62 : 0.68), Z(t.z)), q, pop ? s.set(0.95, h * 0.42, 0.95) : s.set(1.9, h * 0.3, 1.9)); crownA.setMatrixAt(i, mt);
        mt.compose(v.set(t.x + 0.5, h * (pop ? 0.8 : 0.8), Z(t.z) - 0.4), q, pop ? s.set(0.6, h * 0.25, 0.6) : s.set(1.2, h * 0.2, 1.2)); crownB.setMatrixAt(i, mt);
        crownA.setColorAt(i, c.set(t.tone < 0.5 ? '#4b8a3d' : '#3f7a3a'));
        crownB.setColorAt(i, c.set(t.tone < 0.5 ? '#68a84f' : '#5c9c54'));
      });
      for (const im of [trunk, crownA, crownB]) { im.frustumCulled = false; root.add(im); }
      trunk.castShadow = crownA.castShadow = true;
      const ln = sc.lamps.length;
      const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.09, 1, 6).translate(0, 0.5, 0), lambert('#2d2f38'), ln);
      const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.07, 0.07).translate(-0.45, 0, 0), lambert('#2d2f38'), ln);
      const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6).scale(1.3, 0.6, 1), new THREE.MeshBasicMaterial({ color: '#fff4cf' }), ln);
      const qq = new THREE.Quaternion();
      sc.lamps.forEach((l, i) => {
        mt.compose(v.set(l.x, 0, Z(l.z)), q, s.set(1, 4.8, 1)); pole.setMatrixAt(i, mt);
        qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), l.side > 0 ? 0 : PI);
        mt.compose(v.set(l.x, 4.75, Z(l.z)), qq, s.set(1, 1, 1)); arm.setMatrixAt(i, mt);
        mt.compose(v.set(l.x - l.side * 0.85, 4.7, Z(l.z)), q, s.set(1, 1, 1)); head.setMatrixAt(i, mt);
      });
      for (const im of [pole, arm, head]) { im.frustumCulled = false; root.add(im); }
      pole.castShadow = true;
    }

    /* ---- мосты ---- */
    {
      const shape = new THREE.Shape();
      shape.moveTo(6.9, -2.3); shape.lineTo(80, -2.3); shape.lineTo(80, 5.6); shape.lineTo(6.9, 5.6); shape.closePath();
      for (let i = 0; i < 4; i++) {
        const x0 = 7.6 + i * 18;
        const hole = new THREE.Path();
        hole.moveTo(x0 + 2, -2.3); hole.lineTo(x0 + 2, 0.4); hole.quadraticCurveTo(x0 + 9, 6.2, x0 + 16, 0.4); hole.lineTo(x0 + 16, -2.3); hole.closePath();
        shape.holes.push(hole);
      }
      const archGeo = new THREE.ExtrudeGeometry(shape, { depth: 9, bevelEnabled: false });
      const cols = ['#9aa3ad', '#c4ae94', '#7d978d'];
      for (const b of sc.bridges) {
        const mat = lambert(cols[b.variant]), dark = lambert(new THREE.Color(cols[b.variant]).multiplyScalar(0.7));
        const grp = new THREE.Group(); grp.position.z = Z(b.z + 9);
        const arches = new THREE.Mesh(archGeo, mat); grp.add(arches);
        const deck = boxAt(unitBox, dark, -14, 80, 5.6, 7.8, 0, 9); deck.position.z = -4.5 * -1 + 0; deck.position.z = 4.5; deck.castShadow = true; grp.add(deck);
        const pier = boxAt(unitBox, mat, -14, -3.1, 0, 5.6, 0, 9); pier.position.z = 4.5; grp.add(pier);
        for (const zz of [0.2, 8.8]) {
          const rail = boxAt(unitBox, lambert('#5d636b'), -14, 80, 7.8, 8.7, 0, 0.12); rail.position.z = zz; grp.add(rail);
        }
        root.add(grp);
      }
    }

    /* ---- ориентиры: объёмные модели на нашем и на том берегу ---- */
    for (const lm of sc.landmarks) {
      const m = D.Arch3D.landmark(lm.kind);
      m.position.set(lm.x, 0, Z(lm.z)); root.add(m);
      state.landmarks.push({ mesh: m, z: lm.z });
    }
    for (const lm of D.LANDMARKS_FAR) {
      const m = D.Arch3D.landmark(lm.kind), zz = D.kmToZ(lm.km);
      m.position.set(lm.x, lm.kind === 'petr' ? 0 : -1.4, Z(zz));
      if (lm.kind !== 'petr') m.rotation.y = PI; // фасадом к реке
      root.add(m); state.landmarks.push({ mesh: m, z: zz });
    }

    /* ---- арки: старт, точка Дасти, финиш ---- */
    const arch = (z, text, kind) => {
      const grp = new THREE.Group(); grp.position.z = Z(z);
      const pc = kind === 'finish' ? '#ffffff' : kind === 'start' ? VIOLET : kind === 'km' ? LIME : kind === 'luzh' ? '#ffffff' : PINK;
      const pm = std(pc);
      for (const s of [-1, 1]) { const p = boxAt(unitBox, pm, s * 3.25 - 0.18, s * 3.25 + 0.18, 0, 5.7, -0.18, 0.18); p.position.z = 0; p.castShadow = true; grp.add(p); }
      const face = new THREE.MeshBasicMaterial({ map: T.text(text, kind === 'finish' ? { bg: '#1e0b2e', fg: '#ffffff', checker: true, w: 1024, h: 192 } : kind === 'start' ? { bg: VIOLET, fg: LIME, stripe: LIME, w: 1024, h: 192 }
        : kind === 'km' ? { bg: VIOLET, fg: '#ffffff', stripe: LIME, w: 1024, h: 192 } : kind === 'luzh' ? { bg: '#c8102e', fg: '#ffffff', stripe: '#ffffff', w: 1024, h: 192 } : { bg: PINK, fg: '#ffffff', stripe: LIME, w: 1024, h: 192 }) });
      const side = std(kind === 'finish' ? INK : kind === 'km' ? VIOLET : kind === 'luzh' ? '#c8102e' : pc);
      const banner = new THREE.Mesh(new THREE.BoxGeometry(6.9, 1.3, 0.3), [side, side, side, side, face, face]);
      banner.position.y = 5.3; banner.castShadow = true; grp.add(banner);
      root.add(grp);
      return grp;
    };
    arch(D.START_Z, 'СТАРТ', 'start');
    arch(L, 'ФИНИШ', 'finish');
    arch(D.kmToZ(D.TRACK_KM[0]) - 1.5, 'ЛУЖНИКИ', 'luzh');
    for (const k of D.KM_MARKS) arch(D.kmToZ(k), k + ' КМ', 'km');
    const dustyArch = arch(sc.dj.z - 6, 'DUSTY · ПЫЛЬНЫЕ ГАНТЕЛИ', 'dusty');
    // гирлянда шаров на арке Дасти
    const balls = [];
    for (let i = 0; i < 11; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), std(i % 2 ? LIME : VIOLET, { roughness: 0.3 }));
      b.position.set(-3.2 + i * 0.64, 6.15, 0); dustyArch.add(b); balls.push(b);
    }
    state.balls = balls;

    /* ---- точка Дасти: шатёр, пульт, колонки ---- */
    {
      const grp = new THREE.Group();
      grp.position.set(sc.dj.x, 0.06, Z(sc.dj.z)); grp.rotation.y = -1.05;
      const tent = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.3, 4).rotateY(PI / 4), std(PINK)); tent.position.y = 3.35; tent.castShadow = true; grp.add(tent);
      const valance = boxAt(unitBox, std(VIOLET), -2.05, 2.05, 2.55, 2.75, -2.05, 2.05); grp.add(valance);
      for (const [px, pz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) { const p = boxAt(unitBox, std('#dddddd'), px - 0.04, px + 0.04, 0, 2.6, pz - 0.04, pz + 0.04); grp.add(p); }
      const front = new THREE.MeshBasicMaterial({ map: T.text('DUSTY', { bg: '#1b1b22', fg: LIME, w: 512, h: 220 }) });
      const tm = std('#1b1b22');
      const table = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.05, 0.8).translate(0, 0.525, 0), [tm, tm, tm, tm, front, tm]);
      table.position.z = 0.6; table.castShadow = true; grp.add(table);
      const deckM = std('#333340', { roughness: 0.4 });
      for (const s of [-0.55, 0.55]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 20), deckM); d.position.set(s, 1.08, 0.6); grp.add(d); }
      const spk = [];
      for (const s of [-1, 1]) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.7).translate(0, 0.9, 0), std('#15151b'));
        box.position.set(s * 2.25, 0, 0.7); box.castShadow = true; grp.add(box);
        for (const [yy, rr] of [[1.25, 0.28], [0.5, 0.22]]) {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr * 0.7, 0.08, 18).rotateX(PI / 2), std('#3a3a48', { roughness: 0.4 }));
          w.position.set(s * 2.25, yy, 1.07); grp.add(w); spk.push(w);
        }
      }
      const flagM = new THREE.MeshLambertMaterial({ map: T.text('DUSTY', { bg: PINK, fg: '#ffffff', stripe: LIME, w: 256, h: 128 }), side: THREE.DoubleSide });
      for (const s of [-1, 1]) {
        const pole = boxAt(unitBox, std('#dddddd'), -0.03, 0.03, 0, 4.2, -0.03, 0.03); pole.position.set(s * 3.2, 0, 1.2); grp.add(pole);
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), flagM); fl.position.set(s * 3.2 + 0.6, 3.85, 1.2); grp.add(fl);
      }
      root.add(grp);
      state.speakers = spk;
    }

    /* ---- рейв: точки поддержки Дасти со светомузыкой; на главной — баржа-сцена DJ KIM ---- */
    state.raves = [];
    {
      const RAVE_COL = ['#ff2e93', '#6c2bd9', '#c8ff1a', '#21c6c6', '#ff7a1a'];
      const additive = (color, opacity) => new THREE.MeshBasicMaterial({ color, map: T.beam(), transparent: true, opacity: opacity == null ? 0.55 : opacity,
        depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
      // конус луча: источник в начале координат, луч вдоль −y
      const beamGeo = (len, r) => new THREE.CylinderGeometry(0.06, r, len, 14, 1, true).translate(0, -len / 2, 0);
      const truss = std('#2a2a33', { metalness: 0.6, roughness: 0.4 });
      const strobeMat = () => new THREE.SpriteMaterial({ map: T.radial('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      for (const rv of sc.raves) {
        const grp = new THREE.Group(); grp.position.z = Z(rv.z); root.add(grp);
        const R = { z: rv.z, main: rv.main, grp, heads: [], lasers: [], strobes: [], sky: [], range: rv.main ? 430 : 260 };
        const head = (parent, x, y, z, len, r, i) => {
          const pivot = new THREE.Group(); pivot.position.set(x, y, z); parent.add(pivot);
          const can = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), truss); pivot.add(can);
          const b = new THREE.Mesh(beamGeo(len, r), additive(RAVE_COL[i % RAVE_COL.length])); pivot.add(b);
          R.heads.push({ pivot, beam: b, i });
        };
        if (rv.main) {
          // баржа у набережной: корпус, подиум, LED-стена, ферма
          const barge = new THREE.Group(); barge.position.set(13.5, 0, -6); grp.add(barge);
          barge.add(boxAt(unitBox, std('#1c2433'), -5, 5, -2.6, -0.9, -9, 9));
          barge.add(boxAt(unitBox, std('#15151b'), -4.2, 4.2, -0.9, 0.4, -7, 7));
          const ledCanvas = document.createElement('canvas'); ledCanvas.width = 512; ledCanvas.height = 256;
          const ledTex = new THREE.CanvasTexture(ledCanvas);
          const led = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.6), new THREE.MeshBasicMaterial({ map: ledTex, fog: false }));
          led.position.set(1.5, 2.8, 0); led.rotation.y = -PI / 2.6; barge.add(led);
          R.led = { canvas: ledCanvas, tex: ledTex, mesh: led, t: 0 };
          const frame = new THREE.Group(); frame.position.copy(led.position); frame.rotation.copy(led.rotation); barge.add(frame);
          for (const sx of [-4.9, 4.9]) frame.add(boxAt(unitBox, truss, sx - 0.15, sx + 0.15, -2.5, 3.6, -0.15, 0.15));
          frame.add(boxAt(unitBox, truss, -5.1, 5.1, 3.5, 3.85, -0.2, 0.2));
          for (let i = 0; i < 6; i++) head(frame, -4.2 + i * 1.68, 3.4, 0.5, 34, 2.4, i);
          // лазеры над трассой
          for (let i = 0; i < 7; i++) {
            const pivot = new THREE.Group(); pivot.position.set(-4, 3.2, -2 + i * 0.6); barge.add(pivot);
            const ln = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 34).translate(0, 0, -17), new THREE.MeshBasicMaterial({ color: i % 2 ? '#39ff6a' : '#ff2e93', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
            pivot.add(ln); R.lasers.push({ pivot, i, mat: ln.material });
          }
          // прожекторы в небо — видны издалека
          for (const sx of [-4, 4]) {
            const pivot = new THREE.Group(); pivot.position.set(sx, 0.5, sx * 1.5); barge.add(pivot);
            const b = new THREE.Mesh(beamGeo(120, 3.5), additive('#ffffff', 0.22)); b.rotation.x = PI; pivot.add(b);
            R.sky.push({ pivot, sx });
          }
          for (let i = 0; i < 4; i++) { const sp = new THREE.Sprite(strobeMat()); sp.scale.set(1.6, 1.6, 1); sp.position.set(-0.5, 6.2, -4 + i * 2.6); barge.add(sp); R.strobes.push(sp); }
          // колонки на набережной
          for (const zz of [-9, 9]) {
            const stack = boxAt(unitBox, std('#15151b'), 3.6, 4.6, 0, 2.6, zz - 0.5, zz + 0.5); stack.position.z = Z(zz); grp.add(stack);
          }
        } else {
          // точка поддержки: арка-ферма над набережной, колонки, лучи
          const arch2 = new THREE.Group(); arch2.position.set(4.4, 0, 0); grp.add(arch2);
          for (const sx of [-1.4, 1.6]) arch2.add(boxAt(unitBox, truss, sx - 0.12, sx + 0.12, 0, 4.2, -0.12, 0.12));
          arch2.add(boxAt(unitBox, truss, -1.55, 1.75, 4.1, 4.4, -0.15, 0.15));
          const ban = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.7, 0.08), [std(PINK), std(PINK), std(PINK), std(PINK),
            new THREE.MeshBasicMaterial({ map: T.text('DUSTY RAVE', { bg: INK, fg: LIME, stripe: PINK, w: 512, h: 128 }) }), new THREE.MeshBasicMaterial({ map: T.text('DUSTY RAVE', { bg: INK, fg: LIME, stripe: PINK, w: 512, h: 128 }) })]);
          ban.position.set(0.1, 3.7, 0.2); arch2.add(ban);
          for (let i = 0; i < 4; i++) head(arch2, -1.2 + i * 0.85, 4.25, 0.3, 18, 1.4, i + 1);
          for (const zz of [-3.5, 3.5]) { const st2 = boxAt(unitBox, std('#15151b'), 4.6, 5.6, 0, 2.1, -0.45, 0.45); st2.position.z = zz; grp.add(st2); }
          for (let i = 0; i < 2; i++) { const sp = new THREE.Sprite(strobeMat()); sp.scale.set(1.1, 1.1, 1); sp.position.set(3.4 + i * 2.2, 4.3, 0.3); grp.add(sp); R.strobes.push(sp); }
        }
        state.raves.push(R);
      }

      // Лужники: вся правая сторона — зона поддержки Дасти. Сцены диджеев на понтонах за парапетом (общая LED-картинка),
      // прожекторы на парапете и светодиодная лента вдоль всей зоны — мигают в такт
      if (sc.zone) {
        const ledCanvas = document.createElement('canvas'); ledCanvas.width = 512; ledCanvas.height = 256;
        const ledTex = new THREE.CanvasTexture(ledCanvas);
        state.zoneLed = { canvas: ledCanvas, tex: ledTex, t: 0, title: 'DUSTY', sub: 'ПЫЛЬНЫЕ ГАНТЕЛИ · ТЕХНО' };
        const ledMat = new THREE.MeshBasicMaterial({ map: ledTex, fog: false });
        const pont = std('#1c2433'), deck = std('#15151b'), desk = std('#26262e', { metalness: 0.3, roughness: 0.5 });
        const banMat = new THREE.MeshBasicMaterial({ map: T.text('DUSTY RAVE', { bg: INK, fg: LIME, stripe: PINK, w: 512, h: 128 }) });
        const laserMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
        const laserGeo = new THREE.BoxGeometry(0.035, 0.035, 30).translate(0, 0, -15);
        for (const sg of sc.stages) {
          const grp = new THREE.Group(); grp.position.set(sg.x, 0, Z(sg.z)); root.add(grp);
          const R = { z: sg.z, main: false, grp, heads: [], lasers: [], strobes: [], sky: [], range: 240 };
          grp.add(boxAt(unitBox, pont, -2.2, 3.4, -2.6, 0.45, -4.2, 4.2));
          grp.add(boxAt(unitBox, deck, -1.8, 3.2, 0.45, 0.75, -3.8, 3.8));
          // сцена развёрнута к набегающим бегунам
          const set = new THREE.Group(); set.rotation.y = 0.6; grp.add(set);
          set.add(boxAt(unitBox, desk, -1.3, -0.5, 0.75, 1.75, -1.3, 1.3));
          for (const sz of [-0.9, 0.9]) set.add(boxAt(unitBox, deck, -1.2, -0.6, 1.75, 1.82, sz - 0.3, sz + 0.3));
          const scr = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.7), ledMat); scr.position.set(1.4, 2.6, 0); scr.rotation.y = -PI / 2; set.add(scr);
          for (const sz of [-3, 3]) set.add(boxAt(unitBox, truss, 1.75, 2.05, 0.75, 4.9, sz - 0.15, sz + 0.15));
          set.add(boxAt(unitBox, truss, 1.7, 2.1, 4.8, 5.1, -3.2, 3.2));
          const ban = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 4.4), banMat); ban.position.set(1.62, 4.35, 0); set.add(ban);
          for (const sz of [-3.6, 3.6]) set.add(boxAt(unitBox, deck, -1.1, 0, 0.75, 2.6, sz - 0.5, sz + 0.5)); // колонки
          for (let i = 0; i < 4; i++) {
            const pivot = new THREE.Group(); pivot.position.set(1.9, 4.75, -2.4 + i * 1.6); set.add(pivot);
            pivot.add(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), truss));
            const b = new THREE.Mesh(beamGeo(24, 1.7), additive(RAVE_COL[(i + sc.stages.indexOf(sg)) % RAVE_COL.length])); pivot.add(b);
            R.heads.push({ pivot, beam: b, i: i + 2 });
          }
          for (let i = 0; i < 2; i++) {
            const pivot = new THREE.Group(); pivot.position.set(1.6, 4.4, -1 + i * 2); set.add(pivot);
            const ln = new THREE.Mesh(laserGeo, laserMat(i ? '#39ff6a' : '#ff2e93')); pivot.add(ln); R.lasers.push({ pivot, i: i * 3, mat: ln.material });
          }
          for (const sz of [-3, 3]) { const sp = new THREE.Sprite(strobeMat()); sp.scale.set(1.3, 1.3, 1); sp.position.set(1.9, 5.4, sz); set.add(sp); R.strobes.push(sp); }
          R.led = state.zoneLed; R.ledShared = true;
          state.raves.push(R);
        }
        // прожекторы на парапете — лучи в небо
        const zc = (sc.zone.z0 + sc.zone.z1) / 2, zg = new THREE.Group(); zg.position.z = Z(zc); root.add(zg);
        const RZ = { z: zc, main: false, grp: zg, heads: [], lasers: [], strobes: [], sky: [], range: (sc.zone.z1 - sc.zone.z0) / 2 + 200 };
        for (let z = sc.zone.z0 + 8, k = 0; z < sc.zone.z1; z += 30, k++) {
          const pivot = new THREE.Group(); pivot.position.set(6.55, 1.1, -(z - zc)); zg.add(pivot);
          pivot.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), truss));
          const b = new THREE.Mesh(beamGeo(60, 2.2), additive(RAVE_COL[k % RAVE_COL.length], 0.3)); b.rotation.x = PI; pivot.add(b);
          RZ.sky.push({ pivot, sx: k * 1.7 });
        }
        state.raves.push(RZ);
        // светодиодная лента по парапету
        const n = Math.floor((sc.zone.z1 - sc.zone.z0) / 1.2);
        const strip = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.07, 0.9), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }), n);
        const mt = new THREE.Matrix4(), col = new THREE.Color('#ffffff');
        for (let i = 0; i < n; i++) { mt.makeTranslation(6.55, 1.12, Z(sc.zone.z0 + i * 1.2)); strip.setMatrixAt(i, mt); strip.setColorAt(i, col); }
        strip.frustumCulled = false; root.add(strip);
        state.zoneStrip = { mesh: strip, n, z0: sc.zone.z0, z1: sc.zone.z1 };
      }
    }

    /* ---- теплоходы ---- */
    {
      const hullShape = new THREE.Shape();
      hullShape.moveTo(-6, 0); hullShape.lineTo(6.5, 0); hullShape.lineTo(5.6, -1.3); hullShape.lineTo(-5.6, -1.3); hullShape.closePath();
      const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 3, bevelEnabled: false }).translate(0, 0, -1.5);
      const winT = T.stripes('#e9edf2', '#2b3a4f', 8, false);
      for (let i = 0; i < 4; i++) {
        const grp = new THREE.Group();
        const hull = new THREE.Mesh(hullGeo, std(['#2a5ea8', '#c23b4a', '#3b8a7a', '#ffffff'][i])); hull.position.y = 1.1; grp.add(hull);
        const deck = new THREE.Mesh(new THREE.BoxGeometry(12, 0.25, 3).translate(0, 1.2, 0), std('#f3f3f3')); grp.add(deck);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(8, 1.4, 2.6).translate(0, 2.0, 0), std('#ffffff', { map: winT })); grp.add(cab);
        const top = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 2.2).translate(-1, 3.1, 0), std('#e9edf2')); grp.add(top);
        grp.position.y = -2.3; grp.rotation.y = PI / 2;
        root.add(grp);
        state.boats.push(grp);
      }
    }

    /* ---- небо, солнце, облака, дальние силуэты ---- */
    {
      const skyMat = new THREE.ShaderMaterial({
        uniforms: { top: { value: new THREE.Color('#3d8fe0') }, mid: { value: new THREE.Color('#9fd0f2') }, hor: { value: new THREE.Color('#dcecf4') } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 vP; void main(){ float h = clamp(vP.y,0.0,1.0); vec3 c = mix(hor, mid, smoothstep(0.0,0.18,h)); c = mix(c, top, smoothstep(0.18,0.7,h)); if (vP.y < 0.0) c = hor; gl_FragColor = vec4(c,1.0); }',
        side: THREE.BackSide, depthWrite: false, fog: false
      });
      const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 24, 12), skyMat);
      sky.renderOrder = -10; scene.add(sky); state.sky = sky;
      const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.radial('rgba(255,250,225,1)', 'rgba(255,240,200,0)'), fog: false, depthWrite: false, transparent: true }));
      sun.scale.set(150, 150, 1); scene.add(sun); state.sun = sun;
      state.clouds = [];
      for (let i = 0; i < 7; i++) {
        const cl = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.cloud(), fog: false, depthWrite: false, transparent: true, opacity: 0.85 }));
        cl.scale.set(90 + i * 12, 40 + i * 4, 1); scene.add(cl);
        state.clouds.push({ s: cl, a: -0.9 + i * 0.32, h: 70 + (i % 3) * 30 });
      }
      state.backdrops = {};
      for (const k of ['city', 'mgu', 'kremlin']) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.backdrop(k), fog: false, depthWrite: false, transparent: true, opacity: 0 }));
        sp.center.set(0.5, 0); scene.add(sp); state.backdrops[k] = sp;
      }
    }
    return state;
  };

  /* ---- обновление статического мира за кадр ---- */
  W3.update = function (st, g, cam, t, km) {
    if (st.water) { st.water.offset.y = -t * 0.06; st.water.offset.x = Math.sin(t * 0.3) * 0.02; }
    // ориентиры рисуем только поблизости
    for (const l of st.landmarks) { const dz = l.z - g.pz; l.mesh.visible = dz > -70 && dz < 560; }
    // теплоходы
    const sc = g.scenery;
    let bi = 0;
    for (const b of sc.boats) {
      if (bi >= st.boats.length) break;
      const z = b.z0 + b.v * g.t;
      if (z < g.pz - 30 || z > g.pz + 330) continue;
      const m = st.boats[bi++];
      m.visible = true; m.position.set(b.x, -2.3, Z(z)); m.rotation.y = b.v > 0 ? PI / 2 : -PI / 2;
    }
    for (; bi < st.boats.length; bi++) st.boats[bi].visible = false;
    // небо: летний день → золотой час к финишу
    const late = D.clamp((km - 26) / 16, 0, 1);
    const u = st.sky.material.uniforms;
    u.top.value.set('#3d8fe0').lerp(new THREE.Color('#4f7fcf'), late);
    u.mid.value.set('#9fd0f2').lerp(new THREE.Color('#f2c9a0'), late);
    u.hor.value.set('#dcecf4').lerp(new THREE.Color('#ffe1b8'), late);
    st.sky.position.copy(cam.position);
    // видимый диск солнца впереди справа; свет падает сзади-справа, чтобы спины бегунов были освещены
    const sd = new THREE.Vector3(0.45, D.lerp(0.42, 0.2, late), -1).normalize();
    st.sun.position.copy(cam.position).addScaledVector(sd, 440);
    st.sunDir = new THREE.Vector3(0.8, D.lerp(0.7, 0.45, late), 0.35).normalize();
    for (const c of st.clouds) {
      const a = c.a + t * 0.002;
      c.s.position.set(cam.position.x + Math.sin(a) * 420, c.h, cam.position.z - Math.cos(a) * 420);
    }
    const bd = st.backdrops;
    const place = (sp, op, x, h) => {
      sp.material.opacity = op; sp.visible = op > 0.01;
      if (!sp.visible) return;
      sp.position.set(cam.position.x + x, -6, cam.position.z - 440); sp.scale.set(h * 2, h, 1);
    };
    place(bd.city, D.clamp(1 - km / 10, 0, 1) * 0.95, -120, 150 * (1.1 - km / 25));
    place(bd.mgu, D.clamp(1 - Math.abs(km - 25) / 5, 0, 1), 170, 90);
    place(bd.kremlin, D.clamp((km - 35) / 3, 0, 1), -40, 70 * (1 + D.clamp((km - 35) / 7, 0, 1) * 1.2));
    if (st.balls) st.balls.forEach((b, i) => { b.position.y = 6.15 + Math.abs(Math.sin(t * 3 + i)) * 0.1; });
    // рейв: лучи, лазеры и стробы в такт музыке (D.BPM)
    const beat = t * D.BPM / 60, bi2 = Math.floor(beat), kick = Math.pow(1 - (beat % 1), 4);
    const RAVE_COL = ['#ff2e93', '#6c2bd9', '#c8ff1a', '#21c6c6', '#ff7a1a'];
    let zoneNear = false;
    for (const R of st.raves) {
      const near = Math.abs(R.z - g.pz) < R.range;
      R.grp.visible = near;
      if (!near) continue;
      for (const h of R.heads) {
        const a = t * (0.9 + (h.i % 3) * 0.25) + h.i * 1.3;
        h.pivot.rotation.set(0.5 + 0.45 * Math.sin(a), 0, (h.i % 2 ? 1 : -1) * (0.7 + 0.5 * Math.cos(a * 0.7)));
        h.beam.material.color.set(RAVE_COL[(h.i + (bi2 >> 2)) % RAVE_COL.length]);
        h.beam.material.opacity = 0.32 + 0.4 * kick;
      }
      for (const l of R.lasers) {
        l.pivot.rotation.set(0.12 + 0.1 * Math.sin(t * 1.7 + l.i), -0.35 - 0.5 * Math.sin(t * 0.9 + l.i * 0.45), 0);
        l.mat.opacity = (bi2 + l.i) % 4 === 0 ? 0.25 : 0.85;
      }
      for (const s of R.sky) s.pivot.rotation.set(0.35 * Math.sin(t * 0.4 + s.sx), 0, 0.3 * Math.cos(t * 0.33 + s.sx));
      R.strobes.forEach((sp, i) => { sp.material.opacity = (bi2 % 8 === 7 || (bi2 + i) % 4 === 0) ? kick : 0; });
      if (R.led && !R.ledShared && (R.led.t += 1) % 2 === 0) drawLed(R.led, t, beat, kick);
      if (R.ledShared) zoneNear = true;
    }
    if (zoneNear && (st.zoneLed.t += 1) % 2 === 0) drawLed(st.zoneLed, t, beat, kick);
    const zs = st.zoneStrip;
    if (zs && g.pz > zs.z0 - 200 && g.pz < zs.z1 + 40) {
      const c = zs.c || (zs.c = new THREE.Color()), lv = 0.35 + 0.65 * kick;
      for (let i = 0; i < zs.n; i++) {
        c.set(RAVE_COL[(Math.floor(i / 3) + (bi2 >> 1)) % RAVE_COL.length]).multiplyScalar((i + bi2) % 4 === 0 ? 1 : lv);
        zs.mesh.setColorAt(i, c);
      }
      zs.mesh.instanceColor.needsUpdate = true;
    }
  };

  // LED-стена сцены: эквалайзер, вспышки на сильную долю и «DJ KIM»
  function drawLed(led, t, beat, kick) {
    const c = led.canvas, x = c.getContext('2d'), w = c.width, h = c.height;
    const hue = (beat * 12) % 360;
    x.fillStyle = '#05030a'; x.fillRect(0, 0, w, h);
    const bg = x.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, 'hsla(' + hue + ',90%,45%,' + (0.25 + 0.35 * kick) + ')'); bg.addColorStop(1, 'hsla(' + (hue + 120) % 360 + ',90%,45%,' + (0.2 + 0.3 * kick) + ')');
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    const n = 24;
    for (let i = 0; i < n; i++) {
      const v = 0.25 + 0.75 * Math.abs(Math.sin(t * (2.1 + i * 0.37) + i * 1.7)) * (0.6 + 0.4 * kick);
      x.fillStyle = 'hsl(' + (hue + i * 9) % 360 + ',95%,60%)';
      x.fillRect(i * w / n + 3, h - v * h * 0.55, w / n - 6, v * h * 0.55);
    }
    x.font = '800 92px "Unbounded", "Arial Black", Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = '#ff2e93'; x.shadowBlur = 18 + 30 * kick;
    x.fillStyle = '#ffffff'; x.fillText(led.title || 'DJ KIM', w / 2, h * 0.38);
    x.shadowBlur = 0;
    x.font = '700 30px "Golos Text", sans-serif'; x.fillStyle = '#c8ff1a'; x.fillText(led.sub || 'DUSTY RAVE · ' + D.BPM + ' BPM', w / 2, h * 0.68);
    led.tex.needsUpdate = true;
  }

  W3.dispose = function (st, scene) {
    const kill = (o) => {
      o.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => m.dispose());
      });
      if (o.parent) o.parent.remove(o);
    };
    kill(st.root); kill(st.sky); kill(st.sun);
    st.clouds.forEach((c) => kill(c.s));
    Object.values(st.backdrops).forEach(kill);
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
