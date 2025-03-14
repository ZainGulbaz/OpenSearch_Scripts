import fs from "fs";
import axios from "axios";
import {v4 as uuidv4} from "uuid";
import csv from "csv-parser";
import "dotenv/config";

const AUTH_USERNAME = process.env.AUTH_USERNAME || "";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "";
const CHUNK_SIZE = 1000; 
const BULK_API_URL = 'https://localhost:9200/documents/_bulk';

type TBulkDataObj={
    content:String,
    summary:String,
    category:String,
    sub_category:String,
    country:String,
    city?:String,
    product_id:String,
    seller_id:String,
    seller_name:String,
    product_disabled:String,
    seller_disabled:String
} | {index?:{_id:String}};

function createBulkPayload(dataChunk:any) {
  const bulkData:TBulkDataObj[]=[];

  dataChunk.forEach((row:any) => {
    const uniqueId = uuidv4();

    if(!row.summary) return;

    bulkData.push({ index: { _id: uniqueId } });
    bulkData.push({
      content: row.seo_title,
      summary: row.summary || "",
      category: row.category,
      sub_category:row.sub_category,
      product_id:row.product_id,
      seller_id:row?.seller_id,
      seller_name:row?.seller_name,
      country:row?.country,
      seller_disabled:"false",
      product_disabled:"false"

    });
  });
  return bulkData;
}

async function sendBulkData(bulkData:any) {
  const bulkPayload = bulkData.map((doc:any) => JSON.stringify(doc)).join('\n') + '\n';

  try {
    console.error(bulkData);

    
    const response = await axios.post(
      BULK_API_URL,
      bulkPayload,
      {
        headers: { 'Content-Type': 'application/x-ndjson' },
        auth: { username: AUTH_USERNAME, password: AUTH_PASSWORD },
        httpsAgent: new (require('https')).Agent({ rejectUnauthorized: false }),
      }
    );

    if (response.data.errors) {
      console.error('Some documents failed to index:', response.data.items?.[0]?.index);
    } else {
      console.log('Batch indexed successfully');
    }
  } catch (error:any) {
    console.error('Error indexing batch:', error.message);
  }
}

async function processCsvFile() {
  const dataChunk:any = [];
  let recordCount = 0;

  fs.createReadStream('../data/products_data_one.csv')
    .pipe(csv({ headers: ['seller_name', 'seller_id', 'seo_title','summary','product_id','category','sub_category','country','city'] }))
    .on('data', (row) => {
      dataChunk.push(row);
      recordCount++;

      if (dataChunk.length === CHUNK_SIZE) {
        sendBulkData(createBulkPayload(dataChunk));
        dataChunk.length = 0; 
      }
    })
    .on('end', () => {
      if (dataChunk.length > 0) {
        sendBulkData(createBulkPayload(dataChunk));
      }
      console.log(`Finished processing ${recordCount} records.`);
    })
    .on('error', (error) => {
      console.error('Error reading CSV file:', error.message);
    });
}

processCsvFile();
