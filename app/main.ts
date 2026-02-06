import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";

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

// Buffer class to handle request data
class RequestBuffer {
  private buffer: string = "";
  private requests: string[] = [];
  
  addData(data: string): void {
    this.buffer += data;
    this.parseRequests();
  }
  
  getNextRequest(): string | null {
    return this.requests.length > 0 ? this.requests.shift()! : null;
  }
  
  hasRequests(): boolean {
    return this.requests.length > 0;
  }
  
  clear(): void {
    this.buffer = "";
    this.requests = [];
  }
  
  private parseRequests(): void {
    // Find the boundary between requests (double CRLF at the end of a request)
    while (true) {
      // Find the end of headers (double CRLF)
      const headerEndIndex = this.buffer.indexOf("\r\n\r\n");
      
      if (headerEndIndex === -1) {
        // No complete headers yet
        break;
      }
      
      // Extract headers
      const headersPart = this.buffer.substring(0, headerEndIndex);
      const headerLines = headersPart.split("\r\n");
      const requestLine = headerLines[0];
      const parts = requestLine.split(' ');
      
      if (parts.length < 3) {
        // Invalid request line, skip
        break;
      }
      
      const method = parts[0];
      
      // Parse headers
      const headers: Record<string, string> = {};
      for (let i = 1; i < headerLines.length; i++) {
        const line = headerLines[i];
        const separatorIndex = line.indexOf(":");
        if (separatorIndex !== -1) {
          const headerName = line.substring(0, separatorIndex).trim().toLowerCase();
          const headerValue = line.substring(separatorIndex + 1).trim();
          headers[headerName] = headerValue;
        }
      }
      
      // Check if there's a body
      let totalLength = headerEndIndex + 4; // +4 for the \r\n\r\n
      
      if (method === "POST" && headers["content-length"]) {
        const contentLength = parseInt(headers["content-length"], 10);
        if (!isNaN(contentLength)) {
          totalLength += contentLength;
        }
      }
      
      // Check if we have the complete request
      if (this.buffer.length >= totalLength) {
        // Extract the complete request
        const request = this.buffer.substring(0, totalLength);
        this.requests.push(request);
        // Remove processed request from buffer
        this.buffer = this.buffer.substring(totalLength);
      } else {
        // Don't have complete request yet
        break;
      }
    }
  }
}

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

function handleRequest(requestData: string, socket: net.Socket): void {
  const lines = requestData.split("\r\n");
  const requestLine = lines[0];
  const parts = requestLine.split(' ');

  if (parts.length >= 3) {
    const method = parts[0];
    const path = parts[1];
    const httpVersion = parts[2];
    
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

    // Handle GET requests
    if (method === "GET") {
      handleGetRequest(path, headers, shouldClose, socket);
    }
    // Handle POST requests
    else if (method === "POST") {
      handlePostRequest(path, headers, requestData, shouldClose, socket);
    }
    // Handle other HTTP methods
    else {
      const response = shouldClose 
        ? "HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n"
        : "HTTP/1.1 405 Method Not Allowed\r\n\r\n";
      writeResponse(response, shouldClose, socket);
    }
  } else {
    const response = "HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n";
    socket.write(response, () => {
      socket.end();
    });
  }
}

function handleGetRequest(
  path: string, 
  headers: Record<string, string>, 
  shouldClose: boolean, 
  socket: net.Socket
): void {
  if (path === "/") {
    const response = shouldClose 
      ? "HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n"
      : "HTTP/1.1 200 OK\r\n\r\n";
    writeResponse(response, shouldClose, socket);
  } else if (path.startsWith("/echo/")) {
    handleEchoRequest(path, headers, shouldClose, socket);
  } else if (path === "/user-agent") {
    const userAgent = headers["user-agent"] || "";
    const response = shouldClose 
      ? `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nConnection: close\r\nContent-Length: ${userAgent.length}\r\n\r\n${userAgent}`
      : `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${userAgent.length}\r\n\r\n${userAgent}`;
    writeResponse(response, shouldClose, socket);
  } else if (path.startsWith("/files/") && directoryPath) {
    handleFileGetRequest(path, shouldClose, socket);
  } else if (path.startsWith("/files/") && !directoryPath) {
    const response = shouldClose 
      ? "HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n"
      : "HTTP/1.1 400 Bad Request\r\n\r\n";
    writeResponse(response, shouldClose, socket);
  } else {
    const response = shouldClose 
      ? "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n"
      : "HTTP/1.1 404 Not Found\r\n\r\n";
    writeResponse(response, shouldClose, socket);
  }
}

function handleEchoRequest(
  path: string,
  headers: Record<string, string>,
  shouldClose: boolean,
  socket: net.Socket
): void {
  const echoStr = path.substring(6);
  const acceptEncoding = headers["accept-encoding"] || "";
  
  // Split by commas and check each encoding
  let supportGzip = false;
  if (acceptEncoding) {
    const encodings = acceptEncoding.split(',').map(e => e.trim().toLowerCase());
    supportGzip = encodings.includes("gzip");
  }

  if (supportGzip) {
    zlib.gzip(echoStr, (err, compressedData) => {
      if (err) {
        // If compression fails, send uncompressed
        const response = shouldClose 
          ? `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nConnection: close\r\nContent-Length: ${echoStr.length}\r\n\r\n${echoStr}`
          : `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${echoStr.length}\r\n\r\n${echoStr}`;
        writeResponse(response, shouldClose, socket);
      } else {
        // Send compressed response
        const responseHeaders = shouldClose 
          ? `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Encoding: gzip\r\nConnection: close\r\nContent-Length: ${compressedData.length}\r\n\r\n`
          : `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Encoding: gzip\r\nContent-Length: ${compressedData.length}\r\n\r\n`;
        
        if (shouldClose) {
          socket.write(responseHeaders, () => {
            socket.write(new Uint8Array(compressedData), () => {
              socket.end();
            });
          });
        } else {
          socket.write(responseHeaders, () => {
            socket.write(new Uint8Array(compressedData));
          });
        }
      }
    });
  } else {
    const response = shouldClose 
      ? `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nConnection: close\r\nContent-Length: ${echoStr.length}\r\n\r\n${echoStr}`
      : `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${echoStr.length}\r\n\r\n${echoStr}`;
    writeResponse(response, shouldClose, socket);
  }
}

function handleFileGetRequest(path: string, shouldClose: boolean, socket: net.Socket): void {
  const filename = path.substring(7);
  const filePath = `${directoryPath}/${filename}`;
  
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      const response = shouldClose 
        ? "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n"
        : "HTTP/1.1 404 Not Found\r\n\r\n";
      writeResponse(response, shouldClose, socket);
    } else {
      fs.readFile(filePath, (err, fileData) => {
        if (err) {
          const response = shouldClose 
            ? "HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n"
            : "HTTP/1.1 500 Internal Server Error\r\n\r\n";
          writeResponse(response, shouldClose, socket);
        } else {
          const responseHeaders = shouldClose 
            ? `HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nConnection: close\r\nContent-Length: ${fileData.length}\r\n\r\n`
            : `HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: ${fileData.length}\r\n\r\n`;
          
          if (shouldClose) {
            socket.write(responseHeaders, () => {
              socket.write(new Uint8Array(fileData), () => {
                socket.end();
              });
            });
          } else {
            socket.write(responseHeaders, () => {
              socket.write(new Uint8Array(fileData));
            });
          }
        }
      });
    }
  });
}

function handlePostRequest(
  path: string,
  headers: Record<string, string>,
  requestData: string,
  shouldClose: boolean,
  socket: net.Socket
): void {
  if (path.startsWith("/files/") && directoryPath) {
    const filename = path.substring(7);
    const filePath = `${directoryPath}/${filename}`;
    
    // Find the empty line that separates headers from body
    const lines = requestData.split("\r\n");
    let bodyStartIndex = 0;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === "") {
        bodyStartIndex = i + 1;
        break;
      }
    }
    
    // Extract request body
    let requestBody = "";
    if (bodyStartIndex > 0) {
      // Join the remaining lines to get the body
      for (let i = bodyStartIndex; i < lines.length; i++) {
        requestBody += lines[i];
        if (i < lines.length - 1) {
          requestBody += "\r\n";
        }
      }
    }
    
    fs.writeFile(filePath, requestBody, (err) => {
      if (err) {
        const response = shouldClose 
          ? "HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n"
          : "HTTP/1.1 500 Internal Server Error\r\n\r\n";
        writeResponse(response, shouldClose, socket);
      } else {
        const response = shouldClose 
          ? "HTTP/1.1 201 Created\r\nConnection: close\r\n\r\n"
          : "HTTP/1.1 201 Created\r\n\r\n";
        writeResponse(response, shouldClose, socket);
      }
    });
  } else if (path.startsWith("/files/") && !directoryPath) {
    const response = shouldClose 
      ? "HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n"
      : "HTTP/1.1 400 Bad Request\r\n\r\n";
    writeResponse(response, shouldClose, socket);
  } else {
    const response = shouldClose 
      ? "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n"
      : "HTTP/1.1 404 Not Found\r\n\r\n";
    writeResponse(response, shouldClose, socket);
  }
}

function writeResponse(response: string, shouldClose: boolean, socket: net.Socket): void {
  if (shouldClose) {
    socket.write(response, () => {
      socket.end();
    });
  } else {
    socket.write(response);
  }
}

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