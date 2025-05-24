// Initialize Firebase (use your config)
const firebaseConfig = {
  apiKey: "AIzaSyA3goqO3rp5_uXJKV3RNFVkso3W7C-rYTk",
  authDomain: "p2pchat-88e5e.firebaseapp.com",
  databaseURL: "https://p2pchat-88e5e-default-rtdb.firebaseio.com",
  projectId: "p2pchat-88e5e",
  storageBucket: "p2pchat-88e5e.appspot.com",
  messagingSenderId: "77422680773",
  appId: "1:77422680773:web:f2437b0a354cc2316f6eac"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const joinBtn = document.getElementById('joinBtn');
const nicknameInput = document.getElementById('nicknameInput');
const roomIdInput = document.getElementById('roomIdInput');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const connectionStatus = document.getElementById('connection-status');
const chat = document.getElementById('chat');

let roomId = null;
let peerId = null;
let nickname = null;

const peers = {}; // key: peerId, value: { peer: SimplePeer, nickname: string }

// Helper to generate random ID if needed
function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function setStatus(connected) {
  if (connected) {
    connectionStatus.textContent = '🟢 Connected';
    connectionStatus.classList.remove('disconnected');
    connectionStatus.classList.add('connected');
  } else {
    connectionStatus.textContent = '🔴 Disconnected';
    connectionStatus.classList.remove('connected');
    connectionStatus.classList.add('disconnected');
  }
}

function logSystemMessage(msg) {
  const div = document.createElement('div');
  div.textContent = msg;
  div.className = 'system-msg';
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function logChatMessage(sender, msg, isLocal) {
  const div = document.createElement('div');
  div.textContent = `${sender}: ${msg}`;
  div.className = isLocal ? 'your-msg' : 'peer-msg';
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// Send signaling data to a peer via Firebase
function sendSignal(toPeerId, signalData) {
  const signalRef = db.ref(`rooms/${roomId}/peers/${toPeerId}/signals/${peerId}`);
  signalRef.set(signalData);
}

// Remove signaling data after processed (cleanup)
function clearSignal(toPeerId) {
  const signalRef = db.ref(`rooms/${roomId}/peers/${toPeerId}/signals/${peerId}`);
  signalRef.remove();
}

// Listen for signals sent *to* us from each peer
function listenForSignals() {
  const signalsRef = db.ref(`rooms/${roomId}/peers/${peerId}/signals`);
  signalsRef.on('child_added', async (snapshot) => {
    const fromPeerId = snapshot.key;
    const signalData = snapshot.val();

    if (!peers[fromPeerId]) {
      // We have a new peer connection to create
      createPeerConnection(fromPeerId, false);
    }

    const peerObj = peers[fromPeerId];
    if (peerObj && peerObj.peer) {
      try {
        peerObj.peer.signal(signalData);
      } catch (e) {
        console.error('Error signaling peer:', e);
      }
    }

    // Remove signaling data after processing
    clearSignal(fromPeerId);
  });
}

// Create a new SimplePeer instance for a peer connection
function createPeerConnection(otherPeerId, initiator) {
  if (peers[otherPeerId]) {
    console.log(`Already connected to peer ${otherPeerId}`);
    return;
  }

  const newPeer = new SimplePeer({ initiator, trickle: false });

  peers[otherPeerId] = {
    peer: newPeer,
    nickname: null
  };

  newPeer.on('signal', (data) => {
    // Send our signaling data to the other peer
    sendSignal(otherPeerId, data);
  });

  newPeer.on('connect', () => {
    console.log(`Connected to peer ${otherPeerId}`);
    setStatus(true);
    messageInput.disabled = false;
    sendBtn.disabled = false;
    logSystemMessage(`Connected to peer ${otherPeerId}${peers[otherPeerId].nickname ? ' (' + peers[otherPeerId].nickname + ')' : ''}`);

    // Send our nickname immediately upon connect
    newPeer.send(JSON.stringify({ type: 'nickname', nickname }));
  });

  newPeer.on('data', (data) => {
    let msgObj = null;
    try {
      msgObj = JSON.parse(data.toString());
    } catch {
      msgObj = null;
    }

    if (msgObj && msgObj.type === 'nickname') {
      peers[otherPeerId].nickname = msgObj.nickname;
      logSystemMessage(`Peer ${otherPeerId} set nickname: ${msgObj.nickname}`);
    } else if (typeof data === 'string') {
      const senderName = peers[otherPeerId].nickname || otherPeerId;
      logChatMessage(senderName, data.toString(), false);
    }
  });

  newPeer.on('close', () => {
    console.log(`Connection to peer ${otherPeerId} closed`);
    logSystemMessage(`Disconnected from peer ${otherPeerId}${peers[otherPeerId].nickname ? ' (' + peers[otherPeerId].nickname + ')' : ''}`);
    delete peers[otherPeerId];

    if (Object.keys(peers).length === 0) {
      setStatus(false);
      messageInput.disabled = true;
      sendBtn.disabled = true;
    }
  });

  newPeer.on('error', (err) => {
    console.error('Peer error:', err);
  });
}

// Join room and initialize connections
function joinRoom() {
  nickname = nicknameInput.value.trim();
  if (!nickname) {
    alert('Please enter a nickname');
    return;
  }

  roomId = roomIdInput.value.trim() || 'RoomOne'; // default room
  peerId = generateId();

  logSystemMessage(`Joining room: ${roomId} as ${nickname} (${peerId})`);

  // Write our presence in the room
  const myPeerRef = db.ref(`rooms/${roomId}/peers/${peerId}`);

  myPeerRef.set({ nickname });
  myPeerRef.onDisconnect().remove();

  // Listen for peers in the room
  const peersRef = db.ref(`rooms/${roomId}/peers`);
  peersRef.on('value', (snapshot) => {
    const peersInRoom = snapshot.val() || {};
    const otherPeers = Object.keys(peersInRoom).filter(id => id !== peerId);

    // Connect to new peers if not connected
    otherPeers.forEach(otherPeerId => {
      if (!peers[otherPeerId]) {
        // Decide initiator by peer ID comparison to avoid double initiator
        const initiator = peerId < otherPeerId;
        createPeerConnection(otherPeerId, initiator);
      }
    });

    // Remove connections to peers no longer in the room
    Object.keys(peers).forEach(connectedPeerId => {
      if (!peersInRoom[connectedPeerId]) {
        peers[connectedPeerId].peer.destroy();
        delete peers[connectedPeerId];
      }
    });

    // Update status
    setStatus(Object.keys(peers).length > 0);
  });

  listenForSignals();

  // Enable message input/send
  messageInput.disabled = false;
  sendBtn.disabled = false;
}

// Send chat message to all connected peers
function sendMessage() {
  const msg = messageInput.value.trim();
  if (!msg) return;

  logChatMessage('Me', msg, true);
  messageInput.value = '';

  // Broadcast to all peers
  Object.values(peers).forEach(({ peer }) => {
    if (peer.connected) {
      peer.send(msg);
    }
  });
}

joinBtn.addEventListener('click', () => {
  if (!roomId) {
    joinRoom();
  }
});

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});
