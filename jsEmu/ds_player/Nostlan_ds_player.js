class Nostlan_ds_player {
	constructor() {}

	async launch(game, cfg) {
		console.log('launching DS Player');
		this.cfg = cfg;
		let file = await (await fetch(game.file)).blob();
		file.name = game.file;
		document.getElementById('vk-layer').style.display = 'none';
		tryLoadROM(file);
		tryInitSound();
	}

	controIn(contro) {
		let { btns } = contro;
		let tmp = btns.a;
		btns.a = btns.b;
		btns.b = tmp;
		tmp = btns.x;
		btns.x = btns.y;
		btns.y = tmp;
		for (let name in btns) {
			gamepadsSpoof.button(contro.port, name, btns[name]);
		}
	}

	close() {}

	pause(toggle) {
		toggle ??= true;
		emuIsRunning = !toggle;
		if (toggle) document.body.style.filter = 'blur(10px)';
		else document.body.style.filter = 'none';
	}

	unpause() {
		this.pause(false);
	}

	mute() {}

	unmute() {}

	loadState() {
		// uiSaveRestore;
	}

	saveState() {
		// uiSaveBackup;
	}
}

let jsEmu = new Nostlan_ds_player();
