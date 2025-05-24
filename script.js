document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const roomIdInput = document.getElementById('roomId');
  const connectToRoomInput = document.getElementById('connectToRoom');
  const nicknameInput = document.getElementById('nicknameInput');
  const hostBtn = document.getElementById('hostBtn');
  const connectBtn = document.getElementById('connectBtn');
  const copyRoomIdBtn = document.getElementById('copyRoomId');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const chatDiv = document.getElementById('chat');
  const connectionStatus = document.getElementById('connection-status');

  // Firebase root ref
  const dbRoot = firebase.database().ref();

  let roomId = '';
  let nickname = '';
  let peers = {};  // key: peerNickname, value: SimplePeer instance

  // Log message to chat box
  function logMessage(text, className = 'system-msg') {
    const p = document.createElement('p');
    p.textContent = text;
    p.className = className;
    chatDiv.appendChild(p);
    chatDiv.scrollTop = chatDiv.scrollHeight;
  }

  // Send message to all connected peers
  function broadcastMessage(msg) {
    Object.values(peers).forEach(peer => {
      if (peer.connected) peer.send(msg);
    });
    logMessage(`You: ${msg}`, 'your-msg');
  }

  // Setup a new peer connection
  function setupPeerConnection(peerNickname, initiator = false, incomingSignal = null) {
    if (peers[peerNickname]) return; // already connected or connecting

    const peer = new SimplePeer({ initiator, trickle: false });

    peer.on('signal', data => {
      // Send signaling data to Firebase
      dbRoot.child('rooms').child(roomId).child('signals').child(peerNickname).push({
        from: nickname,
        data: data
      });
    });

    peer.on('connect', () => {
      logMessage(`Connected to ${peerNickname}`, 'system-msg');
      connectionStatus.textContent = '🟢 Connected';
      messageInput.disabled = false;
      sendBtn.disabled = false;
    });

    peer.on('data', data => {
      logMessage(`${peerNickname}: ${data}`, 'peer-msg');
    });

    peer.on('error', err => {
      console.error(`Error with peer ${peerNickname}:`, err);
      logMessage(`Error with peer ${peerNickname}: ${err}`, 'system-msg');
    });

    peer.on('close', () => {
      logMessage(`Disconnected from ${peerNickname}`, 'system-msg');
      delete peers[peerNickname];
      if (Object.keys(peers).length === 0) {
        connectionStatus.textContent = '🔴 Disconnected';
        messageInput.disabled = true;
        sendBtn.disabled = true;
      }
    });

    if (incomingSignal) {
      try {
        peer.signal(incomingSignal);
      } catch (err) {
        console.error('Error applying incoming signal:', err);
      }
    }

    peers[peerNickname] = peer;
  }

  // Listen for incoming signaling data (Firebase)
  function listenForSignals() {
    const signalsRef = dbRoot.child('rooms').child(roomId).child('signals');
    signalsRef.on('child_added', snapshot => {
      const peerNickname = snapshot.key;
      if (peerNickname === nickname) return; // ignore own signals

      snapshot.ref.on('child_added', signalSnap => {
        const { from, data } = signalSnap.val();

        if (from === nickname) return; // ignore signals from self

        // Setup peer connection or signal existing peer
        if (!peers[peerNickname]) {
          setupPeerConnection(peerNickname, false, data);
        } else {
          peers[peerNickname].signal(data);
        }
      });
    });
  }

  // Clear signals for a room (hosting cleanup)
  function clearSignals() {
    dbRoot.child('rooms').child(roomId).child('signals').remove();
  }

  // Host room
  hostBtn.onclick = () => {
    nickname = nicknameInput.value.trim() || `User${Math.floor(Math.random() * 1000)}`;
    roomId = roomIdInput.value.trim() || `Room${Math.floor(Math.random() * 10000)}`;
    roomIdInput.value = roomId;
    connectToRoomInput.value = '';

    clearSignals();
    logMessage(`Hosting room "${roomId}" as "${nickname}"`, 'system-msg');
    connectionStatus.textContent = '🟠 Waiting for connections...';

    listenForSignals();

    messageInput.disabled = true;
    sendBtn.disabled = true;
  };

  // Connect to room
  connectBtn.onclick = () => {
    nickname = nicknameInput.value.trim() || `User${Math.floor(Math.random() * 1000)}`;
    roomId = connectToRoomInput.value.trim();
    if (!roomId) {
      alert("Please enter a Room ID to connect to.");
      return;
    }
    roomIdInput.value = '';
    logMessage(`Joining room "${roomId}" as "${nickname}"`, 'system-msg');

    listenForSignals();

    // For joining, we initiate a peer connection to "Host"
    setupPeerConnection('Host', true);

    messageInput.disabled = true;
    sendBtn.disabled = true;
  };

  // Send button
  sendBtn.onclick = () => {
    const msg = messageInput.value.trim();
    if (!msg) return;
    broadcastMessage(msg);
    messageInput.value = '';
  };

  // Copy room ID button
  copyRoomIdBtn.onclick = () => {
    if (!roomIdInput.value) return alert('No room ID to copy');
    navigator.clipboard.writeText(roomIdInput.value).then(() => {
      alert('Room ID copied to clipboard');
    });
  };

  // Optional: Send message on enter key in message input
  messageInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendBtn.click();
    }
  });

  // Optional: Prevent Enter from copying room id to connect or vice versa
  roomIdInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      hostBtn.click();
    }
  });

  connectToRoomInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      connectBtn.click();
    }
  });

});
