# Description

Utility for automatic generation of fallback images for the creatives.

# What it does

Fallback generator checks `manifest.json` for formats, generates a fallback image and saves it to a defined fallback path.

By default, the fallback generator will try to look for `./assets/logotype.png` image and will use it in fallback.html for image generation.

If you specify a custom HTML-file path fallback generator will open your HTML-file, resize its viewport based on the defined formats and generate an image.

# Usage

Justs run `npm run generate-fallbacks` inside the directory of creative.

Additional parameters can be added for the script using `npm run generate-fallbacks -- [flags]`

Example:

`npm run generate-fallbacks -- -b 'red'` This will change the background color to red.

Parameters description:

Parameter | Value | Description | Default value
--- | --- | --- | ---
-l, --logo [logo source] | Relative local path or  external url-src | Add logotype source. | `./assets/logotype.png`
-b, --bg [css color] | String | Add background color using css value. | 'white'
-r, --border [css color] | String | Add border color using css value. | 'black'
-h, --html [custom path] | Relative local path | Add custom HTML-file path. | `./fallback.html`

:warning: Please note. If you specify a custom HTML-file, logotype, border and background parameters won't be applied.

# Installation

This utility should be installed as dev dependency of creative.
Just run `npm install --save-dev github:tacticrealtime/fallback-generator` inside directory of creative.
Then the following script can be added to package.json:
```
"generate-fallbacks": "./node_modules/fallback-generator/generator.js",
```
After that, you can generate fallbacks for your creative by running `npm run generate-fallbacks` command.
