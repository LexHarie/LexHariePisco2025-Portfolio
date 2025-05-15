import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as TWEEN from '@tweenjs/tween.js';

export class Ship {
  // Three.js model and components
  private model: THREE.Group;
  private scene: THREE.Scene;
  
  // Physics
  private world: CANNON.World;
  private body: CANNON.Body;
  private shape: CANNON.Box;
  
  // Movement
  private maxSpeed: number = 25;
  private acceleration: number = 15;
  private deceleration: number = 5;
  private rotationSpeed: number = Math.PI / 4; // 45 degrees per second
  private currentSpeed: number = 0;
  
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
  
  // Effects
  private bobbingParams = { y: 0 };
  
  constructor(model: THREE.Group, scene: THREE.Scene, world: CANNON.World) {
    this.model = model;
    this.scene = scene;
    this.world = world;
    
    // Scale the ship model
    this.model.scale.set(20, 20, 20);
    
    // Set up physics body
    this.shape = new CANNON.Box(new CANNON.Vec3(8, 3, 15));
    this.body = new CANNON.Body({
      mass: 10,
      position: new CANNON.Vec3(0, 0, 0),
      shape: this.shape,
      material: new CANNON.Material({
        friction: 0.3,
        restitution: 0.3
      })
    });
    
    // Configure physics body
    this.body.linearDamping = 0.7;
    this.body.angularDamping = 0.99;
    this.body.allowSleep = false;
    
    // Add the body to the world
    this.world.addBody(this.body);
    
    // Add the model to the scene
    this.scene.add(this.model);
    
    // Set up bobbing effect
    this.setupBobbingEffect();
  }
  
  private setupBobbingEffect(): void {
    // Create the bobbing animation
    new TWEEN.Tween(this.bobbingParams)
      .to({ y: 1 }, 2000)
      .repeat(Infinity)
      .yoyo(true)
      .easing(TWEEN.Easing.Sinusoidal.InOut)
      .start();
  }
  
  public update(deltaTime: number): void {
    // Apply water buoyancy (simplified)
    this.applyBuoyancy();
    
    // Apply movement forces
    this.handleMovement(deltaTime);
    
    // Update physics to visual position and rotation
    this.updateTransform();
    
    // Update bobbing effect
    this.applyBobbingEffect();
    
    // Update stamina
    this.updateStamina(deltaTime);
  }
  
  private applyBuoyancy(): void {
    // Simple buoyancy: apply force proportional to ship's depth below water
    const waterLevel = 0;
    const submergedRatio = Math.max(0, Math.min(1, (waterLevel - (this.body.position.y - this.shape.halfExtents.y)) / (this.shape.halfExtents.y * 2)));
    
    if (submergedRatio > 0) {
      // Apply upward force proportional to submerged volume
      const buoyancyForce = new CANNON.Vec3(0, 15 * submergedRatio, 0);
      this.body.applyLocalForce(buoyancyForce, new CANNON.Vec3(0, 0, 0));
    }
  }
  
  private handleMovement(deltaTime: number): void {
    // Calculate forward vector based on ship's rotation
    const forwardVector = new CANNON.Vec3(0, 0, 1);
    const quat = this.body.quaternion;
    
    // Apply rotation manually using quaternion multiplication
    const rotatedVector = new CANNON.Vec3();
    quat.vmult(forwardVector, rotatedVector);
    
    // Handle forward/backward movement
    if (this.movementDirection.forward) {
      // Accelerate gradually
      this.currentSpeed += this.acceleration * deltaTime;
      
      // Apply boost if active
      const effectiveSpeed = this.isBoosting ? 
        this.currentSpeed * this.boostMultiplier : 
        this.currentSpeed;
      
      // Clamp to max speed
      this.currentSpeed = Math.min(this.currentSpeed, this.maxSpeed);
      
      // Apply force in forward direction
      const force = rotatedVector.scale(effectiveSpeed * 10);
      this.body.applyForce(force, this.body.position);
    } else if (this.movementDirection.backward) {
      // Reverse is slower
      this.currentSpeed -= this.acceleration * 0.5 * deltaTime;
      this.currentSpeed = Math.max(this.currentSpeed, -this.maxSpeed * 0.5);
      
      // Apply force in backward direction
      const force = rotatedVector.scale(this.currentSpeed * 10);
      this.body.applyForce(force, this.body.position);
    } else {
      // Gradually slow down
      if (this.currentSpeed > 0) {
        this.currentSpeed -= this.deceleration * deltaTime;
        this.currentSpeed = Math.max(0, this.currentSpeed);
      } else if (this.currentSpeed < 0) {
        this.currentSpeed += this.deceleration * deltaTime;
        this.currentSpeed = Math.min(0, this.currentSpeed);
      }
      
      // Apply residual force for smooth deceleration
      if (Math.abs(this.currentSpeed) > 0.1) {
        const force = rotatedVector.scale(this.currentSpeed * 10);
        this.body.applyForce(force, this.body.position);
      }
    }
    
    // Handle rotation (left/right)
    if (this.movementDirection.left) {
      // Rotate the body
      const turnTorque = new CANNON.Vec3(0, this.rotationSpeed, 0);
      this.body.applyTorque(turnTorque);
    } else if (this.movementDirection.right) {
      // Rotate the body
      const turnTorque = new CANNON.Vec3(0, -this.rotationSpeed, 0);
      this.body.applyTorque(turnTorque);
    }
    
    // Apply some rotational stability to prevent excessive rolling
    const currentRotation = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion(
        this.body.quaternion.x,
        this.body.quaternion.y,
        this.body.quaternion.z,
        this.body.quaternion.w
      )
    );
    
    // Apply stabilizing torque to minimize roll and pitch
    const stabilizeRoll = -currentRotation.z * 2;
    const stabilizePitch = -currentRotation.x * 2;
    this.body.applyTorque(new CANNON.Vec3(stabilizePitch, 0, stabilizeRoll));
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
  
  private applyBobbingEffect(): void {
    // Apply slight bobbing effect based on tween
    this.model.position.y += this.bobbingParams.y * 0.5;
    
    // Add slight roll based on bobbing
    const rollAngle = (this.bobbingParams.y - 0.5) * 0.05;
    this.model.rotation.z += rollAngle;
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
    return this.isBoosting ? this.currentSpeed * this.boostMultiplier : this.currentSpeed;
  }
  
  public getStamina(): number {
    return this.stamina;
  }
  
  public getPhysicsBody(): CANNON.Body {
    return this.body;
  }
}