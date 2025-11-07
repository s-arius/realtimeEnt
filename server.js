// server.js
// Servidor WebSocket para Snake Online
// Mantiene nombres sencillos y valida que cada socket controle solo su jugador.

const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const servidor = new WebSocket.Server({ port: PORT }, () => {
  console.log("Servidor WebSocket escuchando en puerto", PORT);
});

let siguienteID = 0;
// jugadores: id -> { id, posx, posy, dir, puntos, color }
const jugadores = new Map();
// socketToId: ws -> id
const socketToId = new Map();

let fruta = generarFruta();

function generarFruta() {
  return {
    posx: Math.floor(Math.random() * 25) * 20,
    posy: Math.floor(Math.random() * 25) * 20
  };
}

function safeSend(ws, obj) {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  } catch (e) { /* ignore */ }
}

function broadcast(obj) {
  const txt = JSON.stringify(obj);
  servidor.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(txt);
  });
}

function broadcastExcept(exceptWs, obj) {
  const txt = JSON.stringify(obj);
  servidor.clients.forEach(c => {
    if (c !== exceptWs && c.readyState === WebSocket.OPEN) c.send(txt);
  });
}

servidor.on("connection", (ws) => {
  const id = siguienteID++;
  // crea jugador con propiedades iniciales (múltiplos de 20)
  const jugador = {
    id: id.toString(),
    posx: Math.floor(Math.random() * 25) * 20,
    posy: Math.floor(Math.random() * 25) * 20,
    dir: "0",
    puntos: 0,
    color: `hsl(${Math.floor(Math.random()*360)}, 65%, 50%)`
  };

  jugadores.set(jugador.id, jugador);
  socketToId.set(ws, jugador.id);

  console.log("Jugador conectado:", jugador.id);

  // 1) enviar al socket nuevo su propio "new" (así el cliente sabrá que el primer "new" es suyo)
  safeSend(ws, { tipo: "new", datos: jugador });

  // 2) enviar al nuevo socket el resto de jugadores existentes (excluyendo él)
  for (const [otherId, otherPlayer] of jugadores.entries()) {
    if (otherId === jugador.id) continue;
    safeSend(ws, { tipo: "new", datos: otherPlayer });
  }

  // 3) enviar al nuevo socket la fruta actual
  safeSend(ws, { tipo: "estadoFruta", datos: fruta });

  // 4) notificar a los demás que hay un nuevo jugador (excluyendo al nuevo socket)
  broadcastExcept(ws, { tipo: "new", datos: jugador });

  // manejar mensajes desde el cliente
  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); }
    catch (e) { return; }

    // seguridad: id del socket que envía
    const remitenteId = socketToId.get(ws);

    if (msg.tipo === "mover") {
      // validar que quien pide mover es el dueño del id
      if (!msg.datos || msg.datos.id === undefined) return;
      const idMsg = String(msg.datos.id);
      if (idMsg !== remitenteId) return; // ignorar intentos de mover a otro jugador

      const p = jugadores.get(idMsg);
      if (!p) return;
      // actualizar servidor como fuente de verdad
      p.dir = msg.datos.dir ?? p.dir;
      p.posx = (msg.datos.posx !== undefined) ? Number(msg.datos.posx) : p.posx;
      p.posy = (msg.datos.posy !== undefined) ? Number(msg.datos.posy) : p.posy;

      // asegurar límites
      if (p.posx < 0) p.posx = 0;
      if (p.posx > 480) p.posx = 480;
      if (p.posy < 0) p.posy = 0;
      if (p.posy > 480) p.posy = 480;

      // broadcast del mover
      broadcast({ tipo: "mover", datos: p });

    } else if (msg.tipo === "comer") {
      if (!msg.datos || msg.datos.id === undefined) return;
      const idMsg = String(msg.datos.id);
      if (idMsg !== remitenteId) return;

      const p = jugadores.get(idMsg);
      if (!p) return;

      if (p.posx === fruta.posx && p.posy === fruta.posy) {
        p.puntos++;
        broadcast({ tipo: "puntuacion", datos: { id: p.id, puntos: p.puntos } });
        fruta = generarFruta();
        broadcast({ tipo: "estadoFruta", datos: fruta });
        console.log(`Jugador ${p.id} comió la fruta. Puntos=${p.puntos}`);
      }
    }
  });

  ws.on("close", () => {
    const idcerrado = socketToId.get(ws);
    console.log("Conexión cerrada:", idcerrado);
    if (idcerrado) {
      jugadores.delete(idcerrado);
      socketToId.delete(ws);
      broadcast({ tipo: "delete", datos: idcerrado });
    }
  });

  ws.on("error", (e) => {
    console.log("WS error:", e && e.message ? e.message : e);
  });
});

console.log("Servidor listo.");
