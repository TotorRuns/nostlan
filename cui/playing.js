class CuiState extends cui.State {
	async onAction(act) {
		if (act == 'pause') {
			log('pausing emulation');
			nostlan.launcher.pause();
		} else if (act.length == 5) {
			if (act.slice(0, 4) == 'load') {
				let slot = act[4];
				nostlan.launcher.loadState(slot);
			} else if (act.slice(0, 4) == 'save') {
				let slot = act[4];
				nostlan.launcher.saveState(slot);
			}
		}
	}
}
module.exports = new CuiState();
