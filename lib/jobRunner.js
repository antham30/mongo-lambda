// REPORT RUNNER
var Async = require('async');

var Batch = require('./batchLayer');
var Speed = require('./speedLayer');


var CronJob = require('cron').CronJob;

var internals = {};

module.exports.init = function (options, callback) {
    callback(null);
};

internals.runJob = function(report){
    Async.series({
        batchScrub: Async.apply(Batch.scrubData),
        batchRunReport: Async.apply(Batch.runReport, report),
        speedScrub: Speed.scrubData
    }, function(err, results){
        console.log("CRON JOB: ", results);
    });
}

exports.addJob = internals.addJob = function (report, next) {
    new CronJob(report.cron, function() {
        // TO DO: add output term to agg pipeline
        internals.runJob(report)

        // run mongo agg
    }, null, true, report.timezone);

    next();
}