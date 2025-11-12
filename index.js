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

    const transformListing = (listing) => {
      if (!listing) return null;

      let price = 0;
      if (typeof listing.price === "number") {
        price = listing.price;
      } else if (typeof listing.Price === "number") {
        price = listing.Price;
      } else if (listing.Price?.$numberInt) {
        price = parseInt(listing.Price.$numberInt);
      } else if (listing.Price?.value) {
        price = parseInt(listing.Price.value);
      } else if (listing.Price) {
        const parsed = parseFloat(listing.Price);
        price = Number.isNaN(parsed) ? 0 : parsed;
      }

      const pickupDate = listing.pickupDate || listing.date || "";

      return {
        _id: listing._id?.toString() || "",
        name: listing.name || "",
        category: listing.category || "",
        price,
        location: listing.location || "",
        description: listing.description || "",
        imageUrl: listing.imageUrl || listing.image || "",
        email: listing.email || "",
        pickupDate,
        userName: listing.userName || listing.user || "",
        userId: listing.userId || "",
        createdAt: listing.createdAt || null,
        updatedAt: listing.updatedAt || null,
      };
    };

    const transformOrder = (order) => {
      if (!order) return null;
      return {
        _id: order._id?.toString() || "",
        buyerName: order.buyerName || "",
        email: order.email || "",
        listingId: order.listingId?.toString?.() || order.listingId || "",
        listingName: order.listingName || "",
        quantity: order.quantity || 1,
        price: typeof order.price === "number" ? order.price : parseFloat(order.price) || 0,
        address: order.address || "",
        pickupDate: order.pickupDate || "",
        phone: order.phone || "",
        notes: order.notes || "",
        status: order.status || "pending",
        createdAt: order.createdAt || null,
      };
    };

    app.get("/listings", async (req, res) => {
      const result = await listingsCollection.find().toArray();
      const transformed = result.map(transformListing);
      res.send(transformed);
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

        const numericPrice = typeof price === "number" ? price : parseFloat(price) || 0;

        // Transform data to match MongoDB structure
        const listingData = {
          name: name,
          category: category,
          Price: numericPrice,
          location: location,
          description: description,
          image: imageUrl, // Transform imageUrl to image
          email: email,
          date: pickupDate, // Transform pickupDate to date
          pickupDate: pickupDate,
          userId: userId || null,
          userName: userName || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await listingsCollection.insertOne(listingData);
        
        if (result.insertedId) {
          const createdListing = await listingsCollection.findOne({ _id: result.insertedId });
          res.status(201).json({
            message: "Listing created successfully",
            listing: transformListing(createdListing),
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
        
        res.send(transformListing(listing));
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
        
        res.json(transformListing(listing));
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

        if (
          !buyerName ||
          !email ||
          !listingId ||
          !listingName ||
          !quantity ||
          !price ||
          !address ||
          !pickupDate ||
          !phone
        ) {
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

        const createdOrder = await ordersCollection.findOne({
          _id: result.insertedId,
        });
        res.status(201).json({
          message: "Order created successfully",
          order: transformOrder(createdOrder),
        });
      } catch (error) {
        console.error("Error creating order:", error);
        res
          .status(500)
          .json({ message: "Error creating order", error: error.message });
      }
    });

    // Get orders by user email
    app.get("/orders", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) {
          return res.status(400).json({ message: "email query parameter is required" });
        }

        const orders = await ordersCollection.find({ email }).sort({ createdAt: -1 }).toArray();
        res.json(orders.map(transformOrder));
      } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ message: "Error fetching orders", error: error.message });
      }
    });

    // Get listings by user
    app.get("/user-listings", async (req, res) => {
      try {
        const { userId } = req.query;
        if (!userId) {
          return res.status(400).json({ message: "userId query parameter is required" });
        }

        const listings = await listingsCollection.find({ userId }).toArray();
        res.json(listings.map(transformListing));
      } catch (error) {
        console.error("Error fetching user listings:", error);
        res.status(500).json({ message: "Error fetching user listings", error: error.message });
      }
    });

    // Update a listing
    app.put("/listings/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const {
          name,
          category,
          price,
          location,
          description,
          imageUrl,
          pickupDate,
          userId,
        } = req.body;

        if (!userId) {
          return res.status(400).json({ message: "User ID is required" });
        }

        let query;
        try {
          query = { _id: new ObjectId(id) };
        } catch (error) {
          return res.status(400).json({ message: "Invalid listing ID format" });
        }

        const existingListing = await listingsCollection.findOne(query);
        if (!existingListing) {
          return res.status(404).json({ message: "Listing not found" });
        }

        if (existingListing.userId && existingListing.userId !== userId) {
          return res.status(403).json({ message: "You are not authorized to update this listing" });
        }

        if (!name || !category || !location || !description || !imageUrl || !pickupDate) {
          return res.status(400).json({
            message: "Missing required fields: name, category, location, description, imageUrl, pickupDate",
          });
        }

        const numericPrice = typeof price === "number" ? price : parseFloat(price) || 0;

        const updateDoc = {
          name,
          category,
          Price: numericPrice,
          location,
          description,
          image: imageUrl,
          date: pickupDate,
          pickupDate: pickupDate,
          updatedAt: new Date(),
        };

        await listingsCollection.updateOne(query, { $set: updateDoc });

        const updatedListing = await listingsCollection.findOne(query);
        res.json({
          message: "Listing updated successfully",
          listing: transformListing(updatedListing),
        });
      } catch (error) {
        console.error("Error updating listing:", error);
        res.status(500).json({ message: "Error updating listing", error: error.message });
      }
    });

    // Delete a listing
    app.delete("/listings/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { userId } = req.query;

        if (!userId) {
          return res.status(400).json({ message: "User ID is required" });
        }

        let query;
        try {
          query = { _id: new ObjectId(id) };
        } catch (error) {
          return res.status(400).json({ message: "Invalid listing ID format" });
        }

        const existingListing = await listingsCollection.findOne(query);
        if (!existingListing) {
          return res.status(404).json({ message: "Listing not found" });
        }

        if (existingListing.userId && existingListing.userId !== userId) {
          return res.status(403).json({ message: "You are not authorized to delete this listing" });
        }

        await listingsCollection.deleteOne(query);
        res.json({ message: "Listing deleted successfully" });
      } catch (error) {
        console.error("Error deleting listing:", error);
        res.status(500).json({ message: "Error deleting listing", error: error.message });
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
