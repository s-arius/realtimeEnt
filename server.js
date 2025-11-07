const PORT = process.env.PORT || 8080;
const servidor = new WebSocket.Server({ port: PORT });
console.log("Servidor Snake Online en puerto:", PORT);


console.log("Servidor Snake Online iniciado en el puerto 8080");

let conexiones = [];
let jugadores = {};
let siguienteID = 0;
let fruta = generarFruta();

function generarFruta() {
    const posx = Math.floor(Math.random() * 25) * 20;
    const posy = Math.floor(Math.random() * 25) * 20;
    return { posx, posy };
}

function broadcast(mensaje) {
    const txt = JSON.stringify(mensaje);
    conexiones.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.send(txt);
    });
}

servidor.on("connection", (ws) => {
    const id = siguienteID++;
    conexiones.push(ws);

    const nuevoJugador = {
        id: id,
        posx: Math.floor(Math.random() * 25) * 20,
        posy: Math.floor(Math.random() * 25) * 20,
        dir: "0",
        puntos: 0,
        color: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
    };
    jugadores[id] = nuevoJugador;

    console.log("Jugador conectado:", id);

    // 🔹 Enviar primero al jugador recién conectado su propio "new"
    ws.send(JSON.stringify({ tipo: "new", datos: nuevoJugador }));

    // 🔹 Enviar el estado de la fruta
    ws.send(JSON.stringify({ tipo: "estadoFruta", datos: fruta }));

    // 🔹 Enviar al nuevo jugador la lista de los demás jugadores existentes
    for (const otroID in jugadores) {
        if (parseInt(otroID) !== id) {
            ws.send(JSON.stringify({ tipo: "new", datos: jugadores[otroID] }));
        }
    }

    // 🔹 Avisar a todos (incluido él mismo) de que hay un nuevo jugador
    broadcast({ tipo: "new", datos: nuevoJugador });

    // --- Manejo de mensajes ---
    ws.on("message", (data) => {
        let mensaje;
        try { mensaje = JSON.parse(data.toString()); } catch { return; }

        if (mensaje.tipo === "mover") {
            const j = jugadores[mensaje.datos.id];
            if (!j) return;
            j.dir = mensaje.datos.dir;
            j.posx = parseInt(mensaje.datos.posx);
            j.posy = parseInt(mensaje.datos.posy);
            broadcast({ tipo: "mover", datos: j });

        } else if (mensaje.tipo === "comer") {
            const j = jugadores[mensaje.datos.id];
            if (!j) return;
            if (j.posx === fruta.posx && j.posy === fruta.posy) {
                j.puntos++;
                console.log(`Jugador ${j.id} ha comido fruta (${j.puntos} puntos)`);
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
