import * as THREE from 'three';
import type { ResourceType, WeaponType } from '../../../shared/protocol';
import type { InputManager } from '../engine/InputManager';
import type { WorldMap } from '../engine/WorldMap';
import type { BuildingSystem } from '../building/BuildingSystem';
import { createCharacterRig, type CharacterRig } from './ProceduralAssets';

export interface WeaponStats {
  name: string;
  magSize: number;
  ammo: number;
  reserve: number;
  fireRate: number; // seconds between shots
  reloadTime: number;
  spread: number;
  recoil: number;
}

export class PlayerController {
  public rig: CharacterRig;
  public group: THREE.Group;
  public pos = new THREE.Vector3(0, 3, 0);
  private walkAnimTime = 0;
  public vel = new THREE.Vector3();
  public yaw = 0;
  public pitch = -0.15;
  public onGround = false;
  public crouching = false;
  public alive = true;

  public hp = 100;
  public shield = 50;
  public kills = 0;

  public activeWeapon: WeaponType = 'ar';
  public resources: Record<ResourceType, number> = {
    wood: 150,
    brick: 100,
    metal: 100,
  };

  public weapons: Record<WeaponType, WeaponStats> = {
    pickaxe: { name: 'PICKAXE', magSize: 0, ammo: 0, reserve: 0, fireRate: 0.45, reloadTime: 0, spread: 0, recoil: 0 },
    ar: { name: 'ASSAULT RIFLE', magSize: 30, ammo: 30, reserve: 150, fireRate: 0.11, reloadTime: 1.8, spread: 0.015, recoil: 0.018 },
    shotgun: { name: 'PUMP SHOTGUN', magSize: 8, ammo: 8, reserve: 40, fireRate: 0.75, reloadTime: 2.2, spread: 0.055, recoil: 0.05 },
  };

  public fireCooldown = 0;
  public reloading = false;
  public reloadTimer = 0;
  public bloom = 0;

  private raycaster = new THREE.Raycaster();
  private downVec = new THREE.Vector3(0, -1, 0);

  constructor(
    scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private input: InputManager,
    private worldMap: WorldMap,
    private building: BuildingSystem
  ) {
    this.rig = createCharacterRig(0x0284c7);
    this.group = this.rig.group;
    scene.add(this.group);
  }

  public getCameraForward(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    return dir.normalize();
  }

  public getMuzzleOrigin(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + (this.crouching ? 1.15 : 1.55), this.pos.z);
  }

  public startReload(): void {
    const w = this.weapons[this.activeWeapon];
    if (this.reloading || w.magSize === 0 || w.ammo === w.magSize || w.reserve <= 0) return;
    this.reloading = true;
    this.reloadTimer = w.reloadTime;
  }

  public update(dt: number): void {
    if (!this.alive) return;

    // Mouse look
    const { dx, dy } = this.input.consumeMouseDelta();
    const sensitivity = 0.0022;
    this.yaw -= dx * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sensitivity, -1.25, 1.25);

    // Cooldowns & reload
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.bloom = Math.max(0, this.bloom - dt * 0.08);

    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        const w = this.weapons[this.activeWeapon];
        const needed = w.magSize - w.ammo;
        const taken = Math.min(needed, w.reserve);
        w.ammo += taken;
        w.reserve -= taken;
      }
    }

    // Movement input
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const moveDir = new THREE.Vector3();

    if (this.input.keys.has('KeyW')) moveDir.add(forward);
    if (this.input.keys.has('KeyS')) moveDir.sub(forward);
    if (this.input.keys.has('KeyD')) moveDir.add(right);
    if (this.input.keys.has('KeyA')) moveDir.sub(right);
    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      this.bloom = Math.min(0.06, this.bloom + dt * 0.04);
    }

    this.crouching = this.input.keys.has('ControlLeft') || this.input.keys.has('AltLeft');
    const sprinting = (this.input.keys.has('ShiftLeft') || this.input.keys.has('ShiftRight')) && !this.crouching;
    const speed = this.crouching ? 4.2 : sprinting ? 10.5 : 7.2;

    this.vel.x = moveDir.x * speed;
    this.vel.z = moveDir.z * speed;

    // Jump & Gravity
    if (this.input.keys.has('Space') && this.onGround) {
      this.vel.y = 9.2;
      this.onGround = false;
    }
    this.vel.y -= 24.0 * dt;

    this.pos.addScaledVector(this.vel, dt);

    // Clamp to arena bounds
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -120, 120);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -120, 120);

    // Ground & Structure Collision
    let groundY = this.worldMap.getTerrainHeight(this.pos.x, this.pos.z);

    if (this.building.structureMeshes.length > 0) {
      this.raycaster.set(new THREE.Vector3(this.pos.x, this.pos.y + 1.4, this.pos.z), this.downVec);
      this.raycaster.far = 2.6;
      const hits = this.raycaster.intersectObjects(this.building.structureMeshes, false);
      if (hits.length > 0) {
        groundY = Math.max(groundY, hits[0].point.y);
      }
    }

    if (this.pos.y <= groundY) {
      this.pos.y = groundY;
      this.vel.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // Update character mesh & animate legs
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    this.group.scale.y = this.crouching ? 0.72 : 1.0;

    const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (!this.onGround) {
      this.rig.leftLeg.rotation.x = 0.45;
      this.rig.rightLeg.rotation.x = -0.35;
    } else if (horizSpeed > 0.5) {
      this.walkAnimTime += dt * horizSpeed * 1.4;
      this.rig.leftLeg.rotation.x = Math.sin(this.walkAnimTime) * 0.55;
      this.rig.rightLeg.rotation.x = -Math.sin(this.walkAnimTime) * 0.55;
    } else {
      this.rig.leftLeg.rotation.x = THREE.MathUtils.lerp(this.rig.leftLeg.rotation.x, 0, dt * 12);
      this.rig.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rig.rightLeg.rotation.x, 0, dt * 12);
    }

    for (const key of Object.keys(this.rig.weaponMeshes) as WeaponType[]) {
      this.rig.weaponMeshes[key].visible = key === this.activeWeapon;
    }

    // Over-the-shoulder third-person spring-arm camera
    const pivot = this.pos.clone().add(new THREE.Vector3(0, this.crouching ? 1.35 : 1.75, 0));
    const shoulderOffset = new THREE.Vector3(0.95, 0.25, 3.8);
    shoulderOffset.applyEuler(new THREE.Euler(this.pitch * 0.7, this.yaw, 0, 'YXZ'));
    const desiredCamPos = pivot.clone().add(shoulderOffset);

    // Spring-arm collision check against terrain & structures
    const camDir = desiredCamPos.clone().sub(pivot);
    const camDist = camDir.length();
    if (camDist > 0.01) {
      this.raycaster.set(pivot, camDir.normalize());
      this.raycaster.far = camDist;
      const obstacles = [...this.worldMap.collidableMeshes, ...this.building.structureMeshes];
      const camHits = this.raycaster.intersectObjects(obstacles, false);
      if (camHits.length > 0) {
        const safeDist = Math.max(0.85, camHits[0].distance - 0.3);
        desiredCamPos.copy(pivot).addScaledVector(camDir, safeDist);
      }
    }

    const camMinY = this.worldMap.getTerrainHeight(desiredCamPos.x, desiredCamPos.z) + 0.5;
    if (desiredCamPos.y < camMinY) desiredCamPos.y = camMinY;

    this.camera.position.lerp(desiredCamPos, Math.min(1, dt * 22));

    const lookTarget = pivot.clone().addScaledVector(this.getCameraForward(), 14);
    this.camera.lookAt(lookTarget);
  }
}
