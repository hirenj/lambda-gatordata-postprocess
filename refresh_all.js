'use strict';

let data_table = 'data';
let runner = require('.');

try {
    config = require('./resources.conf.json');
    data_table = config.tables.data;
    post_process_machine = config.stepfunctions.StatePostProcess;
} catch (e) {
}

const AWS = require('lambda-helpers').AWS;

if (config.region) {
  require('lambda-helpers').AWS.setRegion(config.region);
}

const get_sets = function() {
  let dynamo = new AWS.DynamoDB.DocumentClient();
  let datasetnames = dynamo.query({'TableName' : data_table,
                                 'KeyConditionExpression' : 'acc = :acc',
                                 'FilterExpression' : 'size(group_ids) > :min_size',
                                 'ProjectionExpression' : 'dataset',
                                  ExpressionAttributeValues: {
                                    ':acc': 'metadata',
                                    ':min_size' : 0
                                  }
                                  }).promise().then( (data) => data.Items.map( set => 'uploads/'+set.dataset+'/public' ) );
};

get_sets().then( sets => {
  sets.forEach( set => {
    console.log("Triggering post process for set ",set);
    runner.runPostProcess({ Key: set}, { succeed: function(){}, fail: function() {} });
  })
});