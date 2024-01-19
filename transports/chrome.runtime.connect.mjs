import { Transport } from "../transport.mjs";

export class ChromeExtensionTransport extends Transport {
    constructor(extensionId) {
        super();
        this.extensionId = extensionId;
        this.port = chrome.runtime.connect(extensionId);
        this.port.onMessage.addListener((message) => {
            this.callback?.(message);
        });
        this._ready();
    }

    async send(data) {
        this.port.postMessage(data);
    }
}

export class ChromeExtensionBackgroundTransport extends Transport {
    constructor() {
        super();
        chrome.runtime.onConnectExternal.addListener((port) => {
            this.port = port;
            this.port.onMessage.addListener((message) => {
                this.callback?.(message);
            });
            this._ready();
        });
    }

    async send(data) {
        this.port.postMessage(data);
    }
}
