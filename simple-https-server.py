from http.server import HTTPServer, SimpleHTTPRequestHandler
import ssl

httpd = HTTPServer(('', 4443), SimpleHTTPRequestHandler)
httpd.socket = ssl.wrap_socket(httpd.socket, certfile="./localhost.pem", server_side=True)
httpd.serve_forever()