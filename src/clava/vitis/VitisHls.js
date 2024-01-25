"use strict";

laraImport("lara.util.ProcessExecutor");
laraImport("clava.xilinx.XilinxApp");
laraImport("clava.xilinx.VitisHlsReportParser");

class VitisHls extends XilinxApp {
    topFunction;
    platform;
    clock;
    vitisProjName = "vitis_hls_autogen_proj";
    sourceFiles = [];
    filesToCopy = [];
    flowTarget = "vivado";

    constructor(topFunction, clock = 10, platform = "xcvu5p-flva2104-1-e") {
        super("VITIS-HLS");
        this.topFunction = topFunction;
        this.platform = platform;
        this.setClock(clock);
    }

    setTopFunction(topFunction) {
        this.topFunction = topFunction;
        return this;
    }

    setPlatform(platform) {
        this.platform = platform;
        return this;
    }

    setClock(clock) {
        if (clock <= 0) {
            throw new Error(`${this.getTimestamp()} Clock value must be a positive integer!`);
        }
        else {
            this.clock = clock;
        }
        return this;
    }

    setFlowTarget(target) {
        this.flowTarget = target;
        return this;
    }

    setProjectName(name) {
        this.vitisProjName = name;
    }

    addSource(file) {
        this.sourceFiles.push(file);
        return this;
    }

    addSourcesInFolder(folder, recursive = false) {
        let cnt = 0;
        for (const file of Io.getFiles(folder)) {
            const exts = [".c", ".cpp", ".h", ".hpp"];
            const isValid = exts.some((ext) => file.name.includes(ext));
            if (isValid) {
                cnt++;
                this.sourceFiles.push(file.name);
                this.filesToCopy.push(folder + "/" + file.name);
            }
        }
        this.log(`Added ${cnt} file(s) from folder ${folder}`);

        if (recursive) {
            for (const subfolder of Io.getFolders(folder)) {
                this.addSourcesInFolder(folder + "/" + subfolder.name, recursive);
            }
        }
    }

    synthesize(verbose = true) {
        this.log("Setting up Vitis HLS executor");
        this.clean();

        if (this.sourceFiles.length == 0) {
            this.log("No files were provided to Vitis HLS! Aborting...");
            return false;
        }

        for (const file of this.filesToCopy) {
            Io.copyFile(file, this.getWorkingDir());
        }

        this.generateTclFile();
        this.executeVitis(verbose);

        if (this.getSynthesisReportPath() == null) {
            this.log("No synthesis report found, synthesis may have been unsuccessful! Aborting...");
            return false;
        }
        return true;
    }

    getSynthesisReportPath() {
        const basePath = this.getWorkingDir() + "/" + this.vitisProjName + "/solution1/syn/report/";
        const possiblePaths = [
            basePath + "csynth.xml",
            basePath + this.topFunction + "_csynth.xml"
        ];

        for (const path of possiblePaths) {
            if (Io.isFile(path)) {
                return path;
            }
        }
        return null;
    }

    executeVitis(verbose) {
        this.log("Executing Vitis HLS");
        this.log("-".repeat(50));

        const pe = new ProcessExecutor();
        pe.setWorkingDir(this.getWorkingDir());
        pe.setPrintToConsole(verbose);
        pe.execute("vitis_hls", "-f", "script.tcl");

        this.log("-".repeat(50));
        this.log("Finished executing Vitis HLS");
    }

    getTclInputFiles() {
        let tclCommands = "";

        for (const file of this.sourceFiles) {
            tclCommands += `add_files ${file}\n`;
        }
        return tclCommands;
    }

    generateTclFile() {
        const cmd = `
open_project ${this.vitisProjName}
set_top ${this.topFunction}
${this.getTclInputFiles()}
open_solution "solution1" -flow_target ${this.flowTarget}
set_part { ${this.platform}}
create_clock -period ${this.clock} -name default
csynth_design
exit
    `;
        Io.writeFile(this.getWorkingDir() + "/script.tcl", cmd);
    }

    getSynthesisReport() {
        this.log("Processing synthesis report");

        const path = this.getSynthesisReportPath();
        if (path == null) {
            this.log("No synthesis report found, synthesis either failed or has not been run yet! Aborting...");
            return {};
        }

        const parser = new VitisHlsReportParser(path);
        const json = parser.getSanitizedJSON();

        this.log("Finished processing synthesis report");
        return json;

    }



    prettyPrintReport(report) {
        const period = this.preciseStr(report["clockEstim"], 2);
        const freq = this.preciseStr(report["fmax"], 2);
        const out = `
----------------------------------------
Vitis HLS synthesis report

Targeted a ${report["platform"]} with target clock ${freq} ns

Achieved an estimated clock of ${period} ns (${freq} MHz)

Estimated latency for top function ${report["topFun"]}:
Worst case: ${report["latencyWorst"]} cycles
  Avg case: ${report["latencyAvg"]} cycles
 Best case: ${report["latencyBest"]} cycles

Estimated execution time:
Worst case: ${report["execTimeWorst"]} s
  Avg case: ${report["execTimeAvg"]} s
 Best case: ${report["execTimeBest"]} s

Resource usage:
FF:   ${report["FF"]} (${this.preciseStr(report["perFF"] * 100, 2)}%)
LUT:  ${report["LUT"]} (${this.preciseStr(report["perLUT"] * 100, 2)}%)
BRAM: ${report["BRAM"]} (${this.preciseStr(report["perBRAM"] * 100, 2)}%)
DSP:  ${report["DSP"]} (${this.preciseStr(report["perDSP"] * 100, 2)}%)
----------------------------------------`;
        console.log(out);
    }
}