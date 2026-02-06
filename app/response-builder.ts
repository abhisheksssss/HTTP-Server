import * as net from "net";
import type { HttpResponse } from "./types";

// Build HTTP response string from response object
export function buildResponse(response: HttpResponse): string {
  const statusLine = `HTTP/1.1 ${response.statusCode} ${response.statusText}\r\n`;
  
  let headerLines = "";
  for (const [key, value] of Object.entries(response.headers)) {
    headerLines += `${key}: ${value}\r\n`;
  }
  
  const body = response.body || "";
  return `${statusLine}${headerLines}\r\n${body}`;
}

// Write response to socket and handle connection closing
export function writeResponse(response: string, shouldClose: boolean, socket: net.Socket): void {
  if (shouldClose) {
    socket.write(response, () => {
      socket.end();
    });
  } else {
    socket.write(response);
  }
}

// Helper to build simple text responses
export function buildTextResponse(
  statusCode: number,
  statusText: string,
  content: string,
  shouldClose: boolean
): string {
  const headers: Record<string, string> = {
    "Content-Type": "text/plain",
    "Content-Length": content.length.toString(),
  };
  
  if (shouldClose) {
    headers["Connection"] = "close";
  }
  
  return buildResponse({
    statusCode,
    statusText,
    headers,
    body: content,
  });
}

// Helper to build simple status responses without body
export function buildStatusResponse(
  statusCode: number,
  statusText: string,
  shouldClose: boolean
): string {
  const headers: Record<string, string> = {};
  
  if (shouldClose) {
    headers["Connection"] = "close";
  }
  
  return buildResponse({
    statusCode,
    statusText,
    headers,
  });
}
