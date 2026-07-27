import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

// Vite can import assets as URLs:
import subModelUrl from "../assets/tori_submarine.stl?url";

function createSubmarineMesh() {
  const group = new THREE.Group();

  const blackMat = new THREE.MeshStandardMaterial({
    color: 0x181818,
    roughness: 0.6,
    metalness: 0.3,
  });
  const orangeMat = new THREE.MeshStandardMaterial({
    color: 0xea580c,
    roughness: 0.4,
    metalness: 0.1,
  });

  const bodyLength = 60;
  const bodyRadius = 10;

  // 1. Main Body
  const bodyGeo = new THREE.CylinderGeometry(
    bodyRadius,
    bodyRadius,
    bodyLength,
    32,
  );
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, blackMat);
  group.add(body);

  // 2. Nose (Dome)
  const noseGeo = new THREE.SphereGeometry(
    bodyRadius,
    32,
    16,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2,
  );
  noseGeo.rotateX(Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, orangeMat);
  nose.position.z = bodyLength / 2;
  group.add(nose);

  // 3. Tail section
  const tailLength = 16;
  const tailGeo = new THREE.CylinderGeometry(6, bodyRadius, tailLength, 32);
  tailGeo.rotateX(Math.PI / 2);
  const tail = new THREE.Mesh(tailGeo, orangeMat);
  tail.position.z = -bodyLength / 2 - tailLength / 2;
  group.add(tail);

  // 4. Shroud
  const shroudLength = 10;
  const shroudGeo = new THREE.CylinderGeometry(8, 8, shroudLength, 32, 1, true);
  shroudGeo.rotateX(Math.PI / 2);
  const shroudMat = new THREE.MeshStandardMaterial({
    color: 0xea580c,
    roughness: 0.4,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  const shroud = new THREE.Mesh(shroudGeo, shroudMat);
  shroud.position.z = -bodyLength / 2 - tailLength - shroudLength / 2;
  group.add(shroud);

  // 5. Tail Fins (Cross)
  const finCrossGeo = new THREE.BoxGeometry(16, 1, 10);
  const finH = new THREE.Mesh(finCrossGeo, orangeMat);
  finH.position.z = shroud.position.z;
  group.add(finH);
  const finV = new THREE.Mesh(finCrossGeo, orangeMat);
  finV.rotateZ(Math.PI / 2);
  finV.position.z = shroud.position.z;
  group.add(finV);

  // 6. Dorsal Fin
  const dorsalGeo = new THREE.ConeGeometry(5, 12, 16);
  const dorsal = new THREE.Mesh(dorsalGeo, orangeMat);
  dorsal.scale.set(0.3, 1, 1.2);
  dorsal.rotation.x = -0.2;
  dorsal.position.set(0, bodyRadius + 3, -5);
  group.add(dorsal);

  // 7. Side Fins
  const sideFinGeo = new THREE.ConeGeometry(3, 14, 16);
  const leftFin = new THREE.Mesh(sideFinGeo, orangeMat);
  leftFin.scale.set(1, 1, 0.2);
  leftFin.rotation.z = -Math.PI / 2;
  leftFin.rotation.y = -0.2;
  leftFin.position.set(bodyRadius + 2, 0, 15);
  group.add(leftFin);

  const rightFin = new THREE.Mesh(sideFinGeo, orangeMat);
  rightFin.scale.set(1, 1, 0.2);
  rightFin.rotation.z = Math.PI / 2;
  rightFin.rotation.y = 0.2;
  rightFin.position.set(-(bodyRadius + 2), 0, 15);
  group.add(rightFin);

  // 8. Top Antenna/Knob
  const nubGeo = new THREE.CylinderGeometry(1.5, 1.5, 4, 16);
  const nub = new THREE.Mesh(nubGeo, blackMat);
  nub.position.set(0, bodyRadius + 2, -15);
  group.add(nub);

  // 9. Propeller tip
  const propGeo = new THREE.ConeGeometry(3, 6, 16);
  propGeo.rotateX(-Math.PI / 2);
  const prop = new THREE.Mesh(propGeo, orangeMat);
  prop.position.z = shroud.position.z - 2;
  group.add(prop);

  return group;
}

function PFD3D({ pitch = 0, roll = 0, heading = 0 }) {
  const mountRef = useRef(null);
  const meshRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const telemetryRef = useRef({ pitch, roll, heading });

  // Update telemetry ref immediately when props change, without forcing React lifecycle delays
  useEffect(() => {
    telemetryRef.current = { pitch, roll, heading };
  }, [pitch, roll, heading]);

  useEffect(() => {
    // 1. Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    // Rear-right isometric chase cam (looking at the back of the sub)
    camera.position.set(-120, 80, -120);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1);
    dirLight1.position.set(100, 150, 100);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight2.position.set(-100, -50, -50);
    scene.add(dirLight2);

    // 3. Generate Procedural Submarine!
    const mesh = createSubmarineMesh();

    // Measure the group to calculate scale
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 100 / maxDim;
    mesh.scale.set(scale, scale, scale);

    // Center it precisely
    box.setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    mesh.position.sub(center);

    // Wrap in a pivot group so rotations happen around exactly origin
    const pivotGroup = new THREE.Group();
    pivotGroup.add(mesh);

    meshRef.current = pivotGroup;
    scene.add(pivotGroup);

    // Handle Resize using ResizeObserver
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current)
        return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      if (width === 0 || height === 0) return;

      rendererRef.current.setSize(width, height);
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (mountRef.current) {
      resizeObserver.observe(mountRef.current);
    }
    handleResize(); // Initial sizing

    // Render loop
    let animationFrameId;
    const renderLoop = () => {
      if (
        rendererRef.current &&
        sceneRef.current &&
        cameraRef.current &&
        meshRef.current
      ) {
        // Read telemetry directly from ref to bypass React rendering batching issues
        const { pitch: pDeg, roll: rDeg, heading: hDeg } = telemetryRef.current;

        const p = -pDeg * (Math.PI / 180);
        const y = -hDeg * (Math.PI / 180);
        const r = rDeg * (Math.PI / 180);

        // Apply rotation
        meshRef.current.rotation.set(p, y, r, "YXZ");

        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current && rendererRef.current.domElement) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current.dispose();
    };
  }, []); // Run once on mount

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 10,
      }}
    />
  );
}

export default PFD3D;
