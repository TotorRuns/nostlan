/*
 * launcher.js : Nostlan : quinton-ashley
 *
 * Launches emulator apps with the command line args specified
 * in the user's prefs.json file.
 */
let child = require('child_process');
let base64 = require('byte-base64');

let identify = false;

class Launcher {
	constructor() {
		this.child = {}; // child process running an emulator
		this.state = 'closed'; // status of the process
		this.cmdArgs = [];
		this.emuAppDir = '';
		this.game = {};
		this.stdout = '';
	}

	async getMacExec(file) {
		let macExec = file;

		file = path.parse(file);

		if (file.ext != '.app') return macExec;

		macExec += '/Contents/MacOS/';

		let name = emus[emu].name.replace(/ /g, '');
		let execNames = [file.name, name, name.toLowerCase(), name.toUpperCase()];

		for (let execName of execNames) {
			if (await fs.exists(macExec + execName)) {
				macExec += execName;
				return macExec;
			}
		}
		// not found
		return;
	}

	async getEmuApp() {
		let emuApp = util.absPath(prefs[emu].app);
		if (emuApp) {
			let isCmd = !/\//.test(emuApp);
			if ((linux && isCmd) || ((!linux || !isCmd) && (await fs.exists(emuApp)))) {
				return emuApp;
			}
		}
		let emuAppDirs = emus[emu].appDirs || [];
		if (!emuAppDirs.length) emuAppDirs.push(`${systemsDir}/${sys}/${emu}`);
		if (mac) emuAppDirs.push('/Applications');

		for (let dir of emuAppDirs) {
			dir = util.absPath(dir);
			if (!(await fs.exists(dir))) continue;
			let files;
			const filterFunc = (item) => {
				// ignore alias to folders on drives that are not connected
				return fs.existsSync(item);
			};
			try {
				files = await klaw(dir, {
					depthLimit: 2,
					filter: filterFunc
				});
			} catch (ror) {
				// 'Incorrect path to emulator app directory. Delete or edit your user preferences file.'
				await cui.err(lang.playing.err0 + ' ' + ror, '406');
				return;
			}
			if (!emus[emu].appRegex) return;
			let regex = new RegExp(emus[emu].appRegex, 'i');
			for (let file of files) {
				let f = path.parse(file);

				if (regex.test(f.base)) {
					emuApp = file;
					if (mac) emuApp = await this.getMacExec(emuApp);
					if (emuApp && (await fs.exists(emuApp))) {
						prefs[emu].app = emuApp;
						return emuApp;
					}
				}
			}
		}

		log(`couldn't find app at path: ` + emuApp);
		return '';
	}

	async launch(game, opt) {
		opt = opt || {};
		this.state = 'launching';
		$('#dialogs').show();
		// 'launching'
		$('#loadDialog0').text(lang.playing.msg4 + ' ' + emus[emu].name);
		if (game && game.id) {
			identify = false;
			log(game.id);
			if (!prefs.session[sys]) prefs.session[sys] = {};
			prefs.session[sys].gameID = game.id;
			game.file = util.absPath(game.file);
			this.game = game;
		}

		if (identify && sys == 'switch') {
			emu = 'yuzu';
		}

		let emuApp = await this.getEmuApp();
		if (!emuApp) {
			cui.change('emuAppMenu');
			this.state = 'closed';
			return;
		}

		if (emus[emu].jsEmu) {
			if (!game) {
				cui.alert('Not configurable yet.');
				this.state = 'closed';
				return;
			}
			let dir = `${systemsDir}/${sys}/${emu}`;
			let jsEmuDir = `${__root}/jsEmu/${sys}/${emu}`;

			if (
				!prefs[emu].dev &&
				(!(await fs.exists(dir + '/launch.js')) || prefs[emu].version != prefs[emu].latestVersion)
			) {
				await fs.copy(jsEmuDir, dir, {
					overwrite: true
				});
				prefs[emu].version = prefs[emu].latestVersion;
				log('updated ' + emus[emu].name + ' to ' + prefs[emu].version);
			}

			let cfg = {};
			Object.assign(cfg, prefs[emu]);

			if (cfg.bios) {
				cfg.bios = util.absPath(cfg.bios);
				if (!(await fs.exists(cfg.bios))) {
					// "This emulator requires system bios file(s)"
					cui.err(lang.playMenu.err + ': ' + cfg.bios);
					this.state = 'closed';
					return;
				}
			}

			if (await fs.exists(dir + '/states')) {
				let files = await klaw(dir + '/states');
				cfg.saveStates = {};
				let gameName = path.parse(game.file).name;
				for (let file of files) {
					if (path.parse(file).name == gameName) {
						// let data = await fs.readFile(file, 'utf8');
						// data = base64.base64ToBytes(data);
						// data = Array.from(data);
						let slot = file.slice(-1);
						cfg.saveStates[slot] = {
							file: file,
							// data: data,
							date: (await fs.stat(file)).mtime.toLocaleString('en-US', {
								timeZone: timeZone
							})
						};
					}
				}
				if (!Object.keys(cfg.saveStates).length) {
					delete cfg.saveStates;
				}
			}

			cui.setUISub('jsEmu', true);

			for (let port in prefs.jsEmu.keyboard) {
				let board = {};
				// default keyboard controls
				Object.assign(board, prefs.jsEmu.keyboard[port]);
				if (cfg.keyboard) {
					// overridden by keyboard control settings
					// in the preferences for the emu (stored in cfg)
					Object.assign(board, cfg.keyboard[port]);
				}
				for (let btn in board) {
					cui.keyPress(board[btn], {
						state: 'jsEmu',
						act: btn,
						port: port
					});
				}
			}

			let fileHtml = `${dir}/launch.html`;
			let preloadJS = __root + '/jsEmu/preload.js';
			$('body').prepend(
				`<webview id="jsEmu" enableremotemodule="false" src="${fileHtml}" preload="${preloadJS}"></webview>`
			);

			let jsEmu = $('#jsEmu').eq(0)[0];
			await new Promise((resolve) => {
				jsEmu.addEventListener('dom-ready', () => {
					resolve();
				});
			});
			if (cfg.dev) jsEmu.openDevTools();
			let _this = this;
			jsEmu.addEventListener('ipc-message', async (event) => {
				let ping = JSON.parse(event.channel);

				log(ping);

				if (ping.saveState) {
					let { slot, data, ext } = ping.saveState;
					data = base64.bytesToBase64(data);
					let g = path.parse(_this.game.file);
					let file = dir + '/states/' + g.name + ext;
					await fs.outputFile(file, data);
					if (!_this.cfg.saveStates) {
						_this.cfg.saveStates = {};
					}
					let date = (await fs.stat(file)).mtime;
					date = date.toLocaleString('en-US', {
						timeZone: timeZone
					});
					_this.cfg.saveStates[slot] = {
						file,
						data,
						date
					};
				}
			});
			await delay(1500);
			jsEmu.executeJavaScript(`jsEmu.launch(${JSON.stringify(game)}, ${JSON.stringify(cfg)})`);
			this.cfg = cfg;
			this.jsEmu = jsEmu;
			await cui.change('playing_4');
			$('nav').hide();
			cui.clearDialogs();
			$('#libMain').hide();
			$('#boxOpenMenu_2').hide();
			this.state = 'running';
			return;
		}

		if (identify && sys == 'switch') {
			let f = path.parse(emuApp);
			emuApp = f.dir + '/' + f.name + '-cmd' + f.ext;
			log(emuApp);
		}
		if (emu == 'mgba' && !game) {
			emuApp = emuApp.replace('-sdl', '');
		}
		this.cmdArgs = [];
		this.emuAppDir = path.join(emuApp, '..');
		if (this.emuAppDir == '.') {
			this.emuAppDir = `${systemsDir}/${sys}/${emu}`;
		}
		if (emu == 'mame' && !(await fs.exists(this.emuAppDir + '/mame.ini'))) {
			let defaultIni = '~/Library/Application Support/mame/mame.ini';
			if (linux) defaultIni = '~/.mame/mame.ini';
			let ini;
			if (await fs.exists(defaultIni)) {
				ini = await fs.readFile(defaultIni, 'utf8');
			} else {
				try {
					await spawn('./mame', ['-cc'], {
						cwd: this.emuAppDir
					});
					ini = await fs.readFile(this.emuAppDir + '/mame.ini', 'utf8');
				} catch (ror) {
					cui.err(ror);
					return;
				}
			}
			// Nostlan's MAME defaults:
			// bitmap prescale to 3x native resolution
			// wait for vertical sync to avoid screen tearing
			// window mode for a better casual user experience
			ini = ini.replace(/prescale\s*\d/, 'prescale 3');
			ini = ini.replace(/waitvsync\s*\d/, 'waitvsync 1');
			ini = ini.replace(/window\s*\d/, 'window 1');
			await fs.outputFile(this.emuAppDir + '/mame.ini', ini);
			await fs.writeFile(this.emuAppDir + '/mame.ini', ini);
		}
		if (!identify) log(emu);
		let cmdArray = prefs[emu].cmd || [];

		let gameFile;
		if (game) {
			gameFile = game.file;
			if (emu == 'rpcs3') {
				gameFile += '/USRDIR/EBOOT.BIN';
			} else if (emu == 'xenia' && path.parse(gameFile).ext != '.iso') {
				let files = await klaw(game.file, {
					depthLimit: 1
				});
				log(files);
				for (let file of files) {
					if (path.parse(file).ext == '.xex') {
						gameFile = file;
						break;
					}
				}
			} else if (emu == 'cemu') {
				let files = await klaw(game.file + '/code');
				log(files);
				for (let file of files) {
					if (path.parse(file).ext == '.rpx') {
						gameFile = file;
						break;
					}
				}
			}
		}
		if (!game && opt.update) {
			cmdArray = [];
			for (let cmdArg of emus[emu].update) {
				cmdArray.push(util.absPath(cmdArg));
			}
		}

		for (let cmdArg of cmdArray) {
			if (cmdArg == '${app}') {
				this.cmdArgs.push(emuApp);
				if (!game && emu != 'mame') break;
			} else if (cmdArg == '${game}' || cmdArg == '${game.file}') {
				this.cmdArgs.push(gameFile);
			} else if (cmdArg == '${game.id}') {
				this.cmdArgs.push(game.id);
			} else if (cmdArg == '${game.title}') {
				this.cmdArgs.push(game.title);
			} else if (cmdArg == '${cwd}') {
				this.cmdArgs.push(this.emuAppDir);
				if (!game) break;
			} else {
				this.cmdArgs.push(cmdArg);
			}
		}

		if ((game && game.id) || emu == 'mame') {
			await cui.change('playing_4');
			$('#libMain').hide();
			$('#boxOpenMenu_2').hide();
			// 'Starting'
			$('#loadDialog0').text(`${lang.playing.msg1} ${emus[emu].name}`);
			// `To close the emulator, press and hold the
			// ${btn} button for ${time} seconds`
			$('#loadDialog1').text(
				lang.playing.msg2_0 +
					` "${prefs.inGame.quit.hold}" ` +
					lang.playing.msg2_1 +
					' ' +
					(prefs.inGame.quit.time / 1000).toFixed(0) +
					' ' +
					lang.playing.msg2_2
			);
			if (game) $('#loadDialog2').text(game.title);
		}
		if (!identify) log(this.cmdArgs);
		if (!identify) log('cwd: ' + this.emuAppDir);

		this._launch();

		if (sys == 'wii' && game && game.id && cui.gca.connected && !cui.gamepadConnected) {
			// 'Unfortunately only one app at a time can be
			// connected to your Gamecube Controller
			// Adapter.  Nostlan will quit.'
			$('#loadDialog1').text(lang.playing.msg3);
			await delay(2000);
			await cui.doAction('quit');
			return;
		}
	}

	_launch() {
		let spawnOpt = {
			cwd: this.emuAppDir,
			stdio: 'pipe',
			detached: true
		};
		if (identify) delete spawnOpt.stdio;

		if (emu == 'ryujinx' || emu == 'ryujinx-ldn') {
			delete spawnOpt.detached;
		}
		this.child = child.spawn(this.cmdArgs[0], this.cmdArgs.slice(1) || [], spawnOpt);

		this.state = 'running';
		cui.disableSticks = true;

		let _this = this;

		function parseData(data) {
			_this.stdout += data;
		}

		this.child.stdout.on('data', parseData);
		this.child.stderr.on('data', parseData);

		this.child.on('close', (code) => {
			this._close(code);
		});
	}

	async configEmu() {
		await this.launch();
	}

	async updateEmu() {
		await this.launch(null, {
			update: true
		});
	}

	async identifyGame(game, attempt) {
		if (typeof attempt == 'number') {
			identify = attempt;
		} else {
			identify = 1;
		}
		let finished = false;
		await this.launch(game);

		return await Promise.race([
			new Promise((resolve, reject) => {
				let out = '';

				let idGame = () => {
					if (finished) return;
					let m;
					if (emu == 'yuzu' && (m = /title_id=(\w{16})/.exec(out))) {
						game.tid = m[1];
					} else {
						return;
					}
					finished = true;
					this.close();
					resolve(game);
				};

				let parseData = (data) => {
					if (this.state == 'closing' || finished) return;
					out += data.toString();
					idGame();
				};

				this.child.stdout.on('data', parseData);
				this.child.stderr.on('data', parseData);

				this.child.on('close', (code) => {
					this._close(code);
					if (!finished) idGame();
					if (!finished) reject();
				});
			}),
			delay.reject(3000)
		]);
	}

	reset() {
		this.state = 'resetting';
		if (!emus[emu].jsEmu) {
			this.child.kill('SIGINT');
		} else {
			this.jsEmu.executeJavaScript('jsEmu.close();');
			this.jsEmu.remove();
			this.jsEmu = null;
			this.launch(this.game);
		}
	}

	close() {
		this.state = 'closing';
		if (!emus[emu].jsEmu) {
			this.child.kill('SIGINT');
		} else {
			this._close();
			this.jsEmu.executeJavaScript('jsEmu.close();');
			this.jsEmu.remove();
			$('body').removeClass('jsEmu');
			cui.setUISub(sys);
			this.jsEmu = null;
			this.cfg = null;
		}
	}

	pause() {
		this.state = 'paused';
		this.jsEmu.executeJavaScript('jsEmu.pause();');
		cui.change('pauseMenu');
		$('nav').show();
		$('body > :not(#dialogs)').removeClass('dim');
	}

	unpause() {
		this.state = 'running';
		this.jsEmu.executeJavaScript('jsEmu.unpause();');
		cui.change('playing_4');
		$('nav').hide();
		$('body > :not(#dialogs)').removeClass('dim');
	}

	saveState(slot) {
		this.jsEmu.executeJavaScript(`jsEmu.saveState(${slot || ''});`);
	}

	loadState(slot) {
		this.jsEmu.executeJavaScript(`jsEmu.loadState(${slot || ''});`);
	}

	mute() {
		this.jsEmu.executeJavaScript(`jsEmu.mute();`);
	}

	unmute() {
		this.jsEmu.executeJavaScript(`jsEmu.unmute();`);
	}

	openDevTools() {
		this.jsEmu.openDevTools();
	}

	async _close(code) {
		if (this.state == 'closed') return;
		cui.disableSticks = false;
		$('nav').show();
		if (!identify) {
			log(`emulator closed`);
			if (!this.jsEmu && this.state == 'resetting') {
				this._launch();
				return;
			}
			cui.hideDialogs();
			log('exited with code ' + code);
			if (cui.ui == 'playing') {
				// only one app at a time can be connected to the gca
				if (cui.gca.connected) cui.gca.start();
				await cui.doAction('back');
			}
			$('body > :not(#dialogs)').removeClass('dim');
		}
		if (!identify && code) {
			// ``${app} crashed! If the game didn't start it
			// might be because some emulators require
			// system firmware, BIOS, decryption keys, and
			// other files not included with the emulator.
			// Search the internet for instructions on how to
			// fully setup ${app}`
			let erMsg = '<p>' + emus[emu].name + ' ' + lang.playing.err2 + ' ' + `${emus[emu].name}.</p>\n`;
			erMsg += '<textarea rows=8>';
			for (let i in this.cmdArgs) {
				if (i == 0) erMsg += '$ ';
				erMsg += `${this.cmdArgs[i]} `;
			}
			erMsg += '\n' + this.stdout + '</textarea>';

			this.stdout = ''; // clear stdout
			cui.err(erMsg, code);
		}
		if (!identify) {
			electron.getCurrentWindow().focus();
			electron.getCurrentWindow().setFullScreen(prefs.ui.launchFullScreen);
		}
		this.state = 'closed';
		identify = false;
	}
}

module.exports = new Launcher();
