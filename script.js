const db = firebase.database();

const joinBtn = document.getElementById('connectBtn');
const nicknameInput = document.getElementById('nicknameInput');
const roomIdInput = document.getElementById('roomIdInput');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const connectionStatus = document.getElementById('connection-status');
const chat = document.getElementById('chat');
const hostBtn = document.getElementById('hostBtn');
const copyBtn = document.getElementById('copyRoomId');

let roomId = null;
let peerId = null;
let nickname = null;

const peers = {}; // { peerId: { peer: SimplePeer, nickname: string } }

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

function sendSignal(toPeerId, signalData) {
  const signalRef = db.ref(`rooms/${roomId}/peers/${toPeerId}/signals/${peerId}`);
  signalRef.set(signalData);
}

function clearSignal(toPeerId) {
  const signalRef = db.ref(`rooms/${roomId}/peers/${toPeerId}/signals/${peerId}`);
  signalRef.remove();
}

function listenForSignals() {
  const signalsRef = db.ref(`rooms/${roomId}/peers/${peerId}/signals`);
  signalsRef.on('child_added', (snapshot) => {
    const fromPeerId = snapshot.key;
    const signalData = snapshot.val();

    if (!peers[fromPeerId]) {
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

    clearSignal(fromPeerId);
  });
}

function createPeerConnection(otherPeerId, initiator) {
  if (peers[otherPeerId]) return;

  const newPeer = new SimplePeer({ initiator, trickle: false });

  peers[otherPeerId] = { peer: newPeer, nickname: null };

  newPeer.on('signal', data => {
    sendSignal(otherPeerId, data);
  });

  newPeer.on('connect', () => {
    console.log(`Connected to peer ${otherPeerId}`);
    setStatus(true);
    messageInput.disabled = false;
    sendBtn.disabled = false;
    logSystemMessage(`Connected to peer ${otherPeerId}${peers[otherPeerId].nickname ? ' (' + peers[otherPeerId].nickname + ')' : ''}`);

    // Send our nickname after connection
    newPeer.send(JSON.stringify({ type: 'nickname', nickname }));
  });

  newPeer.on('data', data => {
    let msgObj = null;
    try {
      msgObj = JSON.parse(data.toString());
    } catch {}

    if (msgObj && msgObj.type === 'nickname') {
      peers[otherPeerId].nickname = msgObj.nickname;
      logSystemMessage(`Peer ${otherPeerId} set nickname: ${msgObj.nickname}`);
    } else if (typeof data === 'string') {
      const senderName = peers[otherPeerId].nickname || otherPeerId;
      logChatMessage(senderName, data.toString(), false);
    }
  });

  newPeer.on('close', () => {
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

function joinRoom() {
  nickname = nicknameInput.value.trim();
  if (!nickname) {
    alert('Please enter a nickname');
    return;
  }

  let inputRoomId = roomIdInput.value.trim();
  if (!inputRoomId) {
    inputRoomId = generateId();
    roomIdInput.value = inputRoomId; // show it in the input
    alert(`Generated room ID: ${inputRoomId}`);
  }
  roomId = inputRoomId;
  peerId = generateId();

  logSystemMessage(`Joining room: ${roomId} as ${nickname} (${peerId})`);

  const myPeerRef = db.ref(`rooms/${roomId}/peers/${peerId}`);

  myPeerRef.set({ nickname });
  myPeerRef.onDisconnect().remove();

  const peersRef = db.ref(`rooms/${roomId}/peers`);
  peersRef.on('value', snapshot => {
    const peersInRoom = snapshot.val() || {};
    const otherPeers = Object.keys(peersInRoom).filter(id => id !== peerId);

    otherPeers.forEach(otherPeerId => {
      if (!peers[otherPeerId]) {
        const initiator = peerId < otherPeerId;
        createPeerConnection(otherPeerId, initiator);
      }
    });

    // Remove peers that left
    Object.keys(peers).forEach(connectedPeerId => {
      if (!peersInRoom[connectedPeerId]) {
        peers[connectedPeerId].peer.destroy();
        delete peers[connectedPeerId];
      }
    });

    setStatus(Object.keys(peers).length > 0);
  });

  listenForSignals();

  messageInput.disabled = false;
  sendBtn.disabled = false;
}

function sendMessage() {
  const msg = messageInput.value.trim();
  if (!msg) return;

  logChatMessage('Me', msg, true);
  messageInput.value = '';

  Object.values(peers).forEach(({ peer }) => {
    if (peer.connected) {
      peer.send(msg);
    }
  });
}

hostBtn.addEventListener('click', () => {
  // Use existing value or generate new if empty
  let newRoomId = roomIdInput.value.trim();
  if (!newRoomId) {
    newRoomId = generateId();
    roomIdInput.value = newRoomId;
  }
  alert(`Room created! Share this Room ID with others: ${newRoomId}`);
});


joinBtn.addEventListener('click', () => {
  if (!roomId) {
    joinRoom();
  } else {
    // Already joined room, maybe alert or ignore
    alert(`Already joined room: ${roomId}`);
  }
});

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

copyBtn.addEventListener('click', () => {
  if (!roomIdInput.value) return alert('No Room ID to copy');
  navigator.clipboard.writeText(roomIdInput.value).then(() => {
    alert('Room ID copied to clipboard!');
  });
});
