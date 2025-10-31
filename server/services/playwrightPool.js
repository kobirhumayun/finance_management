const { chromium } = require('playwright');

let browserPromise = null;
let browserInstance = null;

const launchBrowser = async () => {
    if (!browserPromise) {
        browserPromise = chromium.launch({
            headless: true,
        });
    }

    browserInstance = await browserPromise;
    return browserInstance;
};

const initializePlaywright = async () => {
    if (browserInstance) {
        return browserInstance;
    }

    return launchBrowser();
};

const shutdownPlaywright = async () => {
    if (!browserInstance) {
        return;
    }

    try {
        await browserInstance.close();
    } catch (error) {
        // Swallow shutdown errors to avoid crashing the process during exit handlers.
    } finally {
        browserInstance = null;
        browserPromise = null;
    }
};

const withPage = async (handler) => {
    const browser = await initializePlaywright();
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        return await handler({ browser, context, page });
    } finally {
        await Promise.allSettled([
            page?.close().catch(() => {}),
            context?.close().catch(() => {}),
        ]);
    }
};

process.once('exit', () => {
    shutdownPlaywright();
});

module.exports = {
    initializePlaywright,
    withPage,
    shutdownPlaywright,
};
