if (!process.env.NODE_ENV) {
	require('dotenv').config({path: './.env'});
}

var fs = require('fs');
var url = require('url');

var _ = require('underscore');
var moment = require('moment-timezone');
var Q = require('kew');
var request = require('superagent');
var csv = require('csvtojson');
var async = require('async');

//var OUTPUT_CSV_FILE = process.env.FULL_SURVEY_CSV_FILE || "./fullData.csv";
var OUTPUT_JSON_FILE = process.env.FULL_SURVEY_JSON_FILE || "./fullData.json";

//OUTPUT_CSV_FILE = fs.openSync(OUTPUT_CSV_FILE, 'w');
OUTPUT_JSON_FILE = fs.openSync(OUTPUT_JSON_FILE, 'w');

var LBApi = {
	"host": process.env.LBAPI_HOST,
	"headers" : {
		"Content-Type": "application/json"		
	},
	"auth": {
		user: process.env.LBAPI_AUTH_ID,
		password: process.env.LBAPI_AUTH_SECRET
	}
}

var augmentSurveyData = function(aSurveyResultsCsvFileName) {
	return dataAsJson(aSurveyResultsCsvFileName).then(function(surveyData) {
		console.log("Survey Data Length: " + surveyData.length);
		return addInfoForBookings(surveyData).then(function(surveyDataWithApiInfo) {
			console.log("Extended Data Length: " + surveyDataWithApiInfo.length);
			return populateOutputFiles(surveyDataWithApiInfo);
		});
	})

	.fail(function(exception) {
		console.error(exception);
		return Q.reject(exception);
	});
}

var populateOutputFiles = function(surveyDataWithApiInfo) {
	fs.writeSync(OUTPUT_JSON_FILE, JSON.stringify(surveyDataWithApiInfo));
	return surveyDataWithApiInfo;
}

var addInfoForBookings = function(surveyJSON) {
	var deferred = Q.defer();

	async.eachOfLimit(surveyJSON, 5, fetchInfo, function(error) {
		if (error) {
			console.error(error);
			return Q.reject(error);
		}
		return deferred.resolve(surveyJSON);
	});

	return deferred.promise;
}

var fetchInfo = function(aSurveyObject, index, callback) {
	//console.log(index + " " + aSurveyObject.booking_id);
	if (index % 100 == 0) {
		console.log(index + " entries extended");
	}
	request
	.get(LBApi.host + "/bookings/" + aSurveyObject.booking_id)
	.set(LBApi.headers)
	.auth(LBApi.auth.user, LBApi.auth.password)
	.end(function(err, res) {
		if (err) {
			console.error(err);
			console.error("error for booking " + aSurveyObject.booking_id);
			callback();
		} else {
			var aBooking = res.body;
			aSurveyObject.bookingType = aBooking.inventory.bookingType;
			aSurveyObject.lounge = aBooking.inventory.loungeId;
			aSurveyObject.paymentSource = aBooking.payment.source;		
			
			request
			.get(LBApi.host + "/lounges")
			.query({
				bookingLoungeId: aSurveyObject.lounge
			})
			.set(LBApi.headers)
			.auth(LBApi.auth.user, LBApi.auth.password)
			.end(function(err, res) {
				if (err) {
					console.error(error);
					console.error("error for booking " + aSurveyObject.booking_id);
					callback();
				} else {
					var aLounge = res.body[0];
					aSurveyObject.IATA = (aLounge && aLounge.airport) ? aLounge.airport.IATA : undefined;
					aSurveyObject.city = (aLounge && aLounge.airport) ? aLounge.airport.location.city : undefined;
					aSurveyObject.state = (aLounge && aLounge.airport) ? aLounge.airport.location.stateCode : undefined;
					aSurveyObject.country = (aLounge && aLounge.airport) ? aLounge.airport.location.countryCode: undefined;
					aSurveyObject.category = (aLounge && aLounge.category) ? aLounge.category.name : "unknown";
					aSurveyObject.airside = (aLounge && aLounge.location && aLounge.location.airside) ? 1 : 0;
					aSurveyObject.loungeRating = (aLounge && aLounge.rating != undefined) ? aLounge.rating.avg : 0;
					if (aLounge) {
						_.each(aLounge.amenities, function(anAmenity) {
							aSurveyObject["has" + anAmenity.id.replace('-','_')] = 1;
						});
					}
					delete aSurveyObject.booking_id;
					callback();
				}
			});
		}
	});
}

var dataAsJson = function(aSurveyResultsCsvFileName) {
	var deferred = Q.defer();

	var jsonArray = [];

	csv().fromFile(aSurveyResultsCsvFileName)
	.on('json', (jsonObject) => {
		
		//modify csv data
		delete jsonObject.start_survey;
		if (jsonObject['returning'] == 'false') jsonObject['returning'] = 0;
		if (jsonObject['returning'] == 'true') jsonObject['returning'] = 1;
		_.each(jsonObject, function(value, key) {
			if (!isNaN(parseInt(value, 10)) && key != "booking_id") {
				jsonObject[key] = parseInt(value, 10);
			}
		});

		
		jsonArray.push(jsonObject);
	})
	.on('done', (error) => {
		if (error) {
			console.error(error);
			return deferred.reject(error);
		}
		console.log("Survey file read");
		return deferred.resolve(jsonArray);
	});

	return deferred.promise;
}



var DataFetcher = {
	augmentSurveyData: augmentSurveyData
};

module.exports = DataFetcher;
