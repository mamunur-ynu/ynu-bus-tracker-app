import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import Card from "./Card";
import { stops, routes, busLines, getStop } from "../data/campusData";
import { useLang } from "../lib/i18n";

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

// A canvas texture of a building facade with a grid of lit / unlit windows.
function facadeTexture(wall: string, seed: number) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(c);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, 64, 128);
  const cols = 4;
  const rows = 8;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const on = rng(seed + x * 3 + y * 7) > 0.4;
      ctx.fillStyle = on ? "#ffd98a" : "#0b1424";
      ctx.fillRect(6 + x * 14, 6 + y * 14, 9, 11);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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
    scene.background = new THREE.Color(0x070b16);
    scene.fog = new THREE.Fog(0x070b16, SIZE * 1.5, SIZE * 3.4);

    const camera = new THREE.PerspectiveCamera(
      40,
      mount.clientWidth / Math.max(1, mount.clientHeight),
      0.1,
      1000
    );
    camera.position.set(SIZE * 0.95, SIZE * 0.72, SIZE * 1.08);

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
    controls.minDistance = SIZE * 0.7;
    controls.maxDistance = SIZE * 2.2;
    controls.maxPolarAngle = 1.4;
    controls.target.set(0, 2.5, 0);
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 0.5;

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

    // Ground
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(SIZE * 2.4, 1, SIZE * 2.4),
      new THREE.MeshStandardMaterial({ color: 0x0d1526, roughness: 1 })
    );
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(SIZE * 2.3, 40, 0x1a2a4a, 0x0f1a30);
    grid.position.y = 0.015;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    scene.add(grid);

    const roadSegs: [THREE.Vector3, THREE.Vector3][] = [];

    // Roads: asphalt + curbs + white centre line + cyan LED edges
    const asphalt = new THREE.MeshStandardMaterial({
      color: 0x1c2233,
      roughness: 0.85,
    });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x2f3a52 });
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xdfe7f5,
      emissive: 0x2a3346,
      emissiveIntensity: 0.4,
    });
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 2.2,
    });
    const roadW = 4;
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

        const line = new THREE.Mesh(
          new THREE.BoxGeometry(len * 0.94, 0.06, 0.18),
          lineMat
        );
        line.position.set(mid.x, 0.32, mid.z);
        line.rotation.y = -ang;
        scene.add(line);

        for (const sgn of [-1, 1]) {
          const led = new THREE.Mesh(
            new THREE.BoxGeometry(len, 0.05, 0.14),
            ledMat
          );
          led.position.set(
            mid.x + px * sgn * (roadW / 2),
            0.34,
            mid.z + pz * sgn * (roadW / 2)
          );
          led.rotation.y = -ang;
          scene.add(led);
          const curb = new THREE.Mesh(
            new THREE.BoxGeometry(len, 0.22, 0.4),
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
        }
      });

    // Stops: post + glowing bulb
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2a3550 });
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xe6f3ff,
      emissive: 0x9fd8ff,
      emissiveIntensity: 1.6,
    });
    stops.forEach((s) => {
      const p = worldOf(s.x, s.y);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 2.4, 8),
        postMat
      );
      post.position.set(p.x, 1.2, p.z);
      post.castShadow = true;
      scene.add(post);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 16, 16),
        bulbMat
      );
      bulb.position.set(p.x, 2.7, p.z);
      scene.add(bulb);
    });

    // City blocks: buildings placed on a grid, avoiding the roads
    const wallTints = ["#2a3556", "#243a5e", "#33305c", "#22405e", "#2c3350"];
    const facades = wallTints.map((w, i) => facadeTexture(w, i * 11 + 1));
    let bi = 0;
    for (let gx = -SIZE * 1.05; gx <= SIZE * 1.05; gx += 7) {
      for (let gz = -SIZE * 1.05; gz <= SIZE * 1.05; gz += 7) {
        const jx = gx + (rng(bi + 1) - 0.5) * 3;
        const jz = gz + (rng(bi + 2) - 0.5) * 3;
        bi++;
        let near = Infinity;
        for (const [a, b] of roadSegs)
          near = Math.min(near, distToSeg(jx, jz, a, b));
        if (near < 4.6 || near > 26) continue;
        if (rng(bi + 40) > 0.82) continue; // leave some gaps
        const h = 4 + rng(bi + 3) * 13;
        const bw = 2.6 + rng(bi + 4) * 2.6;
        const bd = 2.6 + rng(bi + 5) * 2.6;
        const tex = facades[bi % facades.length].clone();
        tex.needsUpdate = true;
        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          emissiveMap: tex,
          emissive: 0xffffff,
          emissiveIntensity: 0.55,
          roughness: 0.75,
          metalness: 0.1,
        });
        const bld = new THREE.Mesh(new THREE.BoxGeometry(bw, h, bd), mat);
        bld.position.set(jx, h / 2, jz);
        bld.castShadow = true;
        bld.receiveShadow = true;
        scene.add(bld);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(bw * 0.5, 0.6, bd * 0.5),
          postMat
        );
        roof.position.set(jx, h + 0.3, jz);
        roof.castShadow = true;
        scene.add(roof);
      }
    }

    // Trees near the roadside
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x1f6b3a,
      roughness: 1,
    });
    for (let i = 0; i < 60; i++) {
      const ang = rng(i + 100) * Math.PI * 2;
      const rad = rng(i + 200) * SIZE * 1.05;
      const tx = Math.cos(ang) * rad;
      const tz = Math.sin(ang) * rad;
      let near = Infinity;
      for (const [a, b] of roadSegs)
        near = Math.min(near, distToSeg(tx, tz, a, b));
      if (near < 3.2 || near > 6.5) continue;
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

    // Buses on each line's loop
    interface Rig {
      mesh: THREE.Group;
      pts: THREE.Vector3[];
      cum: number[];
      total: number;
      speed: number;
      offset: number;
    }
    const rigs: Rig[] = [];
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a });
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff2c0,
      emissiveIntensity: 2,
    });
    busLines.forEach((line, li) => {
      const pts = line.stopIds
        .map((id) => getStop(id))
        .filter((s): s is (typeof stops)[number] => Boolean(s))
        .map((s) => worldOf(s.x, s.y));
      if (pts.length < 2) return;
      pts.push(pts[0].clone());
      const cum = [0];
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        total += pts[i].distanceTo(pts[i - 1]);
        cum.push(total);
      }

      const g = new THREE.Group();
      const color = new THREE.Color(line.color);
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 1.5, 2),
        new THREE.MeshStandardMaterial({
          color,
          metalness: 0.3,
          roughness: 0.4,
        })
      );
      body.position.y = 1.15;
      body.castShadow = true;
      g.add(body);
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(4.24, 0.6, 2.04),
        new THREE.MeshStandardMaterial({
          color: 0x0a1626,
          metalness: 0.6,
          roughness: 0.2,
          emissive: 0x0a1626,
        })
      );
      win.position.y = 1.55;
      g.add(win);
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.35, 2.02),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.6,
        })
      );
      sign.position.set(1, 2.05, 0);
      g.add(sign);
      for (const wx of [-1.3, 1.3]) {
        for (const wz of [-0.95, 0.95]) {
          const wheel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12),
            wheelMat
          );
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(wx, 0.42, wz);
          g.add(wheel);
        }
      }
      for (const hz of [-0.6, 0.6]) {
        const hl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), headMat);
        hl.position.set(2.1, 0.95, hz);
        g.add(hl);
      }
      scene.add(g);

      rigs.push({
        mesh: g,
        pts,
        cum,
        total,
        speed: total / (20 + li * 6),
        offset: (li * total) / 2,
      });
    });

    function placeBus(r: Rig, el: number) {
      const d = (r.offset + el * r.speed) % r.total;
      let seg = 0;
      while (seg < r.cum.length - 2 && r.cum[seg + 1] < d) seg++;
      const segLen = r.cum[seg + 1] - r.cum[seg] || 1;
      const tt = (d - r.cum[seg]) / segLen;
      const a = r.pts[seg];
      const b = r.pts[seg + 1];
      r.mesh.position.set(a.x + (b.x - a.x) * tt, 0, a.z + (b.z - a.z) * tt);
      r.mesh.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    }

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      const el = clock.getElapsedTime();
      rigs.forEach((r) => placeBus(r, el));
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
