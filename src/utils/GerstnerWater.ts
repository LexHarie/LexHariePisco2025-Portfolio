import * as THREE from 'three';

/* ---------------------------------------------------------
 *  GPU independent Gerstner-wave ocean surface.
 *
 *  The implementation is kept deliberately simple on the CPU so that
 *  we can still sample height/normal information for buoyancy while
 *  achieving a more lively surface in the vertex positions that are
 *  rendered on screen. No custom shader code or post-processing is
 *  required which keeps integration with the existing codebase easy
 *  and dependency-free.
 *
 *  The wave model follows the classic Gerstner formulation. Each wave
 *  is defined by a direction vector D (unit length), wavelength L,
 *  and steepness Q. From these parameters we derive
 *
 *      k      – wave number              ( 2π / L )
 *      ω      – angular frequency        ( sqrt( g * k ) )
 *      A      – amplitude                ( Q / k )
 *
 *  The surface displacement at a point X=(x,z) and time t is then
 *
 *      x' = x + Σ  ( Q * A * D.x * cos( k·D·X - ωt ) )
 *      y' =     Σ  (      A       * sin( k·D·X - ωt ) )
 *      z' = z + Σ  ( Q * A * D.y * cos( k·D·X - ωt ) )
 * --------------------------------------------------------- */

export interface WaveConfig {
  /** X/Z direction of the wave. Does not need to be normalised – it will be internally. */
  direction: [number, number];
  /** 0…1   Higher values create sharper/steeper waves. */
  steepness: number;
  /** Physical wavelength of the wave in world units. */
  wavelength: number;
  /** Optional explicit amplitude */
  amplitude?: number;
}

interface InternalWave {
  D: THREE.Vector2; // unit direction
  k: number;        // wave number  (2π / L)
  ω: number;        // angular frequency  (√(g·k))
  A: number;        // amplitude  (Q / k)
  Q: number;        // steepness  (clamped)
}

export interface GerstnerWaterOptions {
  width?: number;
  depth?: number;
  /** grid resolution per side */
  segments?: number;
  /** three independent waves – if not supplied, sensible defaults are used */
  waves?: WaveConfig[];
  /** global multiplier for amplitude/steepness */
  distortionScale?: number;
  /** phong material colour */
  color?: number;
}

export default class GerstnerWater {
  public readonly water: THREE.Mesh;

  private readonly _geometry: THREE.PlaneGeometry;
  private readonly _initialPositions: Float32Array;

  private readonly _waves: InternalWave[] = [];
  private readonly _distortionScale: number;

  private _time = 0;

  constructor(options: GerstnerWaterOptions = {}) {
    const {
      width = 10000,
      depth = 10000,
      segments = 256,
      waves,
      distortionScale = 2,
      color = 0x0066aa,
    } = options;

    this._distortionScale = distortionScale;

    // Geometry -----------------------------------------
    this._geometry = new THREE.PlaneGeometry(width, depth, segments, segments);
    this._geometry.rotateX(-Math.PI / 2); // make it horizontal

    // keep an immutable copy of the initial vertex positions so we can
    // return to a known state each frame
    const pos = this._geometry.attributes.position; // THREE.BufferAttribute
    this._initialPositions = (pos.array as Float32Array).slice() as Float32Array;


    const material = new THREE.MeshPhongMaterial({
      color,
      shininess: 80,
      specular: 0x555555,
      flatShading: false,
      side: THREE.DoubleSide,
      normalScale: new THREE.Vector2(1, 1),
      transparent: true,
      opacity: 0.96,
    });

    this.water = new THREE.Mesh(this._geometry, material);
    this.water.receiveShadow = true;

    // Waves --------------------------------------------
    this._initWaves(waves);
  }

  // ----------------------------------------------------
  // Wave initialisation
  // ----------------------------------------------------
  private _initWaves(waveConfigs?: WaveConfig[]): void {
    const g = 9.81; // gravitational constant used for dispersion relation

    const defaults: WaveConfig[] = waveConfigs ?? [
      { direction: [1, 0], steepness: 0.1, wavelength: 60, amplitude: 0.8 }, // Wave A
      { direction: [0, 1], steepness: 0.08, wavelength: 45, amplitude: 0.5 }, // Wave B
      { direction: [1, 1], steepness: 0.06, wavelength: 25, amplitude: 0.25 }, // Wave C
    ];

    for (const cfg of defaults) {
      const D = new THREE.Vector2(cfg.direction[0], cfg.direction[1]);
      if (D.lengthSq() === 0) throw new Error('Wave direction cannot be zero');
      D.normalize();

      const Q = THREE.MathUtils.clamp(cfg.steepness, 0.0, 1.0);
      const L = Math.max(0.0001, cfg.wavelength);
      const k = (2 * Math.PI) / L;
      // Use provided amplitude or default to gentle amplitude derived from steepness
      const A = cfg.amplitude !== undefined ? cfg.amplitude : Q / k;
      const ω = Math.sqrt(g * k);

      this._waves.push({ D, k, ω, A, Q });
    }
  }

  // ----------------------------------------------------
  // Public API
  // ----------------------------------------------------

  /** Call once per frame. */
  update(deltaTime: number): void {
    this._time += deltaTime;

    const positions = this._geometry.attributes.position.array as Float32Array;
    const init = this._initialPositions;

    for (let i = 0; i < positions.length; i += 3) {
      const x0 = init[i];
      const z0 = init[i + 2];

      let dispX = 0;
      let dispY = 0;
      let dispZ = 0;

      for (const w of this._waves) {
        const phi = w.k * (w.D.x * x0 + w.D.y * z0) - w.ω * this._time;
        const sinP = Math.sin(phi);
        const cosP = Math.cos(phi);

        // horizontal displacements (x and z)
        dispX += (w.Q * w.A * w.D.x * cosP);
        dispZ += (w.Q * w.A * w.D.y * cosP);

        // vertical displacement (y)
        dispY += (w.A * sinP);
      }

      // apply global distortion scale
      dispX *= this._distortionScale;
      dispY *= this._distortionScale;
      dispZ *= this._distortionScale;

      positions[i]     = x0 + dispX;
      positions[i + 1] = dispY;
      positions[i + 2] = z0 + dispZ;
    }

    this._geometry.attributes.position.needsUpdate = true;
    this._geometry.computeVertexNormals();
  }

  /** Returns the height of the water surface at the supplied (x,z) world position. */
  getHeightAt(x: number, z: number): number {
    let y = 0;
    for (const w of this._waves) {
      const phi = w.k * (w.D.x * x + w.D.y * z) - w.ω * this._time;
      y += w.A * Math.sin(phi);
    }
    return y * this._distortionScale;
  }

  /** Approximates the surface normal at the supplied position using finite differences. */
  getNormalAt(x: number, z: number): THREE.Vector3 {
    const eps = 0.1;
    const hL = this.getHeightAt(x - eps, z);
    const hR = this.getHeightAt(x + eps, z);
    const hD = this.getHeightAt(x, z - eps);
    const hU = this.getHeightAt(x, z + eps);

    const dx = (hR - hL) / (2 * eps);
    const dz = (hU - hD) / (2 * eps);

    return new THREE.Vector3(-dx, 1, -dz).normalize();
  }
}
