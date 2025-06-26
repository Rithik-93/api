import express from "express";
import multer from "multer";
import xlsx from "xlsx";
import cors from "cors";
import { zomatoHandler } from "./zomato";
import { swiggyHandler } from "./swiggy1";
// import { swiggyHandler } from "./swiggy"; // if needed

const app = express();
const PORT = 3000;

app.use(cors());
const upload = multer({ storage: multer.memoryStorage() });

app.post(
  "/api/process-excel-comparison",
  upload.fields([
    { name: "posFile", maxCount: 1 },
    { name: "sourceFile" },
  ]),
  //@ts-ignore
  async (req: express.Request, res: express.Response) => {
    try {
      const sourceType = req.body.sourceType;

      if (!sourceType) {
        return res.status(400).json({ error: "Missing sourceType in form data" });
      }

      if (sourceType === "zomatopay" || sourceType === "zomato-dine-in") {
        await zomatoHandler(req, res);
      } else if (sourceType === "swiggy" || sourceType === "swiggy-dine-in") {
        await swiggyHandler(req, res);
      } else {
        res.status(400).json({ error: `Invalid sourceType: ${sourceType}` });
      }
    } catch (err) {
      console.error("Processing error:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
