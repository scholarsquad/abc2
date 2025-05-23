// Configuration with multiple STUN servers
const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// DOM elements
const chatDiv = document.getElementById('chat');
const messageInput = document.getElementById('message');
const sendBtn = document.getElementById('sendBtn');
const roomIdInput = document.getElementById('roomId');
const copyRoomIdBtn = document.getElementById('copyRoomId');
const connectToRoomInput = document.getElementById('connectToRoom');
const connectBtn = document.getElementById('connectBtn');

// Generate random room ID
let roomId = generateRoomId();
roomIdInput.value = roomId;

let peer;
let isInitiator = false;
let retryCount = 0;
const MAX_RETRIES = 3;

// Copy room ID
copyRoomIdBtn.addEventListener('click', () => {
    roomIdInput.select();
    document.execCommand('copy');
    addSystemMessage('Room ID copied to clipboard!');
});

// Connect to room
connectBtn.addEventListener('click', () => {
    const targetRoomId = connectToRoomInput.value.trim();
    if (targetRoomId) {
        roomId = targetRoomId;
        isInitiator = true;
        setupPeerConnection();
        addSystemMessage(`Connecting to room: ${roomId}...`);
    }
});

// Message sending
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Peer connection setup
function setupPeerConnection() {
    if (peer) peer.destroy();
    
    peer = new SimplePeer({
        initiator: isInitiator,
        config: config,
        trickle: false
    });

    peer.on('signal', (data) => {
        console.log('Signal:', data);
        localStorage.setItem(`signal_${roomId}`, JSON.stringify(data));
        checkForSignals();
    });

    peer.on('connect', () => {
        console.log('WebRTC connected!');
        sendBtn.disabled = false;
        addSystemMessage('Connected! Start chatting.');
        retryCount = 0;
    });

    peer.on('data', (data) => {
        addMessage(data.toString(), 'peer');
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
        addSystemMessage(`Error: ${err.message}`);
        attemptReconnect();
    });

    // Fallback: Enable send after timeout
    setTimeout(() => {
        if (sendBtn.disabled && retryCount < MAX_RETRIES) {
            attemptReconnect();
        }
    }, 10000);
}

// Signal checking
function checkForSignals() {
    const checkInterval = setInterval(() => {
        const signalData = localStorage.getItem(`signal_${roomId}`);
        if (signalData) {
            try {
                const signal = JSON.parse(signalData);
                if (signal.type !== (peer._lastSignalType || '')) {
                    peer.signal(signal);
                    localStorage.removeItem(`signal_${roomId}`);
                    if (isInitiator) clearInterval(checkInterval);
                }
            } catch (e) {
                console.error('Signal error:', e);
            }
        }
    }, 1000);
}

// Reconnection logic
function attemptReconnect() {
    if (retryCount >= MAX_RETRIES) {
        addSystemMessage('Failed to connect. Refresh and try again.');
        return;
    }
    retryCount++;
    addSystemMessage(`Retrying connection (${retryCount}/${MAX_RETRIES})...`);
    setTimeout(setupPeerConnection, 2000 * retryCount);
}

// Message handling
function sendMessage() {
    const message = messageInput.value.trim();
    if (message && peer && peer.connected) {
        peer.send(message);
        addMessage(message, 'you');
        messageInput.value = '';
    }
}

// UI helpers
function addMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add(sender === 'you' ? 'your-msg' : 'peer-msg');
    msgDiv.textContent = text;
    chatDiv.appendChild(msgDiv);
    chatDiv.scrollTop = chatDiv.scrollHeight;
}

function addSystemMessage(text) {
    const sysDiv = document.createElement('div');
    sysDiv.classList.add('system-msg');
    sysDiv.textContent = text;
    chatDiv.appendChild(sysDiv);
    chatDiv.scrollTop = chatDiv.scrollHeight;
}

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8);
}

// Auto-connect if URL has room ID
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetRoom = urlParams.get('room');
    
    if (targetRoom) {
        connectToRoomInput.value = targetRoom;
        connectBtn.click();
    } else {
        addSystemMessage(`Your room ID: ${roomId}. Share it to connect.`);
    }
});
