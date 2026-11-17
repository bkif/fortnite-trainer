import { WebSocketServer, WebSocket } from 'ws';
import type {
  ClientMessage,
  ServerMessage,
  PlayerState,
  StructurePiece,
  StormState,
  Vec3,
  WeaponType,
  ResourceType,
  StructureType,
} from '../../shared/protocol.js';

const PORT = Number(process.env.PORT ?? 8080);
const TICK_RATE_MS = 50; // 20 Hz

interface ConnectedClient {
  ws: WebSocket;
  player: PlayerState;
}

const clients = new Map<string, ConnectedClient>();
const structures = new Map<string, StructurePiece>();

const storm: StormState = {
  centerX: 0,
  centerZ: 0,
  radius: 120,
  targetRadius: 24,
  phase: 1,
  damagePerSecond: 2,
};

let nextId = 1;
function genId(prefix: string): string {
  return `${prefix}_${nextId++}_${Math.random().toString(36).slice(2, 6)}`;
}

function randomSpawn(): Vec3 {
  const angle = Math.random() * Math.PI * 2;
  const dist = 12 + Math.random() * 28;
  return {
    x: Math.cos(angle) * dist,
    y: 4,
    z: Math.sin(angle) * dist,
  };
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(msg: ServerMessage, excludeId?: string): void {
  const data = JSON.stringify(msg);
  for (const [id, client] of clients) {
    if (id !== excludeId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

function getMaterialMaxHp(material: ResourceType): number {
  switch (material) {
    case 'wood':
      return 150;
    case 'brick':
      return 250;
    case 'metal':
      return 400;
  }
}

function getWeaponDamage(weapon: WeaponType): number {
  switch (weapon) {
    case 'ar':
      return 24;
    case 'shotgun':
      return 18; // per pellet or burst
    case 'pickaxe':
      return 20;
  }
}

function raySphereIntersect(origin: Vec3, dir: Vec3, center: Vec3, radius: number): number | null {
  const ocX = origin.x - center.x;
  const ocY = origin.y - center.y;
  const ocZ = origin.z - center.z;
  const b = ocX * dir.x + ocY * dir.y + ocZ * dir.z;
  const c = ocX * ocX + ocY * ocY + ocZ * ocZ - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}

function applyDamage(victim: PlayerState, amount: number, killerName: string, weapon: WeaponType | 'storm'): boolean {
  if (!victim.alive) return false;
  let remaining = amount;
  if (victim.shield > 0) {
    const absorbed = Math.min(victim.shield, remaining);
    victim.shield -= absorbed;
    remaining -= absorbed;
  }
  if (remaining > 0) {
    victim.hp = Math.max(0, victim.hp - remaining);
  }

  const victimClient = clients.get(victim.id);
  if (victimClient) {
    send(victimClient.ws, { type: 'player_damaged', hp: victim.hp, shield: victim.shield });
  }

  if (victim.hp <= 0) {
    victim.alive = false;
    broadcast({
      type: 'kill_feed',
      entry: {
        id: genId('kf'),
        killer: killerName,
        victim: victim.name,
        weapon,
        timestamp: Date.now(),
      },
    });
    return true;
  }
  return false;
}

function handleFire(shooter: PlayerState, origin: Vec3, dir: Vec3, weapon: WeaponType): void {
  if (!shooter.alive) return;

  // Normalize direction
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const ndir: Vec3 = { x: dir.x / len, y: dir.y / len, z: dir.z / len };
  const maxDist = weapon === 'pickaxe' ? 3.5 : weapon === 'shotgun' ? 35 : 140;

  let closestDist = maxDist;
  let hitPlayer: PlayerState | null = null;

  for (const [, other] of clients) {
    if (other.player.id === shooter.id || !other.player.alive) continue;
    const center: Vec3 = {
      x: other.player.pos.x,
      y: other.player.pos.y + 1.0,
      z: other.player.pos.z,
    };
    const t = raySphereIntersect(origin, ndir, center, 0.75);
    if (t !== null && t < closestDist) {
      closestDist = t;
      hitPlayer = other.player;
    }
  }

  const hitPoint: Vec3 = {
    x: origin.x + ndir.x * closestDist,
    y: origin.y + ndir.y * closestDist,
    z: origin.z + ndir.z * closestDist,
  };

  broadcast({
    type: 'fire_fx',
    shooterId: shooter.id,
    origin,
    hitPoint,
    weapon,
  }, shooter.id);

  if (hitPlayer) {
    const dmg = getWeaponDamage(weapon);
    const eliminated = applyDamage(hitPlayer, dmg, shooter.name, weapon);
    if (eliminated) {
      shooter.kills += 1;
    }
    const shooterClient = clients.get(shooter.id);
    if (shooterClient) {
      send(shooterClient.ws, {
        type: 'hit_confirm',
        targetType: 'player',
        damage: dmg,
        eliminated,
      });
    }
  }
}

function handleBuild(
  builder: PlayerState,
  pieceType: StructureType,
  material: ResourceType,
  gx: number,
  gy: number,
  gz: number,
  rotY: number
): void {
  if (!builder.alive) return;
  const key = `${pieceType}:${gx}:${gy}:${gz}`;
  if (structures.has(key)) return;

  const maxHp = getMaterialMaxHp(material);
  const piece: StructurePiece = {
    id: key,
    type: pieceType,
    material,
    gx,
    gy,
    gz,
    rotY: ((rotY % 4) + 4) % 4,
    hp: maxHp,
    maxHp,
    ownerId: builder.id,
  };
  structures.set(key, piece);
  broadcast({ type: 'structure_placed', piece });
}

function handleDamageStructure(id: string, damage: number): void {
  const piece = structures.get(id);
  if (!piece) return;
  piece.hp = Math.max(0, piece.hp - damage);
  if (piece.hp <= 0) {
    structures.delete(id);
    broadcast({ type: 'structure_destroyed', id });
  } else {
    broadcast({ type: 'structure_updated', id, hp: piece.hp });
  }
}

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  const id = genId('p');
  const player: PlayerState = {
    id,
    name: `Player_${id.slice(2, 6)}`,
    pos: randomSpawn(),
    yaw: 0,
    pitch: 0,
    hp: 100,
    shield: 50,
    weapon: 'ar',
    crouching: false,
    alive: true,
    kills: 0,
  };

  clients.set(id, { ws, player });

  send(ws, {
    type: 'welcome',
    id,
    players: Array.from(clients.values()).map((c) => c.player),
    structures: Array.from(structures.values()),
    storm,
  });

  broadcast({ type: 'player_joined', player }, id);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as ClientMessage;
      switch (msg.type) {
        case 'join':
          player.name = msg.name.slice(0, 16) || player.name;
          break;
        case 'state':
          player.pos = msg.pos;
          player.yaw = msg.yaw;
          player.pitch = msg.pitch;
          player.weapon = msg.weapon;
          player.crouching = msg.crouching;
          break;
        case 'fire':
          handleFire(player, msg.origin, msg.dir, msg.weapon);
          break;
        case 'build':
          handleBuild(player, msg.pieceType, msg.material, msg.gx, msg.gy, msg.gz, msg.rotY);
          break;
        case 'edit_structure': {
          const piece = structures.get(msg.id);
          if (piece) {
            piece.editVariant = msg.editVariant;
            broadcast({ type: 'structure_edited', id: msg.id, editVariant: msg.editVariant });
          }
          break;
        }
        case 'damage_structure':
          handleDamageStructure(msg.id, msg.damage);
          break;
        case 'respawn':
          player.pos = randomSpawn();
          player.hp = 100;
          player.shield = 50;
          player.alive = true;
          break;
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on('close', () => {
    clients.delete(id);
    broadcast({ type: 'player_left', id });
  });
});

// Authoritative 20 Hz simulation & snapshot loop
let lastTick = Date.now();
let stormDamageAccum = 0;

setInterval(() => {
  const now = Date.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;

  // Shrink storm smoothly
  if (storm.radius > storm.targetRadius) {
    storm.radius = Math.max(storm.targetRadius, storm.radius - 1.2 * dt);
  } else {
    // Reset storm cycle when it reaches minimum
    storm.radius = 120;
    storm.phase += 1;
  }

  // Storm tick damage every 1 second
  stormDamageAccum += dt;
  if (stormDamageAccum >= 1.0) {
    stormDamageAccum -= 1.0;
    for (const [, client] of clients) {
      const p = client.player;
      if (!p.alive) continue;
      const dist = Math.hypot(p.pos.x - storm.centerX, p.pos.z - storm.centerZ);
      if (dist > storm.radius) {
        applyDamage(p, storm.damagePerSecond, 'THE STORM', 'storm');
      }
    }
  }

  if (clients.size > 0) {
    broadcast({
      type: 'snapshot',
      time: now,
      players: Array.from(clients.values()).map((c) => c.player),
      storm,
    });
  }
}, TICK_RATE_MS);

console.log(`[Server] Authoritative WS server listening on ws://localhost:${PORT}`);
