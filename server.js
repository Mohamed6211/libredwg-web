import express from "express";
import fileUpload from "express-fileupload";
import createModule from "./libredwg-web/bindings/javascript/wasm/libredwg-web.js";

const libredwg = await createModule();

const app = express();
const port = process.env.PORT || 3000;

app.use(fileUpload());

// Allow requests from your local machine (CORS)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

app.post("/upload-dwg", async (req, res) => {
  if (!req.files || !req.files.dwgFile) return res.status(400).send("No file uploaded");

  const file = req.files.dwgFile;
  const fileBuffer = file.data;

  try {
    const fileName = "temp.dwg";
    // Write the file into the WASM virtual file system
    libredwg.FS.writeFile(fileName, new Uint8Array(fileBuffer));

    // Parse the DWG file
    const result = libredwg.dwg_read_file(fileName);

    if (result.error !== 0) {
      return res.status(500).json({ error: "DWG read error: " + result.error });
    }

    const data = result.data;

    // Parse the DWG entities
    const entities = data.entities.map((ent) => {
      if (ent.type === "LINE") {
        return { type: "LINE", start: ent.start, end: ent.end };
      }
      if (ent.type === "LWPOLYLINE" || ent.type === "POLYLINE") {
        return { type: ent.type, vertices: ent.vertices };
      }
      return { type: ent.type };
    });

    // Respond with entities as JSON
    res.json({ entities });

    // Clean up the virtual file system
    libredwg.FS.unlink(fileName);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error parsing DWG");
  }
});

app.listen(port, () => console.log(`Backend running on port ${port}`));
