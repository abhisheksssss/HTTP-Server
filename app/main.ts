import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import { isUtf8 } from "buffer";

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

    if (parts.length >= 3) {  // Changed from 2 to 3 to include HTTP method
      const method = parts[0];  // Extract HTTP method
      const path = parts[1];
      const httpVersion = parts[2];

      // Handle GET requests
      if (method === "GET") {
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
      }
      // Handle POST requests
      else if (method === "POST") {
        if (path.startsWith("/files/") && directoryPath) {
          // Extract filename from path
          const filename = path.substring(7); // Remove "/files/" prefix
          const filePath = `${directoryPath}/${filename}`;
          
          // Parse headers to find Content-Length
          let contentLength = 0;
          let bodyStartIndex = 0;
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            
            if (line === "") {
              bodyStartIndex = i + 1;
              break;
            }
            
            const separatorIndex = line.indexOf(":");
            if (separatorIndex !== -1) {
              const headerName = line.substring(0, separatorIndex).trim().toLowerCase();
              const headerValue = line.substring(separatorIndex + 1).trim();
              
              if (headerName === "content-length") {
                contentLength = parseInt(headerValue, 10);
              }
            }
          }
          
          // Extract request body
          let requestBody = "";
          if (bodyStartIndex > 0 && contentLength > 0) {
            // Join the remaining lines to get the body
            for (let i = bodyStartIndex; i < lines.length; i++) {
              requestBody += lines[i];
              if (i < lines.length - 1) {
                requestBody += "\r\n";
              }
            }
            // Ensure we only take the specified content length
            requestBody = requestBody.substring(0, contentLength);
          }
          
          // Write the file
          fs.writeFile(filePath, requestBody, (err) => {
            if (err) {
              // Error writing file
              const response = "HTTP/1.1 500 Internal Server Error\r\n\r\n";
              socket.write(response, () => {
                socket.end();
              });
            } else {
              // Success - file created
              const response = "HTTP/1.1 201 Created\r\n\r\n";
              socket.write(response, () => {
                socket.end();
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
          // POST to non-file endpoint
          const response = "HTTP/1.1 404 Not Found\r\n\r\n";
          socket.write(response, () => {
            socket.end();
          });
        }
      }
      // Handle other HTTP methods
      else {
        const response = "HTTP/1.1 405 Method Not Allowed\r\n\r\n";
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