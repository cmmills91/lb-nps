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

var K = 2;
var A = .001;

var initW = .0001;
var initV = .0001;

var w_int = 0;
var w = []; //length = features + 1
var V = []; //prime index is row; prime.length = n; secondary.length = k; this is an nxk matrix

var getColumn = function(matrix, f) {
	var columnVector = [];
	_.each(matrix, function(aRow) {
		columnVector.push(aRow[f]);
	});
	return columnVector;
}

var multiplyVectors = function(v1, v2) {
	if (v1.length != v2.length) {
		console.log("Invalid dimensions; v1, v2: " + v1.length + " " + v2.length);
	}
	var sum = 0;
	_.each(v1, function(anEntry, index) {
		/*if (v1[index] != 0) {
			console.log("nonzero!!");
		}*/
		/*if (v1[index] * v2[index] != 0) {
			console.log("nonzero!!", v1[index], v2[index]);
		}*/
		sum += (v1[index] * v2[index]);
	});
	/*if (sum > 0) {
		console.log("sum is nonzero", sum);
	} else {
		console.log("sum to be returned from mult", sum);
	}*/
	return sum;
}

var squareVector = function(vector) {
	var squaredVector = [];
	_.each(vector, function(anEntry) {
		squaredVector.push(anEntry*anEntry);
	});
	return squaredVector;
}

var initializeWeights = function(featureVectors) {
	var oneV = [];
	for (var index=0; index<K; index++) {
		oneV.push(initV)
	}
	
	var vector = featureVectors[0];
	_.each(_.keys(vector), function(aKey) {
		w.push(initW);
		V.push(_.clone(oneV));
	});
	console.log("w.len " + w.length);
	console.log("V.len " + V.length)
}

// grad = 1 if w is w_0
var updateInterceptWeight = function (predictedScore, realScore, updateIntercept) {
	updateIntercept += /*w_int*/ -A * (predictedScore - realScore) * (1);
	return updateIntercept;
	//console.log(w_int);
}

// grad = x_i if w is w_i
var updateLinearWeights = function(predictedScore, realScore, aVector, updateW) {
	_.each(w, function(weight, index) {
		/*if (index < 1) {
			console.log("weight, predicted, real", index, weight, predictedScore, realScore, aVector[index]);
		}*/

		updateW[index] += /*w[index]*/ -A * (predictedScore - realScore) * (aVector[index]);
		//updateW[index] += w[index] - A * (aVector[index]);
		if (index == 0) console.log(updateW[index]);
	});
	//console.log(w);
	return updateW;
}

// grad = x_i (sum v_j,f*x_j - v_i,f*x_i^2) if w is v_i,f
var updatePairwiseWeights = function(predictedScore, realScore, aVector, updateV) {
	for (var f=0; f<K; f++) {
		var colF = _.clone(getColumn(V, f));
		for (var i=0; i<w.length; i++) {
			var indepTerm = multiplyVectors(colF, aVector);
			//var grad = aVector[i] * (indepTerm - V[i][f]*aVector[i]^2);
			var grad = aVector[i] * indepTerm - /*w.length*/V[i][f]*Math.pow(aVector[i],2);
			if(i == 1) console.log(f,i,grad);
			updateV[i][f] += /*V[i][f]*/ -A * (predictedScore - realScore) * grad;
			//updateV[i][f] += V[i][f] - A * grad;
			//console.log("typeof Pscore, Rscore, grad", typeof predictedScore, typeof realScore, typeof grad);
			//console.log("V type", typeof updateV[i][f]);
		}
	}
	return updateV;
}

var addScalar = function(s1, s2, batchSize) {
	//console.log(s1, s2, s1-s2);
	return s1+s2/batchSize;
}

var addVector = function(v1, v2, batchSize) {
	var result = [];
	_.each(v1, function(anEntry, index) {
		result.push(v1[index]+v2[index]/batchSize);
	});
	console.log(result);
	return result; 
}

var addMatrix = function(m1, m2, batchSize) {
	_.each(m1, function(aRow, i) {
		_.each(aRow, function(aCol, j) {
			//console.log(m1[i][j], m2[i][j]);
			//console.log(typeof m2[i][j]);
			m1[i][j] = m1[i][j]+m2[i][j]/batchSize;
		});
	});
	return m1;
}

//weight - alpha * (prediction-result) * piecewise grad
// grad = 1 if w is w_0
// grad = x_i if w is w_i
// grad = x_i (sum v_j,f*x_j) - v_i,f*x_i^2 if w is v_i,f
var learnWeights = function(featureVectors, y) {
	for (var iter=0; iter < 2; iter++) {
		
		var updateIntercept = 0;
		var updateV = [];
		var updateVRow = [];
		var updateW = [];
		for (var index=0; index<K; index++) {
			updateVRow.push(0)
		}
		var vector = featureVectors[0];
		_.each(_.keys(vector), function(aKey) {
			updateW.push(0);
			updateV.push(_.clone(updateVRow));
		});

		_.each(featureVectors, function(aFeatureVectorObject, index) {
			//if (index > 200) return;
			var aFeatureVector = _.toArray(aFeatureVectorObject);
			if (aFeatureVector.length != w.length) {
				console.log("** Index with <w.len @ " + index);
				return;
			}
			console.log("#" + index + " (" + iter + ")");
			var predictedScore = predictScore(aFeatureVector);
			console.log("Predicted, Real", predictedScore, y[index]);
			updateIntercept = updateInterceptWeight(predictedScore, y[index], updateIntercept);
			updateLinearWeights(predictedScore, y[index], aFeatureVector, updateW);
			updatePairwiseWeights(predictedScore, y[index], aFeatureVector, updateV);
			var batchSize = 100;
			if (index % batchSize == 0) {
				w_int = addScalar(w_int, updateIntercept, batchSize);
				console.log(updateW);
				w = _.clone(addVector(w, updateW, batchSize));
				V = addMatrix(V, updateV, batchSize);
				
				updateIntercept = 0;
				updateV = [];
				updateVRow = [];
				updateW = [];
				for (var index=0; index<K; index++) {
					updateVRow.push(0)
				}
				vector = featureVectors[0];
				_.each(_.keys(vector), function(aKey) {
					updateW.push(0);
					updateV.push(_.clone(updateVRow));
				});	
			}
		});
		/*w_int = addScalar(w_int, updateIntercept);
		console.log(updateW);
		w = addVector(w, updateW);
		V = addMatrix(V, updateV);*/
	}
};

//(over k) (vTx)^2 - (v^2)T(x^2)
var factorizedPairwiseWeights = function(aVector) {
	var sum = 0;
	for (var f=0; f<K; f++) {
		//console.log(getColumn(V, f));
		//console.log(aVector);
		var termOne = Math.pow(multiplyVectors(getColumn(V, f), aVector), 2);
		//console.log("termOne", termOne);
		var termTwo = multiplyVectors(squareVector(getColumn(V, f)), squareVector(aVector));
		//console.log("termTwo", termTwo);
		sum += (termOne + termTwo);
		//console.log("sum", sum);
	}
	//console.log("returned sum", sum);
	return sum;
}

//w_0 + wTx + 1/2 (over k) (vTx)^2 - (v^2)T(x^2)
var predictScore = function(aVector) {
	var intercept = w_int;
	var linear = multiplyVectors(w, aVector);
	var pairwise = factorizedPairwiseWeights(aVector);
	console.log("Intercept + Linear + Pairwise", intercept, linear, pairwise);
	return (intercept + linear + .5*pairwise);
}

var fitModelToData = function(featureVectors) {
	var y = _.pluck(featureVectors, "nps_rating");
	_.each(featureVectors, function(aFeatureVectorObject) {
		delete aFeatureVectorObject.nps_rating;
		delete aFeatureVectorObject.value;
		delete aFeatureVectorObject.likely_to_use_again;
	});
	initializeWeights(featureVectors);
	learnWeights(featureVectors, y);
	fs.openSync("./outputW.json", 'w');
	fs.openSync("./outputV.json", 'w');
	fs.openSync("./outputFeatures.json", 'w');
	fs.writeFileSync("./outputW.json", JSON.stringify(w));
	fs.writeFileSync("./outputV.json", JSON.stringify(V));
	fs.writeFileSync("./outputFeatures.json", JSON.stringify(_.keys(featureVectors[0])));
	//SGD
	/*_.each(featureVectors, function(aFeatureVectorObject, index) {
		//console.log("key len " + _.keys(aFeatureVectorObject).length)
		var aFeatureVector = _.toArray(aFeatureVectorObject);
		if (aFeatureVector.length != w.length) {
			console.log("** Index with <w.len @ " + index);
			return;
		}
		console.log("#" + index);
		//console.log("to Array len " + aFeatureVector.length);
		var predictedScore = predictScore(aFeatureVector);
		updateWeights(predictedScore, y[index], aFeatureVector);
	});*/
}

var FM = {
	train: fitModelToData
};

module.exports = FM;

var data = JSON.parse(fs.readFileSync('./fullVectorizedData.json', {encoding: 'utf8'}));
FM.train(data);