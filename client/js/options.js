"use strict";

const $ = require("jquery");
const escapeRegExp = require("lodash/escapeRegExp");
const userStyles = $("#user-specified-css");
const storage = require("./localStorage");
const tz = require("./libs/handlebars/tz");
const autocompletion = require("./autocompletion");

const windows = $("#windows");
const chat = $("#chat");

// Default options
const options = {
	autocomplete: true,
	coloredNicks: true,
	desktopNotifications: false,
	highlights: [],
	links: true,
	motd: true,
	notification: true,
	notifyAllMessages: false,
	showSeconds: false,
	statusMessages: "condensed",
	theme: $("#theme").attr("href").replace(/^themes\/(.*).css$/, "$1"), // Extracts default theme name, set on the server configuration
	thumbnails: true,
	userStyles: userStyles.text(),
};
let userOptions = JSON.parse(storage.get("settings")) || {};

for (const key in options) {
	if (userOptions[key] !== undefined) {
		options[key] = userOptions[key];
	}
}

// Apply custom CSS on page load
if (typeof userOptions.userStyles === "string" && !/[?&]nocss/.test(window.location.search)) {
	userStyles.html(userOptions.userStyles);
}

userOptions = null;

module.exports = options;

module.exports.shouldOpenMessagePreview = function(type) {
	return (options.links && type === "link") || (options.thumbnails && type === "image");
};

module.exports.initialize = () => {
	module.exports.initialize = null;

	const settings = $("#settings");

	for (var i in options) {
		if (i === "userStyles") {
			settings.find("#user-specified-css-input").val(options[i]);
		} else if (i === "highlights") {
			settings.find("input[name=" + i + "]").val(options[i]);
		} else if (i === "statusMessages") {
			settings.find(`input[name=${i}][value=${options[i]}]`)
				.prop("checked", true);
		} else if (i === "theme") {
			$("#theme").attr("href", "themes/" + options[i] + ".css");
			settings.find("select[name=" + i + "]").val(options[i]);
		} else if (options[i]) {
			settings.find("input[name=" + i + "]").prop("checked", true);
		}
	}

	const desktopNotificationsCheckbox = $("#desktopNotifications");
	const warningUnsupported = $("#warnUnsupportedDesktopNotifications");
	const warningBlocked = $("#warnBlockedDesktopNotifications").hide();

	// Updates the checkbox and warning in settings when the Settings page is
	// opened or when the checkbox state is changed.
	// When notifications are not supported, this is never called (because
	// checkbox state can not be changed).
	const updateDesktopNotificationStatus = function() {
		if (Notification.permission === "denied") {
			desktopNotificationsCheckbox.attr("disabled", true);
			desktopNotificationsCheckbox.attr("checked", false);
			warningBlocked.show();
		} else {
			if (Notification.permission === "default" && desktopNotificationsCheckbox.prop("checked")) {
				desktopNotificationsCheckbox.attr("checked", false);
			}
			desktopNotificationsCheckbox.attr("disabled", false);
			warningBlocked.hide();
		}
	};

	// If browser does not support notifications, override existing settings and
	// display proper message in settings.
	if (("Notification" in window)) {
		warningUnsupported.hide();
		windows.on("show", "#settings", updateDesktopNotificationStatus);
	} else {
		options.desktopNotifications = false;
		desktopNotificationsCheckbox.attr("disabled", true);
		desktopNotificationsCheckbox.attr("checked", false);
	}

	settings.on("change", "input, select, textarea", function() {
		const self = $(this);
		const type = self.attr("type");
		const name = self.attr("name");

		if (type === "password") {
			return;
		} else if (type === "radio") {
			if (self.prop("checked")) {
				options[name] = self.val();
			}
		} else if (type === "checkbox") {
			options[name] = self.prop("checked");
		} else {
			options[name] = self.val();
		}

		storage.set("settings", JSON.stringify(options));

		if (name === "motd") {
			chat.toggleClass("hide-" + name, !self.prop("checked"));
		} else if (name === "statusMessages") {
			chat.toggleClass("hide-status-messages", options[name] === "hidden");
			chat.toggleClass("condensed-status-messages", options[name] === "condensed");
		} else if (name === "coloredNicks") {
			chat.toggleClass("colored-nicks", self.prop("checked"));
		} else if (name === "theme") {
			$("#theme").attr("href", "themes/" + options[name] + ".css");
		} else if (name === "userStyles") {
			userStyles.html(options[name]);
		} else if (name === "highlights") {
			var highlightString = options[name];
			options.highlights = highlightString.split(",").map(function(h) {
				return h.trim();
			}).filter(function(h) {
				// Ensure we don't have empty string in the list of highlights
				// otherwise, users get notifications for everything
				return h !== "";
			});
			// Construct regex with wordboundary for every highlight item
			const highlightsTokens = options.highlights.map(function(h) {
				return escapeRegExp(h);
			});
			if (highlightsTokens && highlightsTokens.length) {
				module.exports.highlightsRE = new RegExp("\\b(?:" + highlightsTokens.join("|") + ")\\b", "i");
			} else {
				module.exports.highlightsRE = null;
			}
		} else if (name === "showSeconds") {
			chat.find(".msg > .time").each(function() {
				$(this).text(tz($(this).parent().data("time")));
			});
			chat.toggleClass("show-seconds", self.prop("checked"));
		} else if (name === "autocomplete") {
			if (self.prop("checked")) {
				autocompletion.enable();
			} else {
				autocompletion.disable();
			}
		} else if (name === "desktopNotifications") {
			if ($(this).prop("checked") && Notification.permission !== "granted") {
				Notification.requestPermission(updateDesktopNotificationStatus);
			}
		}
	}).find("input")
		.trigger("change");
};
