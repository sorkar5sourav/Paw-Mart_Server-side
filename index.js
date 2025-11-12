const express = require("express");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;
const cors = require("cors");
app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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

async function run() {
  try {
    await client.connect();

    const database = client.db("Paw-Mart-Listing");
    const listingsCollection = database.collection("Listings");
    const ordersCollection = database.collection("Orders");

    app.get("/listings", async (req, res) => {
      const result = await listingsCollection.find().toArray();
      res.send(result);
    });

    // Create a new listing
    app.post("/listings", async (req, res) => {
      try {
        const {
          name,
          category,
          price,
          location,
          description,
          imageUrl,
          pickupDate,
          email,
          userId,
          userName
        } = req.body;

        // Validation
        if (!name || !category || !location || !description || !imageUrl || !pickupDate || !email) {
          return res.status(400).json({ 
            message: "Missing required fields: name, category, location, description, imageUrl, pickupDate, email" 
          });
        }

        // Transform data to match MongoDB structure
        const listingData = {
          name: name,
          category: category,
          Price: typeof price === "number" ? price : parseInt(price) || 0,
          location: location,
          description: description,
          image: imageUrl, // Transform imageUrl to image
          email: email,
          date: pickupDate, // Transform pickupDate to date
          userId: userId || null,
          userName: userName || null
        };

        const result = await listingsCollection.insertOne(listingData);
        
        if (result.insertedId) {
          // Fetch the created listing to return it
          const createdListing = await listingsCollection.findOne({ _id: result.insertedId });
          res.status(201).json({
            message: "Listing created successfully",
            listing: createdListing
          });
        } else {
          res.status(500).json({ message: "Failed to create listing" });
        }
      } catch (error) {
        console.error("Error creating listing:", error);
        res.status(500).json({ 
          message: "Error creating listing", 
          error: error.message 
        });
      }
    });

    app.get("/listings/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const listing = await listingsCollection.findOne(query);
        
        if (!listing) {
          return res.status(404).json({ message: "Listing not found" });
        }
        
        res.send(listing);
      } catch (error) {
        console.error("Error fetching listing:", error);
        res.status(500).json({ message: "Error fetching listing", error: error.message });
      }
    });

    // Get single listing by ID (singular endpoint)
    app.get("/listing/:id", async (req, res) => {
      try {
        const id = req.params.id;
        
        // Handle MongoDB ObjectId format
        let query;
        try {
          query = { _id: new ObjectId(id) };
        } catch (error) {
          return res.status(400).json({ message: "Invalid listing ID format" });
        }
        
        const listing = await listingsCollection.findOne(query);
        
        if (!listing) {
          return res.status(404).json({ message: "Listing not found" });
        }
        
        // Transform MongoDB data structure to match frontend expectations
        // Handle price - could be number, Int32, or nested structure
        let price = 0;
        if (listing.Price) {
          if (typeof listing.Price === "number") {
            price = listing.Price;
          } else if (listing.Price.$numberInt) {
            price = parseInt(listing.Price.$numberInt);
          } else if (listing.Price.value) {
            price = parseInt(listing.Price.value);
          } else {
            price = parseInt(listing.Price) || 0;
          }
        }
        
        const transformedListing = {
          _id: listing._id.toString(),
          name: listing.name || "",
          category: listing.category || "",
          price: price,
          location: listing.location || "",
          description: listing.description || "",
          imageUrl: listing.image || "",
          email: listing.email || "",
          pickupDate: listing.date || listing.pickupDate || "",
          userName: listing.userName || listing.user || ""
        };
        
        res.json(transformedListing);
      } catch (error) {
        console.error("Error fetching listing:", error);
        res.status(500).json({ message: "Error fetching listing", error: error.message });
      }
    });

    // Create a new order
    app.post("/orders", async (req, res) => {
      try {
        const {
          buyerName,
          email,
          listingId,
          listingName,
          quantity,
          price,
          address,
          pickupDate,
          phone,
          notes,
        } = req.body;

        if (!buyerName || !email || !listingId || !listingName || !quantity || !price || !address || !pickupDate || !phone) {
          return res.status(400).json({
            message: "Missing required fields for creating an order.",
          });
        }

        let listingObjectId = null;
        try {
          listingObjectId = new ObjectId(listingId);
        } catch (error) {
          // ignore invalid ObjectId, store as plain string fallback
        }

        const orderDoc = {
          buyerName,
          email,
          listingId: listingObjectId || listingId,
          listingName,
          quantity: parseInt(quantity, 10) || 1,
          price: typeof price === "number" ? price : parseFloat(price) || 0,
          address,
          pickupDate,
          phone,
          notes: notes || "",
          status: "pending",
          createdAt: new Date(),
        };

        const result = await ordersCollection.insertOne(orderDoc);
        if (!result.insertedId) {
          return res.status(500).json({ message: "Failed to create order" });
        }

        const createdOrder = await ordersCollection.findOne({ _id: result.insertedId });
        res.status(201).json({
          message: "Order created successfully",
          order: createdOrder,
        });
      } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ message: "Error creating order", error: error.message });
      }
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
