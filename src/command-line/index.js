"use strict";

global.log = require("../log.js");

const fs = require("fs");
const path = require("path");
const program = require("commander");
const colors = require("colors/safe");
const Helper = require("../helper");
const Utils = require("./utils");

if (require("semver").lt(process.version, "6.0.0")) {
	log.warn(`Support of Node.js v4 is ${colors.bold("deprecated")} and will be removed in The Lounge v3.`);
	log.warn("Please upgrade to Node.js v6 or more recent.");
}

program.version(Helper.getVersion(), "-v, --version")
	.on("--help", Utils.extraHelp)
	.parseOptions(process.argv);

// Check if the app was built before calling setHome as it wants to load manifest.json from the public folder
if (!fs.existsSync(path.join(
	__dirname,
	"..",
	"..",
	"public",
	"manifest.json"
))) {
	log.error(`The client application was not built. Run ${colors.bold("NODE_ENV=production npm run build")} to resolve this.`);
	process.exit(1);
}

Helper.setHome(process.env.THELOUNGE_HOME || Utils.defaultHome());

require("./start");
require("./config");
require("./list");
require("./add");
require("./remove");
require("./reset");
require("./edit");
require("./install");

program.parse(process.argv);

if (!program.args.length) {
	program.help();
}
