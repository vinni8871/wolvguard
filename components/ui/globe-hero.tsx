"use client";
import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei/core/PerspectiveCamera";
import * as THREE from "three";
import { cn } from "@/lib/utils";
interface DotGlobeHeroProps {
  rotationSpeed?: number;
  globeRadius?: number;
  className?: string;
  children?: React.ReactNode;
}
function Globe({
  rotationSpeed,
  radius,
}: {
  rotationSpeed: number;
  radius: number;
}) {
  const ref = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    if (ref.current && !matchMedia("(prefers-reduced-motion: reduce)").matches)
      ref.current.rotation.y += rotationSpeed * dt * 20;
  });
  const points = useMemo(() => {
    const a = [];
    for (let i = 0; i < 16000; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / 16000),
        theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const lat = 90 - (phi * 180) / Math.PI,
        lon = (((theta * 180) / Math.PI) % 360) - 180;
      const land =
        (lon > -130 && lon < -60 && lat > 20 && lat < 65 && lon + lat > -100) ||
        (lon > -80 && lon < -35 && lat > -50 && lat < 15 && lon + lat > -110) ||
        (lon > -20 && lon < 40 && lat > -35 && lat < 35 && lon - lat < 48) ||
        (lon > -10 && lon < 145 && lat > 30 && lat < 70) ||
        (lon > 110 && lon < 155 && lat > -42 && lat < -12);
      if (land || i % 5 === 0)
        a.push(
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.sin(theta),
        );
    }
    return new Float32Array(a);
  }, [radius]);
  return (
    <group ref={ref} rotation={[0.12, -0.8, -0.16]}>
      <mesh>
        <sphereGeometry args={[radius * 0.992, 48, 48]} />
        <meshBasicMaterial color="#09141a" />
      </mesh>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[points, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.009}
          color="#54b5bb"
          transparent
          opacity={0.65}
          sizeAttenuation
        />
      </points>
      <mesh>
        <sphereGeometry args={[radius, 36, 22]} />
        <meshBasicMaterial
          color="#226064"
          wireframe
          transparent
          opacity={0.12}
        />
      </mesh>
    </group>
  );
}
function GlobeFallback() {
  return (
    <svg viewBox="0 0 500 500" width="100%" height="100%" aria-hidden="true">
      <defs>
        <radialGradient id="globeFallback">
          <stop stopColor="#163a39" />
          <stop offset="1" stopColor="#0a151c" />
        </radialGradient>
      </defs>
      <circle
        cx="250"
        cy="250"
        r="190"
        fill="url(#globeFallback)"
        stroke="#4a918e"
        strokeOpacity=".4"
      />
      {[40, 85, 135, 175].map((rx) => (
        <ellipse
          key={rx}
          cx="250"
          cy="250"
          rx={rx}
          ry="190"
          fill="none"
          stroke="#508f91"
          strokeOpacity=".25"
        />
      ))}
      {[85, 130, 180, 230, 280, 330, 380, 415].map((y) => (
        <path
          key={y}
          d={`M${250 - Math.sqrt(Math.max(0, 190 ** 2 - (250 - y) ** 2))} ${y} H${250 + Math.sqrt(Math.max(0, 190 ** 2 - (250 - y) ** 2))}`}
          stroke="#508f91"
          strokeOpacity=".25"
        />
      ))}
    </svg>
  );
}
class GlobeBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <GlobeFallback /> : this.props.children;
  }
}
const DotGlobeHero = React.forwardRef<HTMLDivElement, DotGlobeHeroProps>(
  ({ rotationSpeed = 0.004, globeRadius = 1, className, children }, ref) => (
    <div ref={ref} className={cn("globe-wrap", className)}>
      <GlobeBoundary>
        <Canvas fallback={<GlobeFallback />} dpr={[1, 1.5]}>
          <PerspectiveCamera makeDefault position={[0, 0, 2.65]} fov={48} />
          <Globe rotationSpeed={rotationSpeed} radius={globeRadius} />
        </Canvas>
      </GlobeBoundary>
      {children}
    </div>
  ),
);
DotGlobeHero.displayName = "DotGlobeHero";
export { DotGlobeHero, type DotGlobeHeroProps };
