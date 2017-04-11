'use strict';

let data_table = 'data';
let runner = require('.');
let config = null;
let post_process_machine = null;

try {
    config = require('./resources.conf.json');
    data_table = config.tables.data;
    post_process_machine = config.stepfunctions.StatePostProcess;
} catch (e) {
}

const AWS = require('lambda-helpers').AWS;
const stepfunctions = new AWS.StepFunctions();

if (config.region) {
  require('lambda-helpers').AWS.setRegion(config.region);
}

const get_sets = function() {
  let dynamo = new AWS.DynamoDB.DocumentClient();
  console.log(data_table);
  let datasetnames = dynamo.query({'TableName' : data_table,
                                 'KeyConditionExpression' : 'acc = :acc',
                                 'FilterExpression' : 'size(group_ids) > :min_size',
                                 'ProjectionExpression' : 'dataset,group_ids',
                                  ExpressionAttributeValues: {
                                    ':acc': 'metadata',
                                    ':min_size' : 0
                                  }
                                  }).promise().then( (data) => {
                                    return data.Items.map( set => 'uploads/'+set.dataset+'/'+set.group_ids.values[0] );
                                  });
  return datasetnames;
};

let get_running_executions = function() {
  var params = {
    stateMachineArn: post_process_machine,
    maxResults: 10,
    statusFilter: 'RUNNING'
  };
  return stepfunctions.listExecutions(params).promise().then(data => {
    return data.executions.length;
  });
};

let wait_a_bit = function() {
  return new Promise( (resolve) => {
    setTimeout(resolve,1000);
  });
};

let looper = function(sets) {
  return get_running_executions().then( executions => {
    if (executions > 0) {
      return wait_a_bit().then(looper.bind(null,sets));
    }
    console.log(sets);
    let to_add = sets.splice(0,10);
    to_add.forEach( set => {
      console.log("Triggering post process for set ",set);
      runner.runPostProcess({ Key: set }, { succeed: function(){}, fail: function() {} });
    });
    if (sets.length > 0) {
      return wait_a_bit().then(looper.bind(null,sets));
    } else {
      return;
    }
  });
};

get_sets().then( sets => sets.filter(set => set.indexOf('glycoproteome') >= 0 ) ).then(looper).catch( err => {
  console.log("Problem");
  console.log(err);
});