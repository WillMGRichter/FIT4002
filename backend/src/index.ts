import "dotenv/config";
import { app } from "./app";

const PORT = process.env.PORT || 5000;

/** Starts the Express server on the configured port */
app.listen(PORT, () => {
  console.log(`SmartSim API running on port ${PORT}`);
});
