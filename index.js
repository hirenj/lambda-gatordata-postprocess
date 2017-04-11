'use strict';
/*jshint esversion: 6, node:true */

let data_table = 'test-data';

let config = {};

let post_process_machine = 'StatePostProcess';


try {
    config = require('./resources.conf.json');
    post_process_machine = config.stepfunctions.StatePostProcess;
} catch (e) {
}

const AWS = require('lambda-helpers').AWS;

if (config.region) {
  require('lambda-helpers').AWS.setRegion(config.region);
}

const stepfunctions = new AWS.StepFunctions();

const extract_changed_keys = function(event) {
  if ( ! event.Records ) {
    if (event.Key) {
      return [ event ];
    } else {
      return [];
    }
  }
  let results = event.Records
  .filter( rec => rec.Sns )
  .map( rec => {
    let sns_message = JSON.parse(rec.Sns.Message);
    return { bucket: sns_message.Bucket, key: sns_message.Key };
  });
  results = [].concat.apply([],results);
  return results.filter( obj => obj.bucket == bucket_name ).map( obj => obj.key );
};

const triggerPostProcess = function(set_path) {
  let params = {
    stateMachineArn: split_queue_machine,
    input: JSON.stringify({ Key: set_path }),
    name: ('PostProcess '+set+(new Date()).toString()).replace(/[^A-Za-z0-9]/g,'_')
  };
  return stepfunctions.startExecution(params).promise();
};

const runPostProcess = function(event,context) {
  let datasets = extract_changed_keys(event);
  Promise.all(datasets.map( set_path => triggerPostProcess(set_path) ))
  .then( () => context.succeed({'status': 'OK' }))
  .catch( err => {
    console.log(err);
    context.fail({'status' : err.message });
  });
};

exports.runPostProcess = runPostProcess;
