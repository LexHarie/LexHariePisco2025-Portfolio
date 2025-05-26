import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as TWEEN from '@tweenjs/tween.js';
// @ts-ignore – three/examples has no type declarations by default


import { loadModel } from './utils/LoadingManager';
import { PerlinNoise } from './utils/PerlinNoise';
import { Ship } from './entities/Ship';
import { Island } from './entities/Island';
import { ShipControls } from './controls/ShipControls';
import { Bottle } from './entities/Bottle';
import { Birds } from './entities/Birds';

/**
 * Main World class that manages the 3D environment, physics, and game entities
 */
export default class World {
  // Three.js components
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;
  
  // Cannon.js physics
  private world: CANNON.World;
  private timeStep: number = 1/60;
  
  // Game entities
  private ship: Ship | null = null;
  private shipControls: ShipControls | null = null;
  private islands: Island[] = [];
  private nearestIsland: Island | null = null;
  private interactionDistance: number = 30; // Distance at which interaction is possible (reduced for smaller islands)
  
  // Environment (Water from three examples)
  private ocean: any | null = null; // Water instance (no TS types)
  private skybox: THREE.Mesh | null = null;

  // Audio
  private ambientSound: THREE.Audio | null = null;
  private ambientStarted = false;
  
  // World generation
  private worldSeed: number;
  private playerPosition: THREE.Vector3 = new THREE.Vector3();
  
  // Stats tracking is still needed for internal calculations
  private stats = {
    deltaTime: 0,
  };
  
  // Debug
  public debug: boolean = false; // Kept but not used
  
  // Project bottles (floating scroll-in-bottle entities)
  private bottles: Bottle[] = [];
  private bottleDistance: number = 20;
  
  // Resume chest (floating treasure chest for resume)
  private resumeChestModel: THREE.Group | null = null;
  private resumeChestBaseY: number = 0;
  private resumeInteractDistance: number = 20;
  
  // Mini-map bounds (updated from boundary)
  private mapBounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  // World movement boundary (convex polygon on XZ)
  private boundary: THREE.Vector2[] = [];
  // Activity area birds simulation
  private birds: Birds | null = null;
  
  constructor() {
    // Initialize Three.js scene
    this.scene = new THREE.Scene();
    // Lighten fog for better visibility
    const fogColor = 0x2e6a8b;
    this.scene.fog = new THREE.FogExp2(fogColor, 0.001);
    
    // Initialize camera with orthographic projection for isometric view
    const aspect = window.innerWidth / window.innerHeight;
    // Zoom factor: smaller value = closer view (adjusted for portrait portfolio)
    const d = 300;
    this.camera = new THREE.OrthographicCamera(
      -d * aspect,
      d * aspect,
      d,
      -d,
      0.1,
      3000
    );
    this.camera.position.set(100, 100, 100);
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));
    
    // Initialize renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    // Lighten background color to match fog
    this.renderer.setClearColor(fogColor);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      // Append renderer canvas into the world container, or fallback to body
      const container = document.getElementById('world-container');
      if (container) {
        container.appendChild(this.renderer.domElement);
      } else {
        document.body.appendChild(this.renderer.domElement);
      }
    
    // Initialize physics world
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0)
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    
    // Initialize world generation
    this.worldSeed = Math.random() * 1000;
    new PerlinNoise(this.worldSeed); // Create but don't store reference since it's not used
    
    // Initialize clock
    this.clock = new THREE.Clock();
  }
  
  public async init(): Promise<void> {
    // Set up lighting
    this.setupLighting();
    
    // Create ocean and skybox
    await this.createEnvironment();
    // Generate random convex boundary for the mini-map (walls disabled)
    this.generateBoundary();
    // this.createBoundaryWalls(); // walls removed per user request
    
    // Initialize ship
    await this.createShip();
    
    // Create experience islands (disabled)
    // await this.createExperienceIslands();
    
    // Create floating project bottles (click proximity opens project link)
    await this.createProjectBottles();
    
    // Create floating resume chest (press 'O' near chest to open resume PDF)
    await this.createResumeChest();
    // Create activity area birds simulation
    this.createActivityArea();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Create UI elements
    this.createUI();

    // Background audio
    this.setupBackgroundAudio();
    
    // Debug helpers
    if (this.debug) {
      this.setupDebugHelpers();
    }
    
    // Load CSS for pirate scroll
    this.loadScrollStyles();
  }
  
  private setupLighting(): void {
    // Ambient light (brightened for visibility)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);
    
    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    
    // Configure shadow properties
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 10;
    directionalLight.shadow.camera.far = 300;
    directionalLight.shadow.camera.left = -150;
    directionalLight.shadow.camera.right = 150;
    directionalLight.shadow.camera.top = 150;
    directionalLight.shadow.camera.bottom = -150;
    
    this.scene.add(directionalLight);
    
    // Hemisphere light for sky and ground
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x080820, 1.0);
    this.scene.add(hemisphereLight);
  }
  
  private async createEnvironment(): Promise<void> {
    // ------------------------------
    // Gerstner-wave ocean
    // ------------------------------

    const oceanGeometry = new THREE.PlaneGeometry(20000, 20000, 512, 512);

    const oceanMaterial = new THREE.MeshStandardMaterial({
      color: 0x0e6aa8,
      roughness: 0.85,
      metalness: 0.2,
      transparent: true,
      opacity: 0.98,
    });

    // Attach Gerstner-wave deformation in onBeforeCompile hook
    oceanMaterial.onBeforeCompile = (shader: any) => {
      shader.uniforms.uTime = { value: 0 };

      shader.uniforms.uWaveDir = {
        value: [
          new THREE.Vector2(1.0, 0.0),
          new THREE.Vector2(0.8, 0.6),
          new THREE.Vector2(-0.6, 0.8),
          new THREE.Vector2(0.2, -1.0),
        ],
      } as any;

      shader.uniforms.uAmplitude = { value: [2.0, 1.4, 1.0, 0.6] } as any;
      shader.uniforms.uWavelength = { value: [12.0, 8.0, 6.0, 4.0] } as any;
      shader.uniforms.uSpeed = { value: [1.0, 0.9, 0.8, 0.7] } as any;
      shader.uniforms.uSteepness = { value: [0.6, 0.5, 0.45, 0.4] } as any;

      // GLSL injection point
      const gerstnerPars = /* glsl */ `
        #define GERSTNER_WAVES 4
        uniform float uTime;
        uniform vec2 uWaveDir[GERSTNER_WAVES];
        uniform float uAmplitude[GERSTNER_WAVES];
        uniform float uWavelength[GERSTNER_WAVES];
        uniform float uSteepness[GERSTNER_WAVES];
        uniform float uSpeed[GERSTNER_WAVES];

        const float G = 9.81;

        // Returns displaced position (x, y, z)
        vec3 gerstnerDisplace(vec3 position) {
          vec3 newPos = position;
          for (int i = 0; i < GERSTNER_WAVES; i++) {
            float k = 2.0 * PI / uWavelength[i];
            float c = sqrt(G / k);
            vec2 d = normalize(uWaveDir[i]);
            float f = k * dot(d, position.xz) + uSpeed[i] * k * uTime;
            float A = uAmplitude[i];
            float S = sin(f);
            float C = cos(f);
            float Qi = uSteepness[i] / (k * A * float(GERSTNER_WAVES));

            newPos.x += Qi * A * d.x * C;
            newPos.z += Qi * A * d.y * C;
            newPos.y += A * S;
          }
          return newPos;
        }
      `;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>\n${gerstnerPars}`,
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n
        vec3 transformedPos = gerstnerDisplace(transformed);\n
        // use displaced position\n        transformed = transformedPos;`,
      );

      // Store reference for animation loop
      oceanMaterial.userData.shader = shader;
    };

    this.ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.receiveShadow = true;
    this.scene.add(this.ocean);
    
    // Enhance the skybox
    const skyboxGeometry = new THREE.SphereGeometry(3000, 64, 64);
    const skyboxMaterial = new THREE.MeshBasicMaterial({
      color: 0x88ddff, // Slightly brighter blue
      side: THREE.BackSide,
      fog: false,
    });
    
    this.skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
    this.scene.add(this.skybox);
  }
  
  private async createShip(): Promise<void> {
    const shipModel = await loadModel('/models/pirate_ship.glb');
    this.ship = new Ship(shipModel, this.scene, this.world);
    
    // Ship's initial position is now handled in the Ship constructor
    
    this.shipControls = new ShipControls(this.ship, this.camera);
    
    // Set up camera to follow ship
    this.shipControls.init();
    
    // Add debug console message to help the user
    console.log('Ship controls: W/S to move forward/backward, A/D to turn, SHIFT to boost');
  }
  
  /**
   * Creates experience islands and places them in the world
   */
  private async createExperienceIslands(): Promise<void> {
    // Pirate island loading disabled: skip adding any experience islands.
    this.islands = [];
    return;
  }
  
  private setupEventListeners(): void {
    // Add escape key listener for closing overlays
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const overlays = document.querySelectorAll('.overlay-panel, .project-card, .pirate-scroll-overlay');
        overlays.forEach(overlay => {
          // Find and click the close button if it exists
          const closeButton = overlay.querySelector('.close-button, .pirate-scroll-close');
          if (closeButton instanceof HTMLElement) {
            closeButton.click();
          } else {
            (overlay as HTMLElement).style.display = 'none';
          }
          
          // Resume physics and controls
          if (this.shipControls) {
            this.shipControls.enabled = true;
          }
        });
        
        // Remove background blur
        this.renderer.domElement.style.filter = '';
      }
      
      // Add E key for interaction
      if (event.key === 'e' || event.key === 'E') {
        this.handleInteraction();
      }
      // Add O key for opening resume chest
      if (event.key === 'o' || event.key === 'O') {
        this.handleOpenResume();
      }
    });
  }
  
  private createUI(): void {
    // Create interaction prompt
    const prompt = document.createElement('div');
    prompt.className = 'interaction-prompt';
    prompt.textContent = 'Press E to view';
    document.body.appendChild(prompt);
    
    // Create UI overlay container if it doesn't exist
    if (!document.getElementById('ui-overlay')) {
      const uiOverlay = document.createElement('div');
      uiOverlay.id = 'ui-overlay';
      document.body.appendChild(uiOverlay);
    }
    // Create mini-map display
    if (!document.getElementById('mini-map')) {
      const mini = document.createElement('div');
      mini.id = 'mini-map';
      // Map image
      const img = document.createElement('img');
      img.src = '/assets/PortfolioMap.png';
      img.alt = 'Mini Map';
      mini.appendChild(img);
      // Marker for user position
      const marker = document.createElement('div');
      marker.className = 'marker';
      mini.appendChild(marker);
      document.body.appendChild(mini);
    }
  }
  
  private setupDebugHelpers(): void {
    // Debug helpers removed
  }

  // -----------------------------
  // Audio
  // -----------------------------
  private setupBackgroundAudio(): void {
    const listener = new THREE.AudioListener();
    this.camera.add(listener);

    const sound = new THREE.Audio(listener);
    const audioLoader = new THREE.AudioLoader();

    // Try formats in order until one decodes successfully
    const sources = [
      '/audio/620446__klankbeeld__river-shipping-nl-1232pm-210921_0316.mp3',
      '/audio/620446__klankbeeld__river-shipping-nl-1232pm-210921_0316.ogg',
      '/audio/620446__klankbeeld__river-shipping-nl-1232pm-210921_0316.flac',
    ];

    const tryLoad = (idx = 0) => {
      if (idx >= sources.length) {
        console.warn('Background audio: all candidate files failed to decode.');
        return;
      }

      audioLoader.load(
        sources[idx],
        (buffer) => {
          sound.setBuffer(buffer);
          sound.setLoop(true);
          sound.setVolume(0.5);
        },
        undefined,
        () => {
          // onError: try next source
          tryLoad(idx + 1);
        },
      );
    };

    tryLoad();

    this.ambientSound = sound;

    // Unlock audio on first user gesture if it was suspended
    // unlock/resume on user gesture but actual playback will start on first ship movement
    const resumeContext = () => {
      if (this.ambientSound && this.ambientSound.context.state === 'suspended') {
        this.ambientSound.context.resume();
      }
    };

    document.addEventListener('click', resumeContext);
    document.addEventListener('keydown', resumeContext);
  }

  private maybeStartAmbientSound(): void {
    if (this.ambientStarted || !this.ambientSound || !this.ship) return;

    const speed = this.ship.getCurrentSpeed();
    const minSpeed = 0.5; // small threshold to avoid starting while idle

    if (speed > minSpeed) {
      if (this.ambientSound.context.state === 'suspended') {
        // Wait until context resumed (handled by user gesture listener)
        return;
      }

      // @ts-ignore property not in typings
      if (!(this.ambientSound as any).isPlaying) {
        this.ambientSound.play();
      }
      this.ambientStarted = true;
    }
  }
  
  public animate(): void {
    requestAnimationFrame(() => this.animate());
    
    const deltaTime = this.clock.getDelta();
    this.stats.deltaTime = deltaTime;
    
    // Update TWEEN
    TWEEN.update();
    
    // Update physics
    this.world.step(this.timeStep);
    
    // Update ship and controls
    if (this.ship && this.shipControls) {
      this.ship.update(deltaTime);
      this.shipControls.update(deltaTime);
      
      // Update player position for world generation
      this.playerPosition.copy(this.ship.position);
      
      // Find nearest island for interaction
      this.findNearestIsland();

      // Attempt to start background sound when player starts moving
      this.maybeStartAmbientSound();
    }
    
    // Update islands
    for (const island of this.islands) {
      island.update(deltaTime);
    }
    // Update project bottles drift and bobbing
    for (const bottle of this.bottles) {
      bottle.update(deltaTime);
    }
    // Update resume chest bobbing
    if (this.resumeChestModel) {
      const t = this.clock.getElapsedTime();
      this.resumeChestModel.position.y = this.resumeChestBaseY + Math.sin(t) * 2;
    }
    // Update birds simulation in activity area
    if (this.birds) {
      this.birds.update(deltaTime);
    }
    
    // Animate Gerstner ocean
    if (
      this.ocean &&
      (this.ocean.material as THREE.MeshStandardMaterial).userData.shader
    ) {
      const shader: any = (this.ocean.material as THREE.MeshStandardMaterial).userData.shader;
      if (shader && shader.uniforms && shader.uniforms.uTime) {
        shader.uniforms.uTime.value += deltaTime;
      }
    }

    // Update UI
    this.updateUI();
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
  
  /**
   * Finds the nearest island to the ship for interaction
   */
  private findNearestIsland(): void {
    if (!this.ship) return;
    
    let nearestIsland: Island | null = null;
    let minDistance = Infinity;
    
    for (const island of this.islands) {
      const distance = this.ship.position.distanceTo(island.position);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestIsland = island;
      }
    }
    
    this.nearestIsland = nearestIsland;
  }
  
  /**
   * Updates the UI elements
   */
  private updateUI(): void {
    // Update interaction prompt
    const promptEl = document.querySelector('.interaction-prompt');
    if (promptEl && this.nearestIsland) {
      const distance = this.ship?.position.distanceTo(this.nearestIsland.position) || Infinity;
      
      if (distance < this.interactionDistance) {
        // Show interaction prompt
        promptEl.classList.add('visible');
        (promptEl as HTMLElement).textContent = `Press E to view ${this.nearestIsland.getCompany()}`;
      } else {
        // Hide interaction prompt
        promptEl.classList.remove('visible');
      }
    } else if (promptEl) {
      // No nearby island, hide prompt
      promptEl.classList.remove('visible');
    }
    // Update mini-map marker
    this.updateMiniMap();
    // Check project bottle proximity and open links
    this.checkProjectBottles();
  }
  
  /**
   * Handles interaction with the nearest island
   */
  private handleInteraction(): void {
    if (!this.nearestIsland || !this.ship) return;
    
    const distance = this.ship.position.distanceTo(this.nearestIsland.position);
    
    if (distance < this.interactionDistance) {
      // We're in range, trigger the interaction
      this.nearestIsland.interact();
      
      // Disable ship controls during interaction
      if (this.shipControls) {
        this.shipControls.enabled = false;
      }
    }
  }
  
  /**
   * Loads the pirate scroll CSS styles
   */
  private loadScrollStyles(): void {
    // Add pirate scroll CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/pirate-scroll.css';
    document.head.appendChild(link);
  }
  
  public handleResize(): void {
    const aspect = window.innerWidth / window.innerHeight;
    // Match initial view size for full boundary
    const d = 300;
    this.camera.left = -d * aspect;
    this.camera.right = d * aspect;
    this.camera.top = d;
    this.camera.bottom = -d;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  public getShip(): Ship | null {
    return this.ship;
  }
  
  public getCamera(): THREE.OrthographicCamera {
    return this.camera;
  }
  
  public getScene(): THREE.Scene {
    return this.scene;
  }
  
  public getWorld(): CANNON.World {
    return this.world;
  }
  
  /** Check project bottle proximity and open links when in range */
  private checkProjectBottles(): void {
    if (!this.ship) return;
    for (const bottle of this.bottles) {
      if ((bottle as any).triggered) continue;
      const dist = this.ship.position.distanceTo((bottle as any).getPosition());
      if (dist < this.bottleDistance) {
        (bottle as any).triggered = true;
        window.open((bottle as any).link, '_blank', 'noopener');
      }
    }
  }
  
  /** Update mini-map red marker based on ship position */
  private updateMiniMap(): void {
    const mapEl = document.getElementById('mini-map');
    const marker = mapEl?.querySelector('.marker') as HTMLElement | null;
    const img = mapEl?.querySelector('img') as HTMLImageElement | null;
    if (!this.ship || !mapEl || !marker || !img) return;
    const rect = img.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = this.ship.position.x;
    const z = this.ship.position.z;
    const normX = (x - this.mapBounds.minX) / (this.mapBounds.maxX - this.mapBounds.minX);
    const normZ = (z - this.mapBounds.minZ) / (this.mapBounds.maxZ - this.mapBounds.minZ);
    const px = normX * rect.width;
    const py = (1 - normZ) * rect.height;
    marker.style.left = `${px}px`;
    marker.style.top = `${py}px`;
  }
  
  /** Handle pressing 'O' to open resume PDF when near the chest */
  private handleOpenResume(): void {
    if (!this.ship || !this.resumeChestModel) return;
    const chestPos = this.resumeChestModel.position;
    const dist = this.ship.position.distanceTo(chestPos);
    if (dist < this.resumeInteractDistance) {
      window.open('/assets/Pisco-Latest-Resume-Nov-21-2024.pdf', '_blank', 'noopener');
    }
  }
  
  /** Instantiate floating bottles for projects */
  private async createProjectBottles(): Promise<void> {
    const bottleTemplate = await loadModel('/models/bottle_with_scroll.glb');
    // Set up custom project links and assets
    const links = [
      'https://app.splurge.art/',
      'https://www.youtube.com/watch?v=t6vxzBi99hQ',
      'https://gitlab.com/moodnft'
    ];
    const assetImages = [
      '/assets/project_1.png',
      '/assets/project_2.png',
      '/assets/project_3.jpeg'
    ];
    // Define positions for three project bottles
    const positions = [
      new THREE.Vector3(300, 0, -100),
      new THREE.Vector3(300, 0, 50),
      new THREE.Vector3(300, 0, 200)
    ];
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const tex = assetImages[i];
      const bottle = new Bottle(bottleTemplate, this.scene, { link, textureUrl: tex, position: positions[i] });
      this.bottles.push(bottle);
    }
  }
  
  /** Instantiate floating treasure chest for resume */
  private async createResumeChest(): Promise<void> {
    const chestModel = await loadModel('/models/treasure_chest.glb');
    // Scale and position chest
    const scale = 1;
    chestModel.scale.set(scale, scale, scale);
    const pos = new THREE.Vector3(0, 0, 300);
    chestModel.position.copy(pos);
    this.scene.add(chestModel);
    this.resumeChestModel = chestModel;
    this.resumeChestBaseY = pos.y;
  }
  
  /** Instantiate activity area birds simulation */
  private createActivityArea(): void {
    // Center and parameters for activity zone
    const center = new THREE.Vector3(-300, 0, 100);
    // Create birds simulation in specified area
    this.birds = new Birds(this.scene, center, 200, 100);
  }
  
  /** Generate a random convex boundary polygon */
  private generateBoundary(): void {
    const num = 8;
    const minR = 400;
    const maxR = 600;
    const verts: THREE.Vector2[] = [];
    for (let i = 0; i < num; i++) {
      const angle = (i / num) * Math.PI * 2 + (Math.random() - 0.5) * (Math.PI * 2 / num) * 0.3;
      const r = minR + Math.random() * (maxR - minR);
      verts.push(new THREE.Vector2(Math.cos(angle) * r, Math.sin(angle) * r));
    }
    // Compute bounding box for mini-map
    const xs = verts.map(v => v.x);
    const zs = verts.map(v => v.y);
    this.mapBounds = {
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minZ: Math.min(...zs), maxZ: Math.max(...zs)
    };
    this.boundary = verts;
    // Boundary visualization is represented by 3D walls for visibility
  }
  
  /** Create static physics walls along the boundary to confine the ship */
  private createBoundaryWalls(): void {
    if (!this.boundary.length) return;
    const height = 100;
    const thickness = 5;
    for (let i = 0; i < this.boundary.length; i++) {
      const v1 = this.boundary[i];
      const v2 = this.boundary[(i + 1) % this.boundary.length];
      const dx = v2.x - v1.x;
      const dz = v2.y - v1.y;
      const length = Math.sqrt(dx * dx + dz * dz);
      const midX = (v1.x + v2.x) / 2;
      const midZ = (v1.y + v2.y) / 2;
      // Create box shape
      const shape = new CANNON.Box(new CANNON.Vec3(length / 2, height, thickness));
      const wall = new CANNON.Body({ mass: 0, shape });
      // Position wall
      wall.position.set(midX, 0, midZ);
      // Rotate to align with edge
      const angle = Math.atan2(dz, dx);
      wall.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
      this.world.addBody(wall);
      // Visualize boundary wall with a wooden look
      const wallHeightVis = 20;
      const wallThicknessVis = thickness * 2;
      const wallGeometry = new THREE.BoxGeometry(length, wallHeightVis, wallThicknessVis);
      const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
      const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
      wallMesh.position.set(midX, wallHeightVis / 2, midZ);
      wallMesh.rotation.y = angle;
      wallMesh.receiveShadow = true;
      wallMesh.castShadow = true;
      this.scene.add(wallMesh);
    }
  }
}