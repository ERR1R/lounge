"use strict";

const _ = require("lodash");
const colors = require("colors/safe");
const fs = require("fs");
const fsextra = require("fs-extra");
const path = require("path");
const program = require("commander");
const Helper = require("../helper");
const Utils = require("./utils");

program
	.command("start")
	.option(
		"-c, --config <key=value>",
		"override entries of the configuration file, must be specified for each entry that needs to be overriden",
		Utils.parseConfigOptions
	)
	.description("Start the server")
	.on("--help", Utils.extraHelp)
	.action(function({config}) {
		initalizeConfig();

		// Merge config options passed as CLI argument into the main config
		_.merge(Helper.config, config);

		const server = require("../server");
		server();
	});

function initalizeConfig() {
	if (!fs.existsSync(Helper.getConfigPath())) {
		fsextra.ensureDirSync(Helper.getHomePath());
		fs.chmodSync(Helper.getHomePath(), "0700");
		fsextra.copySync(path.resolve(path.join(
			__dirname,
			"..",
			"..",
			"defaults",
			"config.js"
		)), Helper.getConfigPath());
		log.info(`Configuration file created at ${colors.green(Helper.getConfigPath())}.`);
	}

	fsextra.ensureDirSync(Helper.getUsersPath());
}
