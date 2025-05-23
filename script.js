// ================ CONFIGURATION ================
const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// ================ STATE MANAGEMENT ================
const appState = {
    peer: null,
    isInitiator: false,
    retryCount: 0,
    MAX_RETRIES: 3,
    roomId: generateRoomId(),
    connected: false
};

// ================ DOM ELEMENTS ================
const elements = {
    chat: document.getElementById('chat'),
    messageInput: document.getElementById('message'),
    sendBtn: document.getElementById('sendBtn'),
    roomId: document.getElementById('roomId'),
    copyRoomIdBtn: document.getElementById('copyRoomId'),
    connectToRoom: document.getElementById('connectToRoom'),
    connectBtn: document.getElementById('connectBtn'),
    connectionStatus: document.getElementById('connection-status') // Add this to your HTML
};

// ================ CORE FUNCTIONS ================
function initializeApp() {
    // Set up initial UI
    elements.roomId.value = appState.roomId;
    addSystemMessage(`Your room ID: ${appState.roomId}. Share it to connect.`);

    // Event listeners
    elements.copyRoomIdBtn.addEventListener('click', copyRoomId);
    elements.connectBtn.addEventListener('click', handleConnect);
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keypress', handleKeyPress);

    // Auto-connect if URL has room parameter
    const urlParams = new URLSearchParams(window.location.search);
    const targetRoom = urlParams.get('room');
    if (targetRoom) {
        elements.connectToRoom.value = targetRoom;
        handleConnect();
    }
}

function handleConnect() {
    const targetRoomId = elements.connectToRoom.value.trim();
    if (!targetRoomId) return;

    if (typeof SimplePeer === 'undefined') {
        addSystemMessage('Error: Chat system not loaded. Please refresh the page.');
        console.error('SimplePeer not defined');
        return;
    }

    appState.roomId = targetRoomId;
    appState.isInitiator = true;
    setupPeerConnection();
    addSystemMessage(`Connecting to room: ${targetRoomId}...`);
}

function setupPeerConnection() {
    // Clean up previous connection if exists
    if (appState.peer) {
        appState.peer.destroy();
    }

    appState.peer = new SimplePeer({
        initiator: appState.isInitiator,
        config: config,
        trickle: false
    });

    // Event handlers
    appState.peer.on('signal', handleSignal);
    appState.peer.on('connect', handlePeerConnect);
    appState.peer.on('data', handleData);
    appState.peer.on('error', handlePeerError);
    appState.peer.on('close', handlePeerClose);

    // Fallback timeout
    setTimeout(() => {
        if (!appState.connected && appState.retryCount < appState.MAX_RETRIES) {
            attemptReconnect();
        }
    }, 10000);
}

// ================ PEER EVENT HANDLERS ================
function handleSignal(data) {
    console.log('Signal data:', data);
    localStorage.setItem(`signal_${appState.roomId}`, JSON.stringify(data));
    checkForSignals();
}

function handlePeerConnect() {
    console.log('WebRTC connection established!');
    appState.connected = true;
    appState.retryCount = 0;
    elements.sendBtn.disabled = false;
    addSystemMessage('Connection successful! You can now chat.');
    updateConnectionStatus(true);
}

function handleData(data) {
    addMessage(data.toString(), 'peer');
}

function handlePeerError(err) {
    console.error('Peer error:', err);
    addSystemMessage(`Connection error: ${err.message}`);
    attemptReconnect();
}

function handlePeerClose() {
    console.log('Peer disconnected');
    appState.connected = false;
    elements.sendBtn.disabled = true;
    addSystemMessage('Peer disconnected');
    updateConnectionStatus(false);
}

// ================ CONNECTION MANAGEMENT ================
function checkForSignals() {
    const checkInterval = setInterval(() => {
        const signalData = localStorage.getItem(`signal_${appState.roomId}`);
        if (signalData) {
            try {
                const signal = JSON.parse(signalData);
                if (signal.type !== (appState.peer._lastSignalType || '')) {
                    appState.peer.signal(signal);
                    localStorage.removeItem(`signal_${appState.roomId}`);
                    if (appState.isInitiator) clearInterval(checkInterval);
                }
            } catch (e) {
                console.error('Error parsing signal:', e);
            }
        }
    }, 1000);
}

function attemptReconnect() {
    if (appState.retryCount >= appState.MAX_RETRIES) {
        addSystemMessage('Maximum connection attempts reached. Please refresh.');
        return;
    }

    appState.retryCount++;
    console.log(`Reconnection attempt ${appState.retryCount}/${appState.MAX_RETRIES}`);
    addSystemMessage(`Reconnecting... (${appState.retryCount}/${appState.MAX_RETRIES})`);
    setTimeout(setupPeerConnection, 2000 * appState.retryCount);
}

// ================ MESSAGE FUNCTIONS ================
function sendMessage() {
    const message = elements.messageInput.value.trim();
    if (!message || !appState.peer || !appState.connected) return;

    try {
        appState.peer.send(message);
        addMessage(message, 'you');
        elements.messageInput.value = '';
    } catch (err) {
        console.error('Send error:', err);
        addSystemMessage('Failed to send message. Try again.');
    }
}

function handleKeyPress(e) {
    if (e.key === 'Enter') sendMessage();
}

// ================ UI FUNCTIONS ================
function addMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add(sender === 'you' ? 'your-msg' : 'peer-msg');
    msgDiv.textContent = text;
    elements.chat.appendChild(msgDiv);
    elements.chat.scrollTop = elements.chat.scrollHeight;
}

function addSystemMessage(text) {
    const sysDiv = document.createElement('div');
    sysDiv.classList.add('system-msg');
    sysDiv.textContent = text;
    elements.chat.appendChild(sysDiv);
    elements.chat.scrollTop = elements.chat.scrollHeight;
}

function updateConnectionStatus(isConnected) {
    if (elements.connectionStatus) {
        elements.connectionStatus.textContent = isConnected ? '🟢 Connected' : '🔴 Disconnected';
        elements.connectionStatus.style.color = isConnected ? 'green' : 'red';
    }
}

function copyRoomId() {
    elements.roomId.select();
    document.execCommand('copy');
    addSystemMessage('Room ID copied to clipboard!');
}

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8);
}

// ================ INITIALIZATION ================
function checkDependencies() {
    if (typeof SimplePeer === 'undefined') {
        console.log('SimplePeer not found, loading from CDN...');
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/simple-peer/9.11.1/simple-peer.min.js';
        script.onload = initializeApp;
        script.onerror = () => {
            addSystemMessage('Failed to load chat system. Please try again later.');
            console.error('Failed to load SimplePeer');
        };
        document.head.appendChild(script);
    } else {
        initializeApp();
    }
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', checkDependencies);
