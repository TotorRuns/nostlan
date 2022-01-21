class CuiState extends cui.State {
	async onAction(act) {
		if (act == 'retry') {
			await cui.libMain.load();
		} else if (act == 'find') {
			log('user selecting gameLibDir');
			// `select ${syst.name} games folder`
			let gameLibDir = await dialog.selectDir(
				lang.emptyGameLibMenu.msg0_0 + ' ' + syst.name + ' ' + lang.emptyGameLibMenu.msg0_1
			);
			log('user selected: ' + gameLibDir);
			if (!gameLibDir || !(await fs.exists(gameLibDir))) {
				// 'Game library does not exist'
				cui.err(syst.name + ' ' + lang.sysMenu.msg0 + ': ' + gameLibDir, 404);
				return;
			}

			await cui.libMain.load(gameLibDir);
		} else if (act.slice(0, 7) == 'install') {
			emu = act.slice(8);
			let app = await nostlan.launcher.getEmuApp();
			if (app && linux && !/\//.test(app)) {
				// If you don't have this app, install it using your linux package manager to add/remove software
				cui.err(lang.emptyGameLibMenu.err1 + ' ' + app);
				return;
			} else if (app) {
				// you already have this app installed
				cui.err(lang.emptyGameLibMenu.err0 + ' ' + app);
				return;
			}
			app = await cui.emuAppMenu.installEmuApp();
			if (!app) return;
			// 'Success!' 'Installed'
			cui.alert(lang.emuAppMenu.msg11 + ' ' + emus[emu].name, lang.alertMenu.title0, 'sysMenu');
		}
	}

	async onChange() {
		this.$elem.find('.cui').remove();
		this.$elem.append(
			pug(`
.cui(name='retry')
	i.material-icons.md-left loop
	.text.opt0 ${lang.emptyGameLibMenu.opt0}
	i.material-icons.md-right.invis loop
.cui(name='find')
	i.material-icons.md-left wysiwyg
	.text.opt1 ${lang.emptyGameLibMenu.opt1}
	i.material-icons.md-right.invis wysiwyg`)
		);
		for (let i in syst.emus) {
			i = Number(i);
			let _emu = syst.emus[i];
			let instOpt = `
.cui(name='install-${_emu}')
	i.material-icons.md-left get_app
	.text.opt${i + 2} ${lang.emptyGameLibMenu['opt' + (i + 2)]} ${emus[_emu].name}
	i.material-icons.md-right.invis get_app`;
			this.$elem.append(pug(instOpt));
		}
		cui.addListeners(this.id);
		let note = prefs[sys].libs.join('<br>') + '<br><br>';
		if (syst.gameExts) {
			// 'Game files must have the file extension'
			note += lang.emptyGameLibMenu.msg1_0 + ':<br>';
			for (let i in syst.gameExts) {
				note += '.' + syst.gameExts[i];
				if (i != syst.gameExts.length - 1) {
					note += ', ';
				}
				if (i == syst.gameExts.length - 2) {
					// 'or '
					note += lang.emptyGameLibMenu.msg1_1 + ' ';
				}
			}
			note += '<br><br>';
		}
		// "If you don't have any
		note += lang.emptyGameLibMenu.msg1_2 + ' ';
		// games yet you might want to install the
		note += syst.name + ' ' + lang.emptyGameLibMenu.msg1_3;
		note += ' ' + emus[emu].name + ' ';
		// emulator app first."
		note += lang.emptyGameLibMenu.msg1_4;
		this.$elem.find('.msg1').html(note);
	}
}
module.exports = new CuiState();
