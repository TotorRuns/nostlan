/*
 * saves.js : Nostlan : quinton-ashley
 *
 * Backup/sync save data to the cloud or local storage device.
 * This is a premium feature for Patreon supporters.
 */
class Saves {
	constructor() {}

	async setup() {
		if (!cf[emu].saves) cf[emu].saves = {};

		if (/(bsnes|melonds|mgba|snes9x|vba)/.test(emu)) {
			cf[emu].saves.dirs = cf[sys].libs;
			return true;
		}
		let emuApp = util.absPath(cf[emu].app);
		if (!emuApp || !(await fs.exists(emuApp))) {
			er('nostlan must know the location of ' + emus[emu].name + ' before you can backup/update emulator saves');
			return;
		}
		let dir = path.join(emuApp, '..');
		dir = dir.replace(/\\/g, '/');

		if (emus[emu].jsEmu) {
			cf[emu].saves.dirs = [dir + '/saves', dir + '/states'];
		} else if (emu == 'cemu') {
			cf[emu].saves.dirs = [dir + '/mlc01/usr/save'];
		} else if (emu == 'citra') {
			if (win) {
				dir = util.absPath('$home') + '/AppData/Roaming/Citra/sdmc';
			} else if (mac || linux) {
				dir = util.absPath('$home') + '/.local/share/citra-emu/sdmc';
			}
			cf[emu].saves.dirs = [dir];
		} else if (emu == 'desmume') {
			if (mac) {
				dir = util.absPath('$home') + '/Library/Application Support/DeSmuME/0.9.11';
			}
			cf[emu].saves.dirs = [dir + '/Battery', dir + '/Cheats', dir + '/States'];
		} else if (emu == 'dolphin') {
			dir += '/User';
			if (mac && !(await fs.exists(dir))) {
				dir = util.absPath('$home') + '/Library/Application Support/Dolphin';
			}
			if (!(await fs.exists(dir))) {
				cui.err(
					`"User" folder not found. "User" folder needs to be in the same folder as "Dolphin.exe". To make a build use a local "User" directory, create a text file named "portable" next to the executable files of the app (Dolphin.exe). Including the file extension, it should be named "portable.txt". Dolphin will check if that file exists in the same directory, then it will not use a global "User" directory, instead it will create and use the local "User" directory in the same directory. For more info look at: https://dolphin-emu.org/docs/guides/controlling-global-user-directory/`
				);
				return;
			}
			cf[emu].saves.dirs = [dir + '/GC', dir + '/Wii/title', dir + '/StateSaves'];
		} else if (emu == 'mame') {
			cf[emu].saves.dirs = [dir + '/sta'];
		} else if (emu == 'mesen') {
			cf[emu].saves.dirs = [dir + '/Saves', dir + '/SaveStates', dir + '/RecentGames'];
		} else if (emu == 'mupen64plus') {
			if (win) {
				dir = util.absPath('$home') + '/AppData/Roaming/Mupen64Plus';
			} else if (mac) {
				dir = util.absPath('$home') + '/Library/Application Support/Mupen64plus';
			} else if (linux) {
				dir = util.absPath('$home') + '/.local/share/mupen64plus';
			}
			cf[emu].saves.dirs = [dir + '/save'];
		} else if (emu == 'pcsx2') {
			cf[emu].saves.dirs = [dir + '/memcards', dir + '/sstates'];
		} else if (emu == 'ppsspp') {
			dir += '/memstick/PSP';
			cf[emu].saves.dirs = [dir + '/SAVEDATA', dir + '/PPSSPP_STATE'];
		} else if (emu == 'project64') {
			cf[emu].saves.dirs = [dir + '/Save'];
		} else if (emu == 'rpcs3') {
			dir += '/dev_hdd0/home/00000001/savedata';
			cf[emu].saves.dirs = [dir];
		} else if (emu == 'ryujinx') {
			dir += '/portable';
			if (!(await fs.exists(dir))) {
				if (win) {
					dir = util.absPath('$home') + '/AppData/Roaming';
				} else if (linux) {
					dir = util.absPath('$home') + '/.config';
				} else if (mac) {
					dir = util.absPath('$home') + '/Library/Application Support';
				}
				dir += '/Ryujinx';
			}
			cf[emu].saves.dirs = [
				dir + '/bis/user/save',
				dir + '/bis/user/saveMeta',
				dir + '/bis/system/save/8000000000000000',
				dir + '/system'
			];
		} else if (emu == 'xenia') {
			dir = util.absPath('$home') + '/Documents/Xenia/content';
			cf[emu].saves.dirs = [dir];
		} else if (emu == 'yuzu') {
			let dir0;
			if (win) {
				dir0 = util.absPath('$home') + '/AppData/Roaming/yuzu';
			} else if (mac || linux) {
				dir = util.absPath('$home') + '/.local/share/yuzu';
				dir0 = dir;
			}
			let dir1 = path.join(cf.nlaDir, '../switch/yuzu');
			if (await fs.exists(dir1 + '/nand')) dir = dir1;
			cf[emu].saves.dirs = [
				dir + '/nand/user/save',
				dir0 + '/load' // mods
			];
		} else {
			delete cf[emu].saves;
			er('save sync not supported for this emu: ' + emu);
			return false;
		}
		return true;
	}

	async _backup(onQuit) {
		// convert to UNIX timestamp
		let date = Math.trunc(Date.now() / 1000);

		for (let save of cf.saves) {
			if (save.noSaveOnQuit) {
				log('no save on quit for ' + save.name);
				continue;
			}

			if (cf[emu].saves.noSaveOnQuit) {
				log('no save on quit for ' + emus[emu].name);
				continue;
			}

			let dir = `${save.dir}/nostlan_saves/${emu}/${date}`;

			for (let i in cf[emu].saves.dirs) {
				let src = cf[emu].saves.dirs[i];
				let dest = dir + '/' + i;
				if (!(await fs.exists(src))) continue;
				log(`Backing up files to ${save.name} from ${src}`);
				$('#loadDialog0').text(`Backing up files to ${save.name} from`);
				$('#loadDialog1').text(src);
				try {
					await fs.ensureDir(dest);
				} catch (ror) {
					er(ror);
					cui.err('Save Sync ERROR: can not save to cloud/backup saves folder\n' + dest);
					return;
				}
				if (/(bsnes|desmume|melonds|mgba|snes9x)/.test(emu)) {
					let files = await klaw(src, {
						depthLimit: 0
					});
					for (let file of files) {
						await fs.copy(file, dest + '/' + path.parse(file).base, {
							filter: function (file) {
								let ext = path.parse(file).ext.toLowerCase();
								// only copy files with these extensions
								if (/\.(dct|ds\d|dsv|ml\d|sav|srm|bsz)/i.test(ext)) {
									return true;
								}
								return;
							}
						});
					}
				} else {
					await fs.copy(src, dest);
				}
			}
			// $('#loadDialog0').text('');
			// $('#loadDialog1').text('');
			cf[emu].saves.date = date;

			dir = `${save.dir}/nostlan_saves/${emu}`;
			let backups = await klaw(dir, {
				depthLimit: 0
			});

			if (!save.backups || backups.length <= save.backups) {
				continue;
			}

			let oldest = 10000000000000;
			for (let backup of backups) {
				let backupDate = Number(path.parse(backup).base);
				if (oldest > backupDate) oldest = backupDate;
			}

			try {
				await fs.remove(dir + '/' + oldest);
			} catch (ror) {
				cui.error('Save Sync error: could not remove directory\n' + dir);
			}
		}
	}

	async _update(isForced) {
		let save = cf.saves[0];
		let dir = `${save.dir}/nostlan_saves/${emu}`;
		if (!(await fs.exists(dir))) return;
		let backups = await klaw(dir, {
			depthLimit: 0
		});

		if (!backups.length) return;

		let latest = 0;
		for (let backup of backups) {
			let date = Number(path.parse(backup).base);
			if (latest < date) latest = date;
		}

		log(`${cf[emu].saves.date} : ${emus[emu].name} last saved locally`);
		log(`${latest} : ${emus[emu].name} last saved in ${save.name}`);
		if (isForced) log('save sync update is forced!');
		if (!isForced && latest <= cf[emu].saves.date) return;

		let now = Date.now() / 1000;
		let diff = now - latest;
		// if the last save is more than 2 days old
		if (diff > 172800) {
			// tell the user how old their save data is
			let days = Math.trunc((now - latest) / 86400);
			let res = await cui.confirm(
				'Your last synced ' +
					emus[emu].name +
					' save with Nostlan was from ' +
					days +
					' days ago.\n\nAre you sure you want to overwrite your local save data?',
				'WARNING'
			);
			if (!res) return true;
		}

		dir += '/' + latest;

		for (let i in cf[emu].saves.dirs) {
			let src = dir + '/' + i;
			let dest = cf[emu].saves.dirs[i];
			if (!(await fs.exists(src))) continue;
			log(`Updating ${emus[emu].name} save files from ${save.name} to ${dest}`);
			$('#loadDialog0').text(`Updating ${emus[emu].name} save files from ${save.name} to`);
			$('#loadDialog1').text(dest);
			try {
				await fs.copy(src, dest);
			} catch (ror) {
				cui.error('Save sync error: Could not copy from\n' + src + 'to\n' + dest);
			}
		}
		$('#loadDialog0').text('');
		$('#loadDialog1').text('');
		cf[emu].saves.date = latest;
		return true;
	}

	async update(isForced) {
		if (!cf.saves) {
			log('update save sync failed, no saves folder');
			return;
		}
		let ogEmu = emu;
		for (emu of syst.emus) {
			if (!cf[emu].cmd && !emus[emu].jsEmu) continue;

			if (!cf[emu].saves || !cf[emu].saves.dirs || !cf[emu].saves.dirs.length) {
				if (!(await this.setup())) continue;
				if (!(await this._update(isForced))) {
					await this._backup();
				}
				continue;
			}

			log('update save sync starting...');
			if (await this._update(isForced)) {
				log('update save sync complete!');
			} else {
				log('local save data already the most current');
			}
		}
		emu = ogEmu;
	}

	async backup() {
		if (!cf[emu].saves || !cf[emu].saves.dirs || !cf[emu].saves.dirs.length) {
			if (!(await this.setup())) return;
		}
		// check if any require saving
		let saveOnQuit = false;
		for (let save of cf.saves) {
			if (!save.noSaveOnQuit) {
				saveOnQuit = true;
				break;
			}
		}
		if (!saveOnQuit) return;

		log('backup save sync starting...');
		await this._backup();
		log('backup save sync completed!');
	}
}

module.exports = new Saves();
