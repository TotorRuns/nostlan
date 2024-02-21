class CuiState extends cui.State {
	async onAction(act) {
		if (act == 'info') {
			cui.change('controInfoMenu');
		} else if (act == 'rumble') {
			cf.ui.gamepad.haptic = !cf.ui.gamepad.haptic;
			cui.opt.haptic = cf.ui.gamepad.haptic;
			let $rumble = this.$elem.find('.cui[name="rumble"] .text');
			if (cf.ui.gamepad.haptic) {
				log('rumble enabled');
				$rumble.text(lang.controllerMenu.opt1[0]);
			} else {
				log('rumble disabled');
				$rumble.text(lang.controllerMenu.opt1[1]);
			}
		} else if (/prof/.test(act)) {
			let type = 'xbox_ps';
			if (act == 'prof1') type = 'nintendo';
			if (act == 'prof2') type = 'other';
			let prof = cf.ui.gamepad[type].profile;
			if (prof == 'adaptive') {
				prof = 'constant';
			} else if (prof == 'constant') {
				prof = 'none';
			} else if (prof == 'none') {
				prof = 'adaptive';
			}
			cf.ui.gamepad[type].profile = prof;
			this.$elem.find(`.cui[name="${act}"]`).text(prof);
		}
	}
}
module.exports = new CuiState();
