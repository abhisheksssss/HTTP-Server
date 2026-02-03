import * as net from "net";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// TODO: Uncomment the code below to pass the first stage
const server = net.createServer((socket) => {
  socket.on("data", (data) => {
const request=data.toString();

console.log(request);

const requestLine=request.split("\r\n")[0];
const parts=requestLine.split(' ');

if(parts.length>=2){
const path=parts[1];

if(path=="/"){
    const response = "HTTP/1.1 200 OK\r\n\r\n";
    socket.write(response);
}else if(path.startsWith("/echo/")){
const echoStr=path.substring(6);

   const response = `HTTP/1.1 200 OK\r\n` +
                        `Content-Type: text/plain\r\n` +
                        `Content-Length: ${echoStr.length}\r\n` +
                        `\r\n` +
                        `${echoStr}`;

    socket.write(response);

}else{
  const response="HTTP/1.1 404 NOt found\r\n\r\n";
  socket.write(response);
}
}else{
    const response = "HTTP/1.1 400 Bad Request\r\n\r\n";
      socket.write(response);
}

  socket.end();

  });
});

server.listen(4221, "localhost");
