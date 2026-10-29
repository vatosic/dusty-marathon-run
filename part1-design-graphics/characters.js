/* Часть 1 · Дизайн и графика — объёмные бегуны, болельщики и собака (Three.js) */
(function (G) {
  'use strict';
  const D = G.DUSTY;
  const C = (D.Chars = {});
  const PI = Math.PI;

  /* ---------- общие геометрии ---------- */
  const GEOS = {};
  let LOD = 1; // 1 — герой (подробно), 0.6 — толпа (экономно)
  const S = (n) => Math.max(4, Math.round(n * LOD));
  function lathe(points, seg, scaleZ) {
    const g = new THREE.LatheGeometry(points.map((p) => new THREE.Vector2(p[0], p[1])), S(seg), PI, PI * 2);
    g.scale(1, 1, scaleZ);
    g.computeVertexNormals();
    return g;
  }
  function capsule(r, len, ycenter) {
    const g = new THREE.CapsuleGeometry(r, len, S(6), S(12));
    g.translate(0, ycenter, 0);
    return g;
  }
  function geos(lod) {
    lod = lod || 1;
    if (GEOS[lod]) return GEOS[lod];
    LOD = lod;
    const GEO = GEOS[lod] = {
      // торс от талии (y=0) до основания шеи
      torso: lathe([[0.001, -0.1], [0.17, -0.1], [0.152, 0.02], [0.145, 0.08], [0.158, 0.2], [0.18, 0.33], [0.193, 0.43], [0.18, 0.5], [0.12, 0.555], [0.05, 0.58], [0.001, 0.585]], 24, 0.6),
      torsoF: lathe([[0.001, -0.1], [0.16, -0.1], [0.13, 0.02], [0.124, 0.08], [0.14, 0.2], [0.152, 0.32], [0.155, 0.42], [0.14, 0.5], [0.1, 0.55], [0.045, 0.575], [0.001, 0.58]], 22, 0.64),
      shorts: lathe([[0.001, 0.02], [0.165, 0.02], [0.188, -0.04], [0.195, -0.1], [0.19, -0.17], [0.001, -0.17]], 20, 0.74),
      shortsLeg: (() => { const g = new THREE.CylinderGeometry(0.095, 0.088, 0.22, 14, 1, true); g.translate(0, -0.1, 0); return g; })(),
      sock: (() => { const g = new THREE.CylinderGeometry(0.047, 0.05, 0.09, 12); g.translate(0, 0.01, 0); return g; })(),
      watch: (() => { const g = new THREE.TorusGeometry(0.034, 0.012, 6, 14).rotateX(PI / 2); g.translate(0, -0.25, 0); return g; })(),
      stripe: (() => { const g = new THREE.BoxGeometry(0.012, 0.16, 0.06); g.translate(0, -0.08, 0); return g; })(),
      thigh: (() => { const g = capsule(0.074, 0.33, -0.22); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 + 0.12 * Math.exp(-Math.pow((y + 0.14) / 0.12, 2)); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } g.computeVertexNormals(); return g; })(),
      calf: (() => { const g = new THREE.CapsuleGeometry(0.05, 0.32, S(6), S(12)); g.translate(0, -0.21, 0); const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 + 0.25 * Math.exp(-Math.pow((y + 0.1) / 0.09, 2)); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * (y > -0.2 ? k * 1.08 : k)); }
        g.computeVertexNormals(); return g; })(),
      shoe: (() => { const g = new THREE.CapsuleGeometry(0.048, 0.16, 6, 10); g.rotateX(PI / 2); g.scale(1.05, 0.85, 1); g.translate(0, -0.035, -0.05); return g; })(),
      sole: (() => { const g = new THREE.BoxGeometry(0.1, 0.025, 0.27); g.translate(0, -0.075, -0.05); return g; })(),
      upperArm: (() => { const g = capsule(0.045, 0.22, -0.15); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 + 0.18 * Math.exp(-Math.pow((y + 0.08) / 0.08, 2)); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k * 1.05); } g.computeVertexNormals(); return g; })(),
      sleeve: (() => { const g = new THREE.CylinderGeometry(0.066, 0.058, 0.13, 12, 1, true); g.translate(0, -0.05, 0); return g; })(),
      forearm: capsule(0.036, 0.21, -0.14),
      hand: (() => { const g = new THREE.SphereGeometry(0.045, 10, 8); g.scale(0.8, 1.1, 0.9); g.translate(0, -0.3, 0); return g; })(),
      neck: (() => { const g = new THREE.CylinderGeometry(0.05, 0.058, 0.12, 10); g.translate(0, 0.05, 0); return g; })(),
      head: (() => { const g = new THREE.SphereGeometry(0.104, S(18), S(14)); g.scale(0.94, 1.16, 1.05); g.translate(0, 0.11, 0); return g; })(),
      ear: (() => { const g = new THREE.SphereGeometry(0.026, 8, 6); g.scale(0.5, 1, 0.8); return g; })(),
      nose: (() => { const g = new THREE.ConeGeometry(0.02, 0.05, 6); g.rotateX(-PI / 2); return g; })(),
      hair: (() => { const g = new THREE.SphereGeometry(0.112, S(18), S(12), 0, PI * 2, 0, PI * 0.56); g.scale(0.96, 1.12, 1.08); g.translate(0, 0.12, 0.008); return g; })(),
      hairBack: (() => { const g = new THREE.SphereGeometry(0.109, 16, 10, 0, PI, PI * 0.2, PI * 0.5); g.rotateY(-PI / 2); g.scale(0.97, 1.12, 1.08); g.translate(0, 0.105, 0.01); return g; })(),
      pony: (() => { const g = new THREE.CapsuleGeometry(0.04, 0.16, 4, 8); g.translate(0, -0.06, 0); g.rotateX(0.35); g.translate(0, 0.17, 0.12); return g; })(),
      capDome: (() => { const g = new THREE.SphereGeometry(0.118, S(18), S(10), 0, PI * 2, 0, PI * 0.5); g.scale(0.97, 0.82, 1.06); g.translate(0, 0.165, 0.004); return g; })(),
      capBrim: (() => { const g = new THREE.CylinderGeometry(0.1, 0.1, 0.012, 16, 1, false, PI * 0.5, PI); g.scale(1, 1, 1.25); g.translate(0, 0.17, -0.07); return g; })(),
      capStrap: (() => { const g = new THREE.TorusGeometry(0.03, 0.007, 4, 10, PI); g.translate(0, 0.165, 0.112); return g; })(),
      glasses: (() => { const g = new THREE.BoxGeometry(0.17, 0.035, 0.03); g.translate(0, 0.12, -0.1); return g; })()
    };
    LOD = 1;
    return GEO;
  }

  const PART_COLOR = { torso: 'shirt', shorts: 'shorts', shortsL: 'shorts', shortsR: 'shorts', sleeveL: 'shirt', sleeveR: 'shirt',
    shoeL: 'shoes', shoeR: 'shoes', soleL: 'sole', soleR: 'sole', sockL: 'sole', sockR: 'sole', stripeL: 'stripe', stripeR: 'stripe', watch: 'glass', hair: 'hair', hairBack: 'hair', pony: 'hair', capDome: 'cap', capBrim: 'cap', capStrap: 'cap', glasses: 'glass' };
  C.partColor = (name, look) => {
    const k = PART_COLOR[name] || 'skin';
    if (k === 'sole') return '#f2f2f2';
    if (k === 'stripe') return look.swim ? look.shirt : (look.stripe || '#c8ff1a');
    if (k === 'glass') return '#15151a';
    if (k === 'shorts' && look.swim) return look.shirt;
    return look[k] || '#888';
  };

  /**
   * Скелет: root → pelvis → torso → (neck → head), плечи → локти; бёдра → колени → голеностопы.
   * makeMesh(name, geometry) создаёт меш для части.
   */
  function skeleton(makeMesh, female, lod) {
    const g = geos(lod);
    const J = {};
    const grp = (name, parent, x, y, z) => { const o = new THREE.Group(); o.name = name; o.position.set(x, y, z); parent.add(o); J[name] = o; return o; };
    const root = new THREE.Group(); J.root = root;
    const pelvis = grp('pelvis', root, 0, 0.95, 0);
    const torso = grp('torso', pelvis, 0, 0.02, 0);
    torso.add(makeMesh('torso', female ? g.torsoF : g.torso));
    pelvis.add(makeMesh('shorts', g.shorts));
    const neck = grp('neck', torso, 0, 0.55, 0.005);
    neck.add(makeMesh('neck', g.neck));
    const head = grp('head', neck, 0, 0.08, 0);
    head.add(makeMesh('head', g.head));
    const earL = makeMesh('earL', g.ear); earL.position.set(-0.098, 0.11, 0.01); head.add(earL);
    const earR = makeMesh('earR', g.ear); earR.position.set(0.098, 0.11, 0.01); head.add(earR);
    const nose = makeMesh('nose', g.nose); nose.position.set(0, 0.1, -0.115); head.add(nose);
    head.add(makeMesh('hair', g.hair)); head.add(makeMesh('hairBack', g.hairBack)); head.add(makeMesh('pony', g.pony));
    head.add(makeMesh('capDome', g.capDome)); head.add(makeMesh('capBrim', g.capBrim)); head.add(makeMesh('capStrap', g.capStrap));
    head.add(makeMesh('glasses', g.glasses));
    const sw = female ? 0.17 : 0.2;
    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? -1 : 1;
      const sh = grp('shoulder' + s, torso, sx * sw, 0.47, 0.01);
      sh.add(makeMesh('upperArm' + s, g.upperArm)); sh.add(makeMesh('sleeve' + s, g.sleeve));
      const el = grp('elbow' + s, sh, 0, -0.3, 0);
      el.add(makeMesh('forearm' + s, g.forearm)); el.add(makeMesh('hand' + s, g.hand));
      if (s === 'L') el.add(makeMesh('watch', g.watch));
      const hip = grp('hip' + s, pelvis, sx * (female ? 0.098 : 0.092), -0.04, 0);
      hip.add(makeMesh('thigh' + s, g.thigh)); hip.add(makeMesh('shorts' + s, g.shortsLeg));
      const kn = grp('knee' + s, hip, 0, -0.44, 0);
      kn.add(makeMesh('calf' + s, g.calf));
      const an = grp('ankle' + s, kn, 0, -0.42, 0);
      an.add(makeMesh('shoe' + s, g.shoe)); an.add(makeMesh('sole' + s, g.sole)); an.add(makeMesh('sock' + s, g.sock));
      const st = makeMesh('stripe' + s, g.stripe); st.position.set(sx * 0.097, 0, 0); hip.add(st);
    }
    return J;
  }

  /* ---------- позы ---------- */
  const JOINTS = ['pelvis', 'torso', 'neck', 'head', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'];
  function reset(J) { for (const n of JOINTS) J[n].rotation.set(0, 0, 0); J.pelvis.position.y = 0.95; }

  const bump = (p, c, w) => { const v = Math.cos((p - c) * w); return v > 0 ? v * v : 0; };
  // Беговой цикл: фаза левой ноги p, правой p + π. amp — длина шага (0..1.3)
  C.poseRun = function (J, p, amp, lean) {
    reset(J);
    amp = amp == null ? 1 : amp;
    for (const s of ['L', 'R']) {
      const q = s === 'L' ? p : p + PI;
      const pp = ((q % (2 * PI)) + 2 * PI) % (2 * PI);
      J['hip' + s].rotation.x = 0.62 * amp * Math.sin(q) + 0.05;
      J['knee' + s].rotation.x = -(0.22 + 1.5 * amp * bump(pp, 5.7, 1.25) + 0.35 * bump(pp, 1.6, 1.5));
      J['ankle' + s].rotation.x = 0.25 * Math.sin(q + 0.8) * amp;
      // рука в противофазе ноге своей стороны
      J['shoulder' + s].rotation.x = -0.56 * amp * Math.sin(q) + 0.1;
      J['shoulder' + s].rotation.z = (s === 'L' ? -1 : 1) * 0.1;
      J['elbow' + s].rotation.x = 1.45 + 0.25 * Math.sin(q + PI);
    }
    J.torso.rotation.x = -(lean == null ? 0.13 : lean);
    J.torso.rotation.y = 0.12 * Math.sin(p) * amp;
    J.pelvis.rotation.y = -0.1 * Math.sin(p) * amp;
    J.pelvis.rotation.z = 0.04 * Math.cos(p) * amp;
    J.head.rotation.x = 0.1; J.head.rotation.y = -0.1 * Math.sin(p) * amp;
    J.pelvis.position.y = 0.92 + 0.055 * Math.abs(Math.cos(p)) * amp;
  };
  C.poseJump = function (J, t) {
    reset(J);
    for (const s of ['L', 'R']) {
      const k = s === 'L' ? 1 : 0.6;
      J['hip' + s].rotation.x = 0.9 * k; J['knee' + s].rotation.x = -1.5 * k; J['ankle' + s].rotation.x = 0.3;
      J['shoulder' + s].rotation.x = s === 'L' ? -0.5 : 0.9; J['shoulder' + s].rotation.z = (s === 'L' ? -1 : 1) * 0.35;
      J['elbow' + s].rotation.x = 1.3;
    }
    J.torso.rotation.x = -0.18; J.pelvis.position.y = 0.95;
  };
  C.posePerson = function (J, pose, t, ph) {
    reset(J);
    const k = t * (pose === 'dance' ? 5.5 : 3.2) + ph;
    const arm = (s, x, z, el) => { J['shoulder' + s].rotation.x = x; J['shoulder' + s].rotation.z = z; J['elbow' + s].rotation.x = el; };
    arm('L', 0.05, -0.12, 0.25); arm('R', 0.05, 0.12, 0.25);
    switch (pose) {
      case 'wave': arm('R', 0.4, 2.5 + 0.25 * Math.sin(k * 2.2), 0.5); break;
      case 'cheer': { const w = 0.15 * Math.sin(k * 2); arm('L', 0.3, -2.7 - w, 0.2); arm('R', 0.3, 2.7 + w, 0.2); J.pelvis.position.y = 0.95 + Math.max(0, Math.sin(k * 1.4)) * 0.05; break; }
      case 'jump': { arm('L', 0.3, -2.8, 0.2); arm('R', 0.3, 2.8, 0.2); J.pelvis.position.y = 0.95 + Math.max(0, Math.sin(k * 1.4)) * 0.16; break; }
      case 'clap': { const o = (Math.sin(k * 3.5) + 1) * 0.12; arm('L', 1.25, 0.35 - o, 0.9); arm('R', 1.25, -0.35 + o, 0.9); break; }
      case 'dance': {
        const a = Math.sin(k), b = Math.sin(k + 2);
        arm('L', 0.9 + a * 0.8, -0.5, 1.2); arm('R', 0.9 + b * 0.8, 0.5, 1.2);
        J.pelvis.rotation.z = Math.sin(k * 0.5) * 0.12; J.torso.rotation.z = -Math.sin(k * 0.5) * 0.1;
        J.pelvis.position.y = 0.93 + Math.abs(Math.sin(k)) * 0.04;
        J.kneeL.rotation.x = -0.25 * Math.max(0, a); J.kneeR.rotation.x = -0.25 * Math.max(0, b);
        J.hipL.rotation.x = 0.15 * Math.max(0, a); J.hipR.rotation.x = 0.15 * Math.max(0, b);
        break;
      }
      case 'walk': {
        const s = Math.sin(k * 1.2);
        J.hipL.rotation.x = 0.35 * s; J.hipR.rotation.x = -0.35 * s;
        J.kneeL.rotation.x = -0.4 * Math.max(0, -s); J.kneeR.rotation.x = -0.4 * Math.max(0, s);
        arm('L', -0.3 * s, -0.08, 0.3); arm('R', 0.3 * s, 0.08, 0.3);
        J.pelvis.position.y = 0.94 + Math.abs(Math.cos(k * 1.2)) * 0.02;
        break;
      }
      case 'chat': {
        const s = Math.sin(k * 1.2);
        J.hipL.rotation.x = 0.3 * s; J.hipR.rotation.x = -0.3 * s;
        J.kneeL.rotation.x = -0.35 * Math.max(0, -s); J.kneeR.rotation.x = -0.35 * Math.max(0, s);
        arm('L', -0.25 * s, -0.08, 0.3); arm('R', 0.7 + 0.2 * Math.sin(k * 3), 0.15, 1.5);
        J.head.rotation.y = 0.5;
        break;
      }
      case 'camera': arm('L', 1.35, 0.3, 1.9); arm('R', 1.35, -0.3, 1.9); J.head.rotation.x = 0.05; break;
      case 'sign': arm('L', 0.2, -2.9, 0.15); arm('R', 0.2, 2.9, 0.15); break;
      case 'highfive': arm('L', 0.05, -0.12, 0.25); arm('R', 0.25, 1.55, 0.15); J.torso.rotation.z = 0.08; break;
      case 'dj': { arm('L', 1.0, 0.2, 1.4 + 0.2 * Math.sin(k)); arm('R', 1.0 + 0.6 * Math.max(0, Math.sin(k * 0.5)), -0.2, 1.2); J.head.rotation.x = 0.25 * Math.abs(Math.sin(k)); J.pelvis.position.y = 0.94 + Math.abs(Math.sin(k)) * 0.025; break; }
    }
  };

  /* ---------- одиночная фигура (герой) ---------- */
  C.buildRig = function (look, opts) {
    opts = opts || {};
    const mats = {};
    const mat = (key, color, extra) => {
      if (!mats[key]) mats[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0 }, extra || {}));
      return mats[key];
    };
    const J = skeleton((name, geo) => {
      let m;
      const ck = PART_COLOR[name] || 'skin';
      if (name === 'torso' && opts.shirtTex) m = mat('shirtTex', '#ffffff', { map: opts.shirtTex, roughness: 0.8 });
      else if (ck === 'skin') m = mat('skin', look.skin, { roughness: 0.55 });
      else if (ck === 'shirt') m = mat('shirt', look.shirt, { roughness: 0.8, map: D.Tex.fabric() });
      else if (ck === 'shorts') m = mat('shorts', look.shorts || '#141418', { roughness: 0.5 });
      else if (ck === 'shoes') m = mat('shoes', look.shoes, { roughness: 0.55 });
      else if (ck === 'sole') m = mat('sole', '#f4f4f4');
      else if (ck === 'stripe') m = mat('stripe', look.stripe || '#c8ff1a', { roughness: 0.5 });
      else if (ck === 'hair') m = mat('hair', look.hair, { roughness: 0.9 });
      else if (ck === 'cap') m = mat('cap', look.cap || '#ff2e93', { roughness: 0.7 });
      else m = mat('glass', '#15151a', { roughness: 0.2 });
      const mesh = new THREE.Mesh(geo, m);
      mesh.name = name; mesh.castShadow = true;
      if (name === 'capDome' || name === 'capBrim' || name === 'capStrap') mesh.visible = !!look.cap;
      if (name === 'pony') mesh.visible = !!look.longHair;
      if (name === 'glasses') mesh.visible = !!look.glasses;

      return mesh;
    }, !!look.female);
    J.mats = mats;
    return J;
  };

  /* ---------- толпа: каждая часть тела — InstancedMesh ---------- */
  C.Crowd = function (scene, capacity) {
    const parts = [];
    const tmpl = skeleton((name, geo) => {
      const m = new THREE.Mesh(geo);
      m.name = name;
      return m;
    }, false, 0.6);
    const tmplF = skeleton((name, geo) => { const m = new THREE.Mesh(geo); m.name = name; return m; }, true, 0.6);
    const names = [];
    tmpl.root.traverse((o) => { if (o.isMesh) names.push(o.name); });
    const meshesOf = (J) => { const map = {}; J.root.traverse((o) => { if (o.isMesh) map[o.name] = o; }); return map; };
    const mapM = meshesOf(tmpl), mapF = meshesOf(tmplF);
    const fabric = D.Tex.fabric();
    for (const n of names) {
      const ck = PART_COLOR[n] || 'skin';
      const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: ck === 'skin' ? 0.62 : ck === 'shorts' ? 0.5 : 0.8, map: ck === 'shirt' ? fabric : null });
      // торс у мужской и женской фигуры разный — отдельные инстансы
      const geoM = mapM[n].geometry, geoF = mapF[n].geometry;
      const im = new THREE.InstancedMesh(geoM, mat, capacity);
      im.castShadow = true; im.frustumCulled = false; im.count = 0;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(im);
      let imF = null;
      if (geoF !== geoM) { imF = new THREE.InstancedMesh(geoF, mat, capacity); imF.castShadow = true; imF.frustumCulled = false; imF.count = 0; scene.add(imF); }
      parts.push({ name: n, im, imF, mesh: mapM[n], meshF: mapF[n] });
    }
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const col = new THREE.Color();
    let n = 0;
    this.begin = () => { n = 0; };
    this.full = () => n >= capacity;
    /** place: {x,y,z(three),ry,scale}; poseFn(J) */
    this.add = (place, look, poseFn) => {
      if (n >= capacity) return;
      const J = look.female ? tmplF : tmpl;
      poseFn(J);
      J.root.position.set(place.x, place.y || 0, place.z);
      J.root.rotation.set(place.rx || 0, place.ry || 0, place.rz || 0);
      const sc = place.scale || 1;
      J.root.scale.set(sc, sc, sc);
      J.root.updateMatrixWorld(true);
      for (const p of parts) {
        const mesh = look.female ? p.meshF : p.mesh;
        let hidden = false;
        if (p.name.startsWith('cap')) hidden = !look.cap;
        else if (p.name === 'pony') hidden = !look.longHair;
        else if (p.name === 'glasses') hidden = !look.glasses;
        else if (look.swim && (p.name === 'sleeveL' || p.name === 'sleeveR')) hidden = true;
        const target = look.female && p.imF ? p.imF : p.im;
        const other = look.female && p.imF ? p.im : p.imF;
        target.setMatrixAt(n, hidden ? zero : mesh.matrixWorld);
        col.set(look.swim && p.name === 'torso' && look.sport === 'two' ? look.skin : C.partColor(p.name, look));
        target.setColorAt(n, col);
        if (other) other.setMatrixAt(n, zero);
      }
      n++;
    };
    this.end = () => {
      for (const p of parts) {
        for (const im of [p.im, p.imF]) {
          if (!im) continue;
          im.count = n; im.instanceMatrix.needsUpdate = true;
          if (im.instanceColor) im.instanceColor.needsUpdate = true;
        }
      }
    };
  };

  /* ---------- собака ---------- */
  C.buildDog = function () {
    const fur = new THREE.MeshStandardMaterial({ color: '#c98b4e', roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 0.9 });
    const light = new THREE.MeshStandardMaterial({ color: '#f2e3cf', roughness: 0.9 });
    const black = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.4 });
    const collar = new THREE.MeshStandardMaterial({ color: '#ff2e93', roughness: 0.5 });
    const root = new THREE.Group();
    const body = new THREE.Group(); body.position.y = 0.42; root.add(body);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.4, 6, 12).rotateX(PI / 2), fur); torso.castShadow = true; body.add(torso);
    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 4, 8).rotateX(PI / 2), light); belly.position.set(0, -0.06, 0); body.add(belly);
    const head = new THREE.Group(); head.position.set(0, 0.12, -0.3); body.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), fur); skull.castShadow = true; head.add(skull);
    const snout = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.08, 4, 8).rotateX(PI / 2), light); snout.position.set(0, -0.03, -0.11); head.add(snout);
    const noseM = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), black); noseM.position.set(0, -0.01, -0.17); head.add(noseM);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 6), dark); ear.position.set(s * 0.065, 0.09, 0.01); ear.rotation.z = -s * 0.3; head.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), black); eye.position.set(s * 0.045, 0.03, -0.09); head.add(eye);
    }
    const col = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 6, 14), collar); col.position.set(0, 0.06, -0.24); col.rotation.x = PI / 2.4; body.add(col);
    const legs = [];
    for (const [lx, lz, ph] of [[-0.08, -0.2, 0], [0.08, -0.2, PI], [-0.08, 0.2, PI], [0.08, 0.2, 0]]) {
      const pivot = new THREE.Group(); pivot.position.set(lx, -0.02, lz); body.add(pivot);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.3, 4, 8), fur); leg.position.y = -0.19; leg.castShadow = true; pivot.add(leg);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), light); paw.scale.set(1, 0.6, 1.3); paw.position.set(0, -0.37, -0.02); pivot.add(paw);
      legs.push({ pivot, ph });
    }
    const tail = new THREE.Group(); tail.position.set(0, 0.06, 0.32); body.add(tail);
    const tm = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.2, 4, 6), fur); tm.position.y = 0.1; tail.add(tm);
    tail.rotation.x = -0.6;
    return {
      root,
      animate(t) {
        const k = t * 15;
        for (const l of legs) l.pivot.rotation.x = 0.7 * Math.sin(k + l.ph);
        body.position.y = 0.42 + 0.03 * Math.abs(Math.sin(k));
        head.rotation.x = 0.08 * Math.sin(k);
        tail.rotation.z = 0.5 * Math.sin(t * 18);
      }
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
