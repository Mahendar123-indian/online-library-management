
const express = require("express");
const cors = require("cors");
const path = require("path");

const db = require("./database");
const routes = require("./routes");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api", routes);

// Frontend files
app.use(express.static(
    path.join(__dirname, "../../frontend")
));

// Health check API
app.get("/api/health", (req, res) => {
    res.json({
        status: "OK",
        message: "Online Library Management System is running"
    });
});

// Home page
app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "../../frontend/index.html")
    );
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Library Management System running at http://localhost:${PORT}`);
});
