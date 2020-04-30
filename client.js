const conn = new WebSocket('wss://46.223.110.112:8080/socket')

let peerConnection;
let dataChannel;

let localStream;

conn.onopen = () => {
    console.log("Connected to the signaling server");
    initialize();
};

conn.onmessage = (msg) => {
    console.log("Got message", msg.data);
    let content = JSON.parse(msg.data);
    let data = content.data;
    switch (content.event) {
        case "offer":
            handleOffer(data);
            break;
        case "answer":
            handleAnswer(data);
            break;
        case "candidate":
            handleCandidate(data);
            break;
        default:
            break;
    }
};

const send = (message) => {
    conn.send(JSON.stringify(message));
}

const initialize = () => {
    let configuration = null;

    const constraints = {
        video: true, audio: false
    };

    navigator.mediaDevices.getUserMedia(constraints).
        then(function (stream) {
            // document.querySelector("#localVideo").srcObject = stream;
            localStream = stream;
        })
        .catch(function (err) { /* handle the error */ });



    peerConnection = new RTCPeerConnection(configuration, {
        optional: [{
            RtpDataChannels: true
        }]
    });

    // Setup ice handling
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            send({
                event: "candidate",
                data: event.candidate
            });
        }
    };

    // creating data channel
    dataChannel = peerConnection.createDataChannel("dataChannel", {
        reliable: true
    });


    dataChannel.onerror = error => {
        console.log("Error occured on datachannel:", error);
    };

    // when we receive a message from the other peer, printing it on the console
    dataChannel.onmessage = event => {
        console.log("message:", event.data);
    };

    dataChannel.onclose = () => {
        console.log("data channel is closed");
    };
}

const createOffer = () => {
    console.log("createOffer");
    peerConnection.createOffer(offer => {
        console.log("OFFER", offer)
        send({
            event: "offer",
            data: offer
        });
        peerConnection.setLocalDescription(offer);
    }, error => {
        alert("Error creating an offer");
    });
}

const handleOffer = offer => {
    console.log("handleOffer");
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    peerConnection.addStream(localStream);
    peerConnection.onaddstream = event => {
        document.querySelector("#remoteVideo").srcObject = event.stream;
    };

    // create and send an answer to an offer
    peerConnection.createAnswer(answer => {
        peerConnection.setLocalDescription(answer);
        send({
            event: "answer",
            data: answer
        });
    }, error => {
        alert("Error creating an answer");
    });

};

const handleCandidate = candidate => {
    console.log("handleCandidate");
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
};

const handleAnswer = answer => {
    console.log("handleAnswer");
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log("connection established successfully!!");
};