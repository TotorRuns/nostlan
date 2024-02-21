class CuiState extends cui.State {
	async onAction(act) {
		// change emu to the selected emu
		// or run with the previously selected emu
		// by double clicking/pressing x or y
		let acts = act.split(' ');
		if (syst.emus.includes(acts[0])) {
			emu = acts[0];
		} else if (act != 'x' && act != 'y') {
			return;
		}
		act = acts[1];
		if (act == 'launch') {
			await nostlan.launcher.configEmu();
		} else if (act == 'update') {
			await nostlan.launcher.updateEmu();
		} else {
			opn(emus[emu][act]);
			return;
		}
		$('body > :not(#dialogs)').addClass('dim');
	}
}
module.exports = new CuiState();
