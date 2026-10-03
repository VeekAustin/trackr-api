import express, {Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes";
import trackRoutes from "./routes/trackRoutes";
import entryRoutes from "./routes/entryRoutes";
import { errorHandler, notFound } from "./middleware/errorHandler";

const app: Application = express();

const allowedOrigins = [
  "http://localhost:3000",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
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
app.use(notFound);
app.use(errorHandler);


export default app;