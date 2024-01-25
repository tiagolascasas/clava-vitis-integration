"use strict";

laraImport("lara.util.ProcessExecutor");

class XilinxApp {
    #appName = "XilinxApp";
    #workingDir = ".";

    constructor(appName) {
        if (new.target === XilinxApp) {
            throw new TypeError("Cannot construct XilinxApp instances directly");
        }
        this.#appName = appName;
    }

    getWorkingDir() {
        return this.#workingDir;
    }

    setWorkingDir(dir) {
        this.#workingDir = dir;
    }

    clean() {
        if (!Io.isFolder(this.#workingDir)) {
            Io.mkdir(this.#workingDir);
        }
        else {
            Io.deleteFolderContents(this.#workingDir);
        }
    }

    preciseStr(n, decimalPlaces) {
        return (+n).toFixed(decimalPlaces);
    }

    getTimestamp() {
        const curr = new Date();
        const res = `[${this.#appName} ${curr.getHours()}:${curr.getMinutes()}:${curr.getSeconds()}]`;
        return res;
    }

    log(message) {
        println(`${this.getTimestamp()} ${message}`);
    }
}