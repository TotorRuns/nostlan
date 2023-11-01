## Building the App

If you're on an Intel Mac, change `build.mac.target.arch` to `x64`.

Run the rebuild script for your OS:

Linux: `npm run rebuild-l`
macOS Intel: `npm run rebuild-mi`
macOS ARM: `npm run rebuild-m`
Windows: `npm run rebuild-w`

Then run the distribute command for your OS:

Linux: `npm run dist-l`
macOS: `npm run dist-m`
Windows: `npm run dist-w`

The resulting build will be in the `dist` folder.

## Update a Database

```bash
nostlan --db up --sys switch
```

The resulting file will be in the `sys` folder in the respective system's folder.

## Change Electron Version

Manually change `build.electronVersion` in `package.json` to the latest version.

<https://github.com/electron/electron/releases/latest>

Also change the electron target in the rebuild scripts for the native module "sharp" used for fast image processing.
