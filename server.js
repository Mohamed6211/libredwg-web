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

// Serve the root path
app.get("/", (req, res) => {
  res.send("Welcome to the DWG Upload Service");
});

// Handle the DWG file upload
app.post("/upload-dwg", async (req, res) => {
  if (!req.files || !req.files.dwgFile) {
    console.error("No file uploaded");
    return res.status(400).send("No file uploaded");
  }

  const file = req.files.dwgFile;
  const fileBuffer = file.data;

  try {
    console.log("Starting DWG processing...");

    const fileName = "temp.dwg";
    
    // Write the file into the WASM virtual file system
    libredwg.FS.writeFile(fileName, new Uint8Array(fileBuffer));

    console.log("DWG file written to virtual file system");

    // Parse the DWG file
    const result = libredwg.dwg_read_file(fileName);
    console.log("DWG read result:", result);

    if (result.error !== 0) {
      console.error("DWG read error:", result.error);
      return res.status(500).json({ error: "DWG read error: " + result.error });
    }

    const data = result.data;
    console.log("Parsed DWG data:", data);

    // Check if entities exist
    if (!data.entities) {
      console.error("No entities found in DWG data");
      return res.status(500).json({ error: "No entities found in DWG data" });
    }

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
    console.log("Entities extracted:", entities);
    res.json({ entities });

    // Clean up the virtual file system
    libredwg.FS.unlink(fileName);
    console.log("File system cleaned up");

  } catch (err) {
    console.error("Error during DWG processing:", err);
    res.status(500).json({ error: "Error parsing DWG file: " + err.message });
  }
});

app.listen(port, () => console.log(`Backend running on port ${port}`));
