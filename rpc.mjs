import isPojo from "is-pojo";

function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        function (c) {
            var r = (Math.random() * 16) | 0,
                v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        }
    );
}
export class Server {
    static objects = new Map();
    constructor(object, id = uuidv4(), transport) {
        console.log("RPCServer", id, object);
        this.id = id;
        Server.objects.set(this.id, object);
        if (transport) {
            this.useTransport(transport);
        }
    }

    cloneWithRPCServerRefs(obj) {
        if (isPojo(obj) && !Array.isArray(obj)) {
            const clone = {};
            for (const key in obj) {
                clone[key] = this.cloneWithRPCServerRefs(obj[key]);
            }
            return clone;
        } else if (Array.isArray(obj)) {
            return obj.map(this.cloneWithRPCServerRefs);
        } else if (typeof obj === "object" && obj !== null) {
            const server = new Server(obj, undefined);
            return { object: server.id };
        } else {
            return obj;
        }
    }

    restoreFromRPCServerRefs(clone) {
        if (isPojo(clone) && !Array.isArray(clone) && !clone.object) {
            const obj = {};
            for (const key in clone) {
                obj[key] = this.restoreFromRPCServerRefs(clone[key]);
            }
            return obj;
        } else if (Array.isArray(clone)) {
            return clone.map(restoreFromRPCServerRefs);
        } else if (
            typeof clone === "object" &&
            clone !== null &&
            clone.object
        ) {
            const server = Server.objects.get(clone.object);
            return server;
        } else {
            return clone;
        }
    }

    async _handle({ id, path = "", action, args }) {
        const object = Server.objects.get(id);
        console.log("_handle", id, path, action, args, object);
        if (!path && action === "get") {
            return { object: id };
        }
        const pathParts = path.split(".").filter((part) => part);
        try {
            let result = object;
            for (const part of pathParts) {
                console.log("part", result, id, part);
                result = result[part].bind
                    ? result[part].bind(result)
                    : result[part];
            }
            if (action === "apply") {
                result = await result(...args);
            }
            return result;
        } catch (e) {
            return "Error: " + e.message;
        }
    }

    async handle({ id, path, action, args = [] }) {
        console.log("handle", id, path, action, args);
        args = args.map((arg) => {
            if (typeof arg === "object" && arg.object) {
                return this.restoreFromRPCServerRefs(arg);
            } else if (typeof arg === "object" && arg.callback) {
                return (...args) => {
                    this.callback(
                        arg.callback,
                        this.cloneWithRPCServerRefs(args)
                    );
                };
            }
            return arg;
        });

        const result = await this._handle({ id, path, action, args });
        console.log("result", result);
        return this.cloneWithRPCServerRefs(result);
    }

    callback(id, result) {
        this.transport.send({ id, result });
    }

    useTransport(transport) {
        this.transport = transport;
        transport.receive(this.handleRequest.bind(this));
    }

    async handleRequest({ id: reqId, path, action, args }) {
        const [id, ...pathParts] = path.split(".");
        path = pathParts.join(".");

        const result = await this.handle({ id, path, action, args });
        console.log("handleRequest", reqId, result);
        this.transport.send({
            id: reqId,
            result,
        });
    }
    connected(callback) {
        console.log("connected", this.transport.connected);
        this.transport.connected(callback);
    }
}

export class Client {
    static callbacks = new Map();
    static requests = new Map();
    static requestQueue = [];
    static serverReady = false;

    static create(id, transport) {
        const client = new Client();
        client.useTransport(transport);
        return Client.createProxy(client.request.bind(client), id);
    }

    async request({ action, path, args = [] }) {
        await this.transport.ready;

        args = args.map((arg) => {
            if (typeof arg === "function") {
                const id = uuidv4();
                this.callbacks.set(id, arg);
                return { callback: id };
            }
            return arg;
        });

        const res = await new Promise((resolve, reject) => {
            const id = uuidv4();
            Client.requests.set(id, { resolve, reject });
            console.log("request", id, path, action, args);
            this.transport.send({ id, path, action, args });
        });

        console.log("request completed", path, action, args, res);

        return res;
    }

    useTransport(transport) {
        this.transport = transport;
        transport.receive(this.handleResponse.bind(this));
    }

    handleResponse({ id, result, ...rest } = {}) {
        console.log(
            "handleResponse",
            id,
            result,
            rest,
            this.requests,
            this.callbacks
        );
        if (Client.requests.has(id)) {
            const { resolve, reject } = Client.requests.get(id);
            if (result?.error) {
                reject(result.error);
            } else {
                resolve(this.hydrateClientsFromServer(result));
            }
            Client.requests.delete(id);
        } else if (Client.callbacks.has(id)) {
            const callback = Client.callbacks.get(id);
            callback.apply(this, this.hydrateClientsFromServer(result));
            Client.callbacks.delete(id);
        }
    }

    hydrateClientsFromServer(clone) {
        if (isPojo(clone) && !Array.isArray(clone) && !clone.object) {
            const obj = {};
            for (const key in clone) {
                obj[key] = this.hydrateClientsFromServer(clone[key]);
            }
            return obj;
        } else if (Array.isArray(clone)) {
            return clone.map(this.hydrateClientsFromServer);
        } else if (
            typeof clone === "object" &&
            clone !== null &&
            clone.object
        ) {
            return Client.create(clone.object, this.transport);
        } else {
            return clone;
        }
    }

    static createProxy(resolveFn, path = "") {
        let proxy = null;
        // console.log("createProxy", resolveFn, path);
        const handler = {
            get(target, prop) {
                try {
                    console.log("get", target, prop, resolveFn, path);
                    if (!prop) {
                        console.log("NO PROP");
                        return target;
                    }
                    if (
                        prop === "then" ||
                        prop === "catch" ||
                        prop === "finally" ||
                        prop === Symbol.toStringTag
                    ) {
                        if (path.split(".").length === 1) {
                            return Promise.resolve(target);
                        }

                        let promise = resolveFn({ path, action: "get" });

                        if (!promise.then) {
                            promise = Promise.resolve(promise);
                        }

                        if (typeof promise[prop] === "function") {
                            return promise[prop].bind(promise);
                        } else {
                            return promise[prop];
                        }
                    }

                    if (typeof prop === "string") {
                        console.log("STRING", this.createProxy);
                        return Client.createProxy(resolveFn, `${path}.${prop}`);
                    }

                    return target[prop].bind(target);
                } catch (e) {
                    return target[prop];
                }
            },
            apply(_target, _thisArg, args) {
                // If the proxy is invoked as a function, resolve with the 'apply' action.
                return resolveFn({ path, action: "apply", args });
            },
        };

        proxy = new Proxy(() => {}, handler);

        return proxy;
    }
}
