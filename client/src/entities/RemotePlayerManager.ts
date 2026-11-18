import * as THREE from 'three';
import type { PlayerState, WeaponType } from '../../../shared/protocol';
import { createCharacterRig, type CharacterRig } from './ProceduralAssets';

interface RemoteEntity {
  rig: CharacterRig;
  group: THREE.Group;
  targetPos: THREE.Vector3;
  targetYaw: number;
  state: PlayerState;
}

export class RemotePlayerManager {
  private entities = new Map<string, RemoteEntity>();

  constructor(private scene: THREE.Scene) {}

  public syncPlayers(players: PlayerState[], localId: string | null): void {
    const activeIds = new Set<string>();

    for (const p of players) {
      if (p.id === localId) continue;
      activeIds.add(p.id);

      let entity = this.entities.get(p.id);
      if (!entity) {
        const rig = createCharacterRig(0xef4444);
        const group = rig.group;
        group.position.set(p.pos.x, p.pos.y, p.pos.z);
        this.scene.add(group);
        entity = {
          rig,
          group,
          targetPos: new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z),
          targetYaw: p.yaw,
          state: p,
        };
        this.entities.set(p.id, entity);
      } else {
        entity.targetPos.set(p.pos.x, p.pos.y, p.pos.z);
        entity.targetYaw = p.yaw;
        entity.state = p;
      }

      for (const key of Object.keys(entity.rig.weaponMeshes) as WeaponType[]) {
        entity.rig.weaponMeshes[key].visible = key === p.weapon;
      }

      entity.group.visible = p.alive;
      entity.group.scale.y = p.crouching ? 0.72 : 1.0;
    }

    for (const [id, entity] of this.entities) {
      if (!activeIds.has(id)) {
        this.scene.remove(entity.group);
        this.entities.delete(id);
      }
    }
  }

  public removePlayer(id: string): void {
    const entity = this.entities.get(id);
    if (entity) {
      this.scene.remove(entity.group);
      this.entities.delete(id);
    }
  }

  public update(dt: number): void {
    const alpha = Math.min(1, dt * 15);
    for (const [, entity] of this.entities) {
      entity.group.position.lerp(entity.targetPos, alpha);
      entity.group.rotation.y = THREE.MathUtils.lerp(entity.group.rotation.y, entity.targetYaw, alpha);
    }
  }
}
