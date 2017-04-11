'use strict';
/*jshint esversion: 6, node:true */

let bucket_name = 'data';

let config = {};

let post_process_machine = 'StatePostProcess';


try {
    config = require('./resources.conf.json');
    bucket_name = config.buckets.dataBucket;
    post_process_machine = config.stepfunctions.StatePostProcess;
} catch (e) {
}

const AWS = require('lambda-helpers').AWS;
const uuid = require('uuid');

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
  return results.filter( obj => obj.bucket == bucket_name ).map( obj => { return { Key: obj.key }; } );
};

const triggerPostProcess = function(set_path) {
  let params = {
    stateMachineArn: post_process_machine,
    input: JSON.stringify(set_path),
    name: (uuid.v4().substring(0,10)+(set_path.Key.split('/')[1])).replace(/[^A-Za-z0-9]/g,'').substring(0,59)
  };
  console.log('Starting execution',params.name);
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
