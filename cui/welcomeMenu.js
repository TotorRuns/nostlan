class CuiState extends cui.State {
	async onAction(act) {
		if (act == 'full') {
			cui.change('setupMenu');
		}
	}
}
module.exports = new CuiState();
