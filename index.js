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

    app.get("/listings", async (req, res) => {
      const result = await listingsCollection.find().toArray();
      res.send(result);
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
