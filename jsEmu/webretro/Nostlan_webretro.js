ffd.style.display = 'none';
menuBar.style.display = 'none';

class Nostlan_webretro {
	constructor() {
		this.ready = false;
	}

	async launch(game, cfg) {
		console.log('launching webretro');

		this.isNintendoSystem = cfg.sys == 'gba' || cfg.sys == 'nes' || cfg.sys == 'n64' || cfg.sys == 'snes';

		let data = await (await fetch(game.file)).arrayBuffer();
		initFromFile([{ path: game.file, data: data }]);
		this.ready = true;

		actualMenuHeight = 0;
		adjustActualMenuHeight();
	}

	controIn(contro) {
		if (!this.ready) return;
		let { btns } = contro;
		if (this.isNintendoSystem) {
			let tmp = btns.a;
			btns.a = btns.b;
			btns.b = tmp;
			tmp = btns.x;
			btns.x = btns.y;
			btns.y = tmp;
		}
		for (let name in btns) {
			gamepadsSpoof.button(contro.port, name, btns[name]);
		}
	}

	close() {
		let rs = '/home/web_user/retroarch/userdata/states/rom.state';
		if (FS.analyzePath(rs).exists) {
			// export save state data
			let data = FS.readFile(rs);
			let ping = {
				saveState: {
					slot: 0,
					data: Array.from(data),
					ext: '.state'
				}
			};
			nostlan.send(JSON.stringify(ping));
		}
	}

	pause(toggle) {
		toggle ??= true;
		if (toggle) {
			Module.pauseMainLoop();
			isPaused = true;
			document.body.classList.add('paused');
		} else {
			Module.resumeMainLoop();
			isPaused = false;
			document.body.classList.remove('paused');
		}
	}

	unpause() {
		this.pause(false);
	}

	mute() {}

	unmute() {}

	loadState() {
		Module._cmd_load_state();
	}

	saveState() {
		Module._cmd_save_state();
	}
}

let jsEmu = new Nostlan_webretro();
