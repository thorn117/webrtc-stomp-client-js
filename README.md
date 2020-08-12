# webrtc-stomp-client-js
This is a webRTC client in vanilla js.

Check out the [demo](https://webrtcvideochat.paperwave.xyz/).

It uses a STOMP backend: [webrtc-stomp-server](https://github.com/thorn117/webrtc-stomp-server).

## Run

WebRTC only works with secure connections. An example self-signed-cert is included. It's required to allow access to this site and the server from the browser.

Run with `python simple-https-server.py`

The socket address in `client.js` has to be adjusted to the ip configured in the spring `application.properties`.
