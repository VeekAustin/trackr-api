import express, {Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes";
import trackRoutes from "./routes/trackRoutes";
import entryRoutes from "./routes/entryRoutes";
import { errorHandler, notFound } from "./middleware/errorHandler";

const app: Application = express();

app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
    res.send({ message: "Trackr API is running"});
});

app.use("/api/auth", authRoutes);
app.use("/api/tracks", trackRoutes);
app.use("/api/entries", entryRoutes);

// Error handling middleware
app.use(errorHandler);
app.use(notFound);

export default app;