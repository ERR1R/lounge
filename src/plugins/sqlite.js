"use strict";

const path = require("path");
const sqlite3 = require("sqlite3");
const Helper = require("../helper");
const Msg = require("../models/msg");

let schema = [
	"CREATE TABLE IF NOT EXISTS logs (network TEXT, channel TEXT, time INTEGER, type TEXT, nick TEXT, text TEXT)",
	"CREATE VIRTUAL TABLE IF NOT EXISTS texts USING fts4(content=\"logs\", nick, text)",
	"CREATE TRIGGER IF NOT EXISTS logs_bu BEFORE UPDATE ON logs BEGIN DELETE FROM texts WHERE docid=old.rowid; END",
	"CREATE TRIGGER IF NOT EXISTS logs_bd BEFORE DELETE ON logs BEGIN DELETE FROM texts WHERE docid=old.rowid; END",
	"CREATE TRIGGER IF NOT EXISTS logs_au AFTER UPDATE ON logs BEGIN INSERT INTO texts(docid, nick, text) VALUES(new.rowid, new.nick, new.text); END",
	"CREATE TRIGGER IF NOT EXISTS logs_ai AFTER INSERT ON logs BEGIN INSERT INTO texts(docid, nick, text) VALUES(new.rowid, new.nick, new.text); END",
	"CREATE INDEX IF NOT EXISTS network_channel ON logs (network, channel);",
];

class MessageStorage {
	constructor() {
		const sqlitePath = path.join(Helper.HOME, "messages.db");

		this.database = new sqlite3.cached.Database(sqlitePath);
		this.database.serialize(() => schema.forEach((line) => this.database.run(line)));

		schema = null;
	}

	index(network, channel, time, type, nick, text) {
		this.database.serialize(() => {
			this.database.run(
				"INSERT INTO logs(network, channel, time, type, nick, text) VALUES(?, ?, ?, ?, ?, ?)",
				network, channel, time, type, nick, text
			);
		});
	}

	getMessages(network, channel, offset = 0) {
		return new Promise((resolve, reject) => {
			this.database.all(
				"SELECT time, type, nick, text FROM logs WHERE network = ? AND channel = ? ORDER BY time DESC LIMIT 100 OFFSET ?",
				[network, channel, offset],
				(err, rows) => {
					if (err) {
						reject(err);
					} else {
						resolve(rows.map((msg) => new Msg({
							type: msg.type,
							time: msg.time * 1000,
							from: msg.nick,
							text: msg.text,
							self: network.nick === msg.nick,
						})));
					}
				}
			);
		});
	}
}

module.exports = MessageStorage;
