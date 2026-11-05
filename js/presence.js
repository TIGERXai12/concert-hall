// Realtime presence over public MQTT (WebSocket). No accounts. Page works alone if broker unreachable.
import * as THREE from 'three';
import mqttMod from '../vendor/mqtt.esm.js';
import { makeChibi, randomLook } from './audience.js?v=17';
const mqtt = mqttMod.connect ? mqttMod : mqttMod.default;

const NS = 'concert-hall/tigerxai12/v1/presence/';
const qsBroker = new URLSearchParams(location.search).get('broker');
const BROKERS = qsBroker ? [qsBroker] : ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const MAX = 450, EXPIRE = 15000;

export function createPresence(scene, seats, { getSelf, onCount, onSeatsChanged }) {
  const id = Math.random().toString(36).slice(2, 10);
  const look = randomLook();
  const others = new Map(); // id -> {g, state, last, target}
  let client = null, bi = 0, lastSent = '', lastSendAt = 0;

  function count() { onCount && onCount(others.size + 1); }
  function remove(oid) {
    const o = others.get(oid); if (!o) return;
    scene.remove(o.g); others.delete(oid); count(); onSeatsChanged && onSeatsChanged();
  }
  function handle(topic, buf) {
    const oid = topic.slice(NS.length);
    if (oid === id) return;
    const txt = buf.toString();
    if (!txt) return remove(oid);
    let s; try { s = JSON.parse(txt); } catch { return; }
    if (!s || typeof s !== 'object') return;
    let o = others.get(oid);
    if (!o) {
      if (others.size >= MAX) return;
      const lk = s.look || {};
      const safe = (v, d) => (Number.isFinite(v) ? v : d);
      o = { g: makeChibi({ shirt: safe(lk.shirt, 0x4f8fe8), hair: safe(lk.hair, 0x1a1a1a), skin: safe(lk.skin, 0xffe0c7), bun: !!lk.bun }), state: {}, phase: Math.random() * 6 };
      o.g.matrixAutoUpdate = true;
      scene.add(o.g); others.set(oid, o); count();
    }
    const prevSeat = o.state.seat;
    o.state = s; o.last = Date.now();
    if (prevSeat !== s.seat) onSeatsChanged && onSeatsChanged();
  }

  function connect() {
    const url = BROKERS[bi % BROKERS.length];
    let connected = false;
    try {
      client = mqtt.connect(url, {
        clientId: 'ch_' + id, connectTimeout: 8000, reconnectPeriod: 0, keepalive: 30, clean: true,
        will: { topic: NS + id, payload: '', qos: 0, retain: false },
      });
    } catch (e) { console.warn('presence disabled', e); return; }
    client.on('connect', () => {
      connected = true;
      client.subscribe(NS + '+');
      publish(true);
    });
    client.on('message', handle);
    client.on('error', (e) => console.warn('presence:', e && e.message));
    client.on('close', () => {
      const wasConnected = connected; connected = false;
      try { client.end(true); } catch {}
      if (!wasConnected) bi++;
      setTimeout(connect, wasConnected ? 3000 : 8000);
    });
  }

  function publish(force) {
    if (!client || !client.connected) return;
    const s = getSelf();
    const st = { look, seat: s.seat, x: +s.x.toFixed(2), y: +s.y.toFixed(2), z: +s.z.toFixed(2), yaw: +s.yaw.toFixed(2) };
    const key = JSON.stringify(st);
    const now = Date.now();
    if (!force && key === lastSent && now - lastSendAt < 5000) return;
    if (!force && key !== lastSent && now - lastSendAt < 250) return; // ~4Hz while moving
    lastSent = key; lastSendAt = now;
    client.publish(NS + id, key, { qos: 0, retain: false });
  }

  const tmp = new THREE.Vector3();
  function update(t) {
    publish(false);
    const now = Date.now();
    for (const [oid, o] of others) {
      if (now - o.last > EXPIRE) { remove(oid); continue; }
      const s = o.state;
      const seat = Number.isInteger(s.seat) ? seats[s.seat] : null;
      if (seat) {
        o.g.userData.setPose('sit');
        seat.getWorldPosition(o.g.position);
        o.g.quaternion.copy(seat.quaternion);
        o.g.userData.upper.rotation.z = Math.sin(t * 1.5 + o.phase) * 0.04;
      } else if (Number.isFinite(s.x)) {
        o.g.userData.setPose('stand');
        tmp.set(s.x, s.y || 0, s.z);
        const moving = o.g.position.distanceTo(tmp) > 0.05;
        if (o.g.position.lengthSq() === 0) o.g.position.copy(tmp); else o.g.position.lerp(tmp, 0.15);
        let dy = (s.yaw || 0) - o.g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        o.g.rotation.set(0, o.g.rotation.y + dy * 0.2, 0);
        const sw = moving ? Math.sin(t * 10 + o.phase) * 0.5 : 0;
        o.g.userData.legs[0].rotation.x = sw; o.g.userData.legs[1].rotation.x = -sw;
        o.g.userData.upper.rotation.z = 0;
      }
    }
  }

  function takenSeats() { const set = new Set(); for (const o of others.values()) if (Number.isInteger(o.state.seat)) set.add(o.state.seat); return set; }
  function leave() { try { client && client.connected && client.publish(NS + id, '', { qos: 0, retain: false }); client && client.end(true); } catch {} }
  window.addEventListener('pagehide', leave);

  count();
  connect();
  return { update, takenSeats, publishNow: () => publish(true), others, id, look };
}
