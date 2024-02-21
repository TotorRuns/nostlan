/**
 * db-cli.js
 *
 * electron . --db up --sys switch
 */
module.exports = async function (arg) {
	global.path = require('path');
	arg.__root = path.join(__dirname, '/..').replace(/\\/g, '/');
	await require(arg.__root + '/core/setup.js')(arg);

	const db = require(__dirname + '/db.js');

	global.sys = arg.sys;

	if (arg.db == 'up') {
		await db.generate();
		await db.merge();
	} else if (arg.db == 'gen') {
		db.generate();
	} else if (arg.db == 'merge') {
		db.merge();
	} else {
		er("cli db can't do this action: " + arg.do);
	}
};
