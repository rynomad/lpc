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

const origins = ["https://rynomad.github.io", "http://localhost:3000"];

chrome.webNavigation.onCommitted.addListener(function (details) {
    const obj = new URL(details.url);
    if (origins.includes(obj.origin)) {
        chrome.scripting.executeScript({
            target: { tabId: details.tabId },
            function: (value) => {
                localStorage.setItem("PROXY_EXTENSION_ID", value);
            },
            args: [chrome.runtime.id],
        });
    }
});
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
