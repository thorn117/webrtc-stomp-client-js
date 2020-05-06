let socket = new SockJS('https://46.223.110.112:8080/socket');
let stompClient = Stomp.over(socket);
stompClient.debug = null;
let localId;

let peerConnections = [];

class PeerConnection {
    constructor(userId, configuration) {
        this.userId = userId;
        this.connected = false;
        this.configuration = configuration;
        this.connection = new RTCPeerConnection(configuration);
        this.connection.onicecandidate = ev => {
            if (ev.candidate) {
                sendSignalingToPeer(this.userId, {
                    event: "candidate",
                    data: ev.candidate,
                    userId: localId
                });
            }
        };
    }
}


const sendSignaling = msg =>
    stompClient.send("/app/rtc-message/room/wald", {}, JSON.stringify(msg));


const sendSignalingToPeer = (userId, msg) =>
    stompClient.send(`/app/signaling/wald/${userId}`, {}, JSON.stringify(msg));


const connect = () => (stompClient.connect({}, frame => {
    console.log("connected to ws :)");
    const constraints = {
        video: true, audio: false
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            // document.querySelector("#localVideo").srcObject = stream;
            window.localStream = stream;
        })
        .catch(err => { console.log(err); });

    localId = frame.headers['user-name'];

    stompClient.subscribe('/topic/room/wald/' + frame.headers['user-name'], handleSelfSubscription);
    stompClient.subscribe('/app/topic/room/wald', handleRoomSubscription);
}))();


const handleSelfSubscription = msg => {
    let content = JSON.parse(msg.body);

    switch (content.event) {
        case "offer": handleOffer(content); break;
        case "answer": handleAnswer(content); break;
        case "candidate": handleCandidate(content); break;
        default: break;
    }
}

const handleRoomSubscription = msg => {
    let json = JSON.parse(msg.body)
    const userIds = json.userIds;
    userIds.forEach(id => {
        if (!peerConnections.some(pc => pc.userId == id)) {
            let pc = new PeerConnection(id, null);
            peerConnections.push(pc);
            createOffer(pc);
        }
    });
}

const createOffer = pc => {
    pc.connection.createOffer(offer => {
        sendSignalingToPeer(pc.userId, {
            event: "offer",
            data: offer,
            userId: localId
        });
        pc.connection.setLocalDescription(offer);
    }, error => alert("Error creating an offer"));
}

const handleOffer = content => {
    let send = false;
    let pc = peerConnections.find(pc => content.userId == pc.userId);

    if (!pc) {
        // no connection to this peer exists
        pc = new PeerConnection(content.userId, null);
        peerConnections.push(pc);
        send = true;
    }

    window.localStream.getTracks().forEach(track => {
        pc.connection.addTrack(track, window.localStream)
    });

    pc.connection.ontrack = e => {
        let audio = document.createElement('video');
        audio.setAttribute("autoplay", "true");
        audio.setAttribute("playsinline", true);
        document.querySelector("body").appendChild(audio);
        audio.srcObject = e.streams[0];
    };

    pc.connection.setRemoteDescription(new RTCSessionDescription(content.data));

    pc.connection.createAnswer(answer => {
        pc.connection.setLocalDescription(answer);
        sendSignalingToPeer(pc.userId, {
            event: "answer",
            data: answer,
            userId: localId
        });

        if (send) createOffer(pc);

    }, error => {
        alert("Error creating an answer");
    });

};

const handleCandidate = content => {
    let pc = peerConnections.find(pc => content.userId == pc.userId);
    pc.connection.addIceCandidate(new RTCIceCandidate(content.data));
};

const handleAnswer = content => {
    let pc = peerConnections.find(p => content.userId == p.userId);
    if (!pc) {
        pc = new PeerConnection(content.userId, null);
        peerConnections.push(pc);
    }
    pc.connection.setRemoteDescription(new RTCSessionDescription(content.data));
};