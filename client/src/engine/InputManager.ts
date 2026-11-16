export class InputManager {
  public keys = new Set<string>();
  public mouseDeltaX = 0;
  public mouseDeltaY = 0;
  public mouseDown = false;
  public rightMouseDown = false;
  public isLocked = false;

  private onKeyDownCallbacks: Array<(code: string) => void> = [];
  private onMouseDownCallbacks: Array<(button: number) => void> = [];

  constructor(private target: HTMLElement) {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
  }

  public requestLock(): void {
    if (!this.isLocked) {
      this.target.requestPointerLock?.();
    }
  }

  public onKeyPress(cb: (code: string) => void): void {
    this.onKeyDownCallbacks.push(cb);
  }

  public onMouseClick(cb: (button: number) => void): void {
    this.onMouseDownCallbacks.push(cb);
  }

  public consumeMouseDelta(): { dx: number; dy: number } {
    const dx = this.mouseDeltaX;
    const dy = this.mouseDeltaY;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return { dx, dy };
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.keys.has(e.code)) {
      this.keys.add(e.code);
      for (const cb of this.onKeyDownCallbacks) cb(e.code);
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.isLocked) return;
    this.mouseDeltaX += e.movementX;
    this.mouseDeltaY += e.movementY;
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (!this.isLocked) return;
    if (e.button === 0) this.mouseDown = true;
    if (e.button === 2) this.rightMouseDown = true;
    for (const cb of this.onMouseDownCallbacks) cb(e.button);
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseDown = false;
    if (e.button === 2) this.rightMouseDown = false;
  };

  private handlePointerLockChange = (): void => {
    this.isLocked = document.pointerLockElement === this.target;
    if (!this.isLocked) {
      this.keys.clear();
      this.mouseDown = false;
      this.rightMouseDown = false;
    }
  };

  public dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
  }
}
