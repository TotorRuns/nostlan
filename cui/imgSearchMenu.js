class CuiState extends cui.State {

	async onAction(act) {
		log(act);
		if (act == 'selectImg') {
			if (!cui.imgSearchMenu.imgUrl) return;
			let imgType = cui.imgSelectMenu.imgType;
			let game = cui.editSelect.game;
			if (!game.img) game.img = {};
			let url = cui.imgSearchMenu.imgUrl.split('?')[0];
			game.img[imgType] = url;
			$('#dialogs').show();
			$('body').addClass('waiting');
			let img = await nostlan.scraper.imgExists(game, imgType);
			if (img) await fs.remove(img);
			await fs.ensureDir(nostlan.scraper.getImgDir(game));
			img = await nostlan.scraper.getImg(game, imgType);
			await cui.libMain.addGameBox(game);
			cui.editSelect.game.hasNoImages = false;
			nostlan.browser.close();
			let $game = $('#' + game.id);
			cui.boxSelect.flipGameBox($game, true);
			cui.hideDialogs();
			$('body').removeClass('waiting');
			cui.change('boxSelect');
		} else if (act == 'b') {
			nostlan.browser.close();
			cui.change('imgSelectMenu');
		}
	}

	async onChange() {
		let game = cui.editSelect.game;
		let imgType = cui.imgSelectMenu.imgType;
		let searchTerm = game.title + ' ' + imgType;

		let query = searchTerm.replace(/[^0-9a-zA-Z ]+/g, '').replace(' ', '+');

		let url = 'https://duckduckgo.com/?t=ffab&q=' + query +
			'&iax=images&ia=images&iaf=size%3AWallpaper';

		try {
			await nostlan.browser.init('#' + this.id, url);
		} catch (ror) {
			er(ror);
		}
	}
}
module.exports = new CuiState();
