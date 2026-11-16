// First Gambit intro: a WebGL2 studio scene that hands over to the landing page.
{
  const GEO = window.FG_PIECES;
  const ORDER = ['pawn', 'knight', 'queen', 'king', 'bishop', 'rook'];
  const $ = id => document.getElementById(id);
  const body = document.body, loader = $('loader'), canvas = $('gl');

  // ---------- 2D landing details (unchanged look) ----------
  const KH = 2.54;
  const rect = (y, h) => `<rect x="-2" y="${y.toFixed(1)}" width="83" height="${h.toFixed(2)}"/>`;
  $('slitsDn').setAttribute('fill', '#FFFFFF');
  $('slitsDn').innerHTML = [.05, .1, .17, .27, .36, .47, .58, .69, .78, .86, .93].map(f => rect(254 * (1 - f), 0.35 + f ** 1.6 * 2.8)).join('');
  $('slitsUp').setAttribute('fill', '#0B0B0B');
  $('slitsUp').innerHTML = [0.07, 0.045, 0.022].map((f, i) => rect(254 * (1 - f), 0.45 + i * 0.4)).join('');

  // ---------- small math ----------
  const V = {
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  };
  const M = {
    persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2), nf = 1 / (n - f); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]); },
    ortho(l, r, b, t, n, f) { return new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]); },
    look(e, c, up) {
      const z = V.norm(V.sub(e, c)), x = V.norm(V.cross(up, z)), y = V.cross(z, x);
      return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -V.dot(x, e), -V.dot(y, e), -V.dot(z, e), 1]);
    },
    mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; },
    tr(x, y, z, sy = 1) { return new Float32Array([1, 0, 0, 0, 0, sy, 0, 0, 0, 0, 1, 0, x, y, z, 1]); },
    apply(m, p) { const x = p[0], y = p[1], z = p[2]; const w = m[3] * x + m[7] * y + m[11] * z + m[15]; return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w]; }
  };
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
  const easeOut = t => 1 - Math.pow(1 - clamp(t), 4);
  const easeInOut = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  // ---------- geometry ----------
  function Mesh() { this.p = []; this.n = []; this.i = []; }
  Mesh.prototype.v = function (x, y, z, nx, ny, nz) { this.p.push(x, y, z); this.n.push(nx, ny, nz); return this.p.length / 3 - 1; };

  function lathe(m, prof, seg) {
    // segment normals in the (r, y) plane
    const sn = [];
    for (let i = 0; i < prof.length - 1; i++) {
      const dy = prof[i + 1][0] - prof[i][0], dr = prof[i + 1][1] - prof[i][1], l = Math.hypot(dy, dr) || 1;
      sn.push([dy / l, -dr / l]);
    }
    const rows = [];
    for (let i = 0; i < prof.length; i++) {
      const a = sn[i - 1], b = sn[i], y = prof[i][0], r = prof[i][1];
      if (!a) rows.push([y, r, b]); else if (!b) rows.push([y, r, a]);
      else if (a[0] * b[0] + a[1] * b[1] < 0.82) { rows.push([y, r, a]); rows.push([y, r, b]); }
      else { const nn = [a[0] + b[0], a[1] + b[1]], l = Math.hypot(nn[0], nn[1]); rows.push([y, r, [nn[0] / l, nn[1] / l]]); }
    }
    const base = m.p.length / 3;
    for (const [y, r, nn] of rows) for (let s = 0; s <= seg; s++) {
      const t = s / seg * Math.PI * 2, c = Math.cos(t), si = Math.sin(t);
      m.v(r * c, y, r * si, nn[0] * c, nn[1], nn[0] * si);
    }
    for (let k = 0; k < rows.length - 1; k++) {
      if (rows[k][0] === rows[k + 1][0] && rows[k][1] === rows[k + 1][1]) continue;
      for (let s = 0; s < seg; s++) {
        const a = base + k * (seg + 1) + s, b = a + seg + 1;
        m.i.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }

  function earcut(pts) {
    // ear clipping that always makes progress: strict containment test against reflex vertices only
    const idx = [...pts.keys()], tris = [];
    const ar = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const inTri = (p, a, b, c) => ar(a, b, p) > 1e-12 && ar(b, c, p) > 1e-12 && ar(c, a, p) > 1e-12;
    let guard = 0;
    while (idx.length > 3 && guard++ < 50000) {
      const n = idx.length; let best = -1;
      for (let k = 0; k < n; k++) {
        const ia = idx[(k + n - 1) % n], ib = idx[k], ic = idx[(k + 1) % n];
        const a = pts[ia], b = pts[ib], c = pts[ic];
        if (ar(a, b, c) <= 1e-12) continue;
        let ok = true;
        for (let j = 0; j < n && ok; j++) {
          const q = idx[j]; if (q === ia || q === ib || q === ic) continue;
          const qa = pts[idx[(j + n - 1) % n]], qc = pts[idx[(j + 1) % n]];
          if (ar(qa, pts[q], qc) <= 0 && inTri(pts[q], a, b, c)) ok = false;
        }
        if (ok) { best = k; break; }
      }
      if (best < 0) {
        // degenerate leftovers: drop the flattest vertex and carry on
        let m = 1e9; for (let k = 0; k < n; k++) { const v = Math.abs(ar(pts[idx[(k + n - 1) % n]], pts[idx[k]], pts[idx[(k + 1) % n]])); if (v < m) { m = v; best = k; } }
        idx.splice(best, 1); continue;
      }
      tris.push(idx[(best + n - 1) % n], idx[best], idx[(best + 1) % n]); idx.splice(best, 1);
    }
    if (idx.length === 3) tris.push(idx[0], idx[1], idx[2]);
    return tris;
  }

  function extrude(m, poly, thick, rb, ox, oy) {
    let sa = 0; for (let k = 0; k < poly.length; k++) { const a = poly[k], b = poly[(k + 1) % poly.length]; sa += a[0] * b[1] - b[0] * a[1]; }
    if (sa < 0) poly = poly.slice().reverse();
    const n = poly.length, steps = 5, half = thick / 2;
    const nrm = poly.map((p, k) => {
      const a = poly[(k + n - 1) % n], b = poly[(k + 1) % n];
      const e1 = V.norm([p[0] - a[0], p[1] - a[1], 0]), e2 = V.norm([b[0] - p[0], b[1] - p[1], 0]);
      let nx = e1[1] + e2[1], ny = -(e1[0] + e2[0]); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const mit = Math.min(2.2, 1 / Math.max(0.35, nx * e2[1] - ny * e2[0]));
      return [nx, ny, mit];
    });
    // rings: bevel at the back, straight wall, bevel at the front
    const ring = [];
    for (let s = 0; s <= steps; s++) { const a = s / steps * Math.PI / 2; ring.push([rb * (1 - Math.sin(a)), -half + rb * (1 - Math.cos(a)), -Math.cos(a), Math.sin(a)]); }
    for (let s = 0; s <= steps; s++) { const a = s / steps * Math.PI / 2; ring.push([rb * (1 - Math.cos(a)), half - rb + rb * Math.sin(a), Math.sin(a), Math.cos(a)]); }
    const base = m.p.length / 3;
    for (const [ins, z, nz, nr] of ring) for (let k = 0; k < n; k++) {
      const [nx, ny, mit] = nrm[k];
      m.v(ox + poly[k][0] - nx * ins * mit, oy + poly[k][1] - ny * ins * mit, z, nx * nr, ny * nr, nz);
    }
    for (let r = 0; r < ring.length - 1; r++) for (let k = 0; k < n; k++) {
      const a = base + r * n + k, b = base + r * n + (k + 1) % n, c = a + n, d = b + n;
      m.i.push(a, b, c, b, d, c);
    }
    const inset = poly.map((p, k) => [p[0] - nrm[k][0] * rb * nrm[k][2], p[1] - nrm[k][1] * rb * nrm[k][2]]);
    const tri = earcut(inset);
    for (const [z, nz] of [[half, 1], [-half, -1]]) {
      const b0 = m.p.length / 3;
      for (const p of inset) m.v(ox + p[0], oy + p[1], z, 0, 0, nz);
      for (let t = 0; t < tri.length; t += 3) m.i.push(b0 + tri[t], b0 + tri[t + 1], b0 + tri[t + 2]);
    }
  }

  function merlons(m, g) {
    const { y0, y1, ro, ri, n } = g, span = Math.PI * 2 / n, fill = 0.58, st = 8;
    for (let q = 0; q < n; q++) {
      const a0 = q * span + span * (1 - fill) / 2 + 0.3, a1 = a0 + span * fill;
      const quad = (pts, nn) => { const b = m.p.length / 3; pts.forEach((p, k) => m.v(p[0], p[1], p[2], ...(Array.isArray(nn[0]) ? nn[k] : nn))); m.i.push(b, b + 1, b + 2, b, b + 2, b + 3); };
      for (let s = 0; s < st; s++) {
        const t0 = a0 + (a1 - a0) * s / st, t1 = a0 + (a1 - a0) * (s + 1) / st;
        const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
        quad([[ro * c0, y0, ro * s0], [ro * c1, y0, ro * s1], [ro * c1, y1, ro * s1], [ro * c0, y1, ro * s0]], [[c0, 0, s0], [c1, 0, s1], [c1, 0, s1], [c0, 0, s0]]);
        quad([[ri * c1, y0, ri * s1], [ri * c0, y0, ri * s0], [ri * c0, y1, ri * s0], [ri * c1, y1, ri * s1]], [[-c1, 0, -s1], [-c0, 0, -s0], [-c0, 0, -s0], [-c1, 0, -s1]]);
        quad([[ri * c0, y1, ri * s0], [ro * c0, y1, ro * s0], [ro * c1, y1, ro * s1], [ri * c1, y1, ri * s1]], [0, 1, 0]);
      }
      for (const [t, sg] of [[a0, -1], [a1, 1]]) {
        const c = Math.cos(t), s = Math.sin(t), nn = [-s * sg, 0, c * sg];
        quad([[ri * c, y0, ri * s], [ro * c, y0, ro * s], [ro * c, y1, ro * s], [ri * c, y1, ri * s]], nn);
      }
    }
  }

  function buildPiece(k) {
    const g = GEO[k], m = new Mesh();
    for (const prof of g.lathe) lathe(m, prof, 96);
    if (g.merlons) merlons(m, g.merlons);
    if (g.head) extrude(m, g.head.poly, 0.4, 0.06, 0, 0);
    if (g.cross) extrude(m, g.cross.poly, g.cross.thick, 0.022, 0, 0);
    return m;
  }

  // ---------- WebGL ----------
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  if (!gl) { window.__intro3d = null; }

  const COMMON = `#version 300 es
  precision highp float; precision highp sampler2DShadow;
  uniform vec3 uCam, uL, uLc, uBg; uniform float uExp, uTime, uAmb; uniform vec2 uRes;
  uniform sampler2DShadow uSh; uniform mat4 uLVP;
  uniform vec4 uP[6]; uniform vec2 uPh[6];
  const float PI = 3.14159265;
  vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.,1.); }
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
  vec3 finish(vec3 c){
    c = aces(c*uExp); c = pow(c, vec3(1./2.2));
    vec2 q = gl_FragCoord.xy/uRes; float vig = smoothstep(1.25, .35, length(q-.5)*1.25);
    c *= mix(.93, 1., vig);
    c += (hash(gl_FragCoord.xy + fract(uTime)*91.7) - .5)*.018;
    return c;
  }
  float box(vec3 d, float az, float el, float w, float h, float s){
    float a = atan(d.x, d.z), e = asin(clamp(d.y,-1.,1.));
    float da = abs(mod(a - az + PI, 2.*PI) - PI);
    return (1.-smoothstep(w-s, w+s, da)) * (1.-smoothstep(h-s, h+s, abs(e-el)));
  }
  vec3 env(vec3 d, float s){
    // a white studio: bright cyclorama, an overhead softbox and two black flags to carve the edges
    vec3 c = mix(vec3(.18), vec3(.34), smoothstep(-.3, .3, d.y));
    c = mix(c, vec3(.22), smoothstep(.5, 1., d.y));
    c += 4.5 * box(d, 0., 1.22, 3.2, .2, .03+s);
    c += 3.2 * box(d, -1.85, .32, .17, .5, .02+s);
    c += 2.2 * box(d, 1.7, .28, .12, .45, .02+s);
    c += 1.4 * box(d, .35, .55, .08, .25, .02+s);
    c *= 1. - .985 * box(d, -.62, .2, .26, .75, .04+s);
    c *= 1. - .985 * box(d, .78, .22, .2, .75, .04+s);
    c *= 1. - .9 * box(d, 3.1, .1, .5, .5, .05+s);
    return c;
  }
  float shadowAt(vec3 w){
    vec4 p = uLVP * vec4(w,1.); vec3 q = p.xyz/p.w*.5+.5;
    if(q.x<0.||q.x>1.||q.y<0.||q.y>1.) return 1.;
    float r = 1.6/2048., s = 0.;
    vec2 k[12] = vec2[](vec2(-.94,-.4),vec2(.95,-.77),vec2(-.09,-.93),vec2(.34,.29),vec2(-.92,.46),vec2(-.82,.15),
      vec2(-.38,.28),vec2(-.6,-.8),vec2(.79,.19),vec2(.54,-.43),vec2(.18,.92),vec2(-.24,.7));
    float rot = hash(gl_FragCoord.xy)*6.283; mat2 R = mat2(cos(rot),sin(rot),-sin(rot),cos(rot));
    for(int i=0;i<12;i++) s += texture(uSh, vec3(q.xy + R*k[i]*r*1.5, q.z - .0012));
    return s/12.;
  }
  float aoFloor(vec2 xz){
    float a = 1.;
    for(int i=0;i<6;i++){
      float d = length(xz - uP[i].xy) - uP[i].z*.92;
      float lift = uPh[i].x, vis = uPh[i].y;
      a *= 1. - vis * exp(-lift*9.) * (.62*exp(-max(d,0.)*9.) + .25*exp(-max(d,0.)*2.2)) * (d < 0. ? 1.15 : 1.);
    }
    return clamp(a, .18, 1.);
  }
  `;

  const VS_PIECE = `#version 300 es
  layout(location=0) in vec3 aP; layout(location=1) in vec3 aN;
  uniform mat4 uVP, uM; out vec3 vW, vN;
  void main(){ vec4 w = uM*vec4(aP,1.); vW = w.xyz; vN = mat3(uM)*aN; gl_Position = uVP*w; }`;

  const FS_PIECE = COMMON + `
  in vec3 vW, vN; uniform float uMirror, uFade; out vec4 o;
  void main(){
    if(uMirror < .5 && vW.y < 0.) discard;
    if(uMirror > .5 && vW.y > 0.) discard;
    vec3 N = normalize(vN); vec3 Vd = normalize(uCam - vW);
    if(dot(N, Vd) < 0. && uMirror < .5) N = -N;
    vec3 P = uMirror > .5 ? vec3(vW.x, -vW.y, vW.z) : vW;
    vec3 Nr = uMirror > .5 ? vec3(N.x, -N.y, N.z) : N;
    vec3 Vr = normalize((uMirror > .5 ? vec3(uCam.x, -uCam.y, uCam.z) : uCam) - P);
    float rough = .085;
    float NV = max(dot(Nr,Vr), 1e-3);
    vec3 R = reflect(-Vr, Nr);
    float F = .045 + .955*pow(1.-NV, 5.);
    float occ = mix(.35, 1., smoothstep(0., .5, P.y)) * mix(1., aoFloor(P.xz), .25);
    vec3 e = env(R, .02) * occ;
    // the floor seen in the reflection is the lit studio floor
    if(R.y < 0.){ vec3 fp = P + R * (-P.y / min(R.y, -1e-3)); e = mix(e, uBg * aoFloor(fp.xz) * mix(.55,1.,shadowAt(fp)), smoothstep(0., -.08, R.y)); }
    vec3 L = normalize(uL); vec3 H = normalize(L + Vr);
    float NL = max(dot(Nr,L), 0.), NH = max(dot(Nr,H), 0.);
    float a = rough*rough, a2 = a*a, dd = NH*NH*(a2-1.)+1., D = a2/(PI*dd*dd);
    float k = (rough+1.)*(rough+1.)/8.; float G = (NL/(NL*(1.-k)+k))*(NV/(NV*(1.-k)+k));
    float Fh = .045 + .955*pow(1.-max(dot(H,Vr),0.), 5.);
    float sh = shadowAt(P + Nr*.012);
    vec3 spec = vec3(D*G*Fh/(4.*NL*NV+1e-4)*NL) * uLc * sh;
    vec3 albedo = vec3(.012);
    vec3 diff = albedo * (NL*uLc*sh + uAmb*occ);
    vec3 c = diff + spec + F*e;
    if(uMirror > .5){ o = vec4(finish(c), uFade * exp(vW.y*3.2) * .42); return; }
    o = vec4(finish(c), 1.);
  }`;

  const VS_FLOOR = `#version 300 es
  layout(location=0) in vec3 aP; uniform mat4 uVP; out vec3 vW;
  void main(){ vW = aP; gl_Position = uVP*vec4(aP,1.); }`;
  const FS_FLOOR = COMMON + `
  in vec3 vW; uniform float uAlpha; out vec4 o;
  void main(){
    float sh = shadowAt(vW + vec3(0., .003, 0.));
    float ao = aoFloor(vW.xz);
    vec3 L = normalize(uL);
    vec3 albedo = vec3(.93);
    vec3 c = albedo * (uAmb*ao + max(L.y,0.)*uLc*sh*mix(.75,1.,ao));
    float dist = length(vW.xz - uCam.xz);
    c = mix(c, uBg, smoothstep(7., 24., length(vW.xz)));
    o = vec4(finish(c), uAlpha);
  }`;
  const VS_BG = `#version 300 es
  layout(location=0) in vec3 aP; out vec2 vU; void main(){ vU = aP.xy; gl_Position = vec4(aP.xy, .9999, 1.); }`;
  const FS_BG = COMMON + `in vec2 vU; out vec4 o; void main(){ o = vec4(finish(uBg), 1.); }`;
  const VS_SH = `#version 300 es
  layout(location=0) in vec3 aP; uniform mat4 uVP, uM; out float vY;
  void main(){ vec4 w = uM*vec4(aP,1.); vY = w.y; gl_Position = uVP*w; }`;
  const FS_SH = `#version 300 es
  precision highp float; in float vY; out vec4 o; void main(){ if(vY < 0.) discard; o = vec4(1.); }`;

  let progs, pieces = [], floorVao, bgVao, shFbo, shTex, SH = 2048;
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function prog(vs, fs) {
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  function vao(pos, nrm, idx) {
    const v = gl.createVertexArray(); gl.bindVertexArray(v);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    if (nrm) { const c = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, c); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nrm), gl.STATIC_DRAW); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0); }
    const e = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, e); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null); return { v, n: idx.length };
  }

  // row layout: widths from the silhouettes, one gap between each
  const GAP = 0.62;
  const widths = ORDER.map(k => GEO[k].w), total = widths.reduce((a, b) => a + b, 0) + GAP * 5;
  let acc = -total / 2;
  const XS = widths.map(w => { const x = acc + w / 2; acc += w + GAP; return x; });
  const HS = ORDER.map(k => GEO[k].h);

  function init() {
    progs = { piece: prog(VS_PIECE, FS_PIECE), floor: prog(VS_FLOOR, FS_FLOOR), bg: prog(VS_BG, FS_BG), sh: prog(VS_SH, FS_SH) };
    pieces = ORDER.map(k => { const m = buildPiece(k); return vao(m.p, m.n, m.i); });
    const F = 60; floorVao = vao([-F, 0, -F, F, 0, -F, F, 0, F, -F, 0, F], null, [0, 2, 1, 0, 3, 2]);
    bgVao = vao([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], null, [0, 1, 2, 0, 2, 3]);
    shTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, shTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SH, SH);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    shFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, shFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shTex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // ---------- the timeline (seconds) ----------
  const T = { rise0: .9, riseStep: .58, riseDur: 1.7, wave0: 5.6, waveDur: 1.15, waveStep: .14, sink0: 7.5, sinkDur: 1.35, cam0: 7.6, cam1: 10.2, curtain: 10.45, curtainDur: 1.25, end: 11.9 };
  const SINK = [2, 4, 1, 5, 0];

  function state(t) {
    const st = { y: [], lift: [], vis: [] };
    for (let i = 0; i < 6; i++) {
      const r = easeInOut((t - T.rise0 - i * T.riseStep) / T.riseDur);
      let y = -HS[i] * (1 - r);
      const sIdx = SINK.indexOf(i);
      if (sIdx >= 0) { const s = easeInOut((t - T.sink0 - sIdx * .11) / T.sinkDur); y -= HS[i] * 1.02 * s; }
      const wt = (t - T.wave0 - i * T.waveStep) / T.waveDur;
      const lift = wt > 0 && wt < 1 ? Math.sin(wt * Math.PI) ** 2 * 0.16 : 0;
      st.y.push(y + lift); st.lift.push(lift); st.vis.push(clamp((y + HS[i]) / HS[i]));
    }
    // a slow sundial: the key light swings from behind-left to front-left
    const lt = easeInOut(t / T.end);
    const az = (150 - 112 * lt) * Math.PI / 180, el = (21 + 15 * lt) * Math.PI / 180;
    st.L = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
    return st;
  }

  // camera that frames the row with its baseline at 66% of the screen
  function rowCam(t, asp, fov) {
    const k = easeInOut(t / T.cam0);
    const az = (-27 + 19 * k) * Math.PI / 180, el = (15 - 7 * k) * Math.PI / 180;
    const tn = Math.tan(fov / 2);
    const dist = Math.max(18.5, (total / 2) / (0.8 * tn * asp) + 2) * (1 - .1 * k);
    let ty = 1.2;
    for (let it = 0; it < 6; it++) {
      const tgt = [0, ty, 0], eye = V.add(tgt, V.mul([Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)], dist));
      const vp = M.mul(M.persp(fov, asp, .1, 200), M.look(eye, tgt, [0, 1, 0]));
      const ndc = M.apply(vp, [0, 0, 0])[1];
      ty += (ndc + 0.32) * dist * tn * .9;
    }
    const tgt = [0, ty, 0];
    return { eye: V.add(tgt, V.mul([Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)], dist)), tgt, fov };
  }

  // frontal camera that puts the king exactly where the landing's flat king stands
  function kingCam(asp, W, Hh) {
    const r = $('kup').getBoundingClientRect(), fov = 20 * Math.PI / 180, tn = Math.tan(fov / 2);
    const nTop = 1 - 2 * r.top / Hh, nBot = 1 - 2 * r.bottom / Hh, nX = 2 * (r.left + r.width / 2) / W - 1;
    const D = KH / ((nTop - nBot) * tn), yc = -nBot * D * tn, xc = XS[3] - nX * D * tn * asp;
    return { eye: [xc, yc, D], tgt: [xc, yc, 0], fov };
  }

  let W = 0, Hh = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; Hh = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(Hh * dpr);
  }

  function draw(t) {
    if (canvas.width !== Math.round(innerWidth * Math.min(window.devicePixelRatio || 1, 2)) || Hh !== innerHeight) resize();
    const asp = W / Hh, st = state(t);
    const a = rowCam(Math.min(t, T.cam0), asp, 26 * Math.PI / 180), b = kingCam(asp, W, Hh);
    const k = sstep(T.cam0, T.cam1, t);
    const fov = a.fov + (b.fov - a.fov) * k, eye = V.lerp(a.eye, b.eye, k), tgt = V.lerp(a.tgt, b.tgt, k);
    const VP = M.mul(M.persp(fov, asp, .1, 200), M.look(eye, tgt, [0, 1, 0]));

    // light space
    const L = st.L, LVP = M.mul(M.ortho(-9, 9, -9, 9, 1, 45), M.look(V.add([XS[3] * .3, 0, 0], V.mul(L, 18)), [XS[3] * .3, 0, 0], [0, 1, 0]));
    const models = XS.map((x, i) => M.tr(x, st.y[i], 0));

    // shadow pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, shFbo); gl.viewport(0, 0, SH, SH);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
    gl.useProgram(progs.sh.p); gl.uniformMatrix4fv(progs.sh.u.uVP, false, LVP);
    pieces.forEach((pc, i) => { if (st.vis[i] <= 0) return; gl.uniformMatrix4fv(progs.sh.u.uM, false, models[i]); gl.bindVertexArray(pc.v); gl.drawElements(gl.TRIANGLES, pc.n, gl.UNSIGNED_INT, 0); });
    gl.disable(gl.POLYGON_OFFSET_FILL);

    // main pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const Lc = 2.9, amb = .33, bg = .93 * (amb + Math.max(L[1], 0) * Lc);
    const P = new Float32Array(24), Ph = new Float32Array(12);
    for (let i = 0; i < 6; i++) { P.set([XS[i], 0, GEO[ORDER[i]].r0, 0], i * 4); Ph.set([st.lift[i], st.vis[i] > 0.02 ? Math.min(1, st.vis[i] * 1.4) : 0], i * 2); }
    const common = pr => {
      gl.useProgram(pr.p); const u = pr.u;
      if (u.uVP) gl.uniformMatrix4fv(u.uVP, false, VP);
      if (u.uCam) gl.uniform3fv(u.uCam, eye); if (u.uL) gl.uniform3fv(u.uL, L); if (u.uLc) gl.uniform3f(u.uLc, Lc, Lc * .985, Lc * .96);
      if (u.uBg) gl.uniform3f(u.uBg, bg, bg, bg * .995); if (u.uExp) gl.uniform1f(u.uExp, 1.32); if (u.uTime) gl.uniform1f(u.uTime, t);
      if (u.uAmb) gl.uniform1f(u.uAmb, amb); if (u.uRes) gl.uniform2f(u.uRes, canvas.width, canvas.height);
      if (u.uLVP) gl.uniformMatrix4fv(u.uLVP, false, LVP); if (u.uP) gl.uniform4fv(u.uP, P); if (u.uPh) gl.uniform2fv(u.uPh, Ph);
      if (u.uSh) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, shTex); gl.uniform1i(u.uSh, 0); }
    };
    // background
    gl.disable(gl.DEPTH_TEST); common(progs.bg); gl.bindVertexArray(bgVao.v); gl.drawElements(gl.TRIANGLES, bgVao.n, gl.UNSIGNED_INT, 0);
    // floor (no depth write so the reflections can sit under it)
    common(progs.floor); gl.uniform1f(progs.floor.u.uAlpha, 1); gl.bindVertexArray(floorVao.v); gl.drawElements(gl.TRIANGLES, floorVao.n, gl.UNSIGNED_INT, 0);
    // reflections on the glossy floor
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    common(progs.piece); gl.uniform1f(progs.piece.u.uMirror, 1); gl.uniform1f(progs.piece.u.uFade, 1);
    pieces.forEach((pc, i) => { if (st.vis[i] <= 0) return; const mm = M.tr(XS[i], -st.y[i], 0, -1); gl.uniformMatrix4fv(progs.piece.u.uM, false, mm); gl.bindVertexArray(pc.v); gl.drawElements(gl.TRIANGLES, pc.n, gl.UNSIGNED_INT, 0); });
    gl.disable(gl.BLEND); gl.clear(gl.DEPTH_BUFFER_BIT);
    // the pieces
    gl.uniform1f(progs.piece.u.uMirror, 0);
    pieces.forEach((pc, i) => { if (st.vis[i] <= 0) return; gl.uniformMatrix4fv(progs.piece.u.uM, false, models[i]); gl.bindVertexArray(pc.v); gl.drawElements(gl.TRIANGLES, pc.n, gl.UNSIGNED_INT, 0); });
  }

  // ---------- running the intro ----------
  let raf = 0, t0 = 0, gen = 0, anims = [], fontsReady = false, curtainOn = false, handed = false;
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { fontsReady = true; });
  const A = (el, kf, o) => { const a = el.animate(kf, { fill: 'both', easing: 'cubic-bezier(.2,.7,.2,1)', ...o }); anims.push(a); return a; };

  const landingIn = () => {
    body.classList.remove('pre');
    A($('kdn'), [{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1500, delay: 200 });
    [$('first'), $('gambit')].forEach(el => A(el, [{ opacity: 0, letterSpacing: '.48em' }, { opacity: 1, letterSpacing: '.16em' }], { duration: 1600, delay: 500 }));
    [...document.querySelectorAll('.fd')].forEach((el, i) => A(el, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 900, delay: 1200 + i * 100 }));
  };
  const hide = () => { cancelAnimationFrame(raf); loader.style.display = 'none'; body.classList.remove('intro-on'); };

  const finish = () => {
    gen++; cancelAnimationFrame(raf);
    anims.forEach(a => a.finish());
    hide(); body.classList.remove('pre');
  };

  const handOff = my => {
    handed = true;
    const a = loader.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 800, easing: 'ease-in-out', fill: 'forwards' });
    anims.push(a);
    a.onfinish = () => { if (my === gen) hide(); };
    landingIn();
  };

  const frame = my => now => {
    if (my !== gen) return;
    const t = (now - t0) / 1000;
    try { draw(Math.min(t, T.end)); } catch (e) { console.error(e); finish(); return; }
    if (t >= T.curtain && !curtainOn) {
      curtainOn = true;
      A($('curtain'), [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: T.curtainDur * 1000, easing: 'cubic-bezier(.7,0,.25,1)' });
    }
    if (t >= T.end && fontsReady && !handed) handOff(my);
    if (!handed || t < T.end + 1) raf = requestAnimationFrame(frame(my));
  };

  const play = () => {
    if (!gl) return;
    const my = ++gen;
    anims.forEach(a => a.cancel()); anims = []; curtainOn = false; handed = false;
    body.classList.add('pre', 'intro-on'); loader.style.display = 'block'; loader.style.opacity = 1;
    window.scrollTo(0, 0); resize();
    t0 = performance.now();
    raf = requestAnimationFrame(frame(my));
  };

  try { if (gl) init(); } catch (e) { console.error(e); }
  window.__intro3d = { draw: t => { resize(); draw(t); }, state, T };
  loader.addEventListener('click', finish);
  document.addEventListener('keydown', e => { if (loader.style.display === 'block' && !e.metaKey && !e.ctrlKey) finish(); });
  $('replay').addEventListener('click', play);
  $('ctas').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) $('msg').textContent = `Opening ${b.dataset.go} (intro demo)`; });

  if (gl && progs && !matchMedia('(prefers-reduced-motion: reduce)').matches) play();
}
