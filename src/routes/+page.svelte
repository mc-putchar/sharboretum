<script lang="ts">
	import { Canvas } from '@threlte/core';
	import Scene from '$lib/components/scene/Scene.svelte';
	import { defaultParams } from '$lib/logic/l-system';

	let seed = $state('Apple');
	let level = $state(defaultParams.level);
	let branchLength = $state(defaultParams.branchLength);
	let angle = $state(defaultParams.angle);
	let angleRandomness = $state(defaultParams.angleRandomness);
	let lengthFactor = $state(defaultParams.lengthFactor);
	let branchCurvature = $state(defaultParams.branchCurvature);
</script>

<details class="controls-container" open>
	<summary>Sharbor Controls</summary>
	<div class="controls">
		<label>
			<span>Seed</span>
			<input type="text" bind:value={seed} />
		</label>
		<label>
			<span>Level</span>
			<input type="range" bind:value={level} min="1" max="7" step="1" />
			<span>{level}</span>
		</label>
		<label>
			<span>Branch Length</span>
			<input type="range" bind:value={branchLength} min="0.1" max="1.0" step="0.05" />
			<span>{branchLength}</span>
		</label>
		<label>
			<span>Angle</span>
			<input type="range" bind:value={angle} min="10" max="90" step="1" />
			<span>{angle}</span>
		</label>
		<label>
			<span>Angle Randomness</span>
			<input type="range" bind:value={angleRandomness} min="0" max="1" step="0.05" />
			<span>{angleRandomness}</span>
		</label>
		<label>
			<span>Length Factor</span>
			<input type="range" bind:value={lengthFactor} min="0.5" max="0.99" step="0.01" />
			<span>{lengthFactor}</span>
		</label>
		<label>
			<span>Branch Curvature</span>
			<input type="range" bind:value={branchCurvature} min="0" max="1" step="0.05" />
			<span>{branchCurvature}</span>
		</label>
	</div>
</details>

<Canvas>
	<Scene {seed} {level} {branchLength} {angle} {angleRandomness} {lengthFactor} {branchCurvature} />
</Canvas>

<style>
	.controls-container {
		position: absolute;
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10;
		background: rgba(0, 0, 0, 0.2);
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		backdrop-filter: blur(5px);
		color: white;
		font-family: sans-serif;
	}

	summary {
		cursor: pointer;
		font-weight: bold;
	}

	.controls {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap; /* Allow controls to wrap on smaller screens */
		padding-top: 1rem;
	}

	label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
	}

	input[type='text'],
	input[type='range'] {
		background: transparent;
		border: 1px solid white;
		color: white;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		min-width: 50px; /* Ensure inputs are not too small */
	}

	input[type='range'] {
		-webkit-appearance: none; /* Override default CSS for range input */
		height: 4px;
		background: #ffffff50;
		border-radius: 2px;
		cursor: pointer;
	}

	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 15px;
		height: 15px;
		border-radius: 50%;
		background: #fff;
		cursor: pointer;
		margin-top: -5px; /* Adjust thumb position */
	}

	input[type='range']::-moz-range-thumb {
		width: 15px;
		height: 15px;
		border-radius: 50%;
		background: #fff;
		cursor: pointer;
	}

	input[type='range'] + span {
		min-width: 25px; /* Space for range value display */
		text-align: right;
	}

	/*.debug-toggle input {
		width: 15px;
		height: 15px;
	}*/
</style>
