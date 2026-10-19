// ============================================================
// online.js — PeerJS 房间号联机（WebRTC P2P）
// ============================================================

const ID_PREFIX = 'geng-wang-brawl-';

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export class OnlineSession {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.code = null;
    this._cb = {};
  }

  on(ev, cb) {
    (this._cb[ev] = this._cb[ev] || []).push(cb);
  }
  emit(ev, ...args) {
    (this._cb[ev] || []).forEach(cb => cb(...args));
  }

  // ---------- 主机创建房间 ----------
  static create() {
    const s = new OnlineSession();
    s.isHost = true;
    s.code = genCode();
    s._initHost(s.code);
    return s;
  }

  _initHost(code) {
    const peer = new Peer(ID_PREFIX + code, { debug: 1 });
    this.peer = peer;
    peer.on('open', () => {
      this.code = code;
      this.emit('ready', code);
    });
    peer.on('connection', (conn) => {
      this.conn = conn;
      this._bindConn(conn);
      conn.on('open', () => this.emit('guest-joined'));
    });
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id' || String(err.type).includes('unavailable')) {
        // 房间号冲突，换一个
        this.code = genCode();
        try { peer.destroy(); } catch (e) {}
        this._initHost(this.code);
      } else {
        this.emit('error', err);
      }
    });
  }

  // ---------- 客机加入房间 ----------
  static join(code) {
    const s = new OnlineSession();
    s.isHost = false;
    s.code = code;
    const peer = new Peer({ debug: 1 });
    s.peer = peer;
    peer.on('open', () => {
      const conn = peer.connect(ID_PREFIX + code, { reliable: true });
      s.conn = conn;
      s._bindConn(conn);
      conn.on('open', () => s.emit('connected'));
      setTimeout(() => {
        if (!conn.open) s.emit('error', new Error('连接超时，房间可能不存在'));
      }, 12000);
    });
    peer.on('error', (err) => {
      let msg = '连接失败';
      if (err.type === 'peer-unavailable') msg = '找不到该房间，请核对房间号';
      else if (err.type === 'network') msg = '网络错误';
      this.emit('error', Object.assign(err, { friendly: msg }));
    });
    return s;
  }

  _bindConn(conn) {
    conn.on('data', (data) => this.emit('message', data));
    conn.on('close', () => this.emit('disconnected'));
    conn.on('error', (e) => this.emit('error', e));
  }

  send(data) {
    if (this.conn && this.conn.open) {
      try { this.conn.send(data); } catch (e) {}
    }
  }

  destroy() {
    try { this.conn?.close(); } catch (e) {}
    try { this.peer?.destroy(); } catch (e) {}
  }
}
