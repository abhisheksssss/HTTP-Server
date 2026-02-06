import * as net from "net";
import { writeResponse, buildTextResponse, buildStatusResponse } from "./response-builder";
import { supportsGzip, compressWithGzip } from "./compression";
import { fileExists, readFile, writeFile } from "./file-handler";

let directoryPath = "";

// Set the directory path for file operations
export function setDirectoryPath(path: string): void {
  directoryPath = path;
}

// Main GET request handler
export function handleGetRequest(
  path: string, 
  headers: Record<string, string>, 
  shouldClose: boolean, 
  socket: net.Socket
): void {
  if (path === "/") {
    const response = buildStatusResponse(200, "OK", shouldClose);
    writeResponse(response, shouldClose, socket);
  } else if (path.startsWith("/echo/")) {
    handleEchoRequest(path, headers, shouldClose, socket);
  } else if (path === "/user-agent") {
    handleUserAgent(headers, shouldClose, socket);
  } else if (path.startsWith("/files/") && directoryPath) {
    handleFileGetRequest(path, shouldClose, socket);
  } else if (path.startsWith("/files/") && !directoryPath) {
    const response = buildStatusResponse(400, "Bad Request", shouldClose);
    writeResponse(response, shouldClose, socket);
  } else {
    const response = buildStatusResponse(404, "Not Found", shouldClose);
    writeResponse(response, shouldClose, socket);
  }
}

// Handle echo endpoint with optional gzip compression
function handleEchoRequest(
  path: string,
  headers: Record<string, string>,
  shouldClose: boolean,
  socket: net.Socket
): void {
  const echoStr = path.substring(6);
  const acceptEncoding = headers["accept-encoding"] || "";
  
  if (supportsGzip(acceptEncoding)) {
    compressWithGzip(echoStr)
      .then((compressedData) => {
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
      })
      .catch(() => {
        // If compression fails, send uncompressed
        const response = buildTextResponse(200, "OK", echoStr, shouldClose);
        writeResponse(response, shouldClose, socket);
      });
  } else {
    const response = buildTextResponse(200, "OK", echoStr, shouldClose);
    writeResponse(response, shouldClose, socket);
  }
}

// Handle user-agent endpoint
function handleUserAgent(
  headers: Record<string, string>,
  shouldClose: boolean,
  socket: net.Socket
): void {
  const userAgent = headers["user-agent"] || "";
  const response = buildTextResponse(200, "OK", userAgent, shouldClose);
  writeResponse(response, shouldClose, socket);
}

// Handle file GET request
async function handleFileGetRequest(path: string, shouldClose: boolean, socket: net.Socket): Promise<void> {
  const filename = path.substring(7);
  const filePath = `${directoryPath}/${filename}`;
  
  try {
    const exists = await fileExists(filePath);
    
    if (!exists) {
      const response = buildStatusResponse(404, "Not Found", shouldClose);
      writeResponse(response, shouldClose, socket);
      return;
    }
    
    const fileData = await readFile(filePath);
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
  } catch (err) {
    const response = buildStatusResponse(500, "Internal Server Error", shouldClose);
    writeResponse(response, shouldClose, socket);
  }
}

// Main POST request handler
export function handlePostRequest(
  path: string,
  headers: Record<string, string>,
  requestData: string,
  shouldClose: boolean,
  socket: net.Socket
): void {
  if (path.startsWith("/files/") && directoryPath) {
    handleFilePostRequest(path, requestData, shouldClose, socket);
  } else if (path.startsWith("/files/") && !directoryPath) {
    const response = buildStatusResponse(400, "Bad Request", shouldClose);
    writeResponse(response, shouldClose, socket);
  } else {
    const response = buildStatusResponse(404, "Not Found", shouldClose);
    writeResponse(response, shouldClose, socket);
  }
}

// Handle file POST request (upload)
async function handleFilePostRequest(
  path: string,
  requestData: string,
  shouldClose: boolean,
  socket: net.Socket
): Promise<void> {
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
  
  try {
    await writeFile(filePath, requestBody);
    const response = buildStatusResponse(201, "Created", shouldClose);
    writeResponse(response, shouldClose, socket);
  } catch (err) {
    const response = buildStatusResponse(500, "Internal Server Error", shouldClose);
    writeResponse(response, shouldClose, socket);
  }
}
