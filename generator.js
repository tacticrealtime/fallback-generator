#!/usr/bin/env node
'use strict';

const program = require('commander');

program
    .version(require('../package.json').version)
    .usage('[pathLoc]')
    .description('Specify path to directory where creative is unzipped (manifest.json must be here). By default current path is used.')
    .parse(process.argv);

const pathLoc = program.args.shift() || '.';


const puppeteer = require('puppeteer');
const fs = require('fs');
const httpServer = require('http-server');
const randomUserAgent = require('random-user-agent');
const randomId = require('random-id');
const path = require('path');

const appDir = path.dirname(require.main.filename);

const fallbackHtml = `fallback_${randomId()}.html`;
const fileExists = require('file-exists');
const jsonFile = require('jsonfile');

const tinify = require("tinify");
tinify.key = "2h3Kj4gzKF87wDBQC5yfn69j036822MD";

const net = require('net');

const config =
{
    "server": {
        "port": 8000
    },
    "puppeteer": {
        "headless": false
    }
};

let server;
let port = config.server.port;

let formatList = [];
let defaultFallback = false;

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

    if (Array.isArray(formatList)) {

        for (const format of formatList) {

            await page.setViewport({ width: format.width, height: format.height });
            console.log('Doing fallback for '+format.width+'x'+format.height);
            await page.screenshot({path: format.path, type: format.ext});

            // TinyPNG
            var source = tinify.fromFile(format.path);
            source.toFile(format.path);

        }
    }
    else {
        console.log('FormatList not found!');
    }

   // await browser.close();
};

const validateSize = function(size) {
    if (size == null || typeof size !== 'object') {
        console.log('One or more sizes are empty or not objects!');
    }
    else if (size.name == null || typeof size.name !== 'string') {
        console.log('One or more sizes have empty or missing names!');
    }
    else if (size.width == null || size.height == null) {
        console.log(`"${size.name}" format's dimensions are missing!`);
    }
    else if (size.width === " " || size.height === " " || size.width === "" || size.height === "") {
        console.log(`"${size.name}" format's dimension is an empty string!`);
    }
    else if (size.fallback == null) {
        console.log(`"${size.name}" format's 'fallback' property is missing.`);
    }
    else if (size.fallback.static == null) {
        console.log(`"${size.name}" format's 'fallback' object is missing 'static' property.`);
    }
    else if (typeof size.fallback.static !== 'string') {
        console.log(`"${size.name}" format's fallback 'static' property is not a string.`);
    }
    else if (!new RegExp("^.*\.(png|jpg)$").test(size.fallback.static.toLowerCase())) {
        console.log(`"${size.name}" Fallback generator supports only PNG and JPG image formats.`);
    }
    else {
        let filetype = path.parse(size.fallback.static).ext.replace(".", "").toLowerCase();
        
        if (filetype == 'jpg') { filetype = 'jpeg'; }
        
        let formatSize = {
            width:size.width,
            height:size.height,
            path:size.fallback.static,
            ext:filetype
        };
        formatList.push(formatSize);
    }
};

const validateFormats = function(path, manifest) {
    console.log('Starting formats validation...');

    const sizes = manifest.sizes;
    
    if (Array.isArray(sizes)) {
        try {
            sizes.forEach(function(size) {
                validateSize(size);
            });
        }
        catch (e) {
            console.log('Could not validate formats.');
        }
    }
    else {
        console.log('Formats were not found!');
    }
};

const validatePath = async function(pathLoc, imgSrc, bgColor, borderColor, fallbackPage) {
    
    console.log('Starting fallback generation...');

    if (!fallbackPage) {
        fallbackPage = appDir + '/fallback.html';
        defaultFallback = true;
    }

    pathLoc = '.';
    imgSrc = './google.png';
    bgColor = '#FFFFFF';
    borderColor = '#000000';

    const manifestFullPath = pathLoc + '/manifest.json';
    
    console.log("ffff",manifestFullPath);

    if (fileExists.sync(manifestFullPath)) {

        try {
            await validateFormats(pathLoc, jsonFile.readFileSync(manifestFullPath));

        } catch (e) {
            console.log('"manifest.json" is not valid!');
        }

        try {

            copyFallbackPage(pathLoc, fallbackPage);
            runServer(pathLoc);
            await runInBrowser(formatList, imgSrc, bgColor, borderColor);
            deleteFallbackPage(pathLoc);
            stopServer();
            console.log("FINISHED",fallbackPage);

        } catch (e) {
            console.log('Preview init error!');
        }

    }
    else {
        console.log('"manifest.json" is not found!');
    }

};

validatePath();