import { Transport } from "../transport.mjs";

export class MessageChannelTransport extends Transport {
    constructor(port, name = "MessageChannelTransport") {
        super();
        this.name = name;
        this.port = port;
        this.port.onmessage = (event) => {
            const data = event.data;
            this.callback?.(data);
        };
        setTimeout(() => this._ready(), 0);
    }

    async send(data) {
        this.port.postMessage(data);
    }
}
