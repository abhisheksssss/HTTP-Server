import * as net from "net";

console.log("Logs from your program will appear here!");

const server = net.createServer((socket) => {
  socket.on("data", (data) => {
    const request = data.toString();
    const lines = request.split("\r\n");
    const requestLine = lines[0];
    const parts = requestLine.split(' ');

    if (parts.length >= 2) {
      const path = parts[1];

      let response: string;

      if (path == "/") {
        response = "HTTP/1.1 200 OK\r\n\r\n";
      } else if (path.startsWith("/echo/")) {
        const echoStr = path.substring(6);
        response = `HTTP/1.1 200 OK\r\n` +
          `Content-Type: text/plain\r\n` +
          `Content-Length: ${echoStr.length}\r\n` +
          `\r\n` +
          `${echoStr}`;
      } else if (path == "/user-agent") {
        let userAgent = "";

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];

          if (line == "") {
            break;
          }

          const separatorIndex = line.indexOf(":");

          if (separatorIndex !== -1) {
            const headerName = line.substring(0, separatorIndex).trim();
            const headerValue = line.substring(separatorIndex + 1).trim();

            if (headerName.toLowerCase() == "user-agent") {
              userAgent = headerValue;
              break;
            }
          }
        }

        response = `HTTP/1.1 200 OK\r\n` +
          `Content-Type: text/plain\r\n` +
          `Content-Length: ${userAgent.length}\r\n` +
          `\r\n` +
          `${userAgent}`;
      } else {
        response = "HTTP/1.1 404 Not Found\r\n\r\n";
      }

      // Write the response and then end the connection
      socket.write(response, () => {
        socket.end();
      });
    } else {
      const response = "HTTP/1.1 400 Bad Request\r\n\r\n";
      socket.write(response, () => {
        socket.end();
      });
    }
  });

  // Handle socket errors to prevent crashes
  socket.on("error", (err) => {
    console.error("Socket error:", err.message);
  });
});

// Handle server errors
server.on("error", (err) => {
  console.error("Server error:", err.message);
});

server.listen(4221, "localhost", () => {
  console.log("Server listening on port 4221");
});