"use strict";

const $ = require("jquery");
const socket = require("../socket");
const templates = require("../../views");

socket.on("changelog", function(data) {
	$(".changelog-container").html(templates.changelog(data));
});
