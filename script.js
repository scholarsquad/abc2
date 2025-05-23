const roomIdEl = document.getElementById('roomId');
const connectToEl = document.getElementById('connectToRoom');
const startHostBtn = document.getElementById('startHostBtn');
const connectBtn = document.getElementById('connectBtn');
const chatEl = document.getElementById('chat');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const connectionStatus = document.getElementById('connection-status');

let peer = null;
const database = firebase.database();

function appendMsg(sender, text, className = 'system-msg') {
  const div = document.createElement('div');
  div.className = className;
  div.textContent = `${sender}: ${text}`;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function updateConnectionStatus(connected) {
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

function setupPeer(initiator) {
  peer = new SimplePeer({ initiator, trickle: false });

  peer.on('connect', () => {
    updateConnectionStatus(true);
    messageInput.disabled = false;
    sendBtn.disabled = false;
    appendMsg('System', 'Connected!');
  });

  peer.on('data', data => {
    appendMsg('Peer', data.toString(), 'peer-msg');
  });

  peer.on('error', err => {
    console.error('Peer error:', err);
    appendMsg('System', 'Connection error.');
    updateConnectionStatus(false);
  });

  peer.on('close', () => {
    appendMsg('System', 'Connection closed.');
    updateConnectionStatus(false);
    messageInput.disabled = true;
    sendBtn.disabled = true;
  });
}

function startHosting(roomId) {
  setupPeer(true);

  const myConnRef = database.ref('rooms/' + roomId);

  peer.on('signal', data => {
    myConnRef.set({ offer: data });
  });

  myConnRef.on('value', snapshot => {
    const data = snapshot.val();
    if (data && data.answer && !peer.destroyed) {
      peer.signal(data.answer);
    }
  });

  appendMsg('System', `Hosting Room ID: ${roomId}`);
}

startHostBtn.onclick = () => {
  let myRoomId = roomIdEl.value.trim();
  if (!myRoomId) {
    myRoomId = Math.random().toString(36).substring(2, 10);
    roomIdEl.value = myRoomId;
  }
  startHosting(myRoomId);
};

connectBtn.onclick = () => {
  const targetRoom = connectToEl.value.trim();
  if (!targetRoom) {
    alert('Please enter a Room ID to connect');
    return;
  }

  setupPeer(false);

  const connRef = database.ref('rooms/' + targetRoom);

  connRef.on('value', snapshot => {
    const data = snapshot.val();
    if (data && data.offer && !peer.destroyed) {
      peer.signal(data.offer);
    }
  });

  peer.on('signal', data => {
    connRef.update({ answer: data });
  });

  appendMsg('System', `Connecting to Room ID: ${targetRoom}`);
};

sendBtn.onclick = () => {
  const msg = messageInput.value.trim();
  if (!msg || !peer || peer.destroyed) return;

  peer.send(msg);
  appendMsg('You', msg, 'your-msg');
  messageInput.value = '';
};

window.onload = () => {
  updateConnectionStatus(false);
};

