/*
 * index.js : Nostlan : quinton-ashley
 *
 * Main file.
 */
module.exports = async function (args) {
	await require(args.__root + '/core/setup.js')(args);
	log('version: ' + pkg.version);
	global.util = require(__root + '/core/util.js');
	require('jquery-ui-dist/jquery-ui'); // used for autocomplete

	global.ConfigEditor = require(__root + '/core/ConfigEditor.js');
	global.cfMng = new ConfigEditor();

	// Users can put the emu folder with all their games,
	// emulator apps, and box art images anywhere they want but
	// their configuration file must be located at:
	// ~/Documents/emu/nostlan/config.json
	{
		// move from old location if necessary
		let dir = util.absPath('~/Documents/emu/nostlan');
		let oldPath = dir + '/_usr/prefs.json';
		cfMng.configPath = dir + '/config.json';
		if (await fs.exists(oldPath)) {
			await fs.move(oldPath, cfMng.configPath);
			await fs.remove(dir + '/_usr');
		}
	}

	cfMng.configDefaultsPath = __root + '/core/configDefaults.json';
	cfMng.update = require(__root + '/core/configUpdate.js');
	global.cf = await cfMng.getDefaults();
	cf.args = args;

	global.sys = ''; // current system (name)
	global.syst = {}; // current system (object)
	global.emu = ''; // current emulator (name)
	global.offline = false;
	// used for creating save states
	global.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	// built-in supported systems
	let names = [
		'arcade',
		'ds',
		'gba',
		'gcn',
		'n3ds',
		'n64',
		'nes',
		// 'ps',
		'ps2',
		'ps3',
		'psp',
		'smd',
		'snes',
		'switch',
		'wii',
		'wiiu',
		'xbox',
		'xbox360'
	];
	global.systems = {};
	global.emus = {};

	for (let name of names) {
		let dir = __root + '/sys/' + name;

		if (!(await fs.exists(dir + '/sys.json'))) continue;
		let data = await fs.readFile(dir + '/sys.json', 'utf-8');
		systems[name] = JSON.parse(data);

		if (!(await fs.exists(dir + '/emus.json'))) continue;
		data = await fs.readFile(dir + '/emus.json', 'utf-8');
		Object.assign(emus, JSON.parse(data));
	}
	delete names;

	if (!cf.arch) cf.arch = require('process').arch;

	// only keeps the info necessary for the current os + chip arch
	for (let _emu in emus) {
		let props = ['app', 'appDirs', 'appRegex', 'cmd', 'install', 'update'];

		for (let prop of props) {
			if (!emus[_emu][prop]) continue;
			let type = osType;
			if (prop == 'install') type += '-' + cf.arch;

			if (typeof emus[_emu][prop] != 'string') {
				if (emus[_emu][prop][type]) {
					emus[_emu][prop] = emus[_emu][prop][type];
				} else if (prop != 'install' || !emus[_emu][prop].jsEmu) {
					delete emus[_emu][prop];
				}
			}
		}
		delete emus[_emu].fullscreenKeyCombo;
	}

	global.systemsDir = ''; // nostlan dir is stored here

	// Set default settings for scrolling on a Mac.
	// I assume the user is using a smooth scroll trackpad
	// or apple mouse with their Mac. This is for the old
	// alternating reel based game library view, these values
	// are only used by contro-ui
	if (mac) {
		cf.ui.mouse.wheel.multi = 0.5;
		cf.ui.mouse.wheel.smooth = true;
	}

	// sharp and jimp and image creators/editors
	// sharp is faster but it requires native building which is rough on linux and mac
	// only windows builds can use it out of the box included with Nostlan
	// jimp is the fallback implemented in pure JS
	global.sharp = null;
	global.jimp = null;
	if (win) {
		try {
			sharp = require('sharp');
		} catch (ror) {
			er(ror);
		}
	}
	if (!sharp) {
		jimp = require('jimp');
	}

	global.nostlan = {};

	{
		let core = __root + '/core';
		nostlan.browser = require(core + '/browser.js');
		nostlan.launcher = require(core + '/launcher.js');
		nostlan.installer = require(core + '/installer.js');
		nostlan.saves = require(core + '/saves.js');
		nostlan.scan = require(core + '/scanner.js');
		nostlan.scraper = require(core + '/scraper.js');
		nostlan.themes = require(core + '/themes.js');
		nostlan.updater = require(core + '/updater.js');
	}

	// only Patreon supporters can use premium features
	if (!args.dev) {
		nostlan.premium = require(__root + '/dev/premium.js');
	} else {
		nostlan.premium = {
			verify: () => {}
		};
	}

	// mouse is auto-hidden when the user starts using a gamepad
	// but if the user moves the mouse show it again
	document.body.addEventListener('mousemove', function (e) {
		document.exitPointerLock();
	});

	{
		// Importing this adds a right-click menu with 'Inspect Element' option
		let rightClickPosition = null;

		const rightClickMenu = new electron.Menu();
		rightClickMenu.append(
			new electron.MenuItem({
				label: 'Paste',
				click: () => {
					document.execCommand('paste');
				}
			})
		);
		rightClickMenu.append(
			new electron.MenuItem({
				label: 'Inspect Element',
				click: () => {
					electron.getCurrentWindow().inspectElement(rightClickPosition.x, rightClickPosition.y);
				}
			})
		);

		window.addEventListener(
			'contextmenu',
			(e) => {
				e.preventDefault();
				rightClickPosition = { x: e.x, y: e.y };
				rightClickMenu.popup(electron.getCurrentWindow());
			},
			false
		);
	}

	nostlan.setup = async () => {
		// after the user uses the app for the first time
		// a preferences file is created, if it exists load it
		if (await cfMng.canLoad()) {
			cf = await cfMng.load(cf);
			cf.args = args;
		}
		if (!args.dev) {
			electron.getCurrentWindow().setFullScreen(cf.ui.launchFullScreen);
		}

		let sysMenu = `h1.title0\n`;

		{
			let i = 0;
			for (let _sys in systems) {
				let _syst = systems[_sys];
				if (!_syst.emus) continue;
				if (i % 2 == 0) sysMenu += `.row.row-x\n`;
				sysMenu += `\t.col.cui(name="${_sys}") ${_syst.name}\n`;
				i++;
			}
		}
		$('#sysMenu_5').append(pug(sysMenu));

		if (cf.ui.autoHideCover) {
			$('nav').toggleClass('hide');
		}

		$('nav').hover(() => {
			if (cf.ui.autoHideCover) $('nav').toggleClass('hide');
		});

		cui.click($('#nav0'), 'x');
		cui.click($('#nav1'), 'start');
		cui.click($('#nav2'), 'y');
		cui.click($('#nav3'), 'b');

		require(__root + '/cui/_cui.js')();

		sys = args.sys || cf.session.sys;
		syst = systems[sys];
		cui.mapButtons(sys);

		// physical layout always matches the on screen postion of x and y
		// in the cover menu
		cui.start({
			v: true,
			haptic: cf.ui.gamepad.haptic,
			gca: false, // disabled cf.ui.gamepad.gca for now until gca support can be fixed
			gamepadMaps: cf.ui.gamepad,
			normalize: {
				map: {
					x: 'y',
					y: 'x'
				},
				disable: 'nintendo'
			}
		});
		process.on('uncaughtException', (ror) => {
			console.error(ror);
			cui.err(`<textarea rows=8>${ror.stack}</textarea>`, 'Nostlan crashed :(', 'quit');
		});
		cui.bindWheel($('.reels'));

		for (let file of await klaw(__root + '/cui')) {
			let name = path.parse(file).name;
			if (name.slice(2) == '__') continue;
			cui[name] = require(file);
		}

		// keyboard controls
		for (let char of 'abcdefghijklmnopqrstuvwxyz') {
			cui.keyPress(char, 'key-' + char);
			char = char.toUpperCase();
			cui.keyPress(char, 'key-' + char);
		}
		for (let char of '1234567890!@#$%^&*()') {
			cui.keyPress(char, 'key-' + char);
		}
		cui.keyPress('space', 'key- ');

		cui.keyPress('-', 'l');
		cui.keyPress('=', 'r');
		cui.keyPress('[', 'x');
		cui.keyPress(']', 'y');
		cui.keyPress('\\', 'b');
		cui.keyPress('|', 'start');
		cui.keyPress('esc', 'start');

		// https://www.geeksforgeeks.org/drag-and-drop-files-in-electronjs/
		// TODO: finish implementation
		document.addEventListener('drop', async (event) => {
			event.preventDefault();
			event.stopPropagation();

			for (const f of event.dataTransfer.files) {
				// Using the path attribute to get absolute file path
				let file = f.path;
				log('file dragged: ', file);
				await fs.move(file, cf[sys].libs[0] + '/' + path.parse(file).base);
			}
			await cui.libMain.rescanLib();
		});

		document.addEventListener('dragover', (e) => {
			e.preventDefault();
			e.stopPropagation();
		});

		document.addEventListener('dragenter', (event) => {
			log('file is in the Drop Space');
		});

		document.addEventListener('dragleave', (event) => {
			log('file has left the Drop Space');
		});

		await nostlan.start();
	};

	nostlan.start = async () => {
		if (!cf.ui.lang) {
			await cui.change('languageMenu');
			return; // make user choose language first
		}
		$('body').addClass('waiting'); // changes mouse pointer into progress indicator

		global.lang = JSON.parse(await fs.readFile(`${__root}/lang/${cf.ui.lang}/${cf.ui.lang}.json`, 'utf8'));

		// fill in incomplete translations with english so the app doesn't crash
		if (cf.ui.lang != 'en') {
			const deepExtend = require('deep-extend');
			let en = JSON.parse(await fs.readFile(`${__root}/lang/en/en.json`, 'utf8'));
			deepExtend(en, lang);
			lang = en;
			log(lang);
		}
		$('#dialogs').show();
		$('#loadDialog0').text(lang.loading.msg3 + ' v' + pkg.version);

		// convert all markdown files to html
		for (let file of await klaw(`${__root}/lang/en/md`)) {
			let dir = `${__root}/lang/${cf.ui.lang}/md`;
			if (cf.ui.lang != 'en' && !(await fs.exists(dir))) {
				dir = `${__root}/lang/en/md`;
			}
			let base = path.parse(file).base;
			let data = await fs.readFile(dir + '/' + base, 'utf8');
			// this file has OS specific text
			if (base == 'setupMenu_1.md') {
				data = util.osmd(data);
			}
			data = data.replace(/\t/g, '  ');
			data = pug('.md', null, md(data));
			file = path.parse(file);
			$(`#${file.name} .md`).remove();
			$('#' + file.name).prepend(data);
		}

		// ensures the template dir structure exists
		if (await cfMng.canLoad()) {
			await cui.setupMenu.createTemplate();
		}

		if (cf.load.online) {
			try {
				if (!args.dev) {
					await nostlan.updater.check();
				}
			} catch (ror) {
				log('running in offline mode');
				offline = true;
			}
		}

		if (!offline) {
			// load only the most necessary assets for now
			await cui.loading.loadSharedAssets(['labels', 'plastic']);
		}
		let lblImg = cf.nlaDir + '/images/labels/long/lbl0.png';
		if (cf.nlaDir) $('.label-input img').prop('src', lblImg + '?' + Date.now());

		cui.editView('boxOpenMenu', {
			keepBackground: true,
			hoverCurDisabled: true
		});

		$('body').removeClass('waiting');
		cui.clearDialogs();

		await cfMng.update(cf);

		if (cf.nlaDir) {
			if ((args.dev && !args.testSetup) || nostlan.premium.verify()) {
				await cui.libMain.load();
				if (!args.dev && !cf.saves) {
					cui.change('addSavesPathMenu');
				}
			} else if ((await cfMng.canLoad()) && !nostlan.premium.status) {
				cui.change('donateMenu');
			}
		} else {
			cui.change('welcomeMenu');
		}
	};

	nostlan.quit = async () => {
		cui.opt.haptic = false;
		// only sync saves on quit
		// if there was not an error
		// if not developing nostlan
		// if user is a patreon supporter
		if (cui.ui != 'alertMenu' && !args.dev && nostlan.premium.verify()) {
			await cui.nostlanMenu.saveSync('quit');
		}
		// save the cf file
		// remove the command line args from this session
		delete cf.args;
		for (let prop in cf) {
			delete cf[sys].saveStates;
		}
		if (cf.nlaDir) await cfMng.save(cf);
	};

	// first function to be called
	await nostlan.setup();
};
