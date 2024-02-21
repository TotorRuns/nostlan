class GithubQuintonAshley {
	constructor() {
		this.name = 'quinton-ashley on Github';
	}

	wrapUrl(url) {
		return 'q';
	}

	unwrapUrl(game, name) {
		let url = 'https://raw.githubusercontent.com/quinton-ashley';
		if (!game.id.includes('_TEMPLATE')) {
			url += `/nostlan-${sys}/main/${sys}/${game.id}`;
		} else {
			url += `/nostlan-img/main/${sys}/${game.id}`;
		}
		return url + `/${name}`;
	}
}

module.exports = new GithubQuintonAshley();
