import { Server, ChromeExtensionBackgroundTransport } from "../index.mjs";
import { Puppeteer } from "puppeteer-core/lib/esm/puppeteer/common/Puppeteer.js";
import { ExtensionDebuggerTransport } from "puppeteer-extension-transport";

const puppeteerCore = new Puppeteer({ isPuppeteerCore: true });

// Synthetic browser object
const browser = {
    newPage: async (url) => {
        return new Promise((resolve, reject) => {
            chrome.tabs.create(
                {
                    active: false,
                    url: url,
                },
                async (tab) => {
                    if (tab.id) {
                        const extensionTransport =
                            await ExtensionDebuggerTransport.create(tab.id);
                        const browserInstance = await puppeteerCore.connect({
                            transport: extensionTransport,
                            defaultViewport: null,
                        });
                        const [page] = await browserInstance.pages();
                        page.close = () => {
                            return new Promise((resolve, reject) => {
                                chrome.tabs.remove(tab.id, () => {
                                    resolve();
                                });
                            });
                        };
                        resolve(page);
                    } else {
                        reject(new Error("Failed to create a new tab"));
                    }
                }
            );
        });
    },
};

self.fetchServer = new Server(
    fetch,
    "fetch",
    new ChromeExtensionBackgroundTransport()
);

// self.browserServer = new Server(
//     browser,
//     "browser",
//     new ChromeExtensionBackgroundTransport()
// );
