class CuiState extends cui.State {
	async onAction(act) {
		act = act.split(' ');
		$('body').removeClass();
		cui.change('interfaceMenu', act[0]);
		$('body').addClass(act[1]);
		cf[sys].colorPalette = act[1];
	}
}
module.exports = new CuiState();
