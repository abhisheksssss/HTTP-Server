import * as net from "net";
import { RequestBuffer } from "./request-buffer";
import { writeResponse, buildStatusResponse } from "./response-builder";
import { handleGetRequest, handlePostRequest, setDirectoryPath } from "./routes";

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

// Set directory path for route handlers
if (directoryPath) {
  setDirectoryPath(directoryPath);
}

// Create HTTP server
const server = net.createServer((socket) => {
  const requestBuffer = new RequestBuffer();
  
  socket.on("data", (data) => {
    requestBuffer.addData(data.toString());
    
    // Process all available requests
    while (requestBuffer.hasRequests()) {
      const requestData = requestBuffer.getNextRequest();
      if (requestData) {
        handleRequest(requestData, socket);
      }
    }
  });

  // Handle socket errors to prevent crashes
  socket.on("error", (err) => {
    console.error("Socket error:", err.message);
  });
});

// Main request handler
function handleRequest(requestData: string, socket: net.Socket): void {
  const lines = requestData.split("\r\n");
  const requestLine = lines[0];
  const parts = requestLine.split(' ');

  if (parts.length >= 3) {
    const method = parts[0];
    const path = parts[1];
    
    // Parse headers
    const headers: Record<string, string> = {};
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      
      if (line === "") {
        break;
      }
      
      const separatorIndex = line.indexOf(":");
      if (separatorIndex !== -1) {
        const headerName = line.substring(0, separatorIndex).trim().toLowerCase();
        const headerValue = line.substring(separatorIndex + 1).trim();
        headers[headerName] = headerValue;
      }
    }

    // Check if client wants to close connection
    const connectionHeader = headers["connection"] || "";
    const shouldClose = connectionHeader.toLowerCase() === "close";

    // Route request based on method
    if (method === "GET") {
      handleGetRequest(path, headers, shouldClose, socket);
    } else if (method === "POST") {
      handlePostRequest(path, headers, requestData, shouldClose, socket);
    } else {
      const response = buildStatusResponse(405, "Method Not Allowed", shouldClose);
      writeResponse(response, shouldClose, socket);
    }
  } else {
    const response = "HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n";
    socket.write(response, () => {
      socket.end();
    });
  }
}

// Handle server errors
server.on("error", (err) => {
  console.error("Server error:", err.message);
});

// Start server
server.listen(4221, "localhost", () => {
  console.log("Server listening on port 4221");
  if (directoryPath) {
    console.log(`Serving files from directory: ${directoryPath}`);
  }
});