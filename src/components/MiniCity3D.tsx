import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import Card from "./Card";
import { stops, routes, busLines, getStop } from "../data/campusData";
import { useLang } from "../lib/i18n";
// The signal timing and the bus-driving rules live in one tested module, so
// the lamp you see and the bus obeying it can never disagree.
import {
  type BusState,
  type Phase,
  easeHeading,
  phaseOf,
  stepBus,
} from "../lib/traffic";

const SIZE = 44;

function worldOf(x: number, y: number) {
  return new THREE.Vector3(((x - 50) / 50) * SIZE, 0, ((y - 50) / 50) * SIZE);
}

function rng(seed: number) {
  const s = Math.sin(seed * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

// Distance from point p to segment a-b on the XZ plane.
function distToSeg(px: number, pz: number, a: THREE.Vector3, b: THREE.Vector3) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz || 1;
  let tt = ((px - a.x) * dx + (pz - a.z) * dz) / l2;
  tt = Math.max(0, Math.min(1, tt));
  const cx = a.x + tt * dx;
  const cz = a.z + tt * dz;
  return Math.hypot(px - cx, pz - cz);
}

/**
 * A canvas texture of a building facade: a grid of lit / unlit windows on a
 * wall that darkens towards street level.
 *
 * `glow` and `litRatio` are parameters rather than constants on purpose. The
 * first version of this hard-coded one warm yellow and one lit-window ratio,
 * so all forty buildings came out identical - the eye read the whole city as
 * a single shape stamped over and over. Real skylines mix warm offices, cool
 * fluorescent floors and half-empty towers, and that variety is most of what
 * makes a box look like a building.
 */
function facadeTexture(
  wall: string,
  glow: string,
  seed: number,
  litRatio: number
) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(c);

  // Wall, shading down to near-black at the base so towers feel planted on
  // the ground instead of floating as evenly-lit slabs.
  const wash = ctx.createLinearGradient(0, 0, 0, 128);
  wash.addColorStop(0, wall);
  wash.addColorStop(1, "#080e1c");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 64, 128);

  // Narrow or wide window bays, again just for variety between buildings.
  const cols = seed % 2 === 0 ? 4 : 3;
  const colW = 64 / cols;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < cols; x++) {
      const on = rng(seed + x * 3 + y * 7) > 1 - litRatio;
      ctx.fillStyle = on ? glow : "#0b1424";
      ctx.fillRect(x * colW + colW * 0.2, 6 + y * 14, colW * 0.6, 10);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * A soft round blob, white in the middle and fading to nothing at the rim.
 * Used twice: tinted and laid flat under each bus as its glow, and stretched
 * across the ground as the pool of light the campus sits in.
 */
function radialTexture(size = 128, inner = "rgba(255,255,255,1)") {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(c);
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  g.addColorStop(0, inner);
  g.addColorStop(0.45, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The face of a bus-stop sign: a little bus pictogram on green.
 *
 * A plain coloured panel worked as "not a street lamp", but twelve blank
 * rectangles ended up being the loudest thing on screen - louder than the
 * buses, which is backwards. A glyph says "bus stop" outright, so the sign
 * can be smaller and dimmer and still be understood.
 */
function stopSignTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(c);
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#06301a";
  // Body
  ctx.beginPath();
  ctx.roundRect(12, 14, 40, 30, 5);
  ctx.fill();
  // Windscreen band and wheels, in the green again so they read as cut-outs.
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(16, 19, 32, 9);
  ctx.fillRect(18, 42, 7, 6);
  ctx.fillRect(39, 42, 7, 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The colour the sky fades to at the horizon. Fog, the far edge of the
// ground and the bottom of the sky all use it, so the campus dissolves into
// the distance instead of ending at a hard black line.
const HORIZON = 0x14213d;

// A realistic 3D miniature campus: shadows, lit-window buildings, trees,
// street lamps, marked roads and detailed buses on the real route loops.
export default function MiniCity3D() {
  const { t } = useLang();
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const scene = new THREE.Scene();
    // Range is set once the camera distance is known (see frameCampus) - fog
    // that starts nearer than the campus would grey out the city itself.
    const fog = new THREE.Fog(HORIZON, SIZE * 2.2, SIZE * 5.2);
    scene.fog = fog;

    // Night sky: a deep navy overhead easing into the horizon colour, painted
    // on the inside of a big sphere. A flat background colour left the city
    // sitting on a dead black rectangle with a visible edge where the ground
    // stopped; a graded sky gives the scene somewhere to recede into.
    const skyCanvas = document.createElement("canvas");
    skyCanvas.width = 4;
    skyCanvas.height = 256;
    const skyCtx = skyCanvas.getContext("2d");
    if (skyCtx) {
      const g = skyCtx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, "#060a17");
      g.addColorStop(0.55, "#0d1730");
      // Bottom stop is exactly HORIZON, the colour the fog and the far ground
      // also settle on, so sky and ground meet with no visible seam.
      g.addColorStop(1, "#14213d");
      skyCtx.fillStyle = g;
      skyCtx.fillRect(0, 0, 4, 256);
    }
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(SIZE * 8, 32, 16),
      new THREE.MeshBasicMaterial({
        map: skyTex,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
      })
    );
    scene.add(sky);

    const camera = new THREE.PerspectiveCamera(
      40,
      mount.clientWidth / Math.max(1, mount.clientHeight),
      0.1,
      1000
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = 1.32;
    controls.target.set(0, 2.5, 0);
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 0.5;

    /*
     * Framing the whole campus, at whatever shape the canvas happens to be.
     *
     * The camera used to sit at a hand-tuned position, and it was simply too
     * close: over half the campus fell outside the frame and the nearest
     * tower block filled a third of the screen. Worse, one fixed distance
     * cannot be right for both a wide desktop card and a narrow phone -
     * a tall thin viewport needs the camera much further back for the same
     * ground to fit, so whatever number looked right on a laptop clipped on a
     * phone.
     *
     * So instead of guessing, measure: take a ring of points around the
     * campus (at ground level and at roof height), project them through the
     * camera, and pull back until they all land inside the frame. Two or
     * three passes converge, and it stays correct at any aspect ratio.
     */
    /*
     * What has to stay in frame: a box around every stop, tall enough to
     * clear the buildings beside it.
     *
     * Deliberately the stops themselves rather than a circle around the map
     * centre. The route network does not sit neatly in the middle of the
     * campus, so fitting a centred circle both wasted a lot of frame on empty
     * ground and left the city sitting off to one side of it. The outer
     * buildings are scenery and are allowed to run off the edges.
     */
    const MARGIN = 9; // verges, stop signs and the first row of trees
    const samples: THREE.Vector3[] = [];
    for (const s of stops) {
      const p = worldOf(s.x, s.y);
      for (const dx of [-MARGIN, MARGIN]) {
        for (const dz of [-MARGIN, MARGIN]) {
          samples.push(
            new THREE.Vector3(p.x + dx, 0, p.z + dz),
            new THREE.Vector3(p.x + dx, 9, p.z + dz)
          );
        }
      }
    }
    const campusRadius = Math.max(
      ...samples.map((p) => Math.hypot(p.x, p.z))
    );

    // Fixed viewing direction: a three-quarter view from above, high enough
    // to see the road network but low enough to keep the buildings looking
    // like buildings rather than floor plans.
    const viewDir = new THREE.Vector3(0.62, 0.56, 0.72).normalize();

    function frameCampus() {
      let dist = campusRadius * 2.2;
      controls.target.set(0, 2.5, 0); // reset, so resizes don't accumulate
      const screenUp = new THREE.Vector3();
      const screenRight = new THREE.Vector3();
      for (let pass = 0; pass < 6; pass++) {
        camera.position.copy(viewDir).multiplyScalar(dist).add(controls.target);
        camera.lookAt(controls.target);
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const p of samples) {
          const v = p.clone().project(camera);
          minX = Math.min(minX, v.x);
          maxX = Math.max(maxX, v.x);
          minY = Math.min(minY, v.y);
          maxY = Math.max(maxY, v.y);
        }

        // Slide the camera until the campus is centred in the frame.
        // Aiming at the map's origin is not the same as centring the picture:
        // the route network sits off to one side of the campus, and seen from
        // above at an angle its far edge projects much higher than its near
        // edge - together those parked the city up in one corner with a band
        // of empty ground under it.
        screenUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
        screenRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
        const halfFrame = Math.tan((camera.fov * Math.PI) / 360) * dist;
        controls.target
          .addScaledVector(screenUp, ((minY + maxY) / 2) * halfFrame)
          .addScaledVector(
            screenRight,
            ((minX + maxX) / 2) * halfFrame * camera.aspect
          );

        // How much of the frame the campus fills: 1.0 touches the edges, so
        // aim for 0.94 and keep a little breathing room.
        const fill = Math.max((maxX - minX) / 2, (maxY - minY) / 2);
        if (Math.abs(fill - 0.94) < 0.01) break;
        dist *= fill / 0.94;
      }
      camera.position.copy(viewDir).multiplyScalar(dist).add(controls.target);
      camera.lookAt(controls.target);
      camera.updateProjectionMatrix();

      controls.minDistance = dist * 0.35;
      controls.maxDistance = dist * 1.5;
      // Fog begins just past the campus and is total well before the ground
      // ends, which is what hides the edge of the world.
      fog.near = dist * 0.95;
      fog.far = dist * 2.1;
    }
    frameCampus();

    // Re-frame on resize, but stop as soon as the viewer takes control -
    // yanking the camera back to the default while someone is orbiting the
    // city would feel broken.
    let userTookOver = false;
    controls.addEventListener("start", () => {
      userTookOver = true;
    });

    // Lighting — hemisphere ambient + a warm key light casting shadows.
    scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x0a1220, 0.85));
    const key = new THREE.DirectionalLight(0xfff0dd, 2.0);
    key.position.set(SIZE * 0.7, SIZE * 1.3, SIZE * 0.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = SIZE * 4;
    key.shadow.camera.left = -SIZE * 1.3;
    key.shadow.camera.right = SIZE * 1.3;
    key.shadow.camera.top = SIZE * 1.3;
    key.shadow.camera.bottom = -SIZE * 1.3;
    key.shadow.bias = -0.0004;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x5b7bff, 0.5);
    rim.position.set(-SIZE, SIZE * 0.6, -SIZE);
    scene.add(rim);

    /*
     * Ground.
     *
     * This was a flat near-black square with a grid drawn on top, and from a
     * distance you could see exactly where it stopped: a hard straight edge
     * with nothing beyond it. It is now a disc, so there is no corner to
     * catch the eye, painted with a pool of light that is brightest under the
     * campus and fades out to the horizon colour - which the fog also uses,
     * so the edge of the world is genuinely invisible.
     */
    const groundCanvas = document.createElement("canvas");
    groundCanvas.width = 512;
    groundCanvas.height = 512;
    const gctx = groundCanvas.getContext("2d");
    if (gctx) {
      gctx.fillStyle = "#14213d";
      gctx.fillRect(0, 0, 512, 512);
      const pool = gctx.createRadialGradient(256, 256, 0, 256, 256, 256);
      pool.addColorStop(0, "#1d2d4f");
      pool.addColorStop(0.42, "#16243f");
      pool.addColorStop(1, "#14213d");
      gctx.fillStyle = pool;
      gctx.fillRect(0, 0, 512, 512);
      // Faint survey grid, baked in rather than drawn as a separate mesh so
      // it fades out with the light instead of ending in a square.
      gctx.strokeStyle = "rgba(96,150,235,0.07)";
      gctx.lineWidth = 1;
      for (let i = 0; i <= 32; i++) {
        const p = (i / 32) * 512;
        gctx.beginPath();
        gctx.moveTo(p, 0);
        gctx.lineTo(p, 512);
        gctx.moveTo(0, p);
        gctx.lineTo(512, p);
        gctx.stroke();
      }
    }
    const groundTex = new THREE.CanvasTexture(groundCanvas);
    groundTex.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(SIZE * 2.6, 96),
      new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // Plain land stretching far past the lit campus, in exactly the colour
    // the pool of light fades to. Without it the lit disc simply stopped, and
    // its curved edge against the sky made the campus look like it was
    // sitting on a small planet.
    // Same material type as the lit ground, not an unlit one: an unlit plane
    // sat at a slightly different brightness and left a faint ring where the
    // two met.
    const outland = new THREE.Mesh(
      new THREE.CircleGeometry(SIZE * 14, 64),
      new THREE.MeshStandardMaterial({ color: HORIZON, roughness: 1 })
    );
    outland.rotation.x = -Math.PI / 2;
    outland.position.y = -0.05;
    scene.add(outland);

    const roadSegs: [THREE.Vector3, THREE.Vector3][] = [];

    // Roads: wide asphalt + curbs + dashed lane + green verge + LED edges
    const asphalt = new THREE.MeshStandardMaterial({
      color: 0x333b4d,
      roughness: 0.95,
    });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x3a465f });
    const vergeMat = new THREE.MeshStandardMaterial({
      color: 0x15502e,
      roughness: 1,
    });
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xeef3fb,
      emissive: 0x3a4a60,
      emissiveIntensity: 0.5,
    });
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      emissive: 0x2563eb,
      emissiveIntensity: 1.2,
    });
    const roadW = 7;
    routes
      .filter((r) => !r.isSimulation)
      .forEach((r) => {
        const a0 = getStop(r.sourceStopId);
        const b0 = getStop(r.destinationStopId);
        if (!a0 || !b0) return;
        const a = worldOf(a0.x, a0.y);
        const b = worldOf(b0.x, b0.y);
        roadSegs.push([a, b]);
        const d = new THREE.Vector3().subVectors(b, a);
        const len = d.length();
        const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
        const ang = Math.atan2(d.z, d.x);
        const px = -Math.sin(ang);
        const pz = Math.cos(ang);

        const road = new THREE.Mesh(
          new THREE.BoxGeometry(len, 0.3, roadW),
          asphalt
        );
        road.position.set(mid.x, 0.16, mid.z);
        road.rotation.y = -ang;
        road.receiveShadow = true;
        scene.add(road);

        // dashed centre lane markings
        const dashes = Math.max(1, Math.floor(len / 2.6));
        for (let di = 0; di < dashes; di++) {
          const f = (di + 0.5) / dashes;
          const dash = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.06, 0.22),
            lineMat
          );
          dash.position.set(
            a.x + (b.x - a.x) * f,
            0.32,
            a.z + (b.z - a.z) * f
          );
          dash.rotation.y = -ang;
          scene.add(dash);
        }

        for (const sgn of [-1, 1]) {
          const led = new THREE.Mesh(
            new THREE.BoxGeometry(len, 0.05, 0.12),
            ledMat
          );
          led.position.set(
            mid.x + px * sgn * (roadW / 2 - 0.1),
            0.34,
            mid.z + pz * sgn * (roadW / 2 - 0.1)
          );
          led.rotation.y = -ang;
          scene.add(led);
          const curb = new THREE.Mesh(
            new THREE.BoxGeometry(len, 0.24, 0.4),
            curbMat
          );
          curb.position.set(
            mid.x + px * sgn * (roadW / 2 + 0.2),
            0.2,
            mid.z + pz * sgn * (roadW / 2 + 0.2)
          );
          curb.rotation.y = -ang;
          curb.receiveShadow = true;
          scene.add(curb);
          const verge = new THREE.Mesh(
            new THREE.BoxGeometry(len, 0.12, 1.5),
            vergeMat
          );
          verge.position.set(
            mid.x + px * sgn * (roadW / 2 + 1.15),
            0.14,
            mid.z + pz * sgn * (roadW / 2 + 1.15)
          );
          verge.rotation.y = -ang;
          verge.receiveShadow = true;
          scene.add(verge);
        }
      });

    /*
     * Stops.
     *
     * These used to be a post with a glowing white ball on top - which is
     * also, exactly, what the street lamps are. Scanning the city you could
     * not tell a bus stop from a lamp post, on the one screen whose whole job
     * is showing where the buses stop. So a stop is now a flat green marker
     * ring on the tarmac with a sign board above it: a different colour, a
     * different shape, readable at a glance from any angle.
     */
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2a3550 });
    const stopSignTex = stopSignTexture();
    const stopSignMat = new THREE.MeshStandardMaterial({
      map: stopSignTex,
      emissiveMap: stopSignTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.7,
    });
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const ringGeo = new THREE.RingGeometry(1.5, 1.9, 32);
    stops.forEach((s) => {
      const p = worldOf(s.x, s.y);

      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.x, 0.36, p.z);
      scene.add(ring);

      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 3, 8),
        postMat
      );
      post.position.set(p.x, 1.5, p.z);
      post.castShadow = true;
      scene.add(post);

      // Square sign board, so it stays a distinct silhouette from the round
      // lamp heads even when the camera is far out.
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(1.05, 1.05, 0.14),
        stopSignMat
      );
      board.position.set(p.x, 3.3, p.z);
      scene.add(board);
    });

    // Crosswalks + traffic lights at the main junction stops
    const crossMat = new THREE.MeshStandardMaterial({
      color: 0xe4ebf7,
      emissive: 0x2a3346,
      emissiveIntensity: 0.35,
    });
    const tlBoxMat = new THREE.MeshStandardMaterial({ color: 0x0e131c });

    interface Signal {
      stopId: number;
      red: THREE.Mesh;
      amber: THREE.Mesh;
      green: THREE.Mesh;
      offset: number;
      ctx: CanvasRenderingContext2D;
      tex: THREE.CanvasTexture;
      lastKey: string;
    }
    const signals: Signal[] = [];
    // stop id -> its signal, so a bus can look up the light where it is halted.
    const signalAt = new Map<number, Signal>();
    const drawCount = (
      ctx: CanvasRenderingContext2D,
      tex: THREE.CanvasTexture,
      n: number,
      color: string
    ) => {
      ctx.fillStyle = "#05070d";
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = color;
      ctx.lineWidth = 8;
      ctx.strokeRect(6, 6, 116, 116);
      ctx.fillStyle = color;
      ctx.font = "bold 92px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(n), 64, 72);
      tex.needsUpdate = true;
    };
    const junctions = [1, 2, 6, 8];
    junctions.forEach((sid, k) => {
      const s = getStop(sid);
      if (!s) return;
      const p = worldOf(s.x, s.y);
      const conn = routes.find(
        (r) =>
          !r.isSimulation &&
          (r.sourceStopId === sid || r.destinationStopId === sid)
      );
      let ang = 0;
      if (conn) {
        const oid =
          conn.sourceStopId === sid ? conn.destinationStopId : conn.sourceStopId;
        const o = getStop(oid);
        if (o) {
          const q = worldOf(o.x, o.y);
          ang = Math.atan2(q.z - p.z, q.x - p.x);
        }
      }
      const px = -Math.sin(ang);
      const pz = Math.cos(ang);
      for (let j = -3; j <= 3; j++) {
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.05, roadW * 0.92),
          crossMat
        );
        bar.position.set(
          p.x + Math.cos(ang) * j * 0.55,
          0.33,
          p.z + Math.sin(ang) * j * 0.55
        );
        bar.rotation.y = -ang;
        scene.add(bar);
      }
      const baseX = p.x + px * (roadW / 2 + 1.2);
      const baseZ = p.z + pz * (roadW / 2 + 1.2);
      // upright pole
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.18, 6.4, 8),
        postMat
      );
      pole.position.set(baseX, 3.2, baseZ);
      pole.castShadow = true;
      scene.add(pole);
      // mast arm reaching over the road
      const armLen = Math.hypot(p.x - baseX, p.z - baseZ) + 0.6;
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(armLen, 0.2, 0.2),
        postMat
      );
      arm.position.set((p.x + baseX) / 2, 6.1, (p.z + baseZ) / 2);
      arm.rotation.y = -Math.atan2(p.z - baseZ, p.x - baseX);
      scene.add(arm);
      // signal housing hanging over the lane
      const hx = p.x + px * 1.2;
      const hz = p.z + pz * 1.2;
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 2, 0.62),
        tlBoxMat
      );
      housing.position.set(hx, 5.1, hz);
      housing.castShadow = true;
      scene.add(housing);
      const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
      const mkDot = (cy: number, c: number) => {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.21, 14, 14),
          new THREE.MeshStandardMaterial({
            color: c,
            emissive: c,
            emissiveIntensity: 0.04,
          })
        );
        dot.position.set(hx + dir.x * 0.34, cy, hz + dir.z * 0.34);
        scene.add(dot);
        return dot;
      };
      const red = mkDot(5.72, 0xef4444);
      const amber = mkDot(5.1, 0xf59e0b);
      const green = mkDot(4.48, 0x34d399);

      // Digital second-countdown board (like real campus signals)
      const cvs = document.createElement("canvas");
      cvs.width = 128;
      cvs.height = 128;
      const ctx = cvs.getContext("2d");
      const tex = new THREE.CanvasTexture(cvs);
      tex.colorSpace = THREE.SRGBColorSpace;
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(1.7, 1.7),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
      );
      board.position.set(hx + dir.x * 0.38, 3.4, hz + dir.z * 0.38);
      board.lookAt(
        board.position.x + dir.x,
        board.position.y,
        board.position.z + dir.z
      );
      scene.add(board);

      if (ctx) {
        const sig: Signal = {
          stopId: sid,
          red,
          amber,
          green,
          offset: k * 3.4,
          ctx,
          tex,
          lastKey: "",
        };
        signals.push(sig);
        signalAt.set(sid, sig);
      }
    });

    /*
     * City blocks: buildings on a jittered grid, keeping clear of the roads.
     *
     * Two things were wrong with the old version. Every building shared one
     * facade palette and one window colour, so the skyline read as a single
     * shape repeated; and every building was the same height right out to the
     * edge of the map, which put a solid wall of towers between the camera
     * and the roads this screen exists to show. Now the mix of wall colour,
     * window colour and lit-window ratio varies per building, and height
     * falls away towards the rim so the campus reads as a bowl - tall in the
     * middle, low at the edges, roads visible from outside.
     */
    const facadeStyles: Array<[string, string, number]> = [
      // wall tint, window glow, fraction of windows lit
      ["#2a3556", "#ffd98a", 0.62],
      ["#243a5e", "#cfe4ff", 0.45],
      ["#33305c", "#ffe9b5", 0.35],
      ["#22405e", "#a8d8ff", 0.55],
      ["#2c3350", "#ffc98a", 0.28],
      ["#1f3350", "#e8f4ff", 0.7],
      ["#302a4e", "#ffd06a", 0.4],
      ["#1d3a54", "#bcf0dd", 0.5],
    ];
    const facades = facadeStyles.map(([wall, glow, lit], i) =>
      facadeTexture(wall, glow, i * 11 + 1, lit)
    );
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1b2438 });
    let bi = 0;
    for (let gx = -SIZE * 1.05; gx <= SIZE * 1.05; gx += 7) {
      for (let gz = -SIZE * 1.05; gz <= SIZE * 1.05; gz += 7) {
        const jx = gx + (rng(bi + 1) - 0.5) * 3;
        const jz = gz + (rng(bi + 2) - 0.5) * 3;
        bi++;
        let near = Infinity;
        for (const [a, b] of roadSegs)
          near = Math.min(near, distToSeg(jx, jz, a, b));
        if (near < 9.5 || near > 24) continue; // keep the wide streets open
        if (rng(bi + 40) > 0.6) continue; // leave plenty of gaps

        // Height falloff: 1.0 at the centre of campus down to about 0.35 at
        // the rim, so the outer ring no longer hides everything behind it.
        const rim = Math.min(1, Math.hypot(jx, jz) / (SIZE * 1.05));
        const falloff = 1 - 0.65 * rim * rim;
        const h = (3.5 + rng(bi + 3) * 7.5) * falloff;
        const bw = 2.6 + rng(bi + 4) * 2.4;
        const bd = 2.6 + rng(bi + 5) * 2.4;

        const tex = facades[bi % facades.length];
        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          emissiveMap: tex,
          emissive: 0xffffff,
          emissiveIntensity: 0.5,
          roughness: 0.75,
          metalness: 0.1,
        });
        const bld = new THREE.Mesh(new THREE.BoxGeometry(bw, h, bd), mat);
        bld.position.set(jx, h / 2, jz);
        // A few degrees off the grid. Perfectly aligned boxes are the single
        // biggest giveaway that a city was generated by a loop.
        bld.rotation.y = (rng(bi + 9) - 0.5) * 0.5;
        bld.castShadow = true;
        bld.receiveShadow = true;
        scene.add(bld);

        // Taller blocks get a setback storey; the rest just get a rooftop
        // plant box. Two silhouettes instead of one.
        if (h > 7.5) {
          const setback = new THREE.Mesh(
            new THREE.BoxGeometry(bw * 0.66, h * 0.28, bd * 0.66),
            mat
          );
          setback.position.set(jx, h + h * 0.14, jz);
          setback.rotation.y = bld.rotation.y;
          setback.castShadow = true;
          scene.add(setback);
        } else {
          const roof = new THREE.Mesh(
            new THREE.BoxGeometry(bw * 0.5, 0.6, bd * 0.5),
            roofMat
          );
          roof.position.set(jx, h + 0.3, jz);
          roof.rotation.y = bld.rotation.y;
          roof.castShadow = true;
          scene.add(roof);
        }
      }
    }

    // Trees near the roadside
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x1f6b3a,
      roughness: 1,
    });
    for (let i = 0; i < 110; i++) {
      const ang = rng(i + 100) * Math.PI * 2;
      const rad = rng(i + 200) * SIZE * 1.05;
      const tx = Math.cos(ang) * rad;
      const tz = Math.sin(ang) * rad;
      let near = Infinity;
      for (const [a, b] of roadSegs)
        near = Math.min(near, distToSeg(tx, tz, a, b));
      if (near < 4.6 || near > 8.5) continue;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 1.4, 6),
        trunkMat
      );
      trunk.position.set(tx, 0.7, tz);
      trunk.castShadow = true;
      scene.add(trunk);
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(1.1, 2.4, 8),
        leafMat
      );
      leaf.position.set(tx, 2.2, tz);
      leaf.castShadow = true;
      scene.add(leaf);
    }

    // Street lamps along the roads (emissive heads, a few real lights)
    const lampPole = new THREE.MeshStandardMaterial({ color: 0x3a4a63 });
    const lampHeadMat = new THREE.MeshStandardMaterial({
      color: 0xfff4d0,
      emissive: 0xffe9a8,
      emissiveIntensity: 2.2,
    });
    let realLights = 0;
    roadSegs.forEach(([a, b], si) => {
      const ang = Math.atan2(b.z - a.z, b.x - a.x);
      const px = -Math.sin(ang);
      const pz = Math.cos(ang);
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      const lx = mid.x + px * (roadW / 2 + 0.9);
      const lz = mid.z + pz * (roadW / 2 + 0.9);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 3, 6),
        lampPole
      );
      pole.position.set(lx, 1.5, lz);
      pole.castShadow = true;
      scene.add(pole);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 10, 10),
        lampHeadMat
      );
      head.position.set(lx, 3.1, lz);
      scene.add(head);
      if (realLights < 6 && si % 2 === 0) {
        const pl = new THREE.PointLight(0xffe6a8, 0.5, 16, 2);
        pl.position.set(lx, 3, lz);
        scene.add(pl);
        realLights++;
      }
    });

    /*
     * Buses on each line's loop.
     *
     * The old version computed a position straight from elapsed time, which
     * meant the bus teleported from full speed to a dead stop and back, took
     * corners by snapping its heading instantly, and - having no state of its
     * own - had no way to react to anything, least of all a red light.
     *
     * So a bus now has a speed and gets driven: it accelerates away from a
     * stop, brakes on a curve into the next one, turns towards the new
     * direction over a few frames rather than in one, and stays put at a
     * junction until the light actually goes green.
     */
    interface Rig {
      mesh: THREE.Group;
      pts: THREE.Vector3[];
      /** The stop id at each point of the path, for looking up its signal. */
      nodeStops: number[];
      cum: number[];
      total: number;
      cruise: number;
      /** Position, speed and where it is in its route - see lib/traffic. */
      state: BusState;
      /** Facing, eased towards the direction of travel. */
      heading: number;
      brakeLights: THREE.Mesh[];
    }
    const rigs: Rig[] = [];
    const glowTex = radialTexture();
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a });
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff2c0,
      emissiveIntensity: 2,
    });
    busLines.forEach((line, li) => {
      const served = line.stopIds.filter((id) => getStop(id));
      if (served.length < 2) return;
      // Out-and-back so the bus always stays on drawn roads (the last stop
      // has no road back to the first, so we retrace instead of teleporting).
      // The stop ids are carried along the same path, because the bus needs to
      // know *which* stop each node is to find the traffic light there.
      const nodeStops = served.concat(
        served.slice(1, -1).reverse(),
        served[0]
      );
      const pts = nodeStops.map((id) => {
        const s = getStop(id)!;
        return worldOf(s.x, s.y);
      });
      const cum = [0];
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        total += pts[i].distanceTo(pts[i - 1]);
        cum.push(total);
      }

      const g = new THREE.Group();
      const color = new THREE.Color(line.color);

      /*
       * A pool of light on the road under the bus, in the line's own colour.
       *
       * Without it the bus is a two-pixel speck somewhere among forty
       * buildings - you have to hunt for the one moving thing on a screen
       * called "live buses". The halo is what your eye lands on first, and it
       * carries the line colour, so blue and green are told apart instantly
       * without reading the legend.
       */
      const halo = new THREE.Mesh(
        new THREE.PlaneGeometry(10.5, 10.5),
        new THREE.MeshBasicMaterial({
          map: glowTex,
          color,
          transparent: true,
          // Kept well under full strength: at full brightness the glow washed
          // straight over the bus, so the thing it was meant to point at
          // turned into a coloured smudge.
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.4;
      g.add(halo);
      // A real light too, so the tarmac and kerbs around the bus actually
      // brighten as it passes rather than the glow being a flat sticker.
      const beacon = new THREE.PointLight(color, 6, 13, 2);
      beacon.position.set(0, 2.4, 0);
      g.add(beacon);

      // A bus is roughly 12 m long on a 7 m road; the old 4.2 x 2 box was
      // nearly square, which is why it read as a car.
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(6.4, 1.6, 2.3),
        new THREE.MeshStandardMaterial({
          color,
          metalness: 0.3,
          roughness: 0.4,
        })
      );
      body.position.y = 1.2;
      body.castShadow = true;
      g.add(body);
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(6.44, 0.7, 2.34),
        new THREE.MeshStandardMaterial({
          color: 0x0a1626,
          metalness: 0.6,
          roughness: 0.2,
          emissive: 0x9fd8ff,
          emissiveIntensity: 0.35,
        })
      );
      win.position.y = 1.62;
      g.add(win);
      const roofSign = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.4, 2.32),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 1.4,
        })
      );
      roofSign.position.set(1.4, 2.2, 0);
      g.add(roofSign);
      for (const wx of [-2.1, 2.1]) {
        for (const wz of [-1.1, 1.1]) {
          const wheel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.45, 0.45, 0.32, 12),
            wheelMat
          );
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(wx, 0.45, wz);
          g.add(wheel);
        }
      }
      for (const hz of [-0.7, 0.7]) {
        const hl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), headMat);
        hl.position.set(3.2, 1, hz);
        g.add(hl);
      }
      // Brake lights: the clearest way to show that a bus is waiting on
      // purpose rather than simply frozen.
      const brakeLights: THREE.Mesh[] = [];
      for (const hz of [-0.8, 0.8]) {
        const bl = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.3, 0.4),
          new THREE.MeshStandardMaterial({
            color: 0x6b0f12,
            emissive: 0xff2d2d,
            emissiveIntensity: 0,
          })
        );
        bl.position.set(-3.22, 1.15, hz);
        g.add(bl);
        brakeLights.push(bl);
      }
      scene.add(g);

      rigs.push({
        mesh: g,
        pts,
        nodeStops,
        cum,
        total,
        // Slower on the second line, so the two are visibly different buses
        // rather than one animation drawn twice.
        cruise: 7.5 - li * 1.2,
        state: {
          // Spread the buses out along their routes at the start.
          s: (total * li) / Math.max(1, busLines.length),
          v: 0,
          node: 1,
          halted: false,
          wait: 0,
        },
        heading: 0,
        brakeLights,
      });
    });

    // Put each bus on the right segment for the starting offset above.
    for (const r of rigs) {
      while (r.state.node < r.cum.length - 1 && r.cum[r.state.node] < r.state.s)
        r.state.node++;
    }

    // Where a stop has a traffic light, its offset; null where it has none.
    const offsetForStop = (stopId: number) =>
      signalAt.get(stopId)?.offset ?? null;

    /** Advance one bus and put its mesh where the simulation says it is. */
    function driveBus(r: Rig, dt: number, el: number) {
      stepBus(
        r.state,
        { cum: r.cum, nodeStops: r.nodeStops },
        r.cruise,
        dt,
        el,
        offsetForStop
      );

      // Position along the segment the bus is currently on.
      const i = r.state.node - 1;
      const a = r.pts[i];
      const b = r.pts[i + 1];
      const segLen = r.cum[i + 1] - r.cum[i] || 1;
      const tt = Math.min(1, Math.max(0, (r.state.s - r.cum[i]) / segLen));
      r.mesh.position.set(a.x + (b.x - a.x) * tt, 0, a.z + (b.z - a.z) * tt);

      r.heading = easeHeading(
        r.heading,
        -Math.atan2(b.z - a.z, b.x - a.x),
        dt
      );
      r.mesh.rotation.y = r.heading;

      const braking = r.state.v < r.cruise * 0.35;
      for (const bl of r.brakeLights) {
        (bl.material as THREE.MeshStandardMaterial).emissiveIntensity = braking
          ? 2.4
          : 0;
      }
    }

    const setLit = (m: THREE.Mesh, on: boolean) => {
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 3 : 0.04;
    };

    const clock = new THREE.Clock();
    const PHASE_COLOR: Record<Phase, string> = {
      green: "#34d399",
      amber: "#f59e0b",
      red: "#f87171",
    };
    let raf = 0;
    const tick = () => {
      // Capped: coming back to a backgrounded tab hands you one enormous
      // delta, and the buses would leap across the campus in a single frame.
      const dt = Math.min(0.05, clock.getDelta());
      const el = clock.getElapsedTime();

      // Lamps and countdown boards, from the same phaseOf the buses obey.
      signals.forEach((sg) => {
        const { phase, left } = phaseOf(sg.offset, el);
        setLit(sg.green, phase === "green");
        setLit(sg.amber, phase === "amber");
        setLit(sg.red, phase === "red");
        const rem = Math.ceil(left);
        const key = phase + rem;
        if (key !== sg.lastKey) {
          drawCount(sg.ctx, sg.tex, rem, PHASE_COLOR[phase]);
          sg.lastKey = key;
        }
      });

      rigs.forEach((r) => driveBus(r, dt, el));
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const ro = new ResizeObserver(() => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      if (!userTookOver) frameCampus();
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount)
        mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <Card title={t("map.title")} subtitle={t("map.subtitle")}>
      <div className="relative">
        <div
          ref={mountRef}
          className="h-[440px] w-full overflow-hidden rounded-xl border border-slate-700/50 bg-ink-950 md:h-[560px]"
        />
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 rounded-lg border border-slate-700/60 bg-ink-950/70 px-3 py-2 text-xs backdrop-blur">
          {busLines.map((l) => (
            <span key={l.code} className="flex items-center gap-2 text-slate-300">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: l.color }}
              />
              {l.displayName}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
