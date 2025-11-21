<script lang="ts">
	import { T } from '@threlte/core';
	import { OrbitControls, PerfMonitor, Sky, useTexture } from '@threlte/extras';
	import { EffectComposer } from 'threlte-postprocessing';
	import { BloomEffect } from 'threlte-postprocessing/effects';
	import Branches from '$lib/components/game/Branches.svelte';
	import InstancedRenderer from '$lib/components/game/InstancedRenderer.svelte';
	import { generateTree } from '$lib/logic/l-system.ts';
	import * as THREE from 'three';

	const { seed, level, branchLength, angle, angleRandomness, lengthFactor, branchCurvature } =
		$props<{
			seed: string;
			level: number;
			branchLength: number;
			angle: number;
			angleRandomness: number;
			lengthFactor: number;
			branchCurvature: number;
		}>();

	const leafTexture = useTexture('/leaf.png');

	const treeData = $derived(
		generateTree(seed, {
			level,
			branchLength,
			angle,
			angleRandomness,
			lengthFactor,
			branchCurvature
		})
	);
</script>

<T.Color attach="background" args={['blue']} />

<EffectComposer>
	<BloomEffect intensity={1.2} luminanceThreshold={0.5} luminanceSmoothing={0.8} height={1024} />
</EffectComposer>

<PerfMonitor />

<Sky distance={450000} sunPosition={{ x: 1, y: 0.2, z: 1 }} />
<T.Fog color={'#a79d9d'} near={15} far={30} />

<T.PerspectiveCamera
	makeDefault
	position={[0, 2, 12]}
	on:create={({ ref }) => {
		ref.lookAt(0, 2, 0);
	}}
>
	<OrbitControls autoRotate autoRotateSpeed={-0.3} enableDamping minDistance={5} maxDistance={25} />
</T.PerspectiveCamera>

<T.AmbientLight intensity={0.2} />
<T.DirectionalLight position={[10, 10, 5]} intensity={1} castShadow />
<T.DirectionalLight position={[-10, 5, -5]} intensity={0.2} color="#AC82FF" />

<T.Mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
	<T.PlaneGeometry args={[100, 100]} />
	<T.MeshPhysicalMaterial
		color="#a79d9d"
		metalness={0.1}
		roughness={0.1}
		clearcoat={1}
		clearcoatRoughness={0.2}
	/>
</T.Mesh>

<!-- Render branches -->
<Branches branchTubes={treeData.branchTubes} techBranches={treeData.techBranches} />

<!-- Render leaves -->
<InstancedRenderer
	matrices={treeData.leaves.matrices}
	colors={treeData.leaves.colors}
	geometry={{ type: 'plane', args: [1, 1] }}
>
	<T.MeshStandardMaterial map={$leafTexture} transparent alphaTest={0.5} side={THREE.DoubleSide} />
</InstancedRenderer>

<!-- Render crystals -->
{#if treeData.crystals.matrices.length > 0}
	<InstancedRenderer
		matrices={treeData.crystals.matrices}
		colors={treeData.crystals.colors}
		geometry={{ type: 'cone', args: [0.1, 0.2, 6] }}
	>
		<T.MeshStandardMaterial vertexColors emissive="white" emissiveIntensity={2} />
	</InstancedRenderer>
{/if}

<!-- Render crystal lights -->
{#each treeData.crystalLightPositions as lightPos}
	<T.PointLight position={lightPos} color="#8EFFFF" intensity={0.2} distance={5} />
{/each}
