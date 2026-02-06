# Custom HTTP Server

A lightweight, modular HTTP server implemented in TypeScript from scratch. This server handles TCP connections directly and implements the HTTP/1.1 protocol functionalities including request parsing, response building, file management, and compression.

## Features

- **HTTP/1.1 Protocol Support**: Handles standard HTTP methods and headers.
- **GET & POST Requests**: robust handling for data retrieval and submission.
- **File Serving**: Serve files from a specified directory (`/files/:filename`).
- **File Uploads**: Upload files via POST requests to the server directory.
- **Echo Endpoint**: Echoes back the path parameter (`/echo/:str`) for testing.
- **Gzip Compression**: Supports `Content-Encoding: gzip` for echo responses if requested.
- **Persistent Connections**: Handles multiple requests over a single TCP connection (Keep-Alive).
- **Concurrency**: Handles multiple concurrent client connections.
- **Modular Architecture**: Clean separation of concerns (Routing, Parsing, File I/O).

## Project Structure

The project has been refactored into a modular architecture for better maintainability:

```
app/
├── main.ts             # Server entry point and orchestration
├── routes.ts           # Route definitions and handlers
├── request-buffer.ts   # TCP data buffering and HTTP request parsing
├── response-builder.ts # Utilities for constructing HTTP responses
├── file-handler.ts     # File system operations (read/write)
├── compression.ts      # Gzip compression logic
└── types.ts            # Shared TypeScript interfaces
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [npm](https://www.npmjs.com/) or [bun](https://bun.sh/)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Server

Start the server in development mode:

```bash
npm run dev
```

To serve files from a specific directory (e.g., `/tmp`), use the `--directory` flag:

```bash
npm run dev -- --directory /tmp
```

The server listens on **port 4221** by default.

## API Endpoints

| Method | Endpoint | Description | Example |
|--------|----------|-------------|---------|
| `GET` | `/` | Health check | `curl http://localhost:4221/` |
| `GET` | `/echo/:str` | Echoes the string back | `curl http://localhost:4221/echo/hello` |
| `GET` | `/user-agent` | Returns User-Agent header | `curl http://localhost:4221/user-agent -H "User-Agent: test"` |
| `GET` | `/files/:name` | Downloads a file | `curl http://localhost:4221/files/test.txt` |
| `POST` | `/files/:name` | Uploads a file | `curl -X POST http://localhost:4221/files/new.txt -d "content"` |

## Compression Support

The `/echo/:str` endpoint supports Gzip compression. To test it, send a request with the `Accept-Encoding: gzip` header:

```bash
curl -v http://localhost:4221/echo/hello -H "Accept-Encoding: gzip"
```

## Development

- **Build**: `npx tsc`
- **Test**: Use the provided `test_client.ts` or curl commands.
