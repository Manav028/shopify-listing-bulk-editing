const express = require("express");
const productRoutes = require("./routes/productRoutes");
const uploadRoutes = require("./routes/uploadRoutes");

const app = express();

app.use(express.json());
app.use("/api", productRoutes);
app.use("/api", uploadRoutes);

module.exports = app;
