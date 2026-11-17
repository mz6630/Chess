// First Gambit 3D engine: WebGL2, no libraries.
// Builds the pieces from js/pieces.js, then renders a white studio with black or white lacquer pieces,
// soft shadows, contact occlusion, an optional glossy floor reflection and an optional chessboard.
window.FG = (() => {
  // ---------- math ----------
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
    // translation * rotation (quaternion) * uniform scale
    compose(p, q, s) {
      const [x, y, z, w] = q, xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
      return new Float32Array([
        (1 - 2 * (yy + zz)) * s, 2 * (xy + wz) * s, 2 * (xz - wy) * s, 0,
        2 * (xy - wz) * s, (1 - 2 * (xx + zz)) * s, 2 * (yz + wx) * s, 0,
        2 * (xz + wy) * s, 2 * (yz - wx) * s, (1 - 2 * (xx + yy)) * s, 0,
        p[0], p[1], p[2], 1]);
    },
    apply(m, p) { const x = p[0], y = p[1], z = p[2]; const w = m[3] * x + m[7] * y + m[11] * z + m[15]; return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w]; }
  };
  const Q = {
    axis(ax, a) { const n = V.norm(ax), s = Math.sin(a / 2); return [n[0] * s, n[1] * s, n[2] * s, Math.cos(a / 2)]; },
    mul(a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; },
    slerp(a, b, t) {
      let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], bb = b;
      if (d < 0) { d = -d; bb = b.map(v => -v); }
      if (d > 0.9995) { const r = a.map((v, i) => v + (bb[i] - v) * t), l = Math.hypot(...r); return r.map(v => v / l); }
      const th = Math.acos(d), s = Math.sin(th), w1 = Math.sin((1 - t) * th) / s, w2 = Math.sin(t * th) / s;
      return a.map((v, i) => v * w1 + bb[i] * w2);
    },
    I: [0, 0, 0, 1]
  };
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
  const easeOut = t => 1 - Math.pow(1 - clamp(t), 4);
  const easeInOut = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const backOut = t => { t = clamp(t); const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

  // ---------- geometry ----------
  function Mesh() { this.p = []; this.n = []; this.i = []; }
  Mesh.prototype.v = function (x, y, z, nx, ny, nz) { this.p.push(x, y, z); this.n.push(nx, ny, nz); return this.p.length / 3 - 1; };
  Mesh.prototype.quad = function (pts, n) { const b = this.p.length / 3; pts.forEach((p, k) => this.v(p[0], p[1], p[2], ...(Array.isArray(n[0]) ? n[k] : n))); this.i.push(b, b + 1, b + 2, b, b + 2, b + 3); };

  function lathe(m, prof, seg) {
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
      for (let s = 0; s < seg; s++) { const a = base + k * (seg + 1) + s, b = a + seg + 1; m.i.push(a, b, a + 1, a + 1, b, b + 1); }
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
          if (ar(pts[idx[(j + n - 1) % n]], pts[q], pts[idx[(j + 1) % n]]) <= 0 && inTri(pts[q], a, b, c)) ok = false;
        }
        if (ok) { best = k; break; }
      }
      if (best < 0) {
        let m = 1e9; for (let k = 0; k < n; k++) { const v = Math.abs(ar(pts[idx[(k + n - 1) % n]], pts[idx[k]], pts[idx[(k + 1) % n]])); if (v < m) { m = v; best = k; } }
        idx.splice(best, 1); continue;
      }
      tris.push(idx[(best + n - 1) % n], idx[best], idx[(best + 1) % n]); idx.splice(best, 1);
    }
    if (idx.length === 3) tris.push(idx[0], idx[1], idx[2]);
    return tris;
  }

  function extrude(m, poly, thick, rb) {
    let sa = 0; for (let k = 0; k < poly.length; k++) { const a = poly[k], b = poly[(k + 1) % poly.length]; sa += a[0] * b[1] - b[0] * a[1]; }
    if (sa < 0) poly = poly.slice().reverse();
    const n = poly.length, steps = 5, half = thick / 2;
    const nrm = poly.map((p, k) => {
      const a = poly[(k + n - 1) % n], b = poly[(k + 1) % n];
      const e1 = V.norm([p[0] - a[0], p[1] - a[1], 0]), e2 = V.norm([b[0] - p[0], b[1] - p[1], 0]);
      let nx = e1[1] + e2[1], ny = -(e1[0] + e2[0]); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      return [nx, ny, Math.min(2.2, 1 / Math.max(0.35, nx * e2[1] - ny * e2[0]))];
    });
    const ring = [];
    for (let s = 0; s <= steps; s++) { const a = s / steps * Math.PI / 2; ring.push([rb * (1 - Math.sin(a)), -half + rb * (1 - Math.cos(a)), -Math.cos(a), Math.sin(a)]); }
    for (let s = 0; s <= steps; s++) { const a = s / steps * Math.PI / 2; ring.push([rb * (1 - Math.cos(a)), half - rb + rb * Math.sin(a), Math.sin(a), Math.cos(a)]); }
    const base = m.p.length / 3;
    for (const [ins, z, nz, nr] of ring) for (let k = 0; k < n; k++) {
      const [nx, ny, mit] = nrm[k];
      m.v(poly[k][0] - nx * ins * mit, poly[k][1] - ny * ins * mit, z, nx * nr, ny * nr, nz);
    }
    for (let r = 0; r < ring.length - 1; r++) for (let k = 0; k < n; k++) {
      const a = base + r * n + k, b = base + r * n + (k + 1) % n; m.i.push(a, b, a + n, b, b + n, a + n);
    }
    const inset = poly.map((p, k) => [p[0] - nrm[k][0] * rb * nrm[k][2], p[1] - nrm[k][1] * rb * nrm[k][2]]);
    const tri = earcut(inset);
    for (const [z, nz] of [[half, 1], [-half, -1]]) {
      const b0 = m.p.length / 3;
      for (const p of inset) m.v(p[0], p[1], z, 0, 0, nz);
      for (let t = 0; t < tri.length; t += 3) m.i.push(b0 + tri[t], b0 + tri[t + 1], b0 + tri[t + 2]);
    }
  }

  function merlons(m, g) {
    const { y0, y1, ro, ri, n } = g, span = Math.PI * 2 / n, fill = 0.58, st = 8;
    for (let q = 0; q < n; q++) {
      const a0 = q * span + span * (1 - fill) / 2 + 0.3, a1 = a0 + span * fill;
      for (let s = 0; s < st; s++) {
        const t0 = a0 + (a1 - a0) * s / st, t1 = a0 + (a1 - a0) * (s + 1) / st;
        const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
        m.quad([[ro * c0, y0, ro * s0], [ro * c1, y0, ro * s1], [ro * c1, y1, ro * s1], [ro * c0, y1, ro * s0]], [[c0, 0, s0], [c1, 0, s1], [c1, 0, s1], [c0, 0, s0]]);
        m.quad([[ri * c1, y0, ri * s1], [ri * c0, y0, ri * s0], [ri * c0, y1, ri * s0], [ri * c1, y1, ri * s1]], [[-c1, 0, -s1], [-c0, 0, -s0], [-c0, 0, -s0], [-c1, 0, -s1]]);
        m.quad([[ri * c0, y1, ri * s0], [ro * c0, y1, ro * s0], [ro * c1, y1, ro * s1], [ri * c1, y1, ri * s1]], [0, 1, 0]);
      }
      for (const [t, sg] of [[a0, -1], [a1, 1]]) {
        const c = Math.cos(t), s = Math.sin(t);
        m.quad([[ri * c, y0, ri * s], [ro * c, y0, ro * s], [ro * c, y1, ro * s], [ri * c, y1, ri * s]], [-s * sg, 0, c * sg]);
      }
    }
  }

  function buildPiece(g, seg = 96) {
    const m = new Mesh();
    for (const prof of g.lathe) lathe(m, prof, seg);
    if (g.merlons) merlons(m, g.merlons);
    if (g.head) extrude(m, g.head.poly, 0.4, 0.06);
    if (g.cross) extrude(m, g.cross.poly, g.cross.thick, 0.022);
    return m;
  }

  // a board slab with a chamfered top edge; squares are drawn in the shader
  function buildBoard(half, top, ch) {
    const m = new Mesh(), h = half, H = half - ch, y1 = top, y0 = top - ch, s = Math.SQRT1_2;
    m.quad([[-H, y1, H], [H, y1, H], [H, y1, -H], [-H, y1, -H]], [0, 1, 0]);
    m.quad([[-H, y1, H], [-h, y0, h], [h, y0, h], [H, y1, H]], [0, s, s]);
    m.quad([[H, y1, -H], [h, y0, -h], [-h, y0, -h], [-H, y1, -H]], [0, s, -s]);
    m.quad([[H, y1, H], [h, y0, h], [h, y0, -h], [H, y1, -H]], [s, s, 0]);
    m.quad([[-H, y1, -H], [-h, y0, -h], [-h, y0, h], [-H, y1, H]], [-s, s, 0]);
    m.quad([[-h, y0, h], [-h, 0, h], [h, 0, h], [h, y0, h]], [0, 0, 1]);
    m.quad([[h, y0, -h], [h, 0, -h], [-h, 0, -h], [-h, y0, -h]], [0, 0, -1]);
    m.quad([[h, y0, h], [h, 0, h], [h, 0, -h], [h, y0, -h]], [1, 0, 0]);
    m.quad([[-h, y0, -h], [-h, 0, -h], [-h, 0, h], [-h, y0, h]], [-1, 0, 0]);
    return m;
  }

  // ---------- shaders ----------
  const COMMON = `#version 300 es
  precision highp float; precision highp sampler2DShadow;
  uniform vec3 uCam, uL, uLc, uBg; uniform float uExp, uTime, uAmb, uGround; uniform vec2 uRes;
  uniform sampler2DShadow uSh; uniform mat4 uLVP; uniform float uShR, uFlat, uCheap; uniform int uTaps;
  uniform vec4 uP[32]; uniform vec2 uPh[32]; uniform int uN;
  const float PI = 3.14159265;
  vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.,1.); }
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
  vec3 finish(vec3 c){
    c = aces(c*uExp); c = pow(c, vec3(1./2.2));
    if(uFlat > .5) return c;
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
    float s = 0.;
    vec2 k[12] = vec2[](vec2(-.94,-.4),vec2(.95,-.77),vec2(-.09,-.93),vec2(.34,.29),vec2(-.92,.46),vec2(-.82,.15),
      vec2(-.38,.28),vec2(-.6,-.8),vec2(.79,.19),vec2(.54,-.43),vec2(.18,.92),vec2(-.24,.7));
    float rot = hash(gl_FragCoord.xy)*6.283; mat2 R = mat2(cos(rot),sin(rot),-sin(rot),cos(rot));
    for(int i=0;i<12;i++){ if(i >= uTaps) break; s += texture(uSh, vec3(q.xy + R*k[i]*uShR, q.z - .0012)); }
    return s/float(uTaps);
  }
  // contact occlusion under each piece standing on (or hovering over) the ground plane
  float aoAt(vec2 xz){
    float a = 1.;
    for(int i=0;i<32;i++){
      if(i >= uN) break;
      float d = length(xz - uP[i].xy) - uP[i].z*.92;
      float lift = uPh[i].x, vis = uPh[i].y;
      a *= 1. - vis * exp(-lift*9.) * (.62*exp(-max(d,0.)*9./uP[i].w) + .25*exp(-max(d,0.)*2.2/uP[i].w)) * (d < 0. ? 1.15 : 1.);
    }
    return clamp(a, .18, 1.);
  }
  vec3 lacquer(vec3 P, vec3 N, vec3 Vd, vec3 albedo, float rough, float occ, vec3 groundCol){
    float NV = max(dot(N,Vd), 1e-3);
    vec3 R = reflect(-Vd, N);
    float F = .045 + .955*pow(1.-NV, 5.);
    vec3 e = env(R, rough*.25) * occ;
    if(R.y < 0. && uCheap > .5){ e = mix(e, groundCol, smoothstep(0., -.08, R.y)); }
    else if(R.y < 0.){ vec3 fp = P + R * ((uGround - P.y) / min(R.y, -1e-3)); e = mix(e, groundCol * aoAt(fp.xz) * mix(.55,1.,shadowAt(fp)), smoothstep(0., -.08, R.y)); }
    vec3 L = normalize(uL), H = normalize(L + Vd);
    float NL = max(dot(N,L), 0.), NH = max(dot(N,H), 0.);
    float a = rough*rough, a2 = a*a, dd = NH*NH*(a2-1.)+1., D = a2/(PI*dd*dd);
    float k = (rough+1.)*(rough+1.)/8.; float G = (NL/(NL*(1.-k)+k))*(NV/(NV*(1.-k)+k));
    float Fh = .045 + .955*pow(1.-max(dot(H,Vd),0.), 5.);
    float sh = shadowAt(P + N*.012);
    vec3 spec = vec3(D*G*Fh/(4.*NL*NV+1e-4)*NL) * uLc * sh;
    vec3 diff = albedo * (NL*uLc*sh + uAmb*occ*(.72 + .28*N.y));
    return diff*(1.-F) + spec + F*e;
  }
  `;

  const VS_OBJ = `#version 300 es
  layout(location=0) in vec3 aP; layout(location=1) in vec3 aN;
  uniform mat4 uVP, uM; out vec3 vW, vN;
  void main(){ vec4 w = uM*vec4(aP,1.); vW = w.xyz; vN = mat3(uM)*aN; gl_Position = uVP*w; }`;

  const FS_PIECE = COMMON + `
  in vec3 vW, vN; uniform float uMirror, uFade, uWhite, uClip; uniform vec3 uGroundCol; out vec4 o;
  void main(){
    if(uMirror < .5 && uClip > .5 && vW.y < uGround) discard;
    if(uMirror > .5 && vW.y > 0.) discard;
    vec3 N = normalize(vN); vec3 Vd = normalize(uCam - vW);
    if(dot(N, Vd) < 0. && uMirror < .5) N = -N;
    vec3 P = uMirror > .5 ? vec3(vW.x, -vW.y, vW.z) : vW;
    vec3 Nr = uMirror > .5 ? vec3(N.x, -N.y, N.z) : N;
    vec3 Vr = normalize((uMirror > .5 ? vec3(uCam.x, -uCam.y, uCam.z) : uCam) - P);
    vec3 albedo = mix(vec3(.012), vec3(.80,.78,.74), uWhite);
    float rough = mix(.085, .17, uWhite);
    float occ = mix(.35, 1., smoothstep(uGround, uGround + .5, P.y)) * (uCheap > .5 ? 1. : mix(1., aoAt(P.xz), .25));
    vec3 c = lacquer(P, Nr, Vr, albedo, rough, occ, uGroundCol);
    if(uMirror > .5){ o = vec4(finish(c), uFade * exp(vW.y*3.2) * .42); return; }
    o = vec4(finish(c), 1.);
  }`;

  const FS_BOARD = COMMON + `
  in vec3 vW, vN; uniform float uBHalf; uniform vec3 uGroundCol; out vec4 o;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float s = 0., a = .5; for(int i=0;i<3;i++){ s += a*vn(p); p *= 2.03; a *= .5; } return s; }
  void main(){
    vec3 N = normalize(vN), Vd = normalize(uCam - vW);
    vec3 albedo = vec3(.016); float rough = .1;
    if(N.y > .9 && abs(vW.x) < uBHalf && abs(vW.z) < uBHalf){
      vec2 c = floor(vW.xz + uBHalf);
      bool light = mod(c.x + c.y, 2.) < .5;
      vec2 q = vW.xz*1.15 + c*3.71;
      float n = fbm(q*1.7);
      float vein = 1. - smoothstep(0., .06, abs(sin((q.x*.7 + q.y*.45)*2.3 + n*7.)));
      vec2 g = abs(fract(vW.xz + uBHalf) - .5);
      float groove = smoothstep(.492, .5, max(g.x, g.y));
      if(light){ albedo = vec3(.86,.85,.83) * (1. - .22*vein - .07*n); rough = .2; }
      else { albedo = vec3(.014) + vec3(.05)*vein*(.5+n); rough = .13; }
      albedo *= 1. - .55*groove;
    }
    float occ = mix(1., aoAt(vW.xz), N.y > .9 ? 1. : 0.);
    vec3 col = lacquer(vW, N, Vd, albedo, rough, occ, uGroundCol);
    o = vec4(finish(col * mix(1., occ, .55)), 1.);
  }`;

  const VS_FLOOR = `#version 300 es
  layout(location=0) in vec3 aP; uniform mat4 uVP; out vec3 vW;
  void main(){ vW = aP; gl_Position = uVP*vec4(aP,1.); }`;
  const FS_FLOOR = COMMON + `
  in vec3 vW; uniform vec3 uBox; out vec4 o;
  void main(){
    float sh = shadowAt(vW + vec3(0., .003, 0.));
    float ao = uBox.x > 0. ? 1. : aoAt(vW.xz);
    if(uBox.x > 0.){ float d = length(max(abs(vW.xz) - uBox.x, 0.)); ao *= 1. - .5*exp(-d*3.2) - .2*exp(-d*.9); }
    vec3 L = normalize(uL);
    if(uFlat > .5){
      // pure white page: only the shadow and contact darkening are drawn, so the scene melts into the page
      float lit = (uAmb*ao + max(L.y,0.)*uLc.x*sh*mix(.75,1.,ao)) / (uAmb + max(L.y,0.)*uLc.x);
      float v = mix(1., mix(.52, 1., lit), 1. - smoothstep(7., 16., length(vW.xz)));
      // transparent canvas: the shadow is drawn as darkness over whatever page lies beneath
      o = vec4(0., 0., 0., 1. - v); return;
    }
    vec3 c = vec3(.93) * (uAmb*ao + max(L.y,0.)*uLc*sh*mix(.75,1.,ao));
    c = mix(c, uBg, smoothstep(7., 24., length(vW.xz)));
    o = vec4(finish(c), 1.);
  }`;
  const VS_BG = `#version 300 es
  layout(location=0) in vec3 aP; void main(){ gl_Position = vec4(aP.xy, .9999, 1.); }`;
  const FS_BG = COMMON + `out vec4 o; void main(){ o = uFlat > .5 ? vec4(1.) : vec4(finish(uBg), 1.); }`;
  const VS_SH = `#version 300 es
  layout(location=0) in vec3 aP; uniform mat4 uVP, uM; out float vY;
  void main(){ vec4 w = uM*vec4(aP,1.); vY = w.y; gl_Position = uVP*w; }`;
  const FS_SH = `#version 300 es
  precision highp float; in float vY; uniform float uClip, uGround; out vec4 o;
  void main(){ if(uClip > .5 && vY < uGround) discard; o = vec4(1.); }`;

  // ---------- renderer ----------
  const TYPES = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];

  function createRenderer(canvas, GEO, opt = {}) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: !!opt.alpha, premultipliedAlpha: true, powerPreference: 'high-performance' });
    if (!gl) return null;
    const SH = opt.shadowSize || 2048;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = (vs, fs) => {
      const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
      return { p, u };
    };
    const vao = (pos, nrm, idx) => {
      const v = gl.createVertexArray(); gl.bindVertexArray(v);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      if (nrm) { const c = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, c); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nrm), gl.STATIC_DRAW); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0); }
      const e = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, e); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
      gl.bindVertexArray(null); return { v, n: idx.length };
    };

    const progs = { piece: prog(VS_OBJ, FS_PIECE), board: prog(VS_OBJ, FS_BOARD), floor: prog(VS_FLOOR, FS_FLOOR), bg: prog(VS_BG, FS_BG), sh: prog(VS_SH, FS_SH) };
    const meshes = {};
    for (const k of TYPES) { const m = buildPiece(GEO[k], opt.seg || 96); meshes[k] = vao(m.p, m.n, m.i); }
    let boardVao = null, boardSpec = null;
    const F = 60, floorVao = vao([-F, 0, -F, F, 0, -F, F, 0, F, -F, 0, F], null, [0, 2, 1, 0, 3, 2]);
    const bgVao = vao([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], null, [0, 1, 2, 0, 2, 3]);
    const shTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, shTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SH, SH);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    const shFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, shFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shTex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    let W = 0, H = 0;
    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, opt.maxDpr || 2), r = canvas.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      return { W, H, asp: W / H };
    }

    function setBoard(half, top, ch) { const m = buildBoard(half, top, ch); boardVao = vao(m.p, m.n, m.i); boardSpec = { half, top }; }

    // scene: { t, cam:{eye,tgt,fov}, L, Lc, amb, exp, shadow:{c, half}, clip, ground, groundCol, reflect,
    //          pieces:[{type, m, white, vis}], ao:[{x,z,r,lift,vis,spread}], board:bool }
    function render(s) {
      const { asp } = size();
      let VP = M.mul(M.persp(s.cam.fov, asp, .1, 200), M.look(s.cam.eye, s.cam.tgt, [0, 1, 0]));
      // shift the whole picture vertically in clip space (lets a full-screen canvas follow a scrolling frame)
      if (s.offsetY) VP = M.mul(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, s.offsetY, 0, 1]), VP);
      const L = s.L, c = s.shadow.c, hf = s.shadow.half;
      const LVP = M.mul(M.ortho(-hf, hf, -hf, hf, 1, 60), M.look(V.add(c, V.mul(L, 26)), c, [0, 1, 0]));
      const ground = s.ground || 0, clip = s.clip ? 1 : 0;

      // shadow pass
      gl.bindFramebuffer(gl.FRAMEBUFFER, shFbo); gl.viewport(0, 0, SH, SH);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
      gl.useProgram(progs.sh.p); gl.uniformMatrix4fv(progs.sh.u.uVP, false, LVP);
      gl.uniform1f(progs.sh.u.uClip, clip); gl.uniform1f(progs.sh.u.uGround, ground);
      for (const pc of s.pieces) { const me = meshes[pc.type]; gl.uniformMatrix4fv(progs.sh.u.uM, false, pc.m); gl.bindVertexArray(me.v); gl.drawElements(gl.TRIANGLES, me.n, gl.UNSIGNED_INT, 0); }
      if (s.board && boardVao) { gl.uniform1f(progs.sh.u.uClip, 0); gl.uniformMatrix4fv(progs.sh.u.uM, false, M.tr(0, 0, 0)); gl.bindVertexArray(boardVao.v); gl.drawElements(gl.TRIANGLES, boardVao.n, gl.UNSIGNED_INT, 0); }
      gl.disable(gl.POLYGON_OFFSET_FILL);

      // main pass
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
      if (opt.alpha) gl.clearColor(0, 0, 0, 0); else gl.clearColor(1, 1, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const bg = .93 * (s.amb + Math.max(L[1], 0) * s.Lc);
      const P = new Float32Array(128), Ph = new Float32Array(64), n = Math.min(32, s.ao.length);
      s.ao.slice(0, n).forEach((a, i) => { P.set([a.x, a.z, a.r, a.spread || 1], i * 4); Ph.set([a.lift, a.vis], i * 2); });
      const gc = s.groundCol || [bg, bg, bg];
      const common = pr => {
        gl.useProgram(pr.p); const u = pr.u;
        if (u.uVP) gl.uniformMatrix4fv(u.uVP, false, VP);
        if (u.uCam) gl.uniform3fv(u.uCam, s.cam.eye); if (u.uL) gl.uniform3fv(u.uL, L); if (u.uLc) gl.uniform3f(u.uLc, s.Lc, s.Lc * .985, s.Lc * .96);
        if (u.uBg) gl.uniform3f(u.uBg, bg, bg, bg * .995); if (u.uExp) gl.uniform1f(u.uExp, s.exp || 1.32); if (u.uTime) gl.uniform1f(u.uTime, s.t || 0);
        if (u.uAmb) gl.uniform1f(u.uAmb, s.amb); if (u.uRes) gl.uniform2f(u.uRes, canvas.width, canvas.height); if (u.uGround) gl.uniform1f(u.uGround, ground);
        if (u.uLVP) gl.uniformMatrix4fv(u.uLVP, false, LVP); if (u.uShR) gl.uniform1f(u.uShR, (s.shadowSoft || 2.4) / SH);
        if (u.uP) gl.uniform4fv(u.uP, P); if (u.uPh) gl.uniform2fv(u.uPh, Ph); if (u.uN) gl.uniform1i(u.uN, n);
        if (u.uGroundCol) gl.uniform3fv(u.uGroundCol, gc);
        if (u.uFlat) gl.uniform1f(u.uFlat, s.flat ? 1 : 0); if (u.uCheap) gl.uniform1f(u.uCheap, s.cheap ? 1 : 0); if (u.uTaps) gl.uniform1i(u.uTaps, s.taps || 12);
        if (u.uSh) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, shTex); gl.uniform1i(u.uSh, 0); }
      };
      const drawPieces = mirror => {
        const u = progs.piece.u;
        gl.uniform1f(u.uMirror, mirror ? 1 : 0); gl.uniform1f(u.uFade, 1); gl.uniform1f(u.uClip, clip);
        for (const pc of s.pieces) {
          const me = meshes[pc.type];
          gl.uniform1f(u.uWhite, pc.white ? 1 : 0);
          gl.uniformMatrix4fv(u.uM, false, mirror ? M.mul(M.tr(0, 0, 0, -1), pc.m) : pc.m);
          gl.bindVertexArray(me.v); gl.drawElements(gl.TRIANGLES, me.n, gl.UNSIGNED_INT, 0);
        }
      };
      gl.disable(gl.DEPTH_TEST);
      if (!opt.alpha) { common(progs.bg); gl.bindVertexArray(bgVao.v); gl.drawElements(gl.TRIANGLES, bgVao.n, gl.UNSIGNED_INT, 0); }
      common(progs.floor); gl.uniform3f(progs.floor.u.uBox, s.board && boardSpec ? boardSpec.half : 0, 0, 0);
      gl.bindVertexArray(floorVao.v); gl.drawElements(gl.TRIANGLES, floorVao.n, gl.UNSIGNED_INT, 0);
      gl.enable(gl.DEPTH_TEST);
      if (s.reflect) {
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        common(progs.piece); drawPieces(true);
        gl.disable(gl.BLEND); gl.clear(gl.DEPTH_BUFFER_BIT);
      }
      if (s.board && boardVao) {
        common(progs.board); gl.uniform1f(progs.board.u.uBHalf, 4); gl.uniformMatrix4fv(progs.board.u.uM, false, M.tr(0, 0, 0));
        gl.bindVertexArray(boardVao.v); gl.drawElements(gl.TRIANGLES, boardVao.n, gl.UNSIGNED_INT, 0);
      }
      common(progs.piece); drawPieces(false);
    }

    return { gl, render, size, setBoard, VP: (cam, asp) => M.mul(M.persp(cam.fov, asp, .1, 200), M.look(cam.eye, cam.tgt, [0, 1, 0])) };
  }

  return { V, M, Q, clamp, sstep, easeOut, easeInOut, backOut, createRenderer };
})();
