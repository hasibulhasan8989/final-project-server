const express = require("express");
const app = express();
require("dotenv").config();

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
    await client.connect();

    const menuCollection = client
      .db("bistroBossDB")
      .collection("menuCollection");
    const carts = client.db("bistroBossDB").collection("carts");
    const users = client.db("bistroBossDB").collection("users");
   
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    //add item to cart
    app.post("/carts", async (req, res) => {
      const cart = req.body;
      const result = await carts.insertOne(cart);
      res.send(result);
    });

    //add user after registration

    app.post('/users',async(req,res)=>{
      
      const user=req.body;
      const query={email:user.email}
      const isExist=await users.findOne(query)
      if(isExist){
        return res.send({message:'Already Exit',insertedId:null})
      }
      const result=await users.insertOne(user)
      res.send(result)
    })

    //get item from cart
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query={email:email}
      const result = await carts.find(query).toArray();
      res.send(result);
    });
    //delete from cart
    app.delete('/carts/:id',async(req,res)=>{
      const id=req.params.id
      const query={_id : new ObjectId(id)}
      const result=await carts.deleteOne(query)
      res.send(result)
    })

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
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
