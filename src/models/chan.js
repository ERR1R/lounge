"use strict";

var _ = require("lodash");
var Helper = require("../helper");
const Msg = require("./msg");
const User = require("./user");
const userLog = require("../userLog");
const storage = require("../plugins/storage");

module.exports = Chan;

Chan.Type = {
	CHANNEL: "channel",
	LOBBY: "lobby",
	QUERY: "query",
	SPECIAL: "special",
};

let id = 1;

function Chan(attr) {
	_.defaults(this, attr, {
		id: id++,
		messages: [],
		name: "",
		key: "",
		topic: "",
		type: Chan.Type.CHANNEL,
		firstUnread: 0,
		unread: 0,
		highlight: 0,
		users: new Map(),
	});
}

Chan.prototype.destroy = function() {
	this.dereferencePreviews(this.messages);
};

Chan.prototype.pushMessage = function(client, msg, increasesUnread) {
	var obj = {
		chan: this.id,
		msg: msg,
	};

	// If this channel is open in any of the clients, do not increase unread counter
	const isOpen = _.find(client.attachedClients, {openChannel: this.id}) !== undefined;

	if ((increasesUnread || msg.highlight) && !isOpen) {
		obj.unread = ++this.unread;
	}

	client.emit("msg", obj);

	// Never store messages in public mode as the session
	// is completely destroyed when the page gets closed
	if (Helper.config.public) {
		return;
	}

	this.writeUserLog(client, msg);

	if (Helper.config.maxHistory >= 0 && this.messages.length > Helper.config.maxHistory) {
		const deleted = this.messages.splice(0, this.messages.length - Helper.config.maxHistory);

		// If maxHistory is 0, image would be dereferenced before client had a chance to retrieve it,
		// so for now, just don't implement dereferencing for this edge case.
		if (Helper.config.prefetch && Helper.config.prefetchStorage && Helper.config.maxHistory > 0) {
			this.dereferencePreviews(deleted);
		}
	}

	if (msg.self) {
		// reset counters/markers when receiving self-/echo-message
		this.firstUnread = 0;
		this.highlight = 0;
	} else if (!isOpen) {
		if (!this.firstUnread) {
			this.firstUnread = msg.id;
		}

		if (msg.highlight) {
			this.highlight++;
		}
	}
};

Chan.prototype.dereferencePreviews = function(messages) {
	messages.forEach((message) => {
		if (message.preview && message.preview.thumb) {
			storage.dereference(message.preview.thumb);
			message.preview.thumb = null;
		}
	});
};

Chan.prototype.getSortedUsers = function(irc) {
	var userModeSortPriority = {};
	irc.network.options.PREFIX.forEach((prefix, index) => {
		userModeSortPriority[prefix.symbol] = index;
	});

	userModeSortPriority[""] = 99; // No mode is lowest

	const users = Array.from(this.users.values());

	return users.sort(function(a, b) {
		if (a.mode === b.mode) {
			return a.nick.toLowerCase() < b.nick.toLowerCase() ? -1 : 1;
		}

		return userModeSortPriority[a.mode] - userModeSortPriority[b.mode];
	});
};

Chan.prototype.findMessage = function(msgId) {
	return this.messages.find((message) => message.id === msgId);
};

Chan.prototype.findUser = function(nick) {
	return this.users.get(nick.toLowerCase());
};

Chan.prototype.getUser = function(nick) {
	return this.findUser(nick) || new User({nick: nick});
};

Chan.prototype.setUser = function(user) {
	this.users.set(user.nick.toLowerCase(), user);
};

Chan.prototype.removeUser = function(user) {
	this.users.delete(user.nick.toLowerCase());
};

Chan.prototype.toJSON = function() {
	var clone = _.clone(this);
	clone.users = []; // Do not send user list, the client will explicitly request it when needed
	clone.messages = clone.messages.slice(-100);
	return clone;
};

Chan.prototype.writeUserLog = function(client, msg) {
	this.messages.push(msg);

	const target = client.find(this.id);

	if (!target) {
		return false;
	}

	if ((this.type === Chan.Type.CHANNEL || this.type === Chan.Type.QUERY)
		&& (msg.type === Msg.Type.MESSAGE || msg.type === Msg.Type.ACTION)) {
		client.manager.messageStorage.index(
			target.network.uuid,
			this.name,
			Math.floor(msg.time.getTime() / 1000),
			msg.type,
			msg.from,
			msg.text
		);
	}

	if (!client.config.log) {
		return;
	}

	userLog.write(
		client.name,
		target.network.host, // TODO: Fix #1392, multiple connections to same server results in duplicate logs
		this.type === Chan.Type.LOBBY ? target.network.host : this.name,
		msg
	);
};
