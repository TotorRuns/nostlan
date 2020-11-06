module.exports = async function(defaults) {
	let ver = prefs.version || pkg.version;
	prefs.version = pkg.version;

	systemsDir = path.join(prefs.nlaDir, '..');
	systemsDir = systemsDir.replace(/\\/g, '/');

	// only keeps the emu app path for the current os
	for (let _sys in systems) {
		let _syst = systems[_sys];
		if (!_syst.emus) continue;
		for (let _emu of _syst.emus) {

			let props = ['app', 'appDirs', 'appRegex', 'cmd', 'update', 'install', 'fullscreenKeyCombo'];

			for (let prop of props) {
				// always update install, appDirs, appRegex
				if (!prefs[_emu][prop] ||
					(!/(install|appDirs|appRegex)/.test(prop) && typeof prefs[_emu][prop] == 'string')) {
					continue;
				}
				if (prefs[_emu][prop][osType]) {
					prefs[_emu][prop] = prefs[_emu][prop][osType];
				} else if (defaults[_emu][prop] && defaults[_emu][prop][osType]) {
					prefs[_emu][prop] = defaults[_emu][prop][osType];
				} else if (prefs[_emu][prop].linux ||
					prefs[_emu][prop].mac ||
					prefs[_emu][prop].win) {
					delete prefs[_emu][prop];
				}
			}
		}

		// remove all game library locations with backslashes
		if (prefs[_sys] && prefs[_sys].libs && prefs[_sys].libs.length > 1) {
			for (let i in prefs[_sys].libs) {
				if (/\\/g.test(prefs[_sys].libs[i])) {
					prefs[_sys].libs.splice(i, 1);
				}
			}
		}
	}

	if (semver.gte(ver, '1.16.4')) return;

	if (linux) {
		prefs.mame.appDirs = [
			"$home/.mame"
		];
	}

	if (semver.gte(ver, '1.15.0')) return;

	delete prefs.mgba.appDirs;

	if (semver.gte(ver, '1.13.5')) return;

	let controTypes = ['xbox', 'ps', 'nintendo', 'default'];
	for (let type of controTypes) {
		delete prefs.ui.gamepad[type];
	}
	controTypes = ['xbox_ps', 'nintendo', 'other'];
	for (let type of controTypes) {
		prefs.ui.gamepad[type] = {};
		prefs.ui.gamepad[type].profile = 'adaptive';
		prefs.ui.gamepad[type].map = {};
	}

	if (semver.gte(ver, '1.13.3')) return;

	prefs.yuzu.fullscreenKeyCombo = [2000, ["f11"]];

	if (semver.gte(ver, '1.11.1')) return;

	let arcadeImages = `${systemsDir}/arcade/images`;
	if (await fs.exists(arcadeImages)) {
		await fs.remove(arcadeImages);
	}
	// rpcs3 changed, before it was preferrable for games
	// to be stored in the internal emu fs, now they can be
	// stored anywhere. For previous users of Nostlan I chose
	// to symlink that dir.
	let ps3Games = `${systemsDir}/ps3/games`;
	if (await fs.exists(ps3Games)) {
		let files = await klaw(ps3Games);
		if (!files.length) {
			await fs.remove(ps3Games);
			try {
				await fs.symlink(
					`${systemsDir}/${sys}/rpcs3/dev_hdd0/game`,
					ps3Games, 'dir'
				);
			} catch (ror) {
				er(ror);
			}
		}
	}

	// prefs version added in v1.8.x
	if (semver.gte(ver, '1.8.0')) return;
	// if prefs file is pre-v1.8.x
	// update older versions of the prefs file
	if (prefs.ui.gamepad.mapping) delete prefs.ui.gamepad.mapping;
	if (prefs.ui.recheckImgs) delete prefs.ui.recheckImgs;
	if (prefs.ui.gamepad.profile) {
		prefs.ui.gamepad.default.profile = prefs.ui.gamepad.profile;
		delete prefs.ui.gamepad.profile;
	}
	if (prefs.ui.gamepad.map) {
		prefs.ui.gamepad.default.map = prefs.ui.gamepad.map;
		delete prefs.ui.gamepad.map;
	}
	if (prefs['3ds']) prefs.n3ds = prefs['3ds'];
	delete prefs['3ds'];
	if (prefs.ui.maxRows) {
		prefs.ui.maxColumns = prefs.ui.maxRows;
		delete prefs.ui.maxRows;
	}
	// move old bottlenose directory
	if (prefs.btlDir) {
		prefs.nlaDir = path.join(prefs.btlDir, '..') + '/nostlan';
		if (await fs.exists(prefs.btlDir)) {
			await fs.move(prefs.btlDir, prefs.nlaDir);
		}
		delete prefs.btlDir;
		systemsDir = path.join(prefs.nlaDir, '..');
	}
	if (typeof prefs.donor == 'boolean') prefs.donor = {};
	if (prefs.saves) {
		for (let save of prefs.saves) {
			if (!save.noSaveOnQuit) save.noSaveOnQuit = false;
		}
	}
	for (let _sys in systems) {
		if (prefs[_sys]) {
			delete prefs[_sys].style;
			if (prefs[_sys].emu) prefs[_sys].name = prefs[_sys].emu;
			delete prefs[_sys].emu;
			if (_sys == 'arcade') continue;
			if (!prefs[_sys].name) continue;
			let _emu = prefs[_sys].name.toLowerCase();
			prefs[_emu] = prefs[_sys];
			delete prefs[_sys];
		}
	}

	// only keeps the emu app path for the current os
	for (let _sys in systems) {
		let _syst = systems[_sys];
		if (!_syst.emus) continue;
		for (let _emu of _syst.emus) {
			if (typeof prefs[_emu].app == 'string') continue;
			if (!prefs[_emu].app) continue;
			if (prefs[_emu].app[osType]) {
				prefs[_emu].app = prefs[_emu].app[osType];
			} else {
				delete prefs[_emu].app;
			}
		}
		for (let _emu of _syst.emus) {
			if (prefs[_emu].cmd[osType]) {
				prefs[_emu].cmd = prefs[_emu].cmd[osType];
			}
		}
	}

	// in v1.8.x the file structure of systemsDir was changed
	let errCount = 0;
	for (let _sys in systems) {
		let _syst = systems[_sys];
		if (!_syst.emus) continue;
		let _emu = _syst.emus[0];
		let moveDirs = [{
			src: `${systemsDir}/${prefs[_emu].name}`,
			dest: `${systemsDir}/${_sys}`
		}, {
			src: `${systemsDir}/nostlan/${_sys}`,
			dest: `${systemsDir}/${_sys}/images`
		}, {
			src: `${systemsDir}/${_sys}/BIN`,
			dest: `${systemsDir}/${_sys}/${_emu}`
		}, {
			src: `${systemsDir}/${_sys}/GAMES`, // make lowercase
			dest: `${systemsDir}/${_sys}/_games` // temp folder
		}, {
			src: `${systemsDir}/${_sys}/_games`,
			dest: `${systemsDir}/${_sys}/games`
		}];
		// remove old game lib files, rescanning must be done
		await fs.remove(`${usrDir}/_usr/${_sys}Games.json`);

		for (let moveDir of moveDirs) {
			let srcExists = await fs.exists(moveDir.src);
			let destExists = await fs.exists(moveDir.dest);

			if (srcExists && !destExists) {
				try {
					await fs.move(moveDir.src, moveDir.dest);
				} catch (ror) {
					er(ror);
					errCount++;
					break;
				}
				await fs.remove(moveDir.src);
			}
		}
		delete prefs[_emu].libs;
		if (prefs[_emu].saves) {
			delete prefs[_emu].saves.dirs;
		}
		await fs.remove(`${systemsDir}/nostlan/${_sys}`);

		if (prefs[_emu].app) {
			let emuApp = util.absPath(prefs[_emu].app);
			if (emuApp &&
				!(await fs.exists(emuApp))) {
				delete prefs[_emu].app;
			}
		}
	}

	await this.save();

	if (errCount > 0) {
		await cui.err(md('failed to automatically move some game library folders ' +
				'to conform to the new template structure (introduced in v1.8.x). ' + 'You must change them manually.  Read the ' +
				'[update log](https://github.com/quinton-ashley/nostlan/wiki/Update-Log-v1.8.x) ' +
				' on Nostlan\'s Github wiki to find out why these changes were made.'),
			400, 'quit');
	}
};
