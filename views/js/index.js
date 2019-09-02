/*
 * index.js handles responses to user interactions with the menu and app UI
 * authors: quinton-ashley
 * copyright 2018
 */

module.exports = async function(arg) {
	// arg.v = false; // quieter log
	await require(arg.__rootDir + '/core/setup.js')(arg);
	log('version: ' + pkg.version);

	const Fuse = require('fuse.js');
	const rmDiacritics = require('diacritics').remove;
	global.fs.extract = (input, output, opt) => {
		opt = opt || {};
		return new Promise(async (resolve, reject) => {
			opt.$bin = require('7zip-bin').path7za;
			require('node-7z').extractFull(input, output, opt)
				.on('end', () => {
					fs.remove(input);
					resolve(output);
				})
				.on('error', (ror) => {
					// er(ror);
					resolve();
				});
		});
	};

	// Bottlenose dir location cannot be changed.
	// Only used to store small config files, no images,
	// so that it doesn't take much space on the user's
	// main hard drive.  I don't give users a choice
	// to move this folder elsewhere because it needs to be
	// in a set location.
	// The user's preferences and game libs json databases
	// are stored here.
	const usrDir = os.homedir() + '/Documents/emu/bottlenose';
	log(usrDir);

	// dl is a helper lib I made for downloading images
	const dl = require(__rootDir + '/scrape/dl.js');
	// scrapers that use dl
	let srp = {};
	let scrapers = {
		b: 'bmb',
		c: 'tcp',
		d: 'dec',
		f: 'fly',
		g: 'gfs',
		m: 'mdo',
		q: 'gqa',
		t: 'tdb'
	};
	for (let scraper in scrapers) {
		scraper = scrapers[scraper];
		srp[scraper] = require(__rootDir + '/scrape/' + scraper + '.js');
	}

	// get the default prefrences
	let prefsMan = require(__rootDir + '/prefs/prefsManager.js');
	prefsMan.prefsPath = usrDir + '/_usr/prefs.json';
	global.prefs = await prefsMan.loadDefaultPrefs();

	// I assume the user is using a smooth scroll trackpad
	// or apple mouse with their Mac.
	if (mac) {
		prefs.ui.mouse.wheel.multi = 0.5;
		prefs.ui.mouse.wheel.smooth = true;
	}

	let systems = {
		wii: 'Wii/Gamecube',
		ds: 'Nintendo DS',
		wiiu: 'Wii U',
		'3ds': 'Nintendo 3DS',
		switch: 'Nintendo Switch',
		ps3: 'PlayStation 3',
		ps2: 'PlayStation 2',
		mame: 'MAME',
		gba: 'Game Boy Advance'
	};
	if (win) {
		systems.xbox360 = 'Xbox 360';
	} else if (mac) {
		delete systems.wiiu;
		delete systems.ps3;
	}
	let sys; // current system
	let sysStyle = ''; // style of that system
	let emuDir = ''; // bottlenose dir is stored here
	let btlDir = ''; // stores game art images and other game media
	let outLog = ''; // path to the game search output log file
	let games = []; // array of current games from the systems' db
	let themes;
	let theme;
	let emu; // current emulator
	let defaultBox;
	let templateAmt = 4; // template boxes in each column of the lib viewer
	let child; // child process running an emulator
	let childState = 'closed'; // status of the process
	let cmdArgs = [];
	let recheckImgs = false;

	let normalizeButtonLayout = {
		map: {
			x: 'y',
			y: 'x'
		},
		disable: 'nintendo'
	};
	// physical layout always matches the on screen postion of x and y
	// in the cover menu

	const olog = (msg) => {
		log(msg.replace(/[\t\r\n]/gi, '').replace(':', ': '));
		outLog += '\r\n' + msg + '\r\n';
	};

	let introFiles = {
		css: {},
		html: {}
	};
	let introJS;
	let introUsesJS;

	// retrieves the loading sequence files, some are pug not plain html
	async function getIntroFile(type) {
		let fType = ((type == 'css') ? 'css' : 'html');
		if (!introFiles[fType][sysStyle]) {
			let introFile = `${__rootDir}/views/${type}/${sysStyle}Load.${type}`;
			if (await fs.exists(introFile)) {
				if (type == 'css') {
					introFiles[fType][sysStyle] =
						`<link class="introStyle" rel="stylesheet" type="text/css" ` +
						`href="${introFile}">`;
				} else {
					introFile = await fs.readFile(introFile, 'utf8');
					if (type == 'pug') {
						introFile = pug(introFile);
					}
					introFiles[fType][sysStyle] = introFile;
				}
			} else {
				if (type == 'pug') {
					getIntroFile('html');
				} else {
					introFiles[fType][sysStyle] = '';
				}
			}
		}
		$('body').prepend(introFiles[fType][sysStyle]);
	}

	async function intro() {
		$('#dialogs').show();
		await getIntroFile('pug');
		await getIntroFile('css');
		let file = `${__rootDir}/views/js/${sysStyle}Load.js`;
		introUsesJS = await fs.exists(file);
		if (introUsesJS) {
			introJS = require(file);
			introJS.start();
		}
	}

	async function addGame(searcher, searchTerm) {
		let results = await searcher(searchTerm.substr(0, 64));
		if (arg.v) log(results);
		let region = prefs.region;
		for (let i = 0; i < results.length; i++) {
			if (results[i].title.length > searchTerm.length + 6) {
				continue;
			}
			// if the search term doesn't contain demo or trial
			// skip the demo/trial version of the game
			let demoRegex = /(Demo|Preview|Review|Trial)/i;
			if (demoRegex.test(results[i].title) != demoRegex.test(searchTerm)) {
				continue;
			}
			if (sys == 'wii' || sys == 'ds' || sys == 'wiiu' || sys == '3ds') {
				let gRegion = results[i].id[3];
				// TODO: this is a temporary region filter
				if (/[KWXDZIFSHYVRAC]/.test(gRegion)) {
					continue;
				}
				if (gRegion == 'E' && (region == 'P' || region == 'J')) {
					continue;
				}
				if (gRegion == 'P' && (region == 'E' || region == 'J')) {
					continue;
				}
				if (gRegion == 'J' && (region == 'E' || region == 'P')) {
					continue;
				}
			} else if (sys == 'switch') {
				let gRegion = results[i].id[4];
				if (gRegion == 'A' && (region == 'P' || region == 'J')) {
					continue;
				}
				if (gRegion == 'B' && (region == 'E' || region == 'J')) {
					continue;
				}
				if (gRegion == 'C' && (region == 'E' || region == 'P')) {
					continue;
				}
			}
			return results[i];
		}
		return;
	}

	async function rescan() {
		$('#loadDialog0').text('Indexing your game library');
		let _games = games;
		games = [];
		let gameDB = [];
		let DBPath = `${__rootDir}/db/${sys}DB.json`;
		gameDB = JSON.parse(await fs.readFile(DBPath)).games;

		let idRegex;
		if (sys == 'switch') {
			idRegex = /(?:^|[\[\(])([A-Z0-9]{3}[A-Z](?:|[A-Z0-9]))(?:[\]\)]|$)/;
		} else if (sys == 'ps3') {
			idRegex = /(?:^|[\[\(])(\w{9})(?:[\]\)]|_INSTALL|$)/;
		} else if (sys == 'wii' || sys == 'wiiu') {
			idRegex = /(?:^|[\[\(])([A-Z0-9]{3}[A-Z](?:|[A-Z0-9]{2}))(?:[\]\)]|$)/;
		} else if (sys == '3ds' || sys == 'ds') {
			idRegex = /(?:^|[\[\(])([A-Z][A-Z0-9]{2}[A-Z])(?:[\]\)]|$)/;
		} else if (sys == 'gba') {
			idRegex = /(?:^|[\[\(])([A-Z0-9]{8})(?:[\]\)]|$)/;
		} else if (sys == 'ps2') {
			idRegex = /(?:^|[\[\(])([A-Z]{4}-[0-9]{5})(?:[\]\)]|$)/;
		} else if (sys == 'xbox360') {
			idRegex = /(?:^|[\[\(])([0-9A-FGLZ]{8})(?:[\]\)]|$)/;
		} else if (sys == 'mame') {
			idRegex = /(\S+)/;
		}

		let searcharg = {
			shouldSort: true,
			threshold: 0.4,
			location: 0,
			distance: 5,
			maxPatternLength: 64,
			minMatchCharLength: 1,
			keys: [
				'id',
				'title'
			]
		};
		let fuse = new Fuse(gameDB, searcharg);
		let searcher = function(searchTerm) {
			return new Promise((resolve, reject) => {
				resolve(fuse.search(searchTerm));
			});
		};
		for (let h = 0; h < prefs[sys].libs.length; h++) {
			let files = await klaw(prefs[sys].libs[h], {
				depthLimit: 0
			});
			let file;
			// a lot of pruning is required to get good search results
			for (let i = 0; i < files.length; i++) {
				file = files[i];
				let term = path.parse(file);
				// if it's a hidden file like '.DS_STORE' on macOS, skip it
				if (term.base[0] == '.') continue;
				// if it's the dir.txt in the mame roms folder skip it
				if (term.base == 'dir.txt') continue;
				// if the file is a save file skip it
				if (term.ext == '.sav') continue;
				// fixes an issue where folder names were split by periods
				// wiiu and ps3 store games in folders not single file .iso, .nso, etc.
				let isDir = (await fs.stat(file)).isDirectory();
				if (sys != 'wiiu' && sys != 'ps3' && !isDir) {
					term = term.name;
				} else {
					term = term.base;
				}
				olog('file:\t\t\t' + term);
				$('#loadDialog1').text(term);
				await delay(1);
				// rpcs3 ignore games with these ids
				if (term == 'TEST12345' || term == 'RPSN00001') continue;
				// eliminations part 1
				term = term.replace(/[\[\(](USA|World)[\]\)]/gi, '');
				term = term.replace(/[\[\(]*(NTSC)+(-U)*[\]\)]*/gi, '');
				term = term.replace(/[\[\(]*(N64|GCN)[,]*[\]\)]*/gi, '');
				if ((/Disc *[^1A ]/gi).test(term)) {
					log('additional disc: ' + term);
					continue;
				}
				term = term.replace(/[\[\(,](En|Ja|Eu|Disc)[^\]\)]*[\]\)]*/gi, '');
				// special complete subs part 1
				if (sys == 'wii') {
					term = term.replace(/ssbm/gi, 'Super Smash Bros. Melee');
					term = term.replace(/thousand year/gi, 'Thousand-Year');
				}
				term = term.replace(/s*m *64n*/gi, 'Super Mario 64');
				term = term.replace(/mk(\d+)/gi, 'Mario Kart $1');
				// special check for ids
				let id;
				if (idRegex) {
					id = term.match(idRegex);
				}
				if (id) {
					id = id[1];
					log(id);
					let game = gameDB.find(x => x.id === id);
					if (game) {
						if (sys == 'ps3') {
							let dup = games.find(x => x.title === game.title);
							if (dup) {
								continue;
							}
						}
						olog('id:\t\t\t\t' + id);
						olog('found match:\t\t' + game.title + '\r\n');
						game.file = '$' + h + '/' +
							path.relative(prefs[sys].libs[h], file);
						games.push(game);
						continue;
					}
				}
				// replacements
				term = term.replace(/_/g, ' ');
				term = term.replace(/ -/g, ':');
				let temp = term.replace(/, The/gi, '');
				if (term != temp) {

					term = 'The ' + temp;
				}
				// eliminations part 2
				term = term.replace(/,/g, '');
				term = term.replace(/[\[\(](E|J|P|U)[\]\)].*/g, '');
				// special subs part 2
				if (sys == 'wii') {
					term = term.replace(/ 20XX.*/gi, ': 20XX Training Pack');
					term = term.replace(/Nickelodeon SpongeBob/gi, 'SpongeBob');
				} else if (sys == 'switch') {
					term = term.replace(/Nintendo Labo/gi, 'Nintendo Labo -');
				} else if (sys == 'gba') {
					term = term.replace(/ # GBA/gi, '');
				} else if (sys == 'ps2') {
					term = term.replace(/Marvel Vs.*/gi, 'Marvel Vs Capcom 2');
				}
				// special subs part 3
				term = term.replace(/pes *(\d\d\d\d).*/gi, 'Pro Evolution Soccer $1');
				term = term.replace(/Dragonball/gi, 'Dragon Ball');
				term = term.replace(/Goku 2/gi, 'Goku II');
				term = term.replace(/Yu-Gi-Oh /gi, 'Yu-Gi-Oh! ');
				term = term.replace(/lego/gi, 'lego');
				term = term.replace(/warioware,*/gi, 'Wario Ware');
				term = term.replace(/ bros( |$)/gi, ' Bros. ');
				term = term.replace(/(papermario|paper mario[^\: ])/gi, 'Paper Mario');
				// eliminations part 3
				term = term.replace(/[\[\(]*(v*\d+\.|rev *\d).*/gi, '');
				term = term.replace(/\[[^\]]*\]/g, '');
				term = term.replace(/ *decrypted */gi, '');

				term = term.trim();
				let game = await addGame(searcher, term);
				olog('search term:\t\t' + term);
				if (game) {
					olog('found match:\t\t' + game.title + '\r\n');
					game.file = '$' + h + '/' + path.relative(prefs[sys].libs[h], file);
					games.push(game);
				} else {
					olog('no match found\r\n');
				}
			}
		}
		let outLogPath = `${usrDir}/_usr/${sys}Log.log`;
		await fs.outputFile(outLogPath, outLog);
		outLog = '';
		await outputGamesJSON();
	}

	async function outputGamesJSON() {
		let gamesPath = `${usrDir}/_usr/${sys}Games.json`;
		await fs.outputFile(gamesPath, JSON.stringify({
			games: games
		}));
	}

	async function reload() {
		cui.change('loading');
		$('body').removeClass();
		sysStyle = (prefs[sys].style || sys);
		$('body').addClass(sys + ' ' + sysStyle);
		emu = prefs[sys].emu.toLowerCase();

		await intro();
		let gamesPath = `${usrDir}/_usr/${sys}Games.json`;
		// if prefs exist load them if not copy the default prefs
		if (await fs.exists(gamesPath)) {
			games = JSON.parse(await fs.readFile(gamesPath)).games;
		} else {
			if (!emuDir) {
				cui.change('setupMenu');
				await removeIntro(0);
				return;
			}
			log(emu);
			let gameLibDir = `${emuDir}/${prefs[sys].emu}/GAMES`;
			if (emu == 'rpcs3') {
				gameLibDir = `${emuDir}/${prefs[sys].emu}/BIN/dev_hdd0/game`;
			} else if (emu == 'mame') {
				gameLibDir = `${emuDir}/${prefs[sys].emu}/BIN/roms`;
			}

			log(gameLibDir);

			for (let i = 0; !gameLibDir || !(await fs.exists(gameLibDir)); i++) {
				if (i >= 1) {
					cui.change('setupMenu');
					await removeIntro(0);
					cui.err(`Game library does not exist: \n` + gameLibDir);
					return;
				}
				gameLibDir = dialog.selectDir(`select ${sys} game directory`);
			}
			let files = await klaw(gameLibDir);
			for (let i = 0; !files.length || (
					files.length == 1 &&
					(['.DS_Store', 'dir.txt'].includes(
						path.parse(files[0]).base))
				); i++) {
				if (i >= 1) {
					await removeIntro(0);
					cui.change('setupMenu');
					cui.err(`Game library has no game files`);
					return;
				}
				gameLibDir = dialog.selectDir(`select ${sys} game directory`);
				files = await klaw(gameLibDir);
			}
			gameLibDir = gameLibDir.replace(/\\/g, '/');
			if (await fs.exists(gameLibDir)) {
				if (!prefs[sys].libs) {
					prefs[sys].libs = [];
				}
				if (!prefs[sys].libs.includes(gameLibDir)) {
					prefs[sys].libs.push(gameLibDir);
				}
			} else {
				cui.err(`Couldn't load game library`);
				await reload();
				return;
			}
			$('#loadDialog2').text(
				'this may take a few minutes, sit back and relax!');
			await rescan();
		}
		emuDir = emuDir.replace(/\\/g, '/');
		btlDir = emuDir + '/bottlenose';
		await fs.ensureDir(btlDir);
		prefs.btlDir = btlDir;
		prefs.session.sys = sys;
		cui.mapButtons(sys, prefs.ui.gamepad, normalizeButtonLayout);
		await prefsMan.save();
		await viewerLoad();
		await removeIntro();
		cui.change('libMain', sysStyle);
	}

	async function load() {
		let files = await klaw(__rootDir + '/views/md');
		log(files);
		for (let file of files) {
			file = file;
			log(file);
			let html = await fs.readFile(file, 'utf8');
			let fileName = path.parse(file).name;
			if (fileName == 'setupMenu') {
				if (win) {
					html += `Windows users should not store emulator apps or games ` +
						`in \`Program Files\` or any other folder that Bottlenose will ` +
						`not have read/write access to.  On Windows, Bottlenose will ` +
						`look for emulator executables in the \`BIN\` folder or the ` +
						`default install location of that emulator.
\`\`\`
	emu (root folder can have any name)
	└─┬ Dolphin
		├─┬ BIN
		│ ├── User/...
		│ ├── portable.txt
		│ └── Dolphin.exe
		└─┬ GAMES
			├── Super Mario Sunshine.gcz
			├── Super Smash Bros Melee.iso
			└── sm64.wad
\`\`\`
`;
				} else {
					if (mac) {
						html += 'On macOS, Bottlenose will look for emulator ' +
							'apps in `/Applications/`';
					} else {
						html += 'On Linux, Bottlenose will look for emulator apps in ' +
							'their default install locations.';
					}
					html += `
\`\`\`
	emu (root folder can have any name)
	└─┬ Dolphin
		└─┬ GAMES
			├── Super Mario Sunshine.gcz
			├── Super Smash Bros Melee.iso
			└── sm64.wad
\`\`\`
`;
				}
				html += 'Choose "continue" when you\'re ready.';
				html = html.replace(/\t/g, '  ');
			}
			if (fileName == 'welcomeMenu') {
				html = pug('.md', null, md(html) + pug(`img(src="../img/icon.png")`));
			} else {
				html = pug('.md', null, md(html));
			}
			file = path.parse(file);
			$('#' + file.name).prepend(html);
		}
		if (await prefsMan.canLoad()) {
			await prefsMan.load();
			emuDir = path.join(prefs.btlDir, '..');

			// clean up previous versions of the prefs file
			if (prefs.ui.gamepad.mapping) delete prefs.ui.gamepad.mapping;
			if (prefs.ui.recheckImgs) delete prefs.ui.recheckImgs;
			if (prefs.ui.gamepad.profile) {
				prefs.ui.gamepad.default.profile = prefs.ui.gamepad.profile;
				delete prefs.ui.gamepad.profile;
			}
			if (prefs.ui.gamepad.map) {
				prefs.ui.gamepad.default.map = prefs.ui.gamepad.map;
				delete prefs.ui.gamepad.map;
			}
		}
		// currently supported systems
		let sysMenuHTML = '.row-y\n';
		for (let _sys in systems) {
			sysMenuHTML += `\t.uie(name="${_sys}") ${systems[_sys]}\n`;
		}
		$('#sysMenu').append(pug(sysMenuHTML));
		if (prefs.ui.autoHideCover) {
			$('nav').toggleClass('hide');
		}
		$('nav').hover(function() {
			if (prefs.ui.autoHideCover) {
				$('nav').toggleClass('hide');
				if (!$('nav').hasClass('hide')) {
					cui.resize(true);
				}
			}
		});
		sys = arg.sys || prefs.session.sys;
		cui.mapButtons(sys, prefs.ui.gamepad, normalizeButtonLayout);
	}

	cui.setResize((adjust) => {
		if (!$('nav').hasClass('hide')) {
			let $cv = $('.console.view');
			let $cvSel = $cv.find('#view');
			let cvHeight = $cv.height();
			let cpHeight = $('.console.power').height();
			let mod = 24;
			if ((/ps/i).test(sys)) mod = -8;
			if (adjust || cvHeight != cpHeight) {
				$cvSel.css('margin-top', (cpHeight + mod) * .5);
				$('nav').height(cpHeight + 24);
			}
		}
		let $cur = cui.getCur();
		if ($cur.hasClass('selected')) {
			cui.scrollToCursor(250, 0);
			let $reel = $cur.parent();
			$reel.css('left', `${$(window).width()*.5-$cur.width()*.5}px`);
			$cur.css('transform', `scale(${$(window).height()/$cur.height()})`);
		}
	});

	cui.setUIOnChange((state, subState, gamepadConnected) => {
		let labels = [' ', ' ', ' '];
		if (state == 'coverSelect') {
			labels = ['Play', 'Flip', 'Back'];
			cui.getCur().addClass('no-outline');
		} else if (state == 'infoSelect') {
			labels = ['Manuals', 'Texp', 'Back'];
			cui.getCur().addClass('no-outline');
		} else if (state == 'libMain') {
			labels = ['Power', 'Reset', 'Open'];
			cui.getCur(state).removeClass('no-outline');
		} else if (state == 'gameMediaSelect') {
			labels = ['ImgDir', 'File', 'Back'];
		} else if (
			state == 'sysMenu' ||
			(/game/i).test(state)) {
			labels = [' ', ' ', 'Back'];
		} else if (state == 'pauseMenu') {
			labels = ['Quit', 'Mini', 'Back'];
		}
		if (sys == 'wii' && prefs[sys].style == 'gcn') {
			for (let i in labels) {
				labels[i] = labels[i].toLowerCase();
			}
		}
		$('.text.power').text(labels[0]);
		$('.text.reset').text(labels[1]);
		$('.text.open').text(labels[2]);

		function adjust(flip) {
			if (flip && $('nav.fixed-top').find('#view').length) {
				$('.console.open').css({
					'border-radius': '0 0 0 32px',
					'border-width': '0 0 8px 0'
				}).appendTo('nav.fixed-top');
				$('.console.view').css({
					'border-radius': '32px 0 0 0',
					'border-width': '8px 0 0 0'
				}).appendTo('nav.fixed-bottom');
			} else if (!flip && $('nav.fixed-top').find('#open').length) {
				$('.console.open').css({
					'border-radius': '32px 0 0 0',
					'border-width': '8px 0 0 0'
				}).appendTo('nav.fixed-bottom');
				$('.console.view').css({
					'border-radius': '0 0 0 32px',
					'border-width': '0 0 8px 0'
				}).appendTo('nav.fixed-top');
			}
		}
		let buttons = ['X', 'Y', 'B'];
		if ((/(xbox|mame)/i).test(subState)) {
			buttons = ['Y', 'X', 'B'];
			adjust(true);
		} else if ((/ps/i).test(subState)) {
			buttons = ['', '', ''];
			adjust(true);
		} else {
			adjust(false);
		}

		if (!gamepadConnected || !subState) {
			return;
		}
		$('#power span').text(buttons[0]);
		$('#reset span').text(buttons[1]);
		$('#open span').text(buttons[2]);
	});

	cui.setUIAfterChange(() => {
		if ((cui.uiPrev == 'loading' || cui.uiPrev == 'playingBack' || cui.uiPrev == 'errMenu') && cui.ui == 'libMain' && prefs.session[sys] && prefs.session[sys].gameID) {
			let $cur = $('#' + prefs.session[sys].gameID).eq(0);
			cui.makeCursor($cur);
			cui.scrollToCursor(250, 0);
		}
		if (cui.ui == 'infoSelect') {
			cui.makeCursor($('#gameMedia').eq(0));
		}
	});

	function hideDialogs() {
		$('#dialogs').hide();
		$('#loadDialog0').text('');
		$('#loadDialog1').text('');
		$('#loadDialog2').text('');
	}

	async function removeIntro(time) {
		log('time:' + time);
		await delay(time || prefs.load.delay);
		if (introUsesJS) introJS.stop();
		$('#intro').remove();
		$('link.introStyle').prop('disabled', true);
		$('link.introStyle').remove();
		hideDialogs();
	}

	async function powerBtn(withoutGame) {
		let id = cui.getCur('libMain').attr('id');
		log(id);
		if (!prefs.session[sys]) prefs.session[sys] = {};
		if (id) prefs.session[sys].gameID = id;
		if (!id) id = prefs.session[sys].gameID;
		let emuAppPath = await getEmuAppPath();
		if (!emuAppPath) return;
		let game;
		cmdArgs = [];
		emuDirPath = path.join(emuAppPath, '..');
		if (linux) {
			if (emu == 'citra') {
				emuAppPath = 'org.citra.citra-canary'
			}
		}
		if (!withoutGame) {
			game = games.find(x => x.id === id);
			if (game.file) {
				game.file = getAbsolutePath(game.file);
			} else {
				cui.err('game not found: ' + id);
				return;
			}
			if (emu == 'rpcs3') {
				game.file += '/USRDIR/EBOOT.BIN';
			}
			if (emu == 'cemu') {
				let files = await klaw(game.file + '/code');
				log(files);
				let ext, file;
				for (let i = 0; i < files.length; i++) {
					file = files[i];
					ext = path.parse(file).ext;
					if (ext == '.rpx') {
						game.file = file;
						break;
					}
				}
			}
		}
		log(emu);
		let cmdArray = prefs[sys].cmd[osType];
		for (let cmdArg of cmdArray) {
			if (cmdArg == '${app}') {
				cmdArgs.push(emuAppPath);
				if (withoutGame) {
					break;
				}
			} else if (cmdArg == '${game}' || cmdArg == '${game.file}') {
				cmdArgs.push(game.file);
			} else if (cmdArg == '${game.id}') {
				cmdArgs.push(game.id);
			} else if (cmdArg == '${game.title}') {
				cmdArgs.push(game.title);
			} else if (cmdArg == '${cwd}') {
				cmdArgs.push(emuDirPath);
			} else {
				cmdArgs.push(cmdArg);
			}
		}

		if (!withoutGame || emu == 'mame') {
			// cui.removeView('libMain');
			cui.change('playingBack');
			$('#libMain').hide();
			$('#dialogs').show();
			$('#loadDialog0').text(`Starting ${prefs[sys].emu}`);
			if (!withoutGame) $('#loadDialog1').text(game.title);
		}
		log(cmdArgs);
		log(emuDirPath);

		child = require('child_process')
			.spawn(cmdArgs[0], cmdArgs.slice(1) || [], {
				cwd: emuDirPath,
				stdio: 'inherit',
				detached: true
			});

		childState = 'running';

		child.on('close', (code) => {
			closeEmu(code);
		});
	}

	async function closeEmu(code) {
		log(`emulator closed`);
		if (childState == 'resetting') {
			await powerBtn();
			return;
		}
		$('#libMain').show();
		hideDialogs();
		if (cui.getCur('libMain').hasClass('selected')) {
			cui.change('coverSelect');
		} else if (cui.ui != 'libMain') {
			cui.change('libMain');
		}
		if (code) {
			let erMsg = `${prefs[sys].emu} was unable to start the game or crashed.  This is probably not an issue with Bottlenose.  Check online to make sure ${prefs[sys].emu} can boot the game.\n<code>`;
			for (let i in cmdArgs) {
				if (i == 0) erMsg += '$ ';
				erMsg += `${cmdArgs[i]} `;
			}
			erMsg += '</code>';
			cui.err(erMsg, code);
		}
		log('exited with code ' + code);
		electron.getCurrentWindow().focus();
		electron.getCurrentWindow().setFullScreen(true);
		childState = 'closed';
	}

	async function resetBtn() {
		await powerBtn('withoutGame');
	}

	async function createTemplate(emuDir) {
		for (let _sys in systems) {
			if (win) {
				await fs.ensureDir(`${emuDir}/${prefs[_sys].emu}/BIN`);
			}
			await fs.ensureDir(`${emuDir}/${prefs[_sys].emu}/GAMES`);
		}
	}

	async function doHeldAction(act, isBtn, timeHeld) {
		if (timeHeld < 2000) {
			return;
		}
		log(act + ' held for ' + timeHeld);
		let ui = cui.ui;
		if (ui == 'playingBack' && childState == 'running') {
			if (
				act == prefs.inGame.quit.hold &&
				timeHeld > prefs.inGame.quit.time
			) {
				log('shutting down emulator');
				childState = 'closing';
				child.kill('SIGINT');
			} else if (
				act == prefs.inGame.reset.hold &&
				timeHeld > prefs.inGame.reset.time
			) {
				log('resetting emulator');
				childState = 'resetting';
				child.kill('SIGINT');
			}
		}
	}
	cui.setCustomHeldActions(doHeldAction);

	async function coverClicked(select) {
		let $cur = cui.getCur();
		if ($cur.hasClass('uie-disabled')) return false;
		let $reel = $cur.parent();
		$cur.toggleClass('selected');
		$reel.toggleClass('selected');
		$('.reel').toggleClass('bg');
		// $('nav').toggleClass('gamestate');
		if ($cur.hasClass('selected')) {
			cui.scrollToCursor(500, 0);
			$reel.css('left', `${$(window).width()*.5-$cur.width()*.5}px`);
			$cur.css('transform', `scale(${$(window).height()/$cur.height()})`);
		} else {
			$reel.css('left', '');
			$cur.css('transform', '');
		}
	}

	function getCurGame() {
		let id = cui.getCur('libMain').attr('id');
		return games.find(x => x.id === id);
	}

	cui.setCustomActions(async function(act, isBtn) {
		log(act);
		let ui = cui.ui;
		if (ui == 'playingBack') {
			return;
		}
		let onMenu = (/menu/gi).test(ui);
		if (act == 'quit') {
			await prefsMan.save();
			app.quit();
			process.kill('SIGINT');
			return;
		}
		if (ui == 'libMain' || ui == 'coverSelect') {
			if (act == 'x') {
				await powerBtn();
			}
		}
		if (act == 'start' && !onMenu) {
			cui.change('pauseMenu');
		} else if (act == 'b' && onMenu &&
			ui != 'donateMenu' && ui != 'setupMenu') {
			cui.doAction('back');
		} else if (act == 'select') {
			$('nav').toggleClass('hide');
			prefs.ui.autoHideCover = $('nav').hasClass('hide');
			if (!prefs.ui.autoHideCover) {
				cui.resize(true);
			}
		} else if (ui == 'libMain') {
			if (act == 'b' && !onMenu) {
				cui.change('sysMenu');
			} else if (act == 'y') {
				await resetBtn();
			} else if (act == 'a' || !isBtn) {
				await coverClicked();
				cui.change('coverSelect');
			}
		} else if (ui == 'coverSelect') {
			if ((act == 'a' || !isBtn) && (await imgExists(getTemplate(), 'boxOpen'))) {
				// return;
				// TODO finish open box menu
				let game = getCurGame();
				let template = getTemplate();

				$('#gameBoxOpen').prop('src', await imgExists(template, 'boxOpen'));
				$('#gameBoxOpenMask').prop('src',
					await imgExists(template, 'boxOpenMask'));
				$('#gameMemory').prop('src', await imgExists(template, 'memory'));
				$('#gameManual').prop('src', await imgExists(template, 'manual'));

				let mediaName = 'disc';
				if (sys == 'switch' || sys == '3ds' || sys == 'ds' || sys == 'gba') {
					mediaName = 'cart';
				}
				let mediaImg = await imgExists(game, mediaName);
				if (!mediaImg) {
					mediaImg = await imgExists(template, mediaName);
				}
				$('#gameMedia').prop('src', mediaImg);
				cui.change('infoSelect');
				$('#libMain').hide();
			} else if (act == 'b') {
				cui.change('libMain');
				await coverClicked();
			} else if (act == 'y') { // flip
				let $cur = cui.getCur();
				if (!$cur.hasClass('flip')) {
					$cur.addClass('flip');
					let $box = $cur.find('.box').eq(0);
					let game = getCurGame();
					let boxBack = await imgExists(game, 'boxBack');
					if (boxBack) {
						$box.src(boxBack);
						$box.addClass('boxBack');
					}
					let $cover = $cur.find('img.cover').eq(0);
					if (!$cover.length) return;
					let coverBack = await imgExists(game, 'coverBack');
					if (coverBack) {
						$cover.prop('src', coverBack);
						$cur.find('.cover').addClass('coverBack');
					} else {
						let coverFull = await imgExists(game, 'coverFull');
						if (coverFull) {
							$cover.prop('src', coverFull);
							$cur.find('.cover').addClass('coverFull');
						} else {
							return;
						}
					}
					$cur.find('.cover').removeClass('cover');
					$cur.find('.shade').removeClass('hide');
					$cover.removeClass('hide');
				} else {

				}
			}
		} else if (ui == 'infoSelect') {
			if (act != 'b') {
				if (act == 'x') act = 'Manual';
				if (act == 'y') act = 'Texp';
				if (act == 'a') act = 'Media';
				if (!(/(memory|manual|media)/gi).test(act)) return;
				act = act[0].toUpperCase() + act.substr(1);
				act = 'game' + act + 'Select';
				$('#infoSelect').addClass('zoom-' + act);
				cui.change(act);
			} else {
				cui.change('libMain');
				await coverClicked();
			}
		} else if ((/game/i).test(ui)) {
			if (act != 'back' && act != 'b' && ui == 'gameMediaSelect') {
				if (act == 'a' || act == 'media') {
					$('#infoSelect').removeClass('zoom-' + ui);
					cui.doAction('back');
					cui.change('libMain');
					await powerBtn();
				} else if (act == 'y') { // ImgDir
					opn(getImgDir(getCurGame()));
				} else if (act == 'x') { // File
					opn(getCurGame().file);
				}
			} else if (act == 'b') {
				$('#infoSelect').removeClass('zoom-' + ui);
				cui.doAction('back');
			}
		} else if (ui == 'sysMenu' && !isBtn) {
			// if (!emu) {
			// 	return;
			// }
			cui.removeView('libMain');
			sys = act;
			cui.removeCursor();
			await reload();
		} else if (ui == 'pauseMenu') {
			if (act == 'minimize' || act == 'y') {
				electron.getCurrentWindow().minimize();
			} else if (act == 'fullscreen') {
				electron.getCurrentWindow().focus();
				electron.getCurrentWindow().setFullScreen(true);
			} else if (act == 'toggleCover') {
				cui.buttonPressed('select');
			} else if (act == 'recheckLib' || act == 'rescanLib') {
				if (act == 'recheckLib') {
					recheckImgs = true;
					await fs.remove(`${usrDir}/_usr/${sys}Games.json`);
				}
				cui.removeView('libMain');
				cui.change('rescanning');
				await intro();
				await rescan();
				await viewerLoad();
				await removeIntro();
				cui.change('libMain');
				cui.scrollToCursor(0);
				recheckImgs = false;
			} else if (act == 'openLog') {
				opn(`${usrDir}/_usr/${sys}Log.log`);
			} else if (act == 'prefs') {
				opn(prefsMan.prefsPath);
			} else if (act == 'x') {
				cui.doAction('quit');
			} else if (act == 'start') {
				cui.doAction('back');
			}
		} else if (ui == 'donateMenu') {
			if (act == 'donate-monthly') {
				opn('https://www.patreon.com/qashto');
			} else if (act == 'donate-single') {
				opn('https://www.paypal.me/qashto/20');
			} else if (act == 'donate-later') {
				await reload();
			} else if (act == 'donated') {
				cui.change('checkDonationMenu');
			}
		} else if (ui == 'checkDonationMenu') {
			let password = '\u0074\u0068\u0061\u006e\u006b\u0079\u006f\u0075' +
				'\u0034\u0064\u006f\u006e\u0061\u0074\u0069\u006e\u0067\u0021';
			let usrDonorPass = $('#donorPassword').val();
			if (usrDonorPass == unicodeToChar(password)) {
				prefs.donor = true;
				await reload();
			} else {
				cui.change('donateMenu');
				cui.err('incorrect donor password');
			}
		} else if (ui == 'welcomeMenu') {
			if (act == 'demo') {
				emuDir = os.homedir() + '/Documents/emu';
				let templatePath = __rootDir + '/demo';
				await fs.copy(templatePath, emuDir);
				await createTemplate(emuDir);
				await reload();
			} else if (act == 'full') {
				cui.change('setupMenu');
			}
		} else if (ui == 'setupMenu') {
			if (act == 'new' || act == 'new-in-docs' || act == 'old') {
				let msg = 'choose the folder you want to template to go in';
				if (act == 'old') {
					msg = 'choose the folder EMULATORS from your WiiUSBHelper ' +
						'file structure';
				}
				if (act == 'new-in-docs') {
					emuDir = os.homedir() + '/Documents';
				} else {
					emuDir = dialog.selectDir(msg);
				}
				if (!emuDir) return false;
				if (act != 'old') emuDir += '/emu';
				await createTemplate(emuDir);
				if (act != 'old') opn(emuDir);
			}
			if (act == 'continue' || act == 'old') {
				if (!(await fs.exists(emuDir))) {
					emuDir = os.homedir() + '/Documents/emu';
				}
				await createTemplate(emuDir);
				cui.change('sysMenu');
			}
		}
	});

	function unicodeToChar(text) {
		return text.replace(/\\u[\dA-F]{4}/gi,
			function(match) {
				return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
			});
	}

	cui.bind(['command+n', 'ctrl+n'], 'select');

	cui.click('#powerBtn', 'x');
	cui.click('#viewBtn', 'start');
	cui.click('#resetBtn', 'y');
	cui.click('#openBtn', 'b');

	async function getImg(game, name, hq) {
		let res = await imgExists(game, name);
		if (res) return res;
		$('#loadDialog0').html(md(
			`scraping for the  \n${name}  \nof  \n${game.title}`
		));
		let imgDir = getImgDir(game);
		let file, url;
		// check if game img is specified in the gamesDB
		if (game.img && game.img[name]) {
			log(name);
			url = game.img[name].split(' ');
			let ext, scraper;
			// url[0] is the url and url[1] is the file type
			if (url[1] && url[0].length != 1) {
				// catch and ignore old method of doing this from
				// a previous version of Bottlnose
				if (url[1][0] == '/' || url[1][0] == '\\') return;
				url = url[0] + '.' + url[1];
			} else if (url[0] == 'q') {
				url = srp.gqa.unwrapUrl(theme.style, game, name);
			} else if (url[1]) {
				// url[0] is key for the scraper
				scraper = scrapers[url[0]];
				// the unique parts of the url for the site the img was scraped from
				let data = url.slice(1);
				// unwrap/unminify the url using the unique parts
				url = srp[scraper].unwrapUrl(data);
			} else {
				// the url is just a regular old link
				url = url[0];
			}
			ext = url.substr(-3);
			file = `${imgDir}/${name}.${ext}`;
			if (scraper == 'gfs') {
				res = await srp.gfs.dlImg(url, imgDir, name);
			} else {
				res = await dl(url, file);
			}
			if (res) return res;
		}

		if (game.id == '_TEMPLATE') return;

		// get high quality box from Andy Decarli's site
		res = await srp.dec.dlImg(sys, game, imgDir, name);
		if (res) return res;

		res = await srp.mdo.dlImg(sys, game, imgDir, name);
		if (res) return res;

		if (hq) return;

		return await srp.tdb.dlImg(sys, game, imgDir, name);
	}

	function getTemplate() {
		let imgTypes = [
			'box', 'boxBack', 'boxOpen', 'boxOpenMask', 'manual',
			'memory', 'memoryBack'
		];
		let template = {
			id: '_TEMPLATE',
			title: 'Template',
			img: theme.template
		};
		for (let imgType of imgTypes) {
			if (!template.img[imgType]) {
				template.img[imgType] = 'q';
			}
		}
		return template;
	}

	async function loadImages() {
		let imgDir;
		let _gamesLength = games.length;
		for (let i = 0; i < games.length + 1; i++) {
			let res;
			let game;
			let isTemplate = (i == games.length);
			if (isTemplate) {
				game = getTemplate();
			} else {
				game = games[i];
			}
			if (game.title) {
				game.title = rmDiacritics(game.title);
			}
			imgDir = getImgDir(game);

			if (recheckImgs || !(await fs.exists(imgDir))) {
				await fs.ensureDir(imgDir);

				if (!isTemplate ||
					(!(await imgExists(game, 'coverFull')) &&
						!(await imgExists(game, 'cover')))
				) {
					await getImg(game, 'box', 'HQ');
				}
				res = await getImg(game, 'coverFull');
				if (!res) {
					await getImg(game, 'coverSide');
					if (!(await imgExists(game, 'boxBack'))) {
						await getImg(game, 'coverBack');
					}
				}
				if (!res && !(await imgExists(game, 'box'))) {
					res = await getImg(game, 'cover');
					if (!res) res = await getImg(game, 'box');
					if (!res) {
						games.splice(i, 1);
						i--;
						await fs.remove(imgDir);
						continue;
					}
				}

				if (sys == 'switch' || sys == '3ds' || sys == 'ds' || sys == 'gba') {
					await getImg(game, 'cart');
				} else if (sys != 'mame') {
					await getImg(game, 'disc');
				}

				if (sys == 'mame') {
					await getImg(game, 'boxOpen');
				} else if (prefs.ui.getExtraImgs || isTemplate) {
					await getImg(game, 'boxOpen');
					await getImg(game, 'boxOpenMask');
					await getImg(game, 'manual');
					await getImg(game, 'memory');
					await getImg(game, 'memoryBack');
				}
			}
		}
		if (_gamesLength != games.length) await outputGamesJSON();
		if (theme.default) {
			defaultBox = await getImg(theme.default, 'box');
			if (!defaultBox) {
				er('ERROR: No default box image found');
				return;
			}
		}

		games = games.sort((a, b) => a.title.localeCompare(b.title));
	}

	function getImgDir(game) {
		let imgDir = `${prefs.btlDir}/${sys}/${game.id}/img`;
		if (emu == 'mame') {
			imgDir = `${emuDir}/MAME/BIN/artwork/${game.id}`;
		}
		return imgDir;
	}

	async function imgExists(game, name) {
		let imgDir = getImgDir(game);
		let file = `${imgDir}/${name}.png`;
		if (!(await fs.exists(file))) {
			file = file.substr(0, file.length - 3) + 'jpg';
			if (!(await fs.exists(file))) {
				if (sys != 'mame' || name != 'boxOpen' || !(await fs.exists(`${imgDir}/default.lay`))) {
					return;
				} else {
					file = `${imgDir}/default.lay`;
				}
			}
		}
		return file;
	}

	async function addCover(game, reelNum) {
		let cl1 = '';
		let file = await imgExists(game, 'box');
		if (!file) {
			file = await imgExists(game, 'coverFull');
			cl1 = '.coverFull';
			if (!file) {
				file = await imgExists(game, 'cover');
				cl1 = '.cover';
				if (!file) {
					log(`no images found for game: ${game.id} ${game.title}`);
					return;
				}
			}
		}
		$('.reel.r' + reelNum).append(pug(`
#${game.id}.${game.sys || theme.style}.uie${((game.id != '_TEMPLATE')?'':'.uie-disabled')}
	${((cl1)?`img.box(src="${defaultBox}")`:`img.box(src="${file}")`)}
	section.crop${cl1 || '.cover'}
		img${(cl1||'.cover') + ((cl1)?'':'.hide')}(src="${(cl1)?file:''}")
		.shade.p-0.m-0${(cl1)?'':'.hide'}
		`));
		return true;
	}

	function getAbsolutePath(file) {
		if (!file) return '';
		let lib = file.match(/\$\d+/g);
		if (lib) {
			lib = lib[0].substr(1);
			log(lib);
			file = file.replace(/\$\d+/g, prefs[sys].libs[lib]);
		}
		let tags = file.match(/\$[a-zA-Z]+/g);
		if (!tags) return file;
		let replacement = '';
		for (tag of tags) {
			tag = tag.substr(1);
			if (tag == 'home') {
				replacement = os.homedir().replace(/\\/g, '/');;
			}
			file = file.replace('$' + tag, replacement);
		}
		return file;
	}

	async function getEmuAppPath() {
		let emuAppPath = getAbsolutePath(prefs[sys].app[osType]);
		if (emuAppPath && await fs.exists(emuAppPath)) {
			return emuAppPath;
		}
		emuAppPath = '';
		let emuDirPath = '';
		if (win || (linux && (/(cemu|yuzu|rpcs3)/).test(emu)) ||
			(mac && emu == 'mame')) {
			emuDirPath = `${emuDir}/${prefs[sys].emu}/BIN`;
			if (emu == 'citra') {
				if (await fs.exists(emuDirPath + '/nightly-mingw')) {
					emuDirPath += '/nightly-mingw';
				} else {
					emuDirPath += '/canary-mingw';
				}
			}
			if (win && emu == 'yuzu') {
				emuDirPath = os.homedir() + '/AppData/Local/yuzu';
				if (await fs.exists(emuDirPath + '/canary')) {
					emuDirPath += '/canary';
				} else {
					emuDirPath += '/nightly';
				}
			}
		} else if (mac) {
			emuDirPath = '/Applications';
		}
		let emuNameCases = [
			prefs[sys].emu,
			prefs[sys].emu.toLowerCase(),
			prefs[sys].emu.toUpperCase()
		];
		for (let i = 0; i < emuNameCases.length; i++) {
			if (emuDirPath) {
				emuAppPath = emuDirPath + '/';
			}
			emuAppPath += emuNameCases[i];
			if (win) {
				if (emu == 'citra') emuAppPath += '-qt';
				if (emu == 'mgba') emuAppPath += '-sdl';
				if (emu == 'mame') emuAppPath += '64';
				emuAppPath += '.exe';
			} else if (mac) {
				if (emu == 'citra') {
					emuAppPath += `/nightly/${emuNameCases[1]}-qt`;
				} else if (emu == 'yuzu') {
					emuAppPath += '/' + emuNameCases[1];
				}
				if (emu != 'mame') {
					emuAppPath += '.app/Contents/MacOS';
				}
				if (emu == 'desmume') {
					emuAppPath += '/' + emuNameCases[0];
				} else if (emu != 'mame') {
					emuAppPath += '/' + emuNameCases[1];
				}
				if (emu == 'citra') {
					emuAppPath += '-qt-bin';
				} else if (emu == 'yuzu') {
					emuAppPath += '-bin';
				}
				if (emu == 'mame') emuAppPath += '64';
			} else if (linux) {
				if (emu == 'dolphin') {
					emuAppPath = 'dolphin-emu';
				} else if (emu == 'cemu') {
					emuAppPath += '.exe';
				} else if (emu == 'rpcs3') {
					emuAppPath += '.AppImage';
				}
			}
			if (
				(linux && !(/(cemu|yuzu|rpcs3)/).test(emu)) ||
				await fs.exists(emuAppPath)
			) {
				prefs[sys].app[osType] = emuAppPath;
				return emuAppPath;
			}
		}
		log('couldn\'t find app at path:\n' + emuAppPath);
		emuAppPath = dialog.selectFile('select emulator app');
		if (mac) {
			emuAppPath += '/Contents/MacOS/' + emuNameCases[1];
			if (emu == 'citra') {
				emuAppPath += '-qt-bin';
			} else if (emu == 'yuzu') {
				emuAppPath += '-bin';
			}
		}
		if (!(await fs.exists(emuAppPath))) {
			cui.err('app path not valid: ' + emuAppPath);
			return '';
		}
		prefs[sys].app[osType] = emuAppPath;
		return emuAppPath;
	}

	async function addTemplates(template, rows, num) {
		for (let i = 0; i < rows; i++) {
			for (let j = 0; j < num; j++) {
				await addCover(template, i);
			}
		}
	}

	async function viewerLoad() {
		cui.resize(true);
		let shouldRebindMouse;
		if (!themes) {
			shouldRebindMouse = true;
			let themesPath = __rootDir + '/prefs/themes.json';
			themes = JSON.parse(await fs.readFile(themesPath));
		}
		theme = themes[prefs[sys].style || sys];
		theme.style = prefs[sys].style || sys;
		cui.setMouse(prefs.ui.mouse, 100 * prefs.ui.mouse.wheel.multi);
		await loadImages();
		let rows = prefs.ui.maxRows || 8;
		if (games.length < 42) rows = 8;
		if (games.length < 18) rows = 4;
		if (games.length < 4) rows = 2;
		$('style.gameViewerRowsStyle').remove();
		let $glv = $('#libMain');
		let dynRowStyle = '<style class="gameViewerRowsStyle" type="text/css">' +
			`.reel {width: ${1 / rows * 100}%;}`
		for (let i = 0; i < rows; i++) {
			$glv.append(pug(
				`.reel.r${i}.row-y.${((i % 2 == 0)?'reverse':'normal')}`
			));
			dynRowStyle += `.reel.r${i} {left:  ${i / rows * 100}%;}`;
		}
		dynRowStyle += `
.cui-gamepadConnected .reel .uie.cursor {
	outline: ${Math.abs(7-rows)}px dashed white;
	outline-offset: ${ 9-rows}px;
}`;
		dynRowStyle += '</style>';
		$('body').append(dynRowStyle);
		let template = getTemplate();
		await addTemplates(template, rows, templateAmt);
		for (let i = 0, j = 0; i < games.length; i++) {
			try {
				for (let k = 0; k < rows; k++) {
					if (i < games.length * (k + 1) / rows) {
						await addCover(games[i], k);
						break;
					}
				}
				j++;
			} catch (ror) {
				log(ror);
			}
		}
		await addTemplates(template, rows, templateAmt);
		cui.addView('libMain', {
			hoverCurDisabled: true
		});
		$('#view').css('margin-top', '20px');
		if (shouldRebindMouse) {
			cui.rebind('mouse');
		}
	}

	electron.getCurrentWindow().setFullScreen(true);
	await load();
	if (prefs.donor) {
		await reload();
	} else if (await prefsMan.canLoad() && !prefs.donor) {
		cui.change('donateMenu');
	} else {
		cui.change('welcomeMenu');
	}
	cui.start({
		v: true,
		gca: prefs.ui.gamepad.gca
	});
	await delay(1000);
	cui.resize(true);
};
