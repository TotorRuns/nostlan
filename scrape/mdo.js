const dl = require('./dl.js');

class MrDo {
	constructor() {
		this.name = "Mr. Do's Arcade";
	}

	async dlImg(game, dir, name) {
		if (name != 'cabinet' || sys != 'arcade') {
			return;
		}
		let url = `http://www.mameworld.info/mrdo/artwork/${game.id}.zip`;
		let file = dir + `/mdo.zip`;
		let res = await dl(url, file);
		res = await fs.extract(file, dir);
		return res;
	}
}

module.exports = new MrDo();
