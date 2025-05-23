const roomIdEl = document.getElementById('roomId');
const connectToEl = document.getElementById('connectToRoom');
const connectBtn = document.getElementById('connectBtn');
const copyBtn = document.getElementById('copyRoomId');
const chatEl = document.getElementById('chat');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const connectionStatus = document.getElementById('connection-status');

let peer;
const database = firebase.database();
let myRoomId;

function appendMsg(sender, text, className = "system-msg") {
  const div = document.createElement("div");
  div.className = className;
  div.textContent = `${sender}: ${text}`;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function setupPeer(initiator) {
  peer = new SimplePeer({ initiator, trickle: false });

  peer.on('connect', () => {
    connectionStatus.textContent = "🟢 Connected";
    messageInput.disabled = false;
    sendBtn.disabled = false;
    appendMsg("System", "Connected!");
  });

  peer.on('data', data => {
    appendMsg("Peer", data.toString(), "peer-msg");
  });

  peer.on('error', err => {
    console.error("Peer error:", err);
    appendMsg("System", "Connection error.");
  });

  peer.on('close', () => {
    connectionStatus.textContent = "🔴 Disconnected";
    appendMsg("System", "Connection closed.");
    messageInput.disabled = true;
    sendBtn.disabled = true;
  });
}

function startHosting() {
  myRoomId = roomIdEl.value.trim();
  if (!myRoomId) {
    myRoomId = Math.random().toString(36).substring(2, 10);
    roomIdEl.value = myRoomId;
  }

  setupPeer(true);

  const myConnRef = database.ref("rooms/" + myRoomId);

  peer.on('signal', data => {
    myConnRef.set({ offer: data });
  });

  myConnRef.on('value', snapshot => {
    const data = snapshot.val();
    if (data && data.answer && !peer.destroyed) {
      peer.signal(data.answer);
    }
  });

  appendMsg("System", `Hosting Room ID: ${myRoomId}`);
}

connectBtn.onclick = () => {
  const targetRoom = connectToEl.value.trim();
  if (!targetRoom) return alert("Enter a Room ID to connect");

  setupPeer(false);

  const connRef = database.ref("rooms/" + targetRoom);

  connRef.on('value', snapshot => {
    const data = snapshot.val();
    if (data && data.offer && !peer.destroyed) {
      peer.signal(data.offer);
    }
  });

  peer.on('signal', data => {
    connRef.update({ answer: data });
  });

  appendMsg("System", `Connecting to Room ID: ${targetRoom}`);
};

copyBtn.onclick = () => {
  navigator.clipboard.writeText(roomIdEl.value).then(() => {
    alert("Room ID copied!");
  }).catch(() => {
    alert("Copy failed, please copy manually.");
  });
};

sendBtn.onclick = () => {
  const msg = messageInput.value.trim();
  if (msg && peer && peer.connected) {
    peer.send(msg);
    appendMsg("You", msg, "your-msg");
    messageInput.value = "";
  }
};

// Start hosting automatically on page load
window.onload = () => {
  startHosting();
};
