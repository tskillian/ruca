var request = require('superagent');
var parse = require('csv-parse');
var fs = require('fs');
var async = require('async');

var URL = 'https://geomap.ffiec.gov/FFIECGeocMap/GeocodeMap1.aspx/GetGeocodeData';

var HEADERS = {
	Accept: "application/json, text/javascript, */*; q=0.01",
	"Content-Type": "application/json; charset=UTF-8",
	Cookie: "BIGipServergeomap.ffiec.gov.app~geomap.ffiec.gov_pool=2638334084.20480.0000",
	Origin: "https://geomap.ffiec.gov",
	Referer: "https://geomap.ffiec.gov/FFIECGeocMap/GeocodeMap1.aspx",
	"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36"
};

var PAYLOAD = JSON.stringify({sSingleLine: "1601 Brenner Avenue Salisbury NC", iCensusYear: "2012"});

var output = [['station#','address','lat','long','FIPS_address','FIPS_latlong', 'RUCA_address','RUCA_latlong', 'U/R/H']]; // column headers
var fipsToRUCA = {};
var numFound = 0;
var numNotFound = 0;

// State-County FIPS Code,Select State,Select County,State-County-Tract FIPS Code (lookup by address at http://www.ffiec.gov/Geocode/),Primary RUCA Code 2010,"Secondary RUCA Code, 2010","Tract Population, 2010","Land Area (square miles), 2010","Population Density (per square mile), 2010"
fs.readFile('ruca2010 (2).csv', function (err, data) {
	data = data.toString();
	var parts = data.split('\r');
	console.log(parts.length);
	for (var i = 1; i < parts.length; i++) {
		var row = parts[i].split(',');
		fipsToRUCA[row[3]] = row[5];
	}
	console.log(fipsToRUCA);
	// 'VAST2012_addressXY_novetcentersMVC.csv'
	// stationid,stationnumber,stationname,address1,address2,address3,address4,city,state,zip,lat,long_
	fs.readFile('VAST2012_addressXY_novetcentersMVC_revisedlatlong.csv', function (err, data) {
		if (err) { throw err; }
		var data = data.toString();
		// console.log(data); 
		// console.log(data.indexOf('\r'))
		var parts = data.split('\r');
		// console.log(parts.length);
		console.log(parts.length);
		var eachCbCount = 0;
		console.log('SHOULD GET ' + parts.slice(1).length + ' EACHCB COUNT');
		async.eachLimit(parts.slice(1), 10, function (part, eachCb) {
			var fields = part.split(',');
			var stationNumber = fields[1];
			var lat = fields[10];
			var lng = fields[11];
			var address = fields[4] + ' ' + fields[5] + ' ' + fields[6] + ' ' + fields[7] + ' ' + fields[8] + ' ' + fields[9];
			// console.log(address);
			var payload = {
				sSingleLine: address,
				iCensusYear: "2012"
			};
			getFIPSWithAddress(JSON.stringify(payload), function (FIPS) {
				console.log('FIPS')
				console.log(FIPS);
          var rowOutput = [];
          rowOutput.push(stationNumber);
          rowOutput.push(address);
          rowOutput.push(lat);
          rowOutput.push(lng);
          rowOutput.push(FIPS);
					numFound++;
					//output.push([stationNumber, address, lat, lng, FIPS, fipsToRUCA[FIPS]]);
					eachCbCount++;
					console.log('EACHCBCOUNT')
					console.log(eachCbCount)
					getFIPSWithLatLong(lat, lng, function (FIPSFromLatLong) {
						console.log('GOTFIPS WITH LATLONG:')
						console.log(FIPSFromLatLong);
            rowOutput.push(FIPSFromLatLong);
            rowOutput.push(fipsToRUCA[FIPS]);
            rowOutput.push(fipsToRUCA[FIPSFromLatLong]);
						//output.push([stationNumber, address, lat, lng, FIPSFromLatLong, fipsToRUCA[FIPSFromLatLong] || '']);
						eachCbCount++;
						console.log('EACHCBCOUNT')
						console.log(eachCbCount)
            output.push(rowOutput);
						if (FIPSFromLatLong.length === 11 || FIPS.length === 11) {
							numFound++;
						} else {
							numNotFound++;
						}
						eachCb();
					});

			});
		}, function (err) {
			if (err) { throw err; }
			console.log('NUMFOUND: ' + numFound);
			console.log('NUMNOTFOUND: ' + numNotFound);

			var outputAsStrings = [];
			for (var i = 0; i < output.length; i++) {
				outputAsStrings.push(output[i].join(','));
			}

			fs.writeFile('output.csv', outputAsStrings.join('\n'), function (err) {
				if (err) { throw err; }
				console.log('COMPLETE YO');
			});
		});
	});
});

// station#,address,lat,long,FIPS,RUCA,U/R/H
// fs.readFile('output.csv', function (err, data) {
// 	if (err) { throw err; }
// 	data = data.toString();
// 	var parts = data.split('\n');
// 	console.log(parts);
// 	for (var i = 0; i < parts.length; i++) {
// 		var row = parts[i].split(',');
// 		console.log('RUCA')
// 		var ruca = row[5].trim();
// 		console.log(ruca);
// 		if (ruca.length === 0) {
// 			// get ruca shit
// 		}
// 	}
// })

function getFIPSWithAddress(payload, callback) {
	request
		.post(URL)
		.send(payload)
		.set('Accept', HEADERS.Accept)
		.set('Content-Type', HEADERS["Content-Type"])
		.set('Cookie', HEADERS.Cookie)
		.set('Origin', HEADERS.Origin)
		.set('Referer', HEADERS.Referer)
		.set('User-Agent', HEADERS['User-Agent'])
		.end(function (err, response) {
			if (err) {
				throw err;
			}
			console.log(response.body);
			var data = response.body.d;
			var FIPS = data.sStateCode + data.sCountyCode + data.sTractCode.replace('.', '');
			console.log(FIPS.length);
			callback(FIPS);
		});
}

function getFCCAPIURL(lat, lng) {
	return 'http://data.fcc.gov/api/block/2010/find?latitude=' + lat + '&longitude=' + lng + '&format=json';
}

getFIPSWithLatLong(46.8791, -68.0105, function (FIPS) {
	console.log('FIPS')
	console.log(FIPS);
});

function getFIPSWithLatLong(lat, lng, callback) {
	request
		.get(getFCCAPIURL(lat, lng))
		.end(function (err, response) {
			if (err) { throw err; }
			if (response.statusCode === 200) {
				var fullFIPS = response.body.Block.FIPS;
				if (response.body.Block.FIPS) {
					var FIPS = fullFIPS.slice(0,11);
					return callback(FIPS);
				}
			}

			callback('');
		});
}
