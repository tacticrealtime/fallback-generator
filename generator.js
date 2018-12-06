#!/usr/bin/env node
'use strict';

const program = require('commander');

program
    .version(require('./package.json').version)
    .option('-l, --logo [logo source]', 'Add logotype source.', './assets/logotype.png')
    .option('-b, --bg [css color]', 'Add background color.', 'white')
    .option('-r, --border [css color]', 'Add border color.', 'black')
    .option('-h, --html [custom path]', 'Add custom fallback.html path.', './fallback.html')
    .parse(process.argv);

const puppeteer = require('puppeteer');
const fs = require('fs');
const httpServer = require('http-server');
const randomUserAgent = require('random-user-agent');
const randomId = require('random-id');
const path = require('path');
const chalk = require('chalk');
const appDir = path.dirname(require.main.filename);
const rootPath = '.';

const fallbackHtml = `fallback_${randomId()}.html`;
const fileExists = require('file-exists');
const jsonFile = require('jsonfile');

const tinify = require('tinify');
tinify.key = "2h3Kj4gzKF87wDBQC5yfn69j036822MD";

const net = require('net');
const urlExists = require('url-exists');

const config =
{
    "waitingTime": {
        "insert": 100
    },
    "server": {
        "port": 8000
    },
    "puppeteer": {
        "headless": true
    }
};

let server;
let port = config.server.port;

let formatList = [];
let defaultFallback = false;


const printStatus = function(status) {
    console.log(chalk.cyan(status));
};

const printError = function(status) {
    console.log(chalk.red(status));
};

const printWarning = function(status) {
    console.log(chalk.yellow(status));
};

const printLog = function(log) {
    console.log(chalk.green(log));
};

function getAvailablePort (startingAt) {

    function getNextAvailablePort (currentPort, cb) {
        const server = net.createServer();
        server.listen(currentPort, _ => {
            server.once('close', _ => {
                cb(currentPort)
            });
            server.close()
        });
        server.on('error', _ => {
            getNextAvailablePort(++currentPort, cb)
        })
    }

    return new Promise(resolve => {
        getNextAvailablePort(startingAt, resolve)
    })
}

const copyFallbackPage = function (path, fallbackPage) {
    fs.copyFileSync(fallbackPage, path + '/' + fallbackHtml);
};

const deleteFallbackPage = function (path) {
    fs.unlinkSync(path + '/' + fallbackHtml);
};

const runServer =  async function (path) {
    server = httpServer.createServer({cors:true, root:path});
    port = await getAvailablePort(8000);
    server.listen(port);
};

const stopServer = function () {
    server.close();
};

const runInBrowser = async function(formatList, imgSrc , bgColor, borderColor) {

    const browser = await puppeteer.launch({headless:config.puppeteer.headless, args: ['--no-sandbox']});
    const page = await browser.newPage();

    page.setUserAgent(randomUserAgent());

    await page.goto(`http://localhost:${port}/${fallbackHtml}`, {waitUntil:'networkidle2'});

    if (defaultFallback) {
        await page.evaluate((imgSrc, bgColor, borderColor) => {
            var elem = document.createElement("img");
            document.getElementById("container").appendChild(elem);
            elem.src = imgSrc;
            document.body.style.backgroundColor = bgColor;
            document.querySelector(".border").style.borderColor = borderColor;
        }, imgSrc, bgColor, borderColor);
    }

    await page.waitFor(config.waitingTime.insert);

    if (Array.isArray(formatList)) {

        for (const format of formatList) {

            await page.setViewport({ width: format.width, height: format.height });
            printLog('Working on fallback for '+format.width+'x'+format.height);

            let dir = path.dirname(format.path);

            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir);
            }
            
            await page.screenshot({path: format.path, type: format.ext});

            var source = tinify.fromFile(format.path);
            source.toFile(format.path);

        }
    }
    else {
        printError('FormatList not found!');
    }

    await browser.close();
};

const validateSize = function(size) {
    if (size == null || typeof size !== 'object') {
        printError('One or more sizes are empty or not objects!');
    }
    else if (size.name == null || typeof size.name !== 'string') {
        printError('One or more sizes have empty or missing names!');
    }
    else if (size.width == null || size.height == null) {
        printError(`"${size.name}" format's dimensions are missing!`);
    }
    else if (size.width === " " || size.height === " " || size.width === "" || size.height === "") {
        printError(`"${size.name}" format's dimension is an empty string!`);
    }
    else if (size.width.toString().includes("%") || size.height.toString().includes("%")) {
        printWarning(`Skipping "${size.name}" because dimensions can't be percentage.`);
    }
    else if ( !/^\d+$/.test(size.width.toString()) || !/^\d+$/.test(size.height.toString()) ) {
        printWarning(`Skipping "${size.name}" because dimensions are not integers.`);
    }
    else if (size.fallback == null) {
        printError(`"${size.name}" format's 'fallback' property is missing.`);
    }
    else if (size.fallback.static == null) {
        printError(`"${size.name}" format's 'fallback' object is missing 'static' property.`);
    }
    else if (typeof size.fallback.static !== 'string') {
        printError(`"${size.name}" format's fallback 'static' property is not a string.`);
    }
    else if (!new RegExp("^.*\.(png|jpg)$").test(size.fallback.static.toLowerCase())) {
        printError(`"${size.name}" Fallback generator supports only PNG and JPG image formats.`);
    }
    else {
        let filetype = path.parse(size.fallback.static).ext.replace(".", "").toLowerCase();

        if (filetype == 'jpg') filetype = 'jpeg';

        let formatSize = {
            width:parseInt(size.width),
            height:parseInt(size.height),
            path:size.fallback.static,
            ext:filetype
        };
        formatList.push(formatSize);
    }
};

const validateFormats = function(manifest) {
    printStatus('Starting formats validation...');

    const sizes = manifest.sizes;

    if (Array.isArray(sizes)) {
        try {
            sizes.forEach(function(size) {
                validateSize(size);
            });
        }
        catch (e) {
            printError('Could not validate formats.');
        }
    }
    else {
        printError('Formats were not found!');
    }
};

const validatePath = async function(imgSrc, bgColor, borderColor, fallbackPage) {

    printStatus('Validating paths and attributes...');

    let relativeImgSrc = './' + path.relative(process.cwd(), appDir);

    if (!fileExists.sync(fallbackPage)) {
        fallbackPage = appDir + '/res/fallback.html';
        defaultFallback = true;
        printWarning('fallback.html is not found, using default instead.');

        if (imgSrc.indexOf("http://") == 0 || imgSrc.indexOf("https://") == 0) {

            await urlExists(imgSrc, function(err, exists) {
                if (!exists) {
                    imgSrc = relativeImgSrc + '/res/logo.svg';
                    printWarning('Invalid link source, using default instead.');
                }
            });

        } else {

            if (!fileExists.sync(imgSrc)) {
                imgSrc = relativeImgSrc + '/res/logo.svg';
                printWarning('Local logotype source is not found, using default instead.');
            }
        }

    }

    const manifestFullPath = './manifest.json';

    if (fileExists.sync(manifestFullPath)) {

        try {
            await validateFormats(jsonFile.readFileSync(manifestFullPath));

        } catch (e) {
            printError('"manifest.json" is not valid!');
        }

        try {

            copyFallbackPage(rootPath, fallbackPage);
            runServer(rootPath);
            await runInBrowser(formatList, imgSrc, bgColor, borderColor);
            deleteFallbackPage(rootPath);
            stopServer();

            printStatus('Generation is finished.');

        } catch (e) {
            printError('Preview init error!');
        }

    }
    else {
        printError('"manifest.json" is not found!');
    }

};

validatePath(program.logo , program.bg , program.border, program.html);