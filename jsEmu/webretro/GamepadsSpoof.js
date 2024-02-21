/*
 * GamepadsSpoof.js : Nostlan : quinton-ashley
 *
 * Spoofed html5 gamepad implementation.
 *
 * This implementation achieves compatibility with web based games by
 * overriding `navigator.getGamepads()` to make it return custom Gamepad
 * objects via the class GamepadsSpoof (I had to do this because
 * Gamepad objects are read only).
 * https://developer.mozilla.org/en-US/docs/Web/API/Gamepad
 */
{
	const startTime = performance.now();
	console.log('starting gamepad spoof');

	class GamepadSpoof {
		constructor(p, type) {
			this.axes = [0, 0, 0, 0, 0, 0, 0];
			this.buttons = [];
			// safari i < 14
			for (let i = 0; i < 17; i++) {
				this.buttons.push({
					pressed: false,
					touched: false,
					value: 0
				});
			}
			this.connected = true;
			this.displayId = 0;
			this.hand = '';
			this.hapticActuators = [];
			this.vibrationActuator = { type: 'dual-rumble' };
			// safari
			// this.id = '45e-2e0-Xbox Wireless Controller';
			this.id = 'Xbox One Controller (STANDARD GAMEPAD Vendor: 045e Product: 02ea)';
			this.index = p;
			this.mapping = 'standard';
			this.pose = {
				angularAcceleration: null,
				angularVelocity: null,
				hasOrientation: false,
				hasPosition: false,
				linearAcceleration: null,
				linearVelocity: null,
				orientation: null,
				position: null
			};
			this.timestamp = 1;
		}
	}

	class GamepadsSpoof {
		constructor() {
			this.gamepads = [new GamepadSpoof(0), null, null, null];

			// safari
			// this.btns = {
			// 	a: 0,
			// 	b: 1,
			// 	x: 2,
			// 	y: 3,
			// 	l: 4,
			// 	r: 5,
			// 	select: 6,
			// 	start: 7,
			// 	leftStickBtn: 8,
			// 	rightStickBtn: 9,
			// 	up: 10,
			// 	down: 11,
			// 	left: 12,
			// 	right: 13
			// };

			// chrome
			this.btns = {
				a: 0,
				b: 1,
				x: 2,
				y: 3,
				l: 4,
				r: 5,
				lt: 6,
				rt: 7,
				select: 8,
				start: 9,
				leftStickBtn: 10,
				rightStickBtn: 11,
				up: 12,
				down: 13,
				left: 14,
				right: 15,
				meta: 16
			};

			// safari
			// this.axes = {
			// 	leftStick: {
			// 		x: 0,
			// 		y: 1
			// 	},
			// 	rightStick: {
			// 		x: 2,
			// 		y: 3
			// 	},
			// 	leftTrigger: 4,
			// 	rightTrigger: 5,
			// 	dpad: 6 // firefox only
			// };

			// chrome
			this.axes = {
				leftStick: {
					x: 0,
					y: 1
				},
				rightStick: {
					x: 2,
					y: 3
				}
			};

			// safari maps the dpad to buttons 10-13
			// firefox maps axis 6 to these dpad values
			// ios safari doesn't use this
			// but I'll include this method anyway
			// to acheive better compatibility with sites
			// that might use this method
			// this.dpadVals = {
			// 	up: -1.0,
			// 	upRight: -0.7142857142857143,
			// 	right: -0.4285714285714286,
			// 	downRight: -0.1428571428571429,
			// 	down: 0.1428571428571428,
			// 	downLeft: 0.4285714285714286,
			// 	left: 0.7142857142857142,
			// 	upLeft: 1.0,
			// 	nuetral: -1.2857142857142856
			// };
		}

		addGamepad(p, type) {
			// p is port number
			// type (not implemented yet)
			console.log(`adding gamepad at port: ${p} type: ${type}`);
			this.gamepads[p] = new GamepadSpoof(p, type);
		}

		removeGamepad(p) {
			console.log(`removed gamepad idx: ${p}`);
			this.gamepads[p] = null;
		}

		updateTimestamp(p) {
			gamepadsSpoof.gamepads[p].timestamp = performance.now() - startTime;
		}

		button(p, name, val) {
			if (val) console.log(`p${p} ${name} btn pressed`);
			let btn = this.btns[name];
			// touched isn't supported in iOS Safari rn but
			// I put it anyway for possible future proofing
			// cause it's included in the latest Firefox 74
			// this hypothetically could provide support
			// for gamecube controller light button presses
			// used in games like SSB Melee to short hop with x
			gamepadsSpoof.gamepads[p].buttons[btn] = {
				pressed: val > 0.9 ? true : false,
				touched: val > 0 ? true : false,
				value: val
			};
			this.updateTimestamp(p);
		}

		dpad(p, direction) {
			console.log(`p${p} dpad ${direction}`);
			let pressed = {
				pressed: true,
				touched: true,
				value: 1
			};
			let released = {
				pressed: false,
				touched: false,
				value: 0
			};
			if (/up/i.test(direction)) {
				gamepadsSpoof.gamepads[p].buttons[10] = pressed;
			} else if (/down/i.test(direction)) {
				gamepadsSpoof.gamepads[p].buttons[11] = pressed;
			} else {
				gamepadsSpoof.gamepads[p].buttons[10] = released;
				gamepadsSpoof.gamepads[p].buttons[11] = released;
			}
			if (/left/i.test(direction)) {
				gamepadsSpoof.gamepads[p].buttons[12] = pressed;
			} else if (/right/i.test(direction)) {
				gamepadsSpoof.gamepads[p].buttons[13] = pressed;
			} else {
				gamepadsSpoof.gamepads[p].buttons[12] = released;
				gamepadsSpoof.gamepads[p].buttons[13] = released;
			}
			// firefox specific :( whoops
			// gamepadsSpoof.gamepads[p].axes[6] = this.dpadVals[direction];

			this.updateTimestamp(p);
		}

		stick(p, name, x, y) {
			console.log(`p${p} ${name} x:${x.toFixed(2)} y:${y.toFixed(2)}`);
			let xAxis = this.axes[name].x;
			let yAxis = this.axes[name].y;
			gamepadsSpoof.gamepads[p].axes[xAxis] = x;
			gamepadsSpoof.gamepads[p].axes[yAxis] = y;
			this.updateTimestamp(p);
		}

		trigger(p, name, val) {
			console.log(`p${p} ${name} val:${val.toFixed(2)}}`);
			let trigger = this.axes[name];
			gamepadsSpoof.gamepads[p].axes[trigger] = val;
			this.updateTimestamp(p);
		}
	}

	window.gamepadsSpoof = new GamepadsSpoof();

	// TODO figure out how to clone a function
	//	const getGamepads = navigator.getGamepads.bind({});
	navigator.getGamepads = function () {
		//		let gamepads = getGamepads();
		//		gamepads.push.apply(gamepadsSpoof.gamepads);
		return gamepadsSpoof.gamepads;
	};

	setTimeout(() => {
		console.log('connecting spoofed gamepad');
		let gamepadConnected = new Event('gamepadconnected', {
			bubbles: true
		});
		gamepadConnected.gamepad = gamepadsSpoof.gamepads[0];
		window.dispatchEvent(gamepadConnected);
	}, 2000);
}
