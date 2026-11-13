import https from "https";

function fetchUrl(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { "User-Agent": "BaseAudit/1.0" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          url,
          statusCode: res.statusCode,
          headers: res.headers,
          bodySnippet: data.slice(0, 300),
        });
      });
    });
    req.on("error", (err) => {
      resolve({ url, error: err.message });
    });
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ url, error: "Timeout after 10s" });
    });
  });
}

function maskKeyedUrl(str) {
  if (!str) return "";
  // Mask API keys or hex keys in URLs e.g. /v2/abcdef... -> /v2/***
  return str.replace(/(https?:\/\/[^\s;'"]+?\/v[0-9]+\/)([a-zA-Z0-9_-]{10,})/g, "$1[MASKED_KEY]")
            .replace(/(apiKey|key|apikey)=([a-zA-Z0-9_-]{10,})/gi, "$1=[MASKED_KEY]");
}

async function main() {
  const endpoints = [
    "https://base-analytics-app.vercel.app/",
    "https://base-analytics-app.vercel.app/api/limit-orders/region-check",
    "https://base-analytics-app.vercel.app/.well-known/security.txt",
  ];

  for (const ep of endpoints) {
    console.log(`\n===============================================================`);
    console.log(`REQUEST: ${ep}`);
    console.log(`===============================================================`);
    const res = await fetchUrl(ep);
    if (res.error) {
      console.log(`Error: ${res.error}`);
      continue;
    }
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`x-vercel-id: ${res.headers["x-vercel-id"] || "none"}`);
    console.log(`strict-transport-security: ${res.headers["strict-transport-security"] || "none"}`);
    console.log(`x-frame-options: ${res.headers["x-frame-options"] || "none"}`);

    const csp = res.headers["content-security-policy"] || "";
    if (csp) {
      const connectSrcMatch = csp.match(/connect-src[^;]+/);
      const maskedConnectSrc = maskKeyedUrl(connectSrcMatch ? connectSrcMatch[0] : "none");
      console.log(`CSP connect-src: ${maskedConnectSrc}`);
    } else {
      console.log(`CSP connect-src: none`);
    }
    console.log(`Body snippet: ${res.bodySnippet.replace(/[\r\n]+/g, " ")}`);
  }
}

main();
