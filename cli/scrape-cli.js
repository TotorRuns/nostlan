// DEVELOPMENT USE ONLY!
//
// This code is not for end users, it's for creating the
// game art database files.
//
// Finds direct download links to images so that end users will not have to
// individually scrape for images.
//
// Even though I have decided to open source these files please do not run them
// yourself. If you think I should update Nostlan's databases or if you have
// any questions email me: qashto@gmail.com
//
module.exports = async function (arg) {
	global.path = require('path');
	arg.__root = path.join(__dirname, '/..').replace(/\\/g, '/');
	await require(arg.__root + '/core/setup.js')(arg);

	let scrapers = ['gfs', 'fly', 'tcp', 'dec'];
	let scrape = arg.scrape;
	if (!scrapers.includes(scrape)) {
		er('use --scrape and specify the scraper you want to use' + scrapers.toString());
		return;
	}

	global.ConfigEditor = require(__root + '/core/ConfigEditor.js');
	global.prefsMng = new ConfigEditor();
	prefsMng.configPath = __root + '/scrape/cli/prefs_' + osType + '.json';
	global.prefs = {};
	prefs = await prefsMng.load();

	global.browser = require('./browser.js');
	await browser.load({
		user: 'qashto@gmail.com'
	});
	await prefsMng.save(prefs);

	let scraper = require(`../${scrape}.js`);
	global.sys = arg.sys || 'snes'; // sys default
	if (scrape == 'fly') sys = 'arcade';

	log('scraping ' + sys + ' art from ' + scraper.name);

	if (scraper.load) {
		await scraper.load(sys);
	}
	let name = 'cover';
	if (/(arcade|gba)/.test(sys) || scrape == 'dec') name = 'box';
	if (scrape == 'tcp') name = 'coverFull';

	let games = [];
	let dbPath = `${__root}/sys/${sys}/${sys}DB.json`;
	games = JSON.parse(await fs.readFile(dbPath)).games;

	let found = 0;
	let saved = 0;
	for (let i = arg.skip || 0; i < games.length; i++) {
		if (arg.test && found >= arg.test) {
			log('test done!');
			break;
		}
		let game = games[i];
		log(game.title);
		if (arg.override || !game.img || !game.img[name]) {
			let img = await scraper.getImgUrls(game, name);
			if (img && Object.keys(img).length) {
				if (!game.img) {
					game.img = img;
				} else if (!arg.override) {
					for (let key of Object.keys(img)) {
						game.img[key] = img[key];
					}
				} else {
					for (let key of Object.keys(img)) {
						if (!game.img[key]) {
							game.img[key] = img[key];
						}
					}
					game.img = img;
				}
				log('image found!');
				found++;
			} else {
				log('image not found');
			}
		} else {
			log('game already has an image');
			found++;
		}
		log(`found: ${found}/${i + 1 - (arg.skip || 0)} ${Number((found / (i + 1 - (arg.skip || 0))) * 100).toFixed(2)}%`);
		log(`completed: ${i + 1}/${games.length} ${Number(((i + 1) / games.length) * 100).toFixed(2)}%`);
		if (found && found % 10 == 0 && found != saved) {
			await save();
			saved = found;
		}
	}

	await save();

	async function save() {
		log('saving to file... DO NOT QUIT');
		await fs.outputFile(
			dbPath,
			JSON.stringify(
				{
					games: games
				},
				null,
				'\t'
			)
		);
		log('file saved: ' + dbPath);
	}

	async function quit() {
		log('scrape completed!');
	}
	await quit();
};
