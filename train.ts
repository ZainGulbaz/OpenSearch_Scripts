import fs from "fs";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import csv from "csv-parser";
import "dotenv/config";

const AUTH_USERNAME = process.env.AUTH_USERNAME || "";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "";
const CHUNK_SIZE = 1000;
const BULK_API_URL = "https://localhost:9200/documents/_bulk";


function createBulkPayload(dataChunk: any) {
  const bulkData: any[] = [];

  dataChunk.forEach((row: any) => {
    const uniqueId = uuidv4();

    // if (!row.productSummary) return;

    if(!row.productName) return;

    bulkData.push({ index: { _id: uniqueId } });
    bulkData.push({
      seller_id: row.productSellerId,
      is_sample: row.isSample,
      product_id: row.productId,
      sub_category: row.productSubCategory,
      seller_disabled: row.sellerDisabled,
      country: row.productCountry,
      summary: row.productSummary || "None",
      seller_name: row.productSellerName,
      product_disabled: row.productDisabled,
      content: row.productName || "None",
      category: row.productCategory
    });
  });
  return bulkData;
}

async function sendBulkData(bulkData: any) {

  const bulkPayload = bulkData.map((doc: any) => JSON.stringify(doc)).join("\n") + "\n";

  try {
    const response = await axios.post(BULK_API_URL, bulkPayload, {
      headers: { "Content-Type": "application/x-ndjson" },
      auth: { username: AUTH_USERNAME, password: AUTH_PASSWORD },
      httpsAgent: new (require("https")).Agent({ rejectUnauthorized: false })
    });

    if (response.data.errors) {
      console.error("Some documents failed to index:", response.data.items?.[0]?.index);
    } else {
      console.log("Batch indexed successfully");
    }
  } catch (error: any) {
    console.error("Error indexing batch:", error.message);
  }
}

async function processCsvFile() {
  const dataChunk: any = [];
  let recordCount = 0;

  fs.createReadStream("./data/first_65000.csv")
    .pipe(
      csv({
        headers: [
          "productSellerId",
          "isSample",
          "productId",
          "productSubCategory",
          "sellerDisabled",
          "productCountry",
          "productSummary",
          "productSellerName",
          "productDisabled",
          "productName",
          "productCategory"
        ]
      })
    )
    .on("data", (row) => {
      dataChunk.push(row);
      recordCount++;

      if (dataChunk.length === CHUNK_SIZE) {
        // sendBulkData(createBulkPayload(dataChunk));
        // dataChunk.length = 0;
      }
    })
    .on("end", () => {
      if (dataChunk.length > 0) {
        sendBulkData(createBulkPayload(dataChunk.slice(40000,50000)));
      }
      console.log(`Finished processing ${recordCount} records.`);
    })
    .on("error", (error) => {
      console.error("Error reading CSV file:", error.message);
    });
}

processCsvFile();
