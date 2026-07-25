import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import Card from "./Card";
import { stops, routes, busLines, getStop } from "../data/campusData";
import { useLang } from "../lib/i18n";

const SIZE = 44; // half-width of the world in scene units

// Map a campus percentage coordinate (0..100) to a world position.
function worldOf(x: number, y: number) {
  return new THREE.Vector3(((x - 50) / 50) * SIZE, 0, ((y - 50) / 50) * SIZE);
}

// A little deterministic pseudo-random so buildings look varied but stable.
function rng(seed: number) {
  const s = Math.sin(seed * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

// A 3D miniature campus city (Three.js): glowing roads, stops, low-poly
// buildings, and buses driving the real route-board loops in real time.
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
    scene.background = new THREE.Color(0x0a1020);
    scene.fog = new THREE.Fog(0x0a1020, SIZE * 1.6, SIZE * 3.2);

    const camera = new THREE.PerspectiveCamera(
      42,
      mount.clientWidth / Math.max(1, mount.clientHeight),
      0.1,
      1000
    );
    camera.position.set(SIZE * 1.15, SIZE * 1.0, SIZE * 1.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = SIZE * 0.9;
    controls.maxDistance = SIZE * 2.4;
    controls.maxPolarAngle = 1.35;
    controls.target.set(0, 2, 0);
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 0.55;

    // Lighting
    scene.add(new THREE.AmbientLight(0x3a4a6a, 1.1));
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(SIZE, SIZE * 1.4, SIZE * 0.6);
    scene.add(dir);
    const p1 = new THREE.PointLight(0x38bdf8, 0.6, SIZE * 2);
    p1.position.set(-SIZE * 0.6, 12, -SIZE * 0.4);
    scene.add(p1);
    const p2 = new THREE.PointLight(0xa78bfa, 0.6, SIZE * 2);
    p2.position.set(SIZE * 0.6, 12, SIZE * 0.5);
    scene.add(p2);

    // Base plate + grid
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(SIZE * 2.3, 1, SIZE * 2.3),
      new THREE.MeshStandardMaterial({ color: 0x0c1426, roughness: 1 })
    );
    base.position.y = -0.5;
    scene.add(base);
    const grid = new THREE.GridHelper(SIZE * 2.2, 34, 0x1c2a48, 0x14203a);
    grid.position.y = 0.02;
    scene.add(grid);

    // Greenery patches for a campus feel
    const greenMat = new THREE.MeshStandardMaterial({
      color: 0x123528,
      roughness: 1,
    });
    for (let i = 0; i < 7; i++) {
      const w = 8 + rng(i + 1) * 10;
      const d = 8 + rng(i + 9) * 10;
      const g = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), greenMat);
      g.position.set(
        (rng(i + 3) - 0.5) * SIZE * 1.6,
        0.06,
        (rng(i + 5) - 0.5) * SIZE * 1.6
      );
      scene.add(g);
    }

    // Roads (real route-board edges only) + glowing LED centre line
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x25324a,
      roughness: 0.9,
    });
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.4,
    });
    routes
      .filter((r) => !r.isSimulation)
      .forEach((r) => {
        const a = getStop(r.sourceStopId);
        const b = getStop(r.destinationStopId);
        if (!a || !b) return;
        const pa = worldOf(a.x, a.y);
        const pb = worldOf(b.x, b.y);
        const dirv = new THREE.Vector3().subVectors(pb, pa);
        const len = dirv.length();
        const mid = new THREE.Vector3().addVectors(pa, pb).multiplyScalar(0.5);
        const ang = Math.atan2(dirv.z, dirv.x);
        const road = new THREE.Mesh(
          new THREE.BoxGeometry(len, 0.3, 3.4),
          roadMat
        );
        road.position.set(mid.x, 0.16, mid.z);
        road.rotation.y = -ang;
        scene.add(road);
        const led = new THREE.Mesh(
          new THREE.BoxGeometry(len, 0.06, 0.22),
          ledMat
        );
        led.position.set(mid.x, 0.33, mid.z);
        led.rotation.y = -ang;
        scene.add(led);
      });

    // Stops: post + glowing bulb
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2a3550 });
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xe2f0ff,
      emissive: 0x8fd0ff,
      emissiveIntensity: 1.2,
    });
    const buildingColors = [0x2b3b63, 0x334a7a, 0x3a3363, 0x274a63, 0x2f3a55];
    stops.forEach((s, i) => {
      const p = worldOf(s.x, s.y);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 2.2, 8),
        postMat
      );
      post.position.set(p.x, 1.1, p.z);
      scene.add(post);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 16, 16),
        bulbMat
      );
      bulb.position.set(p.x, 2.5, p.z);
      scene.add(bulb);

      // A low-poly building offset from the stop
      const h = 4 + rng(i + 2) * 9;
      const bw = 3 + rng(i + 4) * 3;
      const bd = 3 + rng(i + 6) * 3;
      const off = 6 + rng(i + 8) * 3;
      const ox = p.x + (rng(i + 10) - 0.5) * off * 2;
      const oz = p.z + (rng(i + 12) - 0.5) * off * 2;
      const bMat = new THREE.MeshStandardMaterial({
        color: buildingColors[i % buildingColors.length],
        emissive: 0x0a1830,
        emissiveIntensity: 0.5,
        roughness: 0.7,
      });
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, h, bd), bMat);
      b.position.set(ox, h / 2, oz);
      scene.add(b);
    });

    // Buses that drive each line's loop
    interface BusRig {
      mesh: THREE.Group;
      pts: THREE.Vector3[];
      cum: number[];
      total: number;
      speed: number;
      offset: number;
    }
    const rigs: BusRig[] = [];
    busLines.forEach((line, li) => {
      const pts = line.stopIds
        .map((id) => getStop(id))
        .filter(Boolean)
        .map((s) => worldOf((s as (typeof stops)[number]).x, (s as (typeof stops)[number]).y));
      if (pts.length < 2) return;
      pts.push(pts[0].clone()); // close the loop
      const cum = [0];
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        total += pts[i].distanceTo(pts[i - 1]);
        cum.push(total);
      }

      const group = new THREE.Group();
      const color = new THREE.Color(line.color);
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(4, 1.6, 2),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.35,
          roughness: 0.5,
        })
      );
      body.position.y = 1.2;
      group.add(body);
      const windows = new THREE.Mesh(
        new THREE.BoxGeometry(4.02, 0.7, 2.02),
        new THREE.MeshStandardMaterial({
          color: 0x0a1424,
          emissive: 0x0a1424,
        })
      );
      windows.position.y = 1.5;
      group.add(windows);
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.3, 1),
        new THREE.MeshStandardMaterial({ color: 0x0a0a0a })
      );
      roof.position.y = 2.15;
      group.add(roof);
      scene.add(group);

      rigs.push({
        mesh: group,
        pts,
        cum,
        total,
        speed: total / (18 + li * 5), // loop time ~18s, ~23s
        offset: (li * total) / 2,
      });
    });

    function placeBus(rig: BusRig, elapsed: number) {
      const d = (rig.offset + elapsed * rig.speed) % rig.total;
      let seg = 0;
      while (seg < rig.cum.length - 2 && rig.cum[seg + 1] < d) seg++;
      const segLen = rig.cum[seg + 1] - rig.cum[seg] || 1;
      const tt = (d - rig.cum[seg]) / segLen;
      const a = rig.pts[seg];
      const b = rig.pts[seg + 1];
      rig.mesh.position.set(
        a.x + (b.x - a.x) * tt,
        0,
        a.z + (b.z - a.z) * tt
      );
      rig.mesh.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    }

    const clock = new THREE.Clock();
    let raf = 0;
    function tick() {
      const el = clock.getElapsedTime();
      rigs.forEach((r) => placeBus(r, el));
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }
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
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <Card title={t("map.title")} subtitle={t("map.subtitle")}>
      <div className="relative">
        <div
          ref={mountRef}
          className="h-[420px] w-full overflow-hidden rounded-xl border border-slate-700/50 bg-ink-950 md:h-[520px]"
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
