import type { KillFeedEntry, ResourceType, StructureType, WeaponType } from '../../../shared/protocol';

export class HudManager {
  private root: HTMLElement;
  private hpBar!: HTMLElement;
  private shieldBar!: HTMLElement;
  private hpText!: HTMLElement;
  private shieldText!: HTMLElement;
  private ammoText!: HTMLElement;
  private weaponLabel!: HTMLElement;
  private woodText!: HTMLElement;
  private brickText!: HTMLElement;
  private metalText!: HTMLElement;
  private reticle!: HTMLElement;
  private killFeedEl!: HTMLElement;
  private stormInfoEl!: HTMLElement;
  private lockOverlay!: HTMLElement;
  private deadOverlay!: HTMLElement;
  private slotEls: HTMLElement[] = [];
  private buildBadge!: HTMLElement;
  private fxLayer!: HTMLElement;

  constructor(container: HTMLElement, onRequestLock: () => void, onRespawn: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'fixed inset-0 pointer-events-none z-10 flex flex-col justify-between p-5';
    this.root.innerHTML = `
      <!-- Top Bar -->
      <div class="flex justify-between items-start">
        <div class="bg-slate-950/80 border-l-4 border-purple-500 px-3.5 py-2 backdrop-blur-sm">
          <div class="text-[10px] tracking-[0.2em] text-purple-400 font-bold uppercase">STORM PHASE</div>
          <div id="hud-storm" class="text-sm font-black tracking-wider text-white">PHASE 1 // SAFE</div>
        </div>
        <div id="hud-killfeed" class="flex flex-col gap-1.5 items-end max-w-xs"></div>
      </div>

      <!-- Center Reticle & FX -->
      <div id="hud-fx" class="fixed inset-0 pointer-events-none"></div>
      <div id="hud-reticle" class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-75">
        <div class="relative w-6 h-6">
          <div class="absolute left-1/2 -translate-x-1/2 top-0 w-0.5 h-1.5 bg-white/90 shadow"></div>
          <div class="absolute left-1/2 -translate-x-1/2 bottom-0 w-0.5 h-1.5 bg-white/90 shadow"></div>
          <div class="absolute top-1/2 -translate-y-1/2 left-0 h-0.5 w-1.5 bg-white/90 shadow"></div>
          <div class="absolute top-1/2 -translate-y-1/2 right-0 h-0.5 w-1.5 bg-white/90 shadow"></div>
          <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-cyan-400 rounded-full"></div>
        </div>
      </div>

      <!-- Bottom Bar -->
      <div class="flex justify-between items-end gap-4">
        <!-- HP & Shield -->
        <div class="w-72 bg-slate-950/85 border border-slate-700/80 p-3 backdrop-blur-sm hud-skew">
          <div class="hud-unskew">
            <div class="flex justify-between text-xs font-bold tracking-wider mb-1">
              <span class="text-cyan-400">SHIELD</span>
              <span id="hud-shield-text" class="text-cyan-300">50 / 100</span>
            </div>
            <div class="h-2.5 bg-slate-800 mb-2.5 overflow-hidden">
              <div id="hud-shield-bar" class="h-full bg-cyan-400 transition-all duration-150" style="width: 50%"></div>
            </div>
            <div class="flex justify-between text-xs font-bold tracking-wider mb-1">
              <span class="text-emerald-400">HEALTH</span>
              <span id="hud-hp-text" class="text-emerald-300">100 / 100</span>
            </div>
            <div class="h-3 bg-slate-800 overflow-hidden">
              <div id="hud-hp-bar" class="h-full bg-emerald-500 transition-all duration-150" style="width: 100%"></div>
            </div>
          </div>
        </div>

        <!-- Center Ammo & Build Badge -->
        <div class="flex flex-col items-center gap-2">
          <div id="hud-build-badge" class="hidden px-3 py-1 bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-xs font-black tracking-widest uppercase">
            BUILD MODE: WALL [R: ROTATE]
          </div>
          <div class="bg-slate-950/85 border border-slate-700/80 px-5 py-2 flex items-center gap-4">
            <span id="hud-weapon-label" class="text-xs font-black tracking-widest text-slate-300">ASSAULT RIFLE</span>
            <span id="hud-ammo-text" class="text-xl font-black tracking-tight text-amber-400">30 / 150</span>
          </div>
        </div>

        <!-- Right: Resources + 5-Slot Hotbar -->
        <div class="flex flex-col items-end gap-2">
          <div class="flex gap-2">
            <div class="bg-slate-950/85 border border-amber-700/60 px-3 py-1.5 text-center min-w-[68px]">
              <div class="text-[10px] font-bold text-amber-400 tracking-wider">WOOD</div>
              <div id="hud-wood" class="text-sm font-black text-white">150</div>
            </div>
            <div class="bg-slate-950/85 border border-red-700/60 px-3 py-1.5 text-center min-w-[68px]">
              <div class="text-[10px] font-bold text-red-400 tracking-wider">BRICK</div>
              <div id="hud-brick" class="text-sm font-black text-white">100</div>
            </div>
            <div class="bg-slate-950/85 border border-slate-500/60 px-3 py-1.5 text-center min-w-[68px]">
              <div class="text-[10px] font-bold text-slate-300 tracking-wider">METAL</div>
              <div id="hud-metal" class="text-sm font-black text-white">100</div>
            </div>
          </div>

          <div class="flex gap-1.5">
            <div data-slot="0" class="w-14 h-14 bg-slate-950/85 border border-slate-700 flex flex-col items-center justify-center">
              <span class="text-[10px] text-slate-400 font-bold">1</span>
              <span class="text-[11px] font-black text-white">AXE</span>
            </div>
            <div data-slot="1" class="w-14 h-14 bg-slate-950/85 border-2 border-cyan-400 flex flex-col items-center justify-center">
              <span class="text-[10px] text-cyan-400 font-bold">2</span>
              <span class="text-[11px] font-black text-white">AR</span>
            </div>
            <div data-slot="2" class="w-14 h-14 bg-slate-950/85 border border-slate-700 flex flex-col items-center justify-center">
              <span class="text-[10px] text-slate-400 font-bold">3</span>
              <span class="text-[11px] font-black text-white">PUMP</span>
            </div>
            <div data-slot="3" class="w-14 h-14 bg-slate-950/85 border border-slate-700 flex flex-col items-center justify-center">
              <span class="text-[10px] text-slate-400 font-bold">Z-V</span>
              <span class="text-[11px] font-black text-cyan-300">BUILD</span>
            </div>
            <div data-slot="4" class="w-14 h-14 bg-slate-950/85 border border-slate-700 flex flex-col items-center justify-center">
              <span class="text-[10px] text-slate-400 font-bold">TAB</span>
              <span class="text-[11px] font-black text-amber-300">MAT</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Pointer Lock Overlay -->
      <div id="hud-lock-overlay" class="fixed inset-0 bg-slate-950/75 backdrop-blur-sm pointer-events-auto flex flex-col items-center justify-center z-20">
        <div class="border-2 border-cyan-400 bg-slate-900/95 p-8 max-w-md text-center shadow-2xl">
          <h1 class="text-3xl font-black tracking-tight text-white mb-2">APEX BUILD // TPS</h1>
          <p class="text-xs text-slate-300 tracking-wider uppercase mb-6">Tactical Third-Person Shooter &amp; Grid Building</p>
          <div class="grid grid-cols-2 gap-2 text-left text-xs text-slate-300 mb-6 bg-slate-950/80 p-3 border border-slate-800">
            <div><span class="text-cyan-400 font-bold">WASD</span> Move</div>
            <div><span class="text-cyan-400 font-bold">SHIFT / SPACE</span> Sprint / Jump</div>
            <div><span class="text-cyan-400 font-bold">1 / 2 / 3</span> Pickaxe / AR / Pump</div>
            <div><span class="text-cyan-400 font-bold">Z, X, C, V</span> Wall / Floor / Ramp / Roof</div>
            <div><span class="text-cyan-400 font-bold">R / TAB</span> Reload-Rotate / Material</div>
            <div><span class="text-cyan-400 font-bold">LMB</span> Fire / Harvest / Place</div>
          </div>
          <button id="btn-play" class="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black tracking-widest uppercase transition-colors cursor-pointer">
            CLICK TO DEPLOY
          </button>
        </div>
      </div>

      <!-- Eliminated Overlay -->
      <div id="hud-dead-overlay" class="hidden fixed inset-0 bg-red-950/70 backdrop-blur-sm pointer-events-auto flex flex-col items-center justify-center z-30">
        <div class="border-2 border-red-500 bg-slate-950/95 p-8 text-center">
          <h2 class="text-3xl font-black text-red-500 tracking-widest mb-2">ELIMINATED</h2>
          <p class="text-xs text-slate-400 mb-6">YOU WERE TAKEN OUT IN THE ARENA</p>
          <button id="btn-respawn" class="px-8 py-3 bg-red-500 hover:bg-red-400 text-white font-black tracking-widest uppercase cursor-pointer">
            REDEPLOY
          </button>
        </div>
      </div>
    `;

    container.appendChild(this.root);

    this.hpBar = this.root.querySelector('#hud-hp-bar')!;
    this.shieldBar = this.root.querySelector('#hud-shield-bar')!;
    this.hpText = this.root.querySelector('#hud-hp-text')!;
    this.shieldText = this.root.querySelector('#hud-shield-text')!;
    this.ammoText = this.root.querySelector('#hud-ammo-text')!;
    this.weaponLabel = this.root.querySelector('#hud-weapon-label')!;
    this.woodText = this.root.querySelector('#hud-wood')!;
    this.brickText = this.root.querySelector('#hud-brick')!;
    this.metalText = this.root.querySelector('#hud-metal')!;
    this.reticle = this.root.querySelector('#hud-reticle')!;
    this.killFeedEl = this.root.querySelector('#hud-killfeed')!;
    this.stormInfoEl = this.root.querySelector('#hud-storm')!;
    this.lockOverlay = this.root.querySelector('#hud-lock-overlay')!;
    this.deadOverlay = this.root.querySelector('#hud-dead-overlay')!;
    this.buildBadge = this.root.querySelector('#hud-build-badge')!;
    this.fxLayer = this.root.querySelector('#hud-fx')!;
    this.slotEls = Array.from(this.root.querySelectorAll('[data-slot]'));

    this.root.querySelector('#btn-play')!.addEventListener('click', onRequestLock);
    this.root.querySelector('#btn-respawn')!.addEventListener('click', onRespawn);
  }

  public setLocked(locked: boolean): void {
    this.lockOverlay.classList.toggle('hidden', locked);
  }

  public setDead(dead: boolean): void {
    this.deadOverlay.classList.toggle('hidden', !dead);
  }

  public updateVitals(hp: number, shield: number): void {
    this.hpBar.style.width = `${Math.max(0, Math.min(100, hp))}%`;
    this.shieldBar.style.width = `${Math.max(0, Math.min(100, shield))}%`;
    this.hpText.textContent = `${Math.ceil(hp)} / 100`;
    this.shieldText.textContent = `${Math.ceil(shield)} / 100`;
  }

  public updateResources(res: Record<ResourceType, number>): void {
    this.woodText.textContent = String(res.wood);
    this.brickText.textContent = String(res.brick);
    this.metalText.textContent = String(res.metal);
  }

  public updateWeapon(
    weapon: WeaponType,
    name: string,
    ammo: number,
    reserve: number,
    reloading: boolean,
    buildMode: boolean,
    buildType: StructureType,
    bloom: number
  ): void {
    this.weaponLabel.textContent = name;
    this.ammoText.textContent = weapon === 'pickaxe' ? '∞' : reloading ? 'RELOADING...' : `${ammo} / ${reserve}`;

    this.buildBadge.classList.toggle('hidden', !buildMode);
    if (buildMode) {
      this.buildBadge.textContent = `BUILD MODE: ${buildType.toUpperCase()} [R: ROTATE]`;
    }

    const activeIdx = buildMode ? 3 : weapon === 'pickaxe' ? 0 : weapon === 'ar' ? 1 : 2;
    this.slotEls.forEach((el, idx) => {
      el.classList.toggle('border-2', idx === activeIdx);
      el.classList.toggle('border-cyan-400', idx === activeIdx);
      el.classList.toggle('border', idx !== activeIdx);
      el.classList.toggle('border-slate-700', idx !== activeIdx);
    });

    const scale = 1 + bloom * 14;
    this.reticle.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(2)})`;
  }

  public updateStorm(phase: number, distFromCenter: number, radius: number): void {
    const inStorm = distFromCenter > radius;
    this.stormInfoEl.textContent = inStorm
      ? `PHASE ${phase} // IN STORM (${Math.ceil(distFromCenter - radius)}m)`
      : `PHASE ${phase} // SAFE (${Math.ceil(radius - distFromCenter)}m)`;
    this.stormInfoEl.className = inStorm
      ? 'text-sm font-black tracking-wider text-fuchsia-400 animate-pulse'
      : 'text-sm font-black tracking-wider text-white';
  }

  public showHitmarker(eliminated = false): void {
    const el = document.createElement('div');
    el.className = `fixed left-1/2 top-1/2 w-5 h-5 border-2 ${
      eliminated ? 'border-red-500' : 'border-white'
    } rotate-45 animate-hitmarker`;
    this.fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 200);
  }

  public showFloatingText(text: string, colorClass = 'text-amber-300'): void {
    const el = document.createElement('div');
    el.className = `fixed left-1/2 top-[44%] text-sm font-black tracking-wider ${colorClass} animate-float-up`;
    el.textContent = text;
    this.fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 650);
  }

  public addKillFeed(entry: KillFeedEntry): void {
    const el = document.createElement('div');
    el.className = 'bg-slate-950/85 border-r-4 border-red-500 px-3 py-1 text-xs font-bold text-slate-200';
    el.textContent = `${entry.killer} [${entry.weapon.toUpperCase()}] ${entry.victim}`;
    this.killFeedEl.prepend(el);
    while (this.killFeedEl.children.length > 4) {
      this.killFeedEl.lastElementChild?.remove();
    }
    setTimeout(() => el.remove(), 6000);
  }
}
