import { useEffect, useState } from "react";

function App() {
   const [formulas, setFormulas] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("http://localhost:5000")
      .then(res => res.json())
      .then(data => setMessage(data.message));
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];

    const formData = new FormData();
    formData.append("file", file); // Must match multer.single("file")

    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:5000/excel/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      setFormulas(data);
    } catch (err: any) {
      setError(err.message || "Error uploading file");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>React Frontend</h1>
      <p>{message}</p>

      <h2>Upload Excel to extract formulas</h2>
      <input type="file" accept=".xlsx" onChange={handleFileChange} />
      {loading && <p>Processing...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {formulas && (
        <pre style={{ textAlign: "left", whiteSpace: "pre-wrap" }}>
          {JSON.stringify(formulas, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default App;