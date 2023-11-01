module.exports = async function (defaults) {
	let ver = cf.version || pkg.version;
	// update version number
	cf.version = pkg.version;
	if (cf.nlaDir) {
		systemsDir = path.join(cf.nlaDir, '..');
		systemsDir = systemsDir.replace(/\\/g, '/');
	}

	if (semver.lt(ver, '1.25.0')) {
		// delete old jsEmu app locations
		delete cf.iodine;
		delete cf['em-fceux'].app;
	}

	for (let _sys in systems) {
		let _syst = systems[_sys];
		if (!_syst.emus) continue;
		for (let _emu of _syst.emus) {
			if (!emus[_emu]) {
				console.warn(_emu + ' emulator support file for Nostlan not found!');
				_syst.emus.splice(_syst.emus.indexOf(_emu), 1);
				continue;
			}
			if (!cf[_emu]) cf[_emu] = {};

			let props = ['app', 'cmd', 'bios', 'dev', 'mute', 'volume', 'keyboard'];
			for (let prop of props) {
				// initialize to defaults if nothing is there yet
				if (
					prop == 'latestVersion' ||
					(typeof cf[_emu][prop] == 'undefined' && typeof emus[_emu][prop] != 'undefined')
				) {
					cf[_emu][prop] = emus[_emu][prop];
				}
			}
		}

		// remove all game library locations with backslashes
		if (cf[_sys] && cf[_sys].libs && cf[_sys].libs.length > 1) {
			for (let i in cf[_sys].libs) {
				if (/\\/g.test(cf[_sys].libs[i])) {
					cf[_sys].libs.splice(i, 1);
				}
			}
		}
	}

	if (semver.gte(ver, '2.3.0')) return;

	cf.ui.gamepad.gca = false;
	if (cf.ryujinx && cf.ryujinx.saves) cf.ryujinx.saves.dirs = [];

	if (semver.gte(ver, '2.2.0')) return;

	{
		let regions = {
			E: 'USA',
			J: 'Japan',
			P: 'Europe'
		};

		if (cf.region.length == 1) cf.region = regions[cf.region] || 'USA';
	}

	if (semver.gt(ver, '1.26.0')) return;

	if (mac) cf.cemu.cmd = ['${app}', '-g', '${game}', '-f'];

	if (semver.gte(ver, '1.22.1')) return;

	delete cf.chip_arch;

	if (semver.gte(ver, '1.20.22')) return;

	// force update user cf due to command name change
	// from d3d12_resolution_scale to draw_resolution_scale
	cf.xenia.cmd = emus.xenia.cmd;

	if (semver.gte(ver, '1.20.17')) return;

	for (let _sys in systems) {
		let _syst = systems[_sys];
		if (!_syst.emus) continue;
		for (let _emu of _syst.emus) {
			let props = ['app', 'cmd', 'saves'];
			let obj = {};
			for (let prop of props) {
				obj[prop] = cf[_emu][prop];
			}
			cf[_emu] = obj;
		}
	}

	if (semver.gte(ver, '1.16.4')) return;

	if (linux) {
		emus.mame.appDirs.linux = ['~/.mame'];
	}

	if (semver.gte(ver, '1.13.5')) return;

	let controTypes = ['xbox', 'ps', 'nintendo', 'default'];
	for (let type of controTypes) {
		delete cf.ui.gamepad[type];
	}
	controTypes = ['xbox_ps', 'nintendo', 'other'];
	for (let type of controTypes) {
		cf.ui.gamepad[type] = {};
		cf.ui.gamepad[type].profile = 'adaptive';
		cf.ui.gamepad[type].map = {};
	}

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
				await fs.symlink(`${systemsDir}/${sys}/rpcs3/dev_hdd0/game`, ps3Games, 'dir');
			} catch (ror) {
				er(ror);
			}
		}
	}

	// cf version added in v1.8.x
	if (semver.gte(ver, '1.8.0')) return;
	// if cf file is pre-v1.8.x
	// update older versions of the cf file
	if (cf.ui.gamepad.mapping) delete cf.ui.gamepad.mapping;
	if (cf.ui.recheckImgs) delete cf.ui.recheckImgs;
	if (cf.ui.gamepad.profile) {
		cf.ui.gamepad.default.profile = cf.ui.gamepad.profile;
		delete cf.ui.gamepad.profile;
	}
	if (cf.ui.gamepad.map) {
		cf.ui.gamepad.default.map = cf.ui.gamepad.map;
		delete cf.ui.gamepad.map;
	}
	if (cf['3ds']) cf.n3ds = cf['3ds'];
	delete cf['3ds'];
	if (cf.ui.maxRows) {
		cf.ui.maxColumns = cf.ui.maxRows;
		delete cf.ui.maxRows;
	}
	// move old bottlenose directory
	if (cf.btlDir) {
		cf.nlaDir = path.join(cf.btlDir, '..') + '/nostlan';
		if (await fs.exists(cf.btlDir)) {
			await fs.move(cf.btlDir, cf.nlaDir);
		}
		delete cf.btlDir;
		systemsDir = path.join(cf.nlaDir, '..');
	}
	if (typeof cf.donor == 'boolean') cf.donor = {};
	if (cf.saves) {
		for (let save of cf.saves) {
			if (!save.noSaveOnQuit) save.noSaveOnQuit = false;
		}
	}
	for (let _sys in systems) {
		if (cf[_sys]) {
			delete cf[_sys].style;
			if (cf[_sys].emu) cf[_sys].name = cf[_sys].emu;
			delete cf[_sys].emu;
			if (_sys == 'arcade') continue;
			if (!cf[_sys].name) continue;
			let _emu = cf[_sys].name.toLowerCase();
			cf[_emu] = cf[_sys];
			delete cf[_sys];
		}
	}

	// only keeps the emu app path for the current os
	for (let _sys in systems) {
		let _syst = systems[_sys];
		if (!_syst.emus) continue;
		for (let _emu of _syst.emus) {
			if (typeof cf[_emu].app == 'string') continue;
			if (!cf[_emu].app) continue;
			if (cf[_emu].app[osType]) {
				cf[_emu].app = cf[_emu].app[osType];
			} else {
				delete cf[_emu].app;
			}
		}
		for (let _emu of _syst.emus) {
			if (cf[_emu].cmd[osType]) {
				cf[_emu].cmd = cf[_emu].cmd[osType];
			}
		}
	}

	// in v1.8.x the file structure of systemsDir was changed
	let errCount = 0;
	for (let _sys in systems) {
		let _syst = systems[_sys];
		if (!_syst.emus) continue;
		let _emu = _syst.emus[0];
		let moveDirs = [
			{
				src: `${systemsDir}/${emus[_emu].name}`,
				dest: `${systemsDir}/${_sys}`
			},
			{
				src: `${systemsDir}/nostlan/${_sys}`,
				dest: `${systemsDir}/${_sys}/images`
			},
			{
				src: `${systemsDir}/${_sys}/BIN`,
				dest: `${systemsDir}/${_sys}/${_emu}`
			},
			{
				src: `${systemsDir}/${_sys}/GAMES`, // make lowercase
				dest: `${systemsDir}/${_sys}/_games` // temp folder
			},
			{
				src: `${systemsDir}/${_sys}/_games`,
				dest: `${systemsDir}/${_sys}/games`
			}
		];
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
		delete cf[_emu].libs;
		if (cf[_emu].saves) {
			delete cf[_emu].saves.dirs;
		}
		await fs.remove(`${systemsDir}/nostlan/${_sys}`);

		if (cf[_emu].app) {
			let emuApp = util.absPath(cf[_emu].app);
			if (emuApp && !(await fs.exists(emuApp))) {
				delete cf[_emu].app;
			}
		}
	}

	await this.save();

	if (errCount > 0) {
		await cui.err(
			md(
				'failed to automatically move some game library folders ' +
					'to conform to the new template structure (introduced in v1.8.x). ' +
					'You must change them manually.  Read the ' +
					'[update log](https://github.com/quinton-ashley/nostlan/wiki/Update-Log-v1.8.x) ' +
					" on Nostlan's Github wiki to find out why these changes were made."
			),
			400,
			'quit'
		);
	}
};
