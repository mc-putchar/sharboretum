<script lang="ts">
	import { T } from '@threlte/core';
	import * as THREE from 'three';

	let {
		branchTubes,
		techBranches
	}: {
		branchTubes: {
			path: THREE.QuadraticBezierCurve3;
			radius: number;
			color: THREE.Color;
		}[];
		techBranches: {
			matrix: THREE.Matrix4;
			radius: number;
			length: number;
			color: THREE.Color;
		}[];
	} = $props();
</script>

<!-- Organic Branches -->
{#if branchTubes}
	{#each branchTubes as tube, i (i)}
		<T.Mesh castShadow>
			<T.TubeGeometry args={[tube.path, 6, tube.radius, 5, false]} />
			<T.MeshStandardMaterial color={tube.color} roughness={0.8} metalness={0.1} />
		</T.Mesh>
	{/each}
{/if}

<!-- Tech Branches -->
{#if techBranches}
	{#each techBranches as branch, i (i)}
		{@const p = new THREE.Vector3()}
		{@const q = new THREE.Quaternion()}
		{@const s = new THREE.Vector3()}
		{@const _ = branch.matrix.decompose(p, q, s)}
		<T.Group position={[p.x, p.y, p.z]} quaternion={[q.x, q.y, q.z, q.w]}>
			<T.Mesh castShadow>
				<T.CylinderGeometry args={[branch.radius, branch.radius, branch.length, 8]} />
				<T.MeshPhysicalMaterial
					color={branch.color}
					metalness={0.8}
					roughness={0.2}
					emissive={branch.color}
					emissiveIntensity={1.5}
				/>
			</T.Mesh>
		</T.Group>
	{/each}
{/if}
