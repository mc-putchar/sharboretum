import * as THREE from 'three';

// Simple pseudo-random number generator for determinism
class PRNG {
	private seed: number;

	constructor(seedStr: string) {
		this.seed = this.hash(seedStr);
	}

	private hash(str: string): number {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash |= 0; // Convert to 32bit integer
		}
		return hash;
	}

	// LCG
	next(): number {
		this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
		return this.seed / 4294967296;
	}
}

interface TurtleState {
	position: THREE.Vector3;
	direction: THREE.Vector3;
	depth: number;
}

export interface LSystemParams {
	axiom: string;
	rules: { [key: string]: string | string[] };
	angle: number;
	branchLength: number;
	lengthFactor: number;
	angleRandomness: number;
	branchCurvature: number;
	level: number;
	leafColorPalette: string[];
	crystalColorPalette: [string, string];
}

export const defaultParams: LSystemParams = {
	axiom: 'X',
	rules: {
		X: ['F[+X][-X]FXC', 'F[+X][-X]FXC', 'G{[+X][-X]GXC}'],
		F: 'FF',
		G: 'GG'
	},
	angle: 35,
	branchLength: 0.4,
	lengthFactor: 0.9,
	angleRandomness: 0.2,
	branchCurvature: 0.3,
	level: 3,
	leafColorPalette: ['#498C5C', '#66A577', '#85C293', '#3A7D4F'],
	crystalColorPalette: ['#8EFFFF', '#C0FFEE']
};

const branchColorPalettes = [
	{ base: '#5E432E', tip: '#3A2A1A' }, // Brown
	{ base: '#6A7D3A', tip: '#4C5C2A' }, // Green
	{ base: '#8E8E8E', tip: '#6E6E6E' }, // Gray
	{ base: '#AC82FF', tip: '#8A5DFF' }, // Purple
	{ base: '#306688', tip: '#1E445C' } // Blue
];

const techBranchColor = new THREE.Color('#8EFFFF');

export function generateTree(seed: string, userParams: Partial<LSystemParams> = {}) {
	const params = { ...defaultParams, ...userParams };
	const prng = new PRNG(seed);

	// 1. Select a color palette based on the seed
	const selectedPalette = branchColorPalettes[Math.floor(prng.next() * branchColorPalettes.length)];
	const branchBaseColor = new THREE.Color(selectedPalette.base);
	const branchTipColor = new THREE.Color(selectedPalette.tip);

	// 2. Generate sentence
	let sentence = params.axiom;
	for (let i = 0; i < params.level; i++) {
		let newSentence = '';
		for (const char of sentence) {
			const rule = params.rules[char as keyof typeof params.rules];
			if (rule) {
				if (Array.isArray(rule)) {
					newSentence += rule[Math.floor(prng.next() * rule.length)];
				} else {
					newSentence += rule;
				}
			} else {
				newSentence += char;
			}
		}
		sentence = newSentence;
	}

	// 3. Interpret sentence with turtle
	const stack: TurtleState[] = [];
	const parts = {
		branchTubes: [] as { path: THREE.QuadraticBezierCurve3; radius: number; color: THREE.Color }[],
		techBranches: [] as {
			matrix: THREE.Matrix4;
			radius: number;
			length: number;
			color: THREE.Color;
		}[],
		leaves: { matrices: [] as THREE.Matrix4[], colors: [] as THREE.Color[] },
		crystals: { matrices: [] as THREE.Matrix4[], colors: [] as THREE.Color[] },
		crystalLightPositions: [] as THREE.Vector3[]
	};

	const crystalBaseColor = new THREE.Color(params.crystalColorPalette[0]);
	const crystalTipColor = new THREE.Color(params.crystalColorPalette[1]);

	// Add a scaling factor for branch thickness based on the level
	const levelScale = 1 + (params.level / defaultParams.level) * 0.5;
	const baseOrganicRadius = 0.05 * levelScale;
	const baseTechRadius = 0.03 * levelScale;

	let currentState: TurtleState = {
		position: new THREE.Vector3(0, -1.5, 0),
		direction: new THREE.Vector3(0, 1, 0),
		depth: 0
	};

	const baseAngle = (params.angle * Math.PI) / 180;

	const getRotationAxis = (direction: THREE.Vector3) => {
		const randomVec = new THREE.Vector3(prng.next() * 2 - 1, prng.next() * 2 - 1, prng.next() * 2 - 1);
		let axis = new THREE.Vector3().crossVectors(direction, randomVec);
		if (axis.lengthSq() < 0.001) {
			axis = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0));
			if (axis.lengthSq() < 0.001) {
				axis = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(1, 0, 0));
			}
		}
		return axis.normalize();
	};

	for (const char of sentence) {
		switch (char) {
			case 'G':
			case 'F': {
				const len = params.branchLength * Math.pow(params.lengthFactor, currentState.depth);
				const startPosition = currentState.position.clone();
				const normalizedDirection = currentState.direction.clone().normalize();
				const endPosition = startPosition.clone().addScaledVector(normalizedDirection, len);

				if (char === 'F') {
					// Organic, curved branch
					const curvature = params.branchCurvature * (prng.next() * 2 - 1);
					const segmentDirection = new THREE.Vector3()
						.subVectors(endPosition, startPosition)
						.normalize();
					const randomVec = new THREE.Vector3(
						prng.next() * 2 - 1,
						prng.next() * 2 - 1,
						prng.next() * 2 - 1
					);
					let perpendicular = new THREE.Vector3()
						.crossVectors(segmentDirection, randomVec)
						.normalize();
					if (perpendicular.lengthSq() < 0.01) perpendicular.set(1, 0, 0);
					const midpoint = new THREE.Vector3()
						.addVectors(startPosition, endPosition)
						.multiplyScalar(0.5);
					const controlPoint = midpoint
						.clone()
						.addScaledVector(perpendicular, curvature * startPosition.distanceTo(endPosition));

					const path = new THREE.QuadraticBezierCurve3(startPosition, controlPoint, endPosition);
					const radius = baseOrganicRadius * Math.pow(0.9, currentState.depth);
					const color = branchBaseColor
						.clone()
						.lerp(branchTipColor, currentState.depth / (params.level * 1.2));
					parts.branchTubes.push({ path, radius, color });
				} else {
					// Tech, straight branch
					const radius = baseTechRadius * Math.pow(0.9, currentState.depth);
					const color = techBranchColor;

					const position = new THREE.Vector3().addVectors(startPosition, endPosition).multiplyScalar(0.5);
					const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalizedDirection);
					const scale = new THREE.Vector3(1, 1, 1);
					const matrix = new THREE.Matrix4().compose(position, orientation, scale);

					parts.techBranches.push({ matrix, radius, length: len, color });
				}

				currentState = { ...currentState, position: endPosition };
				break;
			}
			case '+': {
				const axis = getRotationAxis(currentState.direction);
				const angle = baseAngle * (1 + (prng.next() - 0.5) * params.angleRandomness);
				const newDirection = currentState.direction.clone().applyAxisAngle(axis, angle);
				currentState = { ...currentState, direction: newDirection };
				break;
			}
			case '-': {
				const axis = getRotationAxis(currentState.direction);
				const angle = -baseAngle * (1 + (prng.next() - 0.5) * params.angleRandomness);
				const newDirection = currentState.direction.clone().applyAxisAngle(axis, angle);
				currentState = { ...currentState, direction: newDirection };
				break;
			}
			case '[':
			case '{':
				stack.push(currentState);
				currentState = { ...currentState, depth: currentState.depth + 1 };
				break;
			case ']':
			case '}': {
				if (char === '}') { // Leaves only on organic branches
					const prevState = stack.pop();
					if (prevState) {
						currentState = prevState;
					}
					break;
				}
				const color = new THREE.Color(
					params.leafColorPalette[Math.floor(prng.next() * params.leafColorPalette.length)]
				);
				const hsl = { h: 0, s: 0, l: 0 };
				color.getHSL(hsl);
				const hueShift = (prng.next() - 0.5) * 0.05;
				const saturationShift = (prng.next() - 0.5) * 0.2;
				const lightnessShift = (prng.next() - 0.5) * 0.2;
				color.setHSL(
					(hsl.h + hueShift + 1) % 1,
					Math.max(0, Math.min(1, hsl.s + saturationShift)),
					Math.max(0, Math.min(1, hsl.l + lightnessShift))
				);
				parts.leaves.colors.push(color);

				const randomQuaternion = new THREE.Quaternion().setFromEuler(
					new THREE.Euler(prng.next() * Math.PI, prng.next() * Math.PI, prng.next() * Math.PI)
				);
				const toCamera = new THREE.Vector3(0, 4, 20).sub(currentState.position).normalize();
				const leafNormal = new THREE.Vector3(0, 0, 1);
				const billboardQuaternion = new THREE.Quaternion().setFromUnitVectors(leafNormal, toCamera);
				const finalQuaternion = new THREE.Quaternion().slerpQuaternions(
					randomQuaternion,
					billboardQuaternion,
					0.3
				);

				const scaleFactor = Math.pow(0.85, currentState.depth);
				const randomScale = prng.next() * 0.5 + 0.75;
				const finalScale = 0.25 * scaleFactor * randomScale;
				const finalScaleVec = new THREE.Vector3(1, 1, 1).multiplyScalar(finalScale);

				const leafLocalOffset = new THREE.Matrix4().makeTranslation(0, 0.5, 0);
				const leafWorldMatrix = new THREE.Matrix4().compose(
					currentState.position,
					finalQuaternion,
					finalScaleVec
				);
				const finalLeafMatrix = new THREE.Matrix4().multiplyMatrices(
					leafWorldMatrix,
					leafLocalOffset
				);
				parts.leaves.matrices.push(finalLeafMatrix);

				const prevState = stack.pop();
				if (prevState) {
					currentState = prevState;
				}
				break;
			}
			case 'C': {
				const scaleVec = new THREE.Vector3(1, 1, 1).multiplyScalar(0.15 * (prng.next() * 0.5 + 0.75));
				const orientation = new THREE.Quaternion().setFromUnitVectors(
					new THREE.Vector3(0, 1, 0),
					currentState.direction.clone()
				);
				const localOffset = new THREE.Matrix4().makeTranslation(0, 0.1, 0);
				const worldMatrix = new THREE.Matrix4().compose(
					currentState.position,
					orientation,
					scaleVec
				);
				const finalMatrix = new THREE.Matrix4().multiplyMatrices(worldMatrix, localOffset);
				parts.crystals.matrices.push(finalMatrix);

				const color = crystalBaseColor.clone().lerp(crystalTipColor, prng.next());
				parts.crystals.colors.push(color);

				if (parts.crystals.matrices.length % 5 === 0) {
					parts.crystalLightPositions.push(currentState.position.clone());
				}
				break;
			}
		}
	}

	return parts;
}
