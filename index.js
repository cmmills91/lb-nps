var DataFetcher = require("./LBDataFetcher");
var Vectorizer = require("./JSONFeatureVectorizer");

function main() {
	DataFetcher.augmentSurveyData(process.env.DATA_SOURCE).then(function(fullData) {
		var fieldsToVectorize = [
			"reason",
			"flight_frequency",
			"found_lb_via",
			"sites_consulted",
			"part_of_trip",
			"booking_channel",
			"currency",
			"bookingType",
			"lounge",
			"paymentSource",
			"IATA",
			"city",
			"state",
			"country",
			"category"
		];
		var featureSet = Vectorizer.vectorize(fullData, fieldsToVectorize);
		console.log("Feature Set Length: " + featureSet.length);
	});
}

main();