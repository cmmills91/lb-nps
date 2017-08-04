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

//var OUTPUT_VECTORIZED_CSV_FILE = process.env.VECTORIZED_CSV_FILE || "./fullVectorizedData.csv";
var OUTPUT_VECTORIZED_JSON_FILE = process.env.VECTORIZED_JSON_FILE || "./fullVectorizedData.json";

//OUTPUT_VECTORIZED_CSV_FILE = fs.openSync(OUTPUT_VECTORIZED_CSV_FILE, 'w');
OUTPUT_VECTORIZED_JSON_FILE = fs.openSync(OUTPUT_VECTORIZED_JSON_FILE, 'w');


var AMENITY_FEATURES = [
	"hasLOUNGEBUDDY_CHECKIN",
	"hasNON_SMOKING",
	"hasSMOKING_ROOMS",
	"has21_CARDHOLDER",
	"has18_CARDHOLDER",
	"hasBEER_WINE_FREE",
	"hasBEER_WINE",
	"hasWIFI_FREE",
	"hasWIFI",
	"hasSPIRITS_LIQUOR_FREE",
	"hasSPIRITS_LIQUOR",
	"hasPREMIUM_FOOD",
	"hasPREMIUM_FOOD_FREE",
	"hasPRINTERS_FREE",
	"hasPRINTERS",
	"hasCONFERENCE_ROOMS_FREE",
	"hasCONFERENCE_ROOMS",
	"hasSHOWERS_FREE",
	"hasSHOWERS",
	"hasSPA_FREE",
	"hasSPA",
	"hasPRIVATE_ROOMS_FREE",
	"hasPRIVATE_ROOMS",
	"hasGYM_FREE",
	"hasGYM",
	"hasSHOE_SHINE",
	"hasUPSCALE_DRESS_CODE",
	"hasCLOTHES_PRESS_FREE",
	"hasCHILDREN_ROOMS",
	"hasINTERNET_TERMINALS",
	"hasFLIGHT_MONITORS",
	"hasTV",
	"hasTELEPHONES",
	"hasNEWSPAPERS",
	"hasSNACKS_FREE"
];

var vectorizeJson = function(jsonData, specifiedFields) {
	var featureNameSet = new Set();

	_.each(jsonData, function(aFeatureDictionary) {
		
		_.each(specifiedFields, function(aField) {
			var value = aFeatureDictionary[aField];
			var newFeatureName = aField + "=" + value;
			if (!featureNameSet.has(newFeatureName)) featureNameSet.add(newFeatureName);
			aFeatureDictionary[newFeatureName] = 1;
			delete aFeatureDictionary[aField];
		});
	
	});
	var featureNameList = Array.from(featureNameSet);
	_.each(jsonData, function(aFeatureDictionary) {
		_.each(featureNameList, function(aFeatureName) {
			if (aFeatureDictionary[aFeatureName] == undefined) {
				aFeatureDictionary[aFeatureName] = 0;
			}
		});
		_.each(AMENITY_FEATURES, function(anAmenityFeature) {
			if (aFeatureDictionary[anAmenityFeature] == undefined) {
				aFeatureDictionary[anAmenityFeature] = 0;
			}
		});
	});

	fs.writeSync(OUTPUT_VECTORIZED_JSON_FILE, JSON.stringify(jsonData));

	return jsonData;
}


var FeatureVectorizer = {
	vectorize: vectorizeJson
}

module.exports = FeatureVectorizer;