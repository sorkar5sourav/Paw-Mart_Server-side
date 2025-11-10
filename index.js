const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const cors = require("cors");
app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion } = require("mongodb");

const uri =
  "mongodb+srv://Paw-Mart-admin:NDkReapXwKPdMobB@cluster0.dddm4vc.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const database = client.db("Paw-Mart-Listing");
    const listingsCollection = database.collection("Listings");

    app.get("/listings", async (req, res) => {
      const result = await listingsCollection.find().toArray();
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("🚀 Server is running...Just Fine");
});

app.listen(port, () => {
  console.log(`✅ Server running on old port ${port}`);
});

//
