"use strict";

class VitisHlsReportParser {
    reportPath;
    constructor(reportPath) {
        this.reportPath = reportPath;
    }

    xmlToJson(xml) {
        //parses only the "leaves" of the XML string, which is enough for us. For now.
        const regex = /(?:<([a-zA-Z'-\d_]*)(?:\s[^>]*)*>)((?:(?!<\1).)*)(?:<\/\1>)|<([a-zA-Z'-]*)(?:\s*)*\/>/gm;
        const json = {};
        for (const match of xml.matchAll(regex)) {
            const key = match[1] || match[3];
            const val = match[2] && this.xmlToJson(match[2]);
            json[key] = (val && Object.keys(val).length ? val : match[2]) || null;
        }
        return json;
    }

    getSanitizedJSON() {
        const raw = this.getRawJSON();
        const fmax = this.calculateMaxFrequency(raw["EstimatedClockPeriod"]);
        const execTimeWorst = this.calculateExecutionTime(raw["Worst-caseLatency"], fmax);
        const execTimeAvg = this.calculateExecutionTime(raw["Average-caseLatency"], fmax);
        const execTimeBest = this.calculateExecutionTime(raw["Best-caseLatency"], fmax);
        const hasFixedLatency = raw["Best-caseLatency"] === raw["Worst-caseLatency"];

        const sanitized = {
            platform: raw["Part"],
            topFun: raw["TopModelName"],

            clockTarget: parseFloat(raw["TargetClockPeriod"]),
            clockEstim: parseFloat(raw["EstimatedClockPeriod"]),
            fmax: parseFloat(fmax),

            latencyWorst: parseInt(raw["Worst-caseLatency"]),
            latencyAvg: parseInt(raw["Average-caseLatency"]),
            latencyBest: parseInt(raw["Best-caseLatency"]),
            hasFixedLatency: hasFixedLatency,

            execTimeWorst: parseFloat(execTimeWorst),
            execTimeAvg: parseFloat(execTimeAvg),
            execTimeBest: parseFloat(execTimeBest),

            FF: parseInt(raw["FF"]),
            LUT: parseInt(raw["LUT"]),
            BRAM: parseInt(raw["BRAM_18K"]),
            DSP: parseInt(raw["DSP"]),

            availFF: parseInt(raw["AVAIL_FF"]),
            availLUT: parseInt(raw["AVAIL_LUT"]),
            availBRAM: parseInt(raw["AVAIL_BRAM"]),
            availDSP: parseInt(raw["AVAIL_DSP"]),

            perFF: parseFloat(raw["FF"] / raw["AVAIL_FF"]),
            perLUT: parseFloat(raw["LUT"] / raw["AVAIL_LUT"]),
            perBRAM: parseFloat(raw["BRAM_18K"] / raw["AVAIL_BRAM"]),
            perDSP: parseFloat(raw["DSP"] / raw["AVAIL_DSP"]),
        };

        for (const key in sanitized) {
            if (sanitized[key] == null) {
                sanitized[key] = -1;
            }
        }
        return sanitized;
    }

    getRawJSON() {
        const xml = Io.readFile(this.reportPath);
        return this.xmlToJson(xml);
    }

    calculateMaxFrequency(clockEstim) {
        return (1 / clockEstim) * 1000;
    }

    calculateExecutionTime(latency, freqMHz) {
        const freqHz = freqMHz * 1e6;
        return latency / freqHz;
    }
}