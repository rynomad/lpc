export class Transport extends EventTarget {
    constructor() {
        super();
        if (new.target === Transport) {
            throw new TypeError(
                "Cannot construct Transport instances directly"
            );
        }

        this.ready = new Promise((resolve) => {
            this._ready = resolve;
        });
    }

    async send(data) {
        throw new Error("Method 'send' not implemented");
    }

    receive(callback) {
        this.callback = callback;
    }
}
