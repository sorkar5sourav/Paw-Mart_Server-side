const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
require("dotenv").config();

// Initialize Firebase Admin
try {
  const serviceAccount = require("./Paw-mart_serviceKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("Firebase Admin initialized successfully");
} catch (error) {
  console.error("Error initializing Firebase Admin:", error.message);
  // If service account file doesn't exist, try to use default credentials
  try {
    admin.initializeApp();
    console.log("Firebase Admin initialized with default credentials");
  } catch (defaultError) {
    console.error("Failed to initialize Firebase Admin:", defaultError.message);
    throw new Error("Firebase Admin initialization failed");
  }
}

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

// Helper function for 500 errors
const handleServerError = (res, error, operation = "operation") => {
  console.error(`Error in ${operation}:`, error);
  res.status(500).send({
    success: false,
    message: "Internal server error",
  });
};

const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({
      message: "unauthorized access. Token not found!",
    });
  }

  const token = authorization.split(" ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; // Attach user info to request
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
      try {
        const result = await listingsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        handleServerError(res, error, "fetching listings");
      }
    });

    // Create a new listing
    app.post("/listings", verifyToken, async (req, res) => {
      try {
        const data = req.body;
        const result = await listingsCollection.insertOne(data);
        res.send({
          success: true,
          result,
        });
      } catch (error) {
        handleServerError(res, error, "creating listing");
      }
    });

    // Get single listing by ID (singular endpoint)
    app.get("/listing/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid listing ID format",
          });
        }
        const objectId = new ObjectId(id);
        const result = await listingsCollection.findOne({ _id: objectId });
        if (!result) {
          return res.status(404).send({
            success: false,
            message: "Listing not found",
          });
        }
        res.send({
          success: true,
          result,
        });
      } catch (error) {
        handleServerError(res, error, "fetching listing");
      }
    });

    // Update a listing
    app.put("/listings/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid listing ID format",
          });
        }
        const userEmail = req.user.email;
        const objectId = new ObjectId(id);

        // Check if listing exists and belongs to user
        const listing = await listingsCollection.findOne({ _id: objectId });
        if (!listing) {
          return res.status(404).send({
            success: false,
            message: "Listing not found",
          });
        }

        if (listing.userId !== req.user.uid && listing.email !== userEmail) {
          return res.status(403).send({
            success: false,
            message:
              "Forbidden: You do not have permission to update this listing",
          });
        }

        const data = req.body;
        const filter = { _id: objectId };
        const update = {
          $set: data,
        };
        const result = await listingsCollection.updateOne(filter, update);
        res.send({
          success: true,
          result,
        });
      } catch (error) {
        handleServerError(res, error, "updating listing");
      }
    });
    // Create a new order
    app.post("/orders", verifyToken, async (req, res) => {
      try {
        const data = req.body;
        // Ensure status is set, default to "pending" if not provided
        if (!data.status) {
          data.status = "pending";
        }
        const result = await ordersCollection.insertOne(data);
        res.send({
          success: true,
          result,
        });
      } catch (error) {
        handleServerError(res, error, "creating order");
      }
    });

    // Get orders by user email
    app.get("/orders", verifyToken, async (req, res) => {
      try {
        const { email } = req.query;
        const userEmail = req.user.email;

        // Ensure users can only access their own orders
        if (email !== userEmail) {
          return res.status(403).send({
            success: false,
            message: "Forbidden: You can only access your own orders",
          });
        }

        const result = await ordersCollection.find({ email }).toArray();
        res.send(result);
      } catch (error) {
        handleServerError(res, error, "fetching orders");
      }
    });

    // Get listings by user
    app.get("/user-listings", verifyToken, async (req, res) => {
      try {
        const { userId } = req.query;

        // Ensure users can only access their own listings
        if (userId !== req.user.uid) {
          return res.status(403).send({
            success: false,
            message: "Forbidden: You can only access your own listings",
          });
        }

        const result = await listingsCollection.find({ userId }).toArray();
        res.send(result);
      } catch (error) {
        handleServerError(res, error, "fetching user listings");
      }
    });

    // Delete a listing
    app.delete("/listings/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid listing ID format",
          });
        }
        const userEmail = req.user.email;
        const objectId = new ObjectId(id);

        // Check if listing exists and belongs to user
        const listing = await listingsCollection.findOne({ _id: objectId });
        if (!listing) {
          return res.status(404).send({
            success: false,
            message: "Listing not found",
          });
        }

        if (listing.userId !== req.user.uid && listing.email !== userEmail) {
          return res.status(403).send({
            success: false,
            message:
              "Forbidden: You do not have permission to delete this listing",
          });
        }

        const result = await listingsCollection.deleteOne({
          _id: objectId,
        });
        res.send({
          success: true,
          result,
        });
      } catch (error) {
        handleServerError(res, error, "deleting listing");
      }
    });

    // Delete an order
    app.delete("/orders/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid order ID format",
          });
        }
        const userEmail = req.user.email;
        const objectId = new ObjectId(id);

        // Check if order exists and belongs to user
        const order = await ordersCollection.findOne({ _id: objectId });
        if (!order) {
          return res.status(404).send({
            success: false,
            message: "Order not found",
          });
        }

        if (order.email !== userEmail) {
          return res.status(403).send({
            success: false,
            message:
              "Forbidden: You do not have permission to delete this order",
          });
        }

        const result = await ordersCollection.deleteOne({
          _id: objectId,
        });
        res.send({
          success: true,
          result,
        });
      } catch (error) {
        handleServerError(res, error, "deleting order");
      }
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
