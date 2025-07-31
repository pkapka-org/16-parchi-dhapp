const socket = io();

let room = null;
let myId = null;
let myName = null;
let myHand = [];
let players = [];
let currentTurnId = null;
let selectedCard = null;

const colors = [
  "red", "orange", "yellow", "green", "blue",
  "indigo", "violet", "black", "brown", "peach"
];

function layoutPlayers() {
  const table = document.getElementById("table");
  table.innerHTML = "";
  const n = players.length;
  players.forEach((p, i) => {
    const angle = 2 * Math.PI * i / n;
    const x = 170 + 150 * Math.cos(angle);
    const y = 170 + 150 * Math.sin(angle);
    const div = document.createElement("div");
    div.className = "player";
    if (p.id === currentTurnId) div.classList.add("active");
    div.style.background = colors[i % colors.length];
    div.style.left = `${x}px`;
    div.style.top = `${y}px`;
    div.innerText = p.name;
    table.appendChild(div);
  });
  updateActivePlayer();
}

function create() {
  myName = prompt("Enter your name:");
  if (!myName) return alert("Please enter a name");

  const raw = document.getElementById("cardnames").value;
  const names = raw
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

    if (names.length === 0){
      return alert("enter atleast 1 card name");
    }
  socket.emit("createRoom",{name: myName, cards: names});
}

function join() {
  myName = document.getElementById("nm").value.trim();
  room = document.getElementById("code").value.trim().toUpperCase();
  if (!myName || !room) return alert("Please enter name and room code");
  socket.emit("joinRoom", { room, name: myName });
}

function startGame() {
  if (!room) return alert("No room");
  socket.emit("startGame", room);
}

socket.on("connect", () => {
  myId = socket.id;
});

socket.on("roomCreated", (code) => {
  room = code;
  alert(`Room created: ${code}`);
  document.getElementById("code").value = code;
  updateStartButton();
});

socket.on("badRoom", () => alert("Room invalid or game started"));

socket.on("playerList", (list) => {
  players = list;
  renderPlayersList();
  layoutPlayers();
  updateStartButton();
});

socket.on("gameStarted", () => {
  document.getElementById("lobby").style.display = "none";
  document.getElementById("game").style.display = "block";
  document.getElementById("cheaterNotice").innerText = "";
  selectedCard = null;
  document.getElementById("passBtn").style.display = "none";
  document.getElementById("passBtn").disabled = true;
});

socket.on("hand", (hand) => {
  myHand = hand;
  renderHand();
});

socket.on("turn", (id) => {
  currentTurnId = id;
  updateActivePlayer();
  selectedCard = null;
  document.getElementById("passBtn").style.display = "none";
  document.getElementById("passBtn").disabled = true;
  if (id === myId) alert("Your turn! Select a card to pass.");
});

socket.on("cheater", (name) => {
  const d = document.getElementById("cheaterNotice");
  d.innerText = `${name} called false Dhapp! Their next turn will be skipped.`;
  setTimeout(() => (d.innerText = ""), 8000);
});

socket.on("winner", (name) => {
  alert(`${name} wins! Game will restart.`);
  window.location.reload();
});

socket.on("fadeInCard", (card) => {
  myHand.push(card);
  renderHand();
});

function renderPlayersList() {
  const ul = document.getElementById("playerList");
  ul.innerHTML = "";
  players.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p.name;
    ul.appendChild(li);
  });
}

function renderHand() {
  const handDiv = document.getElementById("hand");
  handDiv.innerHTML = "<h3>Your hand:</h3>";
  myHand.forEach((c) => {
    const btn = document.createElement("div");
    btn.className = "card-btn fade-in";
    btn.innerText = c;
    if (currentTurnId === myId) {
      btn.onclick = () => {
        selectedCard = c;
        document.getElementById("passBtn").style.display = "inline-block";
        document.getElementById("passBtn").disabled = false;
        // Highlight selected card:
        document.querySelectorAll(".card-btn").forEach((b) =>
          b.style.borderColor = (b.innerText === c ? "blue" : "#333")
        );
      };
      btn.classList.remove("disabled");
    } else {
      btn.classList.add("disabled");
      btn.onclick = null;
    }
    handDiv.appendChild(btn);
  });
}

function updateActivePlayer() {
  const table = document.getElementById("table");
  [...table.children].forEach((div, i) => {
    if (players[i] && players[i].id === currentTurnId) div.classList.add("active");
    else div.classList.remove("active");
  });
}

function updateStartButton() {
  const btn = document.getElementById("startGameBtn");
  if (players.length > 1 && players[0].id === myId) {
    btn.style.display = "inline-block";
  } else {
    btn.style.display = "none";
  }
}

document.getElementById("passBtn").onclick = () => {
  if (!selectedCard) return;
  socket.emit("passCard", { card: selectedCard, room });
  selectedCard = null;
  document.getElementById("passBtn").style.display = "none";
  document.getElementById("passBtn").disabled = true;
  renderHand();
};

document.getElementById("dhappBtn").onclick = () => {
  if (!room) return alert("Not in a room");
  socket.emit("dhapp", room);
};
