// Contructor Function
var Hoek = require('hoek');
var Async = require('async');
var Batch = require('./batchLayer');
var Speed = require('./speedLayer');
var JobRunner = require('./jobRunner');
var Schema = require('./schema');
var mongo = require('./mongo');
var internals = {};

exports = module.exports = internals.Lambda = function (options) {
    Hoek.assert(this.constructor === internals.Lambda, 'Lambda must be instantiated using new');
    options = Schema.assert('config', options);
    internals.options = options;
}

// Interface
internals.Lambda.prototype.insert = function(data, callback) {
    var timestamp = new Date();

    if (data.constructor === Array) {
        var n = data.length
        for(var i = 0; i<n; i++) {
            data[i]._ts = timestamp;
        }
    } else {
        data._ts = timestamp;
        data = [data];
    }

    Async.parallel({
        batchInsertData: Async.apply(Batch.insertData, data),
        speedInsertData:  Async.apply(Speed.insertData, data)
    }, callback);
}

internals.Lambda.prototype.reports = function(reports) {
    reports = Schema.assert('reports', reports);
    Async.series({
        insertReports: Async.apply(Batch.insertReports, reports),
        // addJob: Async.apply(JobRunner.addJob, reports)
    }, function(err, results){
        // Validations
        if(err) {
            throw new Error('Error inserting reports!');
        }
    });
}

internals.Lambda.prototype.batches = function(name, callback) {
    // TO DO: Validate query
    // TO DO : Validate report exists
    Async.parallel({
        batches: Async.apply(Batch.getBatches, name, {})
    }, function(err, results){
        callback(err, results.batches);
    });
}

internals.Lambda.prototype.speedAgg = function(name, callback) {
    // TO DO: Validate query
    // TO DO : Validate report exists
    Async.parallel({
        onTheFly: Async.apply(Speed.getOnTheFly, name, {})
    }, function(err, results){
        callback(err, results.onTheFly);
    });
}


internals.Lambda.prototype.reprocess = function(name, dates, callback) {
    // TO DO: Validate dates
    // TO DO : Validate report exists
    dates = dates.sort(function(a,b) {
      return a - b;
    });

    Async.each(dates, function(date, next) {
      var date_index = dates.indexOf(date);

      if(date_index +1< dates.length) {
        var from = date;
        var to = dates[date_index+1];
        var report = Batch.reports[name];
        Async.waterfall([
          Async.apply(Batch.runAgg, from, to, report),
          Batch.insertBatch
        ], function(err) {
          next(err);
        });
      } else {
        next();
      }
    }, function(err) {
      callback(err);
    });
}

internals.Lambda.prototype.start = function(callback) {
    Async.series({
        initDb: Async.apply(mongo.init, internals.options),
        initBatch: Async.apply(Batch.init, internals.options),
        initJR: Async.apply(JobRunner.init, Batch._reports)
    }, function(err, results) {
        if (err) {
            throw new Error('Unable to start lambda');
        } else {
            callback();
        }
    });
}
