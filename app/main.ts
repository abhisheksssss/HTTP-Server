import * as net from "net";
import * as fs from "fs";
import * as path from "path";

console.log("Logs from your program will appear here!");

// Parse command line arguments
const args = process.argv.slice(2);
let directoryPath = "";

// Parse --directory flag
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--directory" && i + 1 < args.length) {
    directoryPath = args[i + 1];
    break;
  }
}

const server = net.createServer((socket) => {
  socket.on("data", (data) => {
    const request = data.toString();
    const lines = request.split("\r\n");
    const requestLine = lines[0];
    const parts = requestLine.split(' ');

    if (parts.length >= 2) {
      const path = parts[1];

      if (path === "/") {
        const response = "HTTP/1.1 200 OK\r\n\r\n";
        socket.write(response, () => {
          socket.end();
        });
      } else if (path.startsWith("/echo/")) {
        const echoStr = path.substring(6);
        const response = `HTTP/1.1 200 OK\r\n` +
          `Content-Type: text/plain\r\n` +
          `Content-Length: ${echoStr.length}\r\n` +
          `\r\n` +
          `${echoStr}`;
        socket.write(response, () => {
          socket.end();
        });
      } else if (path === "/user-agent") {
        let userAgent = "";

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];

          if (line === "") {
            break;
          }

          const separatorIndex = line.indexOf(":");

          if (separatorIndex !== -1) {
            const headerName = line.substring(0, separatorIndex).trim();
            const headerValue = line.substring(separatorIndex + 1).trim();

            if (headerName.toLowerCase() === "user-agent") {
              userAgent = headerValue;
              break;
            }
          }
        }

        const response = `HTTP/1.1 200 OK\r\n` +
          `Content-Type: text/plain\r\n` +
          `Content-Length: ${userAgent.length}\r\n` +
          `\r\n` +
          `${userAgent}`;
        socket.write(response, () => {
          socket.end();
        });
      } else if (path.startsWith("/files/") && directoryPath) {
        // Extract filename from path
        const filename = path.substring(7); // Remove "/files/" prefix
        const filePath = `${directoryPath}/${filename}`;
        
        // Check if file exists
        fs.access(filePath, fs.constants.F_OK, (err) => {
          if (err) {
            // File doesn't exist
            const response = "HTTP/1.1 404 Not Found\r\n\r\n";
            socket.write(response, () => {
              socket.end();
            });
          } else {
            // File exists, read and send it
            fs.readFile(filePath, (err, fileData) => {
              if (err) {
                // Error reading file
                const response = "HTTP/1.1 500 Internal Server Error\r\n\r\n";
                socket.write(response, () => {
                  socket.end();
                });
              } else {
                // Success - send file
                const response = `HTTP/1.1 200 OK\r\n` +
                  `Content-Type: application/octet-stream\r\n` +
                  `Content-Length: ${fileData.length}\r\n` +
                  `\r\n`;
                
                // Write headers first
                socket.write(response, () => {
                  // Then write the file data
                  socket.write(new Uint8Array(fileData), () => {
                    socket.end();
                  });
                });
              }
            });
          }
        });
      } else if (path.startsWith("/files/") && !directoryPath) {
        // No directory specified
        const response = "HTTP/1.1 400 Bad Request\r\n\r\n";
        socket.write(response, () => {
          socket.end();
        });
      } else {
        const response = "HTTP/1.1 404 Not Found\r\n\r\n";
        socket.write(response, () => {
          socket.end();
        });
      }
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
  if (directoryPath) {
    console.log(`Serving files from directory: ${directoryPath}`);
  }
});