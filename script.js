// Configuration
const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }, // Free public STUN server
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

// Set up the peer connection
function setupPeerConnection() {
    peer = new SimplePeer({
        initiator: isInitiator,
        config: config,
        trickle: false
    });

    // When we get a signal, we need to "send" it to the other peer
    // In a real app, this would go through a signaling server
    // Here we'll simulate it by storing in localStorage
    peer.on('signal', (data) => {
        localStorage.setItem(`signal_${roomId}`, JSON.stringify(data));
        
        // Check for signals from the other peer
        checkForSignals();
    });

    peer.on('connect', () => {
        addSystemMessage('Peer connected! You can now chat.');
        sendBtn.disabled = false;
    });

    peer.on('data', (data) => {
        addMessage(data.toString(), 'peer');
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
        addSystemMessage(`Error: ${err.message}`);
    });

    peer.on('close', () => {
        addSystemMessage('Peer disconnected');
        sendBtn.disabled = true;
    });
}

// Check for signals from the other peer
function checkForSignals() {
    const checkInterval = setInterval(() => {
        const signalData = localStorage.getItem(`signal_${roomId}`);
        if (signalData) {
            try {
                const signal = JSON.parse(signalData);
                if (signal.type !== peer._lastSignalType) {
                    peer.signal(signal);
                    localStorage.removeItem(`signal_${roomId}`);
                    
                    if (isInitiator) {
                        clearInterval(checkInterval);
                    }
                }
            } catch (e) {
                console.error('Error parsing signal:', e);
            }
        }
    }, 1000);
}

// Send a message
function sendMessage() {
    const message = messageInput.value.trim();
    if (message && peer && peer.connected) {
        peer.send(message);
        addMessage(message, 'you');
        messageInput.value = '';
    }
}

// Add a message to the chat
function addMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add(sender === 'you' ? 'your-msg' : 'peer-msg');
    msgDiv.textContent = text;
    chatDiv.appendChild(msgDiv);
    chatDiv.scrollTop = chatDiv.scrollHeight;
}

// Add a system message
function addSystemMessage(text) {
    const sysDiv = document.createElement('div');
    sysDiv.classList.add('system-msg');
    sysDiv.textContent = text;
    chatDiv.appendChild(sysDiv);
    chatDiv.scrollTop = chatDiv.scrollHeight;
}

// Generate a random room ID
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
