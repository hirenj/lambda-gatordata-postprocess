'use strict';

let data_table = 'data';
let runner = require('.');
let config = null;

try {
    config = require('./resources.conf.json');
    data_table = config.tables.data;
} catch (e) {
}

const AWS = require('lambda-helpers').AWS;

if (config.region) {
  require('lambda-helpers').AWS.setRegion(config.region);
}

const get_sets = function() {
  let dynamo = new AWS.DynamoDB.DocumentClient();
  console.log(data_table);
  let datasetnames = dynamo.query({'TableName' : data_table,
                                 'KeyConditionExpression' : 'acc = :acc',
                                 'FilterExpression' : 'size(group_ids) > :min_size',
                                 'ProjectionExpression' : 'dataset',
                                  ExpressionAttributeValues: {
                                    ':acc': 'metadata',
                                    ':min_size' : 0
                                  }
                                  }).promise().then( (data) => {
                                    console.log(data);
                                    return data.Items.map( set => 'uploads/'+set.dataset+'/public' );
                                  });
  return datasetnames;
};

get_sets().then( sets => {
  console.log(sets);
  sets.forEach( set => {
    console.log("Triggering post process for set ",set);
    runner.runPostProcess({ Key: set}, { succeed: function(){}, fail: function() {} });
  })
}).catch( err => {
  console.log("Problem");
  console.log(err);
});