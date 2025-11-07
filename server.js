const WebSocket = require("ws");
const PORT = process.env.PORT || 8080;
const servidor = new WebSocket.Server({ port: PORT });
console.log("Servidor Snake iniciado en puerto", PORT);

let jugadores = {};
let conexiones = [];
let siguienteID = 0;
let fruta = generarFruta();

function generarFruta() {
  return {
    posx: Math.floor(Math.random() * 25) * 20,
    posy: Math.floor(Math.random() * 25) * 20
  };
}

function broadcast(msg) {
  const data = JSON.stringify(msg);
  conexiones.forEach(c => {
    if (c.readyState == WebSocket.OPEN) c.send(data);
  });
}

servidor.on("connection", (ws) => {
  const id = siguienteID++;
  conexiones.push(ws);

  const jugador = {
    id,
    posx: Math.floor(Math.random() * 25) * 20,
    posy: Math.floor(Math.random() * 25) * 20,
    dir: "0",
    puntos: 0,
    color: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
  };
  jugadores[id] = jugador;

  console.log("Jugador conectado:", id);

  ws.send(JSON.stringify({ tipo: "new", datos: jugador }));
  for (const j in jugadores) {
    if (j != id) ws.send(JSON.stringify({ tipo: "new", datos: jugadores[j] }));
  }
  ws.send(JSON.stringify({ tipo: "estadoFruta", datos: fruta }));

  broadcast({ tipo: "new", datos: jugador });

  ws.on("message", (m) => {
    const msg = JSON.parse(m.toString());
    const j = jugadores[msg.datos.id];
    if (!j) return;

    if (msg.tipo == "mover") {
      j.dir = msg.datos.dir;
      j.posx = parseInt(msg.datos.posx);
      j.posy = parseInt(msg.datos.posy);
      broadcast({ tipo: "mover", datos: j });
    }

    if (msg.tipo == "comer") {
      if (j.posx == fruta.posx && j.posy == fruta.posy) {
        j.puntos++;
        broadcast({ tipo: "puntuacion", datos: { id: j.id, puntos: j.puntos } });
        fruta = generarFruta();
        broadcast({ tipo: "estadoFruta", datos: fruta });
      }
    }
  });

  ws.on("close", () => {
    console.log("Jugador desconectado:", id);
    delete jugadores[id];
    conexiones = conexiones.filter(c => c !== ws);
    broadcast({ tipo: "delete", datos: id });
  });
});