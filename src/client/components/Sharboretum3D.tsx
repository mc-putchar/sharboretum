import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { RootState } from '@react-three/fiber';
import { OrbitControls, Center, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const MODEL_URL = `${import.meta.env.BASE_URL}models/base.glb`;

export type SharborState = {
    health: number; // 0.0 .. 1.0
    growth?: number; // 0.0 .. 1.0 (current model visually ~0.75)
    mutationScore?: number; // 0.0 .. 1.0 (slightly influences morph)
    // Future runtime interactions can be added here:
    // water?: number;
    // prune?: number;
    // heal?: number;
    // fertilize?: number;
};

type Sharboretum3DProps = {
    sharborStatus?: SharborState;
    className?: string;
    style?: React.CSSProperties;
};

function SharborModel({ sharborStatus }: { sharborStatus?: SharborState }) {
    // Vite serves files in /public at the root path
    const gltf: any = useGLTF(MODEL_URL, true);
    const root = useRef<any>(null);

    // Clone the scene to avoid mutating cached assets and safely adjust materials
    const sceneClone = useMemo(() => {
        const cloned = gltf.scene.clone(true) as any;
        cloned.traverse((child: any) => {
            if ((child as any).isMesh) {
                const mesh = child as any;
                if (Array.isArray(mesh.material)) {
                    mesh.material = mesh.material.map((m: any) => (m ? m.clone() : m));
                } else if (mesh.material) {
                    mesh.material = (mesh.material as any).clone();
                }
                // Mobile perf: disable shadows
                mesh.castShadow = false;
                mesh.receiveShadow = false;
                mesh.frustumCulled = true;
            }
        });
        return cloned;
    }, [gltf.scene]);

    // Center the model at world origin and place its base at y = 0 (ground plane)
    useEffect(() => {
        if (!root.current) return;
        const bbox = new THREE.Box3().setFromObject(root.current);
        const center = bbox.getCenter(new THREE.Vector3());
        // Recenter group so model sits at origin
        root.current.position.sub(center);
        // Compute minY after recentering, then lift so lowest point is on y=0
        const recenteredBBox = new THREE.Box3().setFromObject(root.current);
        const minY = recenteredBBox.min.y;
        root.current.position.y -= minY;
    }, [sceneClone]);

    // Record original colors for smooth restoration
    const originalColors = useMemo(() => {
        const map = new Map<string, any>();
        sceneClone.traverse((child: any) => {
            if ((child as any).isMesh) {
                const mesh = child as any;
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                materials.forEach((mat: any, idx: number) => {
                    if (mat && mat.color && mat.color instanceof THREE.Color) {
                        const id = `${mesh.uuid}:${idx}`;
                        map.set(id, (mat.color as any).clone());
                    }
                });
            }
        });
        return map;
    }, [sceneClone]);

    // Cache likely "leaf" meshes for sprouting and opacity morphs
    const leavesMeshes = useMemo(() => {
        const arr: any[] = [];
        sceneClone.traverse((obj: any) => {
            if ((obj as any).isMesh) {
                const name = (obj.name || '').toLowerCase();
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                const isLeaf =
                    name.includes('leaf') ||
                    name.includes('leaves') ||
                    mats.some((m: any) => (m?.name || '').toLowerCase().includes('leaf'));
                if (isLeaf) arr.push(obj);
            }
        });
        return arr;
    }, [sceneClone]);

    // Cache likely "trunk" meshes for subtle thickening morph
    const trunkMeshes = useMemo(() => {
        const arr: any[] = [];
        sceneClone.traverse((obj: any) => {
            if ((obj as any).isMesh) {
                const name = (obj.name || '').toLowerCase();
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                const isTrunk =
                    name.includes('trunk') || mats.some((m: any) => (m?.name || '').toLowerCase().includes('trunk'));
                if (isTrunk) arr.push(obj);
            }
        });
        return arr;
    }, [sceneClone]);

    // Initial fruit shard anchor positions near the canopy
    const fruitShards = useMemo(() => {
        const positions: { x: number; y: number; z: number }[] = [];
        const N = 8;
        const bbox = new THREE.Box3().setFromObject(sceneClone);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        const radius = Math.max(0.3, size.x * 0.35);
        const height = bbox.max.y * 0.8; // slightly below top
        for (let i = 0; i < N; i++) {
            const a = (i / N) * Math.PI * 2;
            positions.push({
                x: center.x + radius * Math.cos(a),
                y: height,
                z: center.z + radius * Math.sin(a),
            });
        }
        return positions;
    }, [sceneClone]);

    // Ref to manipulate shard visibility/emissive/light at runtime
    const fruitGroupRef = useRef<any>(null);

    const mutationColor = useMemo(() => new THREE.Color(0.4, 0.2, 0.9), []); // mutation hue (bluish-purple)

    // Health-driven pulsing color using useFrame (runtime interaction placeholder)
    useFrame((state: RootState) => {
        const { clock } = state;
        const health = sharborStatus?.health ?? 1.0;
        const mutation = sharborStatus?.mutationScore ?? 0.0;
        const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.0); // subtle pulse

        sceneClone.traverse((child: any) => {
            if ((child as any).isMesh) {
                const mesh = child as any;
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                materials.forEach((mat: any, idx: number) => {
                    if (!mat || !mat.color || !(mat.color instanceof THREE.Color)) return;
                    const id = `${mesh.uuid}:${idx}`;
                    const orig = originalColors.get(id);
                    if (!orig) return;

                    const color = mat.color as any;
                    const blend = THREE.MathUtils.clamp(0.05 + 0.9 * mutation + 0.05 * pulse * mutation, 0, 1);
                    color.copy(orig).lerp(mutationColor, blend);

                    // Health-based, less-intense emissive glow
                    const std = mat as any;
                    if (std.emissive) {
                        const healthyGlow = new THREE.Color(0.2, 0.8, 0.3);
                        const unhealthyGlow = new THREE.Color(0.8, 0.2, 0.15);
                        const glowColor = healthyGlow.clone().lerp(unhealthyGlow, 1 - health); // greener when healthy
                        std.emissive.copy(glowColor);
                        const base = 0.05;
                        const amp = 0.2; // keep glow subtle
                        const glow = base + amp * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 1.6)) * health;
                        std.emissiveIntensity = THREE.MathUtils.lerp(std.emissiveIntensity ?? 0, glow, 0.2);
                    }
                });
            }
        });

        // Growth-driven morph (baseline 0.75) with slight mutation influence + fruit shards
        const baseGrowth = sharborStatus?.growth ?? 0.75;
        const growthEff = THREE.MathUtils.clamp(baseGrowth + 0.1 * (sharborStatus?.mutationScore ?? 0), 0, 1);

        // Overall scale relative to baseline 0.75
        const targetScale =
            growthEff <= 0.75
                ? THREE.MathUtils.lerp(0.9, 1.0, growthEff / 0.75)
                : THREE.MathUtils.lerp(1.0, 1.05, (growthEff - 0.75) / 0.25);
        sceneClone.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

        // Leaves sprouting (scale + opacity) and trunk thickening
        sceneClone.traverse((obj: any) => {
            if ((obj as any).isMesh) {
                const name = (obj.name || '').toLowerCase();
                const mat = (obj as any).material;
                const mats = Array.isArray(mat) ? mat : [mat];

                const isLeaf =
                    name.includes('leaf') ||
                    name.includes('leaves') ||
                    mats.some((m: any) => (m?.name || '').toLowerCase().includes('leaf'));
                const isTrunk =
                    name.includes('trunk') || mats.some((m: any) => (m?.name || '').toLowerCase().includes('trunk'));

                if (isLeaf) {
                    const sprout = THREE.MathUtils.smoothstep(0.0, 1.0, growthEff);
                    const s = THREE.MathUtils.lerp(0.6, 1.15, sprout);
                    obj.scale.lerp(new THREE.Vector3(s, s, s), 0.1);
                    mats.forEach((m: any) => {
                        if (m) {
                            m.transparent = true;
                            const targ = THREE.MathUtils.lerp(
                                0.5,
                                1.0,
                                THREE.MathUtils.smoothstep(0.2, 0.75, growthEff),
                            );
                            m.opacity = THREE.MathUtils.lerp(m.opacity ?? 1, targ, 0.1);
                        }
                    });
                } else if (isTrunk) {
                    const thick = THREE.MathUtils.lerp(0.95, 1.08, THREE.MathUtils.smoothstep(0.0, 1.0, growthEff));
                    obj.scale.x = THREE.MathUtils.lerp(obj.scale.x, thick, 0.1);
                    obj.scale.z = THREE.MathUtils.lerp(obj.scale.z, thick, 0.1);
                }
            }
        });

        // Fruit shards near full growth with subtle emissive; become lights at ~1.0
        if (fruitGroupRef.current) {
            const vis = THREE.MathUtils.smoothstep(0.85, 1.0, growthEff);
            const pulse2 = 0.6 + 0.4 * Math.sin(clock.elapsedTime * 1.3);
            for (const child of fruitGroupRef.current.children) {
                child.visible = vis > 0.001;
                const mesh = child.children.find((c: any) => c.isMesh);
                const light = child.children.find((c: any) => c.isLight);
                if (mesh && mesh.material) {
                    const ms = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                    ms.forEach((m: any) => {
                        if (m.emissive !== undefined) {
                            m.emissive = new THREE.Color(0.95, 0.9, 0.5);
                            const targetEm = 0.12 * vis * pulse2;
                            m.emissiveIntensity = THREE.MathUtils.lerp(m.emissiveIntensity ?? 0, targetEm, 0.2);
                        }
                    });
                }
                if (light) {
                    light.intensity = growthEff > 0.98 ? 0.25 : 0.0;
                    light.distance = 1.5;
                    light.decay = 2.0;
                }
            }
        }
    });

    return (
        <group ref={root}>
            {/* Center wraps to help ensure perfect centering before ground alignment */}
            <Center>
                <primitive object={sceneClone} />
                <group ref={fruitGroupRef} name="FruitShards">
                    {fruitShards.map((s, i) => (
                        <group key={i} position={[s.x, s.y, s.z]} visible={false}>
                            <mesh>
                                <sphereGeometry args={[0.06, 12, 12]} />
                                <meshStandardMaterial
                                    color={new THREE.Color(0.95, 0.9, 0.5)}
                                    emissive={new THREE.Color(0.95, 0.9, 0.5)}
                                    emissiveIntensity={0.0}
                                    roughness={0.4}
                                    metalness={0.0}
                                />
                            </mesh>
                            <pointLight color={0xffee99} intensity={0} distance={1.5} decay={2} />
                        </group>
                    ))}
                </group>
            </Center>
        </group>
    );
}

// Preload model for faster TMA startup
useGLTF.preload(MODEL_URL);

export function Sharboretum3D({ sharborStatus, className, style }: Sharboretum3DProps) {
    return (
        <div className={className} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
            <Canvas
                dpr={[1, 2]}
                camera={{ position: [0, 2.8, 4.6], fov: 60 }}
                gl={{
                    antialias: false, // mobile perf
                    powerPreference: 'high-performance',
                }}
                onCreated={(state: RootState) => {
                    // Keep background transparent to let blurred image and sparkles remain visible
                    state.gl.setClearColor(0x000000, 0);
                }}
            >
                {/* Minimal serene lighting */}
                <ambientLight intensity={0.35} />
                <directionalLight position={[2.5, 4, 2.5]} intensity={0.8} />

                <Suspense fallback={null}>
                    <SharborModel sharborStatus={sharborStatus} />
                </Suspense>

                {/* Intuitive rotation/zoom; pan off to prevent accidental drags in TMA */}
                <OrbitControls
                    enablePan={false}
                    enableZoom={true}
                    minDistance={1.0}
                    maxDistance={6.0}
                    rotateSpeed={0.1}
                    zoomSpeed={0.4}
                />
            </Canvas>
        </div>
    );
}

export default Sharboretum3D;
