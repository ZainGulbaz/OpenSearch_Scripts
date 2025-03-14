import Axios from "axios";
import "dotenv/config";
import { delay, requestConfig } from "./utils";
import * as fs from "fs";

const axios = Axios.create(requestConfig);

class OpenSearchManager {
  private baseUrl: string;
  private modelId: string;

  constructor(baseUrl: string, modelId: string) {
    this.baseUrl = baseUrl;
    this.modelId = modelId;
  }

  async deployHuggingFaceSentenceTransformer(){
    try{
      console.error("Deploying Hugging Face Sentence Transformer");

      const response = await axios.post(`${this.baseUrl}/_plugins/_ml/models/_register`,{
        "name": "huggingface/sentence-transformers/msmarco-distilbert-base-tas-b",
        "version": "1.0.0",
        "model_format": "TORCH_SCRIPT"
    });

    console.error("Response ",response.data);

    }
    catch(error:any){
      console.error("Error in deploying hugging face sentence transformer");
      console.error(error);
    }
  }

  async createModel(): Promise<void> {
    try{

    console.error(this.baseUrl,"Base URL==============================================");

    const response = await axios.post(`${this.baseUrl}/_plugins/_ml/models/_register`, {
      "name": "huggingface/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
      "model_format": "TORCH_SCRIPT",
      // "model_group_id":"TNypt5QBiK6ycIbuwJ17"
      "version": "1.0.1",
    });
    console.info(response.data);
  }
  catch(error:any){
    console.error("Error in creating the model");
    console.error(error?.response?.data?.error || error);
  }
  }

  // async createModel(): Promise<void> {
  //   try {
  //     console.error(this.baseUrl, "Base URL==============================================");
  
  //     const response = await axios.post(`${this.baseUrl}/_plugins/_ml/models/_register`, {
  //       "name": "all-MiniLM-L6-v2",  // Built-in OpenSearch model
  //       "model_group_id": "sentence-transformers",
  //       "version": "1.0.0",
  //       "description": "Built-in OpenSearch MiniLM model",
  //       "deploy_model": true
  //     });
  
  //     console.info(response.data);
  //   } catch (error: any) {
  //     console.error("Error in creating the model");
  //     console.error(error?.response?.data?.error || error);
  //   }
  // }
  

  async createLabseModel(): Promise<void> {
    const response = await axios.post(`${this.baseUrl}/_plugins/_ml/models/_register`, {
      "name": "sentence-transformers/LaBSE",
      "version": "1.0.1",
      "model_format": "TORCH_SCRIPT"
    });
    console.info(response.data);
  }

  async checkTasKProgess(taskId: string) {
    console.log("checking task progress...");
    const response = await axios.get(`${this.baseUrl}/_plugins/_ml/tasks/${taskId}`);
    console.error(response.data);
  }

  async deployModel(): Promise<void> {
    const res = await axios.post(`${this.baseUrl}/_plugins/_ml/models/${this.modelId}/_deploy`);
    console.info("deploy model response", res.data);
  }

  async unDeployModel(modelId:string): Promise<void> {
    await axios.post(`${this.baseUrl}/_plugins/_ml/models/${modelId}/_undeploy`);
    console.log("Model un deployed successfully.");
  }


  async checkPipelineStatus(){
    const response= await axios.get(`${this.baseUrl}/_ingest/pipeline`);
    console.error(JSON.stringify(response.data));
  }

  async createEmbeddingIngestPipeline(): Promise<void> {
    console.log("Creating embedding ingest pipeline...");
    await axios.put(`${this.baseUrl}/_ingest/pipeline/embedding-ingest-pipeline`, {
      description: "Multilingual Neural Search Pipeline with Content and Summary Embeddings",
      processors: [
        {
          text_embedding: {
            model_id: process.env.MODEL_ID,
            field_map: {
              content: "content_embedding",
              summary: "summary_embedding",
            },
          },
        },
      ],
    });
    console.log("Embedding ingest pipeline created.");
  }

  async deleteIngestPipelines(){
    const response= await axios.delete(`${this.baseUrl}/_ingest/pipeline/embedding-ingest-pipeline`);
    console.error("Deleting ingest pipline");
    console.error(response.data);
  }

  async createHybridSearchPipeline(): Promise<void> {
    console.log("Creating hybrid search pipeline...");
    await axios.put(`${this.baseUrl}/_search/pipeline/hybrid-search-pipeline`, {
      phase_results_processors: [
        {
          "normalization-processor": {
            normalization: {
              technique: "min_max",
            },
            combination: {
              technique: "arithmetic_mean",
              parameters: {
                weights: [0.2, 0.7, 0.1],
              },
            },
          },
        },
      ],
    });
    console.log("Hybrid search pipeline created.");
  }

  // async createHybridSearchPipeline(): Promise<void> {
  //   console.log("Creating hybrid search pipeline...");
  //   await axios.put(`${this.baseUrl}/_search/pipeline/hybrid-search-pipeline`, {
  //     phase_results_processors: [
  //       {
  //         "normalization-processor": {
  //           normalization: {
  //             technique: "min_max",
  //           },
  //           combination: {
  //             technique: "arithmetic_mean",
  //             parameters: {
  //               weights: [0.3, 0.3, 0.2, 0.2],
  //             },
  //           },
  //         },
  //       },
  //     ],
  //   });
  //   console.log("Hybrid search pipeline created.");
  // }

  async deleteIndex(indexName: string): Promise<void> {
    console.log(`Deleting index: ${indexName}...`);
    try {
      await axios.delete(`${this.baseUrl}/${indexName}`);
      console.log(`Index ${indexName} deleted successfully.`);
    } catch (err: any) {
      if (err.response?.status === 404) {
        console.log(`Index ${indexName} does not exist. Skipping deletion.`);
      } else {
        throw err;
      }
    }
  }

  async reindexData(baseUrl: string, sourceIndex: string, destinationIndex: string) {
    try {
      // Ensure the destination index exists before reindexing
      console.log(`Creating destination index: ${destinationIndex}...`);
      await axios.put(`${baseUrl}/${destinationIndex}`, {
        settings: {
          analysis: {
            analyzer: {
              arabic_analyzer: {
                tokenizer: "standard",
                filter: ["lowercase", "arabic_normalization", "stemmer"],
              },
            },
          },
        },
        mappings: {
          properties: {
            arabic_field: {
              type: "text",
              analyzer: "arabic", // Arabic analyzer
            },
            content: { type: "text" },
          },
        },
      });

      console.log("Reindexing data...");
      const response = await axios.post(`${baseUrl}/_reindex`, {
        source: { index: sourceIndex },
        dest: { index: destinationIndex },
      });

      console.log("Reindexing completed:", response.data);
    } catch (error: any) {
      console.error("Error during reindexing:", error.response?.data || error.message);
    }
  }

  async explainCluster(){
    const response= await axios.get(`${this.baseUrl}/_cluster/allocation/explain?pretty`);
    console.info(response.data);
  }

  async  clusterHealth(){
    let response= await axios.get(`${this.baseUrl}/_cluster/health`);
    console.info(response.data);

    response= await axios.get(`${this.baseUrl}/_cluster/settings`);

    console.info(JSON.stringify(response.data));
  }

  async refreshCluster(){
    let response = await axios.get(`${this.baseUrl}/_refresh`);
    console.error(response.data);
  }


  async createSnapshot(
    repositoryName: string, 
    snapshotName: string, 
    indices: string = 'documents',  
    waitForCompletion: boolean = true
  ) {
    try {
      // Step 1: Check if the repository already exists
      const repoExistsResponse = await axios.get(`${this.baseUrl}/_snapshot/${repositoryName}`)
        .catch(() => null); 
  
      if (!repoExistsResponse) {
        console.info('Repository does not exist. Creating...');
        // Step 2: Create the snapshot repository with mounted backup directory
        const repositoryResponse = await axios.put(`${this.baseUrl}/_snapshot/${repositoryName}`, {
          type: 'fs',
          settings: {
            location: '/mnt/backups', // Use the mounted backup directory
            compress: true
          }
        });
        console.info('Snapshot repository created:', repositoryResponse.data);
      } else {
        console.info('Snapshot repository already exists.');
      }
  
      // Step 3: Create the snapshot
      const snapshotResponse = await axios.put(
        `${this.baseUrl}/_snapshot/${repositoryName}/${snapshotName}?wait_for_completion=${waitForCompletion}`,
        {
          indices: indices,
          ignore_unavailable: true,  // Ignore unavailable indices
          include_global_state: false  // Exclude cluster state
        }
      );
  
      console.info('Snapshot creation initiated successfully:', snapshotResponse.data);
  
      if (waitForCompletion) {
        console.info('Snapshot completed successfully:', snapshotResponse.data.snapshot);
      } else {
        console.info('Snapshot creation is in progress. Check status later.');
      }
  
    } catch (error: any) {
      console.error('Error creating snapshot:', error.response ? error.response.data : error.message);
      if (error.response?.status === 404) {
        console.error('Ensure the repository path is correctly configured.');
      }
      throw error;  // Re-throw the error for upstream handling
    }
  }

  

  async createIndex(indexName: string): Promise<void> {
    console.log(`Creating index: ${indexName}...`);
    await axios.put(`${this.baseUrl}/${indexName}`,{
      "settings": {
        "index.knn": true,
        "index.number_of_shards": 3,
        "index.number_of_replicas": 1,
        "index.refresh_interval": "30s",
        "default_pipeline": "embedding-ingest-pipeline",
        "index.search.default_pipeline": "hybrid-search-pipeline",
        "index.query.default_field": "content",
        "analysis": {
          "analyzer": {
            "custom_standard": {
              "type": "standard",
              "stopwords": "_english_"
            }
          }
        }
      },
      "mappings": {
        "properties": {
          "content_embedding": {
            "type": "knn_vector",
            "dimension": 384,
            "method": {
              "name": "hnsw",
              "space_type": "cosinesimil",
              "engine": "nmslib",
              "parameters": {
                "ef_construction": 128,
                "m": 16
              }
            }
          },
          "summary_embedding": {
            "type": "knn_vector",
            "dimension": 384,
            "method": {
              "name": "hnsw",
              "space_type": "cosinesimil",
              "engine": "nmslib",
              "parameters": {
                "ef_construction": 128,
                "m": 16
              }
            }
          },
          "content": { "type": "text", "analyzer": "custom_standard" },
          "summary": { "type": "text", "analyzer": "custom_standard" },
          "category": { "type": "keyword" },
          "seller_name": { "type": "text", "analyzer": "custom_standard" },
          "sub_category": { "type": "keyword" },
          "seller_id": { "type": "keyword" },
          "country": { "type": "keyword" },
          "seller_disabled": { "type": "text" },
          "product_disabled": { "type": "text" },
          "product_id": { "type": "keyword" },
          "is_sample": { "type": "text" },
          "delivery_countries": { "type": "keyword" },
          "tags": { "type": "keyword" },
          "is_online":{"type":"keyword"}
        }
      }
    }
    );
    console.log(`Index ${indexName} created successfully.`);
  }

  async getTotalDocumentsCount(indexName: String) {
    // const response2= await axios.get(`${this.baseUrl}/${indexName}/_count`);
    const response = await axios.get(`${this.baseUrl}/_cat/count/${indexName}?v`)
    console.log(response.data);
  }

  containsArabic(text: string): boolean {
    const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+/;
    return arabicRegex.test(text);
  }

  // Perform a search query
  async performSearch(indexName: string,query:string="apples"): Promise<void> {


    let translatedQuery: string = query;

    const matchQueries=[{ match: { content: { query , boost:60} } }];

    if (this.containsArabic(query)) {
      console.error("we have arabic");
      
      // const translationResponse = await Axios.post("http://127.0.0.1:5678/translate", { "target": "ar", "text": query }, {
      //   headers: {
      //     "Content-Type": "application/json"
      //   }
      // });
      //   translatedQuery = translationResponse?.data?.translated_text;
        // matchQueries[0]["match"]["content"]["boost"]=40;
        // matchQueries.push({ match: { content: { query:translatedQuery, boost: 20 } } })

    }

    console.log(`Performing search on index: ${indexName}...`);
    console.error(`${this.baseUrl}/${indexName}/_search`);

    // const filterQuery={
    //   _source: ["content","country"],
    //   // _source: ["content", "country"],
    //   query: {
    //     bool: {
    //       should: [
    //         ...matchQueries,
    //         {
    //           neural: {
    //             content_embedding: {
    //               query_text: translatedQuery,
    //               model_id: process.env.MODEL_ID,
    //               boost: 30,
    //               k: 3
    //             },
    //           },
    //         },
    //         // {
    //         //   neural: {
    //         //     summary_embedding: {
    //         //       query_text: translatedQuery,
    //         //       model_id: this.modelId,
    //         //       boost: 10,
    //         //       k: 1
    //         //     },
    //         //   },
    //         // },
    //       ],
    //       minimum_should_match: 1,
    //     },
    //   },
    // }

    const sellerFilterQuery={
      "_source": ["content", "product_id"],
      "size": 50,
      "query": {
        "bool": {
          "must": [
            {
              "bool": {
                "should": [
                  { "match": { "content": { "query": "<query>", "operator": "or", "boost": 40 } } },
                  { "match_phrase": { "content": { "query": "<query>", "boost": 40 } } },
                  { "neural": { "content_embedding": { "query_text": "<query>", "model_id": "<model_id>", "k": 10, "boost": 30 } } },
                  { "match": { "summary": { "query": "<query>", "operator": "or", "boost": 8 } } }
                ],
                "minimum_should_match": 1
              }
            }
          ],
          "filter": [
            { "term": { "seller_id": "<seller_id>" } }
          ]
        }
      }
    }
    

    // console.error(JSON.stringify(sellerFilterQuery));

    query= "Apple";

    

    const response = await axios.post(`${this.baseUrl}/${indexName}/_search`,{
      "_source": ["content", "country"],
      "size": 50,
      "query": {
        "bool": {
          "should": [
            { "match": { "content": { "query": query, "operator": "or", "boost": 40 } } },
            { "match_phrase": { "content": { "query": query, "boost": 40 } } },
            { "neural": { "content_embedding": { "query_text": query, "model_id": process.env.MODEL_ID|| "", "k": 10, "boost": 30 } } },
            { "neural": { "summary_embedding": { "query_text": query, "model_id": process.env.MODEL_ID|| "", "k": 10, "boost": 20 } } },
            { "match": { "summary": { "query": query, "operator": "or", "boost": 8 } } }
          ],
          "minimum_should_match": 1,
          "filter": [
            // { "terms": { "country": ["es"] } },
            { "terms": { "delivery_countries": ["PK","EG"] } },
            {"terms":{"tags":["Hair"]}},
            {"terms":{"product_type":["online_conferences"]}}

          ]
        }
      },
      "rescore": {
        "window_size": 50,
        "query": {
          "rescore_query": {
            "bool": {
              "should": [
                // { "terms": { "country": ["es"] } }
              ]
            }
          },
          "query_weight": 0.8,
          "rescore_query_weight": 1.2
        }
      },
      // "pipeline": "hybrid-search-pipeline"
    },{timeout: 60000});
    

    const products = response.data?.hits?.hits?.map((doc: any) => doc._source)

    console.error(products?.filter((product: any) => product.country));

  }
  async searchAll(size = 3) {
    const response = await axios.post(`${this.baseUrl}/documents/_search?size=${size}`, {

      query: {
        match_all: {}
      }

    });

    const products = response.data?.hits?.hits?.map((doc: any) => doc._source);
    type Product = {
      country: string;
      [key: string]: any;
    };

    const new_products: any[] = [];

    for (const product of products as Product[]) {

      if (product.country !== "es") continue;
      new_products.push(product);
    }

    console.info(new_products);

  }

  async  getAllDeployedModels(): Promise<void> {
    try {
        const response = await axios.post(`${this.baseUrl}/_plugins/_ml/models/_search`,{
          "query": {
            "match_all": {}
          },
          "size": 1000
        });

        const models:string[]=[];
         response.data?.hits?.hits?.map((model:any)=>{
          const state = model?._source?.model_state; 
          console.error(state,model?._id);

          if(model?._id==process.env.MODEL_ID) return;
          models.push(model?._id as string);
        });

        console.info("Original Length:",response?.data?.hits?.hits?.length);
        console.info("After Length",models?.length);

        // for(const model of models){
        //   console.info("Deleting the model",model);
        //   await this.deleteModel(model);
        //   console.info("Deleted the model",model);
        //   console.info("--->>>>");

        // }


    } catch (error:any) {
        console.error("Error fetching deployed models:", error.response?.data || error.message);
    }
}

async deleteModel(modelId:string){
  try{
    console.error("Deleting the model......");
    const response= await axios.delete(`${this.baseUrl}/_plugins/_ml/models/${modelId}`);
    console.info(response.data);
    console.error("Model is deleted:",modelId);

  }
  catch(error:any){
    console.error("Error in deleting the model");
    console.log(error?.response?.data?.error || error);
  }
}

async registerModelGroup(){
  try{
    const response= await axios.post(`${this.baseUrl}/_plugins/_ml/model_groups/_register`,{
      "name": "wjl model group",
      "description": "A model group for wjl models"
    });
    console.info(response.data);
  }
  catch(error:any){
    console.error("Error in registerinng the model Group");
    console.error(error);
  }
}


  async disableSettings() {
    const response = await axios.put(`${this.baseUrl}/_cluster/settings`, {
      "persistent": {
        "plugins.ml_commons.only_run_on_ml_node": false
      }
    });
    console.error(response);
  }

  async stressTest(){
    try{
      const testQueries=["Apple","Banna","Mango","Car","Mobile"];

      const failedQueries=[];
      

      for(let i=0; i<50 ; i++){
        const randomTestIndex = (Math.floor(Math.random() * 10/2));
        console.error(randomTestIndex);

        const query=testQueries[randomTestIndex];

        console.error(query);
        
        try{

          await this.performSearch("documents",);
        }
        catch(error:any){
          await this.refreshCluster();
          console.error("Error in performing search",query);
          console.error(error?.response?.data?.error || error);
          failedQueries.push(query);
        }
      }


      console.error("Failed Queries");
      console.error(failedQueries);

    }
    catch(error:any){
      console.error("Error in stress testing");
      console.error(error);
    }
  }

  async checkPlugins(){
    const response = await axios.get(`${this.baseUrl}/_cat/plugins?v`);
    console.error(response);
  }

  async getAllIndex(){
    const response = await axios.get(`${this.baseUrl}/_cat/indices?v`);
    console.error(response.data);
  }

  async checkJVM(){
    const response= await axios.get(`${this.baseUrl}/_nodes/stats/jvm?pretty`);
    console.error(JSON.stringify(response.data));
  }

  async modifyReplicaCount(){
    const response= await axios.put(`${this.baseUrl}/documents-new/_settings`,{
      "number_of_replicas":1
    });
    console.info(response.data);
  }

  async sampleQuery(){
    const response = await axios.get(`${this.baseUrl}/_cat/shards/documents-new?v`);
    console.error(JSON.stringify(response.data));
  }

  async forceAllocateShards(){
    const response= await axios.post(`${this.baseUrl}/_cluster/reroute`,  {
      "commands":[{
      "allocate_empty_primary": {
        "index": "documents-new",
        "shard": 0,
        "node": "documents-new",
        "accept_data_loss": true
      }}]
    });
    console.error(response.data);
  }

  async run(): Promise<void> {
    try {

      const indexName = "documents";  

      // await this.unDeployModel(process.env.MODEL_ID || "");
      // await this.deployModel();

      // console.info("Waiting for the model to be deployed....");
      // await delay({ ms: 10000 });

      // await this.createEmbeddingIngestPipeline();
      // await this.createHybridSearchPipeline();
      // await this.deleteIndex(indexName);
      // await this.createIndex(indexName);
      // console.info("The model has been configured and deployed :)");

      // for (let i=0; i<1000 ; i++){

      // await this.performSearch(indexName);
      
      // }
      // await this.refreshCluster();

      // await this.forceAllocateShards();

      // await this.modifyReplicaCount();
      // await this.sampleQuery();

      // await this.checkJVM();

      // await this.checkPipelineStatus();

      // await this.deleteIngestPipelines();

      // await this.getAllIndex();
      // await this.getAllDeployedModels();

      // await this.deployHuggingFaceSentenceTransformer();

      // await this.unDeployModel("MujJqpMBabmGyOuOdIJY");
      // await this.deleteModel("Udytt5QBiK6ycIbuL53G");

      
      // await this.searchAll(1); 

      

      // const multiIndex="documents-multi";
      // // await this.createMultiIndex(multiIndex);
      // // await this.reindexDocuments();
      // await this.performSearchMulti(multiIndex,"جزرة");    

      // await this.disableSettings();
      // await this.createModel();
      // this.checkTasKProgess("qGwqjpUBDHxay7nLxjaG");
      // await this.checkPlugins();

      // this.getAllDeployedModels();

      // this.registerModelGroup();


      // await this.disableSettings();
      // await this.createModel();

      // await this.registerModelGroup();

      // await this.createSnapshot("my_backup_repo", "snapshot_2024_02_03");

      // await this.forceAllocateShards();
      // await this.explainCluster();

      // await this.reindexDocuments();

      // await this.createIndex("documents");

      // await this.deleteIndex("documents");

      // this.createModel();

      // await this.getTotalDocumentsCount(indexName);
      // await this.clusterHealth();

      // await this.performSearch("documents");

      // await this.customQuery();


      // await this.modifyReplicaCount();

      // await this.stressTest();

      // await this.customQuery();

      // await this.performSearch(indexName);


    }
    catch (error: any) {
      console.error("Error in runing the script");
      console.error(error.response?.data?.error || error.response || error);
    }

  }

  async getEmbeddings(queryText:string){
    const embeddingResponse = await axios.post(
      `${this.baseUrl}/_ml/models/${process.env.MODEL_ID}/_infer`,
      {
        docs: [{ text_field: queryText }]
      }
    );

    return embeddingResponse.data;
  }


  async customQuery(){
    const response= await axios.post(`${this.baseUrl}/documents/_analyze`,{
      "analyzer": "custom_standard",
      "text": "fuji apple"
    });
    console.error(JSON.stringify(response.data));
  }


  async reindexDocuments() {
    try {
      const response = await axios.post(`${this.baseUrl}/_reindex`, {
        source: {
          index: "documents-new",
        },
        dest: {
          index: "documents",
        },
      });
      console.log(`Reindexing completed: ${response.data}`);
    } catch (error) {
      console.error(`Error during reindexing: ${error}`);
    }
  }

  async saveAllDocumentsToFile(baseUrl: string, indexName: string, filePath: string): Promise<void> {

    console.error(baseUrl, indexName, filePath);

    console.log(`Fetching all documents from index: ${indexName}...`);
    try {
      const initialResponse = await axios.post(`${baseUrl}/${indexName}/_search?scroll=1m`, {
        size: 1000,
        query: { match_all: {} },
      });

      let scrollId = initialResponse.data._scroll_id;
      const documents = initialResponse.data.hits.hits;

      console.log(`Fetched ${documents.length} documents in the first batch.`);

      while (true) {
        const scrollResponse = await axios.post(`${baseUrl}/_search/scroll`, {
          scroll: "1m",
          scroll_id: scrollId,
        });

        let hits = scrollResponse.data.hits.hits;
        scrollId = scrollResponse.data._scroll_id;

        console.log(`Fetched ${hits.length} more documents.`);
        hits = hits.map((hit: any) => ({ name: hit._source?.content?.split("|")?.[0], embedding: hit?._source?.content_embedding }));
        documents.push(...hits);

        if (hits.length === 0) break;
      }

      console.log(`Total documents fetched: ${documents.length}.`);

      fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));
      console.log(`All documents have been saved to file: ${filePath}`);
    } catch (error: any) {
      console.error("Error while fetching or saving documents:", error.response?.data || error.message || error);
    }
  }

}

(async () => {
  const baseUrl = "https://localhost:9200";
  const modelId = process.env.MODEL_ID || "null";
  const manager = new OpenSearchManager(baseUrl, modelId);
  await manager.run();
})();

