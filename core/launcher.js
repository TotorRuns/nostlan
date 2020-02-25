let child = require('child_process');

class Launcher {
	constructor() {
		this.child = {}; // child process running an emulator
		this.state = 'closed'; // status of the process
		this.cmdArgs = [];
		this.emuDirPath = '';
	}

	async getEmuAppPath(attempt) {
		if (!attempt) attempt = 0;
		let emuAppPath = util.absPath(prefs[emu].app[osType]);
		if (emuAppPath && await fs.exists(emuAppPath)) {
			return emuAppPath;
		}
		emuAppPath = '';
		let emuDirPath = '';
		if (win || (linux && (/(cemu|rpcs3)/).test(emu)) ||
			(mac && emu == 'mame')) {
			emuDirPath = `${emuDir}/${prefs[emu].name}/BIN`;
			if (emu == 'citra') {
				if (await fs.exists(emuDirPath + '/nightly-mingw')) {
					emuDirPath += '/nightly-mingw';
				} else {
					emuDirPath += '/canary-mingw';
				}
			}
			if (emu == 'yuzu') {
				emuDirPath = '$home/AppData/Local/yuzu/yuzu-windows-msvc';
				if (attempt == 1) emuDirPath += '-early-access';
				emuDirPath = util.absPath(emuDirPath);
			}
		} else if (mac) {
			emuDirPath = '/Applications';
		}
		let emuNameCases = [
			prefs[emu].name,
			prefs[emu].name.toLowerCase(),
			prefs[emu].name.toUpperCase()
		];
		for (let i = 0; i < emuNameCases.length; i++) {
			if (emuDirPath) {
				emuAppPath = emuDirPath + '/';
			}
			emuAppPath += emuNameCases[i];
			if (win) {
				if (emu == 'citra') emuAppPath += '-qt';
				if (emu == 'mgba') emuAppPath += '-sdl';
				if (emu == 'mame') emuAppPath += '64';
				emuAppPath += '.exe';
			} else if (mac) {
				if (emu == 'citra') {
					emuAppPath += `/nightly/${emuNameCases[1]}-qt`;
				} else if (emu == 'yuzu') {
					emuAppPath += '/' + emuNameCases[1];
				}
				if (emu != 'mame') {
					emuAppPath += '.app/Contents/MacOS';
				}
				if (emu == 'desmume') {
					emuAppPath += '/' + emuNameCases[0];
				} else if (emu != 'mame') {
					emuAppPath += '/' + emuNameCases[1];
				}
				if (emu == 'citra') {
					emuAppPath += '-qt-bin';
				} else if (emu == 'yuzu') {
					emuAppPath += '-bin';
				}
				if (emu == 'mame') emuAppPath += '64';
			} else if (linux) {
				if (emu == 'dolphin') {
					emuAppPath = 'dolphin-emu';
				} else if (emu == 'cemu') {
					emuAppPath += '.exe';
				} else if (emu == 'rpcs3') {
					emuAppPath += '.AppImage';
				}
			}
			if (
				(linux && !(/(cemu|yuzu|rpcs3)/).test(emu)) ||
				await fs.exists(emuAppPath)
			) {
				prefs[emu].app[osType] = emuAppPath;
				return emuAppPath;
			}
		}
		// attempt to auto-find the app in a different place
		if (win && emu == 'yuzu' && attempt == 0) {
			return this.getEmuAppPath(1);
		}
		log(`couldn't find app at path:\n` + emuAppPath);
		emuAppPath = await dialog.selectFile('select emulator app');
		if (mac) {
			emuAppPath += '/Contents/MacOS/' + emuNameCases[1];
			if (emu == 'citra') {
				emuAppPath += '-qt-bin';
			} else if (emu == 'yuzu') {
				emuAppPath += '-bin';
			}
		}
		if (!(await fs.exists(emuAppPath))) {
			cui.err('app path not valid: ' + emuAppPath);
			return '';
		}
		prefs[emu].app[osType] = emuAppPath;
		return emuAppPath;
	}

	async launch(game) {
		if (game && game.id) {
			log(game.id);
			if (!prefs.session[sys]) prefs.session[sys] = {};
			prefs.session[sys].gameID = game.id;
		}
		let emuAppPath = await this.getEmuAppPath();
		if (!emuAppPath) return;
		if (emu == 'mgba' && !game) {
			emuAppPath = emuAppPath.replace('-sdl', '');
		}
		this.cmdArgs = [];
		this.emuDirPath = path.join(emuAppPath, '..');
		if (linux) {
			if (emu == 'citra') {
				emuAppPath = 'org.citra.citra-canary'
			}
		}
		let gameFile;
		if (game) {
			gameFile = game.file;
			if (emu == 'rpcs3') {
				gameFile += '/USRDIR/EBOOT.BIN';
			}
			if (emu == 'cemu') {
				let files = await klaw(game.file + '/code');
				log(files);
				let ext, file;
				for (let i = 0; i < files.length; i++) {
					file = files[i];
					ext = path.parse(file).ext;
					if (ext == '.rpx') {
						gameFile = file;
						break;
					}
				}
			}
		}
		log(emu);
		let cmdArray = prefs[emu].cmd[osType];
		for (let cmdArg of cmdArray) {
			if (cmdArg == '${app}') {
				this.cmdArgs.push(emuAppPath);
				if (!game) {
					break;
				}
			} else if (cmdArg == '${game}' || cmdArg == '${game.file}') {
				this.cmdArgs.push(gameFile);
			} else if (cmdArg == '${game.id}') {
				this.cmdArgs.push(game.id);
			} else if (cmdArg == '${game.title}') {
				this.cmdArgs.push(game.title);
			} else if (cmdArg == '${cwd}') {
				this.cmdArgs.push(this.emuDirPath);
			} else {
				this.cmdArgs.push(cmdArg);
			}
		}

		if (game && game.id || emu == 'mame') {
			// cui.removeView('libMain');
			cui.change('playingBack');
			$('#libMain').hide();
			$('#dialogs').show();
			$('#loadDialog0').text(`Starting ${prefs[emu].name}`);
			if (game) $('#loadDialog1').text(game.title);
		}
		log(this.cmdArgs);
		log(this.emuDirPath);
		this._launch();
		await delay(1500);
		if ((win || linux) && emu == 'yuzu') {
			if (kb) kb.keyTap('f11');
		}
	}

	_launch() {
		let spawnOpt = {
			cwd: this.emuDirPath,
			stdio: 'inherit',
			detached: true
		};

		this.child = child.spawn(
			this.cmdArgs[0],
			this.cmdArgs.slice(1) || [],
			spawnOpt
		);

		this.state = 'running';
		cui.disableSticks = true;

		this.child.on('close', (code) => {
			this._close(code);
		});
	}

	async identifyGame(game) {
		return new Promise(async (resolve, reject) => {
			await this.launch(game);
			let out = '';
			this.child.stdout.on('data', (data) => {
				if (this.state == 'closing') return;
				out += data.toString();
				log(out);
				if (sys == 'snes' && out.match(/InlineBinary/)) {
					this.close();
					resolve(id);
				}
			});
		});
	}

	reset() {
		this.state = 'resetting';
		this.child.kill('SIGINT');
	}

	close() {
		this.state = 'closing';
		this.child.kill('SIGINT');
	}

	_close(code) {
		log(`emulator closed`);
		cui.disableSticks = false;
		if (this.state == 'resetting') {
			this._launch();
			return;
		}
		$('#libMain').show();
		cui.hideDialogs();
		let $cur = cui.getCur('libMain');
		if ($cur.hasClass('selected')) {
			cui.change('coverSelect');
			let $reel = $cur.parent();
			$reel.css('left', `${$(window).width()*.5-$cur.width()*.5}px`);
		} else if (cui.ui != 'libMain') {
			cui.change('libMain');
		}
		if (code) {
			let erMsg = `${prefs[emu].name} was unable to start the game or crashed.  This is probably not an issue with Nostlan.  Check online to make sure ${prefs[emu].name} can boot the game.\n<code>`;
			for (let i in this.cmdArgs) {
				if (i == 0) erMsg += '$ ';
				erMsg += `${this.cmdArgs[i]} `;
			}
			erMsg += '</code>';
			cui.err(erMsg, code);
		}
		log('exited with code ' + code);
		electron.getCurrentWindow().focus();
		electron.getCurrentWindow().setFullScreen(true);
		this.state = 'closed';
	}
}

module.exports = new Launcher();
