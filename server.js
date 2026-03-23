import express from "express";
import fileUpload from "express-fileupload";
// import createModule from "./libredwg-web/bindings/javascript/wasm/libredwg-web.js";
import { LibreDwg, Dwg_File_Type } from "@mlightcad/libredwg-web";
const libredwg = await LibreDwg.create();
// const libredwg = await createModule();

const app = express();
const port = process.env.PORT || 3000;

app.use(fileUpload());

// Allow requests from your local machine (CORS)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

// Serve the root path
app.get("/", (req, res) => {
  res.send("Welcome to the DWG Upload Service");
});

// Handle the DWG file upload
app.post("/upload-dwg", async (req, res) => {
  try {
    if (!req.files || !req.files.dwgFile) {
      return res.status(400).send("No file uploaded");
    }

    const fileBuffer = req.files.dwgFile.data;

    const dwg = libredwg.dwg_read_data(
      new Uint8Array(fileBuffer),
      Dwg_File_Type.DWG
    );

    const db = libredwg.convert(dwg);

    libredwg.dwg_free(dwg);

    const entities = db.entities.map((ent) => {
      if (ent.type === "LINE") {
        return {
          type: "LINE",
          start: ent.start,
          end: ent.end
        };
      }

      if (ent.type === "LWPOLYLINE" || ent.type === "POLYLINE") {
        return {
          type: ent.type,
          vertices: ent.vertices
        };
      }

      return { type: ent.type };
    });

    res.json({ entities });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
app.listen(port, () => console.log(`Backend running on port ${port}`));
