const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const serviceAccount = require("./Paw-mart_serviceKey.json");
require("dotenv").config();

// Initialize Firebase Admin with service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("Missing MONGODB_URI environment variable");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({
      message: "unauthorized access. Token not found!",
    });
  }

  const token = authorization.split(" ")[1];
  try {
    await admin.auth().verifyIdToken(token);

    next();
  } catch (error) {
    res.status(401).send({
      message: "unauthorized access.",
    });
  }
};

async function run() {
  try {
    // await client.connect();

    const database = client.db("Paw-Mart-Listing");
    const listingsCollection = database.collection("Listings");
    const ordersCollection = database.collection("Orders");

    app.get("/listings", async (req, res) => {
      const result = await listingsCollection
        .find()
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    });

    // Create a new listing
    app.post("/listings", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await listingsCollection.insertOne(data);
      res.send({
        success: true,
        result,
      });
    });

    // Get single listing by ID (singular endpoint)
    app.get("/listing/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const objectId = new ObjectId(id);
      const result = await listingsCollection.findOne({ _id: objectId });
      res.send({
        success: true,
        result,
      });
    });

    // Update a listing
    app.put("/listings/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const data = req.body;
      const objectId = new ObjectId(id);
      const filter = { _id: objectId };
      const update = {
        $set: data,
      };
      const result = await listingsCollection.updateOne(filter, update);
      res.send({
        success: true,
        result,
      });
    });
    // Create a new order
    app.post("/orders", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await ordersCollection.insertOne(data);
      res.send({
        success: true,
        result,
      });
    });

    // Get orders by user email
    app.get("/orders", verifyToken, async (req, res) => {
      const { email } = req.query;
      const result = await ordersCollection.find({ email }).toArray();
      res.send(result);
    });

    // Delete an order
    app.delete("/orders/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const objectId = new ObjectId(id);
      const result = await ordersCollection.deleteOne({ _id: objectId });
      res.send({
        success: true,
        result,
      });
    });

    // Get listings by user
    app.get("/user-listings", verifyToken, async (req, res) => {
      const { userId } = req.query;
      const result = await listingsCollection.find({ userId }).toArray();
      res.send(result);
    });

    // Delete a listing
    app.delete("/listings/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await listingsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send({
        success: true,
        result,
      });
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

//
