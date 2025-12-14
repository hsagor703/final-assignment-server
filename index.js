require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const port = process.env.PORT || 3000;
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf-8"
);
const serviceAccount = JSON.parse(decoded);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
// middleware
app.use(
  cors({
    origin: [process.env.CLIENT_DOMAIN],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());

// jwt middlewares
const verifyJWT = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(" ")[1];
  console.log(token);
  if (!token) return res.status(401).send({ message: "Unauthorized Access!" });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.tokenEmail = decoded.email;
    console.log(decoded);
    next();
  } catch (err) {
    console.log(err);
    return res.status(401).send({ message: "Unauthorized Access!", err });
  }
};

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const db = client.db("AssetVerse");
    const employeeCollection = db.collection("Employee");
    const hrManagerCollection = db.collection("HrManager");
    const packagesCollection = db.collection("Packages");
    const assetsCollection = db.collection("assets");

    // packagesCollection
    app.get("/packages", async (req, res) => {
      const result = await packagesCollection.find().toArray();
      res.send(result);
    });

    //  employee collection
    app.post("/employee", async (req, res) => {
      const employeeInfo = req.body;
      const result = await employeeCollection.insertOne(employeeInfo);
      res.send(result);
    });

    app.get("/employee", async (req, res) => {
      const email = req.query.email;
      const query = {
        email: email,
      };
      const result = await employeeCollection.findOne(query);
      res.send(result);
    });

    // hrManager collection
    app.post("/hrManager", async (req, res) => {
      const HRInfo = req.body;
      const result = await hrManagerCollection.insertOne(HRInfo);
      res.send(result);
    });

    app.get("/hrManager", async (req, res) => {
      const email = req.query.email;
      const query = {
        email: email,
      };
      const result = await hrManagerCollection.findOne(query);
      res.send(result);
    });

    // assets collection
    app.post("/assets", async (req, res) => {
      const productInfo = req.body;
      const result = await assetsCollection.insertOne(productInfo);
      res.send(result);
    });

    app.patch("/assets/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };

      const { productName, productImage, productType, productQuantity } =
        req.body;
      const updated = {
        $set: {
          productImage,
          productName,
          productType,
          productQuantity,
        },
      };

      const result = await assetsCollection.updateOne(query, updated);
      res.send(result);
    });

    app.get("/assets", async (req, res) => {
      const search = req.query.search;
      const query = {};
      if (search) {
        query.productName = { $regex: search, $options: "i" };
      }

      const result = await assetsCollection
        .find(query)
        .sort({ dateAdded: -1 })
        .toArray();
      res.send(result);
    });

    app.delete("/assets/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assetsCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from Server..");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
