import express from "express";
import http from "http";
import { nanoid } from "nanoid";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

// Fix for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const rooms = {};

function createDeck(cardnames) {
  const deck = [];
  cardnames.forEach(name => {
    for (let i = 0; i< 4; i++) {
      deck.push(name);
    }
  });
  return deck.sort(() => Math.random() - 0.5);
}

io.on("connection", (socket) => {
  socket.on("createRoom", ({name, cards }) => {
    const room = nanoid(6);
    rooms[room] = {
      players: [],
      deck: [],
      cards: cards,
      started: false,
      turnIndex: 0,
    };
    socket.join(room);
    rooms[room].players.push({
      id: socket.id,
      name,
      hand: [],
      skipNext: false,
      skipRecv: false,
    });
    socket.emit("roomCreated", room);
    io.to(room).emit(
      "playerList",
      rooms[room].players.map((p) => ({ id: p.id, name: p.name }))
    );
  });

  socket.on("joinRoom", ({ room, name }) => {
    const R = rooms[room];
    if (!R || R.started) return socket.emit("badRoom");
    socket.join(room);
    R.players.push({
      id: socket.id,
      name,
      hand: [],
      skipNext: false,
      skipRecv: false,
    });
    io.to(room).emit(
      "playerList",
      R.players.map((p) => ({ id: p.id, name: p.name }))
    );


    // if game has already startted, deal hand to this new plaeyr
    if (R.deck.length > 0) {
      for (let i = 0; i < 4; i++){
        R.players.at(-1).hand.push(R.deck.pop());
      }
    }
    io.to(socket.id).emit("hand", R.players.at(-1).hand);
  });

  socket.on("startGame", (room) => {
    const R = rooms[room];
    if (!R || R.started) return;
    R.started = true;
    R.deck = createDeck(R.cards);
    R.players.forEach((p) => (p.hand = []));
    for (let i = 0; i < 4 * R.players.length; i++) {
      R.players[i % R.players.length].hand.push(R.deck.pop());
    }
    R.players.forEach((p) => io.to(p.id).emit("hand", p.hand));
    io.to(room).emit("gameStarted");
    io.to(room).emit("turn", R.players[R.turnIndex].id);
  });

  socket.on("passCard", ({ card, room }) => {
    const R = rooms[room];
    const idx = R.players.findIndex((p) => p.id === socket.id);
    if (idx === -1) return;
    const sender = R.players[idx];
    const receiver = R.players[(idx + 1) % R.players.length];

    sender.hand = sender.hand.filter((c) => c !== card);

    if (!receiver.skipRecv) {
      receiver.hand.push(card);
      io.to(receiver.id).emit("fadeInCard", card);
    }

    io.to(sender.id).emit("hand", sender.hand);
    receiver.skipRecv = false;

    do {
      R.turnIndex = (R.turnIndex + 1) % R.players.length;
      if (R.players[R.turnIndex].skipNext) {
        R.players[R.turnIndex].skipNext = false;
      } else {
        break;
      }
    } while (true);

    io.to(room).emit("turn", R.players[R.turnIndex].id);
  });

  socket.on("dhapp", (room) => {
    const R = rooms[room];
    const idx = R.players.findIndex((p) => p.id === socket.id);
    if (idx === -1) return;
    const caller = R.players[idx];
    const receiver = R.players[(idx + 1) % R.players.length];
    const both = [caller, receiver];

    io.to(room).emit("showHand", {
      playerName: caller.name,
      cards: caller.hand
    })

    const winner = both.find((p) => {
      const counts = {};
      p.hand.forEach((c) => {
        counts[c] = (counts[c] || 0) + 1;
      });
      return Object.values(counts).some((v) => v === 4);
    });

    if (winner) {
      io.to(room).emit("winner", winner.name);
      delete rooms[room];
    } else {
      caller.skipNext = true;
      receiver.skipRecv = true;
      io.to(room).emit("cheater", caller.name);

      do {
        R.turnIndex = (R.turnIndex + 1) % R.players.length;
        if (R.players[R.turnIndex].skipNext) {
          R.players[R.turnIndex].skipNext = false;
        } else {
          break;
        }
      } while (true);

      io.to(room).emit("turn", R.players[R.turnIndex].id);
    }
  });

  socket.on("disconnect", () => {
    for (const room in rooms) {
      const R = rooms[room];
      const idx = R.players.findIndex((p) => p.id === socket.id);
      if (idx !== -1) {
        R.players.splice(idx, 1);
        io.to(room).emit(
          "playerList",
          R.players.map((p) => ({ id: p.id, name: p.name }))
        );
        if (R.players.length === 0) {
          delete rooms[room];
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
