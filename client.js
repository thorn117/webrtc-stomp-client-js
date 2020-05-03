// const conn = new WebSocket('wss://46.223.110.112:8080/socket')

let peerConnection;
let localStream;

let socket = new SockJS('https://46.223.110.112:8080/socket');
let stompClient = Stomp.over(socket);
stompClient.connect({}, frame => {
    let configuration = null;

    const constraints = {
        video: true, audio: false
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            // document.querySelector("#localVideo").srcObject = stream;
            localStream = stream;
        })
        .catch(err => { console.log(err); });

    peerConnection = new RTCPeerConnection(configuration);
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            sendSignaling({
                event: "candidate",
                data: event.candidate
            });
        }
    };

    stompClient.subscribe('/topic/room/wald/' + frame.headers['user-name'], handleSelfSubscription);
    stompClient.subscribe('/topic/room/wald/', msg => console.log(msg));
});


const handleSelfSubscription = msg => {
    let content = JSON.parse(msg.body);
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
}

const sendSignaling = msg => 
    stompClient.send("/app/rtc-message/room/wald", {}, JSON.stringify(msg));


const createOffer = () => {
    console.log("createOffer");
    peerConnection.createOffer(offer => {
        console.log("OFFER", offer)
        sendSignaling({
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
        sendSignaling({
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