// Buffer class to handle request data
export class RequestBuffer {
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
