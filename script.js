document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded and parsed');

  // DOM elements
  const roomIdInput = document.getElementById('roomId');
  const connectToRoomInput = document.getElementById('connectToRoom');
  const connectBtn = document.getElementById('connectBtn');
  const copyRoomIdBtn = document.getElementById('copyRoomId');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const chatDiv = document.getElementById('chat');
  const connectionStatus = document.getElementById('connection-status');

  let peer = null;
  let roomId = '';

  // Utility: log messages in chat box
  function logMessage(text, className = 'system-msg') {
    const p = document.createElement('p');
    p.textContent = text;
    p.className = className;
    chatDiv.appendChild(p);
    chatDiv.scrollTop = chatDiv.scrollHeight;
  }

  // Generate a random room id (simple)
  function generateRoomId() {
    return 'RoomOne';
  }

  // Firebase root ref shortcut
  const dbRoot = firebase.database().ref();

  // Start hosting a room
  function startHosting() {
    roomId = roomIdInput.value.trim() || generateRoomId();
    roomIdInput.value = roomId;
    logMessage(`Hosting room: ${roomId}`);

    // Destroy old peer if any before starting new
    if (peer) {
      peer.destroy();
      peer = null;
    }

    // Create a new simple-peer as initiator
    peer = new SimplePeer({ initiator: true, trickle: false });

    connectionStatus.textContent = '🟠 Hosting - waiting for peer...';

    // Firebase signaling path
    const roomRef = dbRoot.child('rooms').child(roomId);

    // Clear old signaling data
    roomRef.remove().then(() => {
      console.log('Old signaling data cleared for room:', roomId);
    });

    // When peer has signaling data (offer)
    peer.on('signal', data => {
      console.log('Host signaling data:', data);
      roomRef.child('offer').set(data);
    });

    // Listen for answer from joiner
    roomRef.child('answer').on('value', snapshot => {
      const answer = snapshot.val();
      if (answer) {
        console.log('Received answer:', answer);
        try {
          peer.signal(answer);
        } catch (err) {
          console.error('Error applying answer signal:', err);
        }
      }
    });

    peer.on('connect', () => {
      connectionStatus.textContent = '🟢 Connected';
      logMessage('Peer connected!', 'your-msg');
      messageInput.disabled = false;
      sendBtn.disabled = false;
    });

    peer.on('data', data => {
      logMessage(`Peer: ${data}`, 'peer-msg');
    });

    peer.on('error', err => {
      console.error('Peer error:', err);
      logMessage(`Peer error: ${err}`, 'system-msg');
      connectionStatus.textContent = '🔴 Error';
    });

    peer.on('close', () => {
      logMessage('Connection closed', 'system-msg');
      connectionStatus.textContent = '🔴 Disconnected';
      messageInput.disabled = true;
      sendBtn.disabled = true;
    });
  }

  // Join a room by ID
  function joinRoom(id) {
    roomId = id;
    roomIdInput.value = roomId;
    logMessage(`Joining room: ${roomId}`);

    if (peer) {
      peer.destroy();
      peer = null;
    }

    const roomRef = dbRoot.child('rooms').child(roomId);

    peer = new SimplePeer({ initiator: false, trickle: false });

    connectionStatus.textContent = '🟠 Joining room...';

    // Listen for offer from host
    roomRef.child('offer').once('value').then(snapshot => {
      const offer = snapshot.val();
      if (!offer) {
        logMessage('No offer found for this room.', 'system-msg');
        connectionStatus.textContent = '🔴 No offer found';
        return;
      }
      console.log('Received offer:', offer);
      peer.signal(offer);
    });

    // When peer has signaling data (answer)
    peer.on('signal', data => {
      console.log('Joiner signaling data (answer):', data);
      roomRef.child('answer').set(data);
    });

    peer.on('connect', () => {
      connectionStatus.textContent = '🟢 Connected';
      logMessage('Peer connected!', 'your-msg');
      messageInput.disabled = false;
      sendBtn.disabled = false;
    });

    peer.on('data', data => {
      logMessage(`Peer: ${data}`, 'peer-msg');
    });

    peer.on('error', err => {
      console.error('Peer error:', err);
      logMessage(`Peer error: ${err}`, 'system-msg');
      connectionStatus.textContent = '🔴 Error';
    });

    peer.on('close', () => {
      logMessage('Connection closed', 'system-msg');
      connectionStatus.textContent = '🔴 Disconnected';
      messageInput.disabled = true;
      sendBtn.disabled = true;
    });
  }

  // Send chat message
  sendBtn.onclick = () => {
    const msg = messageInput.value.trim();
    if (!msg || !peer || peer.destroyed) return;
    peer.send(msg);
    logMessage(`You: ${msg}`, 'your-msg');
    messageInput.value = '';
  };

  // Connect button click handler
  connectBtn.onclick = () => {
    console.log('Connect button clicked');
    const id = connectToRoomInput.value.trim();
    if (!id) {
      alert('Please enter a Room ID to connect.');
      return;
    }
    joinRoom(id);
  };

  // Copy room ID button
  copyRoomIdBtn.onclick = () => {
    if (!roomIdInput.value) return alert('No room ID to copy');
    navigator.clipboard.writeText(roomIdInput.value).then(() => {
      alert('Room ID copied to clipboard');
    });
  };

  // Listen for Enter key on roomIdInput to start hosting **
  roomIdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      startHosting();
    }
  });

  // If roomIdInput is blank on load, start hosting automatically
  if (!roomIdInput.value.trim()) {
    startHosting();
  } else {
    roomId = roomIdInput.value.trim();
  }

  console.log('Setup complete');
});
