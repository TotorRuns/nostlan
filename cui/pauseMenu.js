class CuiState extends cui.State {
	async onAction(act) {
		if (act == 'start') {
			// nostlan main menu is not available
			// when running emulators
			cui.err(lang.pauseMenu.err0);
		} else if (act == 'unpause' || act == 'b' || act == 'pause') {
			nostlan.launcher.unpause();
		} else if (act == 'saveState') {
			if (emus[emu].saveStateSlots > 1) {
				cui.change('saveStateMenu');
			} else {
				nostlan.launcher.saveState();
				nostlan.launcher.unpause();
			}
		} else if (act == 'loadState') {
			if (emus[emu].loadStateSlots > 1) {
				cui.change('loadStateMenu');
			} else {
				nostlan.launcher.loadState();
				nostlan.launcher.unpause();
			}
		} else if (act == 'fullscreen') {
			cf.ui.launchFullScreen = !cf.ui.launchFullScreen;
			electron.getCurrentWindow().focus();
			electron.getCurrentWindow().setFullScreen(cf.ui.launchFullScreen);
		} else if (act == 'mute' || act == 'unmute') {
			let $elem = $(`#pauseMenu_10 .cui[name="${act}"]`);
			if ($elem.attr('name') == 'mute') {
				nostlan.launcher.mute();
				// 'unmute'
				$elem.find('.text').text(lang.pauseMenu.opt4[1]);
				$elem.attr('name', 'unmute');
			} else {
				nostlan.launcher.unmute();
				// 'mute'
				$elem.find('.text').text(lang.pauseMenu.opt4[0]);
				$elem.attr('name', 'mute');
			}
			nostlan.launcher.unpause();
		} else if (act == 'openDevTools') {
			nostlan.launcher.openDevTools();
		} else if (act == 'stop') {
			await cui.change('playing_4');
			nostlan.launcher.close();
		}
	}
}
module.exports = new CuiState();
