document.addEventListener('DOMContentLoaded', () => {
  const dbRoot = firebase.database().ref();

  const nicknameInput = document.getElementById('nicknameInput');
  const roomIdInput = document.getElementById('roomId');
  const connectToRoomInput = document.getElementById('connectToRoom');
  const connectBtn = document.getElementById('connectBtn');
  const copyRoomIdBtn = document.getElementById('copyRoomId');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const chatDiv = document.getElementById('chat');
  const connectionStatus = document.getElementById('connection-status');

  let nickname = '';
  let roomId = '';
  let peers = {}; // Keyed by remote peerId

  function logMessage(text, className = 'system-msg') {
    const p = document.createElement('p');
    p.textContent = text;
    p.className = className;
    chatDiv.appendChild(p);
    chatDiv.scrollTop = chatDiv.scrollHeight;
  }

  function broadcastMessage(msg) {
    for (const peerId in peers) {
      if (peers[peerId].connected) {
        peers[peerId].send(JSON.stringify({ nickname, msg }));
      }
    }
    logMessage(`You: ${msg}`, 'your-msg');
  }

  function setupPeerConnection(peerId, isInitiator, signalData = null) {
    const peer = new SimplePeer({ initiator: isInitiator, trickle: false });

    peers[peerId] = peer;

    const peerRef = dbRoot.child('rooms').child(roomId).child('signals').child(peerId);

    peer.on('signal', data => {
      peerRef.child('signalsToSend').push({ to: peerId, from: nickname, data });
    });

    peer.on('connect', () => {
      logMessage(`✅ Connected to ${peerId}`, 'system-msg');
      connectionStatus.textContent = '🟢 Connected';
      messageInput.disabled = false;
      sendBtn.disabled = false;
    });

    peer.on('data', data => {
      try {
        const { nickname: from, msg } = JSON.parse(data);
        logMessage(`${from}: ${msg}`, 'peer-msg');
      } catch {
        logMessage(`Message from ${peerId}: ${data}`, 'peer-msg');
      }
    });

    peer.on('error', err => {
      console.error(`Peer ${peerId} error:`, err);
      logMessage(`⚠️ Peer error: ${err}`, 'system-msg');
    });

    peer.on('close', () => {
      logMessage(`Connection closed with ${peerId}`, 'system-msg');
      delete peers[peerId];
    });

    if (signalData) {
      peer.signal(signalData);
    }
  }

  function joinRoom() {
    nickname = nicknameInput.value.trim() || `User${Math.floor(Math.random() * 1000)}`;
    roomId = connectToRoomInput.value.trim();
    roomIdInput.value = roomId;

    const signalsRef = dbRoot.child('rooms').child(roomId).child('signals');

    signalsRef.once('value').then(snapshot => {
      const others = snapshot.val() || {};

      // Connect to each existing peer
      Object.keys(others).forEach(peerId => {
        if (peerId === nickname) return;
        setupPeerConnection(peerId, true); // initiator
      });

      // Listen for new signaling data from others
      signalsRef.child(nickname).child('signalsToSend').on('child_added', snap => {
        const { from, data } = snap.val();
        if (!peers[from]) {
          setupPeerConnection(from, false, data);
        } else {
          peers[from].signal(data);
        }
      });
    });
  }

  sendBtn.onclick = () => {
    const msg = messageInput.value.trim();
    if (!msg) return;
    broadcastMessage(msg);
    messageInput.value = '';
  };

  connectBtn.onclick = () => {
    if (!connectToRoomInput.value.trim()) {
      alert('Enter Room ID');
      return;
    }
    joinRoom();
  };

  roomIdInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      connectToRoomInput.value = roomIdInput.value;
      joinRoom();
    }
  });

  copyRoomIdBtn.onclick = () => {
    if (!roomIdInput.value) return alert('No room ID to copy');
    navigator.clipboard.writeText(roomIdInput.value).then(() => {
      alert('Room ID copied');
    });
  };
});
