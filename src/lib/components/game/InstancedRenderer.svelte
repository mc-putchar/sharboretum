<script lang="ts">
	import { T } from '@threlte/core';
	import { InstancedMesh, Instance } from '@threlte/extras';
	import * as THREE from 'three';

	type GeometryOptions =
		| { type: 'box'; args?: ConstructorParameters<typeof THREE.BoxGeometry> }
		| { type: 'icosahedron'; args?: ConstructorParameters<typeof THREE.IcosahedronGeometry> }
		| { type: 'plane'; args?: ConstructorParameters<typeof THREE.PlaneGeometry> }
		| { type: 'cone'; args?: ConstructorParameters<typeof THREE.ConeGeometry> };

	let {
		matrices,
		colors,
		geometry,
		children
	}: {
		matrices: THREE.Matrix4[];
		colors?: (THREE.Color | string | number)[];
		geometry: GeometryOptions;
		children?: any;
	} = $props();

	const limit = 5000;
</script>

<InstancedMesh {limit}>
	{#if geometry.type === 'box'}
		<T.BoxGeometry args={geometry.args} />
	{:else if geometry.type === 'icosahedron'}
		<T.IcosahedronGeometry args={geometry.args ?? [0.2, 0]} />
	{:else if geometry.type === 'plane'}
		<T.PlaneGeometry args={geometry.args ?? [0.2, 0.2]} />
	{:else if geometry.type === 'cone'}
		<T.ConeGeometry args={geometry.args ?? [0.1, 0.2, 8]} />
	{/if}

	{#if children}
		{@render children()}
	{:else}
		<T.MeshStandardMaterial vertexColors />
	{/if}

	{#if matrices}
		{#each matrices as matrix, i (i)}
			{@const p = new THREE.Vector3()}
			{@const q = new THREE.Quaternion()}
			{@const s = new THREE.Vector3()}
			{@const _ = matrix.decompose(p, q, s)}
			{@const e = new THREE.Euler().setFromQuaternion(q)}

			<Instance
				position={[p.x, p.y, p.z]}
				rotation={[e.x, e.y, e.z]}
				scale={[s.x, s.y, s.z]}
				color={colors?.[i]}
			/>
		{/each}
	{/if}
</InstancedMesh>
