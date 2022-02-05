/*
 * installer.js : Nostlan : quinton-ashley
 *
 * Installs emulator applications. Can be of type:
 * installer
 * pkgManager_flatpak
 * pkgManager_arch
 * portable
 * standalone
 */

const dl = require(__root + '/scrape/dl.js');
const getDistro = require('linux-distro');

class Installer {
	constructor() {}

	loadLog(msg) {
		log(msg);
		$('#loadDialog2').text(msg);
	}

	async install() {
		log('installing ' + emus[emu].name);
		$('#loadDialog0').text(lang.emuAppMenu.msg0 +
			' ' + emus[emu].name);
		// 'preparing to install'
		this.loadLog(lang.emuAppMenu.msg1);
		let ins = emus[emu].install;
		if (!ins && !emus[emu].jsEmu) {
			// This emulator is not available for your
			// computer's operating system
			cui.err(lang.emuAppMenu.err0 + ": " + osType);
			return;
		}
		if (emus[emu].jsEmu) {
			let dir = `${systemsDir}/${sys}/${emu}`;
			let jsEmuDir = `${__root}/jsEmu/${sys}/${emu}`;
			await fs.copy(jsEmuDir, dir, {
				overwrite: true
			});
			if (!ins) return true;
		}

		if (!ins.jsEmu && linux) {
			let distro = (await getDistro()).os;
			if (ins.pkgManager_flatpak ||
				(/Arch/i.test(distro) && ins.pkgManager_arch)) {
				let cmds = ins.pkgManager_flatpak ||
					ins.pkgManager_arch;
				// 'running install script, please wait...'
				this.loadLog(lang.emuAppMenu.msg2);
				return await this.runInstallCmds(cmds);
			}
		}

		let dir = `${systemsDir}/${sys}/${emu}`;
		await opn(dir);

		let urls = ins.jsEmu || ins.installer ||
			ins.portable || ins.standalone;
		if (!urls) {
			// Automated install of this emulator with Nostlan
			// is not possible. You must install manually.
			cui.err(lang.emuAppMenu.err1);
			return;
		}
		// urls just contains one url
		// put it in array
		if (typeof urls == 'string') urls = [urls];

		let res;
		for (let url of urls) {
			res = await this._install(ins, url);
			if (!res) return;
		}
		res = false;
		// 'verifying installation'
		this.loadLog(lang.emuAppMenu.msg5);
		res = await nostlan.launcher.getEmuApp();
		if (!res && ins.installer && win) {
			// 'Almost done, please finish install manually'
			cui.alert(lang.emuAppMenu.msg15 + ': ' + emus[emu].name,
				lang.alertMenu.title5);
		} else if (!res) {
			// 'Install failed, you must manually install'
			cui.err(lang.emuAppMenu.err5 + ': ' + emus[emu].name);
		}
		if (mac && res) {
			// fixes non-executable apps on macOS 10.15+
			await spawn('chmod', ['755', res]);
		}
		return res;
	}

	async _install(ins, url) {
		let dir = `${systemsDir}/${sys}/${emu}`;
		let ext, file;
		url = url.split(' ');
		if (url.length == 2) ext = url[1];
		url = url[0];
		let prmIdx = url.indexOf('?');
		let _url;
		if (!ext) {
			_url = (prmIdx != -1) ? url.slice(prmIdx)[0] : url;
			ext = path.parse(_url).ext.toLowerCase();
		}
		if (/.(bz2|gz|xz)/.test(ext)) ext = '.tar' + ext;
		if (!ins.jsEmu && !(linux && ins.standalone)) {
			file = dir + '/pkg' + ext;
		} else {
			file = dir + '/' + path.parse(_url).name + ext;
		}
		// 'downloading, please wait...'
		this.loadLog(lang.emuAppMenu.msg3);
		let res = await dl(url, file);
		await delay(100);
		if (!res) {
			// 'Could not download app from'
			cui.err(lang.emuAppMenu.err2 + ': ' + url);
			return;
		}
		if (/(zip|7z|rar|tar)/i.test(ext)) {
			// 'download complete, extracting files...'
			this.loadLog(lang.emuAppMenu.msg4);
			await fs.extract(file, dir);
			await fs.remove(file);
		} else {
			// "download complete"
			this.loadLog(lang.emuAppMenu.msg12);
		}
		if (ins.jsEmu) return true;
		let files = await klaw(dir, {
			depthLimit: 0
		});
		// check if there's a top level folder
		// put contents in dir
		if (files.length == 1 &&
			(await fs.stat(files[0])).isDirectory() &&
			(!mac || path.parse(files[0]).ext != '.app')) {
			await fs.copy(files[0], dir, {
				overwrite: true
			});
			await fs.remove(files[0]);
		}
		let macDMG = false;
		if (ins.installer) {
			files = await klaw(dir);
			res = false;
			for (let file of files) {
				ext = path.parse(file).ext;
				if (ext == '.dmg') {
					// "opening macOS .dmg file"
					this.loadLog(lang.emuAppMenu.msg13);
					macDMG = file;
					await opn(file);
					res = file;
				} else if (ext == '.exe') {
					// "opening installer executable"
					this.loadLog(lang.emuAppMenu.msg14);
					try {
						await spawn(file);
					} catch (ror) {
						return;
					}
					await delay(2000);
					res = file;
				}
			}
			if (!res) {
				// 'Installer not found in package'
				cui.err(lang.emuAppMenu.err3 + ': ' + url);
				return;
			}
			if (mac) {
				// find the ejectable install disk
				let disk;
				for (let i = 0; !disk && i < 20; i++) {
					await delay(500);
					files = await klaw('/Volumes', {
						depthLimit: 0
					});
					let regex = `(${emu}|${emus[emu].name}`;
					if (emu == 'citra') regex += '|dist';
					if (emu == 'mupen64plus') regex += '|dmg';
					regex += ')';
					regex = new RegExp(regex, 'i');
					for (let file of files) {
						if (regex.test(file)) disk = file;
					}
				}
				if (!disk) {
					// "couldn't find install disk,
					// finish install manually"
					this.loadLog(lang.emuAppMenu.err4);
					return true;
				}
				files = await klaw(disk, {
					depthLimit: 0
				});
				for (let i = 0; i < files.length; i++) {
					let file = files[i];
					if (file.includes('Applications')) continue;
					if (path.parse(file).ext == '.app') {
						if (/setup/i.test(file)) {
							file += '/Contents/MacOS/' +
								path.parse(file).name;
							// 'running setup app'
							this.loadLog(lang.emuAppMenu.msg7);
							try {
								await spawn(file);
							} catch (ror) {}
						} else {
							// move the app and any helper apps,
							// such as updaters, to Applications
							this.loadLog(lang.emuAppMenu.msg8 +
								' /Applications');
							let dest = '/Applications';
							dest += '/' + path.parse(file).base;
							log(file, dest);
							await fs.copy(file, dest, {
								overwrite: true
							});
						}
					} else if (!/Trashes|Trash/i.test(file) && (await fs.stat(file)).isDirectory()) {
						let moreFiles = await klaw(file, {
							depthLimit: 1
						});
						files.push(...moreFiles);
					}
				}
				// 'finishing, ejecting all install disks'
				this.loadLog(lang.emuAppMenu.msg9);
				await spawn('osascript', ['-e',
					'tell application "Finder" to eject (every disk whose ejectable is true)'
				]);
				// 'finishing, deleting package file'
				this.loadLog(lang.emuAppMenu.msg10);
				await fs.remove(res);
			}
		} else if (mac && ins.standalone) {
			files = await klaw(dir);
			for (let file of files) {
				if (path.parse(file).ext == '.app') {
					// 'moving stand alone app to /Applications'
					this.loadLog(lang.emuAppMenu.msg6 +
						' /Applications');
					let newLocation = '/Applications/' +
						path.parse(file).base;
					await fs.move(file, newLocation, {
						overwrite: true
					});
					break;
				}
			}
			// cleanup
			await fs.remove(dir);
			// ensure template dir
			await fs.ensureDir(dir);
		}
		return true;
	}

	async runInstallCmds(cmds) {
		try {
			for (let cmd of cmds) {
				await spawn(cmd[0], cmd.slice(1) || []);
			}
		} catch (ror) {
			er(ror);
			return;
		}
		return true;
	}
}

module.exports = new Installer();
