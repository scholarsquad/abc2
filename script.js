const roomIdEl = document.getElementById('roomId');
const connectToEl = document.getElementById('connectToRoom');
const connectBtn = document.getElementById('connectBtn');
const copyBtn = document.getElementById('copyRoomId');
const chatEl = document.getElementById('chat');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const connectionStatus = document.getElementById('connection-status');

let peer;
let database = firebase.database();

// If user leaves it blank, auto-generate a Room ID
let myRoomId = roomIdEl.value.trim();
if (!myRoomId) {
    myRoomId = Math.random().toString(36).substring(2, 10);
    roomIdEl.value = myRoomId;
}


copyBtn.onclick = () => {
    navigator.clipboard.writeText(myRoomId);
    alert("Room ID copied!");
};

connectBtn.onclick = async () => {
    const targetRoom = connectToEl.value.trim();
    if (!targetRoom) return alert("Enter a Room ID");

    setupPeer(false);
    const connRef = database.ref("rooms/" + targetRoom);
    connRef.on("value", snapshot => {
        const data = snapshot.val();
        if (data && data.offer && !peer.destroyed) {
            peer.signal(data.offer);
        }
    });

    // Store answer in their room
    peer.on("signal", data => {
        connRef.update({ answer: data });
    });
};

// Wait for a connection offer
const myConnRef = database.ref("rooms/" + myRoomId);
setupPeer(true);
peer.on("signal", data => {
    myConnRef.set({ offer: data });
});
myConnRef.on("value", snapshot => {
    const data = snapshot.val();
    if (data && data.answer && !peer.destroyed) {
        peer.signal(data.answer);
    }
});

// Setup peer
function setupPeer(initiator) {
    peer = new SimplePeer({ initiator, trickle: false });

    peer.on("connect", () => {
        connectionStatus.textContent = "🟢 Connected";
        connectionStatus.classList.add("connected");
        messageInput.disabled = false;
        sendBtn.disabled = false;
        appendMsg("System", "Connected!");
    });

    peer.on("data", data => {
        appendMsg("Peer", data.toString(), "peer-msg");
    });

    peer.on("error", err => {
        console.error("Peer error:", err);
    });
}

sendBtn.onclick = () => {
    const msg = messageInput.value.trim();
    if (msg) {
        peer.send(msg);
        appendMsg("You", msg, "your-msg");
        messageInput.value = "";
    }
};

function appendMsg(sender, text, className = "system-msg") {
    const div = document.createElement("div");
    div.className = className;
    div.textContent = `${sender}: ${text}`;
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
}
