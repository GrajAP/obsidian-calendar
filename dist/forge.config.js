"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const maker_squirrel_1 = require("@electron-forge/maker-squirrel");
const maker_zip_1 = require("@electron-forge/maker-zip");
const maker_deb_1 = require("@electron-forge/maker-deb");
const maker_rpm_1 = require("@electron-forge/maker-rpm");
const plugin_vite_1 = require("@electron-forge/plugin-vite");
const plugin_fuses_1 = require("@electron-forge/plugin-fuses");
const fuses_1 = require("@electron/fuses");
const config = {
    packagerConfig: {
        asar: true,
    },
    rebuildConfig: {},
    makers: [
        new maker_squirrel_1.MakerSquirrel({}),
        new maker_zip_1.MakerZIP({}, ['darwin']),
        new maker_rpm_1.MakerRpm({}),
        new maker_deb_1.MakerDeb({}),
    ],
    plugins: [
        new plugin_vite_1.VitePlugin({
            // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
            // If you are familiar with Vite configuration, it will look really familiar.
            build: [
                {
                    // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
                    entry: 'src/main.ts',
                    config: 'vite.main.config.ts',
                    target: 'main',
                },
                {
                    entry: 'src/preload.ts',
                    config: 'vite.preload.config.ts',
                    target: 'preload',
                },
            ],
            renderer: [
                {
                    name: 'main_window',
                    config: 'vite.renderer.config.ts',
                },
            ],
        }),
        // Fuses are used to enable/disable various Electron functionality
        // at package time, before code signing the application
        new plugin_fuses_1.FusesPlugin({
            version: fuses_1.FuseVersion.V1,
            [fuses_1.FuseV1Options.RunAsNode]: false,
            [fuses_1.FuseV1Options.EnableCookieEncryption]: true,
            [fuses_1.FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [fuses_1.FuseV1Options.EnableNodeCliInspectArguments]: false,
            [fuses_1.FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [fuses_1.FuseV1Options.OnlyLoadAppFromAsar]: true,
        }),
    ],
};
exports.default = config;
//# sourceMappingURL=forge.config.js.map