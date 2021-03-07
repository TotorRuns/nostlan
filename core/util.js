/*
 * util.js : Nostlan : quinton-ashley
 *
 * Utility functions.
 */
// extract compressed folders using 7zip
global.fs.extract = async (input, output, opt) => {
	opt = opt || {};
	let ext = path.parse(input).ext;
	if (ext == '.7z') {
		return new Promise((resolve, reject) => {
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
	} else {
		try {
			await require('extract-zip')(input, {
				dir: output
			});
		} catch (ror) {
			if (mac || linux) {
				await spawn('tar', ['-xzvf', input, '-C', output]);
			} else {
				er(ror);
			}
		}
		fs.remove(input);
	}
};

class Utility {
	constructor() {}

	absPath(file) {
		if (!file) return '';
		let lib = file.match(/\$\d+/g);
		if (lib) {
			lib = lib[0].slice(1);
			file = file.replace(/\$\d+/g, prefs[sys].libs[lib]);
		}
		let tags = file.match(/\$[a-zA-Z]+/g);
		if (!tags) return file;
		let replacement = '';
		for (let tag of tags) {
			tag = tag.slice(1);
			if (tag == 'home') {
				replacement = os.homedir().replace(/\\/g, '/');
			} else if (tag == 'emu') {
				replacement = `${systemsDir}/${sys}/${emu}`;
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
