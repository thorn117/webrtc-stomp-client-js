// Use your ip configured in spring
let stompClient = Stomp.over(new SockJS('https://192.168.80:8080/socket'));
stompClient.debug = null;

let localId;
let roomName;
let peerConnections = [];

class PeerConnection {
    constructor(userId, configuration) {
        this.userId = userId;
        this.video = null;
        this.configuration = configuration;
        this.connection = new RTCPeerConnection(configuration);
        this.initConnectionListeners();
    }

    createOffer() {
        this.connection.createOffer(offer => {
            sendSignalingToPeer(this.userId, {
                event: "offer",
                data: offer,
                userId: localId
            });
            this.connection.setLocalDescription(offer);
        }, error => console.error("Error creating an offer", error));
    }

    initConnectionListeners() {
        this.connection.onicecandidate = ev => {
            if (ev.candidate) {
                sendSignalingToPeer(this.userId, {
                    event: "candidate",
                    data: ev.candidate,
                    userId: localId
                });
            }
        };

        this.connection.onconnectionstatechange = e => {
            switch (e.target.connectionState) {
                case 'disconnected':
                    this.video.parentNode.removeChild(this.video);
                    peerConnections = peerConnections.filter(c => c !== this);
                    break;
                default: break;
            }
        };

        this.connection.ontrack = e => {
            if (![...document.querySelectorAll('video')].some(v => this.userId == v.getAttribute('id'))) {
                let video = document.createElement('video');
                video.setAttribute('id', this.userId);
                video.setAttribute('autoplay', true);
                video.setAttribute('playsinline', true);
                UI.peerVideos.appendChild(video);
                video.srcObject = e.streams[0];
                this.video = video;
            }
        };
    }
}

const sendSignaling = msg =>
    stompClient.send("/app/rtc-message/room/wald", {}, JSON.stringify(msg));


const sendSignalingToPeer = (userId, msg) =>
    stompClient.send(`/app/signaling/${roomName}/${userId}`, {}, JSON.stringify(msg));


const connect = () => (stompClient.connect({}, async frame => {
    roomName = UI.roomNameInput.value;
    const constraints = {
        video: true, audio: true
    };
    await navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            UI.selfVideo.srcObject = stream;
            window.localStream = stream;
        })
        .catch(err => console.error(err));

    localId = frame.headers['user-name'];

    stompClient.subscribe(`/topic/room/${roomName}/${frame.headers['user-name']}`, handleSelfSubscription);
    stompClient.subscribe(`/app/topic/room/${roomName}`, handleRoomSubscription);
}))();


const handleSelfSubscription = msg => {
    let content = JSON.parse(msg.body);
    switch (content.event) {
        case 'offer': handleOffer(content); break;
        case 'answer': handleAnswer(content); break;
        case 'candidate': handleCandidate(content); break;
        default: break;
    }
};


const handleRoomSubscription = msg => {
    let json = JSON.parse(msg.body)
    const userIds = json.userIds;
    userIds.forEach(id => {
        if (!peerConnections.some(pc => pc.userId == id)) {
            let pc = new PeerConnection(id, null);
            peerConnections.push(pc);
            pc.createOffer();
        }
    });
};


const handleOffer = content => {
    let send = false;
    let pc = peerConnections.find(pc => content.userId == pc.userId);
    if (!pc) {
        // no connection to this peer exists
        pc = new PeerConnection(content.userId, null);
        peerConnections.push(pc);
        send = true;
    }
    window.localStream.getTracks().forEach(track =>
        pc.connection.addTrack(track, window.localStream));

    pc.connection.setRemoteDescription(new RTCSessionDescription(content.data));

    pc.connection.createAnswer(answer => {
        pc.connection.setLocalDescription(answer);
        sendSignalingToPeer(pc.userId, {
            event: 'answer',
            data: answer,
            userId: localId
        });
        if (send) pc.createOffer();
    }, err => {
        console.err("Error creating an answer.", err);
    });
};


const handleCandidate = content => {
    peerConnections.find(pc => content.userId == pc.userId)
        .connection.addIceCandidate(new RTCIceCandidate(content.data));
};


const handleAnswer = content => {
    let pc = peerConnections.find(p => content.userId == p.userId);
    if (!pc) {
        pc = new PeerConnection(content.userId, null);
        peerConnections.push(pc);
    }
    pc.connection.setRemoteDescription(new RTCSessionDescription(content.data));
};


// UI

const UI = {
    roomNameInput: document.querySelector('#room-name'),
    connectButton: document.querySelector('#connect-button'),
    peerVideos: document.querySelector('#peers'),
    selfVideo: document.querySelector('#me')
};

UI.roomNameInput.addEventListener('input', e => {
    if (e.target.value.length > 0) {
        UI.connectButton.removeAttribute('disabled');
    } else {
        UI.connectButton.setAttribute('disabled', true);
    }
});

UI.roomNameInput.addEventListener('keyup', e => {
    if (e.keyCode === 13) {
        e.preventDefault();
        UI.connectButton.click();
    }
});