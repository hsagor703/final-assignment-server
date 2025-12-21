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
    const requestCollection = db.collection("requestData");

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

    app.get("/employee/companies/:email", async (req, res) => {
      const email = req.params.email;

      const employee = await employeeCollection.findOne({ email });

      const companies = employee.connectedCompany
        .filter((c) => c.status === "connected")
        .map((c) => ({
          hrCompanyName: c.hrCompanyName,
          HRManagerUid: c.HRManagerUid,
        }));

      res.send(companies);
    });

    app.get("/team/:hrUid", async (req, res) => {
      const hrUid = req.params.hrUid;

      const team = await employeeCollection
        .find({
          connectedCompany: {
            $elemMatch: {
              HRManagerUid: hrUid,
              status: "connected",
            },
          },
        })
        .toArray();

      res.send(team);
    });

    app.get("/team/birthdays/:hrUid", async (req, res) => {
      const hrUid = req.params.hrUid;
      const currentMonth = new Date().getMonth() + 1;

      const employees = await employeeCollection
        .find({
          connectedCompany: {
            $elemMatch: {
              HRManagerUid: hrUid,
              status: "connected",
            },
          },
        })
        .toArray();

      const birthdays = employees.filter((emp) => {
        const month = new Date(emp.dateOfBirth).getMonth() + 1;
        return month === currentMonth;
      });

      res.send(birthdays);
    });

    app.get("/employee", async (req, res) => {
      const { HRManagerUid, search, email } = req.query;
      const query = {};

      if (email) {
        query.email = email;
      }

      if (HRManagerUid) {
        query.connectedCompany = { $elemMatch: { HRManagerUid: HRManagerUid } };
      }
      if (search) {
        query.name = { $regex: search, $options: "i" };
      }

      const result = await employeeCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/employee/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await employeeCollection.findOne(query);
      res.send(result);
    });

    app.patch("/employee/:id", async (req, res) => {
      const {
        HRManagerUid,
        assetCount,
        joinDate,
        hrManagerId,
        hrEmail,
        hrSubscribtion,
        currentEmployees,
        hrAddedNewEmployee,
        hrCompanyName,
        status,
      } = req.body;
      const query = { _id: new ObjectId(req.params.id) };
      const addInfo = {
        $addToSet: {
          connectedCompany: {
            HRManagerUid,
            hrManagerId,
            hrEmail,
            assetCount,
            joinDate,
            hrCompanyName,
            status,
          },
        },
      };

      const result = await employeeCollection.updateOne(query, addInfo);
      if (result.modifiedCount === 1) {
        const correctEmployee = currentEmployees + hrAddedNewEmployee;
        const query = { _id: new ObjectId(hrManagerId) };
        const hrUpdateInfo = {
          $set: {
            currentEmployees: correctEmployee,
          },
        };
        const result = await hrManagerCollection.updateOne(query, hrUpdateInfo);
      }
      res.send(result);
    });

    app.delete("/employee/:id", async (req, res) => {
      const id = req.query.hrId;
      const query = { _id: new ObjectId(req.params.id) };
      const result = await employeeCollection.deleteOne(query);
      if (result.deletedCount === 1) {
        await hrManagerCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { currentEmployees: -1 } }
        );
      }
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
      const query = { email };
      const result = await hrManagerCollection.findOne(query);
      res.send(result);
    });

    app.get("/allHrManager", async (req, res) => {
      const result = await hrManagerCollection.find().toArray();
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
      const { search, email } = req.query;
      const query = {};
      if (email) {
        query.hrEmail = email;
      }
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

    // request Collection
    app.post("/requestData", async (req, res) => {
      const requestInfo = req.body;
      const result = await requestCollection.insertOne(requestInfo);
      res.send(result);
    });

    app.get("/requestData", async (req, res) => {
      // const email = req.params.email
      const { search, filter, email } = req.query;
      let query = {};

      if (email) {
        query.$or = [
          { requestedEmail: email },
          { "productInfo.hrEmail": email },
        ];
      }

      if (search) {
        query.$or = [
          { "productInfo.productName": { $regex: search, $options: "i" } },
          { requestedPerson: { $regex: search, $options: "i" } },
        ];
      }

      if (filter) {
        query["productInfo.productType"] = filter;
      }
      const result = await requestCollection
        .find(query)
        .sort({ dateAdded: -1 })
        .toArray();
      res.send(result);
    });

    app.patch("/requestData/:id", async (req, res) => {
      const {
        status,
        quantity,
        productId,
        productQuantity,
        requestedEmail,
        requestedAsset,
        requestedId,
        hrEmail,
      } = req.body;
      // console.log(req.body);
      // return
      const query = { _id: new ObjectId(req.params.id) };
      const updateStatus = {
        $set: {
          status: status,
          statusUpdateAt: new Date().toLocaleDateString(),
        },
      };
      if (status === "approve") {
        const correctQuantity = productQuantity - quantity;
        const query = { _id: new ObjectId(productId) };
        const updateQuantity = {
          $set: {
            productQuantity: correctQuantity,
          },
        };

        const result = await assetsCollection.updateOne(query, updateQuantity);
        console.log(result.modifiedCount);
        if (result.modifiedCount === 1) {
          // const updateCount = requestedAsset + 1;
          const query = {
            _id: new ObjectId(requestedId),
            "connectedCompany.hrEmail": hrEmail,
          };
          const updateAsset = {
            $inc: {
              "connectedCompany.$.assetCount": +1,
            },
          };
          const result = await employeeCollection.updateOne(query, updateAsset);
        }
      }
      const result = await requestCollection.updateOne(query, updateStatus);
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
