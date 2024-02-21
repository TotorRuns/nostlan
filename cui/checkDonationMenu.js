class CuiState extends cui.State {
	async onAction(act) {
		if (act == 'continue') {
			let pass = $('#donorPassword').val();
			if (nostlan.premium.verify(pass)) {
				await cui.libMain.load();
				if (nostlan.premium.verify() && !cf.saves) {
					cui.change('addSavesPathMenu');
				}
			} else {
				cui.change('donateMenu');
				// 'incorrect donor password'
				cui.err(lang.donateMenu.err0);
			}
		}
	}
}
module.exports = new CuiState();
