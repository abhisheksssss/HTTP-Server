import * as net from "net";

// HTTP Request parsed structure
export interface HttpRequest {
  method: string;
  path: string;
  httpVersion: string;
  headers: Record<string, string>;
  body: string;
}

// HTTP Response structure
export interface HttpResponse {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body?: string | Buffer;
}

// Route handler function type
export type RouteHandler = (
  request: HttpRequest,
  socket: net.Socket,
  shouldClose: boolean
) => void;
