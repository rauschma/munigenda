#!/usr/bin/env babel-node

/* global process */
/* global __dirname */

import * as fs from 'fs';
import * as path from 'path';
import * as stream from 'stream';

import handlebars from 'handlebars';
import csv from 'csv-streamify';

const TEMPLATE = handlebars.compile(fs.readFileSync(process.argv[2], 'utf8'));

let parser = csv({ delimiter: '\t' },
	function (err, doc) {
		if (err) {
			console.log(err);
			return;
		}
		processLines(doc);	
	});

streamToString(process.stdin,
	processStdin,
	function failure(err) {
		console.log('ERROR', err);
	});

function processStdin(str) {
	checkForQuotes(str);
	// Start parsing
	stringToStream(str).pipe(parser);
}

const QUOTE = `"`;
/**
 * The parser removes unescaped quotes inside cells. Warn about that.
 */
function checkForQuotes(str) {
	if (str.startsWith(QUOTE)) {
		str = str.slice(QUOTE.length);
	}
	if (str.endsWith(QUOTE)) {
		str = str.slice(0, -QUOTE.length);
	}
	str = str.replace(new RegExp(String.raw`\t${QUOTE}`, 'g'), '');
	str = str.replace(new RegExp(String.raw`${QUOTE}\t`, 'g'), '');
	if (str.includes(QUOTE)) {
		console.log(`WARNING: there is an unescaped quote (${QUOTE}) inside a cell. It will be removed.`);
		console.log(`Change to something else (e.g. a curly quote) if that’s a problem.`);
	}
}

function streamToString(readable, success, failure) {
    readable.setEncoding('utf8');
    var data = '';
    readable.on('data', function (chunk) {
        data += chunk;
    });
    readable.on('end', function () {
        success(data);
    });
    readable.on('error', function (err) {
        failure(err);
    });
}
function stringToStream(str) {
    var readable = new stream.Readable();
    // Needed so that there is no crash in REPL (v0.10.26)
    readable._read = function noop() {};
    readable.push(str);
    readable.push(null); // close
	return readable;
}

function processLines(rows) {
	let colTitles = rows.shift();
	
	let columnTitleToProperty = [
		['Talk title', 'title'],
		['Talk description', 'description'],
		['Length of the talk', 'duration'],
		['Speaker name', 'speaker'],
		['Speaker description', 'bio'],
		['URL of personal page', 'personalPage'],
	];
	let cellIndexToProperty = columnTitleToProperty.map(
		function ([columnTitle, property]) {
			let cellIndex = colTitles.indexOf(columnTitle);
			if (cellIndex < 0) {
				throw new Error(`Missing column title: ${columnTitle}`);
			}
			return [cellIndex, property];
		});
	let data = {};
	rows = rows.filter(row => row.length > 0);
	data.talks = rows.map(function (row) {
		let obj = {};
		for (let [cellIndex, property] of cellIndexToProperty) {
			obj[property] = row[cellIndex];
		}
		checkRowData(obj);
		return obj;
	});
	// console.log(JSON.stringify(data, null, 4));
	console.log(TEMPLATE(data));	
}
const DURATION_REGEX = /^[0-9]+min$/;
function checkRowData(obj) {
	if (!DURATION_REGEX.test(obj.duration)) {
		console.log(`WARNING: talk duration ${obj.duration} does not match regex ${DURATION_REGEX}`);
	}
}


