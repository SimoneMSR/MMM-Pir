var log = () => { /* do nothing */ };
var cron = require("node-cron");
var parser = require("cron-parser");

function compareMomentAndDate (moment, date) {
  return toSeconds(moment) - (date.getHours() * 60 + date.getMinutes());
}

function compareMoments (moment1, moment2) {
  return toSeconds(moment1) - toSeconds(moment2);

}

function toSeconds (moment) {
  return moment.hour * 60 + moment.minute;
}

class cronJob {
  constructor (config, callback) {
    this.config = config;
    this.cronON = [];
    this.cronOFF = [];
    this.Manager = {
      mode: 0,
      ON: false,
      OFF: false,
      started: false,
      applyOnStart: false
    };
    this.cronState = callback.cronState;
    this.error = callback.error;
    this.error_unspecified = callback.error_unspecified;

    if (this.config.debug) log = (...args) => { console.log("[MMM-Pir] [LIB] [CRON]", ...args); };
    log("Reading ON/OFF cron configuration...");

    switch (this.config.mode) {
      case 0:
        console.log("[MMM-Pir] [LIB] [CRON] [MODE] Disabled.");
        this.Manager.mode = 0;
        break;
      case 1:
        console.log("[MMM-Pir] [LIB] [CRON] [MODE] Add mode 1");
        this.Manager.mode = 1;
        break;
      case 2:
        console.log("[MMM-Pir] [LIB] [CRON] [MODE] Add mode 2");
        this.Manager.mode = 2;
        break;
      case 3:
        console.log("[MMM-Pir] [LIB] [CRON] [MODE] Add mode 3");
        this.Manager.mode = 3;
        break;
      default:
        console.error(`[MMM-Pir] [LIB] [CRON] [MODE] Unknow Mode (${this.config.mode})`);
        this.error(`Unknow Mode (${this.config.mode})`);
        this.Manager.mode = 0;
        break;
    }
    if (this.config.applyOnStart) this.Manager.applyOnStart = this.config.applyOnStart;

    if (!this.Manager.mode) return;
    if (!this.config.ON) return console.warn("[MMM-Pir] [LIB] [CRON] ON feature not detected!");
    if (!this.config.OFF) return console.warn("[MMM-Pir] [LIB] [CRON] OFF feature not detected!");
    if (!Array.isArray(this.config.ON)) {
      this.error_unspecified(1);
      return console.error("[MMM-Pir] [LIB] [CRON] ~Code: 1~ ON feature must be an Array");
    }
    if (!Array.isArray(this.config.OFF)) {
      this.error_unspecified(2);
      return console.error("[MMM-Pir] [LIB] [CRON] ~Code 2~ OFF feature must be an Array");
    }

    this.config.ON.forEach((ON) => {
      if (this.isObject(ON)) {
        this.checkCron(ON, "ON");
      } else {
        console.error("[MMM-Pir] [LIB] [CRON] [ON] ~Code 3~", ON, "must be an object");
        this.error_unspecified(3);
      }
    });

    if (!this.cronON.length) {
      console.log("[MMM-Pir] [LIB] [CRON] [ON] no cron defined");
    } else {
      log("[ON] Result:", this.cronON);
    }

    this.config.OFF.forEach((OFF) => {
      if (this.isObject(OFF)) {
        this.checkCron(OFF, "OFF");
      } else {
        console.error("[MMM-Pir] [LIB] [CRON] [OFF] ~Code 4~", OFF, "must be an object");
        this.error_unspecified(4);
      }
    });
    if (!this.cronOFF.length) {
      console.log("[MMM-Pir] [LIB] [CRON] [OFF] no cron defined");
    } else {
      log("[OFF] Result:", this.cronOFF);
    }

  }

  checkCron (toCron, type) {
    var interval = parser.parseExpression("* * * * *");
    var fields = JSON.parse(JSON.stringify(interval.fields));
    console.log(`[MMM-Pir] [LIB] [CRON] [${type}] Configure:`, toCron);
    if (isNaN(toCron.hour)) {
      this.error_unspecified(5);
      return console.error(`[MMM-Pir] [LIB] [CRON] ~Code 5~ [${type}]`, toCron, "hour must be a number");
    }
    fields.hour = [toCron.hour];
    if (isNaN(toCron.minute)) {
      this.error_unspecified(6);
      return console.error(`[MMM-Pir] [LIB] [CRON] ~Code 6~ [${type}]`, toCron, "minute must be a number");
    }
    fields.minute = [toCron.minute];
    if (!Array.isArray(toCron.dayOfWeek)) {
      this.error_unspecified(7);
      return console.error(`[MMM-Pir] [LIB] [CRON] ~Code 7~ [${type}]`, toCron, "dayOfWeek must be a Array");
    }
    fields.dayOfWeek = toCron.dayOfWeek;
    try {
      var modifiedInterval = parser.fieldsToExpression(fields);
      var job = modifiedInterval.stringify();
      log(`[${type}] PASSED --->`, job);
      if (type === "ON") this.cronON.push(job);
      else this.cronOFF.push(job);
      console.log(`[MMM-Pir] [LIB] [CRON] [${type}] Next`, type === "ON" ? "Start:" : "Stop:", modifiedInterval.next().toString());
    } catch (e) {
      this.error_unspecified(8);
      console.error(`[MMM-Pir] [LIB] [CRON] ~Code 8~ [${type}]`, toCron, e.toString());
    }
  }

  start () {
    if (!this.Manager.mode || (!this.cronON.length && !this.cronOFF.length)) return;
    if (!this.cronON.length && this.cronOFF.length) {
      this.error("ON feature missing or failed!");
      console.error("[MMM-Pir] [LIB] [CRON] ON feature missing or failed!");
      return;
    }
    if (this.cronON.length && !this.cronOFF.length) {
      this.error("OFF feature missing or failed!");
      console.error("[MMM-Pir] [LIB] [CRON] OFF feature missing or failed!");
      return;
    }

    this.Manager.started = true;

    this.cronON.forEach((on) => {
      cron.schedule(on, () => {
        this.turnOn();
      });
      log("[ON] Added:", on);
    });

    this.cronOFF.forEach((off) => {
      cron.schedule(off, () => {
        this.turnOff();
      });
      log("[OFF] Added:", off);
    });

    this.cronState(this.Manager);
    if (this.Manager.applyOnStart) {
      setTimeout(() => {
        var now = new Date();
        var onForNow = this.config.ON.filter((on) => on.dayOfWeek.includes(now.getDay()) && compareMomentAndDate(on, now) <= 0).sort(compareMoments).pop();
        if (onForNow) {
          var allOffForNow = this.config.OFF.filter((off) => off.dayOfWeek.includes(now.getDay()) && compareMoments(onForNow, off) < 0).sort(compareMoments);
          if (allOffForNow.length === 0 || allOffForNow.find((off) => compareMomentAndDate(off, now) > 0)) {
            this.turnOn();
          } else if (allOffForNow.find((off) => compareMomentAndDate(off, now) < 0)) this.turnOff();
        } else {
          this.turnOff();
        }
      }, 2000);
    }
  }

  _turn (on) {
    var on_off = on ? "ON" : "OFF";
    log(`[${on_off}] It's time to turn ${on_off}`);
    this.Manager.ON = on;
    this.Manager.OFF = !on;
    this.cronState(this.Manager);
  }

  turnOn () {
    this._turn(true);
  }

  turnOff () {
    this._turn(false);
  }

  isObject (o) {
    return o !== null && typeof o === "object" && Array.isArray(o) === false;
  }
}

module.exports = cronJob;
