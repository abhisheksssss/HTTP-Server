import * as zlib from "zlib";

// Check if client supports gzip encoding
export function supportsGzip(acceptEncodingHeader: string): boolean {
  if (!acceptEncodingHeader) {
    return false;
  }
  
  const encodings = acceptEncodingHeader.split(',').map(e => e.trim().toLowerCase());
  return encodings.includes("gzip");
}

// Compress data with gzip
export function compressWithGzip(data: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zlib.gzip(data, (err, compressedData) => {
      if (err) {
        reject(err);
      } else {
        resolve(compressedData);
      }
    });
  });
}
