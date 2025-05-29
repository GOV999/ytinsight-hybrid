// frontend/src/App.tsx

import { useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";
import "./index.css";

type AnalyzeResponse = {
  comments: string[];
  sentiment: string[];
  keywords: string[][];
  error?: string;
};

function App() {
  const [videoId, setVideoId] = useState("");
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await axios.get<AnalyzeResponse>(
        `${import.meta.env.VITE_API_URL}/analyze`,
        { params: { videoId } }
      );

      if (res.data.error) {
        setError(res.data.error);
      } else {
        setData(res.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  // 1) Sentiment counts
  const sentimentCounts = data
    ? Object.entries(
        data.sentiment.reduce((acc: Record<string, number>, s: string) => {
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {})
      ).map(([name, count]) => ({ name, count }))
    : [];

  // 2) Top overall keywords
  const keywordFreq: Record<string, number> = {};
  data?.keywords.flat().forEach((kw) => {
    keywordFreq[kw] = (keywordFreq[kw] || 0) + 1;
  });
  const topKeywords = Object.entries(keywordFreq)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 3) Top keywords by sentiment
  const keywordsBySentiment: Record<string, string[]> = {};
  data?.sentiment.forEach((sent, i) => {
    const kws = data.keywords[i] || [];
    if (!keywordsBySentiment[sent]) keywordsBySentiment[sent] = [];
    keywordsBySentiment[sent].push(...kws);
  });
  const topBySentiment = Object.entries(keywordsBySentiment).map(
    ([sentiment, kws]) => {
      const freq: Record<string, number> = {};
      kws.forEach((k) => (freq[k] = (freq[k] || 0) + 1));
      const top5 = Object.entries(freq)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      return { sentiment, top5 };
    }
  );

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl mb-4">YTInsight Hybrid – Phase 1</h1>

      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 border rounded p-2"
          placeholder="Enter YouTube Video ID"
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
        />
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          disabled={loading || !videoId}
          onClick={analyze}
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </div>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      {data && !error && (
        <>
          {/* Sentiment Distribution */}
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

          {/* Top Overall Keywords */}
          <section className="mb-8">
            <h2 className="text-2xl mb-2">Top Keywords</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={topKeywords}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" />
                <Tooltip />
                <Bar dataKey="count" />
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* Top Keywords by Sentiment */}
          <section className="mb-8">
            <h2 className="text-2xl mb-2">Top Keywords by Sentiment</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {topBySentiment.map(({ sentiment, top5 }) => (
                <div key={sentiment} className="border rounded p-4">
                  <h3 className="text-lg font-semibold mb-2">
                    {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
                  </h3>
                  <ul className="list-disc list-inside">
                    {top5.map(({ name, count }) => (
                      <li key={name}>
                        {name} ({count})
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {!data && !loading && !error && (
        <p className="text-gray-500">Enter a video ID and click Analyze.</p>
      )}
    </div>
  );
}

export default App;
