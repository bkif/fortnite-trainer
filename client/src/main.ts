import './index.css';
import * as THREE from 'three';
import {
  BUILD_COST,
  type ResourceType,
  type ServerMessage,
  type StormState,
  type WeaponType,
} from '../../shared/protocol';
import { AudioEngine } from './engine/AudioEngine';
import { InputManager } from './engine/InputManager';
import { WorldMap } from './engine/WorldMap';
import { BuildingSystem } from './building/BuildingSystem';
import { TracerPool } from './entities/TracerPool';
import { PlayerController } from './entities/PlayerController';
import { RemotePlayerManager } from './entities/RemotePlayerManager';
import { NetworkClient } from './network/NetworkClient';
import { HudManager } from './ui/HudManager';

const app = document.querySelector<HTMLDivElement>('#app')!;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1e293b, 0.0045);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 500);

const audio = new AudioEngine();
const input = new InputManager(renderer.domElement);
const worldMap = new WorldMap(scene);
const building = new BuildingSystem(scene, worldMap);
const tracers = new TracerPool(scene, 40);
const player = new PlayerController(scene, camera, input, worldMap, building);
const remotePlayers = new RemotePlayerManager(scene);

let stormState: StormState = {
  centerX: 0,
  centerZ: 0,
  radius: 120,
  targetRadius: 24,
  phase: 1,
  damagePerSecond: 2,
};

const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProtocol}//${window.location.hostname}:8080`;

const hud = new HudManager(
  app,
  () => input.requestLock(),
  () => {
    network.send({ type: 'respawn' });
    player.hp = 100;
    player.shield = 50;
    player.alive = true;
    player.pos.set(0, 4, 0);
    hud.setDead(false);
    input.requestLock();
  }
);

const network = new NetworkClient(wsUrl, (msg: ServerMessage) => {
  switch (msg.type) {
    case 'welcome':
      stormState = msg.storm;
      for (const s of msg.structures) building.addStructure(s);
      remotePlayers.syncPlayers(msg.players, msg.id);
      break;
    case 'snapshot':
      stormState = msg.storm;
      remotePlayers.syncPlayers(msg.players, network.clientId);
      break;
    case 'player_left':
      remotePlayers.removePlayer(msg.id);
      break;
    case 'fire_fx': {
      const start = new THREE.Vector3(msg.origin.x, msg.origin.y, msg.origin.z);
      const end = new THREE.Vector3(msg.hitPoint.x, msg.hitPoint.y, msg.hitPoint.z);
      tracers.spawn(start, end, msg.weapon === 'shotgun' ? 0xf97316 : 0xfef08a);
      break;
    }
    case 'hit_confirm':
      audio.playHitmarker(msg.eliminated);
      hud.showHitmarker(msg.eliminated);
      hud.showFloatingText(`-${msg.damage}`, msg.eliminated ? 'text-red-400' : 'text-white');
      break;
    case 'structure_placed':
      building.addStructure(msg.piece);
      break;
    case 'structure_updated':
      building.updateStructureHp(msg.id, msg.hp);
      break;
    case 'structure_destroyed':
      building.removeStructure(msg.id);
      break;
    case 'kill_feed':
      hud.addKillFeed(msg.entry);
      break;
    case 'player_damaged':
      player.hp = msg.hp;
      player.shield = msg.shield;
      if (player.hp <= 0) {
        player.alive = false;
        hud.setDead(true);
        document.exitPointerLock?.();
      }
      break;
  }
});

network.connect();

// Hotkeys
const materials: ResourceType[] = ['wood', 'brick', 'metal'];
let matIdx = 0;

input.onKeyPress((code) => {
  if (!input.isLocked) return;

  const selectWeapon = (w: WeaponType) => {
    player.activeWeapon = w;
    player.reloading = false;
    building.buildMode = false;
  };

  if (code === 'Digit1') selectWeapon('pickaxe');
  else if (code === 'Digit2') selectWeapon('ar');
  else if (code === 'Digit3') selectWeapon('shotgun');
  else if (code === 'KeyZ' || code === 'KeyQ' || code === 'F1') building.setBlueprint('wall');
  else if (code === 'KeyX' || code === 'F2') building.setBlueprint('floor');
  else if (code === 'KeyC' || code === 'F3') building.setBlueprint('ramp');
  else if (code === 'KeyV' || code === 'F4') building.setBlueprint('pyramid');
  else if (code === 'KeyG' || code === 'KeyB') {
    if (building.editMode) {
      const res = building.confirmEdit();
      if (res) network.send({ type: 'edit_structure', id: res.id, editVariant: res.editVariant });
    }
    building.buildMode = !building.buildMode;
  } else if (code === 'KeyE') {
    if (building.editMode) {
      const res = building.confirmEdit();
      if (res) {
        network.send({ type: 'edit_structure', id: res.id, editVariant: res.editVariant });
        audio.playBuild();
      }
    } else {
      raycaster.set(player.getMuzzleOrigin(), player.getCameraForward());
      raycaster.far = 7.5;
      const hits = raycaster.intersectObjects(building.structureMeshes, false);
      if (hits.length > 0) {
        const structId = hits[0].object.userData.structureId as string | undefined;
        if (structId && building.startEdit(structId)) {
          audio.playBuild();
        }
      }
    }
  } else if (code === 'KeyR') {
    if (building.editMode) {
      building.cycleEditVariant();
      audio.playBuild();
    } else if (building.buildMode) {
      building.rotateBlueprint();
    } else {
      player.startReload();
      audio.playReload();
    }
  } else if (code === 'Tab') {
    matIdx = (matIdx + 1) % materials.length;
    building.activeMaterial = materials[matIdx];
    hud.showFloatingText(`MATERIAL: ${building.activeMaterial.toUpperCase()}`, 'text-cyan-300');
  }
});

input.onMouseClick((button) => {
  if (!input.isLocked || !building.editMode) return;
  if (button === 0) {
    building.cycleEditVariant();
    audio.playBuild();
  } else if (button === 2) {
    building.resetEdit();
    audio.playBuild();
  }
});

const raycaster = new THREE.Raycaster();

function performFireOrBuild(): void {
  if (!player.alive || !input.isLocked || building.editMode) return;

  if (building.buildMode) {
    if (player.fireCooldown > 0) return;
    const mat = building.activeMaterial;
    if (!building.isValidPlacement || player.resources[mat] < BUILD_COST) return;

    player.resources[mat] -= BUILD_COST;
    player.fireCooldown = 0.14;
    audio.playBuild();

    const { gx, gy, gz } = building.currentGridPos;
    const rotY = building.getCurrentRotation();

    if (network.connected) {
      network.send({
        type: 'build',
        pieceType: building.activeType,
        material: mat,
        gx,
        gy,
        gz,
        rotY,
      });
    } else {
      const id = `${building.activeType}:${gx}:${gy}:${gz}`;
      building.addStructure({
        id,
        type: building.activeType,
        material: mat,
        gx,
        gy,
        gz,
        rotY,
        hp: 150,
        maxHp: 150,
        ownerId: 'local',
      });
    }
    return;
  }

  // Weapon / Pickaxe
  if (player.fireCooldown > 0 || player.reloading) return;
  const w = player.weapons[player.activeWeapon];

  if (player.activeWeapon !== 'pickaxe') {
    if (w.ammo <= 0) {
      player.startReload();
      audio.playReload();
      return;
    }
    w.ammo -= 1;
  }

  player.fireCooldown = w.fireRate;
  const origin = player.getMuzzleOrigin();
  const forward = player.getCameraForward();

  if (player.activeWeapon === 'pickaxe') {
    // Check harvest nodes within 3.8m
    let hitSomething = false;
    for (const node of worldMap.harvestNodes) {
      if (!node.alive) continue;
      const toNode = node.pos.clone().sub(origin);
      const dist = toNode.length();
      if (dist <= 3.8 && toNode.normalize().dot(forward) > 0.65) {
        const isWeakPoint = Math.random() < 0.35;
        const dmg = isWeakPoint ? 50 : 25;
        const gain = isWeakPoint ? 24 : 12;
        worldMap.damageHarvestNode(node, dmg);
        player.resources[node.type] += gain;
        hud.showFloatingText(`+${gain} ${node.type.toUpperCase()}${isWeakPoint ? ' CRIT!' : ''}`, 'text-amber-300');
        hitSomething = true;
        break;
      }
    }
    audio.playPickaxe(hitSomething);
    network.send({ type: 'fire', origin, dir: forward, weapon: 'pickaxe' });
    return;
  }

  // Gunfire (AR or Shotgun)
  audio.playGunshot(player.activeWeapon);
  player.pitch = Math.min(1.25, player.pitch + w.recoil);
  player.bloom = Math.min(0.08, player.bloom + w.spread * 0.5);

  const pellets = player.activeWeapon === 'shotgun' ? 5 : 1;
  for (let i = 0; i < pellets; i++) {
    const spread = w.spread + player.bloom;
    const dir = forward
      .clone()
      .add(
        new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread
        )
      )
      .normalize();

    raycaster.set(origin, dir);
    raycaster.far = player.activeWeapon === 'shotgun' ? 35 : 140;

    let hitPoint = origin.clone().addScaledVector(dir, raycaster.far);
    const structHits = raycaster.intersectObjects(building.structureMeshes, false);
    if (structHits.length > 0) {
      hitPoint = structHits[0].point;
      const structId = structHits[0].object.userData.structureId as string | undefined;
      if (structId) {
        network.send({ type: 'damage_structure', id: structId, damage: player.activeWeapon === 'shotgun' ? 12 : 22 });
      }
    }

    tracers.spawn(origin, hitPoint, player.activeWeapon === 'shotgun' ? 0xf97316 : 0xfef08a);
    network.send({ type: 'fire', origin, dir, weapon: player.activeWeapon });
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let lastTime = performance.now();
let netAccum = 0;

function animate(now: number): void {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const elapsed = now / 1000;

  hud.setLocked(input.isLocked);

  if (input.mouseDown) {
    if (building.editMode) {
      raycaster.set(player.getMuzzleOrigin(), player.getCameraForward());
      raycaster.far = 8.5;
      if (building.selectEditTileAtRay(raycaster)) {
        audio.playBuild();
      }
    } else {
      performFireOrBuild();
    }
  }

  player.update(dt);
  remotePlayers.update(dt);
  tracers.update(dt);
  building.updatePreview(player.pos, player.getCameraForward(), elapsed);
  worldMap.updateStorm(stormState.centerX, stormState.centerZ, stormState.radius, elapsed);

  // Throttled 20 Hz network state sync
  netAccum += dt;
  if (netAccum >= 0.05) {
    netAccum = 0;
    network.send({
      type: 'state',
      pos: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
      yaw: player.yaw,
      pitch: player.pitch,
      weapon: player.activeWeapon,
      crouching: player.crouching,
    });
  }

  // Update HUD
  const w = player.weapons[player.activeWeapon];
  hud.updateVitals(player.hp, player.shield);
  hud.updateResources(player.resources);
  hud.updateWeapon(
    player.activeWeapon,
    w.name,
    w.ammo,
    w.reserve,
    player.reloading,
    building.buildMode,
    building.activeType,
    player.bloom
  );
  const distFromStormCenter = Math.hypot(player.pos.x - stormState.centerX, player.pos.z - stormState.centerZ);
  hud.updateStorm(stormState.phase, distFromStormCenter, stormState.radius);

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
