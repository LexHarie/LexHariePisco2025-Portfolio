import * as THREE from 'three';
import * as CANNON from 'cannon-es';
// Removed TWEEN-based bobbing; using Gerstner water

import GerstnerWater from '../utils/GerstnerWater';
export class Ship {
  // Three.js model and components
  private model: THREE.Group;
  private scene: THREE.Scene;
  
  // Physics
  private world: CANNON.World;
  private body: CANNON.Body;
  private shape: CANNON.Box;
  
  // Movement
  private acceleration: number = 15;
  private rotationSpeed: number = Math.PI / 4; // 45 degrees per second
  
  // Stamina
  private stamina: number = 1.0;
  private staminaDrainRate: number = 0.2;
  private staminaRegenRate: number = 0.1;
  private boostMultiplier: number = 1.8;
  private isBoosting: boolean = false;
  
  // Movement state
  private movementDirection = {
    forward: false,
    backward: false,
    left: false,
    right: false
  };
  
  // Gerstner water reference
  private water: GerstnerWater;
  
  constructor(model: THREE.Group, scene: THREE.Scene, world: CANNON.World, water: GerstnerWater) {
    this.model = model;
    this.scene = scene;
    this.world = world;
    this.water = water;
    
    // Scale the ship model
    this.model.scale.set(5, 5, 5);
    
    // Set up physics body
    this.shape = new CANNON.Box(new CANNON.Vec3(8, 3, 15));
    this.body = new CANNON.Body({
      mass: 10,
      position: new CANNON.Vec3(0, 10, 0), // Start higher above water
      shape: this.shape,
      material: new CANNON.Material({
        friction: 0.3,
        restitution: 0.3
      })
    });
    
    // Configure physics body with lower damping
    this.body.linearDamping = 0.25;
    this.body.angularDamping = 0.35;
    this.body.allowSleep = false;
    
    // Set higher initial position to give the ship more room to fall and stabilize
    this.body.position.set(0, 5, 0);
    
    // Allow yaw (Y-axis rotation) only, block pitch and roll
    this.body.angularFactor.set(0, 1, 0);
    
    // Add the body to the world
    this.world.addBody(this.body);
    
    // Add event listener to neutralize any residual tilt after physics step
    this.world.addEventListener('postStep', () => {
      // Get current rotation as axis/angle
      const axis = new CANNON.Vec3();
      
      // If rotation is primarily around Y axis, keep it as is
      // Otherwise, reset rotation to keep only the Y component
      if (Math.abs(axis.y) < 0.9) { // If not primarily rotating around Y
        // Extract rotation around Y axis using body's euler angles
        const euler = new CANNON.Vec3();
        this.body.quaternion.toEuler(euler);
        
        // Create new quaternion with only Y rotation
        const fixedQuaternion = new CANNON.Quaternion();
        fixedQuaternion.setFromEuler(0, euler.y, 0);
        this.body.quaternion.copy(fixedQuaternion);
      }
    });
    
    // Add the model to the scene
    this.scene.add(this.model);
    
    // Update model position to match initial body position
    this.model.position.set(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    );
    
    // Gerstner water will drive buoyancy and orientation
  }
  
  
  public update(deltaTime: number): void {
    // Apply water buoyancy (simplified)
    this.applyBuoyancy();
    
    // Apply movement forces
    this.handleMovement();
    
    // Update physics to visual position and rotation
    this.updateTransform();
    // Align with Gerstner water normal
    this.applyOrientation();
    
    // Update stamina
    this.updateStamina(deltaTime);
  }
  
  private applyBuoyancy(): void {
    // Get current Gerstner water height at ship position
    const waterLevel = this.water.getHeightAt(this.body.position.x, this.body.position.z);
    const halfH = this.shape.halfExtents.y;
    const depth = waterLevel - (this.body.position.y - halfH);
    const submerged = Math.max(0, Math.min(1, depth / (halfH * 2)));
  
    if (submerged === 0) return;
  
    // Enhanced buoyancy - multiply by 1.5 to create extra lift
    // This ensures the ship floats higher in the water rather than sitting at neutral buoyancy
    // Increase multiplier to keep the ship higher on large waves
    const buoyancyMultiplier = 8;
    const F = -this.world.gravity.y * this.body.mass * submerged * buoyancyMultiplier;
    this.body.applyForce(new CANNON.Vec3(0, F, 0), this.body.position);
    
    // Vertical damping to prevent bouncing
    const verticalDamping = 0.8;
    this.body.applyForce(new CANNON.Vec3(0, -this.body.velocity.y * verticalDamping * submerged, 0), this.body.position);
  
    // Quadratic water drag on horizontal motion
    const dragCoeff = 1.5; // gentler horizontal water drag for freer movement
    const horizVel = new CANNON.Vec3(this.body.velocity.x, 0, this.body.velocity.z);
    this.body.applyForce(horizVel.scale(-dragCoeff * submerged), this.body.position);

    // Softly correct height so the deck stays above water crests.
    const clearance = 2; // additional units above the water surface (tune for desired deck height)
    const desiredHeight = waterLevel + this.shape.halfExtents.y + clearance;
    const lerpFactor = 0.01;
    this.body.position.y = THREE.MathUtils.lerp(this.body.position.y, desiredHeight, lerpFactor);
  }
  
  
private handleMovement(): void {
  const thrust = (this.isBoosting ? this.acceleration * this.boostMultiplier
                                   : this.acceleration) * this.body.mass;

  // forward vector in world space
  const fwd = new CANNON.Vec3(0, 0, -1);   // model faces –Z for Three.js ships
  this.body.quaternion.vmult(fwd, fwd);

  if (this.movementDirection.forward)
      this.body.applyForce(fwd.scale(thrust), this.body.position);
  if (this.movementDirection.backward)
      this.body.applyForce(fwd.scale(-thrust * 0.5), this.body.position);

  // yaw control via angular velocity, not torque impulses
  const yawRate = this.rotationSpeed;
  if (this.movementDirection.left)        this.body.angularVelocity.y =  yawRate;
  else if (this.movementDirection.right)  this.body.angularVelocity.y = -yawRate;
  else                                    this.body.angularVelocity.y *= 0.9;
}

  
  private updateTransform(): void {
    // Update position
    this.model.position.set(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    );
    
    // Update rotation
    this.model.quaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    );
  }
  
  
  private updateStamina(deltaTime: number): void {
    if (this.isBoosting && this.movementDirection.forward) {
      // Drain stamina when boosting
      this.stamina -= this.staminaDrainRate * deltaTime;
      this.stamina = Math.max(0, this.stamina);
      
      // Disable boost if stamina is depleted
      if (this.stamina <= 0) {
        this.isBoosting = false;
      }
    } else {
      // Regenerate stamina when not boosting
      this.stamina += this.staminaRegenRate * deltaTime;
      this.stamina = Math.min(1, this.stamina);
    }
  }
  
  // Align ship model orientation with Gerstner water normal and physics yaw
  private applyOrientation(): void {
    // Centre position of the ship on the water surface
    const x = this.body.position.x;
    const z = this.body.position.z;

    // Use distances that roughly match the ship's size when sampling the surface.
    // This filters out short-wavelength ripples that would otherwise cause jitter.
    const halfWidth = this.shape.halfExtents.x;   // ≈ 8
    const halfLength = this.shape.halfExtents.z;  // ≈ 15

    // Roll (around Z) – sample left and right water heights
    const hL = this.water.getHeightAt(x - halfWidth, z);
    const hR = this.water.getHeightAt(x + halfWidth, z);
    const slopeX = (hR - hL) / (2 * halfWidth);

    // Pitch (around X) – sample front and back water heights
    const hB = this.water.getHeightAt(x, z - halfLength); // back
    const hF = this.water.getHeightAt(x, z + halfLength); // front
    const slopeZ = (hF - hB) / (2 * halfLength);

    // Convert slopes to tilt angles (small-angle approximation)
    const roll = 0.5 * Math.atan(-slopeX);
    const pitch = 0.5 * Math.atan(slopeZ);

    // Preserve yaw coming from the physics body
    const euler = new CANNON.Vec3();
    this.body.quaternion.toEuler(euler);
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), euler.y);

    // Combine rotations (order: yaw → pitch → roll)
    const pitchQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
    const rollQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll);
    const targetQuat = yawQuat.multiply(pitchQuat).multiply(rollQuat);

    // Smoothly interpolate towards the target to remove jitter
    this.model.quaternion.slerp(targetQuat, 0.1);
  }
  
  public setMovementDirection(direction: 'forward' | 'backward' | 'left' | 'right', active: boolean): void {
    this.movementDirection[direction] = active;
  }
  
  public setBoost(active: boolean): void {
    // Only allow boosting if there's enough stamina
    this.isBoosting = active && this.stamina > 0.1;
  }
  
  public get position(): THREE.Vector3 {
    return this.model.position;
  }
  
  public getRotation(): number {
    return this.model.rotation.y;
  }
  
  public getCurrentSpeed(): number {
    // Calculate actual speed from velocity magnitude
    const velocity = this.body.velocity;
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    
    return this.isBoosting ? speed * this.boostMultiplier : speed;
  }
  
  public getStamina(): number {
    return this.stamina;
  }
  
  public getPhysicsBody(): CANNON.Body {
    return this.body;
  }
}