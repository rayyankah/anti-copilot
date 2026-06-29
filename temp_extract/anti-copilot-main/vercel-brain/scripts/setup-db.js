const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb');
require('dotenv').config({ path: '.env.local' });

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const params = {
  TableName: process.env.DYNAMODB_TABLE_NAME || 'anti-copilot-telemetry',
  KeySchema: [
    { AttributeName: 'pk', KeyType: 'HASH' }, // Partition key
    { AttributeName: 'sk', KeyType: 'RANGE' }, // Sort key
  ],
  AttributeDefinitions: [
    { AttributeName: 'pk', AttributeType: 'S' },
    { AttributeName: 'sk', AttributeType: 'S' },
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5,
  },
};

async function createTable() {
  try {
    const command = new CreateTableCommand(params);
    const response = await client.send(command);
    console.log('Table created successfully:', response.TableDescription.TableName);
  } catch (err) {
    if (err.name === 'ResourceInUseException') {
      console.log('Table already exists.');
    } else {
      console.error('Error creating table:', err);
    }
  }
}

createTable();
