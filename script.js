// script.js

// Firebase database reference
const db = firebase.database();

let peer = null;
let isHost = false;
let roomId = null;

// UI elements
const roomIdInput = document.getElementById('roomId');
const connectToRoomInput = document.getElementById('connectToRoom');
const connectBtn = document.getElementById('connectBtn');
const copyRoomIdBtn = document.getElementById('copyRoomId');
const chatDiv = document.getElementById('chat');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const connectionStatus = document.getElementById('connection-status');

function generateRoomId() {
  // Simple random 6-digit hex string
  return Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

function logSystemMessage(msg) {
  const p = document.createElement('p');
  p.className = 'system-msg';
  p.textContent = msg;
  chatDiv.appendChild(p);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

function addMessageToChat(msg, isOwnMessage) {
  const p = document.createElement('p');
  p.textContent = msg;
  p.className = isOwnMessage ? 'your-msg' : 'peer-msg';
  chatDiv.appendChild(p);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

function updateConnectionStatus(connected) {
  connectionStatus.textContent = connected ? '🟢 Connected' : '🔴 Disconnected';
}

function enableChat() {
  messageInput.disabled = false;
  sendBtn.disabled = false;
  messageInput.focus();
}

function disableChat() {
  messageInput.disabled = true;
  sendBtn.disabled = true;
}

// Clear Firebase listeners for current room (to avoid duplicate events)
function clearFirebaseListeners() {
  if (!roomId) return;
  db.ref('rooms/' + roomId + '/offer').off();
  db.ref('rooms/' + roomId + '/answer').off();
}

function startHosting() {
  clearFirebaseListeners();
  isHost = true;
  roomId = roomIdInput.value.trim() || generateRoomId();
  roomIdInput.value = roomId;
  logSystemMessage(`Hosting room: ${roomId}`);
  updateConnectionStatus(false);

  peer = new SimplePeer({ initiator: true, trickle: false });

  peer.on('signal', data => {
    console.log('Host generated signal (offer/candidates):', data);
    db.ref('rooms/' + roomId + '/offer').set(data);
  });

  // Listen for answer from joiner
  db.ref('rooms/' + roomId + '/answer').on('value', snapshot => {
    const answer = snapshot.val();
    if (!answer) return;
    if (peer && !peer.destroyed) {
      // Only signal if peer state not stable (avoid multiple signaling)
      if (peer._pc.signalingState !== 'stable') {
        console.log('Host received answer:', answer);
        peer.signal(answer);
      } else {
        console.log('Host ignoring answer signal because state is stable');
      }
    }
  });

  setupPeerEvents();
}

function joinRoom(id) {
  clearFirebaseListeners();
  isHost = false;
  roomId = id.trim();
  if (!roomId) {
    alert('Please enter a valid Room ID to join.');
    return;
  }
  roomIdInput.value = roomId;
  logSystemMessage(`Joining room: ${roomId}`);
  updateConnectionStatus(false);

  peer = new SimplePeer({ initiator: false, trickle: false });

  // Listen for offer from host
  db.ref('rooms/' + roomId + '/offer').on('value', snapshot => {
    const offer = snapshot.val();
    if (!offer) return;
    if (peer && !peer.destroyed) {
      console.log('Joiner received offer:', offer);
      peer.signal(offer);
    }
  });

  peer.on('signal', data => {
    console.log('Joiner generated signal (answer/candidates):', data);
    db.ref('rooms/' + roomId + '/answer').set(data);
  });

  setupPeerEvents();
}

function setupPeerEvents() {
  peer.on('connect', () => {
    console.log('Peer connected');
    logSystemMessage('Peer connected!');
    updateConnectionStatus(true);
    enableChat();
  });

  peer.on('data', data => {
    console.log('Data received:', data);
    addMessageToChat(data.toString(), false);
  });

  peer.on('error', err => {
    console.error('Peer error:', err);
    logSystemMessage(`Error: ${err.message || err}`);
  });

  peer.on('close', () => {
    console.log('Peer connection closed');
    logSystemMessage('Peer disconnected');
    updateConnectionStatus(false);
    disableChat();
  });
}

// Send chat message
sendBtn.onclick = () => {
  const msg = messageInput.value.trim();
  if (!msg || !peer || peer.destroyed) return;
  peer.send(msg);
  addMessageToChat(msg, true);
  messageInput.value = '';
  messageInput.focus();
};

// Connect button handler
connectBtn.onclick = () => {
  const id = connectToRoomInput.value.trim();
  if (!id) {
    alert('Please enter a Room ID to connect.');
    return;
  }
  joinRoom(id);
};

// Copy room id button handler
copyRoomIdBtn.onclick = () => {
  if (!roomIdInput.value.trim()) {
    alert('No Room ID to copy!');
    return;
  }
  navigator.clipboard.writeText(roomIdInput.value.trim())
    .then(() => alert('Room ID copied to clipboard!'))
    .catch(() => alert('Failed to copy Room ID.'));
};

// Auto-start hosting if roomId input is empty
if (!roomIdInput.value.trim()) {
  startHosting();
} else {
  // If roomId input already has a value, assume user wants to host that room
  startHosting();
}
