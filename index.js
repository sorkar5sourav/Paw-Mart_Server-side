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

// Simple request logger to help debug incoming requests and auth header presence
app.use((req, res, next) => {
  const authPresent = !!req.headers.authorization;
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${
      req.path
    } - auth:${authPresent}`
  );
  next();
});

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
    console.log("verifyToken: authorization header missing");
    return res
      .status(401)
      .send({ message: "unauthorized access. Token not found!" });
  }

  const token = authorization.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    // attach decoded token to request for downstream checks
    req.decodedToken = decoded;
    console.log(
      `verifyToken: decoded uid=${decoded.uid || "<no-uid>"} email=${
        decoded.email || "<no-email>"
      }`
    );
    next();
  } catch (error) {
    console.error(
      "verifyToken error:",
      error && error.message ? error.message : error
    );
    res.status(401).send({ message: "unauthorized access." });
  }
};

// Middleware: ensure requester is admin (checks userCollection by uid)
const verifyAdmin = async (req, res, next) => {
  try {
    const decoded = req.decodedToken;
    if (!decoded || !decoded.uid) {
      return res.status(401).send({ message: "unauthorized" });
    }

    const userRecord = await client
      .db("Paw-Mart-Listing")
      .collection("userCollection")
      .findOne({ uid: decoded.uid });
    if (userRecord && userRecord.role === "admin") {
      req.userRecord = userRecord;
      return next();
    }

    return res.status(403).send({ message: "forbidden: admin only" });
  } catch (err) {
    console.error("verifyAdmin error:", err);
    return res.status(500).send({ message: "internal server error" });
  }
};

async function run() {
  try {
    // await client.connect();

    const database = client.db("Paw-Mart-Listing");
    const listingsCollection = database.collection("Listings");
    const ordersCollection = database.collection("Orders");
    const usersCollection = database.collection("userCollection");

    // Public: only return approved listings
    app.get("/listings", async (req, res) => {
      const result = await listingsCollection
        .find({ status: "approved" })
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    });

    // Create a new listing (user must be authenticated). Listings require admin approval before public listing.
    // Non-admin users can ONLY post pet adoption listings. Products require admin role.
    app.post("/listings", verifyToken, async (req, res) => {
      try {
        const data = req.body || {};
        const decoded = req.decodedToken || {};
        const category = data.category || "";

        // Check if non-admin user is trying to post non-Pets category
        if (category !== "Pets") {
          const userRecord = await usersCollection.findOne({
            uid: decoded.uid,
          });
          if (!userRecord || userRecord.role !== "admin") {
            console.log(
              `[POST /listings] Non-admin user ${decoded.uid} attempted to post category: ${category}`
            );
            return res.status(403).send({
              success: false,
              message:
                "Only administrators can post products. Users can only post pet adoptions.",
            });
          }
        }

        const listing = {
          ...data,
          userId: decoded.uid || data.userId,
          email: decoded.email || data.email,
          status: "pending",
          createdAt: new Date(),
        };
        console.log(
          `[POST /listings] Creating listing - user: ${decoded.uid}, category: ${category}`
        );
        const result = await listingsCollection.insertOne(listing);
        res.send({ success: true, result });
      } catch (error) {
        console.error("POST /listings error:", error);
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    // Get single listing by ID (public)
    app.get("/listing/:id", async (req, res) => {
      const { id } = req.params;
      const objectId = new ObjectId(id);
      const result = await listingsCollection.findOne({ _id: objectId });
      if (!result) {
        return res.status(404).send({ success: false, message: "Not found" });
      }
      res.send({ success: true, result });
    });

    // Update a listing (owner or admin)
    app.put("/listings/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const data = req.body || {};
      const objectId = new ObjectId(id);
      const existing = await listingsCollection.findOne({ _id: objectId });
      const decoded = req.decodedToken || {};

      if (!existing)
        return res.status(404).send({ success: false, message: "Not found" });

      // allow owner or admin to update
      if (existing.userId !== decoded.uid) {
        // check admin
        const userRecord = await usersCollection.findOne({ uid: decoded.uid });
        if (!userRecord || userRecord.role !== "admin") {
          return res.status(403).send({ message: "forbidden" });
        }
      }

      const filter = { _id: objectId };
      const update = { $set: data };
      const result = await listingsCollection.updateOne(filter, update);
      res.send({ success: true, result });
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

    // Get orders: user-specific (by email) or admin can query all
    app.get("/orders", verifyToken, async (req, res) => {
      const { email } = req.query;
      const decoded = req.decodedToken || {};
      // if admin request (and no email) return all
      const userRecord = await usersCollection.findOne({ uid: decoded.uid });
      if (userRecord && userRecord.role === "admin") {
        if (email) {
          const result = await ordersCollection.find({ email }).toArray();
          return res.send(result);
        }
        const result = await ordersCollection.find().toArray();
        return res.send(result);
      }

      // otherwise return orders for the authenticated user's email only
      const requesterEmail = decoded.email;
      const result = await ordersCollection
        .find({ email: requesterEmail })
        .toArray();
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

    // Update order status (admin only)
    app.patch(
      "/orders/:id/status",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const { id } = req.params;
          const { status } = req.body;

          if (!status) {
            return res.status(400).send({ message: "status required" });
          }

          const objectId = new ObjectId(id);
          const result = await ordersCollection.updateOne(
            { _id: objectId },
            { $set: { status, updatedAt: new Date() } }
          );

          if (result.matchedCount === 0) {
            return res.status(404).send({ message: "order not found" });
          }

          res.send({
            success: true,
            result,
          });
        } catch (err) {
          console.error("Order status update error:", err);
          res.status(500).send({ success: false, message: "internal error" });
        }
      }
    );

    // Get listings by user (owner) or admin
    app.get("/user-listings", verifyToken, async (req, res) => {
      const { userId } = req.query;
      const decoded = req.decodedToken || {};
      if (!userId) return res.status(400).send({ message: "userId required" });

      // owner can view their own listings
      if (decoded.uid === userId) {
        const result = await listingsCollection.find({ userId }).toArray();
        return res.send(result);
      }

      // admin can view any user's listings
      const userRecord = await usersCollection.findOne({ uid: decoded.uid });
      if (userRecord && userRecord.role === "admin") {
        const result = await listingsCollection.find({ userId }).toArray();
        return res.send(result);
      }

      return res.status(403).send({ message: "forbidden" });
    });

    // Delete a listing (owner or admin)
    app.delete("/listings/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const objectId = new ObjectId(id);
      const existing = await listingsCollection.findOne({ _id: objectId });
      const decoded = req.decodedToken || {};

      if (!existing)
        return res.status(404).send({ success: false, message: "Not found" });

      if (existing.userId !== decoded.uid) {
        const userRecord = await usersCollection.findOne({ uid: decoded.uid });
        if (!userRecord || userRecord.role !== "admin") {
          return res.status(403).send({ message: "forbidden" });
        }
      }

      const result = await listingsCollection.deleteOne({ _id: objectId });
      res.send({ success: true, result });
    });

    // Update a listing (owner or admin)
    app.put("/listings/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const objectId = new ObjectId(id);
        const existing = await listingsCollection.findOne({ _id: objectId });
        const decoded = req.decodedToken || {};

        if (!existing)
          return res.status(404).send({ success: false, message: "Not found" });

        // Check if requester is owner or admin
        if (existing.userId !== decoded.uid) {
          const userRecord = await usersCollection.findOne({
            uid: decoded.uid,
          });
          if (!userRecord || userRecord.role !== "admin") {
            return res.status(403).send({ message: "forbidden" });
          }
        }

        const updateData = req.body || {};
        // Prevent changing userId and status
        delete updateData.userId;
        delete updateData.status;

        const result = await listingsCollection.updateOne(
          { _id: objectId },
          { $set: { ...updateData, updatedAt: new Date() } }
        );

        res.send({ success: true, result });
      } catch (err) {
        console.error("Listing update error:", err);
        res.status(500).send({ success: false, message: "internal error" });
      }
    });

    // Admin: list all listings (including pending)
    app.get("/admin/listings", verifyToken, verifyAdmin, async (req, res) => {
      const result = await listingsCollection
        .find()
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    });

    // Admin: approve a listing
    app.put(
      "/admin/listings/:id/approve",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;
        const objectId = new ObjectId(id);
        const result = await listingsCollection.updateOne(
          { _id: objectId },
          { $set: { status: "approved", approvedAt: new Date() } }
        );
        res.send({ success: true, result });
      }
    );

    // Admin: get all users
    app.get("/admin/users", verifyToken, verifyAdmin, async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    // Admin: set user role
    app.put(
      "/admin/users/:uid/role",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { uid } = req.params;
        const { role } = req.body;
        if (!role) return res.status(400).send({ message: "role required" });
        const result = await usersCollection.updateOne(
          { uid },
          { $set: { role } }
        );
        res.send({ success: true, result });
      }
    );

    // Admin: update arbitrary user fields (role, status, suspendReason, etc.)
    app.put("/admin/users/:uid", verifyToken, verifyAdmin, async (req, res) => {
      const { uid } = req.params;
      const payload = req.body || {};
      // prevent changing uid
      delete payload.uid;
      const result = await usersCollection.updateOne(
        { uid },
        { $set: payload }
      );
      res.send({ success: true, result });
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    // Demo auth: creates a Firebase custom token for dev/demo usage
    app.post("/auth/demo", async (req, res) => {
      try {
        // Use a deterministic demo uid so Demo users map consistently
        const demoUid = "demo-user";
        const demoClaims = { demo: true, role: "demo" };
        const customToken = await admin
          .auth()
          .createCustomToken(demoUid, demoClaims);

        // Optionally ensure a demo user record exists in the database
        await usersCollection.updateOne(
          { uid: demoUid },
          {
            $set: {
              uid: demoUid,
              email: "demo@pawmart.local",
              displayName: "Demo User",
              demo: true,
            },
          },
          { upsert: true }
        );

        res.send({
          success: true,
          token: customToken,
          user: {
            uid: demoUid,
            email: "demo@pawmart.local",
            displayName: "Demo User",
          },
        });
      } catch (err) {
        console.error("Demo auth error:", err);
        res
          .status(500)
          .send({ success: false, message: "Failed to create demo token" });
      }
    });

    // Upsert user profile into Users collection (called by frontend after sign-up/login)
    app.post("/users", verifyToken, async (req, res) => {
      try {
        const payload = req.body || {};
        const decoded = req.decodedToken || {};
        console.log("POST /users called", {
          payloadPresent: Object.keys(payload).length > 0,
          decodedUid: decoded.uid,
          decodedEmail: decoded.email,
        });
        const uid = decoded.uid || payload.uid;
        const email = decoded.email || payload.email;
        if (!uid || !email)
          return res.status(400).send({ message: "uid and email required" });

        const doc = {
          uid,
          email,
          displayName: payload.displayName || decoded.name || "",
          role: payload.role || "user",
          createdAt: new Date(),
        };

        const result = await usersCollection.updateOne(
          { uid },
          { $set: doc },
          { upsert: true }
        );
        res.send({ success: true, result });
      } catch (err) {
        console.error("/users upsert error:", err);
        res.status(500).send({ success: false, message: "internal error" });
      }
    });

    // Get user profile by uid (authenticated users only)
    app.get("/user-profile", verifyToken, async (req, res) => {
      try {
        const decoded = req.decodedToken || {};
        const uid = decoded.uid;

        if (!uid) {
          return res.status(400).send({ message: "uid required" });
        }

        const userRecord = await usersCollection.findOne({ uid });
        if (!userRecord) {
          // User not found, return default user profile
          return res.send({
            uid,
            email: decoded.email,
            displayName: decoded.name || "",
            role: "user", // Default role
          });
        }

        res.send(userRecord);
      } catch (err) {
        console.error("/user-profile error:", err);
        res.status(500).send({ success: false, message: "internal error" });
      }
    });
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
