import { build, transform } from "esbuild";
import { polyfillNode } from "esbuild-plugin-polyfill-node";
import path from "path";
import fs from "fs";
const customSetterPlugin = {
    name: "custom-setter",
    setup(build) {
        build.onEnd(async (result) => {
            let code = fs.readFileSync("./extension/background.js", "utf8");

            // Define the new code to be inserted
            let newCode = `
const targetCommands = [
  "Target.getBrowserContexts",
  "Target.setDiscoverTargets",
  "Target.attachToTarget",
  "Target.activateTarget",
  "Target.closeTarget",
  "Target.setAutoAttach",
];
const browserCommands = ["Browser.getVersion"];
if (browserCommands.includes(command.method)) {
  this._handleBrowserCommand(command);
} else if (targetCommands.includes(command.method)) {
  this._handleTargetCommand(command);
`;

            // Replace the old code with the new one
            // Use a regex that matches the entire targetCommands array and the following if statement
            code = code.replace(
                /const targetCommands[\s\S\n\r]*this._handleTargetCommand\(command\);/,
                newCode
            );

            newCode = `
                _handleBrowserCommand(command) {
                    const response = Object.assign(Object.assign({}, command), {
                        error: void 0,
                        result: {},
                    });

                    response.result = {
                        product: "chrome",
                    };
                    this._delaySend(response);
                }
                _handleTargetCommand(command) {`;

            code = code.replace(/_handleTargetCommand\(command\) \{/, newCode);

            newCode = `
                        case "Target.setAutoAttach":
                        case "Target.attachToTarget":
                            `;

            code = code.replace(/case "Target.attachToTarget":/, newCode);

            newCode = `
                _emitTargetAttached() {
                    if (this._attached) {
                        return;
                    }
                    this._attached = true;
                    `;
            code = code.replace(/_emitTargetAttached\(\) \{/, newCode);

            fs.writeFileSync("./extension/background.js", code);
        });
    },
};

// Define your custom plugin
const customUrlPonyfillPlugin = {
    name: "custom-url-ponyfill",
    setup(build) {
        build.onResolve({ filter: /^url$/ }, async () => {
            return {
                path: path.resolve("./extension/url.mjs"),
            };
        });
    },
};

build({
    entryPoints: ["extension/background.mjs"],
    bundle: true,
    outfile: "extension/background.js",
    plugins: [
        customUrlPonyfillPlugin,
        polyfillNode({
            // Options (optional)
            polyfills: {
                fs: true,
            },
        }),
        customSetterPlugin,
    ],
});
