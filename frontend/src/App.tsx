import React, { useState } from "react";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";
import "./App.css";

function App() {
  const [videoId, setVideoId] = useState("");
  const [data, setData]     = useState<{
    comments: string[];
    sentiment: string[];
    keywords: string[][];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/analyze`, {
        params: { videoId }
      });
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Prepare data for Recharts
  const sentimentCounts = data
    ? Object.entries(data.sentiment.reduce((acc: any, s: string) => {
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {})).map(([name, count]) => ({ name, count }))
    : [];

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-3xl mb-4">YTInsight Hybrid – Phase 1</h1>

      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 border rounded p-2"
          placeholder="Enter YouTube Video ID"
          value={videoId}
          onChange={e => setVideoId(e.target.value)}
        />
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          disabled={loading || !videoId}
          onClick={analyze}
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </div>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      {data && (
        <>
          <section className="mb-8">
            <h2 className="text-2xl mb-2">Sentiment Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sentimentCounts}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section>
            <h2 className="text-2xl mb-2">Extracted Keywords</h2>
            <div className="flex flex-wrap gap-2">
              {data.keywords.flat().map((kw, i) => (
                <span
                  key={i}
                  className="bg-gray-200 rounded-full px-3 py-1 text-sm"
                >
                  {kw}
                </span>
              ))}
            </div>
          </section>
        </>
      )}

      {!data && !loading && (
        <p className="text-gray-500">Enter a video ID and click Analyze.</p>
      )}
    </div>
  );
}

export default App;
