// Firebase config - replace with your own config
const firebaseConfig = {
  apiKey: "AIzaSyA3goqO3rp5_uXJKV3RNFVkso3W7C-rYTk",
  authDomain: "p2pchat-88e5e.firebaseapp.com",
  databaseURL: "https://p2pchat-88e5e-default-rtdb.firebaseio.com",
  projectId: "p2pchat-88e5e",
  storageBucket: "p2pchat-88e5e.firebasestorage.app",
  messagingSenderId: "77422680773",
  appId: "1:77422680773:web:f2437b0a354cc2316f6eac"
};
firebase.initializeApp(firebaseConfig);

const database = firebase.database();

const roomIdEl = document.getElementById("roomId");
const connectToEl = document.getElementById("connectToRoom");
const connectBtn = document.getElementById("connectBtn");
const copyBtn = document.getElementById("copyRoomId");
const chatEl = document.getElementById("chat");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const connectionStatus = document.getElementById("connection-status");

let peer;
let myRoomId;

// Helper: Append message to chat log
function appendMsg(sender, text, className = "system-msg") {
  const div = document.createElement("div");
  div.className = className;
  div.textContent = `${sender}: ${text}`;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

// Setup peer connection
function setupPeer(initiator) {
  peer = new SimplePeer({ initiator, trickle: false });

  peer.on("connect", () => {
    connectionStatus.textContent = "🟢 Connected";
    connectionStatus.classList.add("connected");
    messageInput.disabled = false;
    sendBtn.disabled = false;
    appendMsg("System", "Connected!");
  });

  peer.on("data", (data) => {
    appendMsg("Peer", data.toString(), "peer-msg");
  });

  peer.on("error", (err) => {
    console.error("Peer error:", err);
    appendMsg("System", "Connection error.");
  });

  peer.on("close", () => {
    connectionStatus.textContent = "🔴 Disconnected";
    connectionStatus.classList.remove("connected");
    messageInput.disabled = true;
    sendBtn.disabled = true;
    appendMsg("System", "Connection closed.");
  });
}

// Host a room: generate or use inputted room ID, then create offer and store in Firebase
function startHosting() {
  myRoomId = roomIdEl.value.trim();
  if (!myRoomId) {
    myRoomId = Math.random().toString(36).substring(2, 10);
    roomIdEl.value = myRoomId;
  }

  appendMsg("System", `Hosting Room ID: ${myRoomId}`);

  setupPeer(true);

  const myConnRef = database.ref("rooms/" + myRoomId);

  // Clear previous signaling data to avoid stale info
  myConnRef.remove();

  peer.on("signal", (data) => {
    // Store entire signal object stringified
    myConnRef.set({ offer: JSON.stringify(data) });
  });

  // Listen for answer from the other peer
  myConnRef.on("value", (snapshot) => {
    const val = snapshot.val();
    if (val && val.answer && !peer.destroyed) {
      try {
        const answerData = JSON.parse(val.answer);
        peer.signal(answerData);
      } catch (e) {
        console.error("Error parsing answer:", e);
      }
    }
  });
}

// Connect to an existing room using offer from Firebase, send back answer
connectBtn.onclick = () => {
  const targetRoom = connectToEl.value.trim();
  if (!targetRoom) return alert("Enter a Room ID to connect");

  appendMsg("System", `Connecting to Room ID: ${targetRoom}`);

  setupPeer(false);

  const connRef = database.ref("rooms/" + targetRoom);

  // Listen for offer from host
  connRef.on("value", (snapshot) => {
    const val = snapshot.val();
    if (val && val.offer && !peer.destroyed) {
      try {
        const offerData = JSON.parse(val.offer);
        peer.signal(offerData);
      } catch (e) {
        console.error("Error parsing offer:", e);
      }
    }
  });

  peer.on("signal", (data) => {
    // Send back answer stringified
    connRef.update({ answer: JSON.stringify(data) });
  });
};

// Copy room ID button
copyBtn.onclick = () => {
  if (roomIdEl.value.trim()) {
    navigator.clipboard.writeText(roomIdEl.value.trim());
    alert("Room ID copied!");
  } else {
    alert("No Room ID to copy");
  }
};

// Send chat message
sendBtn.onclick = () => {
  const msg = messageInput.value.trim();
  if (msg && peer && peer.connected) {
    peer.send(msg);
    appendMsg("You", msg, "your-msg");
    messageInput.value = "";
  }
};

// Auto-start hosting on page load
window.onload = () => {
  startHosting();
};
