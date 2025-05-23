// Configuration with fallback STUN servers
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

// Generate a random room ID
let roomId = generateRoomId();
roomIdInput.value = roomId;

let peer;
let isInitiator = false;
let retryCount = 0;
const MAX_RETRIES = 3;

// Copy room ID button
copyRoomIdBtn.addEventListener('click', () => {
    roomIdInput.select();
    document.execCommand('copy');
    addSystemMessage('Room ID copied to clipboard!');
});

// Connect button
connectBtn.addEventListener('click', () => {
    const targetRoomId = connectToRoomInput.value.trim();
    if (targetRoomId) {
        roomId = targetRoomId;
        isInitiator = true;
        setupPeerConnection();
        addSystemMessage(`Attempting to connect to room: ${roomId}`);
    }
});

// Send button
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Set up the peer connection with improved error handling
function setupPeerConnection() {
    // Clear previous peer if exists
    if (peer) peer.destroy();
    
    peer = new SimplePeer({
        initiator: isInitiator,
        config: config,
        trickle: false
    });

    // Debugging logs
    peer.on('signal', (data) => {
        console.log('Signal Data:', data);
        localStorage.setItem(`signal_${roomId}`, JSON.stringify(data));
        checkForSignals();
    });

    peer.on('connect', () => {
        console.log('Peer connected!');
        sendBtn.disabled = false;
        addSystemMessage('Peer connected! You can now chat.');
        retryCount = 0; // Reset on success
    });

    peer.on('data', (data) => {
        addMessage(data.toString(), 'peer');
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
        addSystemMessage(`Error: ${err.message}`);
        attemptReconnect();
    });

    peer.on('close', () => {
        addSystemMessage('Peer disconnected');
        sendBtn.disabled = true;
    });

    // Fallback: Enable send button after timeout
    setTimeout(() => {
        if (sendBtn.disabled && retryCount < MAX_RETRIES) {
            addSystemMessage('Warning: Connection unstable. Retrying...');
            attemptReconnect();
        }
    }, 10000);
}

// Improved signaling with retries
function checkForSignals() {
    const checkInterval = setInterval(() => {
        const signalData = localStorage.getItem(`signal_${roomId}`);
        if (signalData) {
            try {
                const signal = JSON.parse(signalData);
                console.log('Received signal:', signal);
                if (signal.type !== (peer._lastSignalType || '')) {
                    peer.signal(signal);
                    localStorage.removeItem(`signal_${roomId}`);
                    if (isInitiator) clearInterval(checkInterval);
                }
            } catch (e) {
                console.error('Signal parse error:', e);
            }
        }
    }, 1000);
}

// Automatic reconnection
function attemptReconnect() {
    if (retryCount >= MAX_RETRIES) {
        addSystemMessage('Max retries reached. Please refresh the page.');
        return;
    }
    
    retryCount++;
    console.log(`Reconnection attempt ${retryCount}/${MAX_RETRIES}`);
    addSystemMessage(`Reconnecting... (${retryCount}/${MAX_RETRIES})`);
    setTimeout(setupPeerConnection, 2000 * retryCount); // Exponential backoff
}

// Send message function
function sendMessage() {
    const message = messageInput.value.trim();
    if (message && peer && peer.connected) {
        peer.send(message);
        addMessage(message, 'you');
        messageInput.value = '';
    } else if (!peer.connected) {
        addSystemMessage('Not connected yet. Please wait...');
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

// Auto-start if URL has a room parameter
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetRoom = urlParams.get('room');
    
    if (targetRoom) {
        connectToRoomInput.value = targetRoom;
        connectBtn.click();
    } else {
        addSystemMessage(`Your room ID is: ${roomId}. Share it to connect.`);
    }
});
