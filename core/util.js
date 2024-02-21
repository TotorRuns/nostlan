/*
 * util.js : Nostlan : quinton-ashley
 *
 * Utility functions.
 */
// extract compressed folders using 7zip
global.fs.extract = async (input, output, opt) => {
	opt = opt || {};
	let ext = path.parse(input).ext;
	let res;
	if (ext != '.7z') {
		try {
			await require('extract-zip')(input, {
				dir: output
			});
			res = output;
			await fs.remove(input);
		} catch (ror) {
			if (mac || linux) {
				res = await spawn('tar', ['-xzvf', input, '-C', output]);
				if (res instanceof Error) {
					er(res);
					return;
				}
			} else {
				er(ror);
			}
		}
	}
	if (res) return res;
	return new Promise((resolve, reject) => {
		opt.$bin = require('7zip-bin').path7za;
		require('node-7z')
			.extractFull(input, output, opt)
			.on('end', () => {
				fs.remove(input);
				resolve(output);
			})
			.on('error', (ror) => {
				console.error(ror);
				fs.remove(input);
				resolve();
			});
	});
};

class Utility {
	constructor() {}

	absPath(file) {
		if (!file) return '';
		if (file[0] === '~') {
			file = path.join(os.homedir(), file.slice(1));
		}
		let lib = file.match(/\$\d+/g);
		if (lib) {
			lib = lib[0].slice(1);
			file = file.replace(/\$\d+/g, cf[sys].libs[lib]);
		}
		let tags = file.match(/\$[a-zA-Z]+/g);
		if (!tags) return file;
		let replacement = '';
		for (let tag of tags) {
			tag = tag.slice(1);
			if (tag == 'home') {
				replacement = os.homedir();
			} else if (tag == 'emu') {
				if (emu && emus[emu].jsEmu && emus[emu].multiSys) {
					replacement = `${systemsDir}/nostlan/jsEmu/${emu}`;
				} else {
					replacement = `${systemsDir}/${sys}/${emu}`;
				}
			}
			file = file.replace('$' + tag, replacement);
		}
		if (win) file = file.replace(/\\/g, '/');
		return file;
	}

	osmd(data) {
		let arr = data.split(/\n(# os [^\n]*)/gm);
		data = '';
		for (let i = 0; i < arr.length; i++) {
			if (arr[i].slice(0, 5) == '# os ') {
				if (win && arr[i].includes('win')) {
					data += arr[i + 1];
				} else if (linux && arr[i].includes('linux')) {
					data += arr[i + 1];
				} else if (mac && arr[i].includes('mac')) {
					data += arr[i + 1];
				}
				i++;
			} else {
				data += arr[i];
			}
		}
		return data;
	}
}

module.exports = new Utility();
