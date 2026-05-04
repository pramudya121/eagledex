import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Compact decorative 3D orb that floats above forms (Swap / Liquidity).
 * - Pure Three.js (no R3F) so it stays light.
 * - Transparent canvas; renders glowing wireframe icosahedron + inner core,
 *   with a slow auto-rotation and subtle parallax on pointer move.
 * - Designed to sit centered behind a form header, not interactive.
 */
const FormOrb3D = ({
  height = 140,
  hue = "primary",
}: {
  height?: number;
  /** Color theme — uses CSS var --primary by default, or override with a hex. */
  hue?: "primary" | string;
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current!;
    const w = () => mount.clientWidth;
    const h = () => mount.clientHeight;

    // Resolve color from CSS var if requested
    const resolveColor = () => {
      if (hue !== "primary") return new THREE.Color(hue);
      const css = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
      // --primary is HSL space-separated (e.g. "0 84% 60%")
      if (css) {
        const parts = css.split(/\s+/);
        if (parts.length === 3) {
          const hh = parseFloat(parts[0]);
          const ss = parseFloat(parts[1]);
          const ll = parseFloat(parts[2]);
          if (isFinite(hh) && isFinite(ss) && isFinite(ll)) {
            const c = new THREE.Color();
            c.setHSL(hh / 360, ss / 100, ll / 100);
            return c;
          }
        }
      }
      return new THREE.Color("#ff3355");
    };
    const color = resolveColor();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w() / h(), 0.1, 100);
    camera.position.set(0, 0, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w(), h());
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const key = new THREE.PointLight(color, 2.2, 20); key.position.set(3, 2, 4); scene.add(key);
    const fill = new THREE.PointLight(0xffffff, 0.6, 20); fill.position.set(-3, -2, 3); scene.add(fill);

    const root = new THREE.Group();
    scene.add(root);

    // Inner glowing core — solid sphere with emissive material
    const coreGeo = new THREE.IcosahedronGeometry(0.85, 1);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0f,
      emissive: color,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.7,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    root.add(core);

    // Outer wireframe shell
    const shellGeo = new THREE.IcosahedronGeometry(1.45, 2);
    const shellMat = new THREE.MeshBasicMaterial({
      color, wireframe: true, transparent: true, opacity: 0.55,
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    root.add(shell);

    // Outermost faint ring of points — gives a "particle aura" feel
    const auraCount = 220;
    const auraPos = new Float32Array(auraCount * 3);
    for (let i = 0; i < auraCount; i++) {
      // Random points on sphere of radius ~1.85
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const r = 1.85;
      const sq = Math.sqrt(1 - u * u);
      auraPos[i * 3 + 0] = r * sq * Math.cos(t);
      auraPos[i * 3 + 1] = r * sq * Math.sin(t);
      auraPos[i * 3 + 2] = r * u;
    }
    const auraGeo = new THREE.BufferGeometry();
    auraGeo.setAttribute("position", new THREE.BufferAttribute(auraPos, 3));
    const auraMat = new THREE.PointsMaterial({
      color, size: 0.035, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const aura = new THREE.Points(auraGeo, auraMat);
    root.add(aura);

    // Pointer parallax
    const target = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      target.x = ((e.clientX - rect.left) / rect.width - 0.5) * 0.6;
      target.y = ((e.clientY - rect.top) / rect.height - 0.5) * 0.6;
    };
    window.addEventListener("pointermove", onMove);

    // Resize
    const onResize = () => {
      camera.aspect = w() / h();
      camera.updateProjectionMatrix();
      renderer.setSize(w(), h());
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      core.rotation.y += 0.006;
      core.rotation.x += 0.003;
      shell.rotation.y -= 0.004;
      shell.rotation.x += 0.002;
      aura.rotation.y += 0.0015;
      // Smooth parallax
      root.rotation.y += (target.x - root.rotation.y * 0.15) * 0.02;
      root.rotation.x += (-target.y - root.rotation.x * 0.15) * 0.02;
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      ro.disconnect();
      renderer.dispose();
      coreGeo.dispose(); coreMat.dispose();
      shellGeo.dispose(); shellMat.dispose();
      auraGeo.dispose(); auraMat.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [hue]);

  return (
    <div
      ref={mountRef}
      style={{ height }}
      className="w-full pointer-events-none select-none"
      aria-hidden
    />
  );
};

export default FormOrb3D;
