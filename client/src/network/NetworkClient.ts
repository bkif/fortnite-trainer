import type { ClientMessage, ServerMessage } from '../../../shared/protocol';

export class NetworkClient {
  private ws: WebSocket | null = null;
  public clientId: string | null = null;
  public connected = false;

  constructor(private url: string, private onMessage: (msg: ServerMessage) => void) {}

  public connect(): void {
    try {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => {
        this.connected = true;
        this.send({ type: 'join', name: `Trooper_${Math.floor(100 + Math.random() * 899)}` });
      };
      this.ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as ServerMessage;
          if (msg.type === 'welcome') {
            this.clientId = msg.id;
          }
          this.onMessage(msg);
        } catch {
          // ignore
        }
      };
      this.ws.onclose = () => {
        this.connected = false;
      };
      this.ws.onerror = () => {
        this.connected = false;
      };
    } catch {
      this.connected = false;
    }
  }

  public send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
