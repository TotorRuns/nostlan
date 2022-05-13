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
		if (nostlan.launcher.state == 'launching') {
			log('already launching!');
			return;
		}
		$('body > :not(#dialogs)').addClass('dim');
		await nostlan.launcher.launch(cui.libMain.getCurGame());
	}
}
module.exports = new CuiState();
