const express = require("express");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const cors = require("cors");
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.zsgh3ij.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // await client.connect();

    const menuCollection = client
      .db("bistroBossDB")
      .collection("menuCollection");
    const carts = client.db("bistroBossDB").collection("carts");
    const users = client.db("bistroBossDB").collection("users");
    const paymentCollection = client.db("bistroBossDB").collection("payments");

    //____________________
    // middle ware
    //______________________

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded;
      const query = { email: email };
      const user = await users.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    const verifyToken = (req, res, next) => {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).send({ message: "Unauthorized" });
      }

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized" });
        }
        req.decoded = decoded.user;
        next();
      });
    };
    //---------------------------------------------------

    // get menu item
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    // get 1 menu item by id
    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      console.log(result);
      res.send(result);
    });

    // UPDATE 1 menu item by id
    app.patch("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const menuItem = req.body;
      const updateDoc = {
        $set: {
          name: menuItem.name,
          recipe: menuItem.recipe,
          price: menuItem.price,
          category: menuItem.category,
          image: menuItem.image,
        },
      };
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // post a menu item

    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      const menuItem = req.body;
      const result = await menuCollection.insertOne(menuItem);
      res.send(result);
    });

    // -----Delete A Menu------//

    app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    ///jwt token
    app.post("/jwt", (req, res) => {
      const user = req.body;

      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1y",
      });
      res.send({ token });
    });

    //check admin

    app.get("/users/admin/:email",verifyToken,  async (req, res) => {
      const userEmail = req.params.email;

      if (userEmail !== req.decoded) {

        return res.status(403).send({ message: "forbidden access" });
      }
      console.log(userEmail, req.decoded)
      const query = { email: userEmail };
      const user = await users.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    //add item to cart
    app.post("/carts", async (req, res) => {
      const cart = req.body;
      const result = await carts.insertOne(cart);
      res.send(result);
    });

    //add user after registration

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const isExist = await users.findOne(query);
      if (isExist) {
        return res.send({ message: "Already Exit", insertedId: null });
      }
      const result = await users.insertOne(user);
      res.send(result);
    });

    //get all user in admin Dashboard

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await users.find().toArray();
      res.send(result);
    });

    //delete a user
    app.delete("/users/:id", async (req, res) => {
      const email = req.query.email;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const user = await users.findOne(query);
      const userEmail = user.email;

      if (email === userEmail) {
        return res.send({ message: "Unknown" });
      }

      const result = await users.deleteOne(query);
      res.send(result);
    });

    //get item from cart
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await carts.find(query).toArray();
      res.send(result);
    });

    //delete from cart
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await carts.deleteOne(query);
      res.send(result);
    });

    //make admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: { role: "admin" },
      };
      const result = await users.updateOne(query, updatedDoc);
      res.send(result);
    });

    //
    app.get('/payment/:email',verifyToken, async(req,res)=>{
      const email=req.params.email
      const query={email:email}
      const result=await paymentCollection.find(query).toArray()
      res.send(result)
    })

    // payment

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      if (amount > 50) {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      }
    });

    // make Payment
    app.post("/payment", async (req, res) => {
      const payment = req.body;
      const deleteQuery = {
        _id: {
          $in: payment.orderIds.map((id) => new ObjectId(id)),
        },
      };

      console.log(deleteQuery);
      const deleteResult = await carts.deleteMany(deleteQuery);
      const result = await paymentCollection.insertOne(payment);

      res.send({ result, deleteResult });
    });

    // admin stats

    app.get('/admin-stats',async(req,res)=>{
      const user=await users.estimatedDocumentCount()
      const products=await menuCollection.estimatedDocumentCount()
      const orders=await paymentCollection.estimatedDocumentCount()
      let revenue=await paymentCollection.aggregate([
        {
          $group:{
            _id:null,
            totalPrice:{$sum:'$price'}
          }
        }
      ]).toArray()

      const totalPrice=revenue[0]?.totalPrice || 0

      res.send({users: user,products,orders,totalPrice})
    })

    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
