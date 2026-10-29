import express, {Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes";
import trackRoutes from "./routes/trackRoutes";
import entryRoutes from "./routes/entryRoutes";
import { requestLogger } from "./middleware/requestLogger";
import { errorHandler, notFound } from "./middleware/errorHandler";

const app: Application = express();
app.set("trust proxy", 1);

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
app.use(requestLogger);

app.get("/health", (req, res) => {
  res.sendStatus(200);
})
app.get("/", (req, res) => {
    res.send({ message: "Trackr API is running"});
});

// Auth responses can contain tokens: never store them anywhere.
app.use("/api/auth", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
// Per-user data: browsers keep a copy but must revalidate; shared caches must not store it.
app.use(["/api/tracks", "/api/entries"], (_req, res, next) => {
  res.set("Cache-Control", "private, no-cache");
  next();
});
app.use("/api/auth", authRoutes);
app.use("/api/tracks", trackRoutes);
app.use("/api/entries", entryRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);


export default app;