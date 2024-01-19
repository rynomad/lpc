import { MessageChannelTransport } from "./transports/messagechannel.mjs";
import { Server, Client } from "./rpc.mjs";

const channel = new MessageChannel();
const port1 = channel.port1;
const port2 = channel.port2;
const transport1 = new MessageChannelTransport(port1, "client");
const transport2 = new MessageChannelTransport(port2, "server");

const test = {
    some: {
        deep: {
            prop: "value",
            fn: (cb) => {
                setTimeout(() => cb("deep fn"), 1000);
                return "some return value";
            },
        },
    },
};

const server = new Server(test, "test", transport2);
const client = Client.create("test", transport1);

// await client.some.deep.fn((result) => {
//     console.log(result);
// });

console.log(await client.some.deep.prop);
console.log("before");
console.log(await client.some.deep.fn((r) => console.log("callback", r)));
