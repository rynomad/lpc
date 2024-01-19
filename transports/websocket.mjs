import { v4 as uuidv4 } from "https://jspm.dev/uuid";
import { deepEqual } from "https://jspm.dev/fast-equals";
import { Transport } from "../transport.mjs";

class WebSocketServerTransport extends Transport {
    constructor(port) {
        super();
        this.port = port;
        this.server = new WebSocketServer(port);
        console.log("construct server");
        this.server.on("connection", (socket) => {
            console.log("server got connection");
            this._ready();
            socket.on("message", async (message) => {
                const data = JSON.parse(message);
                this.callback?.(data);
            });
        });
    }

    async send(data) {
        this.server.clients.forEach((client) => {
            client.send(JSON.stringify(data));
        });
    }

    connected(callback) {
        console.log("set connected callback");
        this.server.on("connection", callback);
    }
}

class WebSocketClientTransport extends Transport {
    constructor(url) {
        super();
        this.url = url;
        this.requests = new Map();
        this.startClient();
    }

    async startClient() {
        const id = uuidv4();
        this.socket = new WebSocket(this.url);
        console.log("BUILT SOCKET", id);
        this.socket.addEventListener("open", () => {
            console.log("Connection established", id);
            this._ready();
        });
        this.socket.addEventListener("open", () => {
            console.log("Connection established", id);
        });
        this.socket.addEventListener("error", (error) => {
            console.log("WebSocket error: ", error);
        });
        this.socket.addEventListener("close", (event) => {
            setTimeout(() => this.startClient(), 1000);
        });
        this.socket.addEventListener("message", async (event) => {
            console.log("message", id, event.data);
            const data = JSON.parse(event.data);
            this.callback?.(data);
        });
    }

    async send(data) {
        this.socket.send(JSON.stringify(data));
    }
}
