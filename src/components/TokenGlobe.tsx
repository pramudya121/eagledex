import { useEffect, useRef } from "react";
import * as THREE from "three";
import { TOKENS } from "@/lib/chain";

/**
 * 3D Token Globe — a glowing crimson sphere ringed by intersecting orbits.
 * Token logos travel along the orbit rings smoothly, like satellites.
 */
const TokenGlobe = ({ height = 460 }: { height?: number }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current!;
    const w = () => mount.clientWidth;
    const h = () => mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w() / h(), 0.1, 100);
    camera.position.set(0, 0.6, 9.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w(), h());
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.PointLight(0xff3355, 2.4, 30); key.position.set(4, 3, 5); scene.add(key);
    const rim = new THREE.PointLight(0xff7a3a, 1.2, 30); rim.position.set(-5, -2, 4); scene.add(rim);

    const root = new THREE.Group();
    // Scale whole system so largest orbit always fits inside the viewport
    // regardless of breakpoint — prevents orbits being clipped on small screens.
    const fitScale = () => {
      const aspect = w() / h();
      const vFov = (camera.fov * Math.PI) / 180;
      const visibleH = 2 * Math.tan(vFov / 2) * camera.position.z;
      const visibleW = visibleH * aspect;
      const maxOrbit = 3.55; // largest ring radius + a little margin
      const target = Math.min(visibleW, visibleH) / 2;
      const s = Math.min(1, (target / maxOrbit) * 0.92);
      root.scale.setScalar(s);
    };
    scene.add(root);

    // === Core globe ===
    const globeGeo = new THREE.IcosahedronGeometry(1.55, 4);
    const globeMat = new THREE.MeshStandardMaterial({
      color: 0x1a0509,
      roughness: 0.35,
      metalness: 0.7,
      emissive: 0xa01020,
      emissiveIntensity: 0.45,
    });
    const globe = new THREE.Mesh(globeGeo, globeMat);
    root.add(globe);

    // Wireframe overlay (gives planet/globe feel)
    const wireGeo = new THREE.IcosahedronGeometry(1.57, 2);
    const wireMat = new THREE.LineBasicMaterial({ color: 0xff3a55, transparent: true, opacity: 0.45 });
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(wireGeo), wireMat);
    root.add(wire);

    // Inner glow halo
    const haloGeo = new THREE.SphereGeometry(1.85, 64, 64);
    const haloMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { c: { value: new THREE.Color(0xff3355) } },
      vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vP=mv.xyz; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vP; uniform vec3 c; void main(){ float f=pow(1.0-abs(dot(vN,normalize(-vP))),2.5); gl_FragColor=vec4(c,f*0.55); }`,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    root.add(new THREE.Mesh(haloGeo, haloMat));

    // === Orbit rings — 3 intersecting tilted rings ===
    const ringDefs = [
      { radius: 2.7, tiltX: 0.0, tiltZ: 0.0,        speed: 0.35, color: 0xff3a55 },
      { radius: 3.05, tiltX: 1.05, tiltZ: 0.4,      speed: -0.27, color: 0xff7a3a },
      { radius: 3.35, tiltX: -0.7, tiltZ: 1.1,      speed: 0.21, color: 0xff5577 },
    ];
    type Ring = (typeof ringDefs)[number] & { group: THREE.Group };
    const rings: Ring[] = ringDefs.map(r => {
      const g = new THREE.Group();
      g.rotation.x = r.tiltX;
      g.rotation.z = r.tiltZ;
      // Ring line
      const seg = 256;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r.radius, 0, Math.sin(a) * r.radius));
      }
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineBasicMaterial({ color: r.color, transparent: true, opacity: 0.55 });
      g.add(new THREE.Line(lineGeo, lineMat));
      // Subtle glow strip on ring (slightly larger, fainter)
      const lineMat2 = new THREE.LineBasicMaterial({ color: r.color, transparent: true, opacity: 0.18 });
      const pts2 = pts.map(p => p.clone().multiplyScalar(1.012));
      const lineGeo2 = new THREE.BufferGeometry().setFromPoints(pts2);
      g.add(new THREE.Line(lineGeo2, lineMat2));
      root.add(g);
      return { ...r, group: g };
    });

    // === Token sprites along the rings ===
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    const distinct = TOKENS.filter((t, i, arr) =>
      !t.isNative && arr.findIndex(x => x.symbol === t.symbol) === i
    ).slice(0, 9);

    type Sat = { sprite: THREE.Sprite; ring: Ring; angle: number; symbol: string };
    const sats: Sat[] = [];

    distinct.forEach((tk, idx) => {
      const ring = rings[idx % rings.length];
      // Fallback canvas texture (token initial in a crimson disc) — used immediately,
      // replaced by real logo when it loads (avoids flicker / CORS holes).
      const fallback = makeInitialTexture(tk.symbol);
      const mat = new THREE.SpriteMaterial({ map: fallback, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.55, 0.55, 1);
      ring.group.add(sprite);
      sats.push({ sprite, ring, angle: (idx / distinct.length) * Math.PI * 2, symbol: tk.symbol });

      if (tk.logo) {
        loader.load(
          tk.logo,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            mat.map = tex;
            mat.needsUpdate = true;
          },
          undefined,
          () => { /* keep fallback on error */ }
        );
      }
    });

    function makeInitialTexture(label: string) {
      const c = document.createElement("canvas");
      c.width = 128; c.height = 128;
      const g = c.getContext("2d")!;
      const grd = g.createRadialGradient(64, 60, 8, 64, 64, 60);
      grd.addColorStop(0, "#ff6680");
      grd.addColorStop(1, "#7a0a1c");
      g.fillStyle = grd;
      g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 3;
      g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#fff"; g.font = "bold 56px Inter, sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(label.slice(0, 3), 64, 68);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }

    // Star dust behind globe
    const dustGeo = new THREE.BufferGeometry();
    const N = 400;
    const positions = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 6 + Math.random() * 4;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(ph) * Math.cos(th);
      positions[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      positions[i * 3 + 2] = r * Math.cos(ph);
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffe4ec, size: 0.04, transparent: true, opacity: 0.55 }));
    scene.add(dust);

    // Pointer parallax
    const target = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      target.x = ((e.clientX - rect.left) / rect.width - 0.5) * 0.6;
      target.y = ((e.clientY - rect.top) / rect.height - 0.5) * 0.4;
    };
    mount.addEventListener("pointermove", onMove);

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last) / 1000; last = now;

      globe.rotation.y += dt * 0.18;
      wire.rotation.y -= dt * 0.12;
      wire.rotation.x += dt * 0.05;
      dust.rotation.y += dt * 0.02;

      // smooth parallax
      root.rotation.y += (target.x - root.rotation.y) * 0.04;
      root.rotation.x += (target.y - root.rotation.x) * 0.04;

      // satellites travel along their rings; rings also slowly rotate themselves
      for (const r of rings) r.group.rotateY(dt * r.speed * 0.4);
      for (const s of sats) {
        s.angle += dt * s.ring.speed;
        s.sprite.position.set(Math.cos(s.angle) * s.ring.radius, 0, Math.sin(s.angle) * s.ring.radius);
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onResize = () => {
      camera.aspect = w() / h();
      camera.updateProjectionMatrix();
      renderer.setSize(w(), h());
      fitScale();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);
    fitScale();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mount.removeEventListener("pointermove", onMove);
      renderer.dispose();
      globeGeo.dispose(); wireGeo.dispose(); haloGeo.dispose(); dustGeo.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="w-full" style={{ height }} aria-hidden />;
};

export default TokenGlobe;